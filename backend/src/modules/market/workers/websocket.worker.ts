import type { Job } from 'bull';
import redisService from '../../../config/redis.js';
import { logger } from '../../../config/logger.js';
import type { WebSocketQueueJob } from '../../../shared/infra/services/queue.service.js';

/**
 * WebSocket Broadcast Worker
 * Handles real-time delivery of market data and updates to connected WebSocket clients
 *
 * This worker:
 * 1. Takes broadcast jobs from the queue
 * 2. Finds all active WebSocket connections for subscribed users
 * 3. Delivers data to connected clients
 * 4. Handles disconnections and retries
 */

export async function processBroadcastJob(
  job: Job<WebSocketQueueJob>
): Promise<void> {
  logger.info({ jobId: job.id, data: job.data }, '📚 Processing broadcast job');

  try {
    const { ticker_id, connection_ids, event_type, data } = job.data;

    // Get all subscriptions for this ticker
    const subscriptions = await redisService.client.smembers(`ticker:${ticker_id}:subscribers`);

    logger.info({ tickerId: ticker_id, count: subscriptions.length }, '📚 Broadcasting to subscriptions');

    if (subscriptions.length === 0) {
      logger.warn({ tickerId: ticker_id }, '⚠️  No active subscriptions for ticker');
      return;
    }

    const broadcastData = {
      event: event_type,
      ticker_id,
      data,
      timestamp: new Date().toISOString(),
    };

    // Broadcast to all subscribed users
    const results = await Promise.allSettled(
      subscriptions.map((subscription: string) =>
        redisService.client.publish(`ticker:${ticker_id}:updates`, JSON.stringify(broadcastData))
      )
    );

    // Count successful broadcasts
    const successful = results.filter((r: any) => r.status === 'fulfilled').length;

    logger.info({ successful, total: subscriptions.length }, '✅ Broadcast sent to subscriptions');
  } catch (error) {
    logger.error({ jobId: job.id, error }, '❌ Error processing broadcast job');
    throw error;
  }
}

/**
 * Queue a real-time market data update for broadcast
 */
