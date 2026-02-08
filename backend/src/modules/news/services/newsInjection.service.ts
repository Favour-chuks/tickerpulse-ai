import { finnhubClient } from '../../../shared/infra/services/finnhub.service.js';
import geminiService from '../../analysis/services/gemini.service.js';
import { supabaseAuthService } from '../../auth/services/supabaseAuth.service.js';

interface FinnhubNewsArticle {
  id: number;
  headline: string;
  source: string;
  url: string;
  image: string;
  summary: string;
  category: string;
  datetime: number;
  related: string;
  sentiment?: number;
  sentiment_label?: string;
}

interface GeminiAnalysisResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  key_themes: string[];
  polarity_score: number;
  impact_assessment: 'high' | 'medium' | 'low';
  company_implications: string[];
  market_context: string;
  potential_catalysts: string[];
}

interface AnalyzedArticle {
  article_id: number;
  ticker: string;
  headline: string;
  source: string;
  url: string;
  published_at: Date;
  raw_text: string;
  gemini_analysis: GeminiAnalysisResult;
  sentiment_score: number;
  confidence_score: number;
  is_material: boolean;
}

export class NewsInjectionService {
  constructor() {
    // Finnhub client is initialized in finnhub.service.ts
  }

  /**
   * Fetch news articles for a specific ticker from Finnhub
   */
  async fetchNewsForTicker(ticker: string, limit: number = 10): Promise<FinnhubNewsArticle[]> {
    try {
      const response = await finnhubClient.getLatestNews(ticker, limit);

      if (!response || !Array.isArray(response)) {
        throw new Error('Invalid response from Finnhub API');
      }

      return response;
    } catch (error) {
      throw new Error(
        `Failed to fetch news for ${ticker}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Analyze article with Gemini and return structured analysis
   */
  async analyzeArticleWithGemini(
    headline: string,
    summary: string,
    ticker: string
  ): Promise<GeminiAnalysisResult> {
    try {
      const analysisPrompt = `
      You are a financial analyst. Analyze this news article about ${ticker} and provide a structured JSON response with:
      - sentiment: 'positive', 'negative', or 'neutral'
      - confidence: 0-1 confidence score
      - key_themes: array of main topics mentioned
      - polarity_score: -1 to 1 (negative to positive)
      - impact_assessment: 'high', 'medium', or 'low' impact on stock
      - company_implications: array of how this affects the company
      - market_context: brief explanation of market implications
      - potential_catalysts: array of potential short/medium term impacts

      Article:
      Headline: ${headline}
      Summary: ${summary}

      Respond with valid JSON only, no markdown.
      `;

      // Use Gemini Flash for speed
      const response = await geminiService.analyzeText(analysisPrompt);

      // Parse the response as JSON
      const analysis = JSON.parse(response) as GeminiAnalysisResult;

      return analysis;
    } catch (error) {
      throw new Error(
        `Failed to analyze article with Gemini: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Inject analyzed article into social_mentions table
   */
  async injectArticleToDatabase(article: AnalyzedArticle): Promise<{ id: number; inserted_at: Date }> {
    try {
      const supabase = supabaseAuthService.getClient();

      const { data, error } = await supabase.from('social_mentions').insert({
        ticker_id: await this.getTickerId(article.ticker),
        source: 'finnhub_news',
        content: `${article.headline}\n${article.raw_text}`,
        sentiment_score: article.sentiment_score,
        created_at: article.published_at,
        
        // Gemini analysis metadata
        gemini_analyzed: true,
        gemini_analysis_id: null, // Will be set by trigger
        confidence_score: article.confidence_score,
        
        // Store full analysis as JSON
        metadata: {
          gemini_analysis: article.gemini_analysis,
          finnhub_article_id: article.article_id,
          is_material: article.is_material,
          url: article.url,
        },
      }).select('id, created_at');

      if (error) {
        throw new Error(`Database insert failed: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error('Insert successful but no data returned');
      }

      return {
        id: data[0]?.id,
        inserted_at: new Date(data[0]?.created_at),
      };
    } catch (error) {
      throw new Error(
        `Failed to inject article to database: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Complete news injection pipeline: fetch → analyze → inject
   */
  async processNewsForTicker(ticker: string): Promise<AnalyzedArticle[]> {
    try {
      const articles = await this.fetchNewsForTicker(ticker, 10);
      const analyzedArticles: AnalyzedArticle[] = [];

      for (const article of articles) {
        try {
          // Analyze with Gemini
          const analysis = await this.analyzeArticleWithGemini(
            article.headline,
            article.summary,
            ticker
          );

          // Calculate sentiment score from Gemini analysis
          const sentimentScore = analysis.polarity_score;
          const confidenceScore = analysis.confidence;

          // Determine if article is material (for divergence detection)
          const isMaterial = analysis.impact_assessment !== 'low';

          const analyzed: AnalyzedArticle = {
            article_id: article.id,
            ticker,
            headline: article.headline,
            source: article.source,
            url: article.url,
            published_at: new Date(article.datetime * 1000),
            raw_text: article.summary,
            gemini_analysis: analysis,
            sentiment_score: sentimentScore,
            confidence_score: confidenceScore,
            is_material: isMaterial,
          };

          // Inject to database
          const injected = await this.injectArticleToDatabase(analyzed);
          console.log(`✓ Injected article ${injected.id} for ${ticker}`);

          analyzedArticles.push(analyzed);
        } catch (articleError) {
          console.error(
            `Failed to process article ${article.headline}:`,
            articleError instanceof Error ? articleError.message : String(articleError)
          );
          // Continue with next article
          continue;
        }
      }

      return analyzedArticles;
    } catch (error) {
      throw new Error(
        `News injection pipeline failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Compare article sentiment against market trend
   */
  async validateAgainstMarketTrend(
    ticker: string,
    articleSentiment: number
  ): Promise<{ is_valid: boolean; divergence_score: number; market_trend: string }> {
    try {
      const supabase = supabaseAuthService.getClient();

      // Get recent market data and trend
      const { data: marketData, error } = await supabase
        .from('ticker_historical_snapshots')
        .select('trend, trend_strength, avg_sentiment_score')
        .eq('ticker_id', await this.getTickerId(ticker))
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .single();

      if (error || !marketData) {
        // No historical data, assume valid
        return {
          is_valid: true,
          divergence_score: 0,
          market_trend: 'unknown',
        };
      }

      // Calculate divergence: if article sentiment opposes market trend
      const trendScore = marketData.trend_strength || 0;
      const trendPolarity = marketData.trend?.includes('bullish') ? 1 : marketData.trend?.includes('bearish') ? -1 : 0;

      const divergenceScore = Math.abs(articleSentiment - (marketData.avg_sentiment_score || 0));
      const sentimentOpposition = articleSentiment * trendPolarity < 0 ? 1 : 0;

      // Article is valid if it aligns with or has high confidence despite opposition
      const isValid = sentimentOpposition === 0 || divergenceScore < 0.5;

      return {
        is_valid: isValid,
        divergence_score: divergenceScore,
        market_trend: marketData.trend || 'unknown',
      };
    } catch (error) {
      console.error(
        `Market trend validation failed: ${error instanceof Error ? error.message : String(error)}`
      );
      // Default to valid on error
      return {
        is_valid: true,
        divergence_score: 0,
        market_trend: 'unknown',
      };
    }
  }

  /**
   * Get or create ticker ID
   */
  private async getTickerId(ticker: string): Promise<number> {
    try {
      const supabase = supabaseAuthService.getClient();

      // Try to get existing ticker
      const { data: existing } = await supabase
        .from('tickers')
        .select('id')
        .eq('symbol', ticker)
        .single();

      if (existing) {
        return existing.id;
      }

      // Create new ticker
      const { data: newTicker, error } = await supabase
        .from('tickers')
        .insert({ symbol: ticker, company_name: ticker })
        .select('id')
        .single();

      if (error || !newTicker) {
        throw new Error(`Failed to get or create ticker: ${error?.message}`);
      }

      return newTicker.id;
    } catch (error) {
      throw new Error(
        `Ticker ID resolution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Bulk process news for multiple tickers
   */
  async processNewsForTickers(tickers: string[]): Promise<Record<string, AnalyzedArticle[]>> {
    const results: Record<string, AnalyzedArticle[]> = {};

    for (const ticker of tickers) {
      try {
        results[ticker] = await this.processNewsForTicker(ticker);
      } catch (error) {
        console.error(`Failed to process news for ${ticker}:`, error);
        results[ticker] = [];
      }
    }

    return results;
  }
}

export const newsInjectionService = new NewsInjectionService();
