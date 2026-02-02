// // ============================================================================
// // 1. PUSH SUBSCRIPTION CONTROLLER
// // controllers/push.controller.ts
// // ============================================================================
// import type { FastifyReply, FastifyRequest } from 'fastify';
// import { supabase } from '../libs/supabase.js';
// import webpush from 'web-push';

// // Configure web-push with VAPID keys
// webpush.setVapidDetails(
//   'mailto:your-email@signalhub.com',
//   process.env.VAPID_PUBLIC_KEY!,
//   process.env.VAPID_PRIVATE_KEY!
// );

// interface PushSubscriptionBody {
//   subscription: {
//     endpoint: string;
//     keys: {
//       p256dh: string;
//       auth: string;
//     };
//   };
// }

// export class PushController {
//   /**
//    * Subscribe user to push notifications
//    * POST /api/push/subscribe
//    */
//   public subscribe = async (
//     request: FastifyRequest<{ Body: PushSubscriptionBody }>,
//     reply: FastifyReply
//   ) => {
//     try {
//       const { subscription } = request.body;
//       const userId = request.user?.id;

//       if (!userId) {
//         return reply.code(401).send({ error: 'Unauthorized' });
//       }

//       // Store push subscription in database
//       const { error } = await supabase
//         .from('push_subscriptions')
//         .insert({
//           user_id: userId,
//           endpoint: subscription.endpoint,
//           p256dh: subscription.keys.p256dh,
//           auth: subscription.keys.auth,
//           user_agent: request.headers['user-agent'],
//         })
//         .select();

//       if (error) {
//         console.error('Error storing subscription:', error);
//         return reply.code(400).send({ error: error.message });
//       }

//       return reply.send({ success: true, message: 'Subscribed to push notifications' });
//     } catch (error) {
//       console.error('Error in subscribe:', error);
//       return reply.code(500).send({ error: 'Internal Server Error' });
//     }
//   };

//   /**
//    * Unsubscribe from push notifications
//    * POST /api/push/unsubscribe
//    */
//   public unsubscribe = async (
//     request: FastifyRequest<{ Body: { endpoint: string } }>,
//     reply: FastifyReply
//   ) => {
//     try {
//       const { endpoint } = request.body;
//       const userId = request.user?.id;

//       if (!userId) {
//         return reply.code(401).send({ error: 'Unauthorized' });
//       }

//       const { error } = await supabase
//         .from('push_subscriptions')
//         .delete()
//         .eq('user_id', userId)
//         .eq('endpoint', endpoint);

//       if (error) {
//         console.error('Error removing subscription:', error);
//         return reply.code(400).send({ error: error.message });
//       }

//       return reply.send({ success: true, message: 'Unsubscribed from push notifications' });
//     } catch (error) {
//       console.error('Error in unsubscribe:', error);
//       return reply.code(500).send({ error: 'Internal Server Error' });
//     }
//   };

//   /**
//    * Send test notification
//    * POST /api/push/test
//    */
//   public sendTestNotification = async (
//     request: FastifyRequest,
//     reply: FastifyReply
//   ) => {
//     try {
//       const userId = request.user?.id;

//       if (!userId) {
//         return reply.code(401).send({ error: 'Unauthorized' });
//       }

//       // Get user's subscriptions
//       const { data: subscriptions } = await supabase
//         .from('push_subscriptions')
//         .select('*')
//         .eq('user_id', userId);

//       if (!subscriptions || subscriptions.length === 0) {
//         return reply.code(404).send({ error: 'No push subscriptions found' });
//       }

//       const payload = {
//         title: 'Test Notification',
//         body: 'This is a test from SignalHub!',
//         priority: 'medium',
//         ticker: 'TEST',
//         alert_type: 'test',
//         url: '/',
//       };

//       // Send to all user's devices
//       const results = await Promise.allSettled(
//         subscriptions.map(sub =>
//           webpush.sendNotification(
//             {
//               endpoint: sub.endpoint,
//               keys: {
//                 p256dh: sub.p256dh,
//                 auth: sub.auth,
//               },
//             },
//             JSON.stringify(payload)
//           )
//         )
//       );

//       const successful = results.filter(r => r.status === 'fulfilled').length;
//       const failed = results.filter(r => r.status === 'rejected').length;

//       return reply.send({
//         success: true,
//         sent: successful,
//         failed: failed,
//         total: subscriptions.length,
//       });
//     } catch (error) {
//       console.error('Error sending test notification:', error);
//       return reply.code(500).send({ error: 'Internal Server Error' });
//     }
//   };
// }

// // ============================================================================
// // 2. NOTIFICATION SERVICE - Sends alerts to users
// // services/notification.service.ts
// // ============================================================================
// import webpush from 'web-push';
// import { supabase } from '../libs/supabase.js';

// interface NotificationPayload {
//   title: string;
//   body: string;
//   priority: 'low' | 'medium' | 'high' | 'critical';
//   ticker?: string;
//   alert_type?: string;
//   url?: string;
//   icon?: string;
//   image?: string;
//   payload?: any;
// }

