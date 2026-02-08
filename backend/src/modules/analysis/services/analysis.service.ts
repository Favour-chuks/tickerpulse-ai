
import { supabase } from '../../../shared/infra/libs/supabase.js';
import redisCacheService, {
  CACHE_KEYS,
  CACHE_TTL,
} from '../../../shared/infra/services/cache.service.js';
import promiseExtractionService from './promiseExtraction.service.js';
import contradictionTrackingService from './contradictionTracking.service.js';
import { logger } from '../../../config/logger.js';

/**
 * Analysis Service
 * Handles filing analysis, promise tracking, and contradiction detection
 */
class AnalysisService {
  private static instance: AnalysisService;

  private constructor() {}

  static getInstance(): AnalysisService {
    if (!AnalysisService.instance) {
      AnalysisService.instance = new AnalysisService();
    }
    return AnalysisService.instance;
  }

  /**
   * Analyze a filing
   */
  async analyzeFiling(ticker: string, filingId: number): Promise<any> {
    try {
      const cacheKey = `filing:analysis:${filingId}`;

      // Check cache
      const cached = await redisCacheService.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Get filing
      const { data: filing } = await supabase
        .from('sec_filings')
        .select('*')
        .eq('id', filingId)
        .eq('ticker', ticker)
        .single();

      if (!filing) {
        throw new Error('Filing not found');
      }

      // Get narrative for this filing
      const { data: narratives } = await supabase
        .from('company_narratives')
        .select('*')
        .eq('filing_id', filingId)
        .eq('ticker', ticker);

      // Prepare analysis result
      const analysis = {
        filingId,
        ticker,
        filingType: filing.filing_type,
        filedAt: filing.filed_at,
        url: filing.url,
        narrative: narratives?.[0] || null,
        status: filing.processed ? 'analyzed' : 'pending',
      };

      // Cache result
      await redisCacheService.set(cacheKey, analysis, CACHE_TTL.NARRATIVE_SUMMARY);

      return analysis;
    } catch (error) {
      logger.error({ msg: 'Error analyzing filing', error, ticker, filingId });
      throw error;
    }
  }

  /**
   * Get promises for a ticker
   */
  async getPromisesForTicker(ticker: string): Promise<any[]> {
    try {
      const cacheKey = CACHE_KEYS.PROMISES(ticker);

      return await redisCacheService.getOrFetch(
        cacheKey,
        async () => {
          const { data } = await supabase
            .from('company_promises')
            .select('*')
            .eq('ticker', ticker)
            .order('promise_date', { ascending: false });
          return data || [];
        },
        CACHE_TTL.NARRATIVE_SUMMARY
      );
    } catch (error) {
      logger.error({ msg: 'Error getting promises', error, ticker });
      return [];
    }
  }

  /**
   * Compare two filings
   */
  async compareFilings(
    ticker: string,
    filingId1: number,
    filingId2: number
  ): Promise<any> {
    try {
      const cacheKey = `compare:${ticker}:${filingId1}:${filingId2}`;

      // Check cache
      const cached = await redisCacheService.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Get both filings
      const { data: filing1 } = await supabase
        .from('sec_filings')
        .select('*')
        .eq('id', filingId1)
        .eq('ticker', ticker)
        .single();

      const { data: filing2 } = await supabase
        .from('sec_filings')
        .select('*')
        .eq('id', filingId2)
        .eq('ticker', ticker)
        .single();

      if (!filing1 || !filing2) {
        throw new Error('One or both filings not found');
      }

      // Get narratives
      const { data: narrative1 } = await supabase
        .from('company_narratives')
        .select('*')
        .eq('filing_id', filingId1)
        .single();

      const { data: narrative2 } = await supabase
        .from('company_narratives')
        .select('*')
        .eq('filing_id', filingId2)
        .single();

      // Compare promises
      const promiseComparison = await promiseExtractionService.comparePromisesAcrossFilings(
        ticker,
        filingId1,
        filingId2
      );

      const comparison = {
        filing1: {
          id: filingId1,
          type: filing1.filing_type,
          date: filing1.filed_at,
          narrative: narrative1,
        },
        filing2: {
          id: filingId2,
          type: filing2.filing_type,
          date: filing2.filed_at,
          narrative: narrative2,
        },
        changes: {
          newPromises: promiseComparison.newPromises,
          removedPromises: promiseComparison.removedPromises,
          narrativeShifts: this.compareNarratives(narrative1, narrative2),
        },
      };

      // Cache comparison
      await redisCacheService.set(cacheKey, comparison, CACHE_TTL.NARRATIVE_SUMMARY);

      return comparison;
    } catch (error) {
      logger.error({
        msg: 'Error comparing filings',
        error,
        ticker,
        filingId1,
        filingId2,
      });
      throw error;
    }
  }

