
export interface QueuedRequest {
  id: string;
  endpoint: string;
  options: any;
  timestamp: number;
}

export class SyncService {
  private static STORAGE_KEY = 'offline_mutation_queue';
  private static API_BASE = 'http://localhost:5000/api/v1';

  static queueRequest(endpoint: string, options: any) {
    const queue = this.getQueue();
    queue.push({
      id: crypto.randomUUID(),
      endpoint,
      options,
      timestamp: Date.now()
    });
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(queue));
    console.log(`[SyncService] Request queued: ${endpoint}`);
  }

  static getQueue(): QueuedRequest[] {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
    } catch { return []; }
  }

  static clearQueue() {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  static async processQueue() {
    const queue = this.getQueue();
    if (queue.length === 0) return;

    console.log(`[SyncService] Processing ${queue.length} offline requests...`);

    // Process sequentially
    for (const req of queue) {
      try {
        const token = localStorage.getItem('auth_token');
        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...req.options.headers,
        };
        
        const response = await fetch(`${this.API_BASE}${req.endpoint}`, {
            ...req.options,
            headers
        });

        if (!response.ok) {
           console.warn(`[SyncService] Failed to sync request ${req.endpoint}: ${response.status}`);
        }
      } catch (e) {
        console.error("Failed to sync request", req, e);
      }
    }
    
    this.clearQueue();
    console.log(`[SyncService] Sync complete.`);
  }
}
