import type { FastifyInstance } from 'fastify';
import { AlertController } from '../controllers/alert.controllers.js';

export default async function alertRoutes(fastify: FastifyInstance) {
  const alertController = new AlertController()

  fastify.get('/', alertController.getAlerts);
  fastify.get('/:id', alertController.getAlertById);
  fastify.put('/:id/dismiss', alertController.dismissAlert);
  fastify.delete('/:id', alertController.deleteAlert);

  // WebSocket endpoint moved to central ws.routes.ts (mounted at /ws/alerts)
}