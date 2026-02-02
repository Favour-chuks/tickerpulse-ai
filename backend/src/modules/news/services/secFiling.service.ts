import db from '../libs/database.js';
import geminiService from '../../analysis/services/gemini.service.js';
import type { SECFiling, CompanyNarrative, FilingType } from '../../../shared/types/domain.js';

class SECFilingService {
  private static instance: SECFilingService;

  private constructor() {}

  static getInstance(): SECFilingService {
    if (!SECFilingService.instance) {
      SECFilingService.instance = new SECFilingService();
    }
    return SECFilingService.instance;
  }

  /**
   * Store a new SEC filing
   */
  async storeFiling(
    ticker: string,
    filingType: FilingType,
    accessionNumber: string,
    filedAt: Date,
    url: string,
    rawContent: string
  ): Promise<SECFiling> {
    try {
      const result = await db.queryOne<SECFiling>(
        `INSERT INTO sec_filings 
         (ticker, filing_type, accession_number, filed_at, url, raw_content)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [ticker, filingType, accessionNumber, filedAt, url, rawContent]
      );

      if (!result) {
        throw new Error('Failed to insert filing');
      }

      return result;
    } catch (error) {
      console.error('Error storing filing', error);
      throw error;
    }
  }

  /**
   * Get filing by accession number
   */
  async getFilingByAccession(accessionNumber: string): Promise<SECFiling | null> {
    return db.queryOne<SECFiling>(
      'SELECT * FROM sec_filings WHERE accession_number = $1',
      [accessionNumber]
    );
  }

  /**
   * Get filings for a ticker
   */
  async getFilingsForTicker(
    ticker: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<SECFiling[]> {
    return db.queryMany<SECFiling>(
      `SELECT * FROM sec_filings
       WHERE ticker = $1
       ORDER BY filed_at DESC
       LIMIT $2 OFFSET $3`,
      [ticker, limit, offset]
    );
  }

  /**
   * Get most recent filing of a type
   */
  async getMostRecentFilingOfType(
    ticker: string,
    filingType: FilingType
  ): Promise<SECFiling | null> {
    return db.queryOne<SECFiling>(
      `SELECT * FROM sec_filings
       WHERE ticker = $1 AND filing_type = $2
       ORDER BY filed_at DESC
       LIMIT 1`,
      [ticker, filingType]
    );
  }

  /**
   * Get unprocessed filings
   */
  async getUnprocessedFilings(limit: number = 50): Promise<SECFiling[]> {
    return db.queryMany<SECFiling>(
      `SELECT * FROM sec_filings
       WHERE processed = FALSE
       ORDER BY filed_at DESC
       LIMIT $1`,
      [limit]
    );
  }

  /**
   * Mark filing as material after analysis
   */
  async markFilingMaterial(
    filingId: number,
    isMaterial: boolean,
    reason?: string
  ): Promise<void> {
    await db.query(
      `UPDATE sec_filings 
       SET is_material = $1, processing_error = $2
       WHERE id = $3`,
      [isMaterial, reason || null, filingId]
    );
  }

  /**
   * Mark filing as processed
   */
  async markFilingProcessed(filingId: number): Promise<void> {
    await db.query(
      `UPDATE sec_filings 
       SET processed = TRUE, updated_at = NOW()
       WHERE id = $1`,
      [filingId]
    );
  }

  /**
   * Process a filing and generate narrative
   */
  async processFilingNarrative(
    filingId: number,
    ticker: string,
    filingType: FilingType,
    rawContent: string
  ): Promise<CompanyNarrative | null> {
    try {
      // Get previous filing for comparison
      const previousFiling = await this.getMostRecentFilingOfType(ticker, filingType);
      const previousFilingText = previousFiling?.rawContent || undefined;

      // Get filing date
      const filing = await db.queryOne<{ filed_at: Date }>(
        'SELECT filed_at FROM sec_filings WHERE id = $1',
        [filingId]
      );

      if (!filing) {
        throw new Error('Filing not found');
      }

      // Analyze using Gemini
      const analysis = await geminiService.analyzeFilingNarrative(
        ticker,
        filingType,
        filing.filed_at.toISOString(),
        rawContent,
        previousFilingText
      );

      // Store narrative
      const result = await db.queryOne<CompanyNarrative>(
        `INSERT INTO company_narratives 
         (filing_id, ticker, summary, key_changes, risk_changes, tone_shift, 
          guidance, management_confidence_score, language_shifts)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          filingId,
          ticker,
          analysis.summary,
          JSON.stringify(analysis.keyChanges),
          JSON.stringify(analysis.languageShifts),
          analysis.tone,
          JSON.stringify(analysis.languageShifts),
          analysis.confidenceScore,
          JSON.stringify(analysis.languageShifts),
        ]
      );

      return result;
    } catch (error) {
      console.error('Error processing filing narrative', error);
      await db.query(
        `UPDATE sec_filings 
         SET processing_error = $1
         WHERE id = $2`,
        [error instanceof Error ? error.message : 'Unknown error', filingId]
      );
      return null;
    }
  }

  /**
   * Get narratives for a ticker
   */
  async getNarrativesForTicker(
    ticker: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<CompanyNarrative[]> {
    return db.queryMany<CompanyNarrative>(
      `SELECT n.* FROM company_narratives n
       JOIN sec_filings f ON n.filing_id = f.id
       WHERE n.ticker = $1
       ORDER BY f.filed_at DESC
       LIMIT $2 OFFSET $3`,
      [ticker, limit, offset]
    );
  }

  /**
   * Get narrative by ID
   */
  async getNarrativeById(narrativeId: number): Promise<CompanyNarrative | null> {
    return db.queryOne<CompanyNarrative>(
      'SELECT * FROM company_narratives WHERE id = $1',
      [narrativeId]
    );
  }

  /**
   * Store filing processing event in audit log
   */
  async auditFilingProcessing(
    filingId: number,
    action: string,
    details?: Record<string, any>
  ): Promise<void> {
    await db.query(
      `INSERT INTO audit_log (action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4)`,
      ['filing_processed', 'filing', filingId, JSON.stringify(details || {})]
    );
  }

  /**
   * Get recent filings for a watchlist
   */
  async getRecentFilingsForWatchlist(
    tickers: string[],
    hoursBack: number = 24
  ): Promise<SECFiling[]> {
    if (tickers.length === 0) return [];

    const placeholders = tickers.map((_, i) => `$${i + 1}`).join(',');
    return db.queryMany<SECFiling>(
      `SELECT * FROM sec_filings
       WHERE ticker IN (${placeholders})
       AND filed_at >= NOW() - INTERVAL '${hoursBack} hours'
       AND is_material = TRUE
       ORDER BY filed_at DESC`,
      tickers
    );
  }

  /**
   * Store promise extracted from filing
   */
  async storePromiseFromFiling(
    ticker: string,
    filingId: number,
    promiseText: string,
    promiseDate: Date,
    expectedFulfillmentDate?: Date
  ): Promise<number> {
    const result = await db.queryOne<{ id: number }>(
      `INSERT INTO company_promises 
       (ticker, filing_id, promise_text, promise_date, expected_fulfillment_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [ticker, filingId, promiseText, promiseDate, expectedFulfillmentDate || null]
    );

    if (!result) {
      throw new Error('Failed to store promise');
    }

    return result.id;
  }

  /**
   * Get pending promises for a ticker
   */
  async getPendingPromises(ticker: string): Promise<any[]> {
    return db.queryMany(
      `SELECT * FROM company_promises
       WHERE ticker = $1 
       AND status = 'pending'
       AND expected_fulfillment_date <= NOW()
       ORDER BY expected_fulfillment_date ASC`,
      [ticker]
    );
  }

  /**
   * Update promise fulfillment status
   */
  async updatePromiseStatus(
    promiseId: number,
    status: string,
    verificationNotes: string,
    verificationFilingId?: number
  ): Promise<void> {
    await db.query(
      `UPDATE company_promises 
       SET status = $1, verification_notes = $2, verification_filing_id = $3, updated_at = NOW()
       WHERE id = $4`,
      [status, verificationNotes, verificationFilingId || null, promiseId]
    );
  }
}

export default SECFilingService.getInstance();
