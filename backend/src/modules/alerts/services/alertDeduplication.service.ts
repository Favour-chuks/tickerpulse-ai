import { supabase } from '../../../shared/infra/libs/supabase.js';
import redisCacheService, {
  CACHE_KEYS,
  CACHE_TTL,
} from '../../../shared/infra/services/cache.service.js';
import { logger } from '../../../config/logger.js';
import type { DivergenceAlert } from '../../../shared/types/domain.js';

interface AlertSignature {
  ticker: string;
  alertType: string;
  timeWindow: number; // minutes
  hash: string;
}

class AlertDeduplicationService {
  private static instance: AlertDeduplicationService;
  private readonly DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  private readonly SIGNIFICANT_CHANGE_THRESHOLD = 0.3; // 30% change

  private constructor() {}

  static getInstance(): AlertDeduplicationService {
    if (!AlertDeduplicationService.instance) {
      AlertDeduplicationService.instance = new AlertDeduplicationService();
    }
    return AlertDeduplicationService.instance;
  }

  /**
   * Check if an alert is a duplicate of a recent alert
   * Returns null if unique, returns existing alert ID if duplicate
   */
  async checkForDuplicate(newAlert: Partial<DivergenceAlert>): Promise<number | null> {
    try {
      if (!newAlert.ticker) {
        throw new Error('Ticker is required for duplicate check');
      }

      const signature = this.generateSignature(newAlert);
      const cacheKey = `dedup:${signature.hash}`;

      // Check Redis cache first
      const cachedDuplicateId = await redisCacheService.get<number>(cacheKey);
      if (cachedDuplicateId) {
        logger.info({
          msg: 'Duplicate alert found in cache',
          ticker: newAlert.ticker,
          cachedId: cachedDuplicateId,
        });
        return cachedDuplicateId;
      }

      // Check database for recent similar alerts
      const recentAlerts = await this.getRecentAlertsForTicker(
        newAlert.ticker,
        newAlert.alertType || 'divergence_detected'
      );

      // Check if new alert is significantly different from recent alerts
      for (const alert of recentAlerts) {
        if (
          this.isSimilarAlert(newAlert, alert) &&
          !this.isSignificantlyDifferent(newAlert, alert)
        ) {
          // Store in cache
          await redisCacheService.set(
            cacheKey,
            alert.id,
            CACHE_TTL.ACTIVE_DIVERGENCES
          );

          logger.info({
            msg: 'Duplicate alert detected',
            ticker: newAlert.ticker,
            existingAlertId: alert.id,
          });

          return alert.id;
        }
      }

      // Not a duplicate - store signature in cache for next check
      await redisCacheService.set(
        cacheKey,
        0,
        CACHE_TTL.ACTIVE_DIVERGENCES
      );

      return null;
    } catch (error) {
      logger.error({ msg: 'Error checking for duplicate', error });
      return null;
    }
  }

