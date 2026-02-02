import db from '../libs/database.js';
import geminiService from './gemini.service.js';
import volumeDetectionService from './volumeDetection.service.js';
import secFilingService from '../../news/services/secFiling.service.js';
import type { DivergenceAlert, AlertSeverity } from '../../../shared/types/domain.js';

class DivergenceDetectionService {
  private static instance: DivergenceDetectionService;

  private constructor() {}

  static getInstance(): DivergenceDetectionService {
    if (!DivergenceDetectionService.instance) {
      DivergenceDetectionService.instance = new DivergenceDetectionService();
    }
    return DivergenceDetectionService.instance;
  }

  /**
   * Analyze a volume spike for divergence
   */
  async analyzeSpikeForDivergence(spikeId: number): Promise<DivergenceAlert | null> {
    try {
      // Get spike details
      const spike = await db.queryOne<any>(
        'SELECT * FROM volume_spikes WHERE id = $1',
        [spikeId]
      );

      if (!spike) {
        throw new Error('Spike not found');
      }

      // Check for recent filings (24-hour window)
      const filings = await volumeDetectionService.getRecentFilingsAroundSpike(
        spike.ticker,
        spike.detected_at,
        24
      );

      // Check for recent news (24-hour window)
      const news = await volumeDetectionService.getRecentNewsAroundSpike(
        spike.ticker,
        spike.detected_at,
        24
      );

      // Determine if divergence exists
      const hasFiling = filings.length > 0;
      const hasNews = news.length > 3; // Threshold of 3+ news mentions

      if (!hasFiling && !hasNews) {
        // DIVERGENCE DETECTED: Volume spike without public catalyst
        return await this.createDivergenceAlert(
          spike,
          filings,
          news,
          hasFiling,
          hasNews
        );
      }

      return null;
    } catch (error) {
      console.error('Error analyzing spike for divergence', error);
      throw error;
    }
  }

  /**
   * Create a divergence alert
   */
  private async createDivergenceAlert(
    spike: any,
    filings: any[],
    news: any[],
    hasFiling: boolean,
    hasNews: boolean
  ): Promise<DivergenceAlert> {
    try {
      // Get recent context
      const recentFilingsStr = JSON.stringify(
        filings.map((f) => ({
          type: f.filing_type,
          date: f.filed_at,
          url: f.url,
        }))
      );

      const recentNewsStr = JSON.stringify(
        news.map((n) => ({
          source: n.source,
          text: n.text.substring(0, 200),
          sentiment: n.sentiment,
        }))
      );

      const socialSentiment = news.length > 0
        ? news.reduce((avg, n) => avg + (n.sentiment_score || 0), 0) / news.length
        : 0;

      // Use Gemini to generate hypothesis
      const hypothesis = await geminiService.generateDivergenceHypothesis(
        spike.ticker,
        spike.detected_at.toISOString(),
        spike.volume,
        spike.avg_volume,
        spike.deviation_multiple,
        0, // price change - would need market data
        recentFilingsStr,
        recentNewsStr,
        socialSentiment.toString()
      );

      // Determine severity
      const severity = this.calculateAlertSeverity(
        spike.deviation_multiple,
        spike.z_score,
        !hasFiling && !hasNews
      );

      // Create alert
      const result = await db.queryOne<DivergenceAlert>(
        `INSERT INTO divergence_alerts 
         (ticker, spike_id, severity, alert_type, hypothesis, supporting_evidence, watch_for, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          spike.ticker,
          spike.id,
          severity,
          'divergence_detected',
          hypothesis.hypotheses[0]?.explanation || 'Volume spike without public catalyst',
          JSON.stringify({
            hasPublicFiling: hasFiling,
            hasPublicNews: hasNews,
            hypotheses: hypothesis.hypotheses,
            riskAssessment: hypothesis.riskAssessment,
          }),
          hypothesis.hypotheses[0]?.watchFor || [],
          new Date(),
        ]
      );

      if (!result) {
        throw new Error('Failed to create alert');
      }

      // Notify watching users
      await this.notifyWatchingUsers(spike.ticker, result.id);

      return result;
    } catch (error) {
      console.error('Error creating divergence alert', error);
      throw error;
    }
  }

  /**
   * Calculate alert severity based on metrics
   */
  private calculateAlertSeverity(
    deviationMultiple: number,
    zScore: number,
    isDivergence: boolean
  ): AlertSeverity {
    // Divergence without catalyst is baseline critical
    if (isDivergence) {
      if (deviationMultiple > 5.0 || zScore > 3.5) {
        return 'critical';
      } else if (deviationMultiple > 3.5 || zScore > 2.8) {
        return 'high';
      }
      return 'medium';
    }

    return 'low';
  }

  /**
   * Get alerts for a ticker
   */
  async getAlertsForTicker(
    ticker: string,
    status?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<DivergenceAlert[]> {
    let query = 'SELECT * FROM divergence_alerts WHERE ticker = $1';
    const params: any[] = [ticker];

    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    return db.queryMany<DivergenceAlert>(query, params);
  }

  /**
   * Get alert by ID
   */
  async getAlertById(alertId: number): Promise<DivergenceAlert | null> {
    return db.queryOne<DivergenceAlert>(
      'SELECT * FROM divergence_alerts WHERE id = $1',
      [alertId]
    );
  }

  /**
   * Update alert status
   */
  async updateAlertStatus(
    alertId: number,
    status: string,
    reason?: string
  ): Promise<void> {
    await db.query(
      `UPDATE divergence_alerts 
       SET status = $1, resolved_at = CASE WHEN $2::varchar IN ('resolved', 'dismissed') THEN NOW() ELSE resolved_at END, 
           resolution_reason = $3
       WHERE id = $4`,
      [status, status, reason || null, alertId]
    );
  }

  /**
   * Dismiss alert for user
   */
  async dismissAlertForUser(userId: string, alertId: number): Promise<void> {
    await db.query(
      `UPDATE user_alerts 
       SET dismissed = TRUE, dismissed_at = NOW()
       WHERE user_id = $1 AND alert_id = $2`,
      [userId, alertId]
    );
  }

  /**
   * Notify users watching this ticker of new alert
   */
  private async notifyWatchingUsers(ticker: string, alertId: number): Promise<void> {
    try {
      // Get all users watching this ticker
      const result = await db.queryMany<{ user_id: string }>(
        `SELECT DISTINCT user_id FROM watchlists WHERE ticker = $1`,
        [ticker]
      );

      if (result.length === 0) return;

      // Create user_alerts for each watcher
      for (const { user_id } of result) {
        await db.query(
          `INSERT INTO user_alerts (user_id, alert_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [user_id, alertId]
        );
      }
    } catch (error) {
      console.error('Error notifying watching users', error);
    }
  }

