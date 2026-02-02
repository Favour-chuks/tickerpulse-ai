import db from '../libs/database.js';
import type {
  VolumeSpikeEvent,
  MarketData,
  DivergenceAlert,
} from '../../../shared/types/domain.js';

interface VolumeMetrics {
  avgVolume: number;
  stdDev: number;
  zScore: number;
}

class VolumeDetectionService {
  private static instance: VolumeDetectionService;
  private readonly VOLUME_SPIKE_THRESHOLD = 2.5; // 2.5x normal volume
  private readonly MIN_Z_SCORE = 2.0; // 2 standard deviations

  private constructor() {}

  static getInstance(): VolumeDetectionService {
    if (!VolumeDetectionService.instance) {
      VolumeDetectionService.instance = new VolumeDetectionService();
    }
    return VolumeDetectionService.instance;
  }

  /**
   * Get 20-day moving average volume for a ticker
   */
  async getMovingAverageVolume(ticker: string, days: number = 20): Promise<number> {
    const result = await db.queryOne<{ avg_volume: string }>(
      `SELECT AVG(volume)::bigint as avg_volume
       FROM market_data
       WHERE ticker = $1
       AND time >= NOW() - INTERVAL '${days} days'`,
      [ticker]
    );

    return result?.avg_volume ? parseInt(result.avg_volume) : 0;
  }

  /**
   * Calculate volume metrics (average, std dev, z-score)
   */
  async calculateVolumeMetrics(
    ticker: string,
    currentVolume: number,
    days: number = 20
  ): Promise<VolumeMetrics> {
    const result = await db.queryOne<{
      avg_volume: string;
      std_dev: string;
    }>(
      `SELECT 
        AVG(volume)::bigint as avg_volume,
        STDDEV(volume)::numeric as std_dev
       FROM market_data
       WHERE ticker = $1
       AND time >= NOW() - INTERVAL '${days} days'`,
      [ticker]
    );

    const avgVolume = result?.avg_volume ? parseInt(result.avg_volume) : 1;
    const stdDev = result?.std_dev ? parseFloat(result.std_dev) : 0;

    const zScore = stdDev > 0 ? (currentVolume - avgVolume) / stdDev : 0;

    return {
      avgVolume,
      stdDev,
      zScore,
    };
  }

  /**
   * Detect if current volume represents a spike
   */
  async isVolumeSpikeDetected(ticker: string, currentVolume: number): Promise<boolean> {
    const avgVolume = await this.getMovingAverageVolume(ticker, 20);

    if (avgVolume === 0) return false;

    const deviation = currentVolume / avgVolume;
    return deviation > this.VOLUME_SPIKE_THRESHOLD;
  }

