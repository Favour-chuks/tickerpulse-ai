import { Type, type Tool } from '@google/genai';

export const tools: Tool = {
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