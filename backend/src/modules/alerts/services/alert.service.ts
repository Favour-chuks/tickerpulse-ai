import db from '../libs/database.js';
import { queueAlert } from '../../../shared/infra/services/queue.service.js';
import type { AlertQueueJob } from '../../../shared/infra/services/queue.service.js';
import type { DivergenceAlert, UserAlert } from '../../../shared/types/domain.js';

class AlertService {
  private static instance: AlertService;

  private constructor() {}

  static getInstance(): AlertService {
    if (!AlertService.instance) {
      AlertService.instance = new AlertService();
    }
    return AlertService.instance;
  }

  /**
   * Get user's alerts
   */
  async getUserAlerts(
    userId: string,
    read?: boolean,
    dismissed?: boolean,
    limit: number = 50,
    offset: number = 0
  ): Promise<(UserAlert & { divergence_alert: DivergenceAlert })[]> {
    let query = `SELECT ua.*, da.* FROM user_alerts ua
                 JOIN divergence_alerts da ON ua.alert_id = da.id
                 WHERE ua.user_id = $1`;
    const params: any[] = [userId];
    let paramIndex = 2;

    if (read !== undefined) {
      query += ` AND ua.read = $${paramIndex}`;
      params.push(read);
      paramIndex++;
    }

    if (dismissed !== undefined) {
      query += ` AND ua.dismissed = $${paramIndex}`;
      params.push(dismissed);
      paramIndex++;
    }

    query += ` ORDER BY ua.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    return db.queryMany(query, params);
  }

  /**
   * Get unread alert count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const result = await db.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM user_alerts 
       WHERE user_id = $1 AND read = FALSE AND dismissed = FALSE`,
      [userId]
    );