  /**
   * Record a volume spike event
   */
  async recordVolumeSpikeEvent(
    ticker: string,
    volume: number,
    avgVolume: number,
    detectedAt: Date = new Date()
  ): Promise<VolumeSpikeEvent> {
    const deviation = volume / avgVolume;
    const metrics = await this.calculateVolumeMetrics(ticker, volume);

    const result = await db.queryOne<VolumeSpikeEvent>(
      `INSERT INTO volume_spikes 
       (ticker, detected_at, volume, avg_volume, deviation_multiple, z_score)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        ticker,
        detectedAt,
        volume,
        avgVolume,
        deviation.toFixed(2),
        metrics.zScore.toFixed(2),
      ]
    );

    if (!result) {
      throw new Error('Failed to record volume spike');
    }

    return result;
  }

  /**
   * Get unprocessed volume spikes
   */
  async getUnprocessedSpikes(limit: number = 100): Promise<VolumeSpikeEvent[]> {
    return db.queryMany<VolumeSpikeEvent>(
      `SELECT * FROM volume_spikes
       WHERE processed = FALSE
       ORDER BY detected_at DESC
       LIMIT $1`,
      [limit]
    );
  }

  /**
   * Mark spike as processed
   */
  async markSpikeProcessed(spikeId: number): Promise<void> {
    await db.query('UPDATE volume_spikes SET processed = TRUE WHERE id = $1', [
      spikeId,
    ]);
  }

  /**
   * Check for recent filings around spike time
   */
  async getRecentFilingsAroundSpike(
    ticker: string,
    spikeTime: Date,
    hoursWindow: number = 24
  ): Promise<any[]> {
    return db.queryMany(
      `SELECT * FROM sec_filings
       WHERE ticker = $1
       AND filed_at BETWEEN $2 - INTERVAL '${hoursWindow} hours' AND $2 + INTERVAL '${hoursWindow} hours'
       ORDER BY filed_at DESC`,
      [ticker, spikeTime]
    );
  }

  /**
   * Check for recent news around spike time
   */
  async getRecentNewsAroundSpike(
    ticker: string,
    spikeTime: Date,
    hoursWindow: number = 24
  ): Promise<any[]> {
    return db.queryMany(
      `SELECT * FROM social_mentions
       WHERE ticker = $1
       AND source IN ('news', 'twitter')
       AND published_at BETWEEN $2 - INTERVAL '${hoursWindow} hours' AND $2 + INTERVAL '${hoursWindow} hours'
       ORDER BY published_at DESC`,
      [ticker, spikeTime]
    );
  }

  /**
   * Get spike history for a ticker
   */
  async getSpikeHistory(
    ticker: string,
    days: number = 30,
    limit: number = 100
  ): Promise<VolumeSpikeEvent[]> {
    return db.queryMany<VolumeSpikeEvent>(
      `SELECT * FROM volume_spikes
       WHERE ticker = $1
       AND detected_at >= NOW() - INTERVAL '${days} days'
       ORDER BY detected_at DESC
       LIMIT $2`,
      [ticker, limit]
    );
  }

  /**
   * Calculate volume spike statistics for a ticker
   */
  async getSpikeSummaryStats(ticker: string, days: number = 30): Promise<{
    totalSpikes: number;
    avgDeviationMultiple: number;
    maxDeviationMultiple: number;
    spikesWithCatalyst: number;
  }> {
    const result = await db.queryOne<{
      total_spikes: string;
      avg_deviation: string;
      max_deviation: string;
      spikes_with_catalyst: string;
    }>(
      `SELECT 
        COUNT(*) as total_spikes,
        AVG(deviation_multiple)::numeric as avg_deviation,
        MAX(deviation_multiple)::numeric as max_deviation,
        SUM(CASE WHEN has_catalyst THEN 1 ELSE 0 END) as spikes_with_catalyst
       FROM volume_spikes
       WHERE ticker = $1
       AND detected_at >= NOW() - INTERVAL '${days} days'`,
      [ticker]
    );

    return {
      totalSpikes: result?.total_spikes ? parseInt(result.total_spikes) : 0,
      avgDeviationMultiple: result?.avg_deviation ? parseFloat(result.avg_deviation) : 0,
      maxDeviationMultiple: result?.max_deviation ? parseFloat(result.max_deviation) : 0,
      spikesWithCatalyst: result?.spikes_with_catalyst
        ? parseInt(result.spikes_with_catalyst)
        : 0,
    };
  }

  /**
   * Detect volume anomalies for multiple tickers
   */
  async detectAnomaliesForWatchlist(tickers: string[]): Promise<VolumeSpikeEvent[]> {
    const spikes: VolumeSpikeEvent[] = [];

    for (const ticker of tickers) {
      // Get latest market data for ticker
      const latestData = await db.queryOne<{ volume: string }>(
        `SELECT volume FROM market_data
         WHERE ticker = $1
         ORDER BY time DESC
         LIMIT 1`,
        [ticker]
      );

      if (!latestData) continue;

      const currentVolume = parseInt(latestData.volume);
      const isSpike = await this.isVolumeSpikeDetected(ticker, currentVolume);

      if (isSpike) {
        const avgVolume = await this.getMovingAverageVolume(ticker, 20);
        const spike = await this.recordVolumeSpikeEvent(ticker, currentVolume, avgVolume);
        spikes.push(spike);
      }
    }

    return spikes;
  }
}

export default VolumeDetectionService.getInstance();