// class NotificationService {
//   private static instance: NotificationService;

//   private constructor() {
//     // Initialize web-push
//     webpush.setVapidDetails(
//       'mailto:your-email@signalhub.com',
//       process.env.VAPID_PUBLIC_KEY!,
//       process.env.VAPID_PRIVATE_KEY!
//     );
//   }

//   static getInstance(): NotificationService {
//     if (!NotificationService.instance) {
//       NotificationService.instance = new NotificationService();
//     }
//     return NotificationService.instance;
//   }

//   /**
//    * Send notification to specific user
//    */
//   async sendToUser(userId: string, payload: NotificationPayload): Promise<{ sent: number; failed: number }> {
//     try {
//       // Get user's push subscriptions
//       const { data: subscriptions, error } = await supabase
//         .from('push_subscriptions')
//         .select('*')
//         .eq('user_id', userId);

//       if (error || !subscriptions || subscriptions.length === 0) {
//         console.log(`No subscriptions found for user ${userId}`);
//         return { sent: 0, failed: 0 };
//       }

//       // Send to all user's devices
//       const results = await Promise.allSettled(
//         subscriptions.map(async (sub) => {
//           try {
//             await webpush.sendNotification(
//               {
//                 endpoint: sub.endpoint,
//                 keys: {
//                   p256dh: sub.p256dh,
//                   auth: sub.auth,
//                 },
//               },
//               JSON.stringify(payload)
//             );
//             return true;
//           } catch (error: any) {
//             // Handle expired/invalid subscriptions
//             if (error.statusCode === 410 || error.statusCode === 404) {
//               console.log(`Removing invalid subscription: ${sub.endpoint}`);
//               await this.removeSubscription(sub.endpoint);
//             }
//             throw error;
//           }
//         })
//       );

//       const sent = results.filter(r => r.status === 'fulfilled').length;
//       const failed = results.filter(r => r.status === 'rejected').length;

//       console.log(`Sent ${sent}/${subscriptions.length} notifications to user ${userId}`);
//       return { sent, failed };
//     } catch (error) {
//       console.error('Error sending notification to user:', error);
//       return { sent: 0, failed: 1 };
//     }
//   }

//   /**
//    * Send notification to users watching a specific ticker
//    */
//   async sendToTickerWatchers(ticker: string, payload: NotificationPayload): Promise<void> {
//     try {
//       // Get all users watching this ticker
//       const { data: watchlistItems } = await supabase
//         .from('watchlist_items')
//         .select(`
//           watchlist_id,
//           watchlists!inner(user_id)
//         `)
//         .eq('tickers.symbol', ticker.toUpperCase());

//       if (!watchlistItems || watchlistItems.length === 0) {
//         console.log(`No users watching ${ticker}`);
//         return;
//       }

//       // Get unique user IDs
//       const userIds = [...new Set(watchlistItems.map(item => item.watchlists.user_id))];

//       console.log(`Sending notification to ${userIds.length} users watching ${ticker}`);

//       // Send to each user
//       await Promise.allSettled(
//         userIds.map(userId => this.sendToUser(userId, payload))
//       );
//     } catch (error) {
//       console.error('Error sending to ticker watchers:', error);
//     }
//   }

//   /**
//    * Send notification to all users
//    */
//   async sendToAllUsers(payload: NotificationPayload): Promise<void> {
//     try {
//       const { data: users } = await supabase
//         .from('user_profiles')
//         .select('id');

//       if (!users || users.length === 0) {
//         console.log('No users found');
//         return;
//       }

//       console.log(`Broadcasting to ${users.length} users`);

//       await Promise.allSettled(
//         users.map(user => this.sendToUser(user.id, payload))
//       );
//     } catch (error) {
//       console.error('Error broadcasting notification:', error);
//     }
//   }

//   /**
//    * Remove invalid subscription
//    */
//   private async removeSubscription(endpoint: string): Promise<void> {
//     await supabase
//       .from('push_subscriptions')
//       .delete()
//       .eq('endpoint', endpoint);
//   }
// }

// export default NotificationService.getInstance();

// // ============================================================================
// // 3. INTEGRATION WITH ALERT SYSTEM
// // Update your existing alert.service.ts or alert.controller.ts
// // ============================================================================

// // In your AlertService, add this method:
// /*
// import NotificationService from './notification.service.js';

// // When creating an alert in notification_queue, also send push notification
// async createAndSendAlert(
//   userId: string,
//   tickerId: number,
//   payload: any,
//   priority: 'low' | 'medium' | 'high' | 'critical'
// ): Promise<void> {
//   try {
//     // 1. Insert into notification_queue (for in-app display)
//     const { data: alert } = await supabase
//       .from('notification_queue')
//       .insert({
//         user_id: userId,
//         ticker_id: tickerId,
//         payload: payload,
//         priority: priority,
//       })
//       .select()
//       .single();

//     // 2. Get ticker info
//     const { data: ticker } = await supabase
//       .from('tickers')
//       .select('symbol, company_name')
//       .eq('id', tickerId)
//       .single();

