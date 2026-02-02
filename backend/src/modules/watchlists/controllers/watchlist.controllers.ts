import type { FastifyReply, FastifyRequest } from 'fastify';
import { supabase } from '../../../shared/infra/libs/supabase.js';

interface WatchlistParams {
  id: string;
}

interface TickerParams {
  watchlistId: string;
  symbol: string;
}

interface CreateWatchlistBody {
  name: string;
}

interface UpdateWatchlistBody {
  name: string;
}

export interface UpdateItemBody {
  alert_settings?: {
    divergence_alerts?: boolean;
    contradiction_alerts?: boolean;
    news_alerts?: boolean;
    min_severity?: 'low' | 'medium' | 'high';
  };
}
interface AddTickerBody {
  ticker: string;
}

export class WatchListController {
  // ==================== WATCHLIST MANAGEMENT ====================
  
  /**
   * Get all watchlists for the authenticated user
   * GET /api/watchlist
   */
  public getAllWatchlists = async (
    request: FastifyRequest, 
    reply: FastifyReply
  ) => {
    try {
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      // Get all watchlists with item count
      const { data, error } = await supabase
        .from('watchlists')
        .select(`
          id,
          name,
          created_at,
          watchlist_items (count)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching watchlists:', error);
        return reply.code(400).send({ error: error.message });
      }

      // Format response with item counts
      const watchlists = data.map((watchlist: any) => ({
        id: watchlist.id,
        name: watchlist.name,
        created_at: watchlist.created_at,
        ticker_count: watchlist.watchlist_items[0]?.count || 0
      }));

      return reply.send({
        count: watchlists.length,
        watchlists: watchlists
      });
    } catch (error) {
      console.error('Unexpected error in getAllWatchlists:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  };

  /**
   * Get a specific watchlist with all its tickers
   * GET /api/watchlist/:id
   */
  public getWatchlistById = async (
    request: FastifyRequest<{ Params: WatchlistParams }>, 
    reply: FastifyReply
  ) => {
    try {
      const userId = request.user?.id;
      const { id } = request.params;

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { data: watchlist, error: watchlistError } = await supabase
        .from('watchlists')
        .select(`
          id,
          name,
          created_at,
          watchlist_items (
            id,
            ticker
          )
        `)
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (watchlistError) {
        if (watchlistError.code === 'PGRST116') {
          return reply.code(404).send({ error: 'Watchlist not found' });
        }
        return reply.code(400).send({ error: watchlistError.message });
      }

      return reply.send({
        id: watchlist.id,
        name: watchlist.name,
        created_at: watchlist.created_at,
        items: watchlist.watchlist_items.map((item: any) => item.ticker),
        ticker_count: watchlist.watchlist_items.length
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  };

  
  public createWatchlist = async (
    request: FastifyRequest<{ Body: CreateWatchlistBody }>, 
    reply: FastifyReply
  ) => {
    try {
      const userId = request.user?.id;
      const { name } = request.body;

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      if (!name || name.trim().length === 0) {
        return reply.code(400).send({ 
          error: 'Watchlist name is required' 
        });
      }

      if (name.length > 50) {
        return reply.code(400).send({ 
          error: 'Watchlist name must be 50 characters or less' 
        });
      }

      // Check if watchlist with same name already exists
      const { data: existing } = await supabase
        .from('watchlists')
        .select('id')
        .eq('user_id', userId)
        .eq('name', name.trim())
        .single();

      if (existing) {
        return reply.code(409).send({ 
          error: `Watchlist "${name.trim()}" already exists` 
        });
      }

      const { data, error } = await supabase
        .from('watchlists')
        .insert({
          user_id: userId,
          name: name.trim()
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating watchlist:', error);
        return reply.code(400).send({ error: error.message });
      }

      return reply.code(201).send({
        message: `Watchlist "${name.trim()}" created`,
        watchlist: {
          id: data.id,
          name: data.name,
          created_at: data.created_at,
          ticker_count: 0
        }
      });
    } catch (error) {
      request.log.error({ msg: 'Unexpected error in createWatchlist', error});
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  };

  public updateWatchlist = async (
    request: FastifyRequest<{ 
      Params: WatchlistParams; 
      Body: UpdateWatchlistBody 
    }>, 
    reply: FastifyReply
  ) => {
    try {
      const userId = request.user?.id;
      const { id } = request.params;
      const { name } = request.body;

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      if (!name || name.trim().length === 0) {
        return reply.code(400).send({ 
          error: 'Watchlist name is required' 
        });
      }

      if (name.length > 50) {
        return reply.code(400).send({ 
          error: 'Watchlist name must be 50 characters or less' 
        });
      }

      const { data: existing } = await supabase
        .from('watchlists')
        .select('id')
        .eq('user_id', userId)
        .eq('name', name.trim())
        .neq('id', id)
        .single();

      if (existing) {
        return reply.code(409).send({ 
          error: `Another watchlist named "${name.trim()}" already exists` 
        });
      }

      const { data, error } = await supabase
        .from('watchlists')
        .update({ name: name.trim() })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return reply.code(404).send({ error: 'Watchlist not found' });
        }
        request.log.error({msg:'Error updating watchlist:', error});
        return reply.code(400).send({ error: error.message });
      }

      return reply.send({
        message: `Watchlist renamed to "${name.trim()}"`,
        watchlist: data
      });
    } catch (error) {
      request.log.error({ msg: 'Unexpected error in updateWatchlist', error});
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  };

  public deleteWatchlist = async (
    request: FastifyRequest<{ Params: WatchlistParams }>, 
    reply: FastifyReply
  ) => {
    try {
      const userId = request.user?.id;
      const { id } = request.params;

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { error, count } = await supabase
        .from('watchlists')
        .delete({ count: 'exact' })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
      request.log.error({ msg: 'error deleting watchlist', error});
        return reply.code(400).send({ error: error.message });
      }

      if (count === 0) {
        return reply.code(404).send({ error: 'Watchlist not found' });
      }

      return reply.send({ 
        message: 'Watchlist deleted successfully' 
      });
    } catch (error) {
      request.log.error({ msg: 'Unexpected error in deleteWatchlist', error});
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  };

  // ==================== ITEM MANAGEMENT ====================
  public getAllItems = async (
    request: FastifyRequest<{ Params: WatchlistParams }>, 
    reply: FastifyReply
  ) => {
    try {
      const userId = request.user?.id;
      const { id } = request.params;

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { data: watchlist, error: watchlistError } = await supabase
        .from('watchlists')
        .select('id, name')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (watchlistError) {
        if (watchlistError.code === 'PGRST116') {
          return reply.code(404).send({ error: 'Watchlist not found' });
        }
        request.log.error({ msg: 'Error fetching Watchlist', watchlistError});
        return reply.code(400).send({ error: watchlistError.message });
      }

      const { data: items, error: itemsError } = await supabase
        .from('watchlist_items')
        .select(`
          id,
          alert_settings,
          added_at,
          tickers (
            id,
            symbol,
            company_name,
            ticker_historical_snapshots (
              close_price,
              open_price
            )
          )
        `)
        .eq('watchlist_id', id)
        .order('symbol', { foreignTable: 'tickers', ascending: true });
      
      if (itemsError) {
      request.log.error({ msg: 'Error fetching Watchlist items', itemsError});
        return reply.code(400).send({ error: itemsError.message });
      }

      return reply.send({
        watchlist_id: watchlist.id,
        watchlist_name: watchlist.name,
        count: items.length,
        items: items.map(item => {
          const tickerData = item.tickers;
          const latestSnapshot = tickerData.ticker_historical_snapshots?.[0];
          const close = latestSnapshot?.close_price ?? 0;
          const open = latestSnapshot?.open_price ?? 0;

         const changePercent = open > 0 
          ? ((close - open) / open) * 100 
          : 0;

        return {
          id: item.id,
          settings: item.alert_settings,
          added_at: item.added_at,
          ticker: {
            id: tickerData.id,
            symbol: tickerData.symbol,
            company_name: tickerData.company_name,
            price: close,
            change_percent: Number(changePercent.toFixed(2)) // Format to 2 decimal places
          }
        }
      })
      })
    } catch (error) {
      request.log.error({ msg: 'Unexpected error in getAllITems', error});
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  };

  public addItems = async (
  request: FastifyRequest<{ Params: { id: string }; Body: { symbol: string } }>, 
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.id;
    const { id: watchlistId } = request.params;
    const { symbol } = request.body;

    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const { data: tickerData, error: tickerError } = await supabase
      .from('tickers')
      .select('id')
      .eq('symbol', symbol.toUpperCase())
      .single();

    if (tickerError || !tickerData) {
      return reply.code(404).send({ error: `Ticker ${symbol} not found in master database` });
    }

    const { data: watchlist, error: wlError } = await supabase
      .from('watchlists')
      .select('id')
      .eq('id', watchlistId)
      .eq('user_id', userId)
      .single();

    if (wlError) return reply.code(404).send({ error: 'Watchlist not found' });

    const { data, error: insertError } = await supabase
      .from('watchlist_items')
      .insert({
        watchlist_id: watchlistId,
        ticker_id: tickerData.id
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return reply.code(400).send({ error: 'Ticker already exists in this watchlist' });
      }
      throw insertError;
    }

    return reply.code(201).send({
      message: 'Ticker added successfully',
      data
    });

  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
};


  public updateItem = async (
    request: FastifyRequest<{ Params: { id: string; item: string }; Body: UpdateItemBody }>, 
    reply: FastifyReply
  ) => {
    try {
      const userId = request.user?.id;
      const { id: watchlistId, item: symbol } = request.params;
      const { alert_settings } = request.body;

      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

      // 1. We need to find the specific record in watchlist_items.
      // Since we only have the 'symbol' string, we use a filter to find the related ticker_id.
      const { data, error } = await supabase
        .from('watchlist_items')
        .update({ 
          alert_settings: alert_settings // Supabase handles merging/replacing the JSONB
        })
        .eq('watchlist_id', watchlistId)
        .filter('ticker_id', 'in', 
          supabase
            .from('tickers')
            .select('id')
            .eq('symbol', symbol.toUpperCase())
        )
        // Security: ensure the watchlist belongs to the user via a join check or RLS
        .select(`
          id,
          alert_settings,
          tickers ( symbol )
        `)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return reply.code(404).send({ error: 'Ticker not found in this watchlist' });
        }
        return reply.code(400).send({ error: error.message });
      }

      return reply.send({
        message: 'Alert settings updated',
        data: {
          id: data.id,
          symbol: data.tickers.symbol,
          alert_settings: data.alert_settings
        }
      });

    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  };

  public deleteItem = async (
    request: FastifyRequest<{ Params: { id: string; item: string } }>, 
    reply: FastifyReply
  ) => {
    try {
      const userId = request.user?.id;
      const { id: watchlistId, item: symbol } = request.params;

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
      const { data: tickerData, error: tickerError } = await supabase
        .from('tickers')
        .select('id')
        .eq('symbol', symbol.toUpperCase())
        .single();

      if (tickerError || !tickerData) {
        return reply.code(404).send({ 
          error: `Ticker ${symbol.toUpperCase()} not found` 
        });
      }

      // Step 2: Delete the watchlist item using the ticker_id
      const { error, count } = await supabase
        .from('watchlist_items')
        .delete({ count: 'exact' })
        .eq('watchlist_id', watchlistId)
        .eq('ticker_id', tickerData.id);


      if (error) {
        request.log.error(error);
        return reply.code(400).send({ error: error.message });
      }

      // If count is 0, it means the ticker wasn't in that list
      if (count === 0) {
        return reply.code(404).send({ 
          error: `Ticker ${symbol.toUpperCase()} not found in this watchlist.` 
        });
      }

      return reply.send({ 
        message: `Successfully removed ${symbol.toUpperCase()} from your watchlist.` 
      });

    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  };

  // TODO: remember to check if these are in use
  public checkTickerExists = async (
    request: FastifyRequest<{ Params: TickerParams }>, 
    reply: FastifyReply
  ) => {
    try {
      const userId = request.user?.id;
      const { watchlistId, symbol } = request.params;

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      // Verify watchlist belongs to user
      const { data: watchlist, error: watchlistError } = await supabase
        .from('watchlists')
        .select('id')
        .eq('id', watchlistId)
        .eq('user_id', userId)
        .single();

      if (watchlistError) {
        if (watchlistError.code === 'PGRST116') {
          return reply.code(404).send({ error: 'Watchlist not found' });
        }
        console.error('Error fetching watchlist:', watchlistError);
        return reply.code(400).send({ error: watchlistError.message });
      }

      const { data, error } = await supabase
        .from('watchlist_items')
        .select('id')
        .eq('watchlist_id', watchlistId)
        .eq('ticker', symbol.toUpperCase())
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking ticker:', error);
        return reply.code(400).send({ error: error.message });
      }

      return reply.send({
        exists: !!data,
        ticker: symbol.toUpperCase(),
        watchlist_id: watchlist.id
      });
    } catch (error) {
      console.error('Unexpected error in checkTickerExists:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  };

  // public getTickerSymbol = async (
  //   request: FastifyRequest<{ Params: TickerParams }>, 
  //   reply: FastifyReply
  // ) => {
  //   try {
  //     const userId = request.user?.id;
  //     const { watchlistId, symbol } = request.params;

  //     if (!userId) {
  //       return reply.code(401).send({ error: 'Unauthorized' });
  //     }

  //     if (!symbol || symbol.length > 5) {
  //       return reply.code(400).send({ 
  //         error: 'Invalid ticker symbol' 
  //       });
  //     }

  //     // Verify watchlist belongs to user
  //     const { data: watchlist, error: watchlistError } = await supabase
  //       .from('watchlists')
  //       .select('id, name')
  //       .eq('id', watchlistId)
  //       .eq('user_id', userId)
  //       .single();

  //     if (watchlistError) {
  //       if (watchlistError.code === 'PGRST116') {
  //         return reply.code(404).send({ error: 'Watchlist not found' });
  //       }
  //       console.error('Error fetching watchlist:', watchlistError);
  //       return reply.code(400).send({ error: watchlistError.message });
  //     }

  //     // Check if ticker exists
  //     const { data, error } = await supabase
  //       .from('watchlist_items')
  //       .select('*')
  //       .eq('watchlist_id', watchlistId)
  //       .eq('ticker', symbol.toUpperCase())
  //       .single();

  //     if (error) {
  //       if (error.code === 'PGRST116') {
  //         return reply.code(404).send({ 
  //           error: `Ticker ${symbol.toUpperCase()} not found in watchlist "${watchlist.name}"` 
  //         });
  //       }
  //       console.error('Error fetching ticker:', error);
  //       return reply.code(400).send({ error: error.message });
  //     }

  //     return reply.send({
  //       id: data.id,
  //       ticker: data.ticker,
  //       watchlist_id: watchlist.id,
  //       watchlist_name: watchlist.name
  //     });
  //   } catch (error) {
  //     console.error('Unexpected error in getTickerSymbol:', error);
  //     return reply.code(500).send({ error: 'Internal Server Error' });
  //   }
  // };
}