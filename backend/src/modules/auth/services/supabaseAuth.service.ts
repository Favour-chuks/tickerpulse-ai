// TODO: comeback to check this out
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {envConfig} from '../../../config/environmentalVariables.js';
/**
 * Represents an authenticated user
 */
export interface AuthUser {
  id: string
  email: string,
  email_verified: boolean,
  first_name: string,
  last_name: string,
  phone_verified: boolean,
}
/**
 * Represents a complete authentication session with user and tokens
 */
// TODO take a look at this null checker because these should never be null
interface AuthSession {
  user: AuthUser | null;
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    expires_at: number;
  } | null;
}

/**
 * Data required for user registration
 */
interface SignUpData {
  email: string;
  password: string;
  metadata?: {
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
}

/**
 * Data required for user login
 */
interface SignInData {
  email: string;
  password: string;
}

/**
 * Custom error class for authentication-specific errors
 */
class AuthServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'AUTH_ERROR'
  ) {
    super(message);
    this.name = 'AuthServiceError';
    console.log("this log is inside the authServiceError: ",message)
  }
}

export class SupabaseAuthService {
  private supabase: SupabaseClient;

  constructor() {

    const { supabase_url, supabase_service_role_key} = envConfig

    if (!supabase_url || !supabase_service_role_key) {
      throw new Error('Missing Supabase environment variables');
    }

    this.supabase = createClient(supabase_url, supabase_service_role_key); //TODO check if its this that is causing the error
  }

  /**
   * Maps Supabase auth data to internal AuthSession format
   * Ensures consistent session object structure across all auth methods
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

  /**
   * Maps Supabase user data to internal AuthUser format
   */
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

  /**
   * Extracts and validates token from authorization header or raw token
   */
  private extractToken(tokenOrHeader: string): string {
    if (!tokenOrHeader) {
      throw new AuthServiceError('Token is required', 'MISSING_TOKEN');
    }

    // Remove 'Bearer ' prefix if present
    if (tokenOrHeader.startsWith('Bearer ')) {
      return tokenOrHeader.slice(7);
    }

    return tokenOrHeader;
  }

  /**
   * Wraps Supabase errors with custom error handling
   */
  private handleAuthError(error: any, context: string): never {
    const message = error instanceof Error ? error.message : String(error);
    throw new AuthServiceError(`${context}: ${message}`, 'AUTH_SERVICE_ERROR');
  }

  /**
   * Register a new user with email and password
   */
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

  /**
   * Sign in with email and password
   */
  async login(data: SignInData): Promise<AuthSession> {
    try {
      // Validate input
      if (!data.email || !data.password) {
        throw new AuthServiceError('Email and password are required', 'INVALID_INPUT');
      }

      const { data: authData, error } = await this.supabase.auth.signInWithPassword({
        email: /**"okolofavour1818@gmail.com",**/ data.email.trim(),
        password: /**'Okolo' **/data.password.trim(),
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

  /**
   * Sign in with Google OAuth
   * Returns the OAuth URL for the client to redirect to
   */
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

  /**
   * Handle OAuth callback and exchange code for session
   */
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

  /**
   * Refresh access token using refresh token
   */
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

  /**
   * Get current session from access token
   */
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

  /**
   * Verify JWT token (for middleware)
   * Accepts both raw tokens and Bearer token format
   */
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

  /**
   * Sign out user
   */
  async logout(accessToken: string): Promise<void> {
    try {
      const token = this.extractToken(accessToken);

      // Create a client with the user's access token for secure logout
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

  /**
   * Update user metadata
   */
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

  /**
   * Get authenticated Supabase client for database operations
   */
  getClient(): SupabaseClient {
    return this.supabase;
  }
}

export const supabaseAuthService = new SupabaseAuthService();
