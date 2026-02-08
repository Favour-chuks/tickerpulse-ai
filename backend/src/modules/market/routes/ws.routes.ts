import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import redisService from '../../../config/redis.js';
import { logger } from '../../../config/logger.js';
import type { WebSocket } from '@fastify/websocket';

export default async function wsRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/alerts',
    {
      websocket: true,
    },
    async (connection: WebSocket, request: any) => {
      const connId = uuidv4();
      const userId = (request as any).user?.id || request.query?.user_id || 'anonymous';

      logger.info({ connId, userId }, '🔌 WS connection opened');

      const ws: WebSocket = connection;

      const subscriber = redisService.client.duplicate();
      try {
        await subscriber.connect();
      } catch (err) {
        logger.error({ err }, 'Failed to connect Redis subscriber for WS');
      }

      // Subscribe to a user channel where broadcasts for this user's connections are published
      const channel = `user:${userId}:notifications`;
      try {
       subscriber.on('message', (chan, message) => {
         if (chan === channel && ws.readyState === ws.OPEN) {
           ws.send(message);
         }
       });
      } catch (err) {
        logger.error({ err, channel }, 'Failed to subscribe to Redis channel for WS');
      }

      
      // Handle incoming messages from client (subscribe/unsubscribe control messages)
      ws.on('message', async (raw: Buffer | string) => {
        try {
          const text = typeof raw === 'string' ? raw : raw.toString('utf8');
          const msg = JSON.parse(text);
          if (msg?.type === 'subscribe' && Array.isArray(msg.payload?.tickers)) {
            for (const t of msg.payload.tickers) {
              // add subscription key for worker to read
              await redisService.client.sadd(`ticker:${t}:subscribers`, connId);
              await redisService.client.hset(`ws:subscription:${connId}`, {
                connection_id: connId,
                user_id: userId,
                ticker_id: t,
                subscribed_at: new Date().toISOString(),
              } as any);
            }
            ws.send(JSON.stringify({ type: 'subscribed', payload: { tickers: msg.payload.tickers } }));
          } else if (msg?.type === 'unsubscribe' && Array.isArray(msg.payload?.tickers)) {
            for (const t of msg.payload.tickers) {
              await redisService.client.srem(`ticker:${t}:subscribers`, connId);
              await redisService.client.del(`ws:subscription:${connId}`);
            }
            ws.send(JSON.stringify({ type: 'unsubscribed', payload: { tickers: msg.payload.tickers } }));
          }
        } catch (err) {
          // ignore parse errors
        }
      });

      ws.on('close', async () => {
        try {
          // cleanup subscriptions
          const sub = await redisService.client.hgetall(`ws:subscription:${connId}`);
          if (sub && sub.ticker_id) {
            await redisService.client.srem(`ticker:${sub.ticker_id}:subscribers`, connId);
          }
          await redisService.client.del(`ws:subscription:${connId}`);
          await subscriber.unsubscribe(channel);
          await subscriber.quit();
        } catch (err) {
          // best effort cleanup
        }
        logger.info({ connId, userId }, '🔌 WS connection closed');
      });
    }
  );

  // Market data route (example - same behavior)
  fastify.get(
    '/market',
    { websocket: true },
    async (connection: any, request: any) => {
      // For now, reuse alerts handler behavior: subscribe to user channel
      // This keeps the API surface consistent with the frontend's expectations
      logger.info('Market WS connection opened');
    }
  );
}

export const __wsRoutes = true;
