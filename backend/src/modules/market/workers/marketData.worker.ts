import type { Job } from 'bull';
import { finnhubClient } from '../../../shared/infra/services/finnhub.service.js';
import { logger } from '../../../config/logger.js';
import { supabase } from '../../../shared/infra/libs/supabase.js';
import redisCacheService, {
  CACHE_KEYS,
  CACHE_TTL,
} from '../../../shared/infra/services/cache.service.js';

interface MarketDataJob {
  tickers: string[];
}

interface FinnhubQuote {
  c: number; // current price
  h: number; // high
  l: number; // low
  o: number; // open
  pc: number; // previous close
  t: number; // timestamp
  v?: number; // volume (optional in free tier)
}

/**
 * Market Data Ingestion Worker
 * Fetches real-time market data every 5 minutes from Finnhub
 * Stores in database and Redis cache for quick access
 */
export async function processMarketDataJob(job: Job<MarketDataJob>): Promise<void> {
  try {
    const { tickers } = job.data;
    logger.info({ msg: 'Processing market data job', tickers: tickers.length });

    // Fetch market data for all tickers
    const marketDataMap = new Map<
      string,
      FinnhubQuote & { symbol: string }
    >();

    for (const ticker of tickers) {
      try {
        const quote = await fetchQuoteFromFinnhub(ticker);
        if (quote) {
          marketDataMap.set(ticker, { ...quote, symbol: ticker });
        }
      } catch (error) {
        logger.error({
          msg: 'Error fetching quote for ticker',
          error,
          ticker,
        });
        // Continue with other tickers
      }
    }

    // Store in database
    await storeMarketDataInDatabase(Array.from(marketDataMap.values()));

    // Cache frequently accessed data
    await cacheMarketData(marketDataMap);

    logger.info({
      msg: 'Market data ingestion complete',
      tickersProcessed: marketDataMap.size,
    });

    return;
  } catch (error) {
    logger.error({ msg: 'Error in market data job', error });
    throw error;
  }
}

/**
 * Fetch quote from Finnhub API
 */
async function fetchQuoteFromFinnhub(ticker: string): Promise<FinnhubQuote | null> {
  try {
    const quote = await finnhubClient.getQuote(ticker);
    return quote;
  } catch (error) {
    logger.error({
      msg: 'Finnhub API error',
      error: error instanceof Error ? error.message : String(error),
      ticker,
    });
    return null;
  }
}

/**
 * Store market data in Supabase
 */
async function storeMarketDataInDatabase(
  quotes: (FinnhubQuote & { symbol: string })[]
): Promise<void> {
  try {
    const now = new Date();

    const marketDataRecords = quotes.map((quote) => ({
      time: now.toISOString(),
      ticker: quote.symbol,
      price: quote.c,
      volume: quote.v || 0,
      open: quote.o,
      high: quote.h,
      low: quote.l,
      close: quote.c,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }));

    // Get ticker IDs
    const tickerSymbols = quotes.map((q) => q.symbol);
    const { data: tickers, error: tickerError } = await supabase
      .from('tickers')
      .select('id, symbol')
      .in('symbol', tickerSymbols);

    if (tickerError) throw tickerError;

    // Map symbol to ticker ID
      const tickerMap = new Map((tickers || []).map((t: any) => [t.symbol, t.id]));

    // Insert market data with ticker IDs
    const dataToInsert = marketDataRecords.map((record) => ({
      ...record,
      ticker_id: tickerMap.get(record.ticker),
    }));

    const { error } = await supabase.from('market_data').insert(dataToInsert);

    if (error) {
      logger.error({ msg: 'Error storing market data', error });
      return;
    }

    logger.info({
      msg: 'Market data stored',
      recordsCount: dataToInsert.length,
    });
  } catch (error) {
    logger.error({ msg: 'Error storing market data', error });
  }
}

/**
 * Cache market data in Redis
 */
async function cacheMarketData(
  marketDataMap: Map<string, FinnhubQuote & { symbol: string }>
): Promise<void> {
  try {
    const cacheData = new Map<
      string,
      { value: any; ttl: number }
    >();

    for (const [ticker, quote] of marketDataMap) {
      const cacheKey = CACHE_KEYS.MARKET_DATA(ticker);
      cacheData.set(cacheKey, {
        value: {
          symbol: ticker,
          price: quote.c,
          high: quote.h,
          low: quote.l,
          open: quote.o,
          close: quote.c,
          timestamp: new Date(quote.t * 1000),
        },
        ttl: CACHE_TTL.LATEST_PRICE,
      });
    }

    await redisCacheService.mset(cacheData);
  } catch (error) {
    logger.error({ msg: 'Error caching market data', error });
  }
}

export { processMarketDataJob as marketDataWorker };
