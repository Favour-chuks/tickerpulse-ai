import { Redis, type RedisOptions } from 'ioredis';
import { envConfig } from './environmentalVariables.js';
import { logger } from './logger.js';

export class RedisService {
  private static instance: RedisService;
  public client: Redis;
  public queueClient: Redis;

  private constructor() {
    const { 
      redis_service_uri, 
      redis_host, 
      redis_port, 
      redis_password 
    } = envConfig;

    const commonOptions: RedisOptions = {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      enableOfflineQueue: true,
      password: redis_password,
    };

    this.client = redis_service_uri 
      ? new Redis(redis_service_uri, commonOptions)
      : new Redis({ host: redis_host, port: Number(redis_port), ...commonOptions });

    this.queueClient = redis_service_uri
      ? new Redis(redis_service_uri, commonOptions)
      : new Redis({ host: redis_host, port: Number(redis_port), ...commonOptions });

    this.initializeEventHandlers();
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  private initializeEventHandlers(): void {
    this.client.on('connect', () => logger.info('Redis Client: Connected'));
    this.client.on('error', (err) => logger.error({msg:'Redis Client: Error', err}));
    this.queueClient.on('connect', () => logger.info('Queue Redis: Connected'));
    this.queueClient.on('error', (err) => logger.error({msg:'Queue Redis: Error', err}));
  }

  
  /**
   * Simple Fixed-Window Rate Limiter
   * @param key The unique identifier for the limit (e.g., 'scraper:api-name')
   * @param limit Maximum number of requests allowed
   * @param windowInSeconds Time window in seconds
   * @returns Boolean indicating if the request is allowed
   */

  public async isRateLimited(key: string, limit: number, windowInSeconds: number): Promise<boolean> {
    const currentCount = await this.client.incr(key);

    if (currentCount === 1) {
      await this.client.expire(key, windowInSeconds);
    }

    return currentCount > limit;
  }

  public async testConnection(): Promise<boolean> {
    try {
      const [ping1, ping2] = await Promise.all([
        this.client.ping(),
        this.queueClient.ping()
      ]);
      return ping1 === 'PONG' && ping2 === 'PONG';
    } catch (error) {
      logger.error({msg:'Failed to ping Redis:', error});
      return false;
    }
  }

  public async shutdown(): Promise<void> {
    try {
      await Promise.all([
        this.client.quit(),
        this.queueClient.quit()
      ]);
      logger.info('Redis connections closed gracefully');
    } catch (error) {
      logger.error({msg:'Error during Redis shutdown:', error});
    }
  }
}

const redisService = RedisService.getInstance();
export default redisService;