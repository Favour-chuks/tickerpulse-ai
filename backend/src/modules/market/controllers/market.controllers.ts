import type { FastifyReply, FastifyRequest } from 'fastify';
import { supabase } from '../libs/supabase.js';

interface SearchQuery {
  search_term: string;
  limit?: number;
}

interface TickerParams {
  symbol: string;
}

interface MarketDataQuery {
  days?: number;
  interval?: string;
}

interface VolumeSpikeQuery {
  symbol?: string;
  days?: number;
  movement_type?: string;
  min_deviation?: number;
}

interface SentimentQuery {
  source?: string;
  days?: number;
}

interface SECFilingQuery {
  filing_type?: string;
  limit?: number;
}

interface CompareBody {
  symbols: string[];
}

interface CustomQueryBody {
  query: string;
  explanation: string;
}

export class MarketDataController {
  /**
   * Search for stock tickers by symbol or company name
   * GET /api/tickers/search?search_term=AAPL&limit=10
   */
  public searchTickers = async (
    request: FastifyRequest<{ Querystring: SearchQuery }>,
    reply: FastifyReply
  ) => {
    try {
      const { search_term, limit = 10 } = request.query;

      if (!search_term) {
        return reply.code(400).send({ error: 'search_term is required' });
      }

      const { data, error } = await supabase
        .from('tickers')
        .select('id, symbol, company_name, exchange, sector, is_active')
        .or(`symbol.ilike.%${search_term}%,company_name.ilike.%${search_term}%`)
        .eq('is_active', true)
        .limit(limit);

      if (error) throw error;

      return reply.send({
        success: true,
        tickers: data,
        count: data?.length || 0,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  };

  /**
   * Get detailed information about a specific ticker
   * GET /api/tickers/:symbol/details
   */
  public getTickerDetails = async (
    request: FastifyRequest<{ Params: TickerParams }>,
    reply: FastifyReply
  ) => {
    try {
      const { symbol } = request.params;

      // Get ticker ID
      const { data: ticker, error: tickerError } = await supabase
        .from('tickers')
        .select('id, symbol, company_name, exchange, sector')
        .eq('symbol', symbol.toUpperCase())
        .single();

      if (tickerError || !ticker) {
        return reply.code(404).send({ 
          success: false, 
          error: `Ticker ${symbol} not found` 
        });
      }

      // Get latest market data
      const { data: latestData } = await supabase
        .from('market_data')
        .select('time, price, volume, open, high, low, close')
        .eq('ticker_id', ticker.id)
        .order('time', { ascending: false })
        .limit(1)
        .single();

      // Get technical stats
      const { data: techStats } = await supabase
        .from('cached_tech_stats')
        .select('*')
        .eq('ticker_id', ticker.id)
        .single();

      return reply.send({
        success: true,
        ticker,
        latest_market_data: latestData,
        technical_indicators: techStats,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  };

  /**
   * Get historical market data for a ticker
   * GET /api/tickers/:symbol/market-data?days=30&interval=daily
   */
  public getMarketData = async (
    request: FastifyRequest<{ 
      Params: TickerParams; 
      Querystring: MarketDataQuery 
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { symbol } = request.params;
      const { days = 30, interval = 'daily' } = request.query;

      const { data: ticker } = await supabase
        .from('tickers')
        .select('id')
        .eq('symbol', symbol.toUpperCase())
        .single();

      if (!ticker) {
        return reply.code(404).send({ 
          success: false, 
          error: `Ticker ${symbol} not found` 
        });
      }

      const { data, error } = await supabase
        .from('market_data')
        .select('time, open, high, low, close, volume, price')
        .eq('ticker_id', ticker.id)
        .gte('time', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('time', { ascending: false })
        .limit(days);

      if (error) throw error;

      return reply.send({
        success: true,
        symbol,
        days,
        data_points: data?.length || 0,
        market_data: data,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  };

  /**
   * Get recent volume spikes/anomalies
   * GET /api/volume-spikes?symbol=TSLA&days=7&movement_type=SPIKE&min_deviation=3
   */
  public getVolumeSpikes = async (
    request: FastifyRequest<{ Querystring: VolumeSpikeQuery }>,
    reply: FastifyReply
  ) => {
    try {
      const { symbol, days = 7, movement_type, min_deviation } = request.query;

      let query = supabase
        .from('volume_spikes')
        .select(`
          *,
          tickers (symbol, company_name)
        `)
        .gte('detected_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('detected_at', { ascending: false });

      if (symbol) {
        const { data: ticker } = await supabase
          .from('tickers')
          .select('id')
          .eq('symbol', symbol.toUpperCase())
          .single();
        
        if (ticker) {
          query = query.eq('ticker_id', ticker.id);
        }
      }

      if (movement_type) {
        query = query.eq('movement_type', movement_type);
      }

      if (min_deviation) {
        query = query.gte('deviation_multiple', min_deviation);
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;

      return reply.send({
        success: true,
        spikes: data,
        count: data?.length || 0,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  };

  /**
   * Get sentiment analysis from social mentions/news/SEC filings
   * GET /api/tickers/:symbol/sentiment?source=all&days=30
   */
  public getSentimentAnalysis = async (
    request: FastifyRequest<{ 
      Params: TickerParams; 
      Querystring: SentimentQuery 
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { symbol } = request.params;
      const { source = 'all', days = 30 } = request.query;

      const { data: ticker } = await supabase
        .from('tickers')
        .select('id')
        .eq('symbol', symbol.toUpperCase())
        .single();

      if (!ticker) {
        return reply.code(404).send({ 
          success: false, 
          error: `Ticker ${symbol} not found` 
        });
      }

      let query = supabase
        .from('social_mentions')
        .select('*')
        .eq('ticker_id', ticker.id)
        .gte('published_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('published_at', { ascending: false });

      if (source !== 'all') {
        query = query.eq('source', source);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;

      // Calculate aggregated sentiment
      const aggregated = {
        avg_sentiment_score: 0,
        avg_polarity: 0,
        avg_uncertainty: 0,
        positive_count: 0,
        negative_count: 0,
        neutral_count: 0,
      };

      if (data && data.length > 0) {
        aggregated.avg_sentiment_score = data.reduce((sum, m) => sum + (m.sentiment_score || 0), 0) / data.length;
        aggregated.avg_polarity = data.reduce((sum, m) => sum + (m.polarity_score || 0), 0) / data.length;
        aggregated.avg_uncertainty = data.reduce((sum, m) => sum + (m.uncertainty_score || 0), 0) / data.length;
        aggregated.positive_count = data.filter(m => m.sentiment === 'positive').length;
        aggregated.negative_count = data.filter(m => m.sentiment === 'negative').length;
        aggregated.neutral_count = data.filter(m => m.sentiment === 'neutral').length;
      }

      return reply.send({
        success: true,
        symbol,
        source,
        mention_count: data?.length || 0,
        aggregated,
        mentions: data,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  };

  /**
   * Check for divergence between SEC filing language and social sentiment
   * GET /api/tickers/:symbol/sentiment-divergence
   */
  public checkSentimentDivergence = async (
    request: FastifyRequest<{ Params: TickerParams }>,
    reply: FastifyReply
  ) => {
    try {
      const { symbol } = request.params;

      const { data: ticker } = await supabase
        .from('tickers')
        .select('id')
        .eq('symbol', symbol.toUpperCase())
        .single();

      if (!ticker) {
        return reply.code(404).send({ 
          success: false, 
          error: `Ticker ${symbol} not found` 
        });
      }

      // Call the Postgres function (you may need to create this)
      const { data, error } = await supabase.rpc('check_sentiment_divergence', {
        p_ticker_id: ticker.id,
      });

      if (error) throw error;

      return reply.send({
        success: true,
        symbol,
        divergence_analysis: data?.[0] || null,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  };

  /**
   * Get SEC filings for a ticker
   * GET /api/tickers/:symbol/sec-filings?filing_type=10-K&limit=10
   */
  public getSECFilings = async (
    request: FastifyRequest<{ 
      Params: TickerParams; 
      Querystring: SECFilingQuery 
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { symbol } = request.params;
      const { filing_type, limit = 10 } = request.query;

      const { data: ticker } = await supabase
        .from('tickers')
        .select('id')
        .eq('symbol', symbol.toUpperCase())
        .single();

      if (!ticker) {
        return reply.code(404).send({ 
          success: false, 
          error: `Ticker ${symbol} not found` 
        });
      }

      let query = supabase
        .from('sec_filings')
        .select('*')
        .eq('ticker_id', ticker.id)
        .order('filed_at', { ascending: false })
        .limit(limit);

      if (filing_type) {
        query = query.eq('filing_type', filing_type);
      }

      const { data, error } = await query;

      if (error) throw error;

      return reply.send({
        success: true,
        symbol,
        filing_type: filing_type || 'all',
        filings: data,
        count: data?.length || 0,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  };

  /**
   * Comprehensive health check for a ticker
   * GET /api/tickers/:symbol/health
   */
  public analyzeTickerHealth = async (
    request: FastifyRequest<{ Params: TickerParams }>,
    reply: FastifyReply
  ) => {
    try {
      const { symbol } = request.params;

      // Gather all data in parallel
      const [
        tickerDetails,
        marketData,
        volumeSpikes,
        sentiment,
        secFilings,
      ] = await Promise.all([
        this.getTickerDetailsData(symbol),
        this.getMarketDataData(symbol, 30),
        this.getVolumeSpikesData(symbol, 7),
        this.getSentimentData(symbol, 30),
        this.getSECFilingsData(symbol, 5),
      ]);

      return reply.send({
        success: true,
        symbol,
        health_analysis: {
          ticker_details: tickerDetails,
          recent_market_data: marketData,
          volume_anomalies: volumeSpikes,
          sentiment_analysis: sentiment,
          recent_filings: secFilings,
        },
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  };

  /**
   * Compare multiple tickers side-by-side
   * POST /api/tickers/compare
   * Body: { symbols: ["AAPL", "MSFT", "GOOGL"] }
   */
  public compareTickers = async (
    request: FastifyRequest<{ Body: CompareBody }>,
    reply: FastifyReply
  ) => {
    try {
      const { symbols } = request.body;

      if (!symbols || symbols.length < 2 || symbols.length > 5) {
        return reply.code(400).send({ 
          success: false, 
          error: 'Please provide 2-5 tickers to compare' 
        });
      }

      const comparisons = await Promise.all(
        symbols.map(async (symbol) => {
          const [details, sentiment] = await Promise.all([
            this.getTickerDetailsData(symbol),
            this.getSentimentData(symbol, 7),
          ]);
          return {
            symbol,
            details,
            sentiment,
          };
        })
      );

      return reply.send({
        success: true,
        compared_tickers: comparisons,
        count: comparisons.length,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  };

  /**
   * Execute custom SQL query (read-only)
   * POST /api/query/custom
   * Body: { query: "SELECT ...", explanation: "..." }
   */
  public executeCustomQuery = async (
    request: FastifyRequest<{ Body: CustomQueryBody }>,
    reply: FastifyReply
  ) => {

     return reply.code(403).send({
    success: false,
    error: 'Custom SQL queries are disabled for security reasons'
  });
  // TODO: check if this code is needed for the function calling and uncommment if true and run the function in supabase
    // try {
    //   const { query, explanation } = request.body;

    //   // Security: Only allow SELECT queries
    //   const upperQuery = query.trim().toUpperCase();
    //   if (!upperQuery.startsWith('SELECT')) {
    //     return reply.code(400).send({ 
    //       success: false, 
    //       error: 'Only SELECT queries are allowed' 
    //     });
    //   }

    //   // Check for dangerous keywords
    //   const dangerous = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'ALTER', 'CREATE', 'TRUNCATE'];
    //   if (dangerous.some((keyword) => upperQuery.includes(keyword))) {
    //     return reply.code(400).send({ 
    //       success: false, 
    //       error: 'Query contains forbidden keywords' 
    //     });
    //   }

    //   // Add LIMIT if not present
    //   let finalQuery = query.trim();
    //   if (!upperQuery.includes('LIMIT')) {
    //     finalQuery += ' LIMIT 100';
    //   }

    //   const { data, error } = await supabase.rpc('execute_sql', {
    //     sql_query: finalQuery,
    //   });

    //   if (error) throw error;

    //   return reply.send({
    //     success: true,
    //     explanation,
    //     row_count: Array.isArray(data) ? data.length : 0,
    //     results: data,
    //   });
    // } catch (error: any) {
    //   request.log.error(error);
    //   return reply.code(500).send({ success: false, error: error.message });
    // }
  };

  // ==================== HELPER METHODS ====================

  private async getTickerDetailsData(symbol: string) {
    const { data: ticker } = await supabase
      .from('tickers')
      .select('id, symbol, company_name, exchange, sector')
      .eq('symbol', symbol.toUpperCase())
      .single();

    if (!ticker) return null;

    const { data: latestData } = await supabase
      .from('market_data')
      .select('time, price, volume, open, high, low, close')
      .eq('ticker_id', ticker.id)
      .order('time', { ascending: false })
      .limit(1)
      .single();

    const { data: techStats } = await supabase
      .from('cached_tech_stats')
      .select('*')
      .eq('ticker_id', ticker.id)
      .single();

    return { ticker, latest_market_data: latestData, technical_indicators: techStats };
  }

  private async getMarketDataData(symbol: string, days: number) {
    const { data: ticker } = await supabase
      .from('tickers')
      .select('id')
      .eq('symbol', symbol.toUpperCase())
      .single();

    if (!ticker) return null;

    const { data } = await supabase
      .from('market_data')
      .select('time, open, high, low, close, volume, price')
      .eq('ticker_id', ticker.id)
      .gte('time', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('time', { ascending: false })
      .limit(days);

    return data;
  }

  private async getVolumeSpikesData(symbol: string, days: number) {
    const { data: ticker } = await supabase
      .from('tickers')
      .select('id')
      .eq('symbol', symbol.toUpperCase())
      .single();

    if (!ticker) return null;

    const { data } = await supabase
      .from('volume_spikes')
      .select('*')
      .eq('ticker_id', ticker.id)
      .gte('detected_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('detected_at', { ascending: false })
      .limit(50);

    return data;
  }

  private async getSentimentData(symbol: string, days: number) {
    const { data: ticker } = await supabase
      .from('tickers')
      .select('id')
      .eq('symbol', symbol.toUpperCase())
      .single();

    if (!ticker) return null;

    const { data } = await supabase
      .from('social_mentions')
      .select('*')
      .eq('ticker_id', ticker.id)
      .gte('published_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('published_at', { ascending: false })
      .limit(100);

    return data;
  }

  private async getSECFilingsData(symbol: string, limit: number) {
    const { data: ticker } = await supabase
      .from('tickers')
      .select('id')
      .eq('symbol', symbol.toUpperCase())
      .single();

    if (!ticker) return null;

    const { data } = await supabase
      .from('sec_filings')
      .select('*')
      .eq('ticker_id', ticker.id)
      .order('filed_at', { ascending: false })
      .limit(limit);

    return data;
  }
}

export const marketDataController = new MarketDataController();