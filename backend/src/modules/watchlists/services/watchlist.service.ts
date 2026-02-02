import db from '../libs/database.js';
import type { Watchlist, AlertPreferences } from '../../../shared/types/domain.js';

class WatchlistService {
  private static instance: WatchlistService;

  private constructor() {}

  static getInstance(): WatchlistService {
    if (!WatchlistService.instance) {
      WatchlistService.instance = new WatchlistService();
    }
    return WatchlistService.instance;
  }

  /**
   * Get user's watchlist
   */
  async getUserWatchlist(userId: string): Promise<Watchlist[]> {
    return db.queryMany<Watchlist>(
      `SELECT id, user_id, ticker, added_at, alert_preferences
       FROM watchlists
       WHERE user_id = $1
       ORDER BY ticker ASC`,
      [userId]
    );
  }

  /**
   * Add ticker to watchlist
   */
  async addToWatchlist(
    userId: string,
    ticker: string,
    alertPreferences?: AlertPreferences
  ): Promise<Watchlist> {
    const defaultPreferences: AlertPreferences = {
      divergence: true,
      filing: true,
      contradiction: true,
      social: false,
      severityFilter: 'medium',
    };

    const prefs = alertPreferences || defaultPreferences;

    const result = await db.queryOne<Watchlist>(
      `INSERT INTO watchlists (user_id, ticker, alert_preferences)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, ticker) DO UPDATE
       SET alert_preferences = $3
       RETURNING *`,
      [userId, ticker.toUpperCase(), JSON.stringify(prefs)]
    );

    if (!result) {
      throw new Error('Failed to add ticker to watchlist');
    }

    return result;
  }

  /**
   * Remove ticker from watchlist
   */
  async removeFromWatchlist(userId: string, ticker: string): Promise<void> {
    await db.query(
      'DELETE FROM watchlists WHERE user_id = $1 AND ticker = $2',
      [userId, ticker.toUpperCase()]
    );
  }

  /**
   * Update alert preferences for a watched ticker
   */
  async updateAlertPreferences(
    userId: string,
    ticker: string,
    preferences: AlertPreferences
  ): Promise<Watchlist> {
    const result = await db.queryOne<Watchlist>(
      `UPDATE watchlists
       SET alert_preferences = $1
       WHERE user_id = $2 AND ticker = $3
       RETURNING *`,
      [JSON.stringify(preferences), userId, ticker.toUpperCase()]
    );

    if (!result) {
      throw new Error('Watchlist entry not found');
    }

    return result;
  }

  /**
   * Check if user is watching a ticker
   */
  async isWatching(userId: string, ticker: string): Promise<boolean> {
    const result = await db.queryOne<{ id: number }>(
      `SELECT id FROM watchlists
       WHERE user_id = $1 AND ticker = $2`,
      [userId, ticker.toUpperCase()]
    );

    return !!result;
  }

  /**
   * Get all users watching a specific ticker
   */
  async getUsersWatchingTicker(ticker: string): Promise<string[]> {
    const results = await db.queryMany<{ user_id: string }>(
      'SELECT DISTINCT user_id FROM watchlists WHERE ticker = $1',
      [ticker.toUpperCase()]
    );

    return results.map((r) => r.user_id);
  }

  /**
   * Get tickers watched by a user
   */
  async getWatchedTickers(userId: string): Promise<string[]> {
    const results = await db.queryMany<{ ticker: string }>(
      'SELECT ticker FROM watchlists WHERE user_id = $1 ORDER BY ticker ASC',
      [userId]
    );

    return results.map((r) => r.ticker);
  }

  /**
   * Get popular tickers (most watched)
   */
  async getPopularTickers(limit: number = 20): Promise<{ ticker: string; count: number }[]> {
    return db.queryMany<{ ticker: string; count: number }>(
      `SELECT ticker, COUNT(*) as count
       FROM watchlists
       GROUP BY ticker
       ORDER BY count DESC
       LIMIT $1`,
      [limit]
    );
  }

  /**
   * Bulk add tickers to watchlist
   */
  async bulkAddToWatchlist(
    userId: string,
    tickers: string[],
    alertPreferences?: AlertPreferences
  ): Promise<Watchlist[]> {
    const prefs = alertPreferences || {
      divergence: true,
      filing: true,
      contradiction: true,
      social: false,
      severityFilter: 'medium',
    };

    const placeholders = tickers
      .map((_, i) => `($1, $${i + 2}, $${tickers.length + 2})`)
      .join(',');

    const params = [userId, ...tickers.map((t) => t.toUpperCase()), JSON.stringify(prefs)];

    return db.queryMany<Watchlist>(
      `INSERT INTO watchlists (user_id, ticker, alert_preferences)
       VALUES ${placeholders}
       ON CONFLICT (user_id, ticker) DO NOTHING
       RETURNING *`,
      params
    );
  }

  /**
   * Get watchlist count for user
   */
  async getWatchlistCount(userId: string): Promise<number> {
    const result = await db.queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM watchlists WHERE user_id = $1',
      [userId]
    );

    return result ? parseInt(result.count) : 0;
  }

  /**
   * Get user's alert preferences for a ticker
   */
  async getAlertPreferences(
    userId: string,
    ticker: string
  ): Promise<AlertPreferences | null> {
    const result = await db.queryOne<{ alert_preferences: AlertPreferences }>(
      `SELECT alert_preferences FROM watchlists
       WHERE user_id = $1 AND ticker = $2`,
      [userId, ticker.toUpperCase()]
    );

    return result?.alert_preferences || null;
  }

  /**
   * Should alert user for this ticker and severity?
   */
  async shouldAlertUser(
    userId: string,
    ticker: string,
    severity: string
  ): Promise<boolean> {
    const prefs = await this.getAlertPreferences(userId, ticker);

    if (!prefs) return false;

    // Check severity filter
    const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
    const alertSeverity = severityOrder[severity as keyof typeof severityOrder] ?? 1;
    const filterSeverity =
      severityOrder[prefs.severityFilter as keyof typeof severityOrder] ?? 1;

    return alertSeverity >= filterSeverity;
  }
}

export default WatchlistService.getInstance();
