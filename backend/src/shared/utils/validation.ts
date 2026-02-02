import { supabaseAuthService } from '../../modules/auth/services/supabaseAuth.service.js';

interface HistoricalAlert {
  id: number;
  spike_percentage: number;
  created_at: string;
  divergence_score?: number;
}

interface ValidationResult {
  isValid: boolean;
  confidenceScore: number;
  falsePositiveProbability: number;
  reasons: string[];
  recommendation: 'alert' | 'hold' | 'dismiss';
  similarityScore?: number;
}

export class AlertValidationService {
  /**
   * Validate a ticker alert against historical data
   */
  async validateAlert(
    ticker: string,
    currentSpike: {
      spike_percentage: number;
      volume: number;
      price_movement: number;
      created_at: Date;
    }
  ): Promise<ValidationResult> {
    try {
      const supabase = supabaseAuthService.getClient();

      // Get ticker ID
      const { data: tickerData, error: tickerError } = await supabase
        .from('tickers')
        .select('id')
        .eq('symbol', ticker)
        .single();

      if (tickerError || !tickerData) {
        // New ticker, pass validation
        return {
          isValid: true,
          confidenceScore: 0.5,
          falsePositiveProbability: 0.2,
          reasons: ['New ticker - insufficient historical data'],
          recommendation: 'alert',
        };
      }

      const tickerId = tickerData.id;

      // Get historical spikes for last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const { data: historicalSpikes, error: histError } = await supabase
        .from('volume_spikes')
        .select('id, spike_percentage, volume, price_movement, created_at')
        .eq('ticker_id', tickerId)
        .gt('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false });

      if (histError) {
        console.error('Failed to fetch historical data:', histError.message);
        return {
          isValid: true,
          confidenceScore: 0.5,
          falsePositiveProbability: 0.3,
          reasons: ['Unable to fetch historical data - proceeding with caution'],
          recommendation: 'hold',
        };
      }

      // Analyze historical patterns
      const result = await this.analyzePatterns(
        currentSpike,
        historicalSpikes || [],
        tickerId
      );

      return result;
    } catch (error) {
      console.error(
        'Alert validation error:',
        error instanceof Error ? error.message : String(error)
      );

      // Default to valid on error but lower confidence
      return {
        isValid: true,
        confidenceScore: 0.4,
        falsePositiveProbability: 0.5,
        reasons: ['Validation service error - manual review recommended'],
        recommendation: 'hold',
      };
    }
  }

  /**
   * Analyze patterns in historical vs current alert
   */
  private async analyzePatterns(
    currentSpike: any,
    historicalSpikes: HistoricalAlert[],
    tickerId: number
  ): Promise<ValidationResult> {
    const reasons: string[] = [];

    // 1. Check for spike similarity in last 30 days
    const similarSpikes = historicalSpikes.filter(
      (h) => Math.abs(h.spike_percentage - currentSpike.spike_percentage) < 10
    );

    let similarityScore = 0;
    if (similarSpikes.length === 0) {
      reasons.push('No similar spikes in last 30 days - novel pattern');
      similarityScore = 0.9;
    } else if (similarSpikes.length === 1) {
      reasons.push('One similar spike detected in last 30 days');
      similarityScore = 0.6;
    } else {
      reasons.push(`${similarSpikes.length} similar spikes detected in last 30 days - possible recurring pattern`);
      similarityScore = 0.3;
    }

    // 2. Check spike frequency
    const avgSpikesPerWeek = historicalSpikes.length / 4;
    if (avgSpikesPerWeek > 3) {
      reasons.push('High spike frequency - volatility indicator');
      similarityScore -= 0.2;
    }

    // 3. Get volume trend
    const supabase = supabaseAuthService.getClient();
    const { data: volumeTrend } = await supabase
      .from('ticker_historical_snapshots')
      .select('volume, ma_20, ma_50, ma_200')
      .eq('ticker_id', tickerId)
      .order('snapshot_date', { ascending: false })
      .limit(5);

    let volumeContext = 'normal';
    if (volumeTrend && volumeTrend.length > 0) {
      const currentVolume = currentSpike.volume;
      const avgVolume = volumeTrend.reduce((sum: number, d: any) => sum + (d.volume || 0), 0) / volumeTrend.length;

      if (currentVolume > avgVolume * 3) {
        reasons.push('Extreme volume spike - above 3x average');
        volumeContext = 'extreme';
      } else if (currentVolume > avgVolume * 2) {
        reasons.push('Strong volume increase - above 2x average');
        volumeContext = 'strong';
      } else if (currentVolume < avgVolume * 0.5) {
        reasons.push('Volume below average - low confidence');
        volumeContext = 'weak';
      }
    }

    // 4. Get recent contradictions for same ticker
    const { data: recentContradictions } = await supabase
      .from('narrative_contradictions')
      .select('created_at, validation_status')
      .eq('ticker_id', tickerId)
      .order('created_at', { ascending: false })
      .limit(5);

    let contradictionContext = 0;
    if (recentContradictions && recentContradictions.length > 0) {
      const validContradictions = recentContradictions.filter(
        (c: any) => c.validation_status === 'valid'
      );
      if (validContradictions.length > 2) {
        reasons.push(`${validContradictions.length} valid contradictions recently confirmed`);
        contradictionContext = 0.7; // Increased credibility
      } else {
        reasons.push('Conflicting signals from recent contradictions');
        contradictionContext = 0.4;
      }
    }

    // 5. Calculate false positive probability
    let falsePositiveProbability = 0.5;

    if (similarSpikes.length > 3) {
      falsePositiveProbability += 0.3; // Recurring pattern, likely false positive
      reasons.push('Pattern appears to be recurring/noise');
    }

    if (volumeContext === 'weak') {
      falsePositiveProbability += 0.2;
    } else if (volumeContext === 'extreme') {
      falsePositiveProbability -= 0.2;
    }

    if (historicalSpikes.length === 0) {
      falsePositiveProbability = 0.1; // First spike, genuine signal
    }

    // Cap values
    falsePositiveProbability = Math.min(Math.max(falsePositiveProbability, 0), 1);
    similarityScore = Math.min(Math.max(similarityScore, 0), 1);

    // 6. Final confidence and recommendation
    const confidenceScore = 1 - falsePositiveProbability;

    let recommendation: 'alert' | 'hold' | 'dismiss' = 'hold';
    if (confidenceScore > 0.75) {
      recommendation = 'alert';
      reasons.push('High confidence signal - proceed with alert');
    } else if (confidenceScore < 0.3) {
      recommendation = 'dismiss';
      reasons.push('Low confidence - likely false positive');
    } else {
      recommendation = 'hold';
      reasons.push('Medium confidence - requires manual review');
    }

    return {
      isValid: confidenceScore > 0.5,
      confidenceScore,
      falsePositiveProbability,
      reasons,
      recommendation,
      similarityScore,
    };
  }

  /**
   * Check if an alert is a duplicate of recent alerts
   */
  async isDuplicate(
    ticker: string,
    currentAlert: {
      spike_percentage: number;
      created_at: Date;
    },
    lookbackHours: number = 24
  ): Promise<{ isDuplicate: boolean; matchingAlerts: any[] }> {
    try {
      const supabase = supabaseAuthService.getClient();

      // Get ticker ID
      const { data: tickerData } = await supabase
        .from('tickers')
        .select('id')
        .eq('symbol', ticker)
        .single();

      if (!tickerData) {
        return { isDuplicate: false, matchingAlerts: [] };
      }

      const lookbackTime = new Date(
        currentAlert.created_at.getTime() - lookbackHours * 60 * 60 * 1000
      );

      // Get similar alerts in lookback window
      const { data: recentAlerts } = await supabase
        .from('volume_spikes')
        .select('id, spike_percentage, created_at')
        .eq('ticker_id', tickerData.id)
        .gt('created_at', lookbackTime)
        .lt('created_at', currentAlert.created_at);

      if (!recentAlerts || recentAlerts.length === 0) {
        return { isDuplicate: false, matchingAlerts: [] };
      }

      // Find matching alerts (within 10% spike difference)
      const matchingAlerts = recentAlerts.filter(
        (a: any) =>
          Math.abs(a.spike_percentage - currentAlert.spike_percentage) < 10
      );

      return {
        isDuplicate: matchingAlerts.length > 0,
        matchingAlerts,
      };
    } catch (error) {
      console.error(
        'Duplicate check error:',
        error instanceof Error ? error.message : String(error)
      );
      return { isDuplicate: false, matchingAlerts: [] };
    }
  }

  /**
   * Validate contradictions against market context
   */
  async validateContradiction(
    ticker: string,
    contradiction: {
      confidence_score: number;
      market_sentiment: string;
      article_sentiment: number;
    }
  ): Promise<{ isValid: boolean; validationStatus: 'valid' | 'false_positive' | 'needs_review' }> {
    try {
      // Confidence threshold
      if (contradiction.confidence_score > 0.75) {
        return { isValid: true, validationStatus: 'valid' };
      }

      if (contradiction.confidence_score < 0.4) {
        return { isValid: false, validationStatus: 'false_positive' };
      }

      return { isValid: true, validationStatus: 'needs_review' };
    } catch (error) {
      console.error(
        'Contradiction validation error:',
        error instanceof Error ? error.message : String(error)
      );
      return { isValid: false, validationStatus: 'needs_review' };
    }
  }

  /**
   * Get validation rules for a ticker
   */
  async getValidationRules(ticker?: string): Promise<any[]> {
    try {
      const supabase = supabaseAuthService.getClient();

      let query = supabase
        .from('alert_validation_rules')
        .select('*')
        .eq('is_active', true);

      if (ticker) {
        const { data: tickerData } = await supabase
          .from('tickers')
          .select('id')
          .eq('symbol', ticker)
          .single();

        if (tickerData) {
          query = query.eq('ticker_id', tickerData.id);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to fetch validation rules:', error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error(
        'Get rules error:',
        error instanceof Error ? error.message : String(error)
      );
      return [];
    }
  }

  /**
   * Record validation result for machine learning
   */
  async recordValidation(
    volumeSpikeId: number,
    isAccurate: boolean,
    feedback?: string
  ): Promise<void> {
    try {
      const supabase = supabaseAuthService.getClient();

      // Get the spike to find validation records
      const { data: validations } = await supabase
        .from('alert_validations')
        .select('id')
        .eq('volume_spike_id', volumeSpikeId);

      if (validations && validations.length > 0) {
        await supabase
          .from('alert_validations')
          .update({
            is_valid: isAccurate,
            validation_details: {
              user_feedback: feedback,
              validated_at: new Date(),
            },
          })
          .eq('volume_spike_id', volumeSpikeId);
      }

      console.log(`Recorded validation for spike ${volumeSpikeId}: ${isAccurate ? 'accurate' : 'inaccurate'}`);
    } catch (error) {
      console.error(
        'Record validation error:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}

export const alertValidationService = new AlertValidationService();