export async function broadcastMarketData(
  ticker_id: number,
  marketData: any
): Promise<void> {
  try {
    await redisService.client.publish(
      `ticker:${ticker_id}:market_data`,
      JSON.stringify({
        event: 'market_data',
        ticker_id,
        data: marketData,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    logger.error({ tickerId: ticker_id, error }, 'Error broadcasting market data');
  }
}

/**
 * Subscribe a connection to ticker updates
 */
export async function subscribeToTicker(
  ticker_id: number,
  user_id: string,
  connection_id: string,
  subscription_type: 'alerts' | 'market_data' | 'both' = 'both'
): Promise<void> {
  try {
    // Add to ticker subscribers
    await redisService.client.sadd(`ticker:${ticker_id}:subscribers`, connection_id);

    // Store subscription metadata
    await redisService.client.hset(
      `ws:subscription:${connection_id}`,
      'ticker_id',
      ticker_id,
      'user_id',
      user_id,
      'type',
      subscription_type,
      'subscribed_at',
      new Date().toISOString()
    );

    // Add ticker to user's active tickers
    await redisService.client.sadd(`user:${user_id}:active_tickers`, ticker_id);

    logger.info({ connectionId: connection_id, tickerId: ticker_id, type: subscription_type }, '✅ Connection subscribed to ticker');
  } catch (error) {
    logger.error({ connectionId: connection_id, tickerId: ticker_id, error }, 'Error subscribing connection to ticker');
  }
}

/**
 * Unsubscribe a connection from ticker updates
 */
export async function unsubscribeFromTicker(
  ticker_id: number,
  connection_id: string
): Promise<void> {
  try {
    // Remove from ticker subscribers
    await redisService.client.srem(`ticker:${ticker_id}:subscribers`, connection_id);

    // Remove subscription metadata
    await redisService.client.del(`ws:subscription:${connection_id}`);

    // Remove ticker from user's active tickers if no more subscriptions
    const activeSubscriptions = await redisService.client.keys(`ticker:*:subscribers`);
    const stillSubscribed = activeSubscriptions.some(
      (key: string) =>
        redisService.client
          .sismember(key, connection_id)
          .then((result: any) => result === 1)
          .catch(() => false)
    );

    logger.info({ connectionId: connection_id, tickerId: ticker_id }, '✅ Connection unsubscribed from ticker');
  } catch (error) {
    logger.error({ connectionId: connection_id, tickerId: ticker_id, error }, 'Error unsubscribing connection from ticker');
  }
}

/**
 * Cleanup inactive subscriptions
 */
export async function cleanupInactiveSubscriptions(
  timeoutMinutes: number = 30
): Promise<number> {
  try {
    logger.info({ timeoutMinutes }, '🧹 Cleaning up inactive WebSocket subscriptions');

    const subscriptionKeys = await redisService.client.keys('ws:subscription:*');
    let cleanedCount = 0;

    for (const key of subscriptionKeys) {
      const subscription = await redisService.client.hgetall(key);

      if (!subscription || Object.keys(subscription).length === 0) {
        await redisService.client.del(key);
        cleanedCount++;
        continue;
      }

      const subscribedAt = new Date(subscription.subscribed_at || Date.now());
      const now = new Date();
      const diffMinutes = (now.getTime() - subscribedAt.getTime()) / (1000 * 60);

      if (diffMinutes > timeoutMinutes) {
        const connection_id = key.split(':')[2];
        const ticker_id = subscription.ticker_id;

        if (connection_id && ticker_id) {
          await unsubscribeFromTicker(parseInt(ticker_id), connection_id);
          cleanedCount++;
        }
      }
    }

    logger.info({ cleanedCount }, '✅ Cleaned up inactive subscriptions');
    return cleanedCount;
  } catch (error) {
    logger.error({ error }, 'Error cleaning up inactive subscriptions');
    return 0;
  }
}

/**
 * Get subscription statistics
 */
export async function getSubscriptionStats(): Promise<Record<string, any>> {
  try {
    const subscriptionKeys = await redisService.client.keys('ws:subscription:*');
    const tickerKeys = await redisService.client.keys('ticker:*:subscribers');

    const stats: Record<string, any> = {
      active_connections: subscriptionKeys.length,
      active_tickers: tickerKeys.length,
      tickers: {},
    };

    // Count subscribers per ticker
    for (const key of tickerKeys) {
      const ticker_id = key.match(/ticker:(\d+):subscribers/)?.[1];
      if (ticker_id) {
        const count = await redisService.client.scard(key);
        stats.tickers[ticker_id] = count;
      }
    }

    return stats;
  } catch (error) {
    logger.error({ error }, 'Error getting subscription stats');
    return {};
  }
}

/**
 * Handle connection cleanup on disconnect
 */
export async function handleConnectionDisconnect(connection_id: string): Promise<void> {
  try {
    console.log(`🔌 Handling disconnect for connection ${connection_id}`);

    // Get all subscriptions for this connection
    const subscription = await redisService.client.hgetall(`ws:subscription:${connection_id}`);

    if (subscription && subscription.ticker_id) {
      await unsubscribeFromTicker(parseInt(subscription.ticker_id), connection_id);
    }

    // Clean up connection data
    await redisService.client.del(`ws:subscription:${connection_id}`);
    await redisService.client.del(`ws:messages:${connection_id}`);

    console.log(`✅ Cleaned up connection ${connection_id}`);
  } catch (error) {
    console.error(`Error handling disconnect for connection ${connection_id}:`, error);
  }
}

export default {
  processBroadcastJob,
  broadcastMarketData,
  subscribeToTicker,
  unsubscribeFromTicker,
  cleanupInactiveSubscriptions,
  getSubscriptionStats,
  handleConnectionDisconnect,
};
