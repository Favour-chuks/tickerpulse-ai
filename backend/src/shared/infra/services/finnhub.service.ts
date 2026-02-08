import axios, { type AxiosInstance } from 'axios';
import { logger } from '../../../config/logger.js';
import { envConfig } from '../../../config/environmentalVariables.js';

/**
 * Finnhub API Response Interfaces
 */
export interface FinnhubQuote {
  c: number; // current price
  h: number; // high
  l: number; // low
  o: number; // open
  pc: number; // previous close
  t: number; // timestamp
  v?: number; // volume (optional in free tier)
}

export interface FinnhubNewsArticle {
  id: number;
  headline: string;
  source: string;
  url: string;
  image: string;
  summary: string;
  category: string;
  datetime: number;
  related: string;
  sentiment?: number;
  sentiment_label?: string;
}

export interface CompanyNewsParams {
  symbol: string;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  limit?: number;
}

export interface CompanyNewsResponse {
  data: FinnhubNewsArticle[];
  total?: number;
}

/**
 * FinnhubClient
 * Wrapper around Axios that provides methods for
 * fetching financial data including news and market quotes from Finnhub API.
 *
 * Usage:
 * const client = new FinnhubClient();
 * const quote = await client.getQuote('AAPL');
 * const news = await client.getCompanyNews({ symbol: 'AAPL', from: '2025-01-01', to: '2025-12-31' });
 */
export class FinnhubClient {
  private client: AxiosInstance;
  private apiKey: string;
  private baseURL: string = 'https://finnhub.io/api/v1';

  private lastRequestTime: number = 0;
  private readonly MIN_DELAY = 2100; // 2.1 seconds to be safe (30 calls/min)
  private requestQueue: Promise<any> = Promise.resolve();

