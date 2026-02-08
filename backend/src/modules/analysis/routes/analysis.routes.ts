import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AnalysisController } from '../controllers/analysis.controllers.js';
import analysisService from '../services/analysis.service.js';
import { logger } from '../../../config/logger.js';

async function analysisRoutes(fastify: FastifyInstance) {
  const analysisController = new AnalysisController();

  fastify.post<{ Body: { ticker: string; filingId: number } }>(
    '/filing',
    async (request: FastifyRequest<{ Body: { ticker: string; filingId: number } }>, reply: FastifyReply) => {
      try {
        const { ticker, filingId } = request.body;
        const analysis = await analysisService.analyzeFiling(ticker, filingId);
        return reply.send({
          success: true,
          data: analysis,
        });
      } catch (error: any) {
        logger.error({ msg: 'Error analyzing filing', error });
        return reply.code(400).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * POST /api/analyze/compare-filings
   * Compare two filings
   */
  fastify.post<{
    Body: { ticker: string; filingId1: number; filingId2: number };
  }>(
    '/compare-filings',
    async (request: FastifyRequest<{ Body: { ticker: string; filingId1: number; filingId2: number } }>, reply: FastifyReply) => {
      try {
        const { ticker, filingId1, filingId2 } = request.body;
        const comparison = await analysisService.compareFilings(
          ticker,
          filingId1,
          filingId2
        );
        return reply.send({
          success: true,
          data: comparison,
        });
      } catch (error: any) {
        logger.error({ msg: 'Error comparing filings', error });
        return reply.code(400).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /api/analyze/promises/:ticker
   * Get promises for a ticker
   */
  fastify.get<{ Params: { ticker: string } }>(
    '/promises/:ticker',
    async (request: FastifyRequest<{ Params: { ticker: string } }>, reply: FastifyReply) => {
      try {
        const { ticker } = request.params;
        const promises = await analysisService.getPromisesForTicker(ticker);
        return reply.send({
          success: true,
          data: promises,
          count: promises.length,
        });
      } catch (error: any) {
        logger.error({ msg: 'Error getting promises', error });
        return reply.code(500).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /api/analyze/contradictions/:ticker
   * Get contradictions for a ticker
   */
  fastify.get<{ Params: { ticker: string }; Querystring: { severity?: string } }>(
    '/contradictions/:ticker',
    async (request: FastifyRequest<{ Params: { ticker: string }; Querystring: { severity?: string } }>, reply: FastifyReply) => {
      try {
        const { ticker } = request.params;
        const { severity } = request.query;
        const contradictions = await analysisService.getContradictionsForTicker(
          ticker,
          severity
        );
        return reply.send({
          success: true,
          data: contradictions,
          count: contradictions.length,
        });
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
   * GET /api/analyze/filings/:ticker
   * Get recent filings for a ticker
   */
  fastify.get<{ Params: { ticker: string }; Querystring: { limit?: number } }>(
    '/filings/:ticker',
    async (request: FastifyRequest<{ Params: { ticker: string }; Querystring: { limit?: number } }>, reply: FastifyReply) => {
      try {
        const { ticker } = request.params;
        const { limit = 10 } = request.query;
        const filings = await analysisService.getRecentFilings(
          ticker,
          Math.min(limit, 50)
        );
        return reply.send({
          success: true,
          data: filings,
          count: filings.length,
        });
      } catch (error: any) {
        logger.error({ msg: 'Error getting filings', error });
        return reply.code(500).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  fastify.post(
    '/analyze',
    {
      schema: {
        description: 'Analyze financial data using AI assistant',
        tags: ['Analysis'],
        body: {
          type: 'object',
          required: ['message'],
          properties: {
            message: { type: 'string', description: 'User message/query' },
            conversation_history: {
              type: 'array',
              description: 'Previous conversation messages',
              items: {
                type: 'object',
                properties: {
                  role: { type: 'string', enum: ['user', 'model'] },
                  parts: { type: 'array' },
                },
              },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              response: { type: 'string' },
              conversation_history: { type: 'array' },
              tool_calls: { type: 'array' },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          500: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              details: { type: 'string' },
            },
          },
        },
      },
    },
    analysisController.analyze.bind(analysisController)
  );
}

export default analysisRoutes;