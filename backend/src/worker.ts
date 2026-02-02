import 'dotenv/config';
import { alertQueue, notificationQueue, wsQueue, initializeQueues, closeQueues } from './shared/infra/services/queue.service.js';
import { processAlertJob } from './modules/alerts/workers/alert-distribution.worker.js';
import { processNotificationJob, cleanupExpiredNotifications } from './modules/notifications/workers/notification-queue.worker.js';
import { processBroadcastJob, cleanupInactiveSubscriptions } from './modules/market/workers/websocket.worker.js';
import { testRedisConnection, closeRedisConnections } from './config/redis.js';

/**
 * Worker Service
 * Runs background workers for:
 * - Alert distribution
 * - Notification queueing
 * - WebSocket broadcasting
 *
 * This is a separate process from the main API server
 * Run with: pnpm run workers
 */

const WORKER_CONCURRENCY = {
  alerts: 5,
  notifications: 3,
  websocket: 10,
};

const CLEANUP_INTERVALS = {
  notifications: 60 * 60 * 1000, // 1 hour
  subscriptions: 30 * 60 * 1000, // 30 minutes
};

let isShuttingDown = false;

/**
 * Initialize all workers
 */
async function initializeWorkers(): Promise<void> {
  try {
    console.log('🚀 Starting Worker Service...');

    // Test Redis connection first
    const redisConnected = await testRedisConnection();
    if (!redisConnected) {
      throw new Error('Failed to connect to Redis');
    }

    // Initialize queues
    await initializeQueues();

    // Register alert distribution worker
    alertQueue.process(WORKER_CONCURRENCY.alerts, processAlertJob);
    console.log(`✅ Alert distribution worker initialized (concurrency: ${WORKER_CONCURRENCY.alerts})`);

    // Register notification queue worker
    notificationQueue.process(WORKER_CONCURRENCY.notifications, processNotificationJob);
    console.log(`✅ Notification queue worker initialized (concurrency: ${WORKER_CONCURRENCY.notifications})`);

    // Register WebSocket broadcast worker
    wsQueue.process(WORKER_CONCURRENCY.websocket, processBroadcastJob);
    console.log(`✅ WebSocket broadcast worker initialized (concurrency: ${WORKER_CONCURRENCY.websocket})`);

    // Setup periodic cleanup tasks
    setupCleanupTasks();

    console.log('✅ All workers initialized successfully');
    console.log('📊 Worker concurrency settings:', WORKER_CONCURRENCY);
  } catch (error) {
    console.error('❌ Failed to initialize workers:', error);
    process.exit(1);
  }
}

/**
 * Setup periodic cleanup tasks
 */
function setupCleanupTasks(): void {
  // Cleanup expired notifications every hour
  setInterval(async () => {
    try {
      console.log('🧹 Running notification cleanup...');
      await cleanupExpiredNotifications();
    } catch (error) {
      console.error('❌ Notification cleanup failed:', error);
    }
  }, CLEANUP_INTERVALS.notifications);

  // Cleanup inactive WebSocket subscriptions every 30 minutes
  setInterval(async () => {
    try {
      console.log('🧹 Running subscription cleanup...');
      await cleanupInactiveSubscriptions(30);
    } catch (error) {
      console.error('❌ Subscription cleanup failed:', error);
    }
  }, CLEANUP_INTERVALS.subscriptions);

  console.log('✅ Cleanup tasks scheduled');
}

/**
 * Graceful shutdown handler
 */
async function handleShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n⏹️  Received ${signal}, shutting down gracefully...`);

  try {
    // Stop accepting new jobs
    console.log('⏳ Pausing workers...');
    await Promise.all([
      alertQueue.pause(),
      notificationQueue.pause(),
      wsQueue.pause(),
    ]);

    // Close all queues
    await closeQueues();

    // Close Redis connections
    await closeRedisConnections();

    console.log('✅ Worker service shut down successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

/**
 * Handle uncaught errors
 */
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  handleShutdown('uncaughtException').catch(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  handleShutdown('unhandledRejection').catch(() => process.exit(1));
});

/**
 * Graceful shutdown on signals
 */
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

/**
 * Display worker statistics
 */
async function displayStats(): Promise<void> {
  const interval = setInterval(async () => {
    if (isShuttingDown) {
      clearInterval(interval);
      return;
    }

    try {
      const alertStats = await alertQueue.getJobCounts();
      const notifStats = await notificationQueue.getJobCounts();
      const wsStats = await wsQueue.getJobCounts();

      console.log('\n📊 Queue Statistics:');
      console.log(
        `  Alerts: ${alertStats.active} active, ${alertStats.waiting} waiting, ${alertStats.completed} completed`
      );
      console.log(
        `  Notifications: ${notifStats.active} active, ${notifStats.waiting} waiting, ${notifStats.completed} completed`
      );
      console.log(
        `  WebSocket: ${wsStats.active} active, ${wsStats.waiting} waiting, ${wsStats.completed} completed`
      );
    } catch (error) {
      console.error('Error getting queue stats:', error);
    }
  }, 30000); // Every 30 seconds
}

/**
 * Start the worker service
 */
async function main(): Promise<void> {
  try {
    await initializeWorkers();
    await displayStats();
    console.log('🎯 Worker service is running...');
    console.log('Press Ctrl+C to stop');
  } catch (error) {
    console.error('❌ Failed to start worker service:', error);
    process.exit(1);
  }
}

// Start the service
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
