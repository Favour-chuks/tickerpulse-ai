import { supabaseAuthService } from '../../auth/services/supabaseAuth.service.js';
import  geminiService from '../services/gemini.service.js';

interface WorkerJobConfig {
  id: string;
  job_type: string;
  ticker_id: number;
  volume_spike_id?: number;
  news_article_id?: number;
  social_mention_id?: number;
}

export class GeminiWorkerService {
  private readonly maxConcurrentJobs = 5;
  private readonly jobCheckIntervalMs = 5000; // 5 seconds

  /**
   * Start the worker daemon (polls for pending jobs)
   */
  async startWorker(): Promise<void> {
    console.log('🚀 Gemini Worker Service started');

    while (true) {
      try {
        await this.processPendingJobs();
      } catch (error) {
        console.error(
          'Worker error:',
          error instanceof Error ? error.message : String(error)
        );
      }

      // Wait before next check
      await new Promise((resolve) => setTimeout(resolve, this.jobCheckIntervalMs));
    }
  }

  /**
   * Process all pending jobs up to max concurrent
   */
  private async processPendingJobs(): Promise<void> {
    try {
      const supabase = supabaseAuthService.getClient();

      // Get pending jobs ordered by priority
      const { data: jobs, error } = await supabase
        .from('worker_jobs')
        .select('*')
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(this.maxConcurrentJobs);

      if (error) {
        console.error('Failed to fetch pending jobs:', error.message);
        return;
      }

      if (!jobs || jobs.length === 0) {
        return; // No pending jobs
      }

      // Process each job
      for (const job of jobs) {
        await this.processJob(job);
      }
    } catch (error) {
      console.error('Job processing error:', error);
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: WorkerJobConfig): Promise<void> {
    const supabase = supabaseAuthService.getClient();

    try {
      // Update job status to processing
      await supabase
        .from('worker_jobs')
        .update({
          status: 'processing',
          started_at: new Date(),
          worker_name: `gemini-worker-${process.pid}`,
        })
        .eq('id', job.id);

      let result: any;

      // Route to appropriate handler based on job type
      switch (job.job_type) {
        case 'gemini_spike_analysis':
          result = await this.handleSpikeAnalysis(job);
          break;

        case 'news_injection':
          result = await this.handleNewsInjection(job);
          break;

        case 'contradiction_check':
          result = await this.handleContradictionCheck(job);
          break;

        case 'alert_validation':
          result = await this.handleAlertValidation(job);
          break;

        default:
          throw new Error(`Unknown job type: ${job.job_type}`);
      }

      // Update job with success result
      await supabase
        .from('worker_jobs')
        .update({
          status: 'completed',
          completed_at: new Date(),
          result: result,
        })
        .eq('id', job.id);

      console.log(`✓ Completed job ${job.id} (${job.job_type})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update job with failure
      await supabase
        .from('worker_jobs')
        .update({
          status: job.retry_count < (job.max_retries || 3) ? 'pending' : 'failed',
          error_message: errorMessage,
          retry_count: (job.retry_count || 0) + 1,
          completed_at: new Date(),
        })
        .eq('id', job.id);

      console.error(`✗ Failed job ${job.id}: ${errorMessage}`);
    }
  }

  /**
   * Handle volume spike analysis with Gemini
   */
  private async handleSpikeAnalysis(job: WorkerJobConfig): Promise<any> {
    const supabase = supabaseAuthService.getClient();

    if (!job.volume_spike_id) {
      throw new Error('volume_spike_id required for spike analysis');
    }

    // Get the volume spike data
    const { data: spike, error } = await supabase
      .from('volume_spikes')
      .select(
        `
        id,
        ticker_id,
        spike_percentage,
        volume,
        price_movement,
        price_change_direction,
        unusual_pattern,
        z_score,
        tickers (symbol)
      `
      )
      .eq('id', job.volume_spike_id)
      .single();

    if (error || !spike) {
      throw new Error(`Failed to fetch spike data: ${error?.message}`);
    }

    // Prepare analysis prompt
    // ! i think i would need to do a .map for this
    const analysisPrompt = `
    Analyze this volume spike for ${spike.tickers.symbol}:
    - Spike: ${spike.spike_percentage}% increase
    - Volume: ${spike.volume}
    - Price movement: ${spike.price_movement} (${spike.price_change_direction})
    - Z-score: ${spike.z_score}
    - Pattern: ${spike.unusual_pattern}

    Provide JSON response with:
    - probable_catalysts: array of likely causes
    - catalyst_types: 'earnings', 'acquisition', 'regulation', 'news', 'unusual'
    - risk_assessment: 'high', 'medium', 'low'
    - follow_up_actions: array of next steps
    - confidence_score: 0-1

    Return valid JSON only.
    `;

    // Use Gemini to analyze
    const analysis = await geminiService.analyzeText(analysisPrompt);

    // Parse and store result
    const result = JSON.parse(analysis);

    // Update volume_spikes table with Gemini result
    await supabase
      .from('volume_spikes')
      .update({
        gemini_processed: true,
        worker_status: 'completed',
        processed_by_worker: job.id,
        metadata: {
          gemini_analysis: result,
          analyzed_at: new Date().toISOString(),
        },
      })
      .eq('id', job.volume_spike_id);

    return result;
  }

  /**
   * Handle news injection and analysis
   */
  private async handleNewsInjection(job: WorkerJobConfig): Promise<any> {
    const supabase = supabaseAuthService.getClient();

    if (!job.social_mention_id) {
      throw new Error('social_mention_id required for news injection');
    }

    // Get the social mention (news article) data
    const { data: mention, error } = await supabase
      .from('social_mentions')
      .select('id, content, ticker_id, tickers (symbol)')
      .eq('id', job.social_mention_id)
      .single();

    if (error || !mention) {
      throw new Error(`Failed to fetch social mention: ${error?.message}`);
    }

    // Analyze with Gemini
    // ! i think i would need to do a .map for this
    const analysisPrompt = `
    Analyze this financial news article about ${mention.tickers.symbol}:

    "${mention.content}"

    Provide JSON response with:
    - sentiment: 'positive', 'negative', 'neutral'
    - confidence: 0-1
    - key_themes: array of topics
    - impact_score: 0-1 (stock impact)
    - catalyst_type: 'earnings', 'acquisition', 'regulation', 'macro', 'other'
    - market_implications: brief description
    - false_positive_indicators: array of why this might be false positive

    Return valid JSON only.
    `;

    const analysis = await geminiService.analyzeText(analysisPrompt);
    const result = JSON.parse(analysis);

    // Update social mention with analysis
    await supabase
      .from('social_mentions')
      .update({
        gemini_analyzed: true,
        confidence_score: result.confidence,
        metadata: {
          gemini_analysis: result,
          analyzed_at: new Date().toISOString(),
        },
      })
      .eq('id', job.social_mention_id);

    return result;
  }

  /**
   * Handle contradiction detection and validation
   */
  private async handleContradictionCheck(job: WorkerJobConfig): Promise<any> {
    const supabase = supabaseAuthService.getClient();

    if (!job.volume_spike_id) {
      throw new Error('volume_spike_id required for contradiction check');
    }

    // Get spike and related data
    const { data: spike } = await supabase
      .from('volume_spikes')
      .select(
        `
        id,
        ticker_id,
        price_movement,
        unusual_pattern,
        tickers (symbol)
      `
      )
      .eq('id', job.volume_spike_id)
      .single();

    if (!spike) {
      throw new Error('Spike not found');
    }

    // Get recent news for this ticker
    const { data: recentNews } = await supabase
      .from('social_mentions')
      .select('content, sentiment_score, created_at, metadata')
      .eq('ticker_id', spike.ticker_id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get recent narratives
    const { data: narratives } = await supabase
      .from('company_narratives')
      .select('narrative_text, created_at')
      .eq('ticker_id', spike.ticker_id)
      .order('created_at', { ascending: false })
      .limit(5);

    // Get market trend
    const { data: trend } = await supabase
      .from('ticker_historical_snapshots')
      .select('trend, avg_sentiment_score')
      .eq('ticker_id', spike.ticker_id)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single();

    // Prepare contradiction analysis
    // ! i think i would need to do a .map for this 
    const analysisPrompt = `
    Check for narrative contradictions for ${spike.tickers.symbol}:

    Recent News Sentiment:
    ${recentNews?.map((n: any) => `- ${n.metadata?.headline || 'Unknown'}: ${n.sentiment_score}`).join('\n')}

    Company Narratives:
    ${narratives?.map((n: any) => `- ${n.narrative_text}`).join('\n')}

    Market Trend: ${trend?.trend} (avg sentiment: ${trend?.avg_sentiment_score})
    Current Price Movement: ${spike.price_movement} (pattern: ${spike.unusual_pattern})

    Identify contradictions between what company states and market news. Provide JSON with:
    - contradictions_found: boolean
    - contradiction_details: array of { statement, opposing_evidence, confidence }
    - trend_divergence: boolean
    - divergence_description: string
    - overall_confidence: 0-1

    Return valid JSON only.
    `;

    const analysis = await geminiService.analyzeText(analysisPrompt);
    const result = JSON.parse(analysis);

    // Create narrative contradiction record if found
    if (result.contradictions_found) {
      const { error } = await supabase.from('narrative_contradictions').insert({
        ticker_id: spike.ticker_id,
        volume_spike_id: spike.id,
        contradiction_type: result.contradiction_details[0]?.statement || 'detected',
        supporting_evidence: result.contradiction_details,
        confidence_score: result.overall_confidence,
        trend_context: {
          market_trend: trend?.trend,
          sentiment_divergence: result.trend_divergence,
        },
        market_sentiment: trend?.trend || 'neutral',
        article_sentiment: recentNews?.[0]?.sentiment_score || 0,
        validation_status: result.overall_confidence > 0.75 ? 'valid' : 'needs_review',
        last_validated_at: new Date(),
      });

      if (error) {
        console.error('Failed to create contradiction record:', error);
      }
    }

    return result;
  }

  /**
   * Handle alert validation against historical data
   */
  private async handleAlertValidation(job: WorkerJobConfig): Promise<any> {
    const supabase = supabaseAuthService.getClient();

    if (!job.volume_spike_id) {
      throw new Error('volume_spike_id required for validation');
    }

    // Get spike data
    const { data: spike } = await supabase
      .from('volume_spikes')
      .select('ticker_id, spike_percentage, volume, created_at')
      .eq('id', job.volume_spike_id)
      .single();

    if (!spike) {
      throw new Error('Spike not found');
    }

    // Get historical spikes for same ticker (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const { data: historicalSpikes } = await supabase
      .from('volume_spikes')
      .select('spike_percentage, volume, created_at')
      .eq('ticker_id', spike.ticker_id)
      .gt('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false });

    // Calculate similarity to previous spikes
    const similarSpikes = historicalSpikes?.filter(
      (h: any) => Math.abs(h.spike_percentage - spike.spike_percentage) < 10
    );

    // Get validation rules
    const { data: rules } = await supabase
      .from('alert_validation_rules')
      .select('*')
      .eq('is_active', true);

    // Perform validation
    const validationPrompt = `
    Validate this volume spike as a real signal vs false positive:

    Current Spike: ${spike.spike_percentage}% (${spike.volume} volume)
    Similar spikes in last 30 days: ${similarSpikes?.length || 0}
    Historical pattern: ${similarSpikes?.length || 0 > 2 ? 'recurring' : 'unusual'}

    Validation rules to apply:
    ${rules?.map((r: any) => `- ${r.rule_name}: ${r.description}`).join('\n')}

    Provide JSON with:
    - is_valid: boolean
    - confidence_score: 0-1
    - false_positive_probability: 0-1
    - reasons: array of validation reasons
    - recommendation: 'alert', 'hold', 'dismiss'

    Return valid JSON only.
    `;

    const analysis = await geminiService.analyzeText(validationPrompt);
    const result = JSON.parse(analysis);

    // Store validation result
    await supabase.from('alert_validations').insert({
      volume_spike_id: job.volume_spike_id,
      is_valid: result.is_valid,
      confidence_score: result.confidence_score,
      validation_details: result,
    });

    return result;
  }

  /**
   * Queue a new job for async processing
   */
  async queueJob(
    jobType: string,
    tickerId: number,
    options?: {
      volumeSpikeId?: number;
      socialMentionId?: number;
      priority?: 'high' | 'normal' | 'low';
    }
  ): Promise<string> {
    try {
      const supabase = supabaseAuthService.getClient();

      const { data, error } = await supabase
        .from('worker_jobs')
        .insert({
          job_type: jobType,
          ticker_id: tickerId,
          volume_spike_id: options?.volumeSpikeId,
          social_mention_id: options?.socialMentionId,
          priority: options?.priority || 'normal',
          status: 'pending',
        })
        .select('id')
        .single();

      if (error || !data) {
        throw new Error(`Failed to queue job: ${error?.message}`);
      }

      console.log(`📋 Queued job ${data.id} (${jobType})`);
      return data.id;
    } catch (error) {
      throw new Error(
        `Job queueing failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<any> {
    const supabase = supabaseAuthService.getClient();

    const { data, error } = await supabase
      .from('worker_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !data) {
      throw new Error(`Failed to get job status: ${error?.message}`);
    }

    return data;
  }
}

export const geminiWorkerService = new GeminiWorkerService();
