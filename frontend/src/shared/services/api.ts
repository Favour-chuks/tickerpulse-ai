import { 
  Ticker, 
  MarketData, 
  Narrative, 
  PromiseRecord, 
  Contradiction, 
  Alert, 
  Watchlist, 
  Message, 
  User, 
  VolumeSpike, 
  WatchlistItem
} from '../types';
import { SyncService } from './syncService';

import {
  isDemoUser,
  authDemoData,
  watchlistDemoData,
  getDemoAlerts,
  getRandomDemoAlert,
  getDemoNarrativeTimeline,
  getDemoLatestNarrative,
  getDemoPromises,
  getDemoContradictions,
  getDemoComparison,
  DEMO_Data
} from './demoData';
import { chatWithAura } from './geminiService';

const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:5000/api/v1';

// ==================== ERROR CLASSES ====================
export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// ==================== TYPES ====================
interface AuthError {
  message: string;
  status: number | string;
  code?: string;
}

interface RefreshResponse {
  message: string;
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    expires_at: number;
  } | null;
}

interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
}

interface AuthResponse {
  session: AuthSession;
  user: User;
}

// ==================== CONSTANTS ====================
const PUBLIC_ROUTES = ['/auth/login', '/auth/register', '/auth/verify'];
const auth_token = 'auth_token';
const refresh_token = 'refresh_token';
const user = 'auth_user';

// ==================== TOKEN MANAGEMENT ====================
let refreshingPromise: Promise<string | null> | null = null;

class TokenManager {
  static getToken(): string | null {
    return localStorage.getItem(auth_token);
  }

  static getRefreshToken(): string | null {
    return localStorage.getItem(refresh_token);
  }

  static setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(auth_token, accessToken);
    localStorage.setItem(refresh_token, refreshToken);
  }

  static clearTokens(): void {
    localStorage.removeItem(auth_token);
    localStorage.removeItem(refresh_token);
    localStorage.removeItem(user);
  }

  static isValidToken(token: string | null): boolean {
    return !!token && token !== 'undefined' && token !== 'null';
  }
}

// ==================== AUTH EVENT DISPATCHER ====================
class AuthEventDispatcher {
  static dispatchAuthError(): void {
    window.dispatchEvent(new Event('auth-error'));
  }

  static dispatchSessionExpired(): void {
    window.dispatchEvent(new Event('session-expired'));
  }
}

// ==================== TOKEN REFRESH ====================
async function handleTokenRefresh(refreshToken: string): Promise<string | null> {
  // Prevent multiple simultaneous refresh calls
  if (refreshingPromise) {
    return refreshingPromise;
  }

  refreshingPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.status === 401 || response.status === 403) {
        TokenManager.clearTokens();
        window.location.href = '/login';
        return null;
      }

      if (!response.ok) throw new Error('Network or Server Error');
      
      const data: RefreshResponse = await response.json();

      if (!data.session) {
        throw new Error('No session in refresh response');
      }

      const { access_token, refresh_token } = data.session;

      TokenManager.setTokens(access_token, refresh_token);

      return access_token;
    } catch (err) {
      return null;
    } finally {
      refreshingPromise = null;
    }
  })();

  return refreshingPromise;
}

function performLogout(): void {
  TokenManager.clearTokens();
  AuthEventDispatcher.dispatchAuthError();
}

