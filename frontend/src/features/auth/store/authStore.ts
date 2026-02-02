import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { User } from '../../../shared/types';
import { api, ApiError } from '../../../shared/services/api';
import { supabase } from '@/src/shared/services/supabase';

// ==================== TYPES ====================
export interface RegisterResult {
  requiresVerification: boolean;
  message?: string;
}

interface AuthError {
  message: string;
  status: number | string;
  code?: string;
}

interface AuthState {
  // State
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: AuthError | null;
  registerResult: RegisterResult | null;

  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  logout: () => void;
  
  // Helpers
  clearError: () => void;
  setUser: (user: User) => void;
  updateTokens: (accessToken: string, refreshToken: string) => void;
}

// ==================== CONSTANTS ====================
const auth_token = 'auth_token';
const refresh_token = 'refresh_token';
const USER_KEY = 'auth_user';

// ==================== HELPER FUNCTIONS ====================
const getStoredAuth = () => {
  try {
    const token = localStorage.getItem(auth_token);
    const refreshToken = localStorage.getItem(refresh_token);
    const userStr = localStorage.getItem(USER_KEY);

    if (!token || !refreshToken || !userStr) {
      return null;
    }

    return {
      token,
      refreshToken,
      user: JSON.parse(userStr) as User,
    };
  } catch (error) {
    return null;
  }
};