  /**
   * Get contradictions for a ticker
   */
  async getContradictionsForTicker(ticker: string, severity?: string): Promise<any[]> {
    try {
      return await contradictionTrackingService.getContradictionsForTicker(
        ticker,
        severity as any
      );
    } catch (error) {
      logger.error({ msg: 'Error getting contradictions', error, ticker });
      return [];
    }
  }

  /**
   * Get recent filings for a ticker
   */
  async getRecentFilings(ticker: string, limit: number = 10): Promise<any[]> {
    try {
      const cacheKey = CACHE_KEYS.SEC_FILINGS(ticker);

      return await redisCacheService.getOrFetch(
        cacheKey,
        async () => {
          const { data } = await supabase
            .from('sec_filings')
            .select('*')
            .eq('ticker', ticker)
            .order('filed_at', { ascending: false })
            .limit(limit);
          return data || [];
        },
        CACHE_TTL.SEC_FILINGS
      );
    } catch (error) {
      logger.error({ msg: 'Error getting recent filings', error, ticker });
      return [];
    }
  }

  /**
   * Compare two narratives
   */
  private compareNarratives(narrative1: any, narrative2: any): Record<string, any> {
    if (!narrative1 || !narrative2) {
      return {};
    }

    return {
      toneShiftFrom: narrative1.tone_shift,
      toneShiftTo: narrative2.tone_shift,
      confidenceFrom: narrative1.management_confidence_score,
      confidenceTo: narrative2.management_confidence_score,
      keyChangesOld: narrative1.key_changes || [],
      keyChangesNew: narrative2.key_changes || [],
      summaryChange: {
        old: narrative1.summary?.substring(0, 100),
        new: narrative2.summary?.substring(0, 100),
      },
    };
  }

  /**
   * Get filing narrative
   */
  async getFilingNarrative(ticker: string, filingId: number): Promise<any> {
    try {
      const { data } = await supabase
        .from('company_narratives')
        .select('*')
        .eq('ticker', ticker)
        .eq('filing_id', filingId)
        .single();

      return data || null;
    } catch (error) {
      logger.error({
        msg: 'Error getting filing narrative',
        error,
        ticker,
        filingId,
      });
      return null;
    }
  }

  /**
   * Get all narratives for ticker
   */
  async getNarrativesForTicker(ticker: string, limit: number = 20): Promise<any[]> {
    try {
      const cacheKey = CACHE_KEYS.NARRATIVE(ticker);

      return await redisCacheService.getOrFetch(
        cacheKey,
        async () => {
          const { data } = await supabase
            .from('company_narratives')
            .select('*')
            .eq('ticker', ticker)
            .order('created_at', { ascending: false })
            .limit(limit);
          return data || [];
        },
        CACHE_TTL.NARRATIVE_SUMMARY
      );
    } catch (error) {
      logger.error({ msg: 'Error getting narratives', error, ticker });
      return [];
    }
  }
}

const analysisService = AnalysisService.getInstance();
export default analysisService;
