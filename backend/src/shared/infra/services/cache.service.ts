import redisService from '../../../config/redis.js';
import { logger } from '../../../config/logger.js';
import { supabase } from '../libs/supabase.js';

/**
 * TTL Configurations for different data types
 * Long TTL: Data that doesn't change frequently
 * Medium TTL: Data that changes occasionally
 * Short TTL: Real-time or frequently changing data
 */
export const CACHE_TTL = {
  // Long TTL (24 hours) - Company metadata
  TICKER_METADATA: 24 * 60 * 60, // 86400
  COMPANY_INFO: 24 * 60 * 60,
  SECTOR_DATA: 24 * 60 * 60,

  // Medium TTL (1 hour) - Derived calculations
  MARKET_PROFILE: 60 * 60,
  VOLUME_STATS: 60 * 60,
  PRICE_STATS: 60 * 60,
  NARRATIVE_SUMMARY: 60 * 60,
  ALERT_STATISTICS: 60 * 60,

  // Short TTL (5-15 minutes) - Real-time data
  LATEST_PRICE: 5 * 60,
  LATEST_NEWS: 10 * 60,
  VOLUME_SPIKES: 5 * 60,
  CURRENT_ALERTS: 5 * 60,
  ACTIVE_DIVERGENCES: 5 * 60,

  // Very Short TTL (1 minute) - Highly volatile
  REAL_TIME_MARKET_DATA: 1 * 60,
  ACTIVE_TRADES: 1 * 60,
  // SEC filings cache (daily)
  SEC_FILINGS: 24 * 60 * 60,
};

/**
 * Cache key prefixes for organization
 */
export const CACHE_KEYS = {
  TICKER: (symbol: string) => `ticker:${symbol.toUpperCase()}`,
  MARKET_DATA: (symbol: string) => `market:${symbol.toUpperCase()}`,
  VOLUME_SPIKE: (symbol: string) => `spike:${symbol.toUpperCase()}`,
  NARRATIVE: (symbol: string) => `narrative:${symbol.toUpperCase()}`,
  CONTRADICTIONS: (symbol: string) => `contradictions:${symbol.toUpperCase()}`,
  PROMISES: (symbol: string) => `promises:${symbol.toUpperCase()}`,
  SENTIMENT: (symbol: string) => `sentiment:${symbol.toUpperCase()}`,
  ALERT: (alertId: number) => `alert:${alertId}`,
  USER_ALERTS: (userId: string) => `user:alerts:${userId}`,
  WATCHLIST: (userId: string) => `watchlist:${userId}`,
  PRICE_STATS: (symbol: string) => `stats:price:${symbol.toUpperCase()}`,
  VOLUME_STATS: (symbol: string) => `stats:volume:${symbol.toUpperCase()}`,
  SEC_FILINGS: (symbol: string) => `filings:${symbol.toUpperCase()}`,
  NEWS_ITEMS: (symbol: string) => `news:${symbol.toUpperCase()}`,
  LATEST_PRICE: (symbol: string) => `price:${symbol.toUpperCase()}`,
  TRENDING: 'trending:tickers',
  SECTOR_LEADERS: (sector: string) => `leaders:${sector}`,
};


class RedisCacheService {
  private static instance: RedisCacheService;

  // Expose underlying redis client for advanced operations when necessary
  get client() {
    return redisService.client;
  }

  private constructor() {}

  static getInstance(): RedisCacheService {
    if (!RedisCacheService.instance) {
      RedisCacheService.instance = new RedisCacheService();
    }
    return RedisCacheService.instance;
  }

