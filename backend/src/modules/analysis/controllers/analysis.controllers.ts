
import type { FastifyReply, FastifyRequest } from 'fastify';
import { GoogleGenAI, Type, type Tool } from '@google/genai';
import { supabase } from '../../../shared/infra/libs/supabase.js';
import { envConfig } from '../../../config/environmentalVariables.js';
import { logger } from '../../../config/logger.js';

// TODO: convert all these to a class component
// Initialize clients
const genAI = new GoogleGenAI({apiKey: envConfig.gemini_api_key});
// ============================================================================
// TOOL DEFINITIONS FOR AI (Gemini Format)
// ============================================================================

const tools: Tool= {
  functionDeclarations: [
    {
      name: 'search_tickers',
      description: 'Search for stock tickers by symbol or company name. Returns basic ticker information.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          search_term: {
            type: Type.STRING,
            description: 'Symbol (e.g., AAPL) or company name to search for',
          },
          limit: {
            type: Type.NUMBER,
            description: 'Maximum number of results to return (default: 10)',
          },
        },
        required: ['search_term'],
      },
    },
    {
      name: 'get_ticker_details',
      description: 'Get detailed information about a specific ticker including current price, volume, and technical indicators.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          symbol: {
            type: Type.STRING,
            description: 'Stock ticker symbol (e.g., AAPL, TSLA)',
          },
        },
        required: ['symbol'],
      },
    },
    {
      name: 'get_market_data',
      description: 'Get historical market data (price, volume, OHLC) for a ticker over a time period.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          symbol: {
            type: Type.STRING,
            description: 'Stock ticker symbol',
          },
          days: {
            type: Type.NUMBER,
            description: 'Number of days of historical data to retrieve (default: 30)',
          },
          interval: {
            type: Type.STRING,
            description: 'Data interval: daily, hourly (default: daily)',
          },
        },
        required: ['symbol'],
      },
    },
    {
      name: 'get_volume_spikes',
      description: 'Get recent volume spikes/anomalies for a ticker or across all tickers. Includes divergence analysis.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          symbol: {
            type: Type.STRING,
            description: 'Optional: specific ticker symbol to filter by',
          },
          days: {
            type: Type.NUMBER,
            description: 'Look back this many days (default: 7)',
          },
          movement_type: {
            type: Type.STRING,
            description: 'Filter by type: SPIKE, BEARISH_DRY_UP, BULLISH_DRY_UP, MODERATE_ANOMALY',
          },
          min_deviation: {
            type: Type.NUMBER,
            description: 'Minimum deviation multiple (e.g., 3.0 for 3x normal volume)',
          },
        },
      },
    },
    {
      name: 'get_sentiment_analysis',
      description: 'Get sentiment data from social mentions, news, and SEC filings for a ticker.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          symbol: {
            type: Type.STRING,
            description: 'Stock ticker symbol',
          },
          source: {
            type: Type.STRING,
            description: 'Filter by source: sec_filing, news, reddit, twitter, or all',
          },
          days: {
            type: Type.NUMBER,
            description: 'Look back this many days (default: 30)',
          },
        },
        required: ['symbol'],
      },
    },
    {
      name: 'check_sentiment_divergence',
      description: 'Check for divergence between SEC filing language (uncertainty) and social sentiment for a ticker.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          symbol: {
            type: Type.STRING,
            description: 'Stock ticker symbol',
          },
        },
        required: ['symbol'],
      },
    },
    {
      name: 'get_sec_filings',
      description: 'Get SEC filings (10-K, 10-Q, 8-K, etc.) for a ticker.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          symbol: {
            type: Type.STRING,
            description: 'Stock ticker symbol',
          },
          filing_type: {
            type: Type.STRING,
            description: 'Filter by filing type: 10-K, 10-Q, 8-K, or all',
          },
          limit: {
            type: Type.NUMBER,
            description: 'Maximum number of filings to return (default: 10)',
          },
        },
        required: ['symbol'],
      },
    },
    {
      name: 'get_company_narratives',
      description: 'Get AI-extracted narratives and insights from SEC filings including tone shifts, guidance, and management confidence.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          symbol: {
            type: Type.STRING,
            description: 'Stock ticker symbol',
          },
          limit: {
            type: Type.NUMBER,
            description: 'Maximum number of narratives to return (default: 5)',
          },
        },
        required: ['symbol'],
      },
    },
    {
      name: 'get_alerts',
      description: 'Get active alerts for a user or specific ticker. Shows volume spikes, divergences, and other anomalies.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          symbol: {
            type: Type.STRING,
            description: 'Optional: filter by ticker symbol',
          },
          priority: {
            type: Type.STRING,
            description: 'Filter by priority: low, medium, high, critical',
          },
          status: {
            type: Type.STRING,
            description: 'Filter by status: active, dismissed, resolved (default: active)',
          },
        },
      },
    },
    {
      name: 'get_watchlist',
      description: 'Get user watchlists and the tickers in them.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          watchlist_name: {
            type: Type.STRING,
            description: 'Optional: specific watchlist name',
          },
        },
      },
    },
    {
      name: 'analyze_ticker_health',
      description: 'Comprehensive health check for a ticker: technical indicators, volume trends, sentiment, recent filings, and alerts.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          symbol: {
            type: Type.STRING,
            description: 'Stock ticker symbol to analyze',
          },
        },
        required: ['symbol'],
      },
    },
    {
      name: 'compare_tickers',
      description: 'Compare multiple tickers side-by-side on metrics like price, volume, sentiment, and technical indicators.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          symbols: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Array of ticker symbols to compare (2-5 tickers)',
          },
        },
        required: ['symbols'],
      },
    },
    {
      name: 'execute_custom_query',
      description: 'Execute a custom SQL query for advanced analysis. USE ONLY when other tools cannot answer the question.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: {
            type: Type.STRING,
            description: 'SQL SELECT query to execute',
          },
          explanation: {
            type: Type.STRING,
            description: 'Explain what you are querying and why',
          },
        },
        required: ['query', 'explanation'],
      },
    },
  ],
};

