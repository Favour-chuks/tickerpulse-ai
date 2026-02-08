import Bull from 'bull';
import type { Queue, Job, QueueOptions } from 'bull';
import redisService from '../../../config/redis.js';
/**
 * Interface for Alert Queue jobs
 */
export interface AlertQueueJob {
  ticker_id: number;
  alert_type: 'volume_spike' | 'divergence' | 'contradiction' | 'news' | 'filing';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metadata: {
    spike_id?: number;
    contradiction_id?: number;
    article_id?: number;
    filing_id?: number;
    price_impact?: number;
    volume_impact?: number;
  };
  timestamp: string;
}

/**
 * Interface for Notification Queue jobs (for offline users)
 */
export interface NotificationQueueJob {
  user_id: string;
  ticker_id: number;
  payload: {
    alert_type: string;
    message: string;
    severity: string;
    data: Record<string, any>;
  };
  priority: 'low' | 'medium' | 'high' | 'critical';
  expires_at: string;
}

/**
 * Interface for WebSocket broadcast jobs
 */
export interface WebSocketQueueJob {
  ticker_id: number;
  connection_ids: string[];
  event_type: string;
  data: Record<string, any>;
}

/**
 * Queue configuration options
 */
/**
 * Queue configuration options
 */
const queueConfig: QueueOptions = {
  createClient: (type) => {
    switch (type) {
      case 'client':
        return redisService.client;
      case 'subscriber':
        return redisService.queueClient; 
      case 'bclient':
        return redisService.queueClient.duplicate(); 
      default:
        return redisService.client;
    }
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
  settings: {
    maxStalledCount: 2,
    lockDuration: 30000,
    lockRenewTime: 15000,
  },
};

/**
 * Alert Distribution Queue
 * Handles distributing alerts to online and offline users
 */
export const alertQueue: Queue<AlertQueueJob> = new Bull('alerts', {
  redis: redisService,
  ...queueConfig,
} as any);

/**
 * Notification Queue
 * Stores notifications for offline users to be delivered when they reconnect
 */
export const notificationQueue: Queue<NotificationQueueJob> = new Bull(
  'notifications',
  {
    redis: redisService,
    ...queueConfig,
  } as any
);

/**
 * WebSocket Broadcast Queue
 * Handles real-time broadcast of market data and updates to connected users
 */
export const wsQueue: Queue<WebSocketQueueJob> = new Bull('websocket', {
  redis: redisService,
  ...queueConfig,
  defaultJobOptions: {
    ...queueConfig.defaultJobOptions,
    attempts: 1, // WebSocket messages don't retry
    removeOnComplete: true,
  },
} as any);

/**
 * Worker Job Queue
 * Handles async worker tasks like Gemini analysis
 */
export const workerQueue: Queue = new Bull('worker-jobs', {
  redis: redisService,
  ...queueConfig,
  defaultJobOptions: {
    ...queueConfig.defaultJobOptions,
    attempts: 3,
  },
} as any);

/**
 * Market Data Ingestion Queue
 * Handles fetching and storing market data from Finnhub (5-minute interval)
 */
export const marketDataQueue: Queue = new Bull('market-data-ingestion', {
  redis: redisService,
  ...queueConfig,
  defaultJobOptions: {
    ...queueConfig.defaultJobOptions,
    attempts: 2,
    removeOnComplete: true,
  },
} as any);

/**
 * News Polling Queue
 * Handles fetching and storing news from Finnhub (5-minute interval)
 */
export const newsPollingQueue: Queue = new Bull('news-polling', {
  redis: redisService,
  ...queueConfig,
  defaultJobOptions: {
    ...queueConfig.defaultJobOptions,
    attempts: 2,
    removeOnComplete: true,
  },
} as any);

/**
 * SEC Filing Queue
 * Handles fetching and storing SEC filings from EDGAR (daily interval)
 */
export const secFilingQueue: Queue = new Bull('sec-filing-ingestion', {
  redis: redisService,
  ...queueConfig,
  defaultJobOptions: {
    ...queueConfig.defaultJobOptions,
    attempts: 2,
    removeOnComplete: true,
  },
} as any);

/**
 * Initialize all queues with event handlers
 */
export const initializeQueues = async (): Promise<void> => {
  // Global error handler
  [alertQueue, notificationQueue, wsQueue, workerQueue, marketDataQueue, newsPollingQueue, secFilingQueue].forEach((queue) => {
    queue.on('error', (error) => {
      console.error(`❌ Queue error (${queue.name}):`, error);
    });

    queue.on('stalled', (job) => {
      console.warn(`⚠️  Job stalled in ${queue.name}:`, job.id);
    });

    queue.on('failed', (job, error) => {
      console.error(`❌ Job failed in ${queue.name} (${job.id}):`, error.message);
    });

    queue.on('completed', (job) => {
      console.log(`✅ Job completed in ${queue.name} (${job.id})`);
    });
  });

  console.log('✅ All queues initialized');
};

/**
 * Close all queues
 */
export const closeQueues = async (): Promise<void> => {
  try {
    await Promise.all([
      alertQueue.close(),
      notificationQueue.close(),
      wsQueue.close(),
      workerQueue.close(),
      marketDataQueue.close(),
      newsPollingQueue.close(),
      secFilingQueue.close(),
    ]);
    console.log('✅ All queues closed');
  } catch (error) {
    console.error('Error closing queues:', error);
  }
};

/**
 * Add alert to distribution queue
 * This queues an alert for processing and delivery to users
 */
export const queueAlert = async (alertData: AlertQueueJob): Promise<Job> => {
  return alertQueue.add(alertData, {
    jobId: `alert-${alertData.ticker_id}-${Date.now()}`,
    priority: alertData.severity === 'critical' ? 1 : alertData.severity === 'high' ? 2 : 3,
  });
};

/**
 * Add notification to queue for offline user
 * This stores the notification in the queue for later delivery
 */
export const queueNotification = async (
  notificationData: NotificationQueueJob
): Promise<Job> => {
  return notificationQueue.add(notificationData, {
    jobId: `notif-${notificationData.user_id}-${Date.now()}`,
    priority: notificationData.priority === 'critical' ? 1 : 2,
    attempts: 5, // Retry more for notifications
  });
};

/**
 * Add WebSocket broadcast to queue
 * For real-time updates to connected users
 */
export const queueWebSocketBroadcast = async (
  wsData: WebSocketQueueJob
): Promise<Job> => {
  return wsQueue.add(wsData, {
    jobId: `ws-${wsData.ticker_id}-${Date.now()}`,
  });
};

/**
 * Get queue statistics
 */
export const getQueueStats = async (): Promise<Record<string, any>> => {
  return {
    alerts: await alertQueue.getJobCounts(),
    notifications: await notificationQueue.getJobCounts(),
    websocket: await wsQueue.getJobCounts(),
    workers: await workerQueue.getJobCounts(),
    marketData: await marketDataQueue.getJobCounts(),
    newsPolling: await newsPollingQueue.getJobCounts(),
    secFiling: await secFilingQueue.getJobCounts(),
  };
};

/**
 * Cleanup expired notifications in the notification queue
 * Scans jobs in the notification queue and removes jobs whose
 * `expires_at` timestamp is in the past. Returns number of removed jobs.
 */
export const cleanupExpiredNotifications = async (): Promise<number> => {
  try {
    const jobs = await notificationQueue.getJobs(['waiting', 'delayed', 'active', 'completed']);
    const now = Date.now();
    let removed = 0;

    await Promise.all(
      jobs.map(async (job) => {
        try {
          const data: any = job.data as any;
          const expiresAt = data?.expires_at ? Date.parse(data.expires_at) : null;
          if (expiresAt && !isNaN(expiresAt) && expiresAt < now) {
            await job.remove();
            removed++;
          }
        } catch (err) {
          // ignore per-job errors
        }
      })
    );

    console.log(`🧹 Cleaned up ${removed} expired notifications`);
    return removed;
  } catch (error) {
    console.error('Error during cleanupExpiredNotifications:', error);
    return 0;
  }
};

export default {
  alertQueue,
  notificationQueue,
  wsQueue,
  workerQueue,
  marketDataQueue,
  newsPollingQueue,
  secFilingQueue,
  initializeQueues,
  closeQueues,
  queueAlert,
  queueNotification,
  queueWebSocketBroadcast,
  getQueueStats,
  cleanupExpiredNotifications,
};
