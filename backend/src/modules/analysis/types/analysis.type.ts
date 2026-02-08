export interface Message {
  role: 'user' | 'model';
  parts: Array<{ text?: string; functionCall?: any; functionResponse?: any }>;
}

export interface AnalysisRequest {
  message: string;
  conversation_history?: Message[];
  user_id?: string;
}

export interface AnalysisResponse {
  response: string;
  conversation_history: Message[];
  tool_calls?: Array<{
    tool: string;
    input: any;
    result: any;
  }>;
}

export interface ToolExecutionResult {
  success: boolean;
  error?: string;
  [key: string]: any;
}

export interface TickerSearchParams {
  search_term: string;
  limit?: number;
}

export interface MarketDataParams {
  symbol: string;
  days?: number;
  interval?: string;
}

export interface VolumeSpikesParams {
  symbol?: string;
  days?: number;
  movement_type?: string;
  min_deviation?: number;
}

export interface SentimentAnalysisParams {
  symbol: string;
  source?: string;
  days?: number;
}

export interface SECFilingsParams {
  symbol: string;
  filing_type?: string;
  limit?: number;
}

export interface AlertsParams {
  symbol?: string;
  priority?: string;
  status?: string;
}

export interface CompareTickersParams {
  symbols: string[];
}

export interface CustomQueryParams {
  query: string;
  explanation: string;
}