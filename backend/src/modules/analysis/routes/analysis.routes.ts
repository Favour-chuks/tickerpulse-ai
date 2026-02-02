// POST   /api/analyze/filing
// POST   /api/analyze/compare-filings
// GET    /api/analyze/promises/:ticker

// post /api/analyse
import type { FastifyInstance } from 'fastify';
import { AnalysisController } from '../controllers/analysis.controllers.js';

export async function analysisRoutes(fastify: FastifyInstance) {
  const analysisController = new AnalysisController();

  fastify.post(
    '/analyze',
    {
      schema: {
        description: 'Analyze financial data using AI assistant',
        tags: ['Analysis'],
        body: {
          type: 'object',
          required: ['message'],
          properties: {
            message: { type: 'string', description: 'User message/query' },
            conversation_history: {
              type: 'array',
              description: 'Previous conversation messages',
              items: {
                type: 'object',
                properties: {
                  role: { type: 'string', enum: ['user', 'model'] },
                  parts: { type: 'array' }
                }
              }
            }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              response: { type: 'string' },
              conversation_history: { type: 'array' },
              tool_calls: { type: 'array' }
            }
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          },
          500: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              details: { type: 'string' }
            }
          }
        }
      }
    },
    analysisController.analyze.bind(analysisController)
  );
}