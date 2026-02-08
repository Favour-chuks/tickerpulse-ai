import { supabase } from '../../../shared/infra/libs/supabase.js';
import redisService from '../../../config/redis.js';
import type { AlertSeverity } from '../../../shared/types/domain.js';
import { logger } from '../../../config/logger.js';

interface SeverityFactors {
  volumeDeviationMultiple: number;
  priceChangePercent: number;
  newsItemCount: number;
  filingPresent: boolean;
  narrativeChangeDetected: boolean;
  socialSentimentScore: number;
  historicalFrequency: number;
}

interface ScoringResult {
  severity: AlertSeverity;
  confidenceScore: number; // 0-100
  factors: Record<string, number>;
  reasoning: string;
}

class AlertSeverityService {
  private static instance: AlertSeverityService;
  private readonly CACHE_TTL = 3600; // 1 hour

  private constructor() {}

  static getInstance(): AlertSeverityService {
    if (!AlertSeverityService.instance) {
      AlertSeverityService.instance = new AlertSeverityService();
    }
    return AlertSeverityService.instance;
  }

  /**
   * Calculate alert severity and confidence score based on multiple factors
   */
  async calculateSeverityAndConfidence(
    ticker: string,
    factors: SeverityFactors
  ): Promise<ScoringResult> {
    try {
      // Check cache first
      const cacheKey = `severity:${ticker}:${Math.floor(Date.now() / 60000)}`;
      const cached = await redisService.client.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Calculate individual factor weights (0-100 scale)
      const volumeFactor = this.calculateVolumeFactor(factors.volumeDeviationMultiple);
      const priceFactor = this.calculatePriceFactor(factors.priceChangePercent);
      const newsFactor = this.calculateNewsFactor(factors.newsItemCount, factors.filingPresent);
      const narrativeFactor = this.calculateNarrativeFactor(factors.narrativeChangeDetected);
      const sentimentFactor = this.calculateSentimentFactor(factors.socialSentimentScore);
      const frequencyFactor = this.calculateFrequencyFactor(
        ticker,
        factors.historicalFrequency
      );

      // Weighted calculation
      const weights = {
        volume: 0.25,
        price: 0.20,
        news: 0.20,
        narrative: 0.15,
        sentiment: 0.15,
        frequency: 0.05,
      };

      const weightedScore =
        volumeFactor * weights.volume +
        priceFactor * weights.price +
        newsFactor * weights.news +
        narrativeFactor * weights.narrative +
        sentimentFactor * weights.sentiment +
        frequencyFactor * weights.frequency;

      // Determine severity level
      const severity = this.determineSeverityLevel(weightedScore);

      // Calculate confidence as combination of data quality and signal strength
      const confidenceScore = this.calculateConfidenceScore(
        volumeFactor,
        priceFactor,
        newsFactor,
        narrativeFactor,
        weightedScore
      );

      const result: ScoringResult = {
        severity,
        confidenceScore,
        factors: {
          volume: volumeFactor,
          price: priceFactor,
          news: newsFactor,
          narrative: narrativeFactor,
          sentiment: sentimentFactor,
          frequency: frequencyFactor,
          weighted: weightedScore,
        },
        reasoning: this.generateReasoning(
          ticker,
          severity,
          confidenceScore,
          volumeFactor,
          newsFactor,
          narrativeFactor
        ),
      };

      // Cache the result
      await redisService.client.setex(
        cacheKey,
        this.CACHE_TTL,
        JSON.stringify(result)
      );

      return result;
    } catch (error) {
      logger.error({
        msg: 'Error calculating severity and confidence',
        error,
        ticker,
      });
      throw error;
    }
  }

  /**
   * Calculate volume factor score (0-100)
   * Based on how many times above average the volume is
   */
  private calculateVolumeFactor(deviationMultiple: number): number {
    if (deviationMultiple < 1.5) return 10;
    if (deviationMultiple < 2) return 25;
    if (deviationMultiple < 3) return 40;
    if (deviationMultiple < 5) return 65;
    if (deviationMultiple < 10) return 85;
    return 100;
  }

  /**
   * Calculate price change factor score (0-100)
   */
  private calculatePriceFactor(priceChangePercent: number): number {
    const absChange = Math.abs(priceChangePercent);
    if (absChange < 1) return 10;
    if (absChange < 2) return 25;
    if (absChange < 3) return 40;
    if (absChange < 5) return 65;
    if (absChange < 10) return 85;
    return 100;
  }

