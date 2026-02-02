export function isDemoUser(): boolean {
  try {
    const userData = localStorage.getItem('auth_user');
    if (!userData) return false;
    const parsed = JSON.parse(userData);
    return parsed.id === 'demo-user-1';
  } catch {
    return false;
  }
}

export const authDemoData = {
  demoLogin: {
    session: {
      access_token: 'demo-fallback-token',
      refresh_token: 'demo-refresh-token',
    },
    user: {
      id: 'demo-user-1',
      email: 'admin@admin.com',
      firstName: 'Demo',
      lastName: 'User',
    },
  },

  errorMessage: 'You dont have acess to this service',
};

export const watchlistDemoData = {
  mockWatchlistsKey: 'mock_watchlists',

  getMockMarketData: () => {
    return Array.from({ length: 20 }, (_, i) => ({
      time: new Date(Date.now() - (20 - i) * 15 * 60000).toLocaleTimeString(),
      close: 100 + Math.random() * 10,
      volume: Math.floor(Math.random() * 1000000),
    }));
  },
};

// ==================== COMPREHENSIVE DEMO DATA ====================
export const DEMO_Data = {
  user: {
    id: 'demo-user-1',
    email: 'admin@admin.com',
    firstName: 'Demo',
    lastName: 'User',
    avatarUrl: 'https://api.dicebear.com/9.x/notionists-neutral/svg?seed=Jameson',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },

  portfolio: {
    totalValue: 125000,
    totalGain: 18500,
    gainPercentage: 14.8,
    dayChange: 2300,
    dayChangePercent: 1.89,
    lastUpdated: new Date().toISOString(),
    holdings: [
      {
        symbol: 'NVDA',
        shares: 50,
        avgCost: 875.25,
        currentPrice: 945.50,
        totalValue: 47275,
        gain: 3512.5,
        gainPercent: 8.03,
        sector: 'Technology',
      },
      {
        symbol: 'TSLA',
        shares: 25,
        avgCost: 180.00,
        currentPrice: 238.75,
        totalValue: 5968.75,
        gain: 1468.75,
        gainPercent: 32.64,
        sector: 'Automotive',
      },
      {
        symbol: 'AAPL',
        shares: 100,
        avgCost: 145.50,
        currentPrice: 182.30,
        totalValue: 18230,
        gain: 3680,
        gainPercent: 25.26,
        sector: 'Technology',
      },
      {
        symbol: 'MSFT',
        shares: 35,
        avgCost: 320.75,
        currentPrice: 375.20,
        totalValue: 13132,
        gain: 1900,
        gainPercent: 16.95,
        sector: 'Technology',
      },
      {
        symbol: 'BTC/USD',
        shares: 0.5,
        avgCost: 42000,
        currentPrice: 42875,
        totalValue: 21437.5,
        gain: 437.5,
        gainPercent: 2.08,
        sector: 'Cryptocurrency',
      },
    ],
  },

  tickers: [
    {
      id: 1,
      symbol: 'NVDA',
      companyName: 'NVIDIA Corporation',
      sector: 'Technology',
      marketCap: '2.85T',
      pe_ratio: 58.2,
      price: 945.50,
      change_percent: 3.2,
      description: 'Leading designer and manufacturer of GPUs and AI processors.',
      website: 'https://www.nvidia.com',
    },
    {
      id: 2,
      symbol: 'MSFT',
      companyName: 'Microsoft Corporation',
      sector: 'Technology',
      marketCap: '2.98T',
      pe_ratio: 32.5,
      price: 375.20,
      change_percent: 1.8,
      description: 'Global software, hardware, and cloud computing leader.',
      website: 'https://www.microsoft.com',
    },
    {
      id: 3,
      symbol: 'TSLA',
      companyName: 'Tesla Inc',
      sector: 'Automotive',
      marketCap: '798B',
      pe_ratio: 65.3,
      price: 238.75,
      change_percent: 2.5,
      description: 'Electric vehicles and renewable energy company.',
      website: 'https://www.tesla.com',
    },
    {
      id: 4,
      symbol: 'AAPL',
      companyName: 'Apple Inc',
      sector: 'Technology',
      marketCap: '2.95T',
      pe_ratio: 28.7,
      price: 182.30,
      change_percent: -0.5,
      description: 'Consumer electronics and software design company.',
      website: 'https://www.apple.com',
    },
    {
      id: 5,
      symbol: 'AMD',
      companyName: 'Advanced Micro Devices',
      sector: 'Technology',
      marketCap: '285B',
      pe_ratio: 52.1,
      price: 178.95,
      change_percent: 4.2,
      description: 'Semiconductor design and manufacturing company.',
      website: 'https://www.amd.com',
    },
    // ADDED MISSING TICKERS
    {
      id: 6,
      symbol: 'META',
      companyName: 'Meta Platforms Inc',
      sector: 'Technology',
      marketCap: '1.25T',
      pe_ratio: 28.9,
      price: 485.30,
      change_percent: 1.8,
      description: 'Social media and virtual reality technology company.',
      website: 'https://www.meta.com',
    },
    {
      id: 7,
      symbol: 'GME',
      companyName: 'GameStop Corp',
      sector: 'Consumer Cyclical',
      marketCap: '12.5B',
      pe_ratio: -8.3,
      price: 28.45,
      change_percent: -2.1,
      description: 'Video game retailer and collectibles company.',
      website: 'https://www.gamestop.com',
    },
    {
      id: 8,
      symbol: 'PLTR',
      companyName: 'Palantir Technologies Inc',
      sector: 'Technology',
      marketCap: '85B',
      pe_ratio: 195.4,
      price: 38.75,
      change_percent: 5.3,
      description: 'Data analytics and AI platform provider.',
      website: 'https://www.palantir.com',
    },
    {
      id: 9,
      symbol: 'SNOW',
      companyName: 'Snowflake Inc',
      sector: 'Technology',
      marketCap: '48B',
      pe_ratio: -42.1,
      price: 152.80,
      change_percent: -1.2,
      description: 'Cloud-based data warehousing company.',
      website: 'https://www.snowflake.com',
    },
    {
      id: 10,
      symbol: 'BTC/USD',
      companyName: 'Bitcoin',
      sector: 'Cryptocurrency',
      marketCap: '840B',
      pe_ratio: null,
      price: 42875,
      change_percent: 2.1,
      description: 'Decentralized digital currency.',
      website: 'https://bitcoin.org',
    },
  ],

  watchlists: [
    {
      id: 'wl-1',
      name: 'Tech Giants',
      created_at: '2025-11-01T10:00:00Z',
      items: [
        {
          id: 'wli-1',
          ticker: {
            id: 1,
            symbol: 'NVDA',
            companyName: 'NVIDIA Corporation',
            sector: 'Technology',
          },
          settings: {
            news_alerts: true,
            min_severity: 'medium',
            divergence_alerts: true,
            contradiction_alerts: true,
          },
        },
        {
          id: 'wli-2',
          ticker: {
            id: 2,
            symbol: 'MSFT',
            companyName: 'Microsoft Corporation',
            sector: 'Technology',
          },
          settings: {
            news_alerts: true,
            min_severity: 'medium',
            divergence_alerts: true,
            contradiction_alerts: false,
          },
        },
      ],
    },
    {
      id: 'wl-2',
      name: 'Growth Stocks',
      created_at: '2025-10-15T14:30:00Z',
      items: [
        {
          id: 'wli-3',
          ticker: {
            id: 3,
            symbol: 'TSLA',
            companyName: 'Tesla Inc',
            sector: 'Automotive',
          },
          settings: {
            news_alerts: true,
            min_severity: 'low',
            divergence_alerts: true,
            contradiction_alerts: true,
          },
        },
      ],
    },
  ],

  alerts: [
    {
      id: '1',
      symbol: 'NVDA',
      message: 'Volume 4.2x above avg - Potential institutional accumulation',
      priority: 'critical' as const,
      alert_type: 'spike',
      created_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
      read: false,
      source: 'market_data',
    },
    {
      id: '2',
      symbol: 'TSLA',
      message: 'Price drop 5.4% in 15min - Flash crash detected',
      priority: 'high' as const,
      alert_type: 'crash',
      created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      read: false,
      source: 'market_data',
    },
    {
      id: '3',
      symbol: 'AAPL',
      message: 'RSI overbought (78.5) - Potential pullback coming',
      priority: 'medium' as const,
      alert_type: 'indicator',
      created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      read: true,
      source: 'technical',
    },
    {
      id: '4',
      symbol: 'BTC/USD',
      message: 'New 24h high reached - $43,500 resistance broken',
      priority: 'high' as const,
      alert_type: 'breakout',
      created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      read: false,
      source: 'market_data',
    },
    {
      id: '5',
      symbol: 'AMD',
      message: 'Golden Cross detected (50/200 DMA) - Bullish signal',
      priority: 'low' as const,
      alert_type: 'pattern',
      created_at: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
      read: true,
      source: 'technical',
    },
  ],

  narrativeTimelines: {
    NVDA: [
      {
        id: 101,
        tickerSymbol: 'NVDA',
        filingType: '10-K',
        filedAt: '2025-12-15T10:00:00Z',
        summary: 'Annual report highlighting 20% growth in subscriber base but rising acquisition costs.',
        toneShift: 'Neutral',
        managementConfidence: 7,
        keyChanges: ['Increased R&D for AI', 'Restructuring in EU'],
      },
      {
        id: 102,
        tickerSymbol: 'NVDA',
        filingType: '8-K',
        filedAt: '2026-01-10T14:30:00Z',
        summary: "Unexpected departure of the CTO. Management cites 'personal reasons'.",
        toneShift: 'Cautious',
        managementConfidence: 4,
        keyChanges: ['Executive leadership change'],
      },
      {
        id: 103,
        tickerSymbol: 'NVDA',
        filingType: 'Earnings Transcript',
        filedAt: '2026-01-25T09:00:00Z',
        summary: 'Q4 earnings call. Analysts pressed on the CTO departure; answers were evasive.',
        toneShift: 'Bearish',
        managementConfidence: 3,
        keyChanges: ['Guidance lowered', 'Margin compression'],
      },
    ],
    TSLA: [
      {
        id: 201,
        tickerSymbol: 'TSLA',
        filingType: '10-Q',
        filedAt: '2025-10-28T10:00:00Z',
        summary: 'Q3 quarterly filing emphasized production ramp for next-gen vehicle platform.',
        toneShift: 'Bullish',
        managementConfidence: 8,
        keyChanges: ['Production targets increased', 'Battery cost reduction'],
      },
      {
        id: 202,
        tickerSymbol: 'TSLA',
        filingType: 'Press Release',
        filedAt: '2026-01-15T14:30:00Z',
        summary: "Factory tour press release signals strategic shift toward Robotaxi development.",
        toneShift: 'Cautious',
        managementConfidence: 6,
        keyChanges: ['Timeline re-evaluation', 'Priority shift to autonomy'],
      },
    ],
    AAPL: [
      {
        id: 301,
        tickerSymbol: 'AAPL',
        filingType: '10-K',
        filedAt: '2025-12-15T10:00:00Z',
        summary: 'Annual report highlighting 20% growth in subscriber base but rising acquisition costs.',
        toneShift: 'Neutral',
        managementConfidence: 7,
        keyChanges: ['Increased R&D for AI', 'Restructuring in EU'],
      },
      {
        id: 302,
        tickerSymbol: 'AAPL',
        filingType: '8-K',
        filedAt: '2026-01-20T15:00:00Z',
        summary: 'Manufacturing expansion announcement for Vietnam facility.',
        toneShift: 'Bullish',
        managementConfidence: 8,
        keyChanges: ['$2.3B supplier agreement', 'Supply chain diversification'],
      },
    ],
    // ADDED MISSING TIMELINE DATA
    META: [
      {
        id: 401,
        tickerSymbol: 'META',
        filingType: 'Earnings Call',
        filedAt: '2025-11-05T09:00:00Z',
        summary: 'CFO emphasized cost discipline and announced hiring freeze for FY25.',
        toneShift: 'Cautious',
        managementConfidence: 6,
        keyChanges: ['Headcount freeze', 'Cost optimization focus'],
      },
      {
        id: 402,
        tickerSymbol: 'META',
        filingType: '8-K',
        filedAt: '2026-01-18T11:30:00Z',
        summary: 'Filing reveals 15% increase in compute-infrastructure recruitment budget for AI training.',
        toneShift: 'Bullish',
        managementConfidence: 7,
        keyChanges: ['2,000 engineering hires', 'Llama-4 infrastructure expansion'],
      },
    ],
  },

  latestNarratives: {
    NVDA: {
      id: 999,
      tickerSymbol: 'NVDA',
      summary: 'The latest narrative shows a significant pivot towards internal restructuring while publicly maintaining a growth-first stance.',
      managementConfidence: 5,
      toneShift: 'Cautious',
      filingType: '10-Q',
      filedAt: new Date().toISOString(),
      keyChanges: ['Resource reallocation', 'New efficiency targets'],
    },
    TSLA: {
      id: 998,
      tickerSymbol: 'TSLA',
      summary: 'Strategic pivot detected: shifting from mass-market vehicle timeline to Robotaxi prioritization.',
      managementConfidence: 6,
      toneShift: 'Cautious',
      filingType: 'Press Release',
      filedAt: new Date().toISOString(),
      keyChanges: ['Timeline re-evaluation', 'Autonomy focus'],
    },
    AAPL: {
      id: 997,
      tickerSymbol: 'AAPL',
      summary: 'Expansion into Vietnam manufacturing signals supply chain diversification strategy.',
      managementConfidence: 8,
      toneShift: 'Bullish',
      filingType: '8-K',
      filedAt: new Date().toISOString(),
      keyChanges: ['$2.3B manufacturing deal', 'Supply chain resilience'],
    },
    META: {
      id: 996,
      tickerSymbol: 'META',
      summary: 'Contradiction between stated hiring freeze and substantial AI infrastructure investment.',
      managementConfidence: 7,
      toneShift: 'Neutral',
      filingType: '8-K',
      filedAt: new Date().toISOString(),
      keyChanges: ['2,000 engineering hires', 'Compute budget increase'],
    },
  },

  promises: {
    NVDA: [
      {
        id: 1,
        promise_text: 'Achieve GAAP profitability by Q4 2025',
        promise_date: '2025-12-31',
        status: 'kept' as const,
        verification_notes: 'Confirmed in annual filing; net income reached $12M.',
      },
      {
        id: 2,
        promise_text: 'Launch Next-Gen Cloud Infrastructure',
        promise_date: '2026-03-15',
        status: 'broken' as const,
        verification_notes: 'Project deferred indefinitely due to R&D budget reallocation.',
      },
      {
        id: 3,
        promise_text: 'Expand operations into European markets',
        promise_date: '2026-11-01',
        status: 'pending' as const,
        verification_notes: 'Regulatory filings submitted in Berlin and Paris; on track.',
      },
      {
        id: 4,
        promise_text: 'Reduce carbon footprint by 20%',
        promise_date: '2027-01-01',
        status: 'pending' as const,
        verification_notes: 'Current audit shows a 12% reduction as of mid-year.',
      },
    ],
    TSLA: [
      {
        id: 1,
        promise_text: 'Release $25k next-generation vehicle by early 2025',
        promise_date: '2025-03-31',
        status: 'broken' as const,
        verification_notes: 'Timeline now under re-evaluation per recent press release. Priority shifted to Robotaxi.',
      },
      {
        id: 2,
        promise_text: 'Achieve full self-driving capability',
        promise_date: '2026-12-31',
        status: 'pending' as const,
        verification_notes: 'Development ongoing; regulatory approval timeline uncertain.',
      },
    ],
    AAPL: [
      {
        id: 1,
        promise_text: 'Launch Vision Pro in international markets',
        promise_date: '2025-12-31',
        status: 'kept' as const,
        verification_notes: 'Successfully launched in 15+ countries as planned.',
      },
      {
        id: 2,
        promise_text: 'Diversify manufacturing beyond China',
        promise_date: '2026-06-30',
        status: 'pending' as const,
        verification_notes: 'Vietnam expansion announced; India operations scaling up.',
      },
    ],
    META: [
      {
        id: 1,
        promise_text: 'Maintain flat headcount for FY25',
        promise_date: '2025-12-31',
        status: 'broken' as const,
        verification_notes: 'Despite hiring freeze announcement, 8-K shows 2,000 engineering hires planned.',
      },
      {
        id: 2,
        promise_text: 'Launch Llama-4 by Q2 2026',
        promise_date: '2026-06-30',
        status: 'pending' as const,
        verification_notes: 'Infrastructure expansion on track; development progressing.',
      },
    ],
  },

  contradictions: {
    NVDA: [
      {
        id: 1,
        tickerSymbol: 'NVDA',
        contradiction_type: 'Guidance Shift',
        explanation: 'Q3 guidance emphasized "strong momentum", but Q4 guidance implies slowdown.',
        severity: 'high',
        quote_1: 'We expect strong momentum to continue through Q4.',
        quote_2: 'We are taking a more cautious approach given current macro headwinds.',
        detected_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        market_trend_before: 'neutral',
        market_trend_after: 'volatile',
        price_impact: -1.8,
        volume_impact: 1.5,
        gemini_confidence: 0.85,
        is_validated: false,
        news_headline: 'NVIDIA Tempers Outlook Amid Market Uncertainty',
      },
      {
        id: 2,
        tickerSymbol: 'NVDA',
        contradiction_type: 'Spending Contradiction',
        explanation: 'CEO stated "aggressive R&D expansion" but later mentioned "cost optimization initiatives".',
        severity: 'medium' as const,
        quote_1: 'We are doubling down on AI research investments.',
        quote_2: 'We are optimizing our cost structure for efficiency.',
        detected_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        market_trend_before: 'neutral',
        market_trend_after: 'volatile',
        price_impact: -0.9,
        volume_impact: 1.2,
        gemini_confidence: 0.72,
        is_validated: false,
        news_headline: 'Mixed Signals from NVIDIA on R&D Spending',
      },
    ],
    TSLA: [
      {
        id: 1,
        tickerSymbol: 'TSLA',
        contradiction_type: 'guidance_miss',
        explanation: "Management explicitly committed to a 2025 rollout for the $25k model in Q1 10-Q, but signaled a 'shift in priority' during the recent unannounced factory tour press release.",
        severity: 'critical' as const,
        quote_1: "The next-generation vehicle platform remains on track for early 2025 production.",
        quote_2: "We are re-evaluating the timeline for entry-level platforms to focus on Robotaxi autonomy.",
        detected_at:  new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        market_trend_before: 'bullish',
        market_trend_after: 'bearish',
        price_impact: -4.2,
        volume_impact: 2.5,
        gemini_confidence: 0.92,
        is_validated: false,
        news_headline: "Tesla Shares Slide as Strategy Pivot Confuses Analysts",
      },
    ],
    AAPL: [
      {
        id: 1,
        tickerSymbol: 'AAPL',
        contradiction_type: 'Guidance Shift',
        explanation: 'Q3 guidance emphasized "strong momentum", but Q4 guidance implies slowdown.',
        severity: 'high' as const,
        quote_1: 'We expect strong momentum to continue through Q4.',
        quote_2: 'We are taking a more cautious approach given current macro headwinds.',
        detected_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        market_trend_before: 'neutral',
        market_trend_after: 'bearish',
        price_impact: -1.2,
        volume_impact: 1.3,
        gemini_confidence: 0.79,
        is_validated: false,
        news_headline: 'Apple Adjusts Expectations Amid Market Headwinds',
      },
    ],
    META: [
      {
        id: 1,
        tickerSymbol: 'META',
        contradiction_type: 'strategy_change',
        explanation: "CFO signaled hiring freeze for FY25, but 8-K filing shows 15% increase in compute-infrastructure recruitment budget.",
        severity: 'medium' as const,
        quote_1: "Expect headcount to remain flat throughout the next fiscal year.",
        quote_2: "Expanding infrastructure engineering team by 2,000 to support Llama-4 training requirements.",
        detected_at: 'Yesterday',
        market_trend_before: 'neutral',
        market_trend_after: 'bullish',
        price_impact: 1.8,
        volume_impact: 1.2,
        gemini_confidence: 0.78,
        is_validated: true,
        validation_notes: "Confirmed by subsequent earnings call Q&A.",
        news_headline: "Meta's AI Ambitions Override Cost-Cutting Pledge",
      },
    ],
  },

  volumeSpikes: [
    {
      id: 1,
      tickerSymbol: 'NVDA',
      priceAtSpike: 945.50,
      volume: 15400000, // ADDED
      avgVolume: 3666667, // ADDED (15.4M / 4.2)
      volumeMultiple: 4.2,
      deviationMultiple: 4.2,
      zScore: 3.8, // ADDED
      priceChangePercent: 2.1, // ADDED
      detectedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      relatedNews: 'Institutional accumulation detected - no public catalyst',
      severity: 'critical', // CHANGED from 'high'
      hasCatalyst: false, // ADDED
    },
    {
      id: 2,
      tickerSymbol: 'TSLA',
      priceAtSpike: 238.75,
      volume: 8680000, // ADDED
      avgVolume: 2800000, // ADDED (8.68M / 3.1)
      volumeMultiple: 3.1,
      deviationMultiple: 3.1,
      zScore: 2.9, // ADDED
      priceChangePercent: -5.4, // ADDED
      detectedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      relatedNews: 'Strategy pivot announcement triggered selloff',
      severity: 'high', // CHANGED from 'medium'
      hasCatalyst: true, // ADDED
    },
    {
      id: 3,
      tickerSymbol: 'AAPL',
      priceAtSpike: 182.30,
      volume: 12240000, // ADDED
      avgVolume: 3600000, // ADDED (12.24M / 3.4)
      volumeMultiple: 3.4,
      deviationMultiple: 3.4,
      zScore: 3.2, // ADDED
      priceChangePercent: 1.9, // ADDED
      detectedAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(), // ~1.5 hours ago
      relatedNews: '8-K filing: $2.3B Vietnam manufacturing expansion',
      severity: 'high',
      hasCatalyst: true,
    },
    {
      id: 4,
      tickerSymbol: 'META',
      priceAtSpike: 485.30,
      volume: 7200000,
      avgVolume: 3200000,
      volumeMultiple: 2.25,
      deviationMultiple: 2.25,
      zScore: 2.1,
      priceChangePercent: 1.8,
      detectedAt: new Date(Date.now() - 1000 * 60 * 1440).toISOString(), // Yesterday
      relatedNews: 'AI infrastructure investment despite hiring freeze',
      severity: 'medium',
      hasCatalyst: true,
    },
  ],

  settings: {
    notifications_enabled: true,
    email_alerts: true,
    push_alerts: true,
    min_alert_severity: 'medium',
    dark_mode: false,
    portfolio_visibility: 'private',
    language: 'en',
    timezone: 'UTC-5',
  },

  preferences: {
    favoriteSymbols: ['NVDA', 'TSLA', 'AAPL', 'MSFT'],
    theme: 'light',
    chartType: 'candlestick',
    defaultTimeframe: '1D',
  },

  alertScenarios: [
    { text: 'CEO "Growth" narrative contradicts 15% reduction in R&D spend.', type: 'contradiction', priority: 'critical' },
    { text: 'Management guidance pivot: "Supply chain" issues replaced by "Market softening".', type: 'contradiction', priority: 'high' },
    { text: 'Executive sentiment drop: CFO language complexity increased by 40% in Q&A.', type: 'contradiction', priority: 'medium' },
    { text: 'Insider selling cluster detected: 4 directors sold 20% of holdings this week.', type: 'whale', priority: 'critical' },
    { text: 'Strategic drift: Sudden emphasis on "AI" despite 0 mentions in previous 10-K.', type: 'contradiction', priority: 'medium' },
    { text: 'Sudden localized volatility detected in dark pool routing.', type: 'spike', priority: 'high' },
    { text: 'Abnormal call option volume detected (3.5x daily avg).', type: 'spike', priority: 'high' },
    { text: 'Large institutional block trade detected ($120M+).', type: 'whale', priority: 'critical' },
    { text: 'Order book imbalance: 4:1 Sell-to-Buy ratio at current resistance.', type: 'spike', priority: 'high' },
    { text: 'Unusual pre-market gap up on low relative volume.', type: 'spike', priority: 'medium' },
    { text: 'Neural engine identifies bearish trend reversal pattern (Head & Shoulders).', type: 'indicator', priority: 'high' },
    { text: 'RSI divergence: Price reaching new highs on weakening momentum.', type: 'indicator', priority: 'medium' },
    { text: 'Golden Cross detected: 50-day moving average crossed above 200-day.', type: 'indicator', priority: 'low' },
    { text: 'Volatility Squeeze: Bollinger Bands tightening to 12-month lows.', type: 'indicator', priority: 'high' },
    { text: 'VWAP rejection: Ticker failing to hold volume-weighted average price.', type: 'indicator', priority: 'medium' },
    { text: 'Social sentiment spike: 300% increase in "Product Failure" mentions.', type: 'indicator', priority: 'high' },
    { text: 'Flash News: Rumors of antitrust investigation gaining traction.', type: 'spike', priority: 'critical' },
    { text: 'Competitive threat: Rival company just announced 50% price reduction.', type: 'indicator', priority: 'high' },
    { text: 'Patent filing detected: Potential breakthrough in solid-state battery tech.', type: 'indicator', priority: 'low' },
    { text: 'Macro correlation break: Ticker decoupled from S&P 500 movement.', type: 'spike', priority: 'medium' },
  ],

  availableTickers: ['NVDA', 'TSLA', 'AAPL', 'BTC/USD', 'MSFT', 'AMD', 'GME', 'META', 'PLTR', 'SNOW'],
};