//     // 3. Send push notification
//     await NotificationService.sendToUser(userId, {
//       title: `${ticker?.symbol || 'Alert'}: ${payload.title}`,
//       body: payload.message || payload.body,
//       priority: priority,
//       ticker: ticker?.symbol,
//       alert_type: payload.alert_type,
//       url: `/ticker/${ticker?.symbol}`,
//       payload: payload,
//     });

//     console.log(`✅ Alert created and sent for user ${userId}`);
//   } catch (error) {
//     console.error('Error creating and sending alert:', error);
//     throw error;
//   }
// }
// */

// // ============================================================================
// // 4. ROUTES
// // routes/push.routes.ts
// // ============================================================================
// import type { FastifyInstance } from 'fastify';
// import { PushController } from '../controllers/push.controller.js';

// export async function pushRoutes(fastify: FastifyInstance) {
//   const pushController = new PushController();

//   // Subscribe to push notifications
//   fastify.post('/push/subscribe', {
//     preHandler: [fastify.authenticate],
//     handler: pushController.subscribe
//   });

//   // Unsubscribe from push notifications
//   fastify.post('/push/unsubscribe', {
//     preHandler: [fastify.authenticate],
//     handler: pushController.unsubscribe
//   });

//   // Send test notification
//   fastify.post('/push/test', {
//     preHandler: [fastify.authenticate],
//     handler: pushController.sendTestNotification
//   });
// }

// // ============================================================================
// // 5. DATABASE MIGRATION
// // ============================================================================
// // TODo: check the relevance of this schema change to the current database
// /* 
// -- Add this to your Supabase schema

// CREATE TABLE push_subscriptions (
//     id BIGSERIAL PRIMARY KEY,
//     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
//     endpoint TEXT NOT NULL UNIQUE,
//     p256dh TEXT NOT NULL,
//     auth TEXT NOT NULL,
//     user_agent TEXT,
//     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
//     last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW()
// );

// CREATE INDEX idx_push_subs_user ON push_subscriptions(user_id);
// CREATE INDEX idx_push_subs_endpoint ON push_subscriptions(endpoint);

// -- Enable RLS
// ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

// CREATE POLICY "Users manage own subscriptions" ON push_subscriptions
//     FOR ALL USING (auth.uid() = user_id);
// */

// // ============================================================================
// // 6. FRONTEND INTEGRATION
// // ============================================================================

// // In your main app (e.g., App.tsx or index.tsx)

// // Register service worker and subscribe to push
// async function subscribeToPush() {
//   try {
//     // 1. Register service worker
//     const registration = await navigator.serviceWorker.register('/sw.js');
//     await navigator.serviceWorker.ready;

//     // 2. Request notification permission
//     const permission = await Notification.requestPermission();
//     if (permission !== 'granted') {
//       console.log('Notification permission denied');
//       return;
//     }

//     // 3. Subscribe to push notifications
//     const subscription = await registration.pushManager.subscribe({
//       userVisibleOnly: true,
//       applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
//     });

//     // 4. Send subscription to backend
//     await fetch('/api/push/subscribe', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': `Bearer ${yourAuthToken}`,
//       },
//       body: JSON.stringify({ subscription }),
//     });

//     console.log('✅ Subscribed to push notifications');
//   } catch (error) {
//     console.error('Failed to subscribe to push:', error);
//   }
// }

// // Helper function
// function urlBase64ToUint8Array(base64String: string) {
//   const padding = '='.repeat((4 - base64String.length % 4) % 4);
//   const base64 = (base64String + padding)
//     .replace(/\-/g, '+')
//     .replace(/_/g, '/');

//   const rawData = window.atob(base64);
//   const outputArray = new Uint8Array(rawData.length);

//   for (let i = 0; i < rawData.length; ++i) {
//     outputArray[i] = rawData.charCodeAt(i);
//   }
//   return outputArray;
// }

// // Call when user logs in or app starts
// subscribeToPush();


// // ============================================================================
// // 7. EXAMPLE USAGE IN WORKER/CRON JOB
// // ============================================================================

// // Example: When volume spike is detected

// import NotificationService from './services/notification.service.js';

// async function handleVolumeSpikeDetected(ticker: string, spikeData: any) {
//   // Send push notification to all users watching this ticker
//   await NotificationService.sendToTickerWatchers(ticker, {
//     title: `${ticker} Volume Spike!`,
//     body: `Volume is ${spikeData.deviation}x the average`,
//     priority: spikeData.deviation > 5 ? 'critical' : 'high',
//     ticker: ticker,
//     alert_type: 'volume_spike',
//     url: `/ticker/${ticker}`,
//     payload: spikeData,
//   });
// }

// // ============================================================================
// // 8. GENERATE VAPID KEYS
// // ============================================================================

// /*
// // Run this once to generate VAPID keys:
// // npx web-push generate-vapid-keys

// // Add to .env:
// VAPID_PUBLIC_KEY=your_public_key_here
// VAPID_PRIVATE_KEY=your_private_key_here
// */