// ============================================================================
// TOOL EXECUTION FUNCTIONS (Unchanged)
// ============================================================================

async function searchTickers(searchTerm: string, limit: number = 10, userId?: string) {
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

async function getTickerDetails(symbol: string, userId?: string) {
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

async function getMarketData(
  symbol: string,
  days: number = 30,
  interval: string = 'daily',
  userId?: string
) {
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

async function getVolumeSpikes(
  symbol?: string,
  days: number = 7,
  movementType?: string,
  minDeviation?: number,
  userId?: string
) {
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

async function getSentimentAnalysis(
  symbol: string,
  source: string = 'all',
  days: number = 30,
  userId?: string
) {
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

async function checkSentimentDivergence(symbol: string, userId?: string) {
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

async function getSECFilings(
  symbol: string,
  filingType?: string,
  limit: number = 10,
  userId?: string
) {
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

async function getCompanyNarratives(symbol: string, limit: number = 5, userId?: string) {
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

async function getAlerts(
  symbol?: string,
  priority?: string,
  status: string = 'active',
  userId?: string
) {
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

async function getWatchlist(watchlistName?: string, userId?: string) {
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

async function analyzeTickerHealth(symbol: string, userId?: string) {
  try {
    const tickerDetails = await getTickerDetails(symbol, userId);
    const marketData = await getMarketData(symbol, 30, 'daily', userId);
    const volumeSpikes = await getVolumeSpikes(symbol, 7, undefined, undefined, userId);
    const sentiment = await getSentimentAnalysis(symbol, 'all', 30, userId);
    const divergence = await checkSentimentDivergence(symbol, userId);
    const filings = await getSECFilings(symbol, undefined, 5, userId);
    const narratives = await getCompanyNarratives(symbol, 3, userId);

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

async function compareTickers(symbols: string[], userId?: string) {
  try {
    if (symbols.length < 2 || symbols.length > 5) {
      return { success: false, error: 'Please provide 2-5 tickers to compare' };
    }

    const comparisons = await Promise.all(
      symbols.map(async (symbol) => {
        const details = await getTickerDetails(symbol, userId);
        const sentiment = await getSentimentAnalysis(symbol, 'all', 7, userId);
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

async function executeCustomQuery(query: string, explanation: string, userId?: string) {
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

// ============================================================================
// TOOL ROUTER
// ============================================================================

async function executeTool(toolName: string, toolInput: any, userId?: string): Promise<any> {
  logger.info(`Executing tool: ${toolName}`);
  
  switch (toolName) {
    case 'search_tickers':
      return await searchTickers(toolInput.search_term, toolInput.limit, userId);
    case 'get_ticker_details':
      return await getTickerDetails(toolInput.symbol, userId);
    case 'get_market_data':
      return await getMarketData(toolInput.symbol, toolInput.days, toolInput.interval, userId);
    case 'get_volume_spikes':
      return await getVolumeSpikes(
        toolInput.symbol,
        toolInput.days,
        toolInput.movement_type,
        toolInput.min_deviation,
        userId
      );
    case 'get_sentiment_analysis':
      return await getSentimentAnalysis(toolInput.symbol, toolInput.source, toolInput.days, userId);
    case 'check_sentiment_divergence':
      return await checkSentimentDivergence(toolInput.symbol, userId);
    case 'get_sec_filings':
      return await getSECFilings(toolInput.symbol, toolInput.filing_type, toolInput.limit, userId);
    case 'get_company_narratives':
      return await getCompanyNarratives(toolInput.symbol, toolInput.limit, userId);
    case 'get_alerts':
      return await getAlerts(toolInput.symbol, toolInput.priority, toolInput.status, userId);
    case 'get_watchlist':
      return await getWatchlist(toolInput.watchlist_name, userId);
    case 'analyze_ticker_health':
      return await analyzeTickerHealth(toolInput.symbol, userId);
    case 'compare_tickers':
      return await compareTickers(toolInput.symbols, userId);
    case 'execute_custom_query':
      return await executeCustomQuery(toolInput.query, toolInput.explanation, userId);
    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface Message {
  role: 'user' | 'model';
  parts: Array<{ text?: string; functionCall?: any; functionResponse?: any }>;
}

interface AnalysisRequest {
  message: string;
  conversation_history?: Message[];
  user_id?: string;
}

interface AnalysisResponse {
  response: string;
  conversation_history: Message[];
  tool_calls?: Array<{
    tool: string;
    input: any;
    result: any;
  }>;
}

// ============================================================================
// MAIN ANALYSIS ENDPOINT
// ============================================================================

  async (request: FastifyRequest<{ Body: AnalysisRequest }>, reply: FastifyReply) => {
  const { message, conversation_history = [],} = request.body;
      const userId = request.user?.id;

  if (!message) {
    return reply.code(400).send({ error: 'Message is required' });
  }

  try {
    const systemPrompt = `You are a financial analysis AI assistant with access to a comprehensive market database.

Your capabilities:
- Query stock tickers, market data, and technical indicators
- Analyze volume spikes and anomalies
- Review sentiment from social media, news, and SEC filings
- Detect divergence between official filings and social sentiment
- Examine SEC filings and company narratives
- Compare multiple stocks
- Provide comprehensive ticker health analysis

When analyzing data:
1. Use multiple tools to gather comprehensive information
2. Look for patterns, anomalies, and correlations
3. Provide context with technical indicators (MA20, MA50, MA200)
4. Highlight sentiment divergences and volume spikes
5. Reference recent SEC filings when relevant
6. Be specific with numbers and dates
7. Explain what the data means for investors

Available data sources:
- Real-time market data (price, volume, OHLC)
- Technical indicators (moving averages, volume stats)
- Volume spike detection with divergence analysis
- Social sentiment (Reddit, Twitter, news)
- SEC filings (10-K, 10-Q, 8-K)
- Company narratives extracted from filings
- User watchlists and alerts

Be professional, data-driven, and actionable in your analysis.`;

      const chat = genAI.chats.create({
        model: 'gemini-2.0-flash-exp',
        config: {
          tools: [tools],
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
        }
      })

    const toolCalls: Array<{ tool: string; input: any; result: any }> = [];
    let responseText = '';
    let currentMessage = message;
    let continueLoop = true;

    while (continueLoop) {
      const response = await chat.sendMessage({message: currentMessage});

      // Check for function calls
      const functionCalls = response.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        // Execute all function calls
        const functionResponses = await Promise.all(
          functionCalls.map(async (call:any) => {
            logger.info(`Tool: ${call.name}, Input: ${JSON.stringify(call.args)}`);

            const toolResult = await executeTool(call.name, call.args, userId);

            toolCalls.push({
              tool: call.name,
              input: call.args,
              result: toolResult,
            });

            return {
              functionResponse: {
                name: call.name,
                response: toolResult,
              },
            };
          })
        );

        // Send function responses back
        currentMessage = {
          parts: functionResponses,
        } as any;
      } else {
        // No more function calls, extract text response
        responseText =  response.text || '';
        continueLoop = false;
      }
    }

    // Build conversation history in Gemini format
    const finalHistory: Message[] = [
      {
        role: 'user',
        parts: [{ text: message }],
      },
      {
        role: 'model',
        parts: [{ text: responseText }],
      },
    ];

    const analysisResponse: AnalysisResponse = {
      response: responseText,
      conversation_history: finalHistory,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    };

    return reply.send(analysisResponse);
  } catch (error: any) {
    logger.error(error);
    return reply.code(500).send({
      error: 'Analysis failed',
      details: error.message,
    });
  }
}


// TODO: reduce this controller to this single class class
// import type { FastifyReply, FastifyRequest } from 'fastify';
// import { logger } from '../../../config/logger.js';
import { NewGeminiService } from '../services/gemini.service.js';
import type { AnalysisRequest as newAnalysisRequest } from '../types/analysis.type.js';

export class AnalysisController {
  private geminiService: NewGeminiService;

  constructor() {
    this.geminiService = new NewGeminiService();
  }

  async analyze(
    request: FastifyRequest<{ Body: newAnalysisRequest }>,
    reply: FastifyReply
  ) {
    const { message, conversation_history = [] } = request.body;
    const userId = request.user?.id;

    if (!message) {
      return reply.code(400).send({ error: 'Message is required' });
    }

    try {
      const analysisResponse = await this.geminiService.analyzeMessage(
        message,
        conversation_history,
        userId
      );

      return reply.send(analysisResponse);
    } catch (error: any) {
      logger.error('Analysis controller error:', error);
      return reply.code(500).send({
        error: 'Analysis failed',
        details: error.message,
      });
    }
  }
}