    return result ? parseInt(result.count) : 0;
  }

  /**
   * Mark alert as read
   */
  async markAsRead(userId: string, alertId: number): Promise<void> {
    await db.query(
      `UPDATE user_alerts 
       SET read = TRUE, read_at = NOW()
       WHERE user_id = $1 AND alert_id = $2`,
      [userId, alertId]
    );
  }

  /**
   * Mark alert as dismissed
   */
  async dismissAlert(userId: string, alertId: number): Promise<void> {
    await db.query(
      `UPDATE user_alerts 
       SET dismissed = TRUE, dismissed_at = NOW()
       WHERE user_id = $1 AND alert_id = $2`,
      [userId, alertId]
    );
  }

  /**
   * Mark multiple alerts as read
   */
  async markMultipleAsRead(userId: string, alertIds: number[]): Promise<void> {
    if (alertIds.length === 0) return;

    const placeholders = alertIds.map((_, i) => `$${i + 2}`).join(',');
    await db.query(
      `UPDATE user_alerts 
       SET read = TRUE, read_at = NOW()
       WHERE user_id = $1 AND alert_id IN (${placeholders})`,
      [userId, ...alertIds]
    );
  }

  /**
   * Get alert details
   */
  async getAlertDetails(userId: string, alertId: number): Promise<any | null> {
    return db.queryOne(
      `SELECT ua.*, da.* FROM user_alerts ua
       JOIN divergence_alerts da ON ua.alert_id = da.id
       WHERE ua.user_id = $1 AND ua.alert_id = $2`,
      [userId, alertId]
    );
  }

  /**
   * Get active alerts for ticker
   */
  async getActiveAlertsForTicker(
    ticker: string,
    limit: number = 20
  ): Promise<DivergenceAlert[]> {
    return db.queryMany<DivergenceAlert>(
      `SELECT * FROM divergence_alerts
       WHERE ticker = $1 AND status = 'active'
       ORDER BY created_at DESC
       LIMIT $2`,
      [ticker, limit]
    );
  }

  /**
   * Get critical alerts
   */
  async getCriticalAlerts(limit: number = 10): Promise<DivergenceAlert[]> {
    return db.queryMany<DivergenceAlert>(
      `SELECT * FROM divergence_alerts
       WHERE severity = 'critical' AND status = 'active'
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
  }

  /**
   * Get alerts by date range
   */
  async getAlertsByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 50
  ): Promise<(UserAlert & { divergence_alert: DivergenceAlert })[]> {
    return db.queryMany(
      `SELECT ua.*, da.* FROM user_alerts ua
       JOIN divergence_alerts da ON ua.alert_id = da.id
       WHERE ua.user_id = $1 
       AND ua.created_at BETWEEN $2 AND $3
       ORDER BY ua.created_at DESC
       LIMIT $4`,
      [userId, startDate, endDate, limit]
    );
  }

  /**
   * Get alerts for multiple tickers
   */
  async getAlertsForTickers(
    userId: string,
    tickers: string[],
    limit: number = 50
  ): Promise<(UserAlert & { divergence_alert: DivergenceAlert })[]> {
    if (tickers.length === 0) return [];

    const placeholders = tickers.map((_, i) => `$${i + 2}`).join(',');
    return db.queryMany(
      `SELECT ua.*, da.* FROM user_alerts ua
       JOIN divergence_alerts da ON ua.alert_id = da.id
       WHERE ua.user_id = $1 AND da.ticker IN (${placeholders})
       ORDER BY ua.created_at DESC
       LIMIT $${tickers.length + 2}`,
      [userId, ...tickers, limit]
    );
  }

  /**
   * Get alert statistics for user
   */
  async getAlertStats(userId: string): Promise<{
    total: number;
    unread: number;
    dismissed: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  }> {
    const totalResult = await db.queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM user_alerts WHERE user_id = $1',
      [userId]
    );

    const unreadResult = await db.queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM user_alerts WHERE user_id = $1 AND read = FALSE',
      [userId]
    );

    const dismissedResult = await db.queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM user_alerts WHERE user_id = $1 AND dismissed = TRUE',
      [userId]
    );

    const bySeverityResults = await db.queryMany<{ severity: string; count: string }>(
      `SELECT da.severity, COUNT(*) as count FROM user_alerts ua
       JOIN divergence_alerts da ON ua.alert_id = da.id
       WHERE ua.user_id = $1
       GROUP BY da.severity`,
      [userId]
    );

    const byTypeResults = await db.queryMany<{ alert_type: string; count: string }>(
      `SELECT da.alert_type, COUNT(*) as count FROM user_alerts ua
       JOIN divergence_alerts da ON ua.alert_id = da.id
       WHERE ua.user_id = $1
       GROUP BY da.alert_type`,
      [userId]
    );

    const bySeverity: Record<string, number> = {};
    bySeverityResults.forEach((row) => {
      bySeverity[row.severity] = parseInt(row.count);
    });

    const byType: Record<string, number> = {};
    byTypeResults.forEach((row) => {
      byType[row.alert_type] = parseInt(row.count);
    });

    return {
      total: totalResult ? parseInt(totalResult.count) : 0,
      unread: unreadResult ? parseInt(unreadResult.count) : 0,
      dismissed: dismissedResult ? parseInt(dismissedResult.count) : 0,
      bySeverity,
      byType,
    };
  }

  /**
   * Clear old dismissed alerts (older than 30 days)
   */
  async clearOldDismissedAlerts(daysOld: number = 30): Promise<number> {
    const result = await db.query(
      `DELETE FROM user_alerts 
       WHERE dismissed = TRUE 
       AND dismissed_at < NOW() - INTERVAL '${daysOld} days'`,
      []
    );

    return result.rowCount ?? 0;
  }

  /**
   * Get recent alerts for dashboard
   */
  async getDashboardAlerts(userId: string, hoursBack: number = 24): Promise<any[]> {
    return db.queryMany(
      `SELECT 
        ua.id as user_alert_id,
        da.*,
        vs.deviation_multiple,
        vs.z_score
       FROM user_alerts ua
       JOIN divergence_alerts da ON ua.alert_id = da.id
       LEFT JOIN volume_spikes vs ON da.spike_id = vs.id
       WHERE ua.user_id = $1
       AND da.created_at >= NOW() - INTERVAL '${hoursBack} hours'
       ORDER BY da.created_at DESC
       LIMIT 20`,
      [userId]
    );
  }

  /**
   * Subscribe user to alerts for a ticker
   */
  async subscribeToTicker(userId: string, ticker: string): Promise<void> {
    // This is handled by watchlist service, but we can add notification preferences here
    await db.query(
      `INSERT INTO user_alerts_subscriptions (user_id, ticker)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, ticker.toUpperCase()]
    );
  }

  /**
   * Unsubscribe user from ticker alerts
   */
  async unsubscribeFromTicker(userId: string, ticker: string): Promise<void> {
    await db.query(
      `DELETE FROM user_alerts_subscriptions 
       WHERE user_id = $1 AND ticker = $2`,
      [userId, ticker.toUpperCase()]
    );
  }

  /**
   * Queue alert for distribution to users
   * This queues the alert to be processed by the alert distribution worker
   */
  async queueAlertForDistribution(
    ticker_id: number,
    alert_type: 'volume_spike' | 'divergence' | 'contradiction' | 'news' | 'filing',
    severity: 'low' | 'medium' | 'high' | 'critical',
    message: string,
    metadata: {
      spike_id?: number;
      contradiction_id?: number;
      article_id?: number;
      filing_id?: number;
      price_impact?: number;
      volume_impact?: number;
      [key: string]: any;
    }
  ): Promise<void> {
    try {
      const alertData: AlertQueueJob = {
        ticker_id,
        alert_type,
        severity,
        message,
        metadata,
        timestamp: new Date().toISOString(),
      };

      const job = await queueAlert(alertData);
      console.log(`✅ Alert queued for ticker ${ticker_id} (job: ${job.id})`);
    } catch (error) {
      console.error(`❌ Failed to queue alert for ticker ${ticker_id}:`, error);
      throw error;
    }
  }

  /**
   * Queue volume spike for analysis and distribution
   */
  async queueVolumeSpikeAlert(
    ticker_id: number,
    spike_id: number,
    deviation: number,
    severity: 'medium' | 'high' | 'critical'
  ): Promise<void> {
    const message = `Volume spike detected: ${deviation.toFixed(1)}x average volume`;
    await this.queueAlertForDistribution(
      ticker_id,
      'volume_spike',
      severity,
      message,
      {
        spike_id,
        volume_impact: deviation,
      }
    );
  }

  /**
   * Queue divergence alert
   */
  async queueDivergenceAlert(
    ticker_id: number,
    divergence_score: number
  ): Promise<void> {
    const severity = divergence_score > 0.7 ? 'critical' : divergence_score > 0.5 ? 'high' : 'medium';
    const message = `Sentiment divergence detected (score: ${divergence_score.toFixed(2)})`;
    await this.queueAlertForDistribution(
      ticker_id,
      'divergence',
      severity,
      message,
      {
        divergence_score,
      }
    );
  }

  /**
   * Queue narrative contradiction alert
   */
  async queueContradictionAlert(
    ticker_id: number,
    contradiction_id: number,
    contradiction_type: string,
    severity: string
  ): Promise<void> {
    const message = `Narrative contradiction detected: ${contradiction_type}`;
    await this.queueAlertForDistribution(
      ticker_id,
      'contradiction',
      severity as any,
      message,
      {
        contradiction_id,
        contradiction_type,
      }
    );
  }

  /**
   * Queue news article alert
   */
  async queueNewsAlert(
    ticker_id: number,
    article_id: number,
    headline: string,
    sentiment: string
  ): Promise<void> {
    const severity = sentiment === 'negative' ? 'high' : sentiment === 'positive' ? 'low' : 'medium';
    const message = `News: ${headline}`;
    await this.queueAlertForDistribution(
      ticker_id,
      'news',
      severity as any,
      message,
      {
        article_id,
        sentiment,
      }
    );
  }

  /**
   * Queue SEC filing alert
   */
  async queueFilingAlert(
    ticker_id: number,
    filing_id: number,
    filing_type: string,
    is_material: boolean
  ): Promise<void> {
    const severity = is_material ? 'high' : 'medium';
    const message = `SEC Filing: ${filing_type}`;
    await this.queueAlertForDistribution(
      ticker_id,
      'filing',
      severity as any,
      message,
      {
        filing_id,
        filing_type,
        is_material,
      }
    );
  }
}

export default AlertService.getInstance();
