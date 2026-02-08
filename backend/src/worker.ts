import { alertQueue, notificationQueue, wsQueue, initializeQueues, closeQueues, cleanupExpiredNotifications } from './shared/infra/services/queue.service.js';
import { initializeDataIngestionWorkers, cleanupOldJobs } from './shared/infra/workers/data-ingestion.worker.js';
import { processBroadcastJob, cleanupInactiveSubscriptions } from './modules/market/workers/websocket.worker.js';
import redisService from './config/redis.js';
import { logger } from './config/logger.js';

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
  notifications: 3,
  websocket: 10,
};

const CLEANUP_INTERVALS = {
  notifications: 60 * 60 * 1000, // 1 hour
  subscriptions: 30 * 60 * 1000, // 30 minutes
    dataIngestionOldJobs: 24 * 60 * 60 * 1000, // Daily
  };

let isShuttingDown = false;

/**
 * Initialize all workers
 */
async function initializeWorkers(): Promise<void> {
  try {
    logger.info('🚀 Starting Worker Service...');

    // Test Redis connection first
    const redisConnected = await redisService.testConnection();
    if (!redisConnected) {
      throw new Error('Failed to connect to Redis');
    }

    // Initialize queues
    await initializeQueues();

    
    // Register WebSocket broadcast worker
    wsQueue.process(WORKER_CONCURRENCY.websocket, processBroadcastJob);
    logger.info({ concurrency: WORKER_CONCURRENCY.websocket }, '✅ WebSocket broadcast worker initialized');

    // Initialize data ingestion workers (market data, news polling, SEC filings)
    await initializeDataIngestionWorkers();

    // Setup periodic cleanup tasks
    setupCleanupTasks();

    logger.info('✅ All workers initialized successfully');
    logger.info({ concurrency: WORKER_CONCURRENCY }, '📊 Worker concurrency settings');
  } catch (error) {
    logger.error({ error }, '❌ Failed to initialize workers');
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
      logger.info('🧹 Running notification cleanup...');
      await cleanupExpiredNotifications();
    } catch (error) {
      logger.error({ error }, '❌ Notification cleanup failed');
    }
  }, CLEANUP_INTERVALS.notifications);

  // Cleanup inactive WebSocket subscriptions every 30 minutes
  setInterval(async () => {
    try {
      logger.info('🧹 Running subscription cleanup...');
      await cleanupInactiveSubscriptions(30);
    } catch (error) {
      logger.error({ error }, '❌ Subscription cleanup failed');
    }
  }, CLEANUP_INTERVALS.subscriptions);

  // Cleanup old jobs daily
  setInterval(async () => {
    try {
      logger.info('🧹 Running data ingestion job cleanup...');
      await cleanupOldJobs();
    } catch (error) {
      logger.error({ error }, '❌ Data ingestion cleanup failed');
    }
  }, CLEANUP_INTERVALS.dataIngestionOldJobs);

  logger.info('✅ Cleanup tasks scheduled');
}

/**
 * Graceful shutdown handler
 */
async function handleShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, '⏹️  Received signal, shutting down gracefully...');

  try {
    // Stop accepting new jobs
    logger.info('⏳ Pausing workers...');
    await Promise.all([
      alertQueue.pause(),
      notificationQueue.pause(),
      wsQueue.pause(),
    ]);

    // Close all queues
    await closeQueues();

    // Close Redis connections
    await redisService.shutdown();

    logger.info('✅ Worker service shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, '❌ Error during shutdown');
    process.exit(1);
  }
}

/**
 * Handle uncaught errors
 */
process.on('uncaughtException', (error) => {
  logger.error({ error }, '❌ Uncaught Exception');
  handleShutdown('uncaughtException').catch(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ promise, reason }, '❌ Unhandled Rejection');
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

      logger.info({
        alerts: { active: alertStats.active, waiting: alertStats.waiting, completed: alertStats.completed },
        notifications: { active: notifStats.active, waiting: notifStats.waiting, completed: notifStats.completed },
        websocket: { active: wsStats.active, waiting: wsStats.waiting, completed: wsStats.completed }
      }, '📊 Queue Statistics');
    } catch (error) {
      logger.error({ error }, 'Error getting queue stats');
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
    logger.info('🎯 Worker service is running...');
    logger.info('Press Ctrl+C to stop');
  } catch (error) {
    logger.error({ error }, '❌ Failed to start worker service');
    process.exit(1);
  }
}

// Start the service
main().catch((error) => {
  logger.fatal({ error }, 'Fatal error');
  process.exit(1);
});

