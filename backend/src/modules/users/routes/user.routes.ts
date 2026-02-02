import type { FastifyInstance } from 'fastify';
import { UserController } from '../controllers/user.controllers.js';

export default async function userRoutes(fastify: FastifyInstance) {
  const userController = new UserController();

  fastify.get('/:id', userController.getUserById);
  fastify.put('/me', userController.updateUser);
  fastify.delete('/me', userController.deleteUser);
}