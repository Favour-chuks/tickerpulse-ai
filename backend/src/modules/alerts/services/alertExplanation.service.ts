import { GoogleGenAI } from '@google/genai';
import { envConfig } from '../../../config/environmentalVariables.js';
import { logger } from '../../../config/logger.js';
import redisCacheService, {
  CACHE_KEYS,
  CACHE_TTL,
} from '../../../shared/infra/services/cache.service.js';
import type { DivergenceAlert } from '../../../shared/types/domain.js';

interface ExplanationRequest {
  alert: DivergenceAlert;
  context: {
    recentNews?: string[];
    filingInfo?: string;
    priceHistory?: number[];
    volumeHistory?: number[];
    socialSentiment?: string;
  };
}

interface GeneratedExplanation {
  summary: string;
  keyPoints: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
  furtherInvestigation: string[];
}

class AlertExplanationService {
  private static instance: AlertExplanationService;
  private genAI: GoogleGenAI;

  private constructor() {
    this.genAI = new GoogleGenAI({
      apiKey: envConfig.gemini_api_key2 || envConfig.gemini_api_key,
    });
  }

  static getInstance(): AlertExplanationService {
    if (!AlertExplanationService.instance) {
      AlertExplanationService.instance = new AlertExplanationService();
    }
    return AlertExplanationService.instance;
  }

