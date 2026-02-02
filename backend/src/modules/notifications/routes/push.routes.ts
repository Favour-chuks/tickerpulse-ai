// import type { FastifyInstance } from 'fastify';
// import { PushController } from '../controllers/push.controller.js';

// export default async function pushRoutes(fastify: FastifyInstance) {
//   const pushController = new PushController();

//   // Subscribe to push notifications
//   fastify.post('/subscribe', pushController.subscribe);

//   // Unsubscribe
//   fastify.post('/unsubscribe', pushController.unsubscribe);

//   // Test notification
//   fastify.post('/test', pushController.sendTestNotification);
// }