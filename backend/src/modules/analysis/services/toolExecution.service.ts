import { supabase } from '../../../shared/infra/libs/supabase.js';
import { logger } from '../../../config/logger.js';
import type { ToolExecutionResult } from '../types/analysis.type.js';

export class ToolExecutionService {
  async searchTickers(searchTerm: string, limit: number = 10, userId?: string): Promise<ToolExecutionResult> {
    try {
      const { data, error } = await supabase
        .from('tickers')
        .select('id, symbol, company_name, exchange, sector, is_active')
        .or(`symbol.ilike.%${searchTerm}%,company_name.ilike.%${searchTerm}%`)
        .eq('is_active', true)
        .limit(limit);

      if (error) throw error;

      return {
        success: true,
        tickers: data,
        count: data?.length || 0,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async getTickerDetails(symbol: string, userId?: string): Promise<ToolExecutionResult> {
    try {
      const { data: ticker, error: tickerError } = await supabase
        .from('tickers')
        .select('id, symbol, company_name, exchange, sector')
        .eq('symbol', symbol.toUpperCase())
        .single();

      if (tickerError || !ticker) {
        return { success: false, error: `Ticker ${symbol} not found` };
      }

      const { data: latestData, error: marketError } = await supabase
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

      return {
        success: true,
        ticker,
        latest_market_data: latestData,
        technical_indicators: techStats,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async getMarketData(
    symbol: string,
    days: number = 30,
    interval: string = 'daily',
    userId?: string
  ): Promise<ToolExecutionResult> {
    try {
      const { data: ticker } = await supabase
        .from('tickers')
        .select('id')
        .eq('symbol', symbol.toUpperCase())
        .single();

      if (!ticker) {
        return { success: false, error: `Ticker ${symbol} not found` };
      }

      const { data, error } = await supabase
        .from('market_data')
        .select('time, open, high, low, close, volume, price')
        .eq('ticker_id', ticker.id)
        .gte('time', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('time', { ascending: false })
        .limit(days);

      if (error) throw error;

      return {
        success: true,
        symbol,
        days,
        data_points: data?.length || 0,
        market_data: data,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async getVolumeSpikes(
    symbol?: string,
    days: number = 7,
    movementType?: string,
    minDeviation?: number,
    userId?: string
  ): Promise<ToolExecutionResult> {
    try {
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

      if (movementType) {
        query = query.eq('movement_type', movementType);
      }

      if (minDeviation) {
        query = query.gte('deviation_multiple', minDeviation);
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;

      return {
        success: true,
        spikes: data,
        count: data?.length || 0,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async getSentimentAnalysis(
    symbol: string,
    source: string = 'all',
    days: number = 30,
    userId?: string
  ): Promise<ToolExecutionResult> {
    try {
      const { data: ticker } = await supabase
        .from('tickers')
        .select('id')
        .eq('symbol', symbol.toUpperCase())
        .single();

      if (!ticker) {
        return { success: false, error: `Ticker ${symbol} not found` };
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

      return {
        success: true,
        symbol,
        source,
        mention_count: data?.length || 0,
        aggregated,
        mentions: data,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async checkSentimentDivergence(symbol: string, userId?: string): Promise<ToolExecutionResult> {
    try {
      const { data: ticker } = await supabase
        .from('tickers')
        .select('id')
        .eq('symbol', symbol.toUpperCase())
        .single();

      if (!ticker) {
        return { success: false, error: `Ticker ${symbol} not found` };
      }

      const { data, error } = await supabase.rpc('check_sentiment_divergence', {
        p_ticker_id: ticker.id,
      });

      if (error) throw error;

      return {
        success: true,
        symbol,
        divergence_analysis: data?.[0] || null,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async getSECFilings(
    symbol: string,
    filingType?: string,
    limit: number = 10,
    userId?: string
  ): Promise<ToolExecutionResult> {
    try {
      const { data: ticker } = await supabase
        .from('tickers')
        .select('id')
        .eq('symbol', symbol.toUpperCase())
        .single();

      if (!ticker) {
        return { success: false, error: `Ticker ${symbol} not found` };
      }

      let query = supabase
        .from('sec_filings')
        .select('*')
        .eq('ticker_id', ticker.id)
        .order('filed_at', { ascending: false })
        .limit(limit);

      if (filingType) {
        query = query.eq('filing_type', filingType);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        symbol,
        filing_type: filingType || 'all',
        filings: data,
        count: data?.length || 0,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async getCompanyNarratives(symbol: string, limit: number = 5, userId?: string): Promise<ToolExecutionResult> {
    try {
      const { data: ticker } = await supabase
        .from('tickers')
        .select('id')
        .eq('symbol', symbol.toUpperCase())
        .single();

      if (!ticker) {
        return { success: false, error: `Ticker ${symbol} not found` };
      }

      const { data, error } = await supabase
        .from('company_narratives')
        .select('*')
        .eq('ticker_id', ticker.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return {
        success: true,
        symbol,
        narratives: data,
        count: data?.length || 0,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async getAlerts(
    symbol?: string,
    priority?: string,
    status: string = 'active',
    userId?: string
  ): Promise<ToolExecutionResult> {
    try {
      if (!userId) {
        return { success: false, error: 'User ID required for alerts' };
      }

      let query = supabase
        .from('notification_queue')
        .select(`
          *,
          tickers (symbol, company_name)
        `)
        .eq('user_id', userId)
        .eq('status', status)
        .order('created_at', { ascending: false });

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

      if (priority) {
        query = query.eq('priority', priority);
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;

      return {
        success: true,
        alerts: data,
        count: data?.length || 0,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async getWatchlist(watchlistName?: string, userId?: string): Promise<ToolExecutionResult> {
    try {
      if (!userId) {
        return { success: false, error: 'User ID required for watchlists' };
      }

      let query = supabase
        .from('watchlists')
        .select(`
          *,
          watchlist_items (
            *,
            tickers (*)
          )
        `)
        .eq('user_id', userId);

      if (watchlistName) {
        query = query.eq('name', watchlistName);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        watchlists: data,
        count: data?.length || 0,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async analyzeTickerHealth(symbol: string, userId?: string): Promise<ToolExecutionResult> {
    try {
      const tickerDetails = await this.getTickerDetails(symbol, userId);
      const marketData = await this.getMarketData(symbol, 30, 'daily', userId);
      const volumeSpikes = await this.getVolumeSpikes(symbol, 7, undefined, undefined, userId);
      const sentiment = await this.getSentimentAnalysis(symbol, 'all', 30, userId);
      const divergence = await this.checkSentimentDivergence(symbol, userId);
      const filings = await this.getSECFilings(symbol, undefined, 5, userId);
      const narratives = await this.getCompanyNarratives(symbol, 3, userId);

      return {
        success: true,
        symbol,
        health_analysis: {
          ticker_details: tickerDetails,
          recent_market_data: marketData,
          volume_anomalies: volumeSpikes,
          sentiment_analysis: sentiment,
          sentiment_divergence: divergence,
          recent_filings: filings,
          narrative_insights: narratives,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async compareTickers(symbols: string[], userId?: string): Promise<ToolExecutionResult> {
    try {
      if (symbols.length < 2 || symbols.length > 5) {
        return { success: false, error: 'Please provide 2-5 tickers to compare' };
      }

      const comparisons = await Promise.all(
        symbols.map(async (symbol) => {
          const details = await this.getTickerDetails(symbol, userId);
          const sentiment = await this.getSentimentAnalysis(symbol, 'all', 7, userId);
          return {
            symbol,
            details,
            sentiment,
          };
        })
      );

      return {
        success: true,
        compared_tickers: comparisons,
        count: comparisons.length,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async executeCustomQuery(query: string, explanation: string, userId?: string): Promise<ToolExecutionResult> {
    try {
      const upperQuery = query.trim().toUpperCase();
      if (!upperQuery.startsWith('SELECT')) {
        return { success: false, error: 'Only SELECT queries are allowed' };
      }

      const dangerous = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'ALTER', 'CREATE', 'TRUNCATE'];
      if (dangerous.some((keyword) => upperQuery.includes(keyword))) {
        return { success: false, error: 'Query contains forbidden keywords' };
      }

      let finalQuery = query.trim();
      if (!upperQuery.includes('LIMIT')) {
        finalQuery += ' LIMIT 100';
      }

      const { data, error } = await (supabase.rpc as any)('execute_sql', {
        sql_query: finalQuery,
      });

      if (error) throw error;

      return {
        success: true,
        explanation,
        row_count: Array.isArray(data) ? data.length : 0,
        results: data,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async executeTool(toolName: string, toolInput: any, userId?: string): Promise<any> {
    logger.info(`Executing tool: ${toolName}`);
    
    switch (toolName) {
      case 'search_tickers':
        return await this.searchTickers(toolInput.search_term, toolInput.limit, userId);
      case 'get_ticker_details':
        return await this.getTickerDetails(toolInput.symbol, userId);
      case 'get_market_data':
        return await this.getMarketData(toolInput.symbol, toolInput.days, toolInput.interval, userId);
      case 'get_volume_spikes':
        return await this.getVolumeSpikes(
          toolInput.symbol,
          toolInput.days,
          toolInput.movement_type,
          toolInput.min_deviation,
          userId
        );
      case 'get_sentiment_analysis':
        return await this.getSentimentAnalysis(toolInput.symbol, toolInput.source, toolInput.days, userId);
      case 'check_sentiment_divergence':
        return await this.checkSentimentDivergence(toolInput.symbol, userId);
      case 'get_sec_filings':
        return await this.getSECFilings(toolInput.symbol, toolInput.filing_type, toolInput.limit, userId);
      case 'get_company_narratives':
        return await this.getCompanyNarratives(toolInput.symbol, toolInput.limit, userId);
      case 'get_alerts':
        return await this.getAlerts(toolInput.symbol, toolInput.priority, toolInput.status, userId);
      case 'get_watchlist':
        return await this.getWatchlist(toolInput.watchlist_name, userId);
      case 'analyze_ticker_health':
        return await this.analyzeTickerHealth(toolInput.symbol, userId);
      case 'compare_tickers':
        return await this.compareTickers(toolInput.symbols, userId);
      case 'execute_custom_query':
        return await this.executeCustomQuery(toolInput.query, toolInput.explanation, userId);
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  }
}