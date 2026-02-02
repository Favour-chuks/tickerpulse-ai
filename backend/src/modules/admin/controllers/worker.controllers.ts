import type { FastifyReply, FastifyRequest } from 'fastify';
import { geminiWorkerService } from '../../analysis/workers/gemini.worker.js';
import { supabaseAuthService } from '../../auth/services/supabaseAuth.service.js';

interface QueueJobBody {
  jobType: string;
  tickerId: number;
  volumeSpikeId?: number;
  socialMentionId?: number;
  priority?: 'high' | 'normal' | 'low';
}

export class WorkerController {
  /**
   * Queue a new worker job
   */
  public queueJob = async (
    request: FastifyRequest<{ Body: QueueJobBody }>,
    reply: FastifyReply
  ) => {
    try {
      const { jobType, tickerId, volumeSpikeId, socialMentionId, priority } = request.body;

      if (!jobType || !tickerId) {
        return reply.code(400).send({
          error: 'jobType and tickerId are required',
        });
      }

      const jobId = await geminiWorkerService.queueJob(jobType, tickerId, {
        volumeSpikeId,
        socialMentionId,
        priority,
      });

      return reply.code(201).send({
        message: 'Job queued successfully',
        jobId,
        jobType,
        status: 'pending',
      });
    } catch (error) {
      reply.log.error(error);
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Job queueing failed',
      });
    }
  };

  /**
   * Get job status
   */
  public getJobStatus = async (
    request: FastifyRequest<{ Params: { jobId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { jobId } = request.params;

      const job = await geminiWorkerService.getJobStatus(jobId);

      return reply.send({
        jobId,
        ...job,
      });
    } catch (error) {
      reply.log.error(error);
      return reply.code(404).send({
        error: error instanceof Error ? error.message : 'Job not found',
      });
    }
  };

  /**
   * Get worker statistics
   */
  public getWorkerStats = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const supabase = supabaseAuthService.getClient();

      // Get job counts by status and type
      const { data: jobStats } = await supabase
        .from('worker_jobs')
        .select('job_type, status')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (!jobStats) {
        return reply.send({
          total_jobs: 0,
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          by_type: {},
        });
      }

      const stats = {
        total_jobs: jobStats.length,
        pending: jobStats.filter((j: any) => j.status === 'pending').length,
        processing: jobStats.filter((j: any) => j.status === 'processing').length,
        completed: jobStats.filter((j: any) => j.status === 'completed').length,
        failed: jobStats.filter((j: any) => j.status === 'failed').length,
        by_type: {} as Record<string, any>,
      };

      // Group by job type
      jobStats.forEach((job: any) => {
        if (!stats.by_type[job.job_type]) {
          stats.by_type[job.job_type] = {
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
            total: 0,
          };
        }
        stats.by_type[job.job_type][job.status]++;
        stats.by_type[job.job_type].total++;
      });

      return reply.send(stats);
    } catch (error) {
      reply.log.error(error);
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Failed to get stats',
      });
    }
  };

  /**
   * Get failed jobs
   */
  public getFailedJobs = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const supabase = supabaseAuthService.getClient();

      const { data: failedJobs } = await supabase
        .from('worker_jobs')
        .select('*')
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(50);

      return reply.send({
        failed_jobs_count: failedJobs?.length || 0,
        jobs: failedJobs || [],
      });
    } catch (error) {
      reply.log.error(error);
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Failed to fetch failed jobs',
      });
    }
  };

  /**
   * Retry a failed job
   */
  public retryJob = async (
    request: FastifyRequest<{ Params: { jobId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const supabase = supabaseAuthService.getClient();
      const { jobId } = request.params;

      // Get the failed job
      const { data: job, error: getError } = await supabase
        .from('worker_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (getError || !job) {
        return reply.code(404).send({
          error: 'Job not found',
        });
      }

      if (job.status !== 'failed') {
        return reply.code(400).send({
          error: 'Only failed jobs can be retried',
        });
      }

      // Reset to pending and clear error
      const { error: updateError } = await supabase
        .from('worker_jobs')
        .update({
          status: 'pending',
          error_message: null,
          retry_count: 0,
        })
        .eq('id', jobId);

      if (updateError) {
        throw updateError;
      }

      return reply.send({
        message: 'Job queued for retry',
        jobId,
        status: 'pending',
      });
    } catch (error) {
      reply.log.error(error);
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Retry failed',
      });
    }
  };

  /**
   * Cancel a pending job
   */
  public cancelJob = async (
    request: FastifyRequest<{ Params: { jobId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const supabase = supabaseAuthService.getClient();
      const { jobId } = request.params;

      // Get the job
      const { data: job, error: getError } = await supabase
        .from('worker_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (getError || !job) {
        return reply.code(404).send({
          error: 'Job not found',
        });
      }

      if (job.status !== 'pending') {
        return reply.code(400).send({
          error: 'Only pending jobs can be cancelled',
        });
      }

      // Delete the job
      const { error: deleteError } = await supabase
        .from('worker_jobs')
        .delete()
        .eq('id', jobId);

      if (deleteError) {
        throw deleteError;
      }

      return reply.send({
        message: 'Job cancelled',
        jobId,
      });
    } catch (error) {
      reply.log.error(error);
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Cancellation failed',
      });
    }
  };
}

export const workerController = new WorkerController();
