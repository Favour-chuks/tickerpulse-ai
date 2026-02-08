import { GoogleGenAI } from '@google/genai';
import { envConfig } from '../../../config/environmentalVariables.js';
import { logger } from '../../../config/logger.js';
import { supabase } from '../../../shared/infra/libs/supabase.js';
import redisCacheService, { CACHE_KEYS, CACHE_TTL } from '../../../shared/infra/services/cache.service.js';
import type { CompanyPromise } from '../../../shared/types/domain.js';

interface PromiseExtractionRequest {
  ticker: string;
  filingId: number;
  filingContent: string;
  filingType: string;
}

interface ExtractedPromise {
  text: string;
  context: string;
  expectedDate?: string;
  category: string;
  confidence: number;
}

class PromiseExtractionService {
  private static instance: PromiseExtractionService;
  private genAI: GoogleGenAI;

  private constructor() {
    this.genAI = new GoogleGenAI({
      apiKey: envConfig.gemini_api_key, // Using Pro for complex analysis
    });
  }

  static getInstance(): PromiseExtractionService {
    if (!PromiseExtractionService.instance) {
      PromiseExtractionService.instance = new PromiseExtractionService();
    }
    return PromiseExtractionService.instance;
  }

  /**
   * Extract promises from SEC filing using Gemini Pro
   */
  async extractPromisesFromFiling(
    request: PromiseExtractionRequest
  ): Promise<ExtractedPromise[]> {
    try {
      const cacheKey = `promises:filing:${request.filingId}`;

      // Check cache first
      const cached = await redisCacheService.get<ExtractedPromise[]>(cacheKey);
      if (cached) {
        logger.info({
          msg: 'Promises found in cache',
          filingId: request.filingId,
          ticker: request.ticker,
        });
        return cached;
      }

      // Extract relevant sections for promise analysis
      const relevantSections = this.extractRelevantSections(
        request.filingContent,
        request.filingType
      );

      // Batch multiple extraction tasks for efficiency
      const extractionPrompt = `
Analyze the following SEC filing sections and extract company promises/commitments.

FILING TYPE: ${request.filingType}
TICKER: ${request.ticker}

CONTENT:
${relevantSections}

Extract ONLY explicit promises, guidance, or commitments made by the company.

Return a JSON array with objects containing:
{
  "text": "exact promise text from filing",
  "context": "surrounding context (1-2 sentences)",
  "expectedDate": "when the promise should be fulfilled (e.g., 'Q3 2025', 'next fiscal year')",
  "category": "product|revenue|market|technology|partnership|other",
  "confidence": 0.0-1.0
}

Be strict - only include clear commitments, not general statements.
Return only valid JSON array, no markdown.
`;

      const model = this.genAI.chats.create({
        model: 'gemini-3-pro',
        config: {
          temperature: 0.2, // Low temperature for accuracy
        },
      });

      const response = await model.sendMessage({ message: extractionPrompt });
      const responseText = response.text || '[]';

      // Parse JSON response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        logger.warn({
          msg: 'Failed to parse promise extraction response',
          filingId: request.filingId,
        });
        return [];
      }

      const extractedPromises: ExtractedPromise[] = JSON.parse(jsonMatch[0]);

      // Filter low-confidence promises
      const validPromises = extractedPromises.filter((p) => p.confidence > 0.5);

      // Cache results
      await redisCacheService.set(
        cacheKey,
        validPromises,
        CACHE_TTL.NARRATIVE_SUMMARY
      );

      logger.info({
        msg: 'Promises extracted from filing',
        filingId: request.filingId,
        ticker: request.ticker,
        count: validPromises.length,
      });

      return validPromises;
    } catch (error) {
      logger.error({
        msg: 'Error extracting promises',
        error,
        filingId: request.filingId,
      });
      return [];
    }
  }

  /**
   * Store extracted promises in database
   */
  async storePromises(
    ticker: string,
    filingId: number,
    promises: ExtractedPromise[]
  ): Promise<CompanyPromise[]> {
    try {
      const storedPromises: CompanyPromise[] = [];

      for (const promise of promises) {
        const { data, error } = await supabase
          .from('company_promises')
          .insert({
            ticker,
            filing_id: filingId,
            promise_text: promise.text,
            promise_context: {
              context: promise.context,
              category: promise.category,
              confidence: promise.confidence,
            },
            promise_date: new Date(),
            expected_fulfillment_date: this.parseExpectedDate(promise.expectedDate),
            status: 'pending',
            created_at: new Date(),
            updated_at: new Date(),
          })
          .select();

        if (error) {
          logger.error({
            msg: 'Error storing promise',
            error,
            ticker,
            promise: promise.text.substring(0, 50),
          });
          continue;
        }

        if (data && data[0]) {
          storedPromises.push(data[0] as any);
        }
      }

      // Invalidate cache
      await redisCacheService.invalidateTickerCache(ticker);

      logger.info({
        msg: 'Promises stored',
        ticker,
        filingId,
        count: storedPromises.length,
      });

      return storedPromises;
    } catch (error) {
      logger.error({ msg: 'Error storing promises', error, ticker, filingId });
      return [];
    }
  }

  /**
   * Get all promises for a ticker
   */
  async getPromisesForTicker(ticker: string): Promise<CompanyPromise[]> {
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
   * Get pending promises for a ticker
   */
  async getPendingPromisesForTicker(ticker: string): Promise<CompanyPromise[]> {
    try {
      const { data, error } = await supabase
        .from('company_promises')
        .select('*')
        .eq('ticker', ticker)
        .eq('status', 'pending')
        .order('expected_fulfillment_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error({ msg: 'Error getting pending promises', error, ticker });
      return [];
    }
  }

  /**
   * Update promise status
   */
  async updatePromiseStatus(
    promiseId: number,
    status: 'kept' | 'broken' | 'pending' | 'partially_met',
    verificationNotes: string,
    verificationFilingId?: number
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('company_promises')
        .update({
          status,
          verification_notes: verificationNotes,
          verification_filing_id: verificationFilingId,
          updated_at: new Date(),
        })
        .eq('id', promiseId);

      if (error) throw error;

      // Invalidate ticker cache
      const promise = await supabase
        .from('company_promises')
        .select('ticker')
        .eq('id', promiseId)
        .single();

      if (promise.data) {
        await redisCacheService.invalidateTickerCache(promise.data.ticker);
      }

      logger.info({
        msg: 'Promise status updated',
        promiseId,
        status,
      });
    } catch (error) {
      logger.error({ msg: 'Error updating promise status', error, promiseId });
    }
  }

  /**
   * Compare promises across filings to detect changes in guidance
   */
  async comparePromisesAcrossFilings(
    ticker: string,
    filingId1: number,
    filingId2: number
  ): Promise<{
    newPromises: ExtractedPromise[];
    removedPromises: ExtractedPromise[];
    changedPromises: { old: ExtractedPromise; new: ExtractedPromise }[];
  }> {
    try {
      const { data: promises1 } = await supabase
        .from('company_promises')
        .select('*')
        .eq('ticker', ticker)
        .eq('filing_id', filingId1);

      const { data: promises2 } = await supabase
        .from('company_promises')
        .select('*')
        .eq('ticker', ticker)
        .eq('filing_id', filingId2);

      const set1 = new Set((promises1 || []).map((p: any) => p.promise_text));
      const set2 = new Set((promises2 || []).map((p: any) => p.promise_text));

      return {
        newPromises: (promises2 || [])
          .filter((p: any) => !set1.has(p.promise_text))
          .map((p: any) => ({
            text: p.promise_text,
            context: p.promise_context?.context || '',
            expectedDate: p.expected_fulfillment_date,
            category: p.promise_context?.category || 'other',
            confidence: p.promise_context?.confidence || 0.8,
          })),
        removedPromises: (promises1 || [])
          .filter((p: any) => !set2.has(p.promise_text))
          .map((p: any) => ({
            text: p.promise_text,
            context: p.promise_context?.context || '',
            expectedDate: p.expected_fulfillment_date,
            category: p.promise_context?.category || 'other',
            confidence: p.promise_context?.confidence || 0.8,
          })),
        changedPromises: [],
      };
    } catch (error) {
      logger.error({
        msg: 'Error comparing promises',
        error,
        ticker,
        filingId1,
        filingId2,
      });
      return {
        newPromises: [],
        removedPromises: [],
        changedPromises: [],
      };
    }
  }

  /**
   * Extract relevant sections from filing based on type
   */
  private extractRelevantSections(content: string, filingType: string): string {
    const sections = content.split(/\n(?=[A-Z\s]{5,})/);

    const relevantKeywords = [
      'guidance',
      'outlook',
      'commitment',
      'plan',
      'will launch',
      'will release',
      'expect',
      'anticipate',
      'target',
      'goal',
      'forecast',
      'initiative',
      'strategy',
    ];

    return sections
      .filter((section) =>
        relevantKeywords.some((kw) =>
          section.toLowerCase().includes(kw)
        )
      )
      .slice(0, 5)
      .join('\n\n')
      .substring(0, 3000);
  }

  /**
   * Parse expected date from text
   */
  private parseExpectedDate(dateText?: string): Date | null {
    if (!dateText) return null;

    const year = new Date().getFullYear();
    const datePatterns = [
      { regex: /Q([1-4])\s*(\d{4})/i, handler: (m: any) => this.quarterToDate(parseInt(m[1]), parseInt(m[2])) },
      { regex: /(\d{4})-Q([1-4])/i, handler: (m: any) => this.quarterToDate(parseInt(m[2]), parseInt(m[1])) },
      { regex: /next\s+(?:fiscal\s+)?year/i, handler: () => new Date(year + 1, 0, 1) },
      { regex: /end\s+of\s+(\d{4})/i, handler: (m: any) => new Date(parseInt(m[1]), 11, 31) },
      { regex: /(\d{1,2})\/(\d{1,2})\/(\d{4})/i, handler: (m: any) => new Date(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2])) },
    ];

    for (const pattern of datePatterns) {
      const match = dateText.match(pattern.regex);
      if (match) {
        const date = pattern.handler(match);
        if (date && !isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return null;
  }

  /**
   * Convert quarter to date
   */
  private quarterToDate(quarter: number, year: number): Date {
    const month = (quarter - 1) * 3 + 2; // Mid-quarter
    return new Date(year, month, 15);
  }
}

const promiseExtractionService = PromiseExtractionService.getInstance();
export default promiseExtractionService;
