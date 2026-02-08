import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import marketDataService from '../services/marketData.service.js';
import { MarketDataController } from '../controllers/market.controllers.js';
import { logger } from '../../../config/logger.js';

export default async function marketRoutes(fastify: FastifyInstance) {
  const marketController = new MarketDataController();
  
  /**
   * GET /api/volume-spikes
   * Get volume spikes for authenticated user's watchlist tickers
   */
  fastify.get(
    '/volume-spikes',
    async (request : FastifyRequest, reply: FastifyReply) => {
      return marketController.getUserVolumeSpikes(request as any, reply);
    }
  );

  /**
   * GET /api/market/:ticker/volume-profile
   * Get historical volume patterns and statistics for a ticker
   */
  fastify.get(
    '/:ticker/volume-profile',
    {
      schema: {
        description: 'Get volume profile for ticker',
        tags: ['Market'],
        params: {
          type: 'object',
          properties: {
            ticker: { type: 'string', description: 'Stock ticker symbol' },
          },
          required: ['ticker'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              ticker: { type: 'string' },
              avgVolume: { type: 'number' },
              maxVolume: { type: 'number' },
              minVolume: { type: 'number' },
              volumePercentiles: { type: 'object' },
              volumeHistogram: { type: 'array' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { ticker } = request.params as { ticker: string };
        const profile = await marketDataService.getVolumeProfile(ticker);
        return reply.send({
          success: true,
          data: profile,
        });
      } catch (error: any) {
        logger.error({ msg: 'Error getting volume profile', error });
        return reply.send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /api/market/:ticker/current-spike
   * Get current volume spike event for a ticker
   */
  fastify.get(
    '/:ticker/volume-spike',
    {
      schema: {
        description: 'Get current volume spike for ticker',
        tags: ['Market'],
        params: {
          type: 'object',
          properties: {
            ticker: { type: 'string', description: 'Stock ticker symbol' },
          },
          required: ['ticker'],
        },
      },
    },
    async (request, reply) => {
      try {
        const { ticker } = request.params as { ticker: string };
        const spike = await marketDataService.getCurrentSpike(ticker);

        if (!spike) {
          return reply.send({
            success: true,
            data: null,
            message: 'No active spike detected',
          });
        }

        return reply.send({
          success: true,
          data: spike,
        });
      } catch (error: any) {
        logger.error({ msg: 'Error getting current spike', error });
        return reply.code(400).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /api/market/spikes
   * Get recent volume spikes across all tickers
   */
  fastify.get(
    '/spikes',
    {
      schema: {
        description: 'Get recent volume spikes',
        tags: ['Market'],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', default: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { limit = 20 } = request.query as { limit?: number };
        const spikes = await marketDataService.getRecentSpikes(
          Math.min(limit, 100)
        );

        return reply.send({
          success: true,
          data: spikes,
          count: spikes.length,
        });
      } catch (error: any) {
        logger.error({ msg: 'Error getting recent spikes', error });
        return reply.code(500).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /api/market/:ticker/latest-price
   * Get latest price for a ticker
   */
  fastify.get(
    '/:ticker/latest-price',
    {
      schema: {
        description: 'Get latest price for ticker',
        tags: ['Market'],
        params: {
          type: 'object',
          properties: {
            ticker: { type: 'string', description: 'Stock ticker symbol' },
          },
          required: ['ticker'],
        },
      },
    },
    async (request, reply) => {
      try {
        const { ticker } = request.params as { ticker: string };
        const price = await marketDataService.getLatestPrice(ticker);

        if (!price) {
          return reply.code(404).send({
            success: false,
            error: 'Price data not found',
          });
        }

        return reply.send({
          success: true,
          data: price,
        });
      } catch (error: any) {
        logger.error({ msg: 'Error getting latest price', error });
        return reply.code(500).send({
          success: false,
          error: error.message,
        });
      }
    }
  );
}