const setStoredAuth = (token: string, refreshToken: string, user: User) => {
  localStorage.setItem(auth_token, token);
  localStorage.setItem(refresh_token, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

const clearStoredAuth = () => {
  localStorage.removeItem(auth_token);
  localStorage.removeItem(refresh_token);
  localStorage.removeItem(USER_KEY);
};

const handleAuthError = (error: any): AuthError => {
  if (error instanceof ApiError) {
    return {
      message: error.message,
      status: error.status,
      code: error.code,
    };
  }

  return {
    message: error?.message || 'An unexpected error occurred',
    status: error?.status || 500,
    code: error?.code || 'UNKNOWN',
  };
};

// ==================== STORE ====================
export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        // ==================== INITIAL STATE ====================
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: true,
        isInitialized: false,
        error: null,
        registerResult: null,

        // ==================== INITIALIZE ====================
        initialize: async () => {
          if (get().isInitialized) {
            return;
          }

          set({ isLoading: true });

          const storedAuth = getStoredAuth();

          if (!storedAuth) {
            set({ 
              isLoading: false, 
              isAuthenticated: false,
              isInitialized: true 
            });
            return;
          }

          try {
            set({
              token: storedAuth.token,
              refreshToken: storedAuth.refreshToken,
              user: storedAuth.user,
              isAuthenticated: true,
            });

            try {
              const profile = await api.auth.getUserProfile(storedAuth.user.id);
              
              if (profile) {
                set({ user: profile });
                localStorage.setItem(USER_KEY, JSON.stringify(profile));
              }

              set({ isLoading: false, isInitialized: true });

            } catch (error: any) {
              if (error?.status === 401 || error?.code === 'UNAUTHORIZED_MISSING_TOKEN') {

                try {
                  const refreshResponse = await api.auth.refreshToken(storedAuth.refreshToken);

                  if (!refreshResponse?.session) {
                    throw new Error('Invalid refresh response');
                  }

                  const { access_token, refresh_token } = refreshResponse.session;

                  setStoredAuth(access_token, refresh_token, storedAuth.user);
                  set({
                    token: access_token,
                    refreshToken: refresh_token,
                    isAuthenticated: true,
                    isLoading: false,
                    isInitialized: true,
                  });

                } catch (refreshError) {
                  get().logout();
                  set({ isLoading: false, isInitialized: true });
                  throw refreshError;
                }
              } else {
                set({ isLoading: false, isInitialized: true });
              }
            }
          } catch (error) {
            get().logout();
            set({ isLoading: false, isInitialized: true });
          }
        },

        // ==================== LOGIN ====================
        login: async (email: string, password: string) => {
          set({ isLoading: true, error: null });

          try {
            const response = await api.auth.login(email, password);

            if (!response?.session) {
              throw new Error('Invalid login response');
            }

            const { access_token, refresh_token } = response.session;
            let userData = response.user;

            if (!userData.firstName || !userData.email) {
              try {
                const profile = await api.auth.getUserProfile(userData.id);
                if (profile) {
                  userData = { ...userData, ...profile };
                }
              } catch (e) {
                if (!userData.email) {
                  userData.email = email;
                }
              }
            }

            setStoredAuth(access_token, refresh_token, userData);

            set({
              token: access_token,
              refreshToken: refresh_token,
              user: userData,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });

          } catch (error) {
            set({
              error: handleAuthError(error),
              isLoading: false,
              isAuthenticated: false,
            });
            throw error;
          }
        },

        // ==================== LOGIN WITH GOOGLE ====================
        loginWithGoogle: async () => {
          set({ isLoading: true, error: null });

          try {
            const { error } = await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: {
                redirectTo: `${process.env.VITE_API_URL}/auth/callback`,
                queryParams: {
                  access_type: 'offline',
                  prompt: 'consent',
                },
              },
            });

            if (error) {
              throw error;
            }

          } catch (error: any) {
            set({
              error: handleAuthError({ ...error, status: 400 }),
              isLoading: false,
            });
            throw error;
          }
        },

        // ==================== REGISTER ====================
        register: async (
          email: string,
          password: string,
          firstName: string,
          lastName: string
        ) => {
          set({ isLoading: true, error: null, registerResult: null });

          try {
            const response = await api.auth.register(email, password, firstName, lastName);

            if (!response?.session) {
              set({
                registerResult: {
                  requiresVerification: true,
                  message: 'Account created! Please check your email to verify your account.',
                },
                isLoading: false 
              })
              return;
            }

            const { access_token, refresh_token } = response.session;
            const userData = {
              ...response.user,
              firstName,
              lastName,
              email,
            };

            setStoredAuth(access_token, refresh_token, userData);

            set({
              token: access_token,
              refreshToken: refresh_token,
              user: userData,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });

            set({ registerResult : { requiresVerification: false }});
            return;
          } catch (error) {
            set({
              error: handleAuthError(error),
              isLoading: false,
            });
            throw error;
          }
        },

        // ==================== RESET PASSWORD ====================
        resetPassword: async (email: string) => {
          set({ isLoading: true, error: null });

          try {
            await api.auth.resetPassword(email);
            set({ isLoading: false });
          } catch (error) {
            set({
              error: handleAuthError(error),
              isLoading: false,
            });
            throw error;
          }
        },

        // ==================== DELETE ACCOUNT ====================
        deleteAccount: async (password: string) => {
          set({ isLoading: true, error: null });

          try {
            await api.auth.deleteAccount(password);
            get().logout();
          } catch (error) {
            set({
              error: handleAuthError(error),
              isLoading: false,
            });
            throw error;
          }
        },

        // ==================== LOGOUT ====================
        logout: () => {
          try {
            api.auth.logout()
            clearStoredAuth();
          } catch (e) {
            throw e
          }
          set({
              token: null,
              refreshToken: null,
              user: null,
              isAuthenticated: false,
              registerResult: null,
            });
        },
        
        clearError: () => {
          set({ error: null });
        },

        setUser: (user: User) => {
          set({ user });
          localStorage.setItem(USER_KEY, JSON.stringify(user));
        },

        updateTokens: (accessToken: string, refreshToken: string) => {
          localStorage.setItem(auth_token, accessToken);
          localStorage.setItem(refresh_token, refreshToken);
          set({
            token: accessToken,
            refreshToken: refreshToken,
          });
        },
      }),
      {
        name: 'auth-storage', 
        partialize: (state) => ({ 
          user: state.user,
          token: state.token,
          refreshToken: state.refreshToken 
        }),
      }
    )
  )
);

if (typeof window !== 'undefined') {
  window.addEventListener('auth-error', () => {
    useAuthStore.getState().logout();
  });

  window.addEventListener('session-expired', () => {
    useAuthStore.getState().logout();
  });
}

export const selectUser = (state: AuthState) => state.user;
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
export const selectIsLoading = (state: AuthState) => state.isLoading;
export const selectError = (state: AuthState) => state.error;
export const selectIsInitialized = (state: AuthState) => state.isInitialized;