  /**
   * Get cached value with automatic serialization handling
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await redisService.client.get(key);
      if (!cached) return null;

      try {
        return JSON.parse(cached) as T;
      } catch {
        return cached as T;
      }
    } catch (error) {
      logger.error({ msg: 'Cache GET error', error, key });
      return null;
    }
  }

  /**
   * Set cached value with TTL
   */
  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    try {
      const serialized =
        typeof value === 'string' ? value : JSON.stringify(value);
      await redisService.client.setex(key, ttl, serialized);
    } catch (error) {
      logger.error({ msg: 'Cache SET error', error, key });
    }
  }

  /**
   * Get with cache-first strategy
   * Try cache first, fallback to fetcher if not found or expired
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    try {
      // Try cache first
      const cached = await this.get<T>(key);
      if (cached !== null) {
        logger.info({ msg: 'Cache HIT', key });
        return cached;
      }

      // Cache miss - fetch data
      logger.info({ msg: 'Cache MISS', key });
      const data = await fetcher();

      // Store in cache
      if (data !== null && data !== undefined) {
        await this.set(key, data, ttl);
      }

      return data;
    } catch (error) {
      logger.error({ msg: 'getOrFetch error', error, key });
      throw error;
    }
  }

  /**
   * Batch get multiple keys
   */
  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    try {
      const values = await redisService.client.mget(...keys);
      const result = new Map<string, T | null>();

      keys.forEach((key, index) => {
        const value = values[index];
        if (value) {
          try {
            result.set(key, JSON.parse(value) as T);
          } catch {
            result.set(key, value as T);
          }
        } else {
          result.set(key, null);
        }
      });

      return result;
    } catch (error) {
      logger.error({ msg: 'Cache MGET error', error });
      throw error;
    }
  }

  /**
   * Batch set multiple keys
   */
  async mset<T>(
    data: Map<string, { value: T; ttl: number }>
  ): Promise<void> {
    try {
      const pipeline = redisService.client.pipeline();

      for (const [key, { value, ttl }] of data.entries()) {
        const serialized =
          typeof value === 'string' ? value : JSON.stringify(value);
        pipeline.setex(key, ttl, serialized);
      }

      await pipeline.exec();
    } catch (error) {
      logger.error({ msg: 'Cache MSET error', error });
    }
  }

  /**
   * Delete cache key(s)
   */
  async delete(keys: string | string[]): Promise<void> {
    try {
      if (typeof keys === 'string') {
        await redisService.client.del(keys);
      } else {
        await redisService.client.del(...keys);
      }
    } catch (error) {
      logger.error({ msg: 'Cache DELETE error', error });
    }
  }

  /**
   * Delete by pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await redisService.client.keys(pattern);
      if (keys.length > 0) {
        await redisService.client.del(...keys);
      }
    } catch (error) {
      logger.error({ msg: 'Cache DELETE PATTERN error', error });
    }
  }

  /**
   * Clear all cache for a ticker
   */
  async invalidateTickerCache(symbol: string): Promise<void> {
    try {
      const pattern = `*:${symbol.toUpperCase()}`;
      await this.deletePattern(pattern);
      logger.info({ msg: 'Ticker cache invalidated', symbol });
    } catch (error) {
      logger.error({ msg: 'Error invalidating ticker cache', error, symbol });
    }
  }

  /**
   * Clear all user-specific cache
   */
  async invalidateUserCache(userId: string): Promise<void> {
    try {
      const pattern = `user:*:${userId}`;
      await this.deletePattern(pattern);
      logger.info({ msg: 'User cache invalidated', userId });
    } catch (error) {
      logger.error({ msg: 'Error invalidating user cache', error, userId });
    }
  }

  /**
   * Increment counter with TTL
   */
  async increment(key: string, ttl?: number): Promise<number> {
    try {
      const value = await redisService.client.incr(key);

      if (ttl && value === 1) {
        await redisService.client.expire(key, ttl);
      }

      return value;
    } catch (error) {
      logger.error({ msg: 'Cache INCREMENT error', error });
      throw error;
    }
  }

  /**
   * Set if not exists (NX) - useful for locks
   */
  async setIfNotExists(key: string, value: string, ttl: number): Promise<boolean> {
    try {
      const result = await redisService.client.set(
        key,
        value,
        'EX',
        ttl,
        'NX'
      );
      return result === 'OK';
    } catch (error) {
      logger.error({ msg: 'Cache SET NX error', error });
      return false;
    }
  }

  /**
   * Get TTL of a key
   */
  async getTTL(key: string): Promise<number> {
    try {
      return await redisService.client.ttl(key);
    } catch (error) {
      logger.error({ msg: 'Cache TTL error', error });
      return -1;
    }
  }

  /**
   * Cache ticker metadata from Supabase
   */
  async cacheTickerMetadata(symbol: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('tickers')
        .select('*')
        .eq('symbol', symbol.toUpperCase())
        .single();

      if (error) throw error;
      if (data) {
        const key = CACHE_KEYS.TICKER(symbol);
        await this.set(key, data, CACHE_TTL.TICKER_METADATA);
      }
    } catch (error) {
      logger.error({ msg: 'Error caching ticker metadata', error, symbol });
    }
  }

  /**
   * Get ticker with cache
   */
  async getTickerWithCache(symbol: string) {
    try {
      const key = CACHE_KEYS.TICKER(symbol);
      return await this.getOrFetch(
        key,
        async () => {
            const { data } = await supabase
              .from('tickers')
              .select('*')
              .eq('symbol', symbol.toUpperCase())
              .single();
            return data;
        },
        CACHE_TTL.TICKER_METADATA
      );
    } catch (error) {
      logger.error({ msg: 'Error getting ticker', error, symbol });
      return null;
    }
  }

  /**
   * Publish cache invalidation event
   */
  async publishInvalidation(channel: string, message: string): Promise<void> {
    try {
      await redisService.client.publish(channel, message);
    } catch (error) {
      logger.error({ msg: 'Error publishing invalidation', error });
    }
  }

  /**
   * Subscribe to cache invalidation events
   */
  async subscribeToInvalidation(
    channel: string,
    callback: (message: string) => void
  ): Promise<void> {
    try {
      const subscriber = redisService.client.duplicate();
      await subscriber.subscribe(channel, (err) => {
        if (err) {
          logger.error({ msg: 'Error subscribing to channel', error: err });
        }
      });

      subscriber.on('message', (chan, msg) => {
        if (chan === channel) {
          callback(msg);
        }
      });
    } catch (error) {
      logger.error({ msg: 'Error subscribing to invalidation', error });
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<Record<string, any>> {
    try {
      const info = await redisService.client.info('memory');
      const dbSize = await redisService.client.dbsize();

      return {
        memory: info,
        keys: dbSize,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error({ msg: 'Error getting cache stats', error });
      return {};
    }
  }

  /**
   * Warm cache with frequently accessed data
   */
  async warmCache(symbols: string[]): Promise<void> {
    try {
      logger.info({ msg: 'Warming cache', symbols });

      for (const symbol of symbols) {
        await this.cacheTickerMetadata(symbol);
      }

      logger.info({ msg: 'Cache warming complete', symbols: symbols.length });
    } catch (error) {
      logger.error({ msg: 'Error warming cache', error });
    }
  }
}

const redisCacheService = RedisCacheService.getInstance();
export default redisCacheService;
