import type { FastifyReply, FastifyRequest } from 'fastify';
import { newsInjectionService } from '../services/newsInjection.service.js';
import { geminiWorkerService } from '../workers/gemini.worker.js';

interface ProcessNewsBody {
  tickers: string[];
}

interface ValidateNewsBody {
  ticker: string;
  articleSentiment: number;
}

export class NewsController {
  /**
   * Process news for one or more tickers
   */
  public processNews = async (
    request: FastifyRequest<{ Body: ProcessNewsBody }>,
    reply: FastifyReply
  ) => {
    try {
      const { tickers } = request.body;

      if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
        return reply.code(400).send({
          error: 'tickers array is required and must not be empty',
        });
      }

      const results = await newsInjectionService.processNewsForTickers(tickers);

      return reply.send({
        message: 'News processing started',
        tickers_processed: tickers,
        articles_processed: Object.values(results).reduce(
          (sum, articles) => sum + articles.length,
          0
        ),
        results,
      });
    } catch (error) {
      reply.log.error(error);
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'News processing failed',
      });
    }
  };

  /**
   * Process news for a single ticker
   */
  public processTickerNews = async (
    request: FastifyRequest<{ Params: { ticker: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { ticker } = request.params;

      const articles = await newsInjectionService.processNewsForTicker(ticker);

      return reply.send({
        message: `News processing completed for ${ticker}`,
        ticker,
        articles_processed: articles.length,
        articles,
      });
    } catch (error) {
      reply.log.error(error);
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'News processing failed',
      });
    }
  };

  /**
   * Validate article against market trend
   */
  public validateNews = async (
    request: FastifyRequest<{ Body: ValidateNewsBody }>,
    reply: FastifyReply
  ) => {
    try {
      const { ticker, articleSentiment } = request.body;

      if (!ticker || articleSentiment === undefined) {
        return reply.code(400).send({
          error: 'ticker and articleSentiment are required',
        });
      }

      const validation = await newsInjectionService.validateAgainstMarketTrend(
        ticker,
        articleSentiment
      );

      return reply.send({
        ticker,
        sentiment: articleSentiment,
        validation,
      });
    } catch (error) {
      reply.log.error(error);
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Validation failed',
      });
    }
  };

  /**
   * Queue news injection job
   */
  public queueNewsJob = async (
    request: FastifyRequest<{
      Body: { tickerId: number; socialMentionId: number; priority?: string };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { tickerId, socialMentionId, priority } = request.body;

      if (!tickerId || !socialMentionId) {
        return reply.code(400).send({
          error: 'tickerId and socialMentionId are required',
        });
      }

      const jobId = await geminiWorkerService.queueJob(
        'news_injection',
        tickerId,
        {
          socialMentionId,
          priority: (priority as 'high' | 'normal' | 'low') || 'normal',
        }
      );

      return reply.code(201).send({
        message: 'Job queued',
        jobId,
      });
    } catch (error) {
      reply.log.error(error);
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Job queueing failed',
      });
    }
  };
}

export const newsController = new NewsController();
