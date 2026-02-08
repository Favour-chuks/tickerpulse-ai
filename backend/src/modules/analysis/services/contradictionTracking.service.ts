import { GoogleGenAI } from '@google/genai';
import { envConfig } from '../../../config/environmentalVariables.js';
import { logger } from '../../../config/logger.js';
import { supabase } from '../../../shared/infra/libs/supabase.js';
import redisCacheService, { CACHE_KEYS, CACHE_TTL } from '../../../shared/infra/services/cache.service.js';
import type { NarrativeContradiction, ContradictionSeverity, CompanyNarrative } from '../../../shared/types/domain.js';

interface ContradictionAnalysis {
  hasContradiction: boolean;
  contradictionType: string;
  explanation: string;
  severity: ContradictionSeverity;
  confidence: number;
  quote1: string;
  quote2: string;
}

class ContradictionTrackingService {
  private static instance: ContradictionTrackingService;
  private genAI: GoogleGenAI;

  private constructor() {
    this.genAI = new GoogleGenAI({
      apiKey: envConfig.gemini_api_key, // Using Pro for complex reasoning
    });
  }

  static getInstance(): ContradictionTrackingService {
    if (!ContradictionTrackingService.instance) {
      ContradictionTrackingService.instance =
        new ContradictionTrackingService();
    }
    return ContradictionTrackingService.instance;
  }

  /**
   * Detect contradictions between two narratives
   */
  async detectContradiction(
    ticker: string,
    narrative1: CompanyNarrative,
    narrative2: CompanyNarrative
  ): Promise<NarrativeContradiction | null> {
    try {
      // Check cache first
      const cacheKey = `contradiction:${ticker}:${narrative1.id}:${narrative2.id}`;
      const cached = await redisCacheService.get<NarrativeContradiction>(cacheKey);
      if (cached) {
        return cached;
      }

      // Analyze contradictions using Gemini Pro
      const analysis = await this.analyzeNarrativeContradiction(
        ticker,
        narrative1,
        narrative2
      );

      if (!analysis.hasContradiction) {
        return null;
      }

      // Store contradiction
      const { data, error } = await supabase
        .from('narrative_contradictions')
        .insert({
          ticker,
          narrative_1_id: narrative1.id,
          narrative_2_id: narrative2.id,
          contradiction_type: analysis.contradictionType,
          explanation: analysis.explanation,
          severity: analysis.severity,
          quote_1: analysis.quote1,
          quote_2: analysis.quote2,
          confidence_score: analysis.confidence,
          detected_at: new Date(),
          created_at: new Date(),
        })
        .select()
        .single();

      if (error) throw error;

      const contradiction = data as any;

      // Cache the result
      await redisCacheService.set(cacheKey, contradiction, CACHE_TTL.NARRATIVE_SUMMARY);

      logger.info({
        msg: 'Contradiction detected',
        ticker,
        narrative1Id: narrative1.id,
        narrative2Id: narrative2.id,
        severity: analysis.severity,
      });

      return contradiction;
    } catch (error) {
      logger.error({
        msg: 'Error detecting contradiction',
        error,
        ticker,
        narrative1Id: narrative1.id,
        narrative2Id: narrative2.id,
      });
      return null;
    }
  }

