import type { Job } from 'bull';
import { finnhubClient } from '../../../shared/infra/services/finnhub.service.js';
import { logger } from '../../../config/logger.js';
import { supabase } from '../../../shared/infra/libs/supabase.js';
import redisCacheService, {
  CACHE_KEYS,
  CACHE_TTL,
} from '../../../shared/infra/services/cache.service.js';

interface NewsPollingJob {
  tickers: string[];
}

interface FinnhubNewsItem {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

/**
 * News Polling Worker
 * Fetches latest news every 5 minutes from Finnhub
 * Stores in database and caches frequently accessed data
 */
export async function processNewsPollingJob(job: Job<NewsPollingJob>): Promise<void> {
  try {
    const { tickers } = job.data;
    logger.info({ msg: 'Processing news polling job', tickers: tickers.length });

    const allNews: (FinnhubNewsItem & { ticker: string })[] = [];

    for (const ticker of tickers) {
      try {
        const news = await fetchNewsFromFinnhub(ticker);
        if (news && news.length > 0) {
          allNews.push(
            ...news.map((n) => ({
              ...n,
              ticker,
            }))
          );
        }
      } catch (error) {
        logger.error({
          msg: 'Error fetching news for ticker',
          error,
          ticker,
        });
        // Continue with other tickers
      }
    }

    // Store in database
    await storeNewsInDatabase(allNews);

    // Cache recently fetched news
    await cacheNews(allNews);

    logger.info({
      msg: 'News polling complete',
      newsItemsProcessed: allNews.length,
    });

    return;
  } catch (error) {
    logger.error({ msg: 'Error in news polling job', error });
    throw error;
  }
}

/**
 * Fetch news from Finnhub API
 */
async function fetchNewsFromFinnhub(ticker: string): Promise<FinnhubNewsItem[]> {
  try {
    const now = new Date();
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(now.getDate() - 3);

    const to = now.toISOString().split('T')[0]!;
    const from = threeDaysAgo.toISOString().split('T')[0]!;

    const response = await finnhubClient.getCompanyNews({
      symbol: ticker,
      from: from,
      to: to,
      limit: 10,
    });

    if (Array.isArray(response)) {
      return (response as FinnhubNewsItem[]).slice(0, 10);
    }

    return [];
  } catch (error) {
    logger.error({
      msg: 'Finnhub news API error',
      error: error instanceof Error ? error.message : String(error),
      ticker,
    });
    return [];
  }
}

/**
 * Store news in Supabase with deduplication
 */
async function storeNewsInDatabase(
  newsItems: (FinnhubNewsItem & { ticker: string })[]
): Promise<void> {
  try {
    if (newsItems.length === 0) return;

    // Get existing news URLs to avoid duplicates
    const urls = newsItems.map((n) => n.url);
    const { data: existingNews } = await supabase
      .from('social_mentions')
      .select('url')
      .in('url', urls)
      .eq('source', 'news');

    const existingUrls = new Set((existingNews || []).map((n: any) => n.url));

    // Filter out duplicates
    const newNewsItems = newsItems.filter((n) => !existingUrls.has(n.url));

    if (newNewsItems.length === 0) {
      logger.info({ msg: 'No new news items to store' });
      return;
    }

    // Get ticker IDs
    const tickers = [...new Set(newNewsItems.map((n) => n.ticker))];
    const { data: tickerRecords } = await supabase
      .from('tickers')
      .select('id, symbol')
      .in('symbol', tickers);

    const tickerMap = new Map((tickerRecords || []).map((t: any) => [t.symbol, t.id]));

    // Prepare records for insertion
    const recordsToInsert = newNewsItems.map((news) => ({
      ticker_id: tickerMap.get(news.ticker),
      source: 'news' as const,
      source_id: news.id.toString(),
      text: news.headline,
      url: news.url,
      sentiment: determineSentimentFromHeadline(news.headline),
      sentiment_score: 0, 
      author: news.source,
      published_at: new Date(news.datetime * 1000).toISOString(),
      processed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('social_mentions')
      .insert(recordsToInsert);

    if (error) {
      logger.error({ msg: 'Error storing news', error });
      return;
    }

    logger.info({
      msg: 'News items stored',
      count: newNewsItems.length,
    });
  } catch (error) {
    logger.error({ msg: 'Error storing news in database', error });
  }
}

/**
 * Cache recently fetched news
 */
async function cacheNews(
  newsItems: (FinnhubNewsItem & { ticker: string })[]
): Promise<void> {
  try {
    // Group by ticker
    const newsByTicker = new Map<string, FinnhubNewsItem[]>();

    for (const news of newsItems) {
      if (!newsByTicker.has(news.ticker)) {
        newsByTicker.set(news.ticker, []);
      }
      newsByTicker.get(news.ticker)!.push(news);
    }

    // Cache ticker news
    const cacheData = new Map<
      string,
      { value: any; ttl: number }
    >();

    for (const [ticker, news] of newsByTicker) {
      const cacheKey = CACHE_KEYS.NEWS_ITEMS(ticker);
      cacheData.set(cacheKey, {
        value: news.slice(0, 20).map((n) => ({
          id: n.id,
          headline: n.headline,
          summary: n.summary,
          source: n.source,
          url: n.url,
          published: new Date(n.datetime * 1000),
          category: n.category,
        })),
        ttl: CACHE_TTL.LATEST_NEWS,
      });
    }

    await redisCacheService.mset(cacheData);
  } catch (error) {
    logger.error({ msg: 'Error caching news', error });
  }
}

/**
 * Determine sentiment from headline
 */
function determineSentimentFromHeadline(headline: string): 'positive' | 'negative' | 'neutral' {
  const lowerHeadline = headline.toLowerCase();

  const positiveKeywords = [
    'beat',
    'surge',
    'rally',
    'gain',
    'rise',
    'positive',
    'growth',
    'profit',
    'strong',
    'approval',
    'partnership',
    'acquisition',
    'record',
  ];

  const negativeKeywords = [
    'fell',
    'drop',
    'loss',
    'decline',
    'miss',
    'negative',
    'downgrade',
    'bankruptcy',
    'lawsuit',
    'recall',
    'failed',
    'dead',
    'collapse',
  ];

  const positiveCount = positiveKeywords.filter((kw) =>
    lowerHeadline.includes(kw)
  ).length;

  const negativeCount = negativeKeywords.filter((kw) =>
    lowerHeadline.includes(kw)
  ).length;

  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

export { processNewsPollingJob as newsPollingWorker };
