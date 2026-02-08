
import { supabase } from '../../../shared/infra/libs/supabase.js';
import redisCacheService, {
  CACHE_KEYS,
  CACHE_TTL,
} from '../../../shared/infra/services/cache.service.js';
import { logger } from '../../../config/logger.js';

/**
 * Market Data Service
 * Handles retrieval and caching of market data
 */
class MarketDataService {
  private static instance: MarketDataService;

  private constructor() {}

  static getInstance(): MarketDataService {
    if (!MarketDataService.instance) {
      MarketDataService.instance = new MarketDataService();
    }
    return MarketDataService.instance;
  }

  /**
   * Get volume profile for a ticker
   * Shows historical volume patterns and current levels
   */
  async getVolumeProfile(ticker: string): Promise<any> {
    try {
      const cacheKey = CACHE_KEYS.VOLUME_STATS(ticker);

      return await redisCacheService.getOrFetch(
        cacheKey,
        async () => {
          // Get ticker ID
          const { data: tickerData, error: tickerError } = await supabase
            .from('tickers')
            .select('id')
            .eq('symbol', ticker.toUpperCase())
            .single();

          if (tickerError || !tickerData) {
            throw new Error(`Ticker ${ticker} not found`);
          }

          // Get 30-day volume data
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

          const { data: marketData } = await supabase
            .from('market_data')
            .select('time, volume, price')
            .eq('ticker_id', tickerData.id)
            .gte('time', thirtyDaysAgo.toISOString())
            .order('time', { ascending: false })
            .limit(30);

          if (!marketData || marketData.length === 0) {
            return {
              ticker,
              avgVolume: 0,
              maxVolume: 0,
              minVolume: 0,
              volumePercentiles: {},
              volumeHistogram: [],
            };
          }

          // Calculate volume statistics
          const volumes = marketData.map((d) => (d.volume ?? 0) as number);
          const avgVolume = volumes.length > 0 ? volumes.reduce((a, b) => a + b, 0) / volumes.length : 0;
          const maxVolume = volumes.length > 0 ? Math.max(...volumes) : 0;
          const minVolume = volumes.length > 0 ? Math.min(...volumes) : 0;

          // Calculate percentiles
          const sorted = [...volumes].sort((a, b) => a - b);
          const volumePercentiles = {
            p10: sorted[Math.floor(sorted.length * 0.1)],
            p25: sorted[Math.floor(sorted.length * 0.25)],
            p50: sorted[Math.floor(sorted.length * 0.5)],
            p75: sorted[Math.floor(sorted.length * 0.75)],
            p90: sorted[Math.floor(sorted.length * 0.9)],
          };

          // Create volume histogram
          const buckets = 10;
          const bucketSize = buckets > 0 ? (maxVolume - minVolume) / buckets : 1;
          const histogram = Array(buckets).fill(0);

          for (const vol of volumes) {
            const bucketIdx = bucketSize > 0 ? Math.floor((vol - minVolume) / bucketSize) : 0;
            histogram[Math.min(Math.max(bucketIdx, 0), buckets - 1)]++;
          }

          return {
            ticker,
            avgVolume: Math.round(avgVolume),
            maxVolume,
            minVolume,
            volumePercentiles,
            volumeHistogram: histogram,
            dataPoints: volumes.length,
          };
        },
        CACHE_TTL.VOLUME_STATS
      );
    } catch (error) {
      logger.error({ msg: 'Error getting volume profile', error, ticker });
      throw error;
    }
  }

  /**
   * Get current volume spike for a ticker
   */
  async getCurrentSpike(ticker: string): Promise<any | null> {
    try {
      const cacheKey = CACHE_KEYS.VOLUME_SPIKE(ticker);

      // Check cache first
      const cached = await redisCacheService.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Get latest spike
      const { data: spike } = await supabase
        .from('volume_spikes')
        .select(
          `
          *,
          tickers (symbol, company_name)
        `
        )
        .eq('ticker', ticker.toUpperCase())
        .eq('status', 'active')
        .order('detected_at', { ascending: false })
        .limit(1)
        .single();

      if (spike) {
        // Cache for short period
        await redisCacheService.set(cacheKey, spike, CACHE_TTL.VOLUME_SPIKES);
      }

      return spike || null;
    } catch (error) {
      logger.error({ msg: 'Error getting current spike', error, ticker });
      return null;
    }
  }

