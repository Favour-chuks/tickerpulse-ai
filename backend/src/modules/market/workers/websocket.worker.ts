import type { Job } from 'bull';
import { redis } from '../../../config/redis.js';
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
  console.log(`📡 Processing broadcast job ${job.id}:`, job.data);

  try {
    const { ticker_id, connection_ids, event_type, data } = job.data;

    // Get all subscriptions for this ticker
    const subscriptions = await redis.smembers(`ticker:${ticker_id}:subscribers`);

    console.log(
      `📡 Broadcasting to ${subscriptions.length} subscriptions for ticker ${ticker_id}`
    );

    if (subscriptions.length === 0) {
      console.log(`⚠️  No active subscriptions for ticker ${ticker_id}`);
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
        redis.publish(`ticker:${ticker_id}:updates`, JSON.stringify(broadcastData))
      )
    );

    // Count successful broadcasts
    const successful = results.filter((r: any) => r.status === 'fulfilled').length;

    console.log(
      `✅ Broadcast sent to ${successful}/${subscriptions.length} subscriptions`
    );
  } catch (error) {
    console.error(`❌ Error processing broadcast job ${job.id}:`, error);
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
    await redis.publish(
      `ticker:${ticker_id}:market_data`,
      JSON.stringify({
        event: 'market_data',
        ticker_id,
        data: marketData,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.error(`Error broadcasting market data for ticker ${ticker_id}:`, error);
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
    await redis.sadd(`ticker:${ticker_id}:subscribers`, connection_id);

    // Store subscription metadata
    await redis.hset(
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
    await redis.sadd(`user:${user_id}:active_tickers`, ticker_id);

    console.log(
      `✅ Connection ${connection_id} subscribed to ticker ${ticker_id} (${subscription_type})`
    );
  } catch (error) {
    console.error(
      `Error subscribing connection ${connection_id} to ticker ${ticker_id}:`,
      error
    );
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
    await redis.srem(`ticker:${ticker_id}:subscribers`, connection_id);

    // Remove subscription metadata
    await redis.del(`ws:subscription:${connection_id}`);

    // Remove ticker from user's active tickers if no more subscriptions
    const activeSubscriptions = await redis.keys(`ticker:*:subscribers`);
    const stillSubscribed = activeSubscriptions.some(
      (key: string) =>
        redis
          .sismember(key, connection_id)
          .then((result: any) => result === 1)
          .catch(() => false)
    );

    console.log(`✅ Connection ${connection_id} unsubscribed from ticker ${ticker_id}`);
  } catch (error) {
    console.error(
      `Error unsubscribing connection ${connection_id} from ticker ${ticker_id}:`,
      error
    );
  }
}

/**
 * Cleanup inactive subscriptions
 */
export async function cleanupInactiveSubscriptions(
  timeoutMinutes: number = 30
): Promise<number> {
  try {
    console.log(`🧹 Cleaning up inactive WebSocket subscriptions (timeout: ${timeoutMinutes}m)`);

    const subscriptionKeys = await redis.keys('ws:subscription:*');
    let cleanedCount = 0;

    for (const key of subscriptionKeys) {
      const subscription = await redis.hgetall(key);

      if (!subscription || Object.keys(subscription).length === 0) {
        await redis.del(key);
        cleanedCount++;
        continue;
      }

      const subscribedAt = new Date(subscription.subscribed_at);
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

    console.log(`✅ Cleaned up ${cleanedCount} inactive subscriptions`);
    return cleanedCount;
  } catch (error) {
    console.error('Error cleaning up inactive subscriptions:', error);
    return 0;
  }
}

/**
 * Get subscription statistics
 */
export async function getSubscriptionStats(): Promise<Record<string, any>> {
  try {
    const subscriptionKeys = await redis.keys('ws:subscription:*');
    const tickerKeys = await redis.keys('ticker:*:subscribers');

    const stats: Record<string, any> = {
      active_connections: subscriptionKeys.length,
      active_tickers: tickerKeys.length,
      tickers: {},
    };

    // Count subscribers per ticker
    for (const key of tickerKeys) {
      const ticker_id = key.match(/ticker:(\d+):subscribers/)?.[1];
      if (ticker_id) {
        const count = await redis.scard(key);
        stats.tickers[ticker_id] = count;
      }
    }

    return stats;
  } catch (error) {
    console.error('Error getting subscription stats:', error);
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
    const subscription = await redis.hgetall(`ws:subscription:${connection_id}`);

    if (subscription && subscription.ticker_id) {
      await unsubscribeFromTicker(parseInt(subscription.ticker_id), connection_id);
    }

    // Clean up connection data
    await redis.del(`ws:subscription:${connection_id}`);
    await redis.del(`ws:messages:${connection_id}`);

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
