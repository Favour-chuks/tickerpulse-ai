import type { FastifyReply, FastifyRequest } from 'fastify';
import { supabase } from '../../../shared/infra/libs/supabase.js';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { logger } from '../../../config/logger.js';

interface AlertsQuery {
  ticker?: string;
  status?: string;
  priority?: string;
}

interface AlertParams {
  id: string;
}

interface AlertSubscription {
  userId: string;
  socket: WebSocket;
  watchlist?: Set<string>;
  lastHeartbeat?: number;
  channel?: RealtimeChannel;
}

export class AlertController {
  private subscriptions = new Map<string, AlertSubscription>();
  private alertBuffer = new Map<string, any[]>();
  private batchIntervals = new Map<string, NodeJS.Timeout>();

  /**
   * Get user's alerts from notification_queue
   * Uses notification_queue table which has user_id
   */
  public getAlerts = async (
    request: FastifyRequest<{ Querystring: AlertsQuery }>, 
    reply: FastifyReply
  ) => {
    try {
      const { ticker, status, priority } = request.query;
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      let query = supabase
        .from('notification_queue')
        .select(`
          *,
          ticker:tickers(symbol, company_name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (ticker) {
        const { data: tickerData } = await supabase
          .from('tickers')
          .select('id')
          .eq('symbol', ticker.toUpperCase())
          .single();
        
        if (tickerData) {
          query = query.eq('ticker_id', tickerData.id);
        }
      }

      if (status === 'active') {
        query = query.is('delivered_at', null);
      } else if (status === 'dismissed') {
        query = query.not('delivered_at', 'is', null);
      }

      if (priority) {
        query = query.eq('priority', priority);
      }
      
      const { data, error } = await query;

      if (error) {
        return reply.code(400).send({ error: error.message });
      }

      return data;
    } catch (error) {
      logger.fatal({msg: 'Error in getAlerts:', error})
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  };

  /**
   * Get single alert by ID
   */
  public getAlertById = async (
    request: FastifyRequest<{ Params: AlertParams }>, 
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const userId = request.user?.id;

    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase
      .from('notification_queue')
      .select(`
        *,
        ticker:tickers(symbol, company_name)
      `)
      .eq('id', parseInt(id, 10))
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return reply.code(404).send({ error: 'Alert not found' });
    }

    return data;
  };

  /**
   * Dismiss alert (mark as delivered)
   */
  public dismissAlert = async (
    request: FastifyRequest<{ Params: AlertParams }>, 
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const userId = request.user?.id;

    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase
      .from('notification_queue')
      .update({ delivered_at: new Date().toISOString() })
      .eq('id', parseInt(id, 10))
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return reply.code(400).send({ error: error.message });
    }

    return { message: 'Alert dismissed', alert: data };
  };

  /**
   * Delete alert from queue
   */
  public deleteAlert = async (
    request: FastifyRequest<{ Params: AlertParams }>, 
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const userId = request.user?.id;

    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
      
    const { error, count } = await supabase
      .from('notification_queue')
      .delete({ count: 'exact' })
      .eq('id', parseInt(id, 10))
      .eq('user_id', userId);

    if (error) {
      return reply.code(400).send({ error: error.message });
    }

    if (count === 0) {
      return reply.code(404).send({ error: 'Alert not found' });
    }

    return { message: 'Alert deleted' };
  };

  
  //  WebSocket stream for real-time alerts
  public streamAlerts = async (connection: any, request: FastifyRequest) => {
    const { token } = request.query as { token: string };
    
    // Authenticate
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (!user || error) {
      connection.socket.close(1008, 'Unauthorized');
      return;
    }

    const { data: watchlistData } = await supabase
      .from('watchlist_items')
      .select(`
        ticker_id,
        tickers!inner(symbol)
      `)
      .eq('watchlist_id', (
        await supabase
          .from('watchlists')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_default', true)
          .single()
      ).data?.id || '');

    const watchedTickers = new Set(
      watchlistData?.flatMap(item => 
        item.tickers.map(t => t.symbol)
      ) || []
    );

    connection.socket.send(JSON.stringify({
      type: 'connection',
      status: 'connected',
      watchlist: Array.from(watchedTickers)
    }));

    const channel = supabase
      .channel(`alerts-${user.id}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'notification_queue',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          this.handleAlertEvent(user.id, payload);
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          logger.info(`User ${user.id} subscribed to alerts`)
        } else if (err) {
          logger.error({msg: `Subscription error for user ${user.id}:`, err})
          connection.socket.close(1011, 'Subscription failed');
        }
      });

