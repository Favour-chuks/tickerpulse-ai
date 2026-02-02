import type { AuthUser } from '../../modules/auth/services/supabaseAuth.service.ts';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}