import type { FastifyReply, FastifyRequest } from 'fastify';
import { alertValidationService } from '../validation.js';
import { geminiWorkerService } from '../../../modules/analysis/workers/gemini.worker.js';
import { supabaseAuthService } from '../../../modules/auth/services/supabaseAuth.service.js';

interface ValidateAlertBody {
  ticker: string;
  spike_percentage: number;
  volume: number;
  price_movement: number;
}

interface CheckDuplicateBody {
  ticker: string;
  spike_percentage: number;
  lookbackHours?: number;
}

interface ValidateContradictionBody {
  ticker: string;
  confidence_score: number;
  market_sentiment: string;
  article_sentiment: number;
}

export class ValidationController {
  /**
   * Validate a ticker alert against historical data
   */
  public validateAlert = async (
    request: FastifyRequest<{ Body: ValidateAlertBody }>,
    reply: FastifyReply
  ) => {
    try {
      const { ticker, spike_percentage, volume, price_movement } = request.body;

      if (!ticker || spike_percentage === undefined || volume === undefined) {
        return reply.code(400).send({
          error: 'ticker, spike_percentage, and volume are required',
        });
      }

      const validation = await alertValidationService.validateAlert(ticker, {
        spike_percentage,
        volume,
        price_movement,
        created_at: new Date(),
      });

      // Queue validation job for worker to process
      const jobId = await geminiWorkerService.queueJob(
        'alert_validation',
        0, // Will be filled by worker if needed
        { priority: 'high' }
      );

      return reply.send({
        ticker,
        validation,
        worker_job_id: jobId,
      });
    } catch (error) {
      reply.log.error(error);
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Validation failed',
      });
    }
  };

  /**
   * Check if alert is a duplicate
   */
  public checkDuplicate = async (
    request: FastifyRequest<{ Body: CheckDuplicateBody }>,
    reply: FastifyReply
  ) => {
    try {
      const { ticker, spike_percentage, lookbackHours } = request.body;

      if (!ticker || spike_percentage === undefined) {
        return reply.code(400).send({
          error: 'ticker and spike_percentage are required',
        });
      }

      const result = await alertValidationService.isDuplicate(
        ticker,
        {
          spike_percentage,
          created_at: new Date(),
        },
        lookbackHours
      );

      return reply.send({
        ticker,
        is_duplicate: result.isDuplicate,
        matching_alerts: result.matchingAlerts,
        message: result.isDuplicate
          ? `Found ${result.matchingAlerts.length} similar alert(s) in the last ${lookbackHours || 24} hours`
          : 'No duplicate alerts found',
      });
    } catch (error) {
      reply.log.error(error);
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Duplicate check failed',
      });
    }
  };

  /**
   * Validate a contradiction
   */
  public validateContradiction = async (
    request: FastifyRequest<{ Body: ValidateContradictionBody }>,
    reply: FastifyReply
  ) => {
    try {
      const { ticker, confidence_score, market_sentiment, article_sentiment } = request.body;

      if (ticker === undefined || confidence_score === undefined) {
        return reply.code(400).send({
          error: 'ticker and confidence_score are required',
        });
      }

      const result = await alertValidationService.validateContradiction(ticker, {
        confidence_score,
        market_sentiment,
        article_sentiment,
      });

      return reply.send({
        ticker,
        validation: result,
        confidence_score,
        market_sentiment,
        article_sentiment,
      });
    } catch (error) {
      reply.log.error(error);
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Contradiction validation failed',
      });
    }
  };

  /**
   * Get validation rules for a ticker
   */
  public getValidationRules = async (
    request: FastifyRequest<{ Querystring: { ticker?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { ticker } = request.query;

      const rules = await alertValidationService.getValidationRules(ticker);

      return reply.send({
        ticker: ticker || 'all',
        rules_count: rules.length,
        rules,
      });
    } catch (error) {
      reply.log.error(error);
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Failed to fetch rules',
      });
    }
  };

  /**
   * Record user feedback on validation accuracy
   */
  public recordFeedback = async (
    request: FastifyRequest<{
      Body: { volumeSpikeId: number; isAccurate: boolean; feedback?: string };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { volumeSpikeId, isAccurate, feedback } = request.body;

      if (volumeSpikeId === undefined || isAccurate === undefined) {
        return reply.code(400).send({
          error: 'volumeSpikeId and isAccurate are required',
        });
      }

      await alertValidationService.recordValidation(volumeSpikeId, isAccurate, feedback);

      return reply.send({
        message: 'Feedback recorded',
        volumeSpikeId,
        isAccurate,
        feedback: feedback || 'no additional feedback',
      });
    } catch (error) {
      reply.log.error(error);
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Failed to record feedback',
      });
    }
  };

  /**
   * Get validation statistics
   */
  public getValidationStats = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const supabase = supabaseAuthService.getClient();

      // Get validation statistics
      const { data: validations } = await supabase
        .from('alert_validations')
        .select('is_valid, confidence_score')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!validations || validations.length === 0) {
        return reply.send({
          total_validations: 0,
          accuracy_rate: 0,
          average_confidence: 0,
          valid_count: 0,
          invalid_count: 0,
        });
      }

      const validCount = validations.filter((v: any) => v.is_valid).length;
      const invalidCount = validations.length - validCount;
      const avgConfidence =
        validations.reduce((sum: number, v: any) => sum + (v.confidence_score || 0), 0) /
        validations.length;

      return reply.send({
        total_validations: validations.length,
        accuracy_rate: ((validCount / validations.length) * 100).toFixed(2) + '%',
        average_confidence: avgConfidence.toFixed(3),
        valid_count: validCount,
        invalid_count: invalidCount,
      });
    } catch (error) {
      reply.log.error(error);
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Failed to get stats',
      });
    }
  };
}

export const validationController = new ValidationController();
