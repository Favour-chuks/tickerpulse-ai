import type { Job } from 'bull';
import db from '../shared/infra/libs/database.js';
import { redis } from '../../../config/redis.js';
import type { NotificationQueueJob } from '../../../shared/infra/services/queue.service.js';

/**
 * Notification Queue Worker
 * Handles delivery of queued notifications to offline users
 *
 * This worker:
 * 1. Maintains a queue of notifications for users who are offline
 * 2. Stores notifications in the database for later retrieval
 * 3. Delivers pending notifications when users reconnect
 * 4. Cleans up expired notifications
 */

export async function processNotificationJob(
  job: Job<NotificationQueueJob>
): Promise<void> {
  console.log(`📬 Processing notification job ${job.id}:`, job.data);

  try {
    const { user_id, ticker_id, payload, priority, expires_at } = job.data;

    // Insert notification into database for later delivery
    const result = await db.query(
      `INSERT INTO notification_queue (
        user_id,
        ticker_id,
        payload,
        priority,
        expires_at,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id`,
      [user_id, ticker_id, JSON.stringify(payload), priority, expires_at]
    );

    console.log(`✅ Notification queued for user ${user_id}`);

    // Increment notification counter in Redis (for quick stats)
    await redis.incr(`user:${user_id}:pending_notifications`);

    // Set expiration on Redis counter
    await redis.expire(`user:${user_id}:pending_notifications`, 86400); // 24 hours

    // Keep track of users with pending notifications
    await redis.sadd('users:with:pending_notifications', user_id);

    return result as any;
  } catch (error) {
    console.error(`❌ Error processing notification job ${job.id}:`, error);
    throw error; // Will trigger retry
  }
}

/**
 * Deliver pending notifications to a reconnected user
 * Called when a user establishes a WebSocket connection
 */
export async function deliverPendingNotifications(userId: string): Promise<any[]> {
  try {
    console.log(`📥 Delivering pending notifications for user ${userId}`);

    // Get all pending notifications from database
    const notifications = await db.queryMany(
      `SELECT id, ticker_id, payload, priority, created_at
       FROM notification_queue
       WHERE user_id = $1
       AND delivered_at IS NULL
       AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId]
    );

    console.log(`📬 Found ${notifications.length} pending notifications for user ${userId}`);

    if (notifications.length === 0) {
      return [];
    }

    // Mark all as delivered
    const notificationIds = notifications.map((n: any) => n.id);
    const placeholders = notificationIds.map((_, i) => `$${i + 1}`).join(',');

    await db.query(
      `UPDATE notification_queue
       SET delivered_at = NOW()
       WHERE id IN (${placeholders})`,
      notificationIds
    );

    // Clear Redis counter
    await redis.del(`user:${userId}:pending_notifications`);

    // Remove from pending users if no more notifications
    const remainingCount = await getUndeliveredNotificationCount(userId);
    if (remainingCount === 0) {
      await redis.srem('users:with:pending_notifications', userId);
    }

    console.log(`✅ Delivered ${notifications.length} notifications to user ${userId}`);
    return notifications;
  } catch (error) {
    console.error(`⚠️  Error delivering pending notifications to ${userId}:`, error);
    return [];
  }
}

/**
 * Get count of undelivered notifications for a user
 */
export async function getUndeliveredNotificationCount(userId: string): Promise<number> {
  try {
    const result = await db.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM notification_queue
       WHERE user_id = $1
       AND delivered_at IS NULL
       AND expires_at > NOW()`,
      [userId]
    );

    return result ? parseInt(result.count) : 0;
  } catch (error) {
    console.error(`Error counting undelivered notifications for ${userId}:`, error);
    return 0;
  }
}

/**
 * Cleanup expired and old notifications
 * Should be run periodically (e.g., daily)
 */
export async function cleanupExpiredNotifications(): Promise<number> {
  try {
    console.log('🧹 Cleaning up expired notifications...');

    // Delete notifications older than 7 days that have been delivered
    const result = await db.query(
      `DELETE FROM notification_queue
       WHERE (delivered_at < NOW() - INTERVAL '7 days')
       OR (expires_at < NOW() AND delivered_at IS NULL)`,
      []
    );

    console.log('✅ Notification cleanup completed');
    return 0; // Bull expects a return value
  } catch (error) {
    console.error('❌ Error cleaning up notifications:', error);
    throw error;
  }
}

/**
 * Get notification statistics
 */
export async function getNotificationStats(): Promise<Record<string, any>> {
  try {
    const stats = await db.queryOne(
      `SELECT
        COUNT(*) as total_notifications,
        COUNT(CASE WHEN delivered_at IS NULL THEN 1 END) as pending_notifications,
        COUNT(CASE WHEN delivered_at IS NOT NULL THEN 1 END) as delivered,
        COUNT(DISTINCT user_id) as users_with_notifications
       FROM notification_queue
       WHERE expires_at > NOW()
       OR delivered_at IS NULL`
    );

    const usersWithPending = await redis.scard('users:with:pending_notifications');

    return {
      ...stats,
      users_with_pending_in_cache: usersWithPending,
    };
  } catch (error) {
    console.error('Error getting notification stats:', error);
    return {};
  }
}

/**
 * Resend a specific notification
 * Useful for manual retries
 */
export async function resendNotification(notificationId: number): Promise<boolean> {
  try {
    const result = await db.query(
      `UPDATE notification_queue
       SET delivered_at = NULL
       WHERE id = $1`,
      [notificationId]
    );

    return true;
  } catch (error) {
    console.error(`Error resending notification ${notificationId}:`, error);
    return false;
  }
}

export default {
  processNotificationJob,
  deliverPendingNotifications,
  getUndeliveredNotificationCount,
  cleanupExpiredNotifications,
  getNotificationStats,
  resendNotification,
};
