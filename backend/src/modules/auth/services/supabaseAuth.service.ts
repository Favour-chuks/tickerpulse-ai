import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {envConfig} from '../../../config/environmentalVariables.js';
import { logger } from '../../../config/logger.js';

export interface AuthUser {
  id: string
  email: string,
  email_verified: boolean,
  first_name: string,
  last_name: string,
  phone_verified: boolean,
}

interface AuthSession {
  user: AuthUser | null;
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    expires_at: number;
  } | null;
}

interface SignUpData {
  email: string;
  password: string;
  metadata?: {
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
}

interface SignInData {
  email: string;
  password: string;
}

class AuthServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'AUTH_ERROR'
  ) {
    super(message);
    this.name = 'AuthServiceError';
    logger.error({ message }, 'AuthServiceError');
  }
}

export class SupabaseAuthService {
  private supabase: SupabaseClient;

  constructor() {

    const { supabase_url, supabase_service_role_key} = envConfig

    if (!supabase_url || !supabase_service_role_key) {
      throw new Error('Missing Supabase environment variables');
    }

    this.supabase = createClient(supabase_url, supabase_service_role_key);
  }

  /**
   * Maps Supabase auth data to internal AuthSession format
   */
  private mapAuthDataToSession(authData: {
    user: any;
    session: any;
  }): AuthSession {
    if (!authData.user) {
      throw new AuthServiceError('No user data returned from authentication', 'NO_USER_DATA');
    }

    if (!authData.session) {
      throw new AuthServiceError('No session returned from authentication', 'NO_SESSION');
    }

    return {
      user: {
        id: authData.user.id,
        email: authData.user.email,
        email_verified: authData.user.email_verified,
        first_name: authData.user.first_name,
        last_name: authData.user.last_name,
        phone_verified: authData.user.phone_verified,
      },
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_in: authData.session.expires_in,
        expires_at: authData.session.expires_at,
      },
    };
  }

  private mapUserData(user: any): AuthUser {
    if (!user) {
      throw new AuthServiceError('No user data provided', 'NO_USER_DATA');
    }

    return {
      id: user.id,
      email: user.email,
      email_verified: user.email_verified,
      first_name: user.first_name,
      last_name: user.last_name,
      phone_verified: user.phone_verified,
    };
  }

  private extractToken(tokenOrHeader: string): string {
    if (!tokenOrHeader) {
      throw new AuthServiceError('Token is required', 'MISSING_TOKEN');
    }

    if (tokenOrHeader.startsWith('Bearer ')) {
      return tokenOrHeader.slice(7);
    }

    return tokenOrHeader;
  }

  private handleAuthError(error: any, context: string): never {
    const message = error instanceof Error ? error.message : String(error);
    throw new AuthServiceError(`${context}: ${message}`, 'AUTH_SERVICE_ERROR');
  }

  async register(data: SignUpData): Promise<AuthSession> {
  try {
    if (!data.email || !data.password) {
      throw new AuthServiceError('Email and password are required', 'INVALID_INPUT');
    }

    const { data: authData, error } = await this.supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: data.metadata || {},
      },
    });
    
    if (error ) {
      throw new AuthServiceError(`Registration failed: ${error.message}`, 'REGISTRATION_FAILED');
    }
    
    if (!authData.session) {
      throw new Error("the user token cannot be created at this time")
    }

    return this.mapAuthDataToSession(authData);

  } catch (error) {
    throw error
  }
}

  async login(data: SignInData): Promise<AuthSession> {
    try {
      if (!data.email || !data.password) {
        throw new AuthServiceError('Email and password are required', 'INVALID_INPUT');
      }

      const { data: authData, error } = await this.supabase.auth.signInWithPassword({
        email: data.email.trim(),
        password: data.password.trim(),
      });

      if (error) {
        throw new AuthServiceError(error.message);
      }

      return this.mapAuthDataToSession(authData);
    } catch (error) {
      if (error instanceof AuthServiceError) {
        throw error;
      }
      this.handleAuthError(error, 'Login error');
    }
  }

  async getGoogleOAuthUrl(redirectUrl: string): Promise<{ url: string }> {
    try {
      if (!redirectUrl) {
        throw new AuthServiceError('Redirect URL is required', 'MISSING_REDIRECT_URL');
      }

      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          scopes: 'openid profile email',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        throw new AuthServiceError(`OAuth URL generation failed: ${error.message}`, 'OAUTH_URL_FAILED');
      }

      if (!data.url) {
        throw new AuthServiceError('No OAuth URL returned from Supabase', 'NO_OAUTH_URL');
      }

      return { url: data.url };
    } catch (error) {
      if (error instanceof AuthServiceError) {
        throw error;
      }
      this.handleAuthError(error, 'OAuth URL generation error');
    }
  }

  async handleOAuthCallback(code: string): Promise<AuthSession> {
    try {
      if (!code) {
        throw new AuthServiceError('Authorization code is required', 'MISSING_AUTH_CODE');
      }

      const { data, error } = await this.supabase.auth.exchangeCodeForSession(code);

      if (error) {
        throw new AuthServiceError(`OAuth callback failed: ${error.message}`, 'OAUTH_CALLBACK_FAILED');
      }

      return this.mapAuthDataToSession(data);
    } catch (error) {
      if (error instanceof AuthServiceError) {
        throw error;
      }
      this.handleAuthError(error, 'OAuth callback error');
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthSession> {
    try {
      const token = this.extractToken(refreshToken);

      const { data, error } = await this.supabase.auth.refreshSession({
        refresh_token: token,
      });

      if (error) {
        throw new AuthServiceError(`Token refresh failed: ${error.message}`, 'REFRESH_FAILED');
      }

      return this.mapAuthDataToSession(data);
    } catch (error) {
      if (error instanceof AuthServiceError) {
        throw error;
      }
      this.handleAuthError(error, 'Token refresh error');
    }
  }

  async getSession(accessToken: string): Promise<AuthUser> {
    try {
      const token = this.extractToken(accessToken);

      const { data, error } = await this.supabase.auth.getUser(token);

      if (error) {
        throw new AuthServiceError(`Get session failed: ${error.message}`, 'GET_SESSION_FAILED');
      }

      if (!data.user) {
        throw new AuthServiceError('No user found for token', 'NO_USER');
      }

      return this.mapUserData(data.user);
    } catch (error) {
      if (error instanceof AuthServiceError) {
        throw error;
      }
      this.handleAuthError(error, 'Get session error');
    }
  }

  async verifyToken(token: string): Promise<AuthUser> {
    try {
      const cleanToken = this.extractToken(token);

      const { data, error } = await this.supabase.auth.getUser(cleanToken);

      if (error) {
        throw new AuthServiceError(`Token verification failed: ${error.message}`, 'TOKEN_VERIFICATION_FAILED');
      }

      if (!data.user) {
        throw new AuthServiceError('Invalid token', 'INVALID_TOKEN');
      }
      
      return this.mapUserData(data.user);
    } catch (error) {
      if (error instanceof AuthServiceError) {
        throw error;
      }
      this.handleAuthError(error, 'Token verification error');
    }
  }

  async logout(accessToken: string): Promise<void> {
    try {
      const token = this.extractToken(accessToken);

      const userSupabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      });

      const { error } = await userSupabase.auth.signOut();

      if (error) {
        throw new AuthServiceError(`Logout failed: ${error.message}`, 'LOGOUT_FAILED');
      }
    } catch (error) {
      if (error instanceof AuthServiceError) {
        throw error;
      }
      this.handleAuthError(error, 'Logout error');
    }
  }

  async updateUserMetadata(
    accessToken: string,
    metadata: Record<string, any>
  ): Promise<AuthUser> {
    try {
      const token = this.extractToken(accessToken);

      if (!metadata || Object.keys(metadata).length === 0) {
        throw new AuthServiceError('Metadata is required', 'INVALID_METADATA');
      }

      const { data, error } = await this.supabase.auth.updateUser(
        { data: metadata },
      );

      if (error) {
        throw new AuthServiceError(`Update metadata failed: ${error.message}`, 'UPDATE_METADATA_FAILED');
      }

      if (!data.user) {
        throw new AuthServiceError('Update successful but no user returned', 'NO_USER_RETURNED');
      }

      return this.mapUserData(data.user);
    } catch (error) {
      if (error instanceof AuthServiceError) {
        throw error;
      }
      this.handleAuthError(error, 'Update metadata error');
    }
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }
}

export const supabaseAuthService = new SupabaseAuthService();
