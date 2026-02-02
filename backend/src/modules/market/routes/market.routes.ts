// GET    /api/market/:ticker/volume-profile
// GET    /api/market/:ticker/current-spike

import type { FastifyInstance } from 'fastify';
import { MarketDataController } from '../controllers/market.controllers.js';

export default async function marketRoutes(fastify: FastifyInstance) {
  // TODO: comeback and change this 
  const marketController = new MarketDataController(); 
  // fastify.get('/:ticker/volume-profile', marketController.searchTickers);
  // fastify.get('/:ticker/current-spike', marketController.getTickerDetails);
  // fastify.get('/:ticker/volume-profile', marketController.getMarketData);
  // fastify.get('/:ticker/current-spike', marketController.getVolumeSpikes);
  // fastify.get('/:ticker/volume-profile', marketController.getSentimentAnalysis);
  // fastify.get('/:ticker/current-spike', marketController.checkSentimentDivergence);
  // fastify.get('/:ticker/volume-profile', marketController.getSECFilings);
  // fastify.get('/:ticker/current-spike', marketController.analyzeTickerHealth);
  // fastify.get('/:ticker/volume-profile', marketController.compareTickers);
 }