  /**
   * Generate human-readable explanation for an alert
   */
  async generateExplanation(request: ExplanationRequest): Promise<GeneratedExplanation> {
    try {
      const { alert, context } = request;

      // Check cache first
      const cacheKey = `explanation:${alert.id}`;
      const cached = await redisCacheService.get<GeneratedExplanation>(cacheKey);
      if (cached) {
        logger.info({ msg: 'Explanation found in cache', alertId: alert.id });
        return cached;
      }

      // Build context string for Gemini
      const contextString = this.buildContextString(alert, context);

      // Call Gemini Flash for explanation (lightweight task)
      const prompt = `
You are a financial analyst assistant. Generate a clear, non-technical explanation for a stock market alert.

ALERT DETAILS:
- Ticker: ${alert.ticker}
- Type: ${alert.alertType}
- Severity: ${alert.severity}
- Hypothesis: ${alert.hypothesis}

MARKET CONTEXT:
${contextString}

Generate a JSON response with the following structure (no markdown, pure JSON):
{
  "summary": "One-sentence summary of what happened",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "riskLevel": "low|medium|high|critical",
  "recommendation": "What the investor should consider doing",
  "furtherInvestigation": ["investigation 1", "investigation 2"]
}

Make it accessible to retail investors. Be specific and actionable.
`;

      const model = this.genAI.chats.create({
        model: 'gemini-3-flash', // Using Flash for speed and cost
        config: {
          temperature: 0.3, // Low temperature for consistency
        },
      });

      const response = await model.sendMessage({ message: prompt });
      const responseText = response.text || '';

      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse Gemini response');
      }

      const explanation: GeneratedExplanation = JSON.parse(jsonMatch[0]);

      // Cache the result
      await redisCacheService.set(
        cacheKey,
        explanation,
        CACHE_TTL.ALERT_STATISTICS
      );

      logger.info({
        msg: 'Alert explanation generated',
        alertId: alert.id,
        ticker: alert.ticker,
      });

      return explanation;
    } catch (error) {
      logger.error({
        msg: 'Error generating explanation',
        error,
        alertId: request.alert.id,
      });

      // Return fallback explanation
      return this.generateFallbackExplanation(request.alert);
    }
  }

  /**
   * Generate batch explanations for multiple alerts
   */
  async generateBatchExplanations(
    requests: ExplanationRequest[]
  ): Promise<Map<number, GeneratedExplanation>> {
    const results = new Map<number, GeneratedExplanation>();

    // Process in parallel with rate limiting
    const batchSize = 5;
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);

      const batchPromises = batch.map((req) =>
        this.generateExplanation(req)
          .then((explanation) => ({ id: req.alert.id, explanation }))
          .catch((error) => {
            logger.error({ msg: 'Error in batch', error });
            return {
              id: req.alert.id,
              explanation: this.generateFallbackExplanation(req.alert),
            };
          })
      );

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ id, explanation }) => {
        results.set(id, explanation);
      });

      // Rate limiting delay
      if (i + batchSize < requests.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Build context string from alert data
   */
  private buildContextString(alert: DivergenceAlert, context: ExplanationRequest['context']): string {
    const parts: string[] = [];

    if (alert.supportingEvidence) {
      const ev = alert.supportingEvidence as any;
      if (ev.volume) parts.push(`- Volume spike: ${ev.volume}x normal`);
      if (ev.priceChange) parts.push(`- Price movement: ${ev.priceChange}%`);
      if (ev.zScore) parts.push(`- Z-score: ${ev.zScore}`);
    }

    if (context.recentNews && context.recentNews.length > 0) {
      parts.push(`- Recent news: ${context.recentNews.slice(0, 2).join('; ')}`);
    } else {
      parts.push('- No recent news found (divergence signal)');
    }

    if (context.filingInfo) {
      parts.push(`- Recent filing: ${context.filingInfo}`);
    }

    if (context.socialSentiment) {
      parts.push(`- Social sentiment: ${context.socialSentiment}`);
    }

    if (context.priceHistory && context.priceHistory.length > 0) {
      const avgPrice = context.priceHistory.reduce((a, b) => a + b) / context.priceHistory.length;
      const currentPrice = context.priceHistory[context.priceHistory.length - 1] || avgPrice;
      const change = ((currentPrice - avgPrice) / avgPrice) * 100;
      parts.push(`- Price trend: ${change > 0 ? '+' : ''}${change.toFixed(2)}% vs recent average`);
    }

    return parts.join('\n');
  }

  /**
   * Generate fallback explanation when Gemini is unavailable
   */
  private generateFallbackExplanation(alert: DivergenceAlert): GeneratedExplanation {
    const severityRecommendation: Record<string, string> = {
      low: 'Monitor the situation. No immediate action needed.',
      medium: 'Review company news and fundamentals. Consider setting stop loss.',
      high: 'Investigate further before trading. Review recent filings.',
      critical: 'Exercise caution. This requires immediate investigation.',
    };

    const keyPoints = this.generateKeyPoints(alert);

    return {
      summary: `${alert.alertType.replace(/_/g, ' ')} detected on ${alert.ticker} with ${alert.severity} severity.`,
      keyPoints,
      riskLevel: alert.severity as any,
      recommendation: severityRecommendation[alert.severity] || 'Conduct further analysis.',
      furtherInvestigation: [
        'Check recent SEC filings and 8-K reports',
        'Review institutional ownership changes',
        'Monitor insider trading activity',
      ],
    };
  }

  /**
   * Generate key points from alert
   */
  private generateKeyPoints(alert: DivergenceAlert): string[] {
    const points: string[] = [];

    if (alert.alertType === 'divergence_detected') {
      points.push('Volume spike detected without corresponding news catalyst');
      points.push('Market movement appears disconnected from public information');
    } else if (alert.alertType === 'filing_contradiction') {
      points.push('New filing contains statements that contradict previous disclosures');
      points.push('Potential shift in company strategy or financial position');
    } else if (alert.alertType === 'promise_broken') {
      points.push('Company failed to meet previously stated commitment');
      points.push('May indicate operational challenges or strategic shift');
    } else if (alert.alertType === 'social_surge') {
      points.push('Unusual social media activity detected');
      points.push('Public sentiment may not align with official communications');
    }

    // Add severity-based points
    if (alert.severity === 'critical') {
      points.push('This pattern has historically preceded significant market moves');
    } else if (alert.severity === 'high') {
      points.push('Multiple signals converging on same conclusion');
    }

    return points.slice(0, 3);
  }

  /**
   * Invalidate explanation cache for an alert
   */
  async invalidateExplanationCache(alertId: number): Promise<void> {
    const cacheKey = `explanation:${alertId}`;
    await redisCacheService.delete(cacheKey);
  }

  /**
   * Get explanation from cache if exists
   */
  async getExplanationFromCache(alertId: number): Promise<GeneratedExplanation | null> {
    const cacheKey = `explanation:${alertId}`;
    return redisCacheService.get<GeneratedExplanation>(cacheKey);
  }
}

const alertExplanationService = AlertExplanationService.getInstance();
export default alertExplanationService;
