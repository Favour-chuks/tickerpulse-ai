// TODO: refactor this database to use the supabase and check on all these services that does not seem to exist
import type { Job } from 'bull';
import db from '../shared/infra/libs/database.js';
import { redis } from '../config/redis.js';
import { queueNotification } from '../shared/infra/services/queue.service.js';
import type { AlertQueueJob } from '../shared/infra/services/queue.service.js';

/**
 * Alert Distribution Worker
 * Processes alerts from the queue and routes them to:
 * 1. Online users via WebSocket
 * 2. Offline users via notification queue
 * 3. User alert history table
 */

export async function processAlertJob(job: Job<AlertQueueJob>): Promise<void> {
  console.log(`🔄 Processing alert job ${job.id}:`, job.data);

  try {
    const { ticker_id, alert_type, severity, message, metadata, timestamp } = job.data;

    // Step 1: Get all users with this ticker in their watchlist
    const watchlistUsers = await db.queryMany(
      `SELECT DISTINCT up.id, up.email, COALESCE(up.preferences, '{}'::jsonb) as preferences
       FROM user_profiles up
       INNER JOIN watchlists w ON w.user_id = up.id
       INNER JOIN watchlist_items wi ON wi.watchlist_id = w.id
       INNER JOIN tickers t ON t.id = wi.ticker_id
       WHERE t.id = $1
       AND wi.alert_settings ->> 'alerts_enabled' != 'false'`,
      [ticker_id]
    );

    console.log(`👥 Found ${watchlistUsers.length} users watching ticker ${ticker_id}`);

    // Step 2: Get ticker symbol for context
    const ticker = await db.queryOne<{ symbol: string }>(
      'SELECT symbol FROM tickers WHERE id = $1',
      [ticker_id]
    );

    if (!ticker) {
      throw new Error(`Ticker ${ticker_id} not found`);
    }

    // Step 3: Create alert entry in database
    const alertResult = await db.queryOne<{ id: string }>(
      `INSERT INTO alert_history (ticker_id, alert_type, priority, message, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id`,
      [ticker_id, alert_type, severity, message, JSON.stringify(metadata)]
    );

    const alert_id = alertResult?.id;

    // Step 4: Distribute to each user
    for (const user of watchlistUsers) {
      await distributeAlertToUser(
        user.id,
        user.email,
        user.preferences,
        {
          alert_id,
          ticker_id,
          ticker_symbol: ticker.symbol,
          alert_type,
          severity,
          message,
          metadata,
          timestamp,
        }
      );
    }

    console.log(`✅ Alert ${alert_id} processed and distributed to ${watchlistUsers.length} users`);
  } catch (error) {
    console.error(`❌ Error processing alert job ${job.id}:`, error);
    throw error; // Will trigger retry
  }
}

/**
 * Distribute alert to a single user
 * Routes to WebSocket if online, otherwise queues for delivery
 */
async function distributeAlertToUser(
  user_id: string,
  email: string,
  preferences: any,
  alertData: any
): Promise<void> {
  try {
    // Check if user is currently online
    const activeSubscriptions = await redis.smembers(`user:${user_id}:subscriptions`);

    const userNotificationPrefs = preferences?.alerts_enabled !== false;

    if (activeSubscriptions.length > 0) {
      // User is online - send via WebSocket
      console.log(`📡 User ${email} is online, sending alert via WebSocket`);

      // Publish to user's channel
      await redis.publish(`user:${user_id}:alerts`, JSON.stringify({
        type: 'alert',
        data: alertData,
        timestamp: new Date().toISOString(),
      }));

      // Also store in user's alert history in database
      await db.query(
        `INSERT INTO notification_queue (user_id, ticker_id, payload, delivered_at, created_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [
          user_id,
          alertData.ticker_id,
          JSON.stringify({
            alert_type: alertData.alert_type,
            message: alertData.message,
            severity: alertData.severity,
            data: alertData,
          }),
        ]
      );
    } else if (userNotificationPrefs) {
      // User is offline - queue for delivery
      console.log(`📦 User ${email} is offline, queuing alert for later delivery`);

      await queueNotification({
        user_id,
        ticker_id: alertData.ticker_id,
        payload: {
          alert_type: alertData.alert_type,
          message: alertData.message,
          severity: alertData.severity,
          data: alertData,
        },
        priority: alertData.severity as any,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      });
    }
  } catch (error) {
    console.error(
      `⚠️  Failed to distribute alert to user ${user_id}:`,
      error instanceof Error ? error.message : error
    );
    // Don't throw - we want to continue with other users
  }
}

/**
 * Get alert statistics from database
 */
export async function getAlertStats(): Promise<Record<string, any>> {
  try {
    const stats = await db.queryOne(
      `SELECT
        COUNT(*) as total_alerts,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as alerts_last_hour,
        COUNT(CASE WHEN priority = 'critical' THEN 1 END) as critical_alerts,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_alerts
       FROM alert_history`
    );
    return stats || {};
  } catch (error) {
    console.error('Error getting alert stats:', error);
    return {};
  }
}

export default {
  processAlertJob,
  getAlertStats,
};
