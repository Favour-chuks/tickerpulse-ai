import type { FastifyReply, FastifyRequest } from 'fastify';
import { supabaseAuthService } from '../../modules/auth/services/supabaseAuth.service.js';
import type { AuthUser } from '../../modules/auth/services/supabaseAuth.service.js';

declare global {
  namespace FastifyInstance {
    interface FastifyRequest {
      user?: AuthUser
    }
  }
}

export const verifyJWT = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return reply.code(401).send({
        error: 'Unauthorized: No token provided',
        code: 'MISSING_TOKEN',
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({
        error: 'Unauthorized: Invalid token format',
        code: 'INVALID_TOKEN_FORMAT',
      });
    }

    try {
      const user = await supabaseAuthService.verifyToken(authHeader);
      
      if(!user) throw new Error('Unauthorized')

      request.user = user;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Token verification failed';
      return reply.code(401).send({
        error: `Unauthorized: ${message}`,
        code: 'TOKEN_VERIFICATION_FAILED',
      });
    }
  } catch (error) {
    request.log.error(error);
    return reply.code(401).send({
      error: 'Unauthorized: An unexpected error occurred',
      code: 'MIDDLEWARE_ERROR',
    });
  }
};