  /**
   * Get recent spikes across watchlist
   */
  async getRecentSpikes(limit: number = 20): Promise<any[]> {
    try {
      const { data } = await supabase
        .from('volume_spikes')
        .select(
          `
          *,
          tickers (symbol, company_name, sector)
        `
        )
        .eq('status', 'active')
        .order('detected_at', { ascending: false })
        .limit(limit);

      return data || [];
    } catch (error) {
      logger.error({ msg: 'Error getting recent spikes', error });
      return [];
    }
  }

  /**
   * Get market data for multiple tickers
   */
  async getMultiTickerMarketData(
    tickers: string[],
    days: number = 1
  ): Promise<Map<string, any>> {
    try {
      const result = new Map<string, any>();

      // Get ticker IDs
      const { data: tickerRecords } = await supabase
        .from('tickers')
        .select('id, symbol')
        .in('symbol', tickers.map((t) => t.toUpperCase()));

      const tickerMap = new Map((tickerRecords || []).map((t: any) => [t.symbol, t.id]));

      // Fetch market data for each ticker
      for (const ticker of tickers) {
        const tickerId = tickerMap.get(ticker.toUpperCase());
        if (!tickerId) continue;

        const { data: marketData } = await supabase
          .from('market_data')
          .select('time, open, high, low, close, volume, price')
          .eq('ticker_id', tickerId)
          .gte(
            'time',
            new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
          )
          .order('time', { ascending: false })
          .limit(days);

        result.set(ticker, marketData || []);
      }

      return result;
    } catch (error) {
      logger.error({ msg: 'Error getting multi-ticker market data', error });
      return new Map();
    }
  }

  /**
   * Calculate price statistics
   */
  async getPriceStats(ticker: string): Promise<any> {
    try {
      const cacheKey = CACHE_KEYS.PRICE_STATS(ticker);
      return await redisCacheService.getOrFetch(
        cacheKey,
        async () => {
          const { data: tickerData } = await supabase
            .from('tickers')
            .select('id')
            .eq('symbol', ticker.toUpperCase())
            .single();

          if (!tickerData) {
            throw new Error(`Ticker ${ticker} not found`);
          }

          const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

          const { data: marketData } = await supabase
            .from('market_data')
            .select('time, close, high, low')
            .eq('ticker_id', tickerData.id)
            .gte('time', ninetyDaysAgo.toISOString())
            .order('time', { ascending: false });

          if (!marketData || marketData.length === 0) {
            return {
              ticker,
              current: 0,
              high52w: 0,
              low52w: 0,
              avg: 0,
              volatility: 0,
              percentageChange: 0,
            };
          }

          const closes = marketData.map((d) => (d.close ?? 0) as number);
          const current = closes[0] !== undefined ? closes[0] : 0;
          const high = closes.length > 0 ? Math.max(...closes) : 0;
          const low = closes.length > 0 ? Math.min(...closes) : 0;
          const avg = closes.length > 0 ? closes.reduce((a, b) => a + b, 0) / closes.length : 0;

          const variance = closes.length > 0 ? closes.reduce((sum, price) => sum + Math.pow(price - avg, 2), 0) / closes.length : 0;
          const volatility = Math.sqrt(variance);

          const percentageChange = avg !== 0 ? Math.round(((current - avg) / avg) * 10000) / 100 : 0;

          return {
            ticker,
            current,
            high52w: high,
            low52w: low,
            avg: Math.round(avg * 100) / 100,
            volatility: Math.round(volatility * 100) / 100,
            percentageChange,
          };
        },
        CACHE_TTL.PRICE_STATS
      );
    } catch (error) {
      logger.error({ msg: 'Error getting price stats', error, ticker });
      throw error;
    }
  }

  /**
   * Get latest price for ticker
   */
  async getLatestPrice(ticker: string): Promise<any | null> {
    try {
      const cacheKey = CACHE_KEYS.MARKET_DATA(ticker);

      // Try cache first
      const cached = await redisCacheService.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Get from database
      const { data: tickerData } = await supabase
        .from('tickers')
        .select('id')
        .eq('symbol', ticker.toUpperCase())
        .single();

      if (!tickerData) return null;

      const { data: latest } = await supabase
        .from('market_data')
        .select('time, price, close, volume')
        .eq('ticker_id', tickerData.id)
        .order('time', { ascending: false })
        .limit(1)
        .single();

      if (latest) {
        await redisCacheService.set(
          cacheKey,
          latest,
          CACHE_TTL.LATEST_PRICE
        );
      }

      return latest || null;
    } catch (error) {
      logger.error({ msg: 'Error getting latest price', error, ticker });
      return null;
    }
  }
}

const marketDataService = MarketDataService.getInstance();
export default marketDataService;
