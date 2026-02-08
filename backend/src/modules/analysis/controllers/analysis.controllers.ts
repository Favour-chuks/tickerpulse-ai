
import type { FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../../../config/logger.js';
import { GeminiService } from '../services/gemini.service.js';
import type { AnalysisRequest as newAnalysisRequest } from '../types/analysis.type.js';

export class AnalysisController {
  private geminiService: GeminiService;

  constructor() {
    this.geminiService = new GeminiService();
  }

  async analyze(
    request: FastifyRequest<{ Body: newAnalysisRequest }>,
    reply: FastifyReply
  ) {
    const { message, conversation_history = [] } = request.body;
    const userId = request.user?.id;

    if (!message) {
      return reply.code(400).send({ error: 'Message is required' });
    }

    try {
      const analysisResponse = await this.geminiService.analyzeMessage(
        message,
        conversation_history,
        userId
      );

      return reply.send(analysisResponse);
    } catch (error: any) {
      logger.error('Analysis controller error:', error);
      return reply.code(500).send({
        error: 'Analysis failed',
        details: error.message,
      });
    }
  }
}