// ==================== HTTP CLIENT ====================
async function fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<any> {
  // Check network connectivity
  if (!navigator.onLine) {
    const method = options.method?.toUpperCase();
    if (method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      SyncService.queueRequest(endpoint, options);
    }
    throw new ApiError(0, 'No internet connection', 'OFFLINE');
  }

  const token = TokenManager.getToken();
  const refreshToken = TokenManager.getRefreshToken();
  const isPublicRoute = PUBLIC_ROUTES.some(
    route => endpoint === route || endpoint.endsWith(route)
  );

  // Check authentication for protected routes
  if (!isPublicRoute && !TokenManager.isValidToken(token)) {
    AuthEventDispatcher.dispatchAuthError();
    throw new ApiError(401, 'Missing or invalid authentication token', 'UNAUTHORIZED_MISSING_TOKEN');
  }

  // Build headers
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Add auth header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    let response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401 && !isPublicRoute && refreshToken) {
      console.warn(`[Auth] Token expired for ${endpoint}, attempting refresh...`);

      const newToken = await handleTokenRefresh(refreshToken);

      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        response = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          headers,
        });
      } else {
        performLogout();
        AuthEventDispatcher.dispatchSessionExpired();
        throw new ApiError(401, 'Session expired', 'SESSION_EXPIRED');
      }
    }

    // Handle non-OK responses
    if (!response.ok) {
      await handleErrorResponse(response);
    }

    // Parse and return JSON
    return await response.json();

  } catch (error: any) {
    // Handle network errors
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new ApiError(0, 'Network request failed', 'NETWORK_ERROR');
    }
    throw error;
  }
}

async function handleErrorResponse(response: Response): Promise<never> {
  let errorMessage = 'Request failed';
  let errorCode = 'UNKNOWN_ERROR';

  try {
    const errorData = await response.json();
    errorMessage = errorData.error?.message || errorData.message || errorMessage;
    errorCode = errorData.error?.code || errorData.code || errorCode;
  } catch {
    // If JSON parsing fails, use text
    const textError = await response.text();
    errorMessage = textError || `HTTP ${response.status}: ${response.statusText}`;
  }

  throw new ApiError(response.status, errorMessage, errorCode);
}