  /**
   * Check contradictions when new filing arrives
   */
  async checkFilingForContradictions(
    filingId: number,
    ticker: string
  ): Promise<void> {
    try {
      // Get the new narrative
      const newNarrative = await db.queryOne<any>(
        `SELECT n.* FROM company_narratives n
         WHERE n.filing_id = $1`,
        [filingId]
      );

      if (!newNarrative) return;

      // Get last 8 quarters (2 years)
      const historicalNarratives = await db.queryMany<any>(
        `SELECT n.* FROM company_narratives n
         JOIN sec_filings f ON n.filing_id = f.id
         WHERE n.ticker = $1
         AND f.id != $2
         ORDER BY f.filed_at DESC
         LIMIT 8`,
        [ticker, filingId]
      );

      if (historicalNarratives.length === 0) return;

      // Build historical context
      const historicalContext = historicalNarratives
        .map(
          (n) =>
            `Summary: ${n.summary}\nKey Changes: ${JSON.stringify(n.key_changes)}`
        )
        .join('\n\n---\n\n');

      const newContext = `${newNarrative.summary}\nKey Changes: ${JSON.stringify(newNarrative.key_changes)}`;

      // Use Gemini to detect contradictions
      const contradictions = await geminiService.detectContradictions(
        ticker,
        historicalNarratives[historicalNarratives.length - 1]?.filing_id || '',
        filingId.toString(),
        historicalContext,
        newContext
      );

      // Store contradictions
      for (const contradiction of contradictions.contradictions) {
        await db.query(
          `INSERT INTO narrative_contradictions 
           (ticker, narrative_1_id, narrative_2_id, contradiction_type, explanation, severity, quote_1, quote_2)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            ticker,
            historicalNarratives[0]?.id || 0,
            newNarrative.id,
            contradiction.type,
            contradiction.explanation,
            contradiction.severity,
            contradiction.oldStatement,
            contradiction.newStatement,
          ]
        );

        // Create alert for high/critical contradictions
        if (
          contradiction.severity === 'high' ||
          contradiction.severity === 'critical'
        ) {
          const alert = await db.queryOne<any>(
            `INSERT INTO divergence_alerts 
             (ticker, spike_id, severity, alert_type, hypothesis, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [
              ticker,
              0, // No associated spike
              contradiction.severity.toLowerCase(),
              'filing_contradiction',
              contradiction.explanation,
              new Date(),
            ]
          );

          if (alert) {
            await this.notifyWatchingUsers(ticker, alert.id);
          }
        }
      }
    } catch (error) {
      console.error('Error checking filing for contradictions', error);
    }
  }

  /**
   * Get active alerts for dashboard
   */
  async getActiveAlerts(
    limit: number = 50,
    offset: number = 0
  ): Promise<DivergenceAlert[]> {
    return db.queryMany<DivergenceAlert>(
      `SELECT * FROM divergence_alerts
       WHERE status = 'active'
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
  }

  /**
   * Get alerts by severity
   */
  async getAlertsBySeverity(
    severity: AlertSeverity,
    limit: number = 50
  ): Promise<DivergenceAlert[]> {
    return db.queryMany<DivergenceAlert>(
      `SELECT * FROM divergence_alerts
       WHERE severity = $1 AND status = 'active'
       ORDER BY created_at DESC
       LIMIT $2`,
      [severity, limit]
    );
  }
}

export default DivergenceDetectionService.getInstance();