  constructor() {
    const apiKey = envConfig.finnhub_api_key || process.env.FINNHUB_API_KEY;

    if (!apiKey) {
      throw new Error('Finnhub API key is required. Set FINNHUB_API_KEY environment variable.');
    }

    this.apiKey = apiKey;

    // Initialize Axios client
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      params: {
        token: this.apiKey,
      },
    });
  }

  private throttle<T>(requestFn: () => Promise<T>): Promise<T> {
    // Chain requests so they execute one-after-another (Concurrency = 1)
    // and ensure MIN_DELAY between the end of one request and the start of the next.
    this.requestQueue = this.requestQueue.then(async () => {
      const now = Date.now();
      const timeSinceLast = now - this.lastRequestTime;

      if (timeSinceLast < this.MIN_DELAY) {
        await new Promise((resolve) => setTimeout(resolve, this.MIN_DELAY - timeSinceLast));
      }

      // Execute the request and return its result so it becomes the next queue value
      const result = await requestFn();
      this.lastRequestTime = Date.now();
      return result as any;
    });

    return this.requestQueue as Promise<T>;
  }

  /**
   * Get real-time stock quote for a symbol
   * @param symbol Stock ticker symbol (e.g., 'AAPL')
   * @returns Quote data with price, high, low, open, previous close, timestamp, and volume
   */
  async getQuote(symbol: string): Promise<FinnhubQuote | null> {
    try {
      logger.debug({
        msg: 'Fetching quote from Finnhub',
        symbol,
      });

      const response = await this.throttle(async () => this.client.get('/quote', {
        params: {
          symbol,
        },
      }));

      const quote = response.data as FinnhubQuote;

      // Validate quote data
      if (quote && quote.c !== undefined) {
        logger.debug({
          msg: 'Quote fetched successfully',
          symbol,
          price: quote.c,
        });
        return quote;
      }

      logger.warn({
        msg: 'Invalid quote response from Finnhub',
        symbol,
        response: quote,
      });
      return null;
    } catch (error) {
      logger.error({
        msg: 'Error fetching quote from Finnhub',
        symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to fetch quote for ${symbol}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get company news for a symbol within a date range
   * @param params Object containing symbol, from date, to date, and optional limit
   * @returns Array of news articles
   */
  async getCompanyNews(params: CompanyNewsParams): Promise<FinnhubNewsArticle[]> {
    try {
      const { symbol, from, to, limit = 50 } = params;

      logger.debug({
        msg: 'Fetching company news from Finnhub',
        symbol,
        from,
        to,
        limit,
      });

      const response = await this.throttle(() => this.client.get('/company-news', {
        params: {
          symbol,
          from,
          to,
          limit,
        },
      }));

      const newsData: FinnhubNewsArticle[] = Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];

      logger.debug({
        msg: 'Company news fetched successfully',
        symbol,
        count: newsData.length,
      });

      return newsData;
    } catch (error) {
      logger.error({
        msg: 'Error fetching company news from Finnhub',
        symbol: params.symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to fetch news for ${params.symbol}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get news for a symbol without date range (latest news)
   * @param symbol Stock ticker symbol
   * @param limit Maximum number of news items to return
   * @returns Array of news articles
   */
  async getLatestNews(symbol: string, limit: number = 20): Promise<FinnhubNewsArticle[]> {
    try {
      logger.debug({
        msg: 'Fetching latest news from Finnhub',
        symbol,
        limit,
      });

      const response = await this.throttle(() => this.client.get('/company-news', {
        params: {
          symbol,
          limit,
        },
      }));

      const newsData: FinnhubNewsArticle[] = Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];

      logger.debug({
        msg: 'Latest news fetched successfully',
        symbol,
        count: newsData.length,
      });

      return newsData;
    } catch (error) {
      logger.error({
        msg: 'Error fetching latest news from Finnhub',
        symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to fetch latest news for ${symbol}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get multiple quotes for multiple symbols in batch
   * @param symbols Array of stock ticker symbols
   * @returns Map of symbol to quote data
   */
  async getQuotesBatch(symbols: string[]): Promise<Map<string, FinnhubQuote | null>> {
    const quotes = new Map<string, FinnhubQuote | null>();

    try {
      logger.debug({
        msg: 'Fetching quotes in batch from Finnhub',
        symbolCount: symbols.length,
      });

      for (const symbol of symbols) {
        try {
          const quote = await this.getQuote(symbol);
          quotes.set(symbol, quote);
        } catch (error) {
          logger.warn({
            msg: 'Failed to fetch quote for symbol in batch',
            symbol,
            error: error instanceof Error ? error.message : String(error),
          });
          quotes.set(symbol, null);
        }
      }

      logger.debug({
        msg: 'Batch quote fetch completed',
        successCount: Array.from(quotes.values()).filter((q) => q !== null).length,
        totalCount: symbols.length,
      });

      return quotes;
    } catch (error) {
      logger.error({
        msg: 'Error in batch quote fetch',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get multiple news articles for multiple symbols in batch
   * @param symbols Array of stock ticker symbols
   * @param daysBack Number of days to look back for news
   * @returns Map of symbol to news articles array
   */
  async getNewsBatch(
    symbols: string[],
    daysBack: number = 3
  ): Promise<Map<string, FinnhubNewsArticle[]>> {
    const allNews = new Map<string, FinnhubNewsArticle[]>();

    try {
      logger.debug({
        msg: 'Fetching news in batch from Finnhub',
        symbolCount: symbols.length,
        daysBack,
      });

      const now = new Date();
      const fromDate = new Date();
      fromDate.setDate(now.getDate() - daysBack);

      let toDateStr: string = now.toISOString().split('T')[0]!;
      let fromDateStr: string = fromDate.toISOString().split('T')[0]!;

      for (const symbol of symbols) {
        try {
          const news = await this.getCompanyNews({
            symbol,
            from: fromDateStr,
            to: toDateStr,
            limit: 20,
          });
          allNews.set(symbol, news);
        } catch (error) {
          logger.warn({
            msg: 'Failed to fetch news for symbol in batch',
            symbol,
            error: error instanceof Error ? error.message : String(error),
          });
          allNews.set(symbol, []);
        }
      }

      logger.debug({
        msg: 'Batch news fetch completed',
        symbolsProcessed: symbols.length,
        totalNewsItems: Array.from(allNews.values()).reduce((sum, news) => sum + news.length, 0),
      });

      return allNews;
    } catch (error) {
      logger.error({
        msg: 'Error in batch news fetch',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

// Export singleton instance
export const finnhubClient = new FinnhubClient();
