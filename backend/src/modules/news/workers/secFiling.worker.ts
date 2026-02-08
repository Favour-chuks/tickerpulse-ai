import type { Job } from 'bull';
import axios from 'axios';
import { logger } from '../../../config/logger.js';
import { supabase } from '../../../shared/infra/libs/supabase.js';
import redisCacheService from '../../../shared/infra/services/cache.service.js';

interface SECFilingJob {
  tickers: string[];
}

interface EDGARFiling {
  accessionNumber: string;
  filedAt: string;
  form: string;
  filingUrl: string;
}

/**
 * SEC Filing Worker
 * Checks for new SEC filings daily
 * Stores filing metadata and queues content for analysis
 */
export async function processSECFilingJob(job: Job<SECFilingJob>): Promise<void> {
  try {
    const { tickers } = job.data;
    logger.info({ msg: 'Processing SEC filing job', tickers: tickers.length });

    const allFilings: (EDGARFiling & { ticker: string })[] = [];

    for (const ticker of tickers) {
      try {
        const filings = await fetchFilingsFromEDGAR(ticker);
        if (filings && filings.length > 0) {
          allFilings.push(
            ...filings.map((f) => ({
              ...f,
              ticker,
            }))
          );
        }
      } catch (error) {
        logger.error({
          msg: 'Error fetching filings for ticker',
          error,
          ticker,
        });
      }
    }

    await storeFilingsInDatabase(allFilings);

    logger.info({
      msg: 'SEC filing job complete',
      filingsProcessed: allFilings.length,
    });

    return;
  } catch (error) {
    logger.error({ msg: 'Error in SEC filing job', error });
    throw error;
  }
}

/**
 * Fetch filings from SEC EDGAR API
 */
async function fetchFilingsFromEDGAR(ticker: string): Promise<EDGARFiling[]> {
  try {
    const cikResponse = await axios.get(
      `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${ticker}&type=10-K,10-Q,8-K&dateb=&owner=exclude&count=100&output=json`,
      { timeout: 10000 }
    );

    if (!cikResponse.data.filings || !cikResponse.data.filings.filing) {
      return [];
    }

    const filings = Array.isArray(cikResponse.data.filings.filing)
      ? cikResponse.data.filings.filing
      : [cikResponse.data.filings.filing];

    return filings
      .slice(0, 10)
      .map((filing: any) => ({
        accessionNumber: filing['accession-number'],
        filedAt: filing['filing-date'],
        form: filing['form-type'],
        filingUrl: `https://www.sec.gov/cgi-bin/viewer?action=view&cik=${cikResponse.data.cik}&accession_number=${filing['accession-number']}&xbrl_type=v`,
      }));
  } catch (error) {
    logger.error({
      msg: 'SEC EDGAR API error',
      error: (error as any)?.message,
      ticker,
    });
    return [];
  }
}

/**
 * Store filings in Supabase with deduplication
 */
async function storeFilingsInDatabase(
  filings: (EDGARFiling & { ticker: string })[]
): Promise<void> {
  try {
    if (filings.length === 0) return;

    // Check for existing filings
    const accessionNumbers = filings.map((f) => f.accessionNumber);
    const { data: existingFilings } = await supabase
      .from('sec_filings')
      .select('accession_number')
      .in('accession_number', accessionNumbers);

    const existingAccessions = new Set(
      (existingFilings || []).map((f: any) => f.accession_number)
    );

    // Filter out duplicates
    const newFilings = filings.filter((f) => !existingAccessions.has(f.accessionNumber));

    if (newFilings.length === 0) {
      logger.info({ msg: 'No new filings to store' });
      return;
    }

    // Get ticker IDs
    const tickers = [...new Set(newFilings.map((f) => f.ticker))];
    const { data: tickerRecords } = await supabase
      .from('tickers')
      .select('id, symbol')
      .in('symbol', tickers);

    const tickerMap = new Map((tickerRecords || []).map((t: any) => [t.symbol, t.id]));

    // Map form types to our enum
    const formTypeMap: Record<string, string> = {
      '10-K': '10-K',
      '10-Q': '10-Q',
      '8-K': '8-K',
      'DEF 14A': 'DEF 14A',
      'S-1': 'S-1',
    };

    // Prepare records
    const recordsToInsert = newFilings.map((filing) => ({
      ticker_id: tickerMap.get(filing.ticker),
      filing_type: formTypeMap[filing.form] || filing.form,
      accession_number: filing.accessionNumber,
      filed_at: new Date(filing.filedAt).toISOString(),
      url: filing.filingUrl,
      is_material: determineMateriality(filing.form),
      processed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { data: insertedFilings, error } = await supabase
      .from('sec_filings')
      .insert(recordsToInsert)
      .select();

    if (error) {
      logger.error({ msg: 'Error storing filings', error });
      return;
    }

    logger.info({
      msg: 'Filings stored',
      count: insertedFilings?.length || 0,
    });

    // Invalidate cache for affected tickers
    for (const ticker of tickers) {
      await redisCacheService.invalidateTickerCache(ticker);
    }
  } catch (error) {
    logger.error({ msg: 'Error storing filings in database', error });
  }
}

/**
 * Determine if filing is material
 */
function determineMateriality(formType: string): boolean {
  const materialForms = ['10-K', '10-Q', '8-K', 'DEF 14A'];
  return materialForms.includes(formType);
}

export { processSECFilingJob as secFilingWorker };
