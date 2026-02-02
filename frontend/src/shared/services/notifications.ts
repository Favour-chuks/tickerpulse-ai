export class NotificationService {
  static async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notification');
      return false;
    }
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  static async sendNotification(
    title: string, 
    body: string | NotificationOptions, 
    icon?: string
  ) {
    if (Notification.permission !== 'granted') return;
    const zapIconDataUrl = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjNGY0NmU1IiBzdHJva2U9IiM0ZjQ2ZTUiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBvbHlnb24gcG9pbnRzPSIxMyAyIDMgMTQgMTIgMTQgMTEgMjIgMjEgMTAgMTIgMTAgMTMgMiIvPjwvc3ZnPg==";
    const options: NotificationOptions = typeof body === 'string' 
      ? { 
          body: body, 
          icon: icon || zapIconDataUrl,
          tag: 'TickerPulse-alert',
          vibrate: [200, 100, 200]
        } as any
      : { 
          ...body, 
          icon: (body as any).icon || icon || zapIconDataUrl,
          tag: (body as any).tag || 'TickerPulse-alert'
        };

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration) {
          registration.showNotification(title, options);
          return;
        }
      }

      new Notification(title, options);
    } catch (e) {
      throw e;
    }
  }

  static simulateBackgroundAlerts() {
  const triggerNext = () => {
    const delay = Math.floor(Math.random() * (120000 - 30000 + 1) + 30000);

    setTimeout(async () => {
      const demoTickers = ['NVDA', 'TSLA', 'AAPL', 'BTCUSD', 'MSFT', 'AMD', 'GME', 'META', 'PLTR', 'SNOW'];
     
      const demoScenarios = [
        // --- STRATEGIC & NARRATIVE CONTRADICTIONS ---
        { text: 'CEO "Growth" narrative contradicts 15% reduction in R&D spend.', type: 'contradiction', priority: 'critical' },
        { text: 'Management guidance pivot: "Supply chain" issues replaced by "Market softening".', type: 'contradiction', priority: 'high' },
        { text: 'Executive sentiment drop: CFO language complexity increased by 40% in Q&A.', type: 'contradiction', priority: 'medium' },
        { text: 'Insider selling cluster detected: 4 directors sold 20% of holdings this week.', type: 'whale', priority: 'critical' },
        { text: 'Strategic drift: Sudden emphasis on "AI" despite 0 mentions in previous 10-K.', type: 'contradiction', priority: 'medium' },

        // --- MARKET ANOMALIES & VOLUME ---
        { text: 'Sudden localized volatility detected in dark pool routing.', type: 'spike', priority: 'high' },
        { text: 'Abnormal call option volume detected (3.5x daily avg).', type: 'spike', priority: 'high' },
        { text: 'Large institutional block trade detected ($120M+).', type: 'whale', priority: 'critical' },
        { text: 'Order book imbalance: 4:1 Sell-to-Buy ratio at current resistance.', type: 'spike', priority: 'high' },
        { text: 'Unusual pre-market gap up on low relative volume.', type: 'spike', priority: 'medium' },

        // --- TECHNICAL & AI INDICATORS ---
        { text: 'Neural engine identifies bearish trend reversal pattern (Head & Shoulders).', type: 'indicator', priority: 'high' },
        { text: 'RSI divergence: Price reaching new highs on weakening momentum.', type: 'indicator', priority: 'medium' },
        { text: 'Golden Cross detected: 50-day moving average crossed above 200-day.', type: 'indicator', priority: 'low' },
        { text: 'Volatility Squeeze: Bollinger Bands tightening to 12-month lows.', type: 'indicator', priority: 'high' },
        { text: 'VWAP rejection: Ticker failing to hold volume-weighted average price.', type: 'indicator', priority: 'medium' },

        // --- NEWS & SOCIAL SENTIMENT ---
        { text: 'Social sentiment spike: 300% increase in "Product Failure" mentions.', type: 'indicator', priority: 'high' },
        { text: 'Flash News: Rumors of antitrust investigation gaining traction.', type: 'spike', priority: 'critical' },
        { text: 'Competitive threat: Rival company just announced 50% price reduction.', type: 'indicator', priority: 'high' },
        { text: 'Patent filing detected: Potential breakthrough in solid-state battery tech.', type: 'indicator', priority: 'low' },
        { text: 'Macro correlation break: Ticker decoupled from S&P 500 movement.', type: 'spike', priority: 'medium' }
      ];

      // Your Weighted Logic
      const isCriticalHit = Math.random() > 0.8;
      const filteredScenarios = isCriticalHit 
        ? demoScenarios.filter(s => s.priority === 'critical') 
        : demoScenarios;

      const scenario = filteredScenarios[Math.floor(Math.random() * filteredScenarios.length)] || demoScenarios[0];
      const randomTicker = demoTickers[Math.floor(Math.random() * demoTickers.length)];
      const id = 'demo-' + Date.now();

      this.sendNotification(`TickerPulse | ${randomTicker}`, {
        body: scenario.text,
        tag: 'market-alert',
        data: { url: `/ticker/${randomTicker}` },
        vibrate: scenario.priority === 'critical' ? [200, 100, 200] : [50]
      } as any);

      const event = new CustomEvent('mock-alert', { 
        detail: {
          type: "ALERT",
          data: {
            id: id,
            ticker: randomTicker,
            message: scenario.text,
            severity: scenario.priority,
            timestamp: new Date().toISOString()
          }
        } 
      });
      window.dispatchEvent(event);

      triggerNext();
    }, delay);
  };

  triggerNext();
}
}