// ==================== HELPER FUNCTIONS - SELECTORS FROM DEMO_DATA ====================

export function getDemoAlerts() {
  return DEMO_Data.alerts;
}

export function getRandomDemoAlert() {
  const isCriticalHit = Math.random() > 0.8;
  const filteredScenarios = isCriticalHit
    ? DEMO_Data.alertScenarios.filter(s => s.priority === 'critical')
    : DEMO_Data.alertScenarios;

  const scenario = filteredScenarios[Math.floor(Math.random() * filteredScenarios.length)] || DEMO_Data.alertScenarios[0];
  const randomTicker = DEMO_Data.availableTickers[Math.floor(Math.random() * DEMO_Data.availableTickers.length)];

  return {
    id: 'demo-' + Date.now(),
    symbol: randomTicker,
    message: scenario.text,
    priority: scenario.priority as 'low' | 'medium' | 'high' | 'critical',
    alert_type: scenario.type,
    created_at: new Date().toISOString(),
  };
}

export function getDemoNarrativeTimeline(symbol: string) {
  return DEMO_Data.narrativeTimelines[symbol as keyof typeof DEMO_Data.narrativeTimelines] || [];
}

export function getDemoLatestNarrative(symbol: string) {
  return DEMO_Data.latestNarratives[symbol as keyof typeof DEMO_Data.latestNarratives] || null;
}

export function getDemoPromises(symbol: string) {
  return DEMO_Data.promises[symbol as keyof typeof DEMO_Data.promises] || [];
}

export function getDemoContradictions(symbol: string) {
  return DEMO_Data.contradictions[symbol as keyof typeof DEMO_Data.contradictions] || [];
}

export function getDemoComparison(symbol: string, id1: string, id2: string) {
  const timeline = getDemoNarrativeTimeline(symbol);
  const narrative1 = timeline.find(n => n.id === parseInt(id1));
  const narrative2 = timeline.find(n => n.id === parseInt(id2));

  return {
    symbol,
    comparison: {
      narrative_1: {
        id: id1,
        summary: narrative1?.summary || 'Growth-focused strategy with heavy investment in new markets.',
      },
      narrative_2: {
        id: id2,
        summary: narrative2?.summary || 'Cost-optimization and consolidation of existing operations.',
      },
      key_differences: [
        'Spending approach: Expansion vs. Efficiency',
        'Market outlook: Optimistic vs. Cautious',
        'Management tone: Confident vs. Defensive',
      ],
    },
  };
}

export function getDemoWatchlistData() {
  return DEMO_Data.watchlists;
}
