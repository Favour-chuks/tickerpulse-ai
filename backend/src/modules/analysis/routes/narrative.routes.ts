// GET    /api/narratives/:ticker
// GET    /api/narratives/:ticker/timeline
// GET    /api/narratives/:ticker/contradictions
// GET    /api/narratives/:ticker/latest
// GET    /api/narratives/:ticker/compare

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { supabase } from '../../../shared/infra/libs/supabase.js';
import analysisService from '../services/analysis.service.js';
import contradictionTrackingService from '../services/contradictionTracking.service.js';
import redisCacheService, { CACHE_KEYS, CACHE_TTL } from '../../../shared/infra/services/cache.service.js';
import { logger } from '../../../config/logger.js';

export default async function narrativeRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/narratives/:ticker
   * Get all narratives for a ticker
   */
  fastify.get<{ Params: { ticker: string }; Querystring: { limit?: number } }>(
    '/:ticker',
    
    async (request: FastifyRequest<{ Params: { ticker: string }; Querystring: { limit?: number } }>, reply) => {
      try {
        const { ticker } = request.params;
        const { limit = 20 } = request.query;

        const narratives = await analysisService.getNarrativesForTicker(
          ticker,
          Math.min(limit, 100)
        );

        return reply.send({
          success: true,
          ticker,
          count: narratives.length,
          narratives,
        });
      } catch (error: any) {
        logger.error({ msg: 'Error getting narratives', error });
        return reply.code(500).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /api/narratives/:ticker/timeline
   * Get timeline of narratives with metadata
   */
  fastify.get<{
    Params: { ticker: string };
    Querystring: {
      startDate?: string;
      endDate?: string;
      limit?: number;
    };
  }>(
    '/:ticker/timeline',
    async (request: FastifyRequest<{ Params: { ticker: string }; Querystring: { startDate?: string; endDate?: string; limit?: number } }>, reply) => {
      try {
        const { ticker } = request.params;
        const { startDate, endDate, limit = 50 } = request.query;

        const cacheKey = `timeline:${ticker}:${startDate}:${endDate}`;
        const cached = await redisCacheService.get(cacheKey);
        if (cached) {
          return reply.send(cached);
        }

        let query = supabase
          .from('company_narratives')
          .select(
            `
            id,
            ticker,
            summary,
            tone_shift,
            management_confidence_score,
            key_changes,
            filing_id,
            created_at,
            sec_filings (filing_type, filed_at, url)
          `
          )
          .eq('ticker', ticker);

        if (startDate) {
          query = query.gte('created_at', new Date(startDate).toISOString());
        }

        if (endDate) {
          query = query.lte('created_at', new Date(endDate).toISOString());
        }

        const { data: narratives } = await query
          .order('created_at', { ascending: false })
          .limit(Math.min(limit, 100));

        const timeline = (narratives || []).map((n, idx) => ({
          position: idx + 1,
          date: n.created_at,
          filing_type: n.sec_filings[0]?.filing_type || null,
          filing_date: n.sec_filings[0]?.filed_at || null,
          filing_url: n.sec_filings[0]?.url || null,
          summary: n.summary,
          tone: n.tone_shift || 'Neutral',
          confidence: n.management_confidence_score || 5,
          key_changes: n.key_changes || [],
        }));

        const result = {
          success: true,
          ticker,
          period: {
            start: startDate,
            end: endDate,
          },
          timeline,
          count: timeline.length,
        };

        // Cache result
        await redisCacheService.set(cacheKey, result, CACHE_TTL.NARRATIVE_SUMMARY);

        return reply.send(result);
      } catch (error: any) {
        logger.error({ msg: 'Error getting timeline', error });
        return reply.code(500).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /api/narratives/:ticker/contradictions
   * Get contradictions for a ticker
   */
  fastify.get<{
    Params: { ticker: string };
    Querystring: { severity?: string; limit?: number };
  }>(
    '/:ticker/contradictions',
    async (request: FastifyRequest<{ Params: { ticker: string }; Querystring: { severity?: string; limit?: number } }>, reply) => {
      try {
        const { ticker } = request.params;
        const { severity, limit = 20 } = request.query;

        const cacheKey = `contradictions:${ticker}:${severity}`;
        const cached = await redisCacheService.get(cacheKey);
        if (cached) {
          return reply.send(cached);
        }

        const contradictions =
          await contradictionTrackingService.getContradictionsForTicker(
            ticker,
            severity as any
          );

        const stats = {
          total: contradictions.length,
          bySeverity: {
            low: contradictions.filter((c) => c.severity === 'low').length,
            medium: contradictions.filter((c) => c.severity === 'medium').length,
            high: contradictions.filter((c) => c.severity === 'high').length,
            critical: contradictions.filter((c) => c.severity === 'critical')
              .length,
          },
        };

        const result = {
          success: true,
          ticker,
          stats,
          contradictions: contradictions.slice(0, limit),
          count: contradictions.length,
        };

        // Cache result
        await redisCacheService.set(
          cacheKey,
          result,
          CACHE_TTL.NARRATIVE_SUMMARY
        );

        return reply.send(result);
      } catch (error: any) {
        logger.error({ msg: 'Error getting contradictions', error });
        return reply.code(500).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /api/narratives/:ticker/latest
   * Get latest narrative
   */
  fastify.get<{ Params: { ticker: string } }>(
    '/:ticker/latest',
    async (request: FastifyRequest<{ Params: { ticker: string } }>, reply) => {
      try {
        const { ticker } = request.params;

        const cacheKey = `latest:narrative:${ticker}`;
        const cached = await redisCacheService.get(cacheKey);
        if (cached) {
          return reply.send({
            success: true,
            data: cached,
          });
        }

        const { data: narrative } = await supabase
          .from('company_narratives')
          .select(
            `
            *,
            sec_filings (*)
          `
          )
          .eq('ticker', ticker)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!narrative) {
          return reply.code(404).send({
            success: false,
            error: 'No narrative found',
          });
        }

        // Cache result
        await redisCacheService.set(
          cacheKey,
          narrative,
          CACHE_TTL.NARRATIVE_SUMMARY
        );

        return reply.send({
          success: true,
          data: narrative,
        });
      } catch (error: any) {
        logger.error({ msg: 'Error getting latest narrative', error });
        return reply.code(500).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /api/narratives/:ticker/compare
   * Compare two narratives
   */
  fastify.get<{
    Params: { ticker: string };
    Querystring: { id1: number; id2: number };
  }>(
    '/:ticker/compare',
    async (request: FastifyRequest<{ Params: { ticker: string }; Querystring: { id1: number; id2: number } }>, reply) => {
      try {
        const { ticker } = request.params;
        const { id1, id2 } = request.query;

        const { data: narrative1 } = await supabase
          .from('company_narratives')
          .select('*')
          .eq('id', id1)
          .eq('ticker', ticker)
          .single();

        const { data: narrative2 } = await supabase
          .from('company_narratives')
          .select('*')
          .eq('id', id2)
          .eq('ticker', ticker)
          .single();

        if (!narrative1 || !narrative2) {
          return reply.code(404).send({
            success: false,
            error: 'One or both narratives not found',
          });
        }

        return reply.send({
          success: true,
          ticker,
          narrative1,
          narrative2,
          changes: {
            tone_shift: {
              from: narrative1.tone_shift,
              to: narrative2.tone_shift,
            },
            confidence_delta:
              (narrative2.management_confidence_score || 5) -
              (narrative1.management_confidence_score || 5),
            tone_changed: narrative1.tone_shift !== narrative2.tone_shift,
          },
        });
      } catch (error: any) {
        logger.error({ msg: 'Error comparing narratives', error });
        return reply.code(500).send({
          success: false,
          error: error.message,
        });
      }
    }
  );
}