  /**
   * Get bundle of related alerts for intelligent grouping
   */
  async getRelatedAlerts(ticker: string, alertId: number): Promise<DivergenceAlert[]> {
    try {
      const { data, error } = await supabase
        .from('divergence_alerts')
        .select('*')
        .eq('ticker', ticker)
        .eq('status', 'active')
        .gte('created_at', new Date(Date.now() - this.DEDUP_WINDOW_MS))
        .neq('id', alertId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error({ msg: 'Error getting related alerts', error, ticker });
      return [];
    }
  }

  /**
   * Bundle multiple related alerts into a single composite alert
   */
  async bundleRelatedAlerts(
    primaryAlertId: number,
    relatedAlertIds: number[]
  ): Promise<void> {
    try {
      if (relatedAlertIds.length === 0) return;

      // Store bundle relationship in cache
      const bundleKey = `alert:bundle:${primaryAlertId}`;
      await redisCacheService.set(
        bundleKey,
        relatedAlertIds,
        CACHE_TTL.ACTIVE_DIVERGENCES
      );

      // Mark related alerts as bundled
      const { error } = await supabase
        .from('divergence_alerts')
        .update({ status: 'bundled' })
        .in('id', relatedAlertIds);

      if (error) throw error;

      logger.info({
        msg: 'Alerts bundled',
        primaryAlertId,
        bundledCount: relatedAlertIds.length,
      });
    } catch (error) {
      logger.error({ msg: 'Error bundling alerts', error });
    }
  }

  /**
   * Check if two alerts should be considered similar
   */
  private isSimilarAlert(newAlert: Partial<DivergenceAlert>, existingAlert: DivergenceAlert): boolean {
    // Same ticker and alert type
    if (
      newAlert.ticker !== existingAlert.ticker ||
      newAlert.alertType !== existingAlert.alertType
    ) {
      return false;
    }

    // Within time window
    const timeDiff = Date.now() - new Date(existingAlert.createdAt).getTime();
    if (timeDiff > this.DEDUP_WINDOW_MS) {
      return false;
    }

    return true;
  }

  /**
   * Check if new alert is significantly different from existing alert
   */
  private isSignificantlyDifferent(
    newAlert: Partial<DivergenceAlert>,
    existingAlert: DivergenceAlert
  ): boolean {
    // Compare severity
    const severityMap = { low: 1, medium: 2, high: 3, critical: 4 };
    const newSeverity = severityMap[newAlert.severity || 'medium'];
    const existingSeverity = severityMap[existingAlert.severity];

    const severityChange = Math.abs(newSeverity - existingSeverity) / existingSeverity;

    if (severityChange > this.SIGNIFICANT_CHANGE_THRESHOLD) {
      logger.info({
        msg: 'Significant severity change detected',
        from: existingAlert.severity,
        to: newAlert.severity,
        change: (severityChange * 100).toFixed(2) + '%',
      });
      return true;
    }

    // Check if supporting evidence has significantly changed
    if (
      newAlert.supportingEvidence &&
      existingAlert.supportingEvidence
    ) {
      const newVolume = newAlert.supportingEvidence.volume || 0;
      const existingVolume = existingAlert.supportingEvidence.volume || 0;

      if (existingVolume > 0) {
        const volumeChange = Math.abs(newVolume - existingVolume) / existingVolume;
        if (volumeChange > this.SIGNIFICANT_CHANGE_THRESHOLD) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get recent alerts for a ticker with the same type
   */
  private async getRecentAlertsForTicker(
    ticker: string,
    alertType: string
  ): Promise<DivergenceAlert[]> {
    try {
      const { data, error } = await supabase
        .from('divergence_alerts')
        .select('*')
        .eq('ticker', ticker)
        .eq('alert_type', alertType)
        .eq('status', 'active')
        .gte('created_at', new Date(Date.now() - this.DEDUP_WINDOW_MS))
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error({
        msg: 'Error getting recent alerts',
        error,
        ticker,
        alertType,
      });
      return [];
    }
  }

  /**
   * Generate unique signature for alert
   */
  private generateSignature(alert: Partial<DivergenceAlert>): AlertSignature {
    const data = `${alert.ticker}:${alert.alertType}:${
      alert.supportingEvidence?.volume || 'unknown'
    }`;

    // Simple hash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return {
      ticker: alert.ticker || '',
      alertType: alert.alertType || '',
      timeWindow: 5,
      hash: Math.abs(hash).toString(36),
    };
  }

  /**
   * Clean up old deduplication cache entries
   */
  async cleanupOldEntries(): Promise<void> {
    try {
      const pattern = 'dedup:*';
      const keys = await (redisCacheService.client as any).keys(pattern);

      // Redis TTL handles cleanup automatically
      logger.info({ msg: 'Dedup cleanup completed', keysFound: keys.length });
    } catch (error) {
      logger.error({ msg: 'Error cleaning up dedup entries', error });
    }
  }

  /**
   * Get deduplication statistics
   */
  async getStatistics(): Promise<Record<string, any>> {
    try {
      const pattern = 'dedup:*';
      const keys = await (redisCacheService.client as any).keys(pattern);

      const totalDuplicates = keys.length;
      const { data: activeDuplicates, error } = await supabase
        .from('divergence_alerts')
        .select('id')
        .eq('status', 'bundled')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000));

      if (error) throw error;

      return {
        dedupCacheSize: totalDuplicates,
        activeBundledAlerts: activeDuplicates?.length || 0,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error({ msg: 'Error getting dedup statistics', error });
      return {};
    }
  }

  /**
   * Merge duplicate alerts into primary alert
   */
  async mergeDuplicateAlerts(primaryId: number, duplicateIds: number[]): Promise<void> {
    try {
      // Update all user_alerts to point to primary alert
      const { error: updateError } = await supabase
        .from('user_alerts')
        .update({ alert_id: primaryId })
        .in('alert_id', duplicateIds);

      if (updateError) throw updateError;

      // Mark duplicates as resolved
      const { error: deleteError } = await supabase
        .from('divergence_alerts')
        .update({ status: 'resolved' })
        .in('id', duplicateIds);

      if (deleteError) throw deleteError;

      logger.info({
        msg: 'Duplicate alerts merged',
        primaryId,
        mergedCount: duplicateIds.length,
      });
    } catch (error) {
      logger.error({ msg: 'Error merging duplicate alerts', error });
    }
  }
}

const alertDeduplicationService = AlertDeduplicationService.getInstance();
export default alertDeduplicationService;
