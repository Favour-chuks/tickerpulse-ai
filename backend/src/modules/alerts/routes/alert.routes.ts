import type { FastifyInstance } from 'fastify';
import { AlertController } from '../controllers/alert.controllers.js';

export default async function alertRoutes(fastify: FastifyInstance) {
  const alertController = new AlertController()

  // GET    /api/alerts?ticker=AAPL&status=active
  fastify.get('/', alertController.getAlerts);
  fastify.get('/:id', alertController.getAlertById);
  fastify.put('/:id/dismiss', alertController.dismissAlert);
  fastify.delete('/:id', alertController.deleteAlert);

  fastify.get('/ws', { websocket: true }, alertController.streamAlerts);
}