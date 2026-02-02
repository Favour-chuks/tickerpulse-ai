// Enhanced Service Worker for SignalHub
const CACHE_NAME = 'signalhub-v1';
const RUNTIME_CACHE = 'signalhub-runtime-v1';

// Critical assets to cache for offline functionality
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/offline.html', // Create a fallback offline page
];

// =============================================================================
// INSTALLATION - Cache critical assets
// =============================================================================
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching app shell');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error('[ServiceWorker] Installation failed:', error);
      })
  );
});

// =============================================================================
// ACTIVATION - Clean up old caches
// =============================================================================
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
            .map((name) => {
              console.log('[ServiceWorker] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
      .catch((error) => {
        console.error('[ServiceWorker] Activation failed:', error);
      })
  );
});

// =============================================================================
// FETCH - Network-first strategy with offline fallback
// =============================================================================
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone response before caching
        const responseToCache = response.clone();
        
        caches.open(RUNTIME_CACHE).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // If it's a navigation request, show offline page
            if (event.request.mode === 'navigate') {
              return caches.match('/offline.html');
            }
            
            return new Response('Network error', {
              status: 408,
              headers: { 'Content-Type': 'text/plain' },
            });
          });
      })
  );
});

// =============================================================================
// PUSH NOTIFICATIONS - Enhanced with priority-based styling
// =============================================================================
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push received:', event);
  
  let data;
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    console.error('[ServiceWorker] Failed to parse push data:', error);
    data = {};
  }

  // Default values
  const title = data.title || 'SignalHub';
  const body = data.body || 'New market activity detected.';
  const priority = data.priority || 'medium';
  const ticker = data.ticker || 'MARKET';
  const alertType = data.alert_type || 'general';
  const url = data.url || '/';

  // Priority-based notification styling
  const notificationConfig = getPriorityConfig(priority, alertType);

  const options = {
    body: body,
    icon: data.icon || '/favicon.ico',
    badge: '/favicon.ico',
    tag: `${ticker}-${alertType}-${Date.now()}`,
    requireInteraction: priority === 'critical' || priority === 'high',
    renotify: true,
    vibrate: notificationConfig.vibrate,
    
    // Visual styling based on priority
    image: data.image,
    
    // Action buttons
    actions: getNotificationActions(alertType, ticker),
    
    // Custom data for click handling
    data: {
      url: url,
      ticker: ticker,
      alertType: alertType,
      priority: priority,
      timestamp: Date.now(),
      payload: data.payload || {},
    },
    
    // Silent for low priority
    silent: priority === 'low',
    
    ...notificationConfig.options,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
      .catch((error) => {
        console.error('[ServiceWorker] Show notification failed:', error);
      })
  );
});

// =============================================================================
// NOTIFICATION CLICK - Smart routing with action handling
// =============================================================================
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification clicked:', event);
  
  event.notification.close();

  const notificationData = event.notification.data || {};
  const action = event.action;
  let targetUrl = notificationData.url || '/';

  // Handle action buttons
  if (action === 'view_ticker') {
    targetUrl = `/ticker/${notificationData.ticker}`;
  } else if (action === 'view_alerts') {
    targetUrl = '/alerts';
  } else if (action === 'dismiss') {
    // Just close, don't navigate
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          
          // If a window is open, focus it and navigate
          if ('focus' in client) {
            return client.focus().then(() => {
              if ('navigate' in client) {
                return client.navigate(targetUrl);
              }
            });
          }
        }
        
        // No window open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
      .catch((error) => {
        console.error('[ServiceWorker] Notification click handling failed:', error);
      })
  );
});

// =============================================================================
// NOTIFICATION CLOSE - Track dismissals
// =============================================================================
self.addEventListener('notificationclose', (event) => {
  console.log('[ServiceWorker] Notification dismissed:', event.notification.tag);
  
  // Optionally send analytics or update dismissal state
  const notificationData = event.notification.data || {};
  
  event.waitUntil(
    fetch('/api/analytics/notification-dismissed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticker: notificationData.ticker,
        alertType: notificationData.alertType,
        timestamp: notificationData.timestamp,
        dismissedAt: Date.now(),
      }),
    }).catch((error) => {
      console.error('[ServiceWorker] Failed to log dismissal:', error);
    })
  );
});

// =============================================================================
// BACKGROUND SYNC - Retry failed requests
// =============================================================================
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync:', event.tag);
  
  if (event.tag === 'sync-alerts') {
    event.waitUntil(syncAlerts());
  }
});

// =============================================================================
// PERIODIC BACKGROUND SYNC - Check for new alerts (if supported)
// =============================================================================
self.addEventListener('periodicsync', (event) => {
  console.log('[ServiceWorker] Periodic sync:', event.tag);
  
  if (event.tag === 'check-alerts') {
    event.waitUntil(checkForNewAlerts());
  }
});

// =============================================================================
// MESSAGE - Handle messages from client pages
// =============================================================================
self.addEventListener('message', (event) => {
  console.log('[ServiceWorker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((names) => {
        return Promise.all(names.map((name) => caches.delete(name)));
      })
    );
  }
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get notification configuration based on priority
 */
function getPriorityConfig(priority, alertType) {
  const configs = {
    critical: {
      vibrate: [300, 100, 300, 100, 300],
      options: {
        requireInteraction: true,
        silent: false,
      },
    },
    high: {
      vibrate: [200, 100, 200],
      options: {
        requireInteraction: true,
        silent: false,
      },
    },
    medium: {
      vibrate: [200],
      options: {
        requireInteraction: false,
        silent: false,
      },
    },
    low: {
      vibrate: [],
      options: {
        requireInteraction: false,
        silent: false,
      },
    },
  };

  return configs[priority] || configs.medium;
}

/**
 * Get action buttons based on alert type
 */
function getNotificationActions(alertType, ticker) {
  const commonActions = [
    { action: 'view_alerts', title: '📊 View All Alerts' },
    { action: 'dismiss', title: '✖ Dismiss' },
  ];

  // Add ticker-specific action for stock alerts
  if (ticker && ticker !== 'MARKET') {
    return [
      { action: 'view_ticker', title: `📈 View ${ticker}` },
      ...commonActions,
    ];
  }

  return commonActions;
}

/**
 * Sync alerts when coming back online
 */
async function syncAlerts() {
  try {
    const response = await fetch('/api/alerts?status=active');
    if (response.ok) {
      const data = await response.json();
      console.log('[ServiceWorker] Synced alerts:', data);
      
      // Optionally show a notification about new alerts
      if (data.count > 0) {
        await self.registration.showNotification('SignalHub', {
          body: `You have ${data.count} new alert(s)`,
          icon: '/favicon.ico',
          tag: 'sync-complete',
        });
      }
    }
  } catch (error) {
    console.error('[ServiceWorker] Sync failed:', error);
    throw error; // Retry sync
  }
}

/**
 * Check for new alerts (periodic background sync)
 */
async function checkForNewAlerts() {
  try {
    const response = await fetch('/api/alerts/check-new');
    if (response.ok) {
      const data = await response.json();
      
      if (data.hasNew) {
        await self.registration.showNotification('New Market Activity', {
          body: data.summary || 'Check your alerts for updates',
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'periodic-check',
          data: { url: '/alerts' },
        });
      }
    }
  } catch (error) {
    console.error('[ServiceWorker] Periodic check failed:', error);
  }
}

console.log('[ServiceWorker] Loaded and ready');