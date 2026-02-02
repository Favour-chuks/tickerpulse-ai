import type { FastifyReply, FastifyRequest } from 'fastify';
import { supabase } from '../../../shared/infra/libs/supabase.js';

interface TickerParams {
  ticker: string;
}

interface TimelineQuery {
  startDate?: string;
  endDate?: string;
  limit?: number;
}

interface ContradictionsQuery {
  severity?: 'low' | 'medium' | 'high';
  limit?: number;
}

interface SecFiling {
  filing_type: string;
  filed_at: string;
  url: string;
}

interface NarrativeStatement {
  id: string;
  summary: string;
  created_at: string;
  sec_filings: SecFiling;
}

export class NarrativeController {
  public getTickerNarratives = async (
    request: FastifyRequest<{ Params: TickerParams }>, 
    reply: FastifyReply
  ) => {
    try {
      const { ticker } = request.params;
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      if (!ticker || ticker.length > 5) {
        return reply.code(400).send({ 
          error: 'Invalid ticker symbol' 
        });
      }

      const tickerUpper = ticker.toUpperCase();

      const { data, error } = await supabase
        .from('company_narratives')
        .select(`
          id,
          ticker,
          filing_type,
          summary,
          key_changes,
          risk_changes,
          tone_shift,
          guidance,
          management_confidence,
          created_at,
          sec_filings!inner (
            accession_number,
            filed_at,
            url
          )
        `)
        .eq('ticker', tickerUpper)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching narratives:', error);
        return reply.code(400).send({ error: error.message });
      }

      if (!data || data.length === 0) {
        return reply.code(404).send({ 
          error: `No narratives found for ${tickerUpper}` 
        });
      }

      return reply.send({
        ticker: tickerUpper,
        count: data.length,
        narratives: data
      });
    } catch (error) {
      console.error('Unexpected error in getTickerNarratives:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  };

  /**
   * Get chronological timeline of narratives for a ticker
   * GET /api/narratives/:ticker/timeline?startDate=2025-01-01&endDate=2025-12-31&limit=10
   */
  public getTickerTimeline = async (
    request: FastifyRequest<{ 
      Params: TickerParams; 
      Querystring: TimelineQuery 
    }>, 
    reply: FastifyReply
  ) => {
    try {
      const { ticker } = request.params;
      const { startDate, endDate, limit = 20 } = request.query;
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      if (!ticker || ticker.length > 5) {
        return reply.code(400).send({ 
          error: 'Invalid ticker symbol' 
        });
      }

      const tickerUpper = ticker.toUpperCase();

      let query = supabase
      .from('company_narratives')
      .select(`
        id,
        filing_type,
        summary,
        tone_shift,
        management_confidence,
        created_at,
        tickers!inner (
          symbol
        ),
        sec_filings!inner (
          filing_type,
          filed_at,
          url
        )
      `)
      .eq('tickers.symbol', tickerUpper)
      .order('created_at', { ascending: true })
      .limit(limit);

      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching timeline:', error);
        return reply.code(400).send({ error: error.message });
      }

      if (!data || data.length === 0) {
        return reply.code(404).send({ 
          error: `No timeline data found for ${tickerUpper}` 
        });
      }

      const timeline = data.map((narrative, index) => ({
        position: index + 1,
        date: narrative.created_at,
        filing_type: narrative.filing_type,
        summary: narrative.summary,
        tone: narrative.tone_shift,
        confidence: narrative.management_confidence,
        filing_url: narrative.sec_filings?.url
      }));

      return reply.send({
        ticker: tickerUpper,
        period: {
          start: data[0]?.created_at,
          end: data[data.length - 1]?.created_at
        },
        count: timeline.length,
        timeline: timeline
      });
    } catch (error) {
      console.error('Unexpected error in getTickerTimeline:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  };

  /**
   * Get contradictions found in narratives for a ticker
   * GET /api/narratives/:ticker/contradictions?severity=high&limit=10
   */
  public getTickerContradictions = async (
    request: FastifyRequest<{ 
      Params: TickerParams; 
      Querystring: ContradictionsQuery 
    }>, 
    reply: FastifyReply
  ) => {
    try {
      const { ticker } = request.params;
      const { severity, limit = 20 } = request.query;
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      if (!ticker || ticker.length > 5) {
        return reply.code(400).send({ 
          error: 'Invalid ticker symbol' 
        });
      }

      const tickerUpper = ticker.toUpperCase();

      let query = supabase
        .from('narrative_contradictions')
        .select(`
          id,
          contradiction_type,
          explanation,
          severity,
          detected_at,
          statement_1:company_narratives!narrative_contradictions_statement_1_id_fkey!inner (
            id,
            summary,
            created_at,
            tickers ( symbol ),
            sec_filings (
              filing_type,
              filed_at,
              url
            )
          ),
          statement_2:company_narratives!narrative_contradictions_statement_2_id_fkey (
            id,
            summary,
            created_at,
            tickers ( symbol ),
            sec_filings (
              filing_type,
              filed_at,
              url
            )
          )
        `)
        .eq('statement_1.ticker', tickerUpper) 
        .order('detected_at', { ascending: false })
        .limit(limit);

      if (severity) {
        query = query.eq('severity', severity);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching contradictions:', error);
        return reply.code(400).send({ error: error.message });
      }

      if (!data || data.length === 0) {
        return reply.code(404).send({ 
          error: `No contradictions found for ${tickerUpper}` 
        });
      }   

      const contradictions = data.map((item) => ({
        id: item.id,
        type: item.contradiction_type,
        severity: item.severity,
        explanation: item.explanation,
        detected_at: item.detected_at,
        earlier_statement: {
          date: item.statement_1?.created_at,
          summary: item.statement_1?.summary,
          filing_type: item.statement_1?.sec_filings?.filing_type,
          filing_url: item.statement_1?.sec_filings?.url
        },
        later_statement: {
          date: item.statement_2?.created_at,
          summary: item.statement_2?.summary,
          filing_type: item.statement_2?.sec_filings?.filing_type,
          filing_url: item.statement_2?.sec_filings?.url
        }
      }));

      const stats = {
        total: contradictions.length,
        by_severity: {
          high: contradictions.filter(c => c.severity === 'high').length,
          medium: contradictions.filter(c => c.severity === 'medium').length,
          low: contradictions.filter(c => c.severity === 'low').length
        },
        by_type: contradictions.reduce((acc, c) => {
          acc[c.type] = (acc[c.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };

      return reply.send({
        ticker: tickerUpper,
        stats: stats,
        contradictions: contradictions
      });
    } catch (error) {
      console.error('Unexpected error in getTickerContradictions:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  };

  /**
   * Get latest narrative for a ticker
   * GET /api/narratives/:ticker/latest
   */
  public getLatestNarrative = async (
    request: FastifyRequest<{ Params: TickerParams }>, 
    reply: FastifyReply
  ) => {
    try {
      const { ticker } = request.params;
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const tickerUpper = ticker.toUpperCase();

      const { data, error } = await supabase
        .from('company_narratives')
        .select(`
          *,
          sec_filings (
            filing_type,
            filed_at,
            url
          )
        `)
        .eq('ticker', tickerUpper)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return reply.code(404).send({ 
            error: `No narratives found for ${tickerUpper}` 
          });
        }
        console.error('Error fetching latest narrative:', error);
        return reply.code(400).send({ error: error.message });
      }

      return reply.send(data);
    } catch (error) {
      console.error('Unexpected error in getLatestNarrative:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  };

  /**
   * Compare two narratives
   * GET /api/narratives/:ticker/compare?id1=xxx&id2=yyy
   */
  public compareNarratives = async (
    request: FastifyRequest<{ 
      Params: TickerParams; 
      Querystring: { id1: string; id2: string } 
    }>, 
    reply: FastifyReply
  ) => {
    try {
      const { ticker } = request.params;
      const { id1, id2 } = request.query;
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      if (!id1 || !id2) {
        return reply.code(400).send({ 
          error: 'Both id1 and id2 are required' 
        });
      }

      const tickerUpper = ticker.toUpperCase();

      // Fetch both narratives
      const { data: narratives, error } = await supabase
        .from('company_narratives')
        .select(`
          *,
          sec_filings (
            filing_type,
            filed_at,
            url
          )
        `)
        .eq('ticker', tickerUpper)
        .in('id', [parseInt(id1), parseInt(id2)]);

      if (error) {
        console.error('Error fetching narratives for comparison:', error);
        return reply.code(400).send({ error: error.message });
      }

      if (!narratives || narratives.length < 2) {
        return reply.code(404).send({ 
          error: 'One or both narratives not found' 
        });
      }

      const [narrative1, narrative2] = narratives;
      
      if(!narrative1 || !narrative2) {
        return reply.code(404).send({ 
          error: 'One or both narratives not found' 
        });
      }

      const date1 = narrative1.created_at ? new Date(narrative1.created_at).getTime() : 0;
      const date2 = narrative2.created_at ? new Date(narrative2.created_at).getTime() : 0;
      // Calculate differences
      const comparison = {
        ticker: tickerUpper,
        narrative1: {
          id: narrative1.id,
          date: narrative1.created_at,
          filing_type: narrative1.filing_type,
          summary: narrative1.summary,
          confidence: narrative1.management_confidence,
          tone: narrative1.tone_shift
        },
        narrative2: {
          id: narrative2.id,
          date: narrative2.created_at,
          filing_type: narrative2.filing_type,
          summary: narrative2.summary,
          confidence: narrative2.management_confidence,
          tone: narrative2.tone_shift
        },
        changes: {
          confidence_delta: (narrative2.management_confidence ?? 0) - (narrative1.management_confidence ?? 0),
          tone_changed: narrative1.tone_shift !== narrative2.tone_shift,
          time_between_days: date1 && date2 
            ? Math.floor((date2 - date1) / (1000 * 60 * 60 * 24)) 
            : 0
        }
      };

      return reply.send(comparison);
    } catch (error) {
      console.error('Unexpected error in compareNarratives:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  };
}