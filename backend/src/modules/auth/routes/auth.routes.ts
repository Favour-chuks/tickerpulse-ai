import type { FastifyInstance, FastifySchema } from 'fastify';
import { AuthController } from '../controllers/auth.controllers.js';
import { verifyJWT } from '../../../shared/middlewares/auth.middleware.js';

type SwaggerSchema = FastifySchema & {
  description?: string;
  tags?: string[];
  summary?: string;
  security?:Array<{ [key: string]: string[] }>;
};

export default async function authRoutes(fastify: FastifyInstance) {
  
  const logoutSchema : SwaggerSchema = {
      description: 'Sign out user and invalidate session',
      tags: ['Session'],
      security: [{ bearerAuth: [] }],
  }

  const sessionSchema: SwaggerSchema = {
      description: 'Get current user session',
      tags: ['Session'],
      security: [{ bearerAuth: [] }],
  }

  const authController = new AuthController();

  fastify.post('/register', {
    schema: {
      description: 'Register a new user with email and password',
      tags: ['Authentication'],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
        },
      },
    },
  }, authController.signUp);

  fastify.post('/login', {
    schema: {
      description: 'Sign in with email and password',
      tags: ['Authentication'],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
    },
  }, authController.signIn);

  fastify.post('/refresh', {
    schema: {
      description: 'Refresh an expired access token',
      tags: ['Authentication'],
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' },
        },
      },
    },
  }, authController.refresh);


  fastify.get('/callback', {
    schema: {
      description: 'Handle OAuth provider callback',
      tags: ['OAuth'],
      querystring: {
        type: 'object',
        required: ['code'],
        properties: {
          code: { type: 'string' },
        },
      },
    },
  }, authController.oauthCallback);

  
  fastify.get('/session', {
    preHandler: verifyJWT,
    schema: sessionSchema,
  }, authController.getSession);

  
    fastify.post('/logout', {
    preHandler: verifyJWT,
    schema: logoutSchema,
  }, authController.logout);
}