  /**
   * Analyze contradiction between two narratives using Gemini
   */
  private async analyzeNarrativeContradiction(
    ticker: string,
    narrative1: CompanyNarrative,
    narrative2: CompanyNarrative
  ): Promise<ContradictionAnalysis> {
    try {
      const prompt = `
Analyze whether these two company narratives from ${ticker} contradict each other.

NARRATIVE 1 (Earlier):
Summary: ${narrative1.summary}
Tone: ${narrative1.toneShift || 'neutral'}
Confidence: ${narrative1.managementConfidenceScore || 5}/10
Key Changes: ${narrative1.keyChanges?.map((k) => k.description).join('; ') || 'none'}

NARRATIVE 2 (Later):
Summary: ${narrative2.summary}
Tone: ${narrative2.toneShift || 'neutral'}
Confidence: ${narrative2.managementConfidenceScore || 5}/10
Key Changes: ${narrative2.keyChanges?.map((k) => k.description).join('; ') || 'none'}

Return a JSON object:
{
  "hasContradiction": true|false,
  "contradictionType": "guidance_miss|strategy_change|risk_reversal|broken_promise|none",
  "explanation": "detailed explanation of the contradiction",
  "severity": "low|medium|high|critical",
  "confidence": 0.0-1.0,
  "quote1": "key quote from narrative 1 showing the original statement",
  "quote2": "key quote from narrative 2 showing the contradiction"
}

Be analytical and objective. Only flag genuine contradictions, not natural business evolution.
Return only valid JSON, no markdown.
`;

      const model = this.genAI.chats.create({
        model: 'gemini-3-pro',
        config: {
          temperature: 0.3,
        },
      });

      const response = await model.sendMessage({ message: prompt });
      const responseText = response.text || '{}';

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          hasContradiction: false,
          contradictionType: 'none',
          explanation: 'Failed to analyze',
          severity: 'low',
          confidence: 0,
          quote1: '',
          quote2: '',
        };
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.error({
        msg: 'Error analyzing contradiction',
        error,
        ticker,
      });

      return {
        hasContradiction: false,
        contradictionType: 'none',
        explanation: 'Analysis failed',
        severity: 'low',
        confidence: 0,
        quote1: '',
        quote2: '',
      };
    }
  }

  /**
   * Get all contradictions for a ticker
   */
  async getContradictionsForTicker(
    ticker: string,
    severity?: ContradictionSeverity,
    limit: number = 50
  ): Promise<NarrativeContradiction[]> {
    try {
      const cacheKey = CACHE_KEYS.CONTRADICTIONS(ticker);

      let query = supabase
        .from('narrative_contradictions')
        .select('*')
        .eq('ticker', ticker);

      if (severity) {
        query = query.eq('severity', severity);
      }

      query = query
        .order('detected_at', { ascending: false })
        .limit(limit);

      return await redisCacheService.getOrFetch(
        cacheKey,
        async () => {
         const r = await query;
         return r.data || [];
        },
        CACHE_TTL.NARRATIVE_SUMMARY
      );
    } catch (error) {
      logger.error({
        msg: 'Error getting contradictions',
        error,
        ticker,
      });
      return [];
    }
  }

  /**
   * Get critical contradictions across all tickers
   */
  async getCriticalContradictions(limit: number = 20): Promise<NarrativeContradiction[]> {
    try {
      const { data, error } = await supabase
        .from('narrative_contradictions')
        .select('*')
        .eq('severity', 'critical')
        .order('detected_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error({ msg: 'Error getting critical contradictions', error });
      return [];
    }
  }

  /**
   * Mark contradiction as investigated/resolved
   */
  async markAsInvestigated(
    contradictionId: number,
    findings: string,
    resolution: 'valid' | 'false_positive' | 'inconclusive'
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('narrative_contradictions')
        .update({
          investigated: true,
          investigation_findings: findings,
          resolution,
          investigated_at: new Date(),
        })
        .eq('id', contradictionId);

      if (error) throw error;

      logger.info({
        msg: 'Contradiction marked as investigated',
        contradictionId,
        resolution,
      });
    } catch (error) {
      logger.error({
        msg: 'Error marking contradiction as investigated',
        error,
        contradictionId,
      });
    }
  }

  /**
   * Batch analyze narratives for contradictions
   */
  async analyzeNarrativesForContradictions(
    ticker: string,
    narratives: CompanyNarrative[]
  ): Promise<NarrativeContradiction[]> {
    const contradictions: NarrativeContradiction[] = [];

    try {
      // Compare consecutive narratives
      for (let i = 1; i < narratives.length; i++) {
        const earlier = narratives[i - 1]!;
        const later = narratives[i]!;

        const contradiction = await this.detectContradiction(
          ticker,
          earlier as any,
          later as any
        );

        if (contradiction) {
          contradictions.push(contradiction);
        }
      }

      logger.info({
        msg: 'Batch analysis complete',
        ticker,
        narrativesAnalyzed: narratives.length,
        contradictionsFound: contradictions.length,
      });

      return contradictions;
    } catch (error) {
      logger.error({
        msg: 'Error in batch analysis',
        error,
        ticker,
      });
      return contradictions;
    }
  }

  /**
   * Calculate contradiction severity based on impact
   */
  calculateContradictionSeverity(
    contradictionType: string,
    confidenceScore: number,
    narrativeConfidenceShift: number
  ): ContradictionSeverity {
    // Base severity by type
    const typeSeverity: Record<string, number> = {
      guidance_miss: 90,
      strategy_change: 70,
      risk_reversal: 80,
      broken_promise: 95,
      none: 0,
    };

    let baseSeverity = typeSeverity[contradictionType] || 50;

    // Adjust by confidence score
    baseSeverity *= confidenceScore;

    // Adjust by narrative confidence shift
    baseSeverity += Math.abs(narrativeConfidenceShift) * 10;

    // Map to severity levels
    if (baseSeverity < 30) return 'low';
    if (baseSeverity < 60) return 'medium';
    if (baseSeverity < 80) return 'high';
    return 'critical';
  }

  /**
   * Get timeline of contradictions
   */
  async getContradictionTimeline(
    ticker: string,
    daysBack: number = 90
  ): Promise<NarrativeContradiction[]> {
    try {
      const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('narrative_contradictions')
        .select('*')
        .eq('ticker', ticker)
        .gte('detected_at', startDate)
        .order('detected_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error({
        msg: 'Error getting contradiction timeline',
        error,
        ticker,
      });
      return [];
    }
  }

  /**
   * Invalidate contradiction cache
   */
  async invalidateCache(ticker: string): Promise<void> {
    const pattern = `contradiction:${ticker}:*`;
    await redisCacheService.deletePattern(pattern);
    await redisCacheService.invalidateTickerCache(ticker);
  }
}

const contradictionTrackingService = ContradictionTrackingService.getInstance();
export default contradictionTrackingService;