// ==================== API INTERFACE ====================
export const api = {
  // ==================== AUTH ====================
  auth: {
    login: async (email: string, password: string): Promise<AuthResponse> => {
      try {
        return await fetchWithAuth('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
      } catch (e: any) {
        if (email === 'admin@admin.com') {
          const session = authDemoData.demoLogin.session;
          const user = DEMO_Data.user
          return {session, user}
        }
        throw e;
      }
    },

    register: async (
      email: string,
      password: string,
      firstName: string,
      lastName: string
    ): Promise<AuthResponse> => {
      try {
        return await fetchWithAuth('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ email, password, firstName, lastName }),
        });
      } catch (e: any) {
        throw e;
      }
    },

    getGoogleUrl: async (): Promise<{ url: string }> => {
      return fetchWithAuth('/auth/google', { method: 'GET' });
    },

    getUserProfile: async (id: string): Promise<User | null> => {
      try {
        return await fetchWithAuth(`/users/${id}`);
      } catch (e) {
        if(isDemoUser()) return DEMO_Data.user;
        throw e;
      }
    },

    updateProfile: async (
      data: Partial<User> & { 
        password?: string; 
        avatarUrl?: string; 
        currentPassword?: string;
      }
    ): Promise<User> => {
      try {
        return await fetchWithAuth('/users/me', {
          method: 'PUT',
          body: JSON.stringify(data),
        });
      } catch (e: any) {
        if(isDemoUser()) throw Error(authDemoData.errorMessage);
        throw e;
      }
    },

    resetPassword: async (email: string): Promise<{ success: boolean }> => {
      try {
        return await fetchWithAuth('/users/me/password', {
          method: 'PUT',
          body: JSON.stringify({ email }),
        });
      } catch (e: any) {
        if(isDemoUser()){
          throw new Error(authDemoData.errorMessage)
        }
        throw e;
      }
    },

    deleteAccount: async (password: string): Promise<{ success: boolean }> => {
      try {
        return await fetchWithAuth('/users/me', {
          method: 'DELETE',
          body: JSON.stringify({ password }),
        });
      } catch (e: any) {
        if(isDemoUser()){
          throw new Error(authDemoData.errorMessage)
        }
        throw e;
      }
    },
 

    logout: async (): Promise<void> => {
      try {
        await fetchWithAuth('/auth/logout', { method: 'POST' });
      } catch (e) {
        throw e
      }
      TokenManager.clearTokens();
    },

    refreshToken: async (refreshToken: string): Promise<RefreshResponse> => {
      try {
        return fetchWithAuth('/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      } catch (e) {
        throw e;
      }
    },
  },

  // ==================== WATCHLIST ====================
  watchlist: {
    getAll: async (): Promise<{ count: number; watchlists: Watchlist[] }> => {
      try {
        return await fetchWithAuth('/watchlist');
      } catch (e) {
        if(isDemoUser()){
          const watchlists = DEMO_Data.watchlists as Watchlist[];
          return { count: watchlists.length, watchlists };
        }
        throw e;
      }
    },

    getById: async (id: string): Promise<Watchlist> => {
      try {
        return await fetchWithAuth(`/watchlist/${id}`);
      } catch (e) {
        if(isDemoUser()){
          const wl = ((DEMO_Data.watchlists as any) as Watchlist[]).find(w => String(w.id) === String(id));
          if (!wl) throw new ApiError(404, 'Watchlist not found', 'NOT_FOUND');
          return wl;
        }
        throw e
      }
    },

    create: async (name: string): Promise<Watchlist> => {
      try {
        return await fetchWithAuth('/watchlist', {
          method: 'POST',
          body: JSON.stringify({ name }),
        });
      } catch (e) {
        if(isDemoUser()){
          const newWl: Watchlist = {
            id: `offline-${Date.now()}`,
            name: name.trim(),
            created_at: new Date().toISOString(),
            items: [],
          };
          ((DEMO_Data.watchlists as any) as Watchlist[]).push(newWl);
          return newWl;
        }
        throw e;
      }
    },

    update: async (id: string, name: string): Promise<Watchlist> => {
      try {
        return await fetchWithAuth(`/watchlist/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name }),
        });
      } catch (e) {
        if(isDemoUser()){
          const wl = ((DEMO_Data.watchlists as any) as Watchlist[]).find(w => String(w.id) === String(id));
          if (wl) {
            wl.name = name;
            return wl;
          }
        }
        throw new ApiError(404, 'Watchlist not found', 'NOT_FOUND');
      }
    },

    delete: async (id: string): Promise<{ success: boolean }> => {
      try {
        return await fetchWithAuth(`/watchlist/${id}`, {
          method: 'DELETE',
        });
      } catch (e) {
        if(isDemoUser()){
          const index = ((DEMO_Data.watchlists as any) as Watchlist[]).findIndex(w => String(w.id) === String(id));
          if (index > -1) {
            ((DEMO_Data.watchlists as any) as Watchlist[]).splice(index, 1);
          }
          return { success: true };
        }
        throw new ApiError(e.status, e.message, e.code)
      }
    },

    getItems: async (id: string): Promise<{ tickers: WatchlistItem[] }> => {
      try {
        const response =  await fetchWithAuth(`/watchlist/${id}/items`);

        if (!response || !response.items) {
          throw new Error("Invalid response structure from server");
        }

        return {
          tickers: response.items.map((item: any) => ({
            ...item,
            ticker: {
              ...item.ticker,
              price: item.ticker?.price ?? 0,
              change_percent: item.ticker?.change_percent ?? 0,
            }
          }))
        };
      } catch (e) {
        if(isDemoUser()) {
          const wl = DEMO_Data.watchlists.find(w => String(w.id) === String(id));
          return { 
            tickers: (wl?.items || []) as WatchlistItem[] 
          };
        }
        throw e;
      }
    },

    addItem: async (watchlistId: string, symbol: string): Promise<any> => {
      try {
        return await fetchWithAuth(`/watchlist/${watchlistId}/items`, {
          method: 'POST',
          body: JSON.stringify({ symbol }),
        });
      } catch (e) {
        if(isDemoUser()){
          const wl = DEMO_Data.watchlists.find(w => String(w.id) === String(watchlistId));
          if (wl) {
            if (!wl.items) wl.items = [];
            if (!wl.items.find(i => i.ticker?.symbol === symbol)) {
              wl.items.push({
                id: Date.now().toString(),
                ticker: {
                  id: Date.now(),
                  symbol,
                  companyName: `${symbol} Corp (Mock)`,
                  sector: 'Technology',
                },
                settings: {
                  news_alerts: true,
                  min_severity: 'low',
                  divergence_alerts: true,
                  contradiction_alerts: true,
                },
              });
            }
          }
          return { success: true };
        }
        throw e;
      }
    },

    removeItem: async (watchlistId: string, symbol: string): Promise<{ success: boolean }> => {
      try {
        return await fetchWithAuth(`/watchlist/${watchlistId}/items/${symbol}`, {
          method: 'DELETE',
        });
      } catch (e) {
        if(isDemoUser()){
          const wl = DEMO_Data.watchlists.find(w => String(w.id) === String(watchlistId));
          if (wl && wl.items) {
            wl.items = wl.items.filter(i => i.ticker?.symbol !== symbol);
          }
          return { success: true };
        }
        throw e;
      }
    },

    updateItemSettings: async (
      watchlistId: string,
      symbol: string,
      settings: any
    ): Promise<any> => {
      try {
        return await fetchWithAuth(`/watchlist/${watchlistId}/items/${symbol}`, {
          method: 'PUT',
          body: JSON.stringify({ alert_settings: settings }),
        });
      } catch (e) {
        if(isDemoUser()){
          return { success: true };
        }
        throw e;
      }
    },
  },

  // ==================== ANALYSE ====================
  analyse: {
    sendMessage: async (
      message: string,
      history: Message[] = []
    ): Promise<{ response: string }> => {
      try {
        return await fetchWithAuth('/analyse', {
          method: 'POST',
          body: JSON.stringify({
            message,
            conversation_history: history,
          }),
        });
      } catch (e: any) {
        if(isDemoUser()){
          const response = await chatWithAura(message);
          return {response}
        }
        if (e.code === 'NETWORK_ERROR' || e.code === 'OFFLINE') {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return {
            response:
              "I'm currently operating in offline mode. I can't access real-time market data or the neural engine right now.",
          };
        }
        throw e;
      }
    },
  },

  // ==================== ALERTS ====================
  alerts: {
    getRecent: async (): Promise<Alert[]> => {
      try {
        const res = await fetchWithAuth('/alerts?limit=20');
        return res.alerts || [];
      } catch (e) {
        if(isDemoUser()){
          return getDemoAlerts();
        }
        throw e
      }
    },

    triggerDemoSignal: async (): Promise<Alert> => {
      await new Promise(resolve => setTimeout(resolve, 450));
      return getRandomDemoAlert();
    },

    dismiss: async (id: string): Promise<boolean> => {
      try {
        await fetchWithAuth(`/alerts/${id}/dismiss`, { method: 'PUT' });
        return true;
      } catch {
        return true;
      }
    },
  },

  // ==================== MARKET ====================
  market: {
    getData: async (symbol: string, timeframe: string): Promise<MarketData[]> => {
      try {
        const res = await fetchWithAuth(`/tickers/${symbol}/market-data?timeframe=${timeframe}`);
        return res.market_data || watchlistDemoData.getMockMarketData();
      } catch(e) {
        if(isDemoUser()){
          return watchlistDemoData.getMockMarketData()
        }
        throw e;
      }
    },

    getSpikes: async (): Promise<VolumeSpike[]> => {
      try {
        const res = await fetchWithAuth(`/market/volume-spikes`);
        return res.spikes || [];
      } catch (e) {
        if(isDemoUser()){
          return DEMO_Data.volumeSpikes as VolumeSpike[]
        }
        throw e
      }
    },

    search: async (query: string): Promise<Ticker[]> => {
      try {
        const res = await fetchWithAuth(`/tickers/search?search_term=${encodeURIComponent(query)}`);
        return res.tickers || [];
      } catch (e) {
        if(isDemoUser()){
          return DEMO_Data.tickers.filter(t => t.symbol.toLowerCase().includes(query.toLowerCase()));
        }
        throw e;
      }
    },

    requestTicker: async (symbol: string): Promise<{ success: boolean; message: string }> => {
      return new Promise(resolve =>
        setTimeout(() => resolve({ success: true, message: 'Request submitted' }), 500)
      );
    },
  },

  // ==================== NARRATIVES ====================
  narratives: {
    getTimeline: async (symbol: string): Promise<Narrative[]> => {
      try {
        const res = await fetchWithAuth(`/narratives/${symbol}/timeline`);
        const timeline = res.timeline || [];
        
        if (timeline.length === 0 && isDemoUser()) throw new Error("Demo fallback");

        return timeline.map((item: any, index: number) => ({
          id: index,
          tickerSymbol: symbol,
          filingType: item.filing_type,
          filedAt: item.date,
          summary: item.summary,
          toneShift: item.tone,
          managementConfidence: item.confidence,
          keyChanges: item.key_changes || [],
        }));
      } catch (e) {
        if (isDemoUser()) {
          return getDemoNarrativeTimeline(symbol);
        }
        throw e;
      }
    },

    getLatest: async (symbol: string): Promise<Narrative> => {
      try {
        const res = await fetchWithAuth(`/narratives/${symbol}/latest`);
        return {
          id: res.id,
          tickerSymbol: res.ticker || symbol,
          filingType: res.sec_filings?.filing_type || res.filing_type,
          filedAt: res.sec_filings?.filed_at || res.created_at,
          summary: res.summary,
          toneShift: res.tone_shift,
          managementConfidence: res.management_confidence,
          keyChanges: res.key_changes || [],
        };
      } catch (e) {
        if (isDemoUser()) {
          return getDemoLatestNarrative(symbol);
        }
        throw e;
      }
    },

    getPromises: async (symbol: string): Promise<PromiseRecord[]> => {
      try {
        const res = await fetchWithAuth(`/narratives/${symbol}/promises`);
        const list = res.promises || [];

        if (list.length === 0) {
          throw new Error("Promises not found");
        }

        return list.map((p: any) => ({
          id: p.id,
          promise_text: p.text || p.promise_text,
          promise_date: p.date || p.promise_date,
          status: p.status,
          verification_notes: p.notes || p.verification_notes,
        }));

      } catch (error) {
        if (isDemoUser()) {
          return getDemoPromises(symbol);
        }
        return [];
      }
    },

    getContradictions: async (symbol: string): Promise<Contradiction[]> => {
      try {
        const res = await fetchWithAuth(`/narratives/${symbol}/contradictions`);
        const list = res.contradictions || [];

        return list.map((c: any) => ({
          id: c.id,
          tickerSymbol: symbol,
          contradiction_type: c.type,
          explanation: c.explanation,
          severity: c.severity,
          quote_1: c.earlier_statement?.summary || 'Legacy narrative...',
          quote_2: c.later_statement?.summary || 'New narrative...',
          detected_at: c.detected_at,
          market_trend_before: 'neutral',
          market_trend_after: 'volatile',
          is_validated: false,
        }));
      } catch(e) {
        if(isDemoUser()){
          return getDemoContradictions(symbol) as Contradiction[];
        }
        return [];
      }
    },

    compare: async (symbol: string, id1: string, id2: string): Promise<any> => {
      try {
        return await fetchWithAuth(`/narratives/${symbol}/compare?id1=${id1}&id2=${id2}`);
      } catch (e) {
        if (isDemoUser()) {
          return getDemoComparison(symbol, id1, id2);
        }
        throw e;
      }
    },
  },

  // ==================== SYSTEM ====================
  system: {
    health: async (): Promise<any> => {
      const healthUrl = API_BASE_URL.replace('/api/v1', '') + '/health';
      const response = await fetch(healthUrl);
      return response.json();
    },
  },
};