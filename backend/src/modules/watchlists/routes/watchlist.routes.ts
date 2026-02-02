import type { FastifyInstance } from 'fastify';
import { WatchListController } from '../controllers/watchlist.controllers.js';

export default async function watchlistRoutes(fastify: FastifyInstance) {
  const watchListController = new WatchListController();

  fastify.get('/', watchListController.getAllWatchlists);
  fastify.get('/:id', watchListController.getWatchlistById);
  fastify.post('/', watchListController.createWatchlist);
  fastify.patch('/:id', watchListController.updateWatchlist);
  fastify.delete('/:id', watchListController.deleteWatchlist);

  // watchList items
  fastify.get('/:id/items', watchListController.getAllItems);
  fastify.post('/:id/items', watchListController.addItems);
  fastify.put('/:id/items/:item', watchListController.updateItem);
  fastify.delete('/:id/items/:item', watchListController.deleteItem);
  
  // Get specific ticker details
  // fastify.get('/ticker/:symbol', watchListController.getTickerSymbol);

  // Update ticker notes
  // fastify.put('/ticker/:symbol', watchListController.updateTicker);

  // Check if ticker exists in watchlist
  // fastify.get('/ticker/:symbol/exists', watchListController.checkTickerExists);

}

//  /api/v1/watchlist/9bd094b3-38ed-4f25-a373-2051475298e6/items/AMD