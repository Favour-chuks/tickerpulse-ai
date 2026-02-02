
export enum View {
  DASHBOARD = 'DASHBOARD',
  WATCHLIST = 'WATCHLIST',
  NARRATIVES = 'NARRATIVES',
  CONTRADICTIONS = 'CONTRADICTIONS'
}

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Ticker {
  id: number;
  symbol: string;
  companyName: string;
  sector: string;
}

export interface VolumeSpike {
  id: number;
  tickerSymbol: string;
  detectedAt: string;
  volume: number;
  deviationMultiple: number;
  zScore: number;
  priceAtSpike: number;
  priceChangePercent: number;
  hypothesis?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  hasCatalyst: boolean;
}

export interface Narrative {
  id: number;
  tickerSymbol: string;
  filingType: string;
  filedAt: string;
  summary: string;
  toneShift: string;
  managementConfidence: number;
  keyChanges: string[];
}

export interface Contradiction {
  id: number;
  tickerSymbol: string;
  contradiction_type: string; // Matches DB schema
  explanation: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  quote_1: string;
  quote_2: string;
  news_headline?: string;
  market_trend_before?: string; // 'bullish', 'bearish', 'neutral'
  market_trend_after?: string;
  price_impact?: number;
  volume_impact?: number;
  gemini_confidence?: number;
  is_validated: boolean;
  validation_notes?: string;
  detected_at: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface QueueStats {
  status: string;
  timestamp: string;
  queues: Record<string, number>;
}

export interface Watchlist {
  id: string;
  name: string;
  created_at: string;
  items?: Ticker[];
}

export interface MarketData {
  time: string;
  close: number;
  volume: number;
  open?: number;
  high?: number;
  low?: number;
}

export interface PromiseRecord {
  id: number;
  promise_text: string;
  promise_date: string;
  status: 'kept' | 'broken' | 'pending';
  verification_notes?: string;
}

export interface Alert {
  id: string | number;
  symbol: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  alert_type: string;
  created_at: string;
}
