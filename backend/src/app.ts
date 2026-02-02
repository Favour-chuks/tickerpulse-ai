import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from "@fastify/cors";

import { envConfig } from "./config/environmentalVariables.js";
import { getLoggerConfig } from './config/logger.js';

import { verifyJWT } from "./shared/middlewares/auth.middleware.js";
// import { initializeQueues, getQueueStats } from "./services/queue.service.js";
// import redisService from "./config/redis.js";

import alertRoutes from "./modules/alerts/routes/alert.routes.js";
// import analysisRoutes from './modules/analysis/routes/analysis.routes.js';
import authRoutes from './modules/auth/routes/auth.routes.js';
import narrativeRoutes from "./modules/analysis/routes/narrative.routes.js";
import marketRoutes from './modules/market/routes/market.routes.js';
import pushRoutes from './modules/notifications/routes/push.routes.js';
import userRoutes from './modules/users/routes/user.routes.js';
import watchlistRoutes from './modules/watchlists/routes/watchlist.routes.js';

import { AppError } from "./shared/utils/errors.js";

const { node_env, node_host, node_port, cors_origin } = envConfig;

const fastify = Fastify({
  logger: getLoggerConfig()
});

fastify.register(fastifyCors, {
  origin: cors_origin || '*',
  methods: ['GET', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
});

fastify.register(fastifyWebsocket);

// Middleware for handling errors and everything
fastify.setErrorHandler((error: any, reply: any) => {
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({
      success: false,
      status: error.statusCode,
      error: {
        code: error.code,
        message: error.message
      }
    });
  }

  reply.code(500).send({ message: "An internal server error occurred" });
});

fastify.register(async (publicInstance) => {
  publicInstance.get('/', async (request, reply) => {
    return reply.send({
      message: 'SignalHub API',
      version: '1.0.0',
      docs: '/docs',
      health: '/health',
    });
  });

  publicInstance.get('/health', async (request, reply) => {
    return reply.code(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: node_env || 'development',
    });
  });

  publicInstance.get('/ready', async (request, reply) => {
    try {
      await fastify.ready();
      return reply.code(200).send({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return reply.code(503).send({
        status: 'not-ready',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });


  // publicInstance.get('/api/v1/queue-stats', async (request, reply) => {
  //   try {
  //     const stats = await getQueueStats();
  //     return reply.code(200).send({
  //       status: 'ok',
  //       timestamp: new Date().toISOString(),
  //       queues: stats,
  //     });
  //   } catch (error) {
  //     return reply.code(500).send({
  //       status: 'error',
  //       error: error instanceof Error ? error.message : 'Unknown error',
  //     });
  //   }
  // });

  publicInstance.register(authRoutes, { prefix: '/api/v1/auth' });
})

fastify.register(async (protectedInstance) => {
  protectedInstance.addHook('preHandler', verifyJWT);

  protectedInstance.register(userRoutes, { prefix: '/api/v1/users' });

  protectedInstance.register(watchlistRoutes, { prefix: '/api/v1/watchlist' });

  // protectedInstance.register(alertRoutes, { prefix: '/api/v1/alerts' });

  // protectedInstance.register(pushRoutes, {prefix: '/api/v1/push'})

  // protectedInstance.register(narrativeRoutes, { prefix: '/api/v1/narratives' });

  protectedInstance.register(marketRoutes, { prefix: '/api/v1/market' });

  // protectedInstance.register(analysisRoutes, { prefix: '/api/v1/analyse' });
});

/**
 * Global error handler
 * Catches all unhandled errors in route handlers
 */
fastify.setErrorHandler(async (error: any, request, reply) => {
  fastify.log.error({
    err: error,
    url: request.url,
    method: request.method,
  }, 'Unhandled error');

  // Map error to appropriate HTTP status code
  const statusCode = error?.statusCode || 500;
  const message = error?.message || 'Internal Server Error';

  return reply.code(statusCode).send({
    error: {
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      ...(node_env === 'development' && { stack: error?.stack }),
    },
  });
});

/**
 * 404 Not Found handler
 */
fastify.setNotFoundHandler(async (request, reply) => {
  return reply.code(404).send({
    error: {
      message: `Route '${request.method} ${request.url}' not found`,
      statusCode: 404,
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * Start the Fastify server
 * Listens on the configured port and logs the startup message
 */
export const start = async () => {
  try {
    // Test Redis connection
    // fastify.log.info('🔌 Testing Redis connection...');
    // const redisConnected = await redisService.testConnection();
    // if (!redisConnected) {
    //   throw new Error('Failed to connect to Redis');
    // }
    // fastify.log.info('✅ Redis connection successful');

    // Initialize message queues
    // fastify.log.info('📬 Initializing message queues...');
    // await initializeQueues();
    // fastify.log.info('✅ Message queues initialized');

    await fastify.ready();

    const port = parseInt(node_port || '5000', 10);
    const host = node_host || '0.0.0.0';

    await fastify.listen({ port, host });

    fastify.log.info(`🚀 Server is running on http://${host}:${port}`);
    fastify.log.info(`📊 Environment: ${node_env || 'development'}`);
    fastify.log.info(`✅ Server has been initialized successfully`);
    fastify.log.info(`📬 Alert streaming and offline notification queues are active`);

    return fastify;
  } catch (error) {
    fastify.log.error(error, 'Failed to start server');
    throw error;
  }
};

export default fastify;