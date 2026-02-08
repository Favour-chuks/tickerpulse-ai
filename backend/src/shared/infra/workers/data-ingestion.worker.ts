/**
 * Data Ingestion Workers Registration
 *
 * Registers and schedules recurring workers for:
 * - Market data ingestion (5-minute interval)
 * - News polling (5-minute interval)
 * - SEC filing checks (daily interval)
 *
 * These workers run independently from the main API and handle
 * fetching external data and storing it in Supabase
 */

import { marketDataQueue, newsPollingQueue, secFilingQueue } from '../services/queue.service.js';
import { processMarketDataJob } from '../../../modules/market/workers/marketData.worker.js';
import { processNewsPollingJob } from '../../../modules/news/workers/newsPolling.worker.js';
import { processSECFilingJob } from '../../../modules/news/workers/secFiling.worker.js';
import { supabase } from '../libs/supabase.js';
import { logger } from '../../../config/logger.js';

/**
 * Recurring job scheduling configuration
 */
const RECURRENCE_CONFIG = {
  MARKET_DATA_INTERVAL: '*/5 * * * *', // Every 5 minutes
  NEWS_POLLING_INTERVAL: '*/5 * * * *', // Every 5 minutes
  SEC_FILING_INTERVAL: '0 3 * * *', // Daily at 3 AM
};

/**
 * Initialize all data ingestion workers
 * Call this in your main worker process after queue initialization
 */
export async function initializeDataIngestionWorkers(): Promise<void> {
  try {
    logger.info({ msg: '🚀 Initializing data ingestion workers...' });

    // Register market data worker
    marketDataQueue.process(1, processMarketDataJob);
    logger.info({ msg: '✅ Market data worker registered (concurrency: 1)' });

    // Register news polling worker
    newsPollingQueue.process(1, processNewsPollingJob);
    logger.info({ msg: '✅ News polling worker registered (concurrency: 1)' });

    // Register SEC filing worker
    secFilingQueue.process(1, processSECFilingJob);
    logger.info({ msg: '✅ SEC filing worker registered (concurrency: 1)' });

    // Schedule recurring jobs
    await scheduleRecurringJobs();

    logger.info({ msg: '✅ All data ingestion workers initialized' });
  } catch (error) {
    logger.error({ msg: 'Error initializing data ingestion workers', error });
    throw error;
  }
}

/**
 * Schedule recurring ingestion jobs
 * Sets up cron-based job scheduling for data fetching
 */
async function scheduleRecurringJobs(): Promise<void> {
  try {
    logger.info({ msg: '📅 Scheduling recurring data ingestion jobs...' });

    // Fetch all active tickers to process
    const { data: tickers, error: tickerError } = await supabase
      .from('tickers')
      .select('id, symbol')
      .eq('is_active', true);

    if (tickerError) {
      throw new Error(`Failed to fetch tickers: ${tickerError.message}`);
    }

    if (!tickers || tickers.length === 0) {
      logger.warn({ msg: 'No active tickers found. Data ingestion jobs will not be scheduled.' });
      return;
    }

    logger.info({
      msg: `Found ${tickers.length} active tickers for data ingestion`,
    });

    // Schedule market data ingestion (every 5 minutes)
    const marketDataJobName = 'market-data-batch';
    // Use any casts to satisfy Bull typings in this TS migration
    await marketDataQueue.removeRepeatable(marketDataJobName as any, {
      cron: RECURRENCE_CONFIG.MARKET_DATA_INTERVAL,
    } as any);

    await marketDataQueue.add(
      {
        type: 'batch-market-data',
        tickers: tickers.map((t: any) => t.symbol),
      },
      {
        repeat: { cron: RECURRENCE_CONFIG.MARKET_DATA_INTERVAL } as any,
        jobId: marketDataJobName,
      } as any
    );

    logger.info({
      msg: `✅ Market data job scheduled: ${RECURRENCE_CONFIG.MARKET_DATA_INTERVAL}`,
    });

    // Schedule news polling (every 5 minutes)
    const newsPollingJobName = 'news-polling-batch';
    await newsPollingQueue.removeRepeatable(newsPollingJobName as any, {
      cron: RECURRENCE_CONFIG.NEWS_POLLING_INTERVAL,
    } as any);

    await newsPollingQueue.add(
      {
        type: 'batch-news-polling',
        tickers: tickers.map((t: any) => t.symbol),
      },
      {
        repeat: { cron: RECURRENCE_CONFIG.NEWS_POLLING_INTERVAL } as any,
        jobId: newsPollingJobName,
      } as any
    );

    logger.info({
      msg: `✅ News polling job scheduled: ${RECURRENCE_CONFIG.NEWS_POLLING_INTERVAL}`,
    });

    // Schedule SEC filing checks (daily at 3 AM)
    const secFilingJobName = 'sec-filing-batch';
    await secFilingQueue.removeRepeatable(secFilingJobName as any, {
      cron: RECURRENCE_CONFIG.SEC_FILING_INTERVAL,
    } as any);

    await secFilingQueue.add(
      {
        type: 'batch-sec-filing',
        tickers: tickers.map((t: any) => t.symbol),
      },
      {
        repeat: { cron: RECURRENCE_CONFIG.SEC_FILING_INTERVAL } as any,
        jobId: secFilingJobName,
      } as any
    );

    logger.info({
      msg: `✅ SEC filing job scheduled: ${RECURRENCE_CONFIG.SEC_FILING_INTERVAL}`,
    });

    logger.info({ msg: '✅ All recurring jobs scheduled successfully' });
  } catch (error) {
    logger.error({ msg: 'Error scheduling recurring jobs', error });
    throw error;
  }
}

/**
 * Clean up old completed jobs
 * Call periodically to prevent queue bloat
 */
export async function cleanupOldJobs(): Promise<void> {
  try {
    const RETENTION_DAYS = 7;
    const olderThan = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

    await Promise.all([
      marketDataQueue.clean(olderThan as any, 1000 as any, 'completed' as any),
      newsPollingQueue.clean(olderThan as any, 1000 as any, 'completed' as any),
      secFilingQueue.clean(olderThan as any, 1000 as any, 'completed' as any),
    ]);

    logger.info({
      msg: `🧹 Cleaned up jobs older than ${RETENTION_DAYS} days`,
    });
  } catch (error) {
    logger.error({ msg: 'Error cleaning up old jobs', error });
  }
}

/**
 * Get data ingestion queue statistics
 */
export async function getDataIngestionStats(): Promise<Record<string, any>> {
  try {
    return {
      marketData: await marketDataQueue.getJobCounts(),
      newsPolling: await newsPollingQueue.getJobCounts(),
      secFiling: await secFilingQueue.getJobCounts(),
    };
  } catch (error) {
    logger.error({ msg: 'Error getting data ingestion stats', error });
    throw error;
  }
}

export default {
  initializeDataIngestionWorkers,
  cleanupOldJobs,
  getDataIngestionStats,
};
