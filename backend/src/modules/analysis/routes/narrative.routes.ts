// GET    /api/narratives/:ticker
// GET    /api/narratives/:ticker/timeline
// GET    /api/narratives/:ticker/contradictions

// ! these routes would be gotten from the backend narrative service
import type { FastifyInstance } from 'fastify';
import { NarrativeController } from '../controllers/narrative.controllers.js';
export default async function narrativeRoutes(fastify: FastifyInstance) {
  const narrativeController = new NarrativeController(); 

  fastify.get('/:ticker', narrativeController.getTickerNarratives);
  fastify.get('/:ticker/timeline', narrativeController.getTickerTimeline);
  fastify.get('/:ticker/contradictions', narrativeController.getTickerContradictions);
  
  fastify.get('/:ticker/latest', narrativeController.getLatestNarrative);
  fastify.get('/:ticker/compare', narrativeController.compareNarratives);
 }