  /**
   * Calculate news factor score (0-100)
   * Lower score if filing exists (expected catalyst)
   * Higher score if no filing (unexpected spike)
   */
  private calculateNewsFactor(newsCount: number, filingPresent: boolean): number {
    if (filingPresent) {
      // Filing is a known catalyst - reduce news factor impact
      return Math.min(newsCount * 5, 40);
    }

    // No filing = unexpected catalyst (higher impact)
    if (newsCount === 0) return 100; // DIVERGENCE!
    if (newsCount < 3) return 80;
    if (newsCount < 5) return 60;
    if (newsCount < 10) return 40;
    return 20; // Many articles = expected
  }

  /**
   * Calculate narrative factor score (0-100)
   * Narrative changes increase alert severity
   */
  private calculateNarrativeFactor(narrativeChangeDetected: boolean): number {
    return narrativeChangeDetected ? 75 : 25;
  }

  /**
   * Calculate sentiment factor score (0-100)
   * Social sentiment contradicting market action = higher severity
   */
  private calculateSentimentFactor(sentimentScore: number): number {
    // sentimentScore ranges from -1 (very negative) to +1 (very positive)
    return Math.abs(sentimentScore) * 100;
  }

  /**
   * Calculate frequency factor score (0-100)
   * How frequently does this ticker experience similar events?
   */
  private calculateFrequencyFactor(ticker: string, historicalFrequency: number): number {
    // Higher historical frequency = lower severity (more common)
    if (historicalFrequency === 0) return 100;
    if (historicalFrequency < 2) return 80;
    if (historicalFrequency < 5) return 60;
    if (historicalFrequency < 10) return 40;
    return 20; // Very common = low severity
  }

  /**
   * Determine severity level based on weighted score
   */
  private determineSeverityLevel(score: number): AlertSeverity {
    if (score < 20) return 'low';
    if (score < 40) return 'low';
    if (score < 60) return 'medium';
    if (score < 80) return 'high';
    return 'critical';
  }

  /**
   * Calculate confidence score (0-100) based on signal strength
   */
  private calculateConfidenceScore(
    volumeFactor: number,
    priceFactor: number,
    newsFactor: number,
    narrativeFactor: number,
    weightedScore: number
  ): number {
    // Confidence increases when multiple signals align
    const signalsStrength = [volumeFactor, priceFactor, newsFactor, narrativeFactor];
    const strongSignals = signalsStrength.filter((s) => s > 60).length;

    // Base confidence from weighted score
    let confidence = Math.min(weightedScore + 10, 100);

    // Boost confidence if multiple strong signals
    if (strongSignals >= 3) {
      confidence = Math.min(confidence + 15, 100);
    }

    // Apply penalty if signals are conflicting
    const signalVariance =
      Math.max(...signalsStrength) - Math.min(...signalsStrength);
    if (signalVariance > 50) {
      confidence = Math.max(confidence - 10, 40);
    }

    return Math.round(confidence);
  }

  /**
   * Generate human-readable reasoning for the severity calculation
   */
  private generateReasoning(
    ticker: string,
    severity: AlertSeverity,
    confidence: number,
    volumeFactor: number,
    newsFactor: number,
    narrativeFactor: number
  ): string {
    const reasons: string[] = [];

    if (volumeFactor > 60) {
      reasons.push(`Unusual volume spike detected (${volumeFactor}% signal strength)`);
    }

    if (newsFactor > 70) {
      reasons.push('No obvious news catalyst found - divergence detected');
    } else if (newsFactor > 40) {
      reasons.push('Limited news coverage despite market movement');
    }

    if (narrativeFactor > 60) {
      reasons.push('Significant narrative change detected in company communications');
    }

    return `${severity.toUpperCase()} SEVERITY - Confidence: ${confidence}%. ${reasons.join('. ')}`;
  }

  /**
   * Get historical alert frequency for a ticker
   */
  async getHistoricalAlertFrequency(
    ticker: string,
    daysBack: number = 30
  ): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('divergence_alerts')
        .select('id')
        .eq('ticker', ticker)
        .gte('created_at', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000));

      if (error) throw error;
      return data?.length || 0;
    } catch (error) {
      logger.error({
        msg: 'Error getting historical alert frequency',
        error,
        ticker,
      });
      return 0;
    }
  }

  /**
   * Invalidate severity cache for ticker
   */
  async invalidateCache(ticker: string): Promise<void> {
    const pattern = `severity:${ticker}:*`;
    const keys = await redisService.client.keys(pattern);
    if (keys.length > 0) {
      await redisService.client.del(...keys);
    }
  }
}

const alertSeverityService = AlertSeverityService.getInstance();
export default alertSeverityService;
