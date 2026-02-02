
import { create } from 'zustand';
import { User } from '../types';
import { api } from '@/src/shared/services/api';
import { supabase } from '@/src/shared/services/supabase';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  initialize: () => {
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('auth_user');
    if (token && userStr) {
      set({ 
        token, 
        user: JSON.parse(userStr), 
        isAuthenticated: true 
      });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    
    // if (email === 'admin@admin.com' && password === 'admin') {
    //   const mockUser: User = api.auth.getUserProfile()
      
    //   const mockToken = authDemoData.demoLogin.session.access_token;
    //   await new Promise(resolve => setTimeout(resolve, 800));
      
    //   localStorage.setItem('auth_token', mockToken);
    //   localStorage.setItem('auth_user', JSON.stringify(mockUser));
      
    //   set({ 
    //     token: mockToken, 
    //     user: mockUser, 
    //     isAuthenticated: true, 
    //     isLoading: false 
    //   });
    //   return;
    // }

    try {
      const response = await api.auth.login(email, password);
      localStorage.setItem('auth_token', response.session.access_token);
      localStorage.setItem('auth_user', JSON.stringify(response.user));
      set({ 
        token: response.session.access_token, 
        user: response.user, 
        isAuthenticated: true, 
        isLoading: false 
      });
    } catch (error: any) {
      set({ 
        error: error.message || 'Login failed', 
        isLoading: false 
      });
      throw error;
    }
  },

  loginWithGoogle: async () => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'http://localhost:5000/api/v1/auth/callback' 
        }
      });
      
      if (error) throw error;
      // Note: The actual state update happens after redirect and callback processing
    } catch (error: any) {
      set({ 
        error: error.message || 'Google sign in failed', 
        isLoading: false 
      });
    }
  },

  register: async (email, password, firstName, lastName) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.auth.register(email, password, firstName, lastName);
      localStorage.setItem('auth_token', response.session.access_token);
      localStorage.setItem('auth_user', JSON.stringify(response.user));
      set({ 
        token: response.session.access_token, 
        user: response.user, 
        isAuthenticated: true, 
        isLoading: false 
      });
    } catch (error: any) {
      set({ 
        error: error.message || 'Registration failed', 
        isLoading: false 
      });
      throw error;
    }
  },

  resetPassword: async (email) => {
    set({ isLoading: true, error: null });
    try {
      await api.auth.resetPassword(email);
      set({ isLoading: false });
    } catch (error: any) {
      set({ 
        error: error.message || 'Reset request failed', 
        isLoading: false 
      });
      throw error;
    }
  },

  logout: () => {
    api.auth.logout();
    localStorage.removeItem('auth_user');
    set({ 
      token: null, 
      user: null, 
      isAuthenticated: false 
    });
  },
}));