    const subscription: AlertSubscription = {
      userId: user.id,
      socket: connection.socket,
      watchlist: watchedTickers,
      lastHeartbeat: Date.now(),
      channel: channel
    };

    this.subscriptions.set(user.id, subscription);

    connection.socket.on('message', (message: Buffer) => {
      this.handleClientMessage(user.id, message);
    });
    
    connection.socket.on('close', () => {
      const subscription = this.subscriptions.get(user.id);
      if (subscription?.channel) {
        supabase.removeChannel(subscription.channel);
      }
      
      const interval = this.batchIntervals.get(user.id);
      if (interval) {
        clearInterval(interval);
        this.batchIntervals.delete(user.id);
      }
      
      this.subscriptions.delete(user.id);
      this.alertBuffer.delete(user.id);
      logger.info(`User ${user.id} disconnected`);
    });

    // Start batching interval for this user
    this.startBatchingForUser(user.id);
  };

  
  private handleAlertEvent(userId: string, payload: any) {
    const subscription = this.subscriptions.get(userId);
    if (!subscription) return;

    const alert = payload.new || payload.old;
    
    // CRITICAL ALERTS: Send immediately, no batching
    if (alert.priority === 'critical' || alert.priority === 'high') {
      subscription.socket.send(JSON.stringify({
        type: 'alert',
        action: payload.eventType,
        priority: 'immediate',
        data: alert,
        timestamp: Date.now()
      }));
      return;
    }

    // MEDIUM/LOW ALERTS: Buffer and batch
    if (!this.alertBuffer.has(userId)) {
      this.alertBuffer.set(userId, []);
    }
    this.alertBuffer.get(userId)!.push({
      type: 'alert',
      action: payload.eventType,
      data: alert,
      timestamp: Date.now()
    });
  }

  private startBatchingForUser(userId: string) {
    const batchInterval = setInterval(() => {
      const subscription = this.subscriptions.get(userId);
      
      if (!subscription) {
        clearInterval(batchInterval);
        this.batchIntervals.delete(userId);
        return;
      }

      const bufferedAlerts = this.alertBuffer.get(userId);
      if (bufferedAlerts && bufferedAlerts.length > 0) {
        subscription.socket.send(JSON.stringify({
          type: 'alert_batch',
          count: bufferedAlerts.length,
          alerts: bufferedAlerts,
          timestamp: Date.now()
        }));

        this.alertBuffer.set(userId, []);
      }
    }, 5000);

    this.batchIntervals.set(userId, batchInterval);
  }

  private handleClientMessage(userId: string, message: Buffer) {
    try {
      const data = JSON.parse(message.toString());
      const subscription = this.subscriptions.get(userId);
      if (!subscription) return;

      switch (data.type) {
        case 'update_watchlist':
          subscription.watchlist = new Set(data.tickers);
          subscription.socket.send(JSON.stringify({
            type: 'watchlist_updated',
            tickers: data.tickers
          }));
          break;

        case 'heartbeat':
          subscription.lastHeartbeat = Date.now();
          subscription.socket.send(JSON.stringify({
            type: 'heartbeat_ack',
            timestamp: Date.now()
          }));
          break;
      }
    } catch (error) {
      logger.fatal({ message: 'Error handling client message', error });
    }
  }
}