import { supabaseAuthService } from './supabaseAuth.service.js';
import type { User, AuthPayload } from '../../../shared/types/domain.js';

/**
 * Auth Service - Facade for Supabase authentication
 * 
 * This service provides a simplified, domain-specific interface for authentication operations.
 * All authentication is delegated to Supabase, which handles:
 * - User registration and login
 * - Password hashing and verification
 * - Token generation and refresh
 * - Session management
 * - Email verification
 * - Password recovery
 * 
 * The service maintains backward compatibility with existing controllers while leveraging
 * Supabase's robust authentication infrastructure.
 */
class AuthService {
  private static instance: AuthService;

  private constructor() {}

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Convert Supabase user to domain User type
   */
  private mapSupabaseUserToDomain(supabaseUser: any): User {
    return {
      id: supabaseUser.id,
      email: supabaseUser.email!,
      firstName: supabaseUser.user_metadata?.first_name,
      lastName: supabaseUser.user_metadata?.last_name,
      isActive: true, // Supabase handles activation via email verification
      createdAt: new Date(supabaseUser.created_at),
      updatedAt: new Date(supabaseUser.updated_at),
      lastLogin: supabaseUser.last_sign_in_at ? new Date(supabaseUser.last_sign_in_at) : undefined,
    };
  }

  /**
   * Register a new user with email and password
   * 
   * @param email User email address
   * @param password User password (minimum 6 characters)
   * @param firstName Optional first name
   * @param lastName Optional last name
   * @returns Created user object
   * @throws Error if registration fails or email already exists
   */
  async register(
    email: string,
    password: string,
    firstName?: string,
    lastName?: string
  ): Promise<User> {
    try {
      const session = await supabaseAuthService.register({
        email,
        password,
        metadata: {
          first_name: firstName,
          last_name: lastName,
        },
      });

      return this.mapSupabaseUserToDomain(session.user);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      throw new Error(`Registration error: ${message}`);
    }
  }

  /**
   * Login user with email and password
   * 
   * @param email User email address
   * @param password User password
   * @returns User object and session tokens
   * @throws Error if credentials are invalid
   */
  async login(
    email: string,
    password: string
  ): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    try {
      const session = await supabaseAuthService.login({ email, password });

      return {
        user: this.mapSupabaseUserToDomain(session.user),
        accessToken: session.session.access_token,
        refreshToken: session.session.refresh_token,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      throw new Error(`Login error: ${message}`);
    }
  }

  /**
   * Refresh access token using refresh token
   * 
   * @param refreshToken Previously issued refresh token
   * @returns New access and refresh tokens
   * @throws Error if refresh token is invalid or expired
   */
  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      const session = await supabaseAuthService.refreshToken(refreshToken);

      return {
        accessToken: session.session.access_token,
        refreshToken: session.session.refresh_token,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Token refresh failed';
      throw new Error(`Token refresh error: ${message}`);
    }
  }

  /**
   * Logout user by invalidating their session
   * 
   * @param accessToken User's current access token
   * @throws Error if logout fails
   */
  async logout(accessToken: string): Promise<void> {
    try {
      await supabaseAuthService.logout(accessToken);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Logout failed';
      throw new Error(`Logout error: ${message}`);
    }
  }

  /**
   * Get user by ID from Supabase
   * 
   * @param userId User ID
   * @param accessToken User's access token for authentication
   * @returns User object or null if not found
   */
  async getUserById(userId: string, accessToken: string): Promise<User | null> {
    try {
      const user = await supabaseAuthService.getSession(accessToken);
      
      // Verify the token belongs to the requested user
      if (user.id !== userId) {
        throw new Error('Unauthorized: Cannot access other user data');
      }

      return this.mapSupabaseUserToDomain(user);
    } catch (error) {
      // Return null if user not found or token invalid, rather than throwing
      return null;
    }
  }

  /**
   * Verify access token and extract payload
   * 
   * Supabase handles JWT verification internally. This method
   * validates the token structure and returns basic payload info.
   * 
   * @param token JWT access token
   * @returns Token payload or null if invalid
   */
  verifyAccessToken(token: string): AuthPayload | null {
    try {
      // Extract token from Bearer format if needed
      const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
      
      // Decode JWT without verification (verification happens in middleware)
      const parts = cleanToken.split('.');
      if (parts.length !== 3 || !parts[1]) {
        return null;
      }

      const decoded = JSON.parse(
        Buffer.from(parts[1], 'base64').toString('utf-8')
      ) as any;

      return {
        userId: decoded.sub,
        email: decoded.email,
        iat: decoded.iat,
        exp: decoded.exp,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Change user password
   * 
   * @param accessToken User's current access token
   * @param newPassword New password (minimum 6 characters)
   * @throws Error if password change fails
   */
  async changePassword(accessToken: string, newPassword: string): Promise<void> {
    try {
      // Supabase provides a direct password update method
      const supabaseClient = supabaseAuthService.getClient();
      
      const { error } = await supabaseClient.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw new Error(`Password change failed: ${error.message}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Password change failed';
      throw new Error(`Password change error: ${message}`);
    }
  }

  /**
   * Update user metadata (profile information)
   * 
   * @param accessToken User's access token
   * @param metadata Metadata to update (first_name, last_name, etc.)
   * @returns Updated user object
   */
  async updateUserMetadata(
    accessToken: string,
    metadata: Record<string, any>
  ): Promise<User> {
    try {
      const user = await supabaseAuthService.updateUserMetadata(
        accessToken,
        metadata
      );

      return this.mapSupabaseUserToDomain(user);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update failed';
      throw new Error(`User update error: ${message}`);
    }
  }

  /**
   * Get authenticated Supabase client for database operations
   * Use this to access Supabase database features
   */
  getSupabaseClient() {
    return supabaseAuthService.getClient();
  }
}

export default AuthService.getInstance();
