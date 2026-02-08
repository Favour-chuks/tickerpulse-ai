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
    // Accept token from Authorization header OR query param `token`
    let authHeader = request.headers.authorization as string | undefined;

    if (!authHeader) {
      // fall back to ?token=<jwt> for websocket or other clients
      const maybeToken = (request as any).query?.token || (request as any).query?.access_token;
      if (maybeToken) {
        authHeader = `Bearer ${maybeToken}`;
      }
    }

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
      // Try to verify the provided access token
      const user = await supabaseAuthService.verifyToken(authHeader);
      if (!user) throw new Error('Unauthorized');
      request.user = user;
      return;
    } catch (error: any) {
      // If token is expired and client provided a refresh token, attempt refresh
      const message = error instanceof Error ? error.message : String(error);
      const isExpired = /expired/i.test(message);

      if (isExpired) {
        const refreshToken = (request.headers['x-refresh-token'] as string) || (request as any).query?.refresh_token;
        if (refreshToken) {
          try {
            const session = await supabaseAuthService.refreshToken(refreshToken);
            if (session?.session && session?.user) {
              // Set new tokens on response for client to pick up
              reply.header('X-Access-Token', session.session.access_token);
              reply.header('X-Refresh-Token', session.session.refresh_token);
              request.user = session.user as any;
              return;
            }
          } catch (refreshErr) {
            // fallthrough to return original token error below
          }
        }
      }

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