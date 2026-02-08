import type { FastifyReply, FastifyRequest } from 'fastify';
import { supabaseAuthService } from '../services/supabaseAuth.service.js';
import { envConfig } from '../../../config/environmentalVariables.js';
import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'
import { handleError } from '../../../shared/utils/errors.js';

interface LoginBody {
  email: string;
  password: string;
}

interface RegisterBody {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

interface RefreshBody {
  refreshToken: string;
}

export class AuthController {
  public signUp = async (request: FastifyRequest<{ Body: RegisterBody }>, reply: FastifyReply) => {
    try {
      const { email, password, firstName, lastName } = request.body;

      if (!email || !password) {
        return reply.code(400).send({
          error: 'Email and password are required',
          code: 'INVALID_INPUT',
        });
      }

      const authData = await supabaseAuthService.register({
        email,
        password,
        metadata: {
          first_name: firstName || 'Member',
          last_name: lastName || '',
        },
      });
      
      return reply.code(201).send({
        message: 'User created successfully in the signup',
        ...authData
      });
    } catch (error) {
      handleError(error)
    }
  };

  public signIn = async (request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
    try {
      const { email, password } = request.body;

      if (!email || !password) {
        return reply.code(400).send({
          error: 'Email and password are required',
          code: 'INVALID_INPUT',
        });
      }

      const authData = await supabaseAuthService.login({ email, password });

      return reply.send({
        message: 'Login successful',
        ...authData,
      });
    } catch (error) {
      handleError(error)
    }
  };

  public oauthCallback =  async (request: FastifyRequest, reply: FastifyReply) => {
    const {cors_origin, supabase_anon_key, supabase_url} = envConfig

    if(!supabase_anon_key || !supabase_url) throw new Error('supabase environmental variables not found')

      const { code, next = "/" } = request.query as { code: string; next: string };

    if (code) {
      const supabase = createServerClient(
        supabase_anon_key, 
        supabase_url,
        {
          cookies: {
            getAll() {
              const cookies = parseCookieHeader(request.headers.cookie ?? '');
              // Map the cookies to ensure 'value' is always a string, not undefined
              return cookies.map(cookie => ({
                name: cookie.name,
                value: cookie.value ?? '', // Fixes: Type 'undefined' is not assignable to type 'string'
              }));
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) =>
                reply.header('Set-Cookie', serializeCookieHeader(name, value, options))
              )
            },
          },
        }
      )

      // This is the magic part: it identifies the user based on the 'code'
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        return reply.redirect(`${process.env.FRONTEND_URL}/auth?error=${error.message}`)
      }
  }

  // Redirect back to the frontend (e.g., localhost:5173/dashboard)
  return reply.redirect(`${cors_origin}${next}`)
  }

  public refresh = async (request: FastifyRequest<{ Body: RefreshBody }>, reply: FastifyReply) => {
    try {
      const { refreshToken } = request.body;

      if (!refreshToken) {
        return reply.code(400).send({
          error: 'Refresh token is required',
          code: 'INVALID_INPUT',
        });
      }

      const session = await supabaseAuthService.refreshToken(refreshToken);

      if(session.session){
      return reply.send({
        message: 'Token refreshed',
        session: {
          access_token: session.session.access_token,
          refresh_token: session.session.refresh_token,
          expires_at: session.session.expires_at,
        },
      })}
      throw new Error('')
    } catch (error) {
      handleError(error)
    }
  };

  public getSession = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;

      if (!authHeader) {
        return reply.code(401).send({
          error: 'Authorization header is required',
          code: 'MISSING_TOKEN',
        });
      }

      const user = await supabaseAuthService.getSession(authHeader);
      
      return reply.send({
        user: {
          id: user.id,    
        },
      });
    } catch (error) {
      handleError(error)
    }
  };

  public logout = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;

      if (!authHeader) {
        return reply.code(401).send({
          error: 'Authorization header is required',
          code: 'MISSING_TOKEN',
        });
      }

      await supabaseAuthService.logout(authHeader);

      return reply.send({ message: 'Logout successful' });
    } catch (error) {
      handleError(error)
    }
  };
}