// Core domain types for SignalHub

// ============================================================================
// USERS AND AUTHENTICATION
// ============================================================================

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  isActive: boolean;
}

export interface AuthPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

// ============================================================================
// WATCHLIST
// ============================================================================

export interface Watchlist {
  id: number;
  userId: string;
  ticker: string;
  addedAt: Date;
  alertPreferences: AlertPreferences;
}

export interface AlertPreferences {
  divergence: boolean;
  filing: boolean;
  contradiction: boolean;
  social: boolean;
  severityFilter: 'low' | 'medium' | 'high' | 'critical';
}

// ============================================================================
// MARKET DATA
// ============================================================================

export interface MarketData {
  time: Date;
  ticker: string;
  price: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  close: number;
  previousClose: number;
}

export interface VolumeSpikeEvent {
  id: number;
  ticker: string;
  detectedAt: Date;
  volume: number;
  avgVolume: number;
  deviationMultiple: number;
  zScore: number;
  hasCatalyst: boolean;
  processed: boolean;
  createdAt: Date;
}

// ============================================================================
// SEC FILINGS
// ============================================================================

export type FilingType = '10-K' | '10-Q' | '8-K' | 'DEF 14A' | 'S-1';

export interface SECFiling {
  id: number;
  ticker: string;
  filingType: FilingType;
  accessionNumber: string;
  filedAt: Date;
  url: string;
  rawContent?: string;
  isMaterial?: boolean;
  processed: boolean;
  processingError?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// NARRATIVES
// ============================================================================

export interface KeyChange {
  category: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface RiskChange {
  riskFactor: string;
  status: 'new' | 'removed' | 'updated';
  description: string;
}

export interface Guidance {
  metric: string;
  previousValue?: string;
  currentValue?: string;
  changes?: string;
}

export interface LanguageShift {
  phrase: string;
  before: string;
  after: string;
  significance: string;
}

export interface CompanyNarrative {
  id: number;
  filingId: number;
  ticker: string;
  summary: string;
  keyChanges: KeyChange[];
  riskChanges: RiskChange[];
  toneShift?: string;
  guidance: Guidance[];
  managementConfidenceScore?: number;
  languageShifts?: LanguageShift[];
  embedding?: number[];
  createdAt: Date;
}

// ============================================================================
// PROMISES AND COMMITMENTS
// ============================================================================

export type PromiseStatus = 'kept' | 'broken' | 'pending' | 'partially_met';

export interface CompanyPromise {
  id: number;
  ticker: string;
  promiseText: string;
  promiseContext?: Record<string, any>;
  filingId?: number;
  promiseDate: Date;
  expectedFulfillmentDate?: Date;
  status: PromiseStatus;
  verificationNotes?: string;
  verificationFilingId?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// CONTRADICTIONS
// ============================================================================

export type ContradictionType =
  | 'guidance_miss'
  | 'strategy_change'
  | 'risk_reversal'
  | 'broken_promise';

export type ContradictionSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface NarrativeContradiction {
  id: number;
  ticker: string;
  narrative1Id: number;
  narrative2Id: number;
  contradictionType: ContradictionType;
  explanation: string;
  severity: ContradictionSeverity;
  quote1?: string;
  quote2?: string;
  detectedAt: Date;
}

// ============================================================================
// SOCIAL MENTIONS
// ============================================================================

export type SocialSource = 'news' | 'reddit' | 'twitter' | 'stocktwits';
export type Sentiment = 'positive' | 'negative' | 'neutral';

export interface SocialMention {
  id: number;
  ticker: string;
  source: SocialSource;
  sourceId?: string;
  text: string;
  url?: string;
  sentiment: Sentiment;
  sentimentScore: number; // -1 to 1
  author?: string;
  authorFollowers?: number;
  publishedAt: Date;
  engagementScore?: number;
  processed: boolean;
  createdAt: Date;
}

// ============================================================================
// DIVERGENCE ALERTS
// ============================================================================

export type AlertType =
  | 'divergence_detected'
  | 'filing_contradiction'
  | 'promise_broken'
  | 'social_surge';

export type AlertStatus = 'active' | 'resolved' | 'dismissed' | 'investigating';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface DivergenceAlert {
  id: number;
  ticker: string;
  spikeId: number;
  severity: AlertSeverity;
  alertType: AlertType;
  hypothesis: string;
  supportingEvidence?: Record<string, any>;
  watchFor?: string[];
  status: AlertStatus;
  createdAt: Date;
  resolvedAt?: Date;
  resolutionReason?: string;
}

// ============================================================================
// USER ALERTS
// ============================================================================

export interface UserAlert {
  id: number;
  userId: string;
  alertId: number;
  read: boolean;
  dismissed: boolean;
  readAt?: Date;
  dismissedAt?: Date;
  createdAt: Date;
}

// ============================================================================
// AUDIT LOG
// ============================================================================

export type AuditAction =
  | 'filing_processed'
  | 'alert_created'
  | 'alert_dismissed'
  | 'contradiction_detected'
  | 'promise_verified';

export interface AuditLogEntry {
  id: number;
  action: AuditAction;
  entityType: string;
  entityId?: number;
  userId?: string;
  details?: Record<string, any>;
  createdAt: Date;
}

// ============================================================================
// PROCESSING QUEUE
// ============================================================================

export type JobType = 'analyze_filing' | 'detect_volume_spike' | 'check_contradictions';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ProcessingQueueJob {
  id: number;
  jobType: JobType;
  ticker?: string;
  filingId?: number;
  status: JobStatus;
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================================
// WEBSOCKET EVENTS
// ============================================================================

export interface WebSocketMessage<T = any> {
  type: string;
  data: T;
  timestamp: Date;
}

export interface DivergenceAlertWSMessage extends WebSocketMessage {
  type: 'DIVERGENCE_ALERT';
  data: {
    ticker: string;
    severity: AlertSeverity;
    spikeMagnitude: number;
    analysis: string;
    timestamp: Date;
  };
}

export interface NewFilingWSMessage extends WebSocketMessage {
  type: 'NEW_FILING';
  data: {
    ticker: string;
    filingType: FilingType;
    narrativeSummary: string;
    keyChanges: KeyChange[];
    timestamp: Date;
  };
}

export interface ContradictionWSMessage extends WebSocketMessage {
  type: 'CONTRADICTION_DETECTED';
  data: {
    ticker: string;
    contradictionType: ContradictionType;
    severity: ContradictionSeverity;
    details: string;
    timestamp: Date;
  };
}

export type WSMessage =
  | DivergenceAlertWSMessage
  | NewFilingWSMessage
  | ContradictionWSMessage;

// ============================================================================
// GEMINI AI TYPES
// ============================================================================

export interface GeminiTicker{
    symbol: string,
    company_name: string,
    exchange: string,
    sector: string,
}

export interface GeminiFilingAnalysis {
  summary: string;
  confidenceScore: number;
  tone: 'bullish' | 'bearish' | 'neutral' | 'cautious';
  keyChanges: KeyChange[];
  languageShifts: Record<string, any>;
  contradictions: string[];
  redFlags: string[];
  watchFor: string[];
}

export interface GeminiContradictionResult {
  contradictions: Array<{
    severity: ContradictionSeverity;
    type: ContradictionType;
    oldStatement: string;
    newStatement: string;
    explanation: string;
  }>;
}

export interface GeminiDivergenceHypothesis {
  hypotheses: Array<{
    rank: number;
    explanation: string;
    evidence: string[];
    watchFor: string[];
    timeline: string;
  }>;
  traderActionItems: string[];
  riskAssessment: {
    insiderTradingProbability: 'LOW' | 'MEDIUM' | 'HIGH';
    recommendedPosition: 'BUY' | 'SELL' | 'HOLD' | 'WAIT';
  };
}
