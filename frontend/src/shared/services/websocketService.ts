
import { useConnectionStore } from '../store/connectionStore';
import { authDemoData } from './demoData';
import { NotificationService } from './notifications';

type MessageHandler = (data: any) => void;

class WebSocketClient {
  private socket: WebSocket | null = null;
  private url: string;
  private reconnectTimeout: any;
  private listeners: Set<MessageHandler> = new Set();
  private token: string | null = null;
  private isReconnecting = false;

  constructor(path: string) {
    const baseUrl = process.env.VITE_WS_URL || 'ws://localhost:5000'; 
    this.url = `${baseUrl}${path}`;
  }

  connect(token: string) {
    if (this.socket?.readyState === WebSocket.OPEN) return;
    this.token = token;
    
    if(token === authDemoData.demoLogin.session.access_token) return;
    
    try {
      this.socket = new WebSocket(`${this.url}?token=${token}`);
      
      this.socket.onopen = () => {
        console.log(`[WS] Connected to ${this.url}`);
        useConnectionStore.getState().setSocketConnected(true);
        this.isReconnecting = false;
      };

      this.socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          
          // Dispatch to listeners
          this.listeners.forEach(listener => listener(payload));
          
          // Global Notification handler for critical alerts
          if ((payload.type === 'DIVERGENCE_ALERT' || payload.type === 'ALERT') && payload.data?.severity === 'critical') {
             NotificationService.sendNotification(
               `CRITICAL: ${payload.data.ticker || payload.data.symbol}`, 
               payload.data.hypothesis || payload.data.message || 'Severe volume anomaly detected.'
             );
          }
        } catch (e) {
          console.error('[WS] Parse error', e);
        }
      };

      this.socket.onclose = (e) => {
        console.log(`[WS] Disconnected from ${this.url}`, e.code, e.reason);
        useConnectionStore.getState().setSocketConnected(false);
        this.socket = null;
        
        // Auto reconnect if not 1000 (normal closure) and we have a token
        if (e.code !== 1000 && this.token) {
          this.scheduleReconnect();
        }
      };

      this.socket.onerror = (e) => {
        console.error(`[WS] Error on ${this.url}`, e);
        this.socket?.close();
      };

    } catch (e) {
      console.error(`[WS] Connection failed`, e);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.isReconnecting) return;
    this.isReconnecting = true;
    this.reconnectTimeout = setTimeout(() => {
      if (this.token) this.connect(this.token);
    }, 3000);
  }

  subscribe(handler: MessageHandler) {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  disconnect() {
    this.token = null;
    clearTimeout(this.reconnectTimeout);
    if (this.socket) {
      this.socket.close(1000, 'User logged out');
      this.socket = null;
    }
  }
}

export const alertsSocket = new WebSocketClient('/ws/alerts');
export const marketSocket = new WebSocketClient('/ws/market');
