# TickerPulse AI - Backend API

> Fastify-based API server with real-time market intelligence, AI analysis, and alert distribution.

**Part of**: [TickerPulse AI](../README.md) - Real-time Market Intelligence Engine

## Overview

The backend is a Node.js/TypeScript API built with **Fastify**, providing:

- **RESTful API** for user management, watchlists, alerts, and market data
- **WebSocket server** for real-time market updates and instant alerts
- **Background job processing** for long-running analysis tasks
- **Caching layer** with Redis for performance optimization
- **AI integration** with Google Gemini for narrative analysis
- **PostgreSQL database** with TimescaleDB for time-series data

### Key Features

- **Volume Spike Detection**: Real-time monitoring of unusual trading volume using Z-score analysis
- **Narrative Analysis**: AI-powered analysis of SEC filings using Google Gemini
- **Contradiction Detection**: Identifies inconsistencies between company statements
- **Divergence Detection**: Flags volume movements without clear public catalysts
- **Promise Tracking**: Monitors company commitments and verifies fulfillment
- **Real-time Alerts**: WebSocket-based alert system with instant push notifications
- **User Watchlists**: Personalized ticker tracking with customizable alert settings

## System Architecture

```
Request comes in (HTTP/WebSocket)
      │
      ▼
Fastify Router
      │
      ▼
Auth Middleware (if protected)
      │
      ▼
Route Handler (Controller)
      │
  ┌───┴───────────────────┐
  │                       │
  ▼                       ▼
Direct Response    Queue Job (async)
(Database/Cache)         │
                         ▼
                    Bull Job Queue
                    (Redis-backed)
                         │
                         ▼
                    Worker Process
                         │
          ┌──────────────┬──────────────┐
          │              │              │
          ▼              ▼              ▼
      Database      Redis Cache    WebSocket
      Update        Invalidation    Broadcast
```

**Tech Stack**:
| Tech | Purpose | Version |
|------|---------|---------|
| Fastify | Web framework | ^4.x |
| TypeScript | Type-safe development | ^5.x |
| PostgreSQL | Primary database | 14+ |
| TimescaleDB | Time-series extension | Latest |
| Redis | Cache & job queue | 6+ |
| Bull | Job queue library | ^4.x |
| Supabase | Auth & database management | Latest |
| Google Gemini | AI analysis | Latest |
| Pino | Structured logging | ^8.x |
| ioredis | Redis client | ^5.x |

## Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **PostgreSQL** 14+ with TimescaleDB
- **Redis** 6+
- **Google Gemini API Key** ([Get free access](https://ai.google.dev/))
- **pnpm** (recommended) or npm

## Installation & Setup

### 1. Install Dependencies

```bash
cd backend
pnpm install
```

### 2. Database Setup

#### Create PostgreSQL Database

```bash
# macOS (with Homebrew)
brew install postgresql timescaledb-bundle
brew services start postgresql

# Linux (Debian/Ubuntu)
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql

# Create database
createdb tickerpulse
```

#### Enable TimescaleDB Extension

```bash
psql -U postgres -d tickerpulse -c "CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"
```

#### Run Database Schema

```bash
psql -U postgres -d tickerpulse < database/schema.sql
```

### 3. Redis Setup

```bash
# macOS
brew install redis
brew services start redis

# Linux
sudo apt-get install redis-server
sudo systemctl start redis-server

# Test connection
redis-cli ping  # Should return PONG
```

### 4. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Server
NODE_ENV=development
PORT=5000
LOG_LEVEL=debug  # debug, info, warn, error, fatal

# Database (Supabase PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/tickerpulse
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Redis
REDIS_URL=redis://localhost:6379
REDIS_CACHE_DB=0
REDIS_QUEUE_DB=1

# Authentication
JWT_SECRET=your-secret-key-minimum-32-characters-required
JWT_REFRESH_SECRET=your-refresh-secret-minimum-32-characters
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Google Gemini AI
GOOGLE_GEMINI_API_KEY=your-api-key

# Optional: Market Data APIs
ALPHA_VANTAGE_API_KEY=optional
FINNHUB_API_KEY=optional
```

## Running the Application

### Development Mode

```bash
# Terminal 1: Start the API server
cd backend
pnpm run dev

# Server listens on http://localhost:5000
# Hot reload enabled with tsx watch
# Default log level: debug
```

```bash
# Terminal 2 (optional): Start background workers
cd backend
pnpm run workers

# Processes background jobs:
# - Notification queue (offline user notifications)
# - WebSocket broadcast (real-time updates)
# - Market data processing
# - Analysis jobs
```

### Production Build

```bash
# Compile TypeScript
pnpm run build

# Verify compilation
ls dist/  # Should contain server.js, worker.js

# Start in production
NODE_ENV=production node dist/server.js

# In separate terminal/process
NODE_ENV=production node dist/worker.js
```

### Docker

```bash
# Build image
docker build -t tickerpulse-api .

# Run container
docker run -p 5000:5000 \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_URL="redis://..." \
  -e GOOGLE_GEMINI_API_KEY="..." \
  tickerpulse-api
```

### Docker Compose (Full Stack)

```bash
docker-compose up -d  # Starts API + Workers + Database + Redis
docker-compose logs -f api  # View logs
docker-compose down  # Stop all services
```

## API Endpoints

### Authentication

#### Register User

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "fullName": "John Doe"
}

Response 201:
{
  "success": true,
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "fullName": "John Doe"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

#### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123"
}

Response 200:
{
  "success": true,
  "user": { ... },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

#### Refresh Token

```http
POST /api/auth/refresh
Authorization: Bearer {refreshToken}

Response 200:
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

### User Management

#### Get Profile

```http
GET /api/users/profile
Authorization: Bearer {accessToken}

Response 200:
{
  "id": "user-123",
  "email": "user@example.com",
  "fullName": "John Doe",
  "preferences": {
    "emailNotifications": true,
    "dailyDigest": true
  },
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### Update Profile

```http
PATCH /api/users/profile
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "fullName": "John Smith",
  "preferences": {
    "emailNotifications": true,
    "dailyDigest": true
  }
}
```

### Watchlists

#### List Watchlists

```http
GET /api/watchlists
Authorization: Bearer {accessToken}

Response 200: [
  {
    "id": "watchlist-123",
    "name": "Tech Stocks",
    "tickers": ["AAPL", "MSFT", "GOOGL"],
    "alertSettings": { ... },
    "createdAt": "2024-01-01T00:00:00Z"
  }
]
```

#### Create Watchlist

```http
POST /api/watchlists
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "name": "Tech Stocks",
  "tickers": ["AAPL", "MSFT", "GOOGL"],
  "alertSettings": {
    "volumeThreshold": 2.5,
    "sensitivityLevel": "high",
    "includeAlertTypes": ["volume", "divergence", "contradiction"]
  }
}

Response 201:
{
  "id": "watchlist-123",
  "name": "Tech Stocks",
  "tickers": ["AAPL", "MSFT", "GOOGL"],
  ...
}
```

#### Get Watchlist Details

```http
GET /api/watchlists/{id}
Authorization: Bearer {accessToken}

Response 200:
{
  "id": "watchlist-123",
  "name": "Tech Stocks",
  "tickers": ["AAPL", "MSFT", "GOOGL"],
  "currentData": [
    {
      "ticker": "AAPL",
      "price": 185.50,
      "change": 2.50,
      "volume": 52000000,
      "activeAlerts": 2
    }
  ],
  ...
}
```

#### Update Watchlist

```http
PUT /api/watchlists/{id}
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "name": "Updated Name",
  "tickers": ["AAPL", "MSFT"],
  "alertSettings": { ... }
}
```

#### Delete Watchlist

```http
DELETE /api/watchlists/{id}
Authorization: Bearer {accessToken}

Response 204: No Content
```

### Alerts

#### List Alerts

```http
GET /api/alerts?page=1&limit=20&status=active&sort=-timestamp
Authorization: Bearer {accessToken}

Query Parameters:
- page: Page number (default: 1)
- limit: Results per page (default: 20, max: 100)
- status: Filter by status (active|acknowledged|resolved|all)
- ticker: Filter by ticker symbol
- type: Filter by alert type (volume|divergence|contradiction)
- sort: Sort field (-timestamp, severity, etc)

Response 200:
{
  "alerts": [
    {
      "id": "alert-123",
      "ticker": "AAPL",
      "type": "divergence",
      "severity": "high",
      "status": "active",
      "message": "Volume spike without news catalyst",
      "data": {
        "volumeZScore": 2.8,
        "newsCount": 0,
        "volumeChange": 145
      },
      "explanation": "Unusual trading activity detected...",
      "timestamp": "2024-01-15T14:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 152,
    "pages": 8
  }
}
```

#### Get Alert Details

```http
GET /api/alerts/{id}
Authorization: Bearer {accessToken}

Response 200:
{
  "id": "alert-123",
  "ticker": "AAPL",
  "type": "divergence",
  "severity": "high",
  "status": "active",
  "message": "Volume spike without news catalyst",
  "data": { ... },
  "explanation": "AI-generated explanation...",
  "relatedNews": [ ... ],
  "relatedFiings": [ ... ],
  "timestamp": "2024-01-15T14:30:00Z"
}
```

#### Update Alert Status

```http
PATCH /api/alerts/{id}
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "status": "acknowledged",
  "notes": "Investigated - false alarm"
}

Response 200: Updated alert object
```

### Market Data

#### Get Ticker Data

```http
GET /api/market/ticker/{symbol}?period=1d&interval=1h
Authorization: Bearer {accessToken}

Query Parameters:
- period: 1d, 5d, 1mo, 3mo, 6mo, 1y (default: 1d)
- interval: 1m, 5m, 15m, 1h, 1d (default: 1h)

Response 200:
{
  "ticker": "AAPL",
  "currentPrice": 185.50,
  "change": 2.50,
  "changePercent": 1.37,
  "volume": 52000000,
  "high": 186.20,
  "low": 183.40,
  "marketCap": 2850000000000,
  "peRatio": 28.5,
  "priceHistory": [
    { "time": "2024-01-15T14:00:00Z", "open": 185.10, "close": 185.50, "volume": 1250000 }
  ]
}
```

#### Get Trending Tickers

```http
GET /api/market/trending?limit=10&sortBy=alerts
Authorization: Bearer {accessToken}

Query Parameters:
- limit: Number of results (default: 10, max: 50)
- sortBy: alerts|volume|change (default: alerts)

Response 200:
{
  "trending": [
    {
      "ticker": "AAPL",
      "price": 185.50,
      "change": 2.50,
      "activeAlerts": 5,
      "alertCount24h": 3
    }
  ]
}
```

### Analysis

#### Get Divergence Analysis

```http
GET /api/analysis/divergence/{symbol}?days=30
Authorization: Bearer {accessToken}

Response 200:
{
  "ticker": "AAPL",
  "period": 30,
  "divergences": [
    {
      "timestamp": "2024-01-15T14:30:00Z",
      "volumeZScore": 2.8,
      "newsCatalyts": 0,
      "socialMentions": 2,
      "score": 0.87,
      "explanation": "Significant volume spike with minimal news coverage"
    }
  ],
  "summary": {
    "totalDivergences": 3,
    "averageScore": 0.72,
    "trend": "increasing"
  }
}
```

#### Get Narrative Analysis

```http
GET /api/analysis/narrative/{symbol}?includeHistorical=true
Authorization: Bearer {accessToken}

Response 200:
{
  "ticker": "AAPL",
  "currentNarrative": {
    "strategicDirection": "Focus on AI and services",
    "keyPromises": [
      "Expand wearable market share",
      "Improve supply chain resilience"
    ],
    "riskFactors": [
      "China regulatory pressure",
      "Competition in services"
    ],
    "guidance": "10-15% revenue growth expected",
    "source": "2024 Q1 Earnings Call"
  },
  "historicalNarratives": [ ... ],
  "contradictions": [
    {
      "date": "2024-01-10",
      "currentStatement": "Strong China growth",
      "historicalStatement": "China challenges expected",
      "severity": "medium"
    }
  ]
}
```

### WebSocket (Real-time)

#### Connect to WebSocket

```javascript
const ws = new WebSocket("ws://localhost:5000/api/ws?token={accessToken}");

// Subscribe to alerts
ws.send(
  JSON.stringify({
    type: "subscribe",
    payload: {
      tickers: ["AAPL", "MSFT", "GOOGL"],
      channels: ["alerts", "market", "analysis"],
    },
  }),
);

// Receive alert event
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === "alert") {
    console.log("New alert:", message.payload);
  }
};

// Unsubscribe
ws.send(
  JSON.stringify({
    type: "unsubscribe",
    payload: { tickers: ["AAPL"] },
  }),
);
```

**WebSocket Message Types**:

```javascript
// Alert Event
{
  type: 'alert',
  ticker: 'AAPL',
  payload: {
    id: 'alert-123',
    alertType: 'divergence',
    severity: 'high',
    message: 'Volume spike without news catalyst',
    data: { volumeZScore: 2.8 },
    explanation: 'Unusual trading activity...'
  }
}

// Market Update
{
  type: 'market',
  ticker: 'AAPL',
  payload: {
    price: 185.50,
    change: 2.50,
    changePercent: 1.37,
    volume: 52000000,
    timestamp: '2024-01-15T14:30:00Z'
  }
}

// Analysis Result
{
  type: 'analysis',
  ticker: 'AAPL',
  payload: {
    analysisType: 'divergence',
    score: 0.87,
    result: { ... }
  }
}
```

## Project Structure

```
backend/
├── src/
│   ├── modules/                        # Feature-specific modules
│   │   ├── admin/                      # Admin controls and utilities
│   │   │   └── controllers/            # Admin API handlers
│   │   │
│   │   ├── alerts/                     # Alert management and processing
│   │   │   ├── controllers/            # Alert API handlers
│   │   │   ├── routes/                 # Alert API routes
│   │   │   ├── services/               # Alert business logic
│   │   │   │   ├── alertDeduplication.service.ts
│   │   │   │   ├── alertExplanation.service.ts
│   │   │   │   ├── alertSeverity.service.ts
│   │   │   │   └── alertSubjectLineGenerator.service.ts
│   │   │   ├── workers/                # Background alert processing
│   │   │   └── types/                  # Alert TypeScript types
│   │   │
│   │   ├── analysis/                   # Market analysis services
│   │   │   ├── services/               # Analysis engines
│   │   │   │   ├── volumeDetection.service.ts
│   │   │   │   ├── divergence.service.ts
│   │   │   │   ├── secFiling.service.ts
│   │   │   │   ├── contradiction.service.ts
│   │   │   │   └── promiseTracking.service.ts
│   │   │   ├── workers/                # Analysis job processors
│   │   │   ├── constants/              # Analysis configuration
│   │   │   ├── controllers/            # Analysis API handlers
│   │   │   ├── routes/                 # Analysis API routes
│   │   │   └── types/                  # Analysis types
│   │   │
│   │   ├── auth/                       # Authentication module
│   │   │   ├── controllers/            # Login, register, token refresh
│   │   │   ├── routes/                 # Auth endpoints
│   │   │   ├── services/               # Supabase integration
│   │   │   │   └── supabaseAuth.service.ts
│   │   │   └── types/                  # Auth types
│   │   │
│   │   ├── market/                     # Market data & real-time
│   │   │   ├── controllers/            # Market data endpoints
│   │   │   ├── routes/                 # Market API routes
│   │   │   ├── services/               # Price/volume fetching
│   │   │   └── workers/                # WebSocket broadcast worker
│   │   │       └── websocket.worker.ts
│   │   │
│   │   ├── news/                       # News aggregation
│   │   │   ├── services/               # News fetching & processing
│   │   │   └── workers/                # News processing jobs
│   │   │
│   │   ├── notifications/              # Alert delivery system
│   │   │   ├── controllers/            # Notification endpoints
│   │   │   ├── routes/                 # Notification routes
│   │   │   ├── services/               # Notification logic
│   │   │   ├── workers/                # Queue processing
│   │   │   │   └── notification-queue.worker.ts
│   │   │   └── types/                  # Notification types
│   │   │
│   │   ├── users/                      # User management
│   │   │   ├── controllers/            # User endpoints
│   │   │   ├── routes/                 # User routes
│   │   │   └── services/               # User business logic
│   │   │
│   │   └── watchlists/                 # User watchlists
│   │       ├── controllers/            # Watchlist endpoints
│   │       ├── routes/                 # Watchlist routes
│   │       ├── services/               # Watchlist logic
│   │       └── types/                  # Watchlist types
│   │
│   ├── shared/                         # Shared utilities & infrastructure
│   │   ├── infra/                      # Infrastructure services
│   │   │   ├── libs/                   # Libraries & utilities
│   │   │   │   ├── database.ts         # Database/Supabase client
│   │   │   │   ├── supabase.ts         # Supabase initialization
│   │   │   │   └── gemini.service.ts   # Google Gemini AI integration
│   │   │   ├── services/               # Singleton services
│   │   │   │   ├── cache.service.ts    # Redis caching abstraction
│   │   │   │   └── queue.service.ts    # Bull job queue management
│   │   │   └── workers/                # Worker utilities
│   │   │
│   │   ├── middlewares/                # Express/Fastify middlewares
│   │   │   └── auth.middleware.ts      # JWT authentication
│   │   │
│   │   ├── types/                      # Global TypeScript types
│   │   │   ├── database.types.ts       # Database schema types
│   │   │   ├── domain.ts               # Domain models
│   │   │   ├── fastify.d.ts            # Fastify type extensions
│   │   │   └── supabase.ts             # Supabase types
│   │   │
│   │   └── utils/                      # Utility functions
│   │       ├── errors.ts               # Custom error classes
│   │       └── helpers.ts              # Helper functions
│   │
│   ├── config/                         # Configuration
│   │   ├── environmentalVariables.ts   # Environment config & validation
│   │   ├── logger.ts                   # Pino logger setup
│   │   └── redis.ts                    # Redis client configuration
│   │
│   ├── app.ts                          # Fastify app initialization
│   ├── server.ts                       # Server entry point
│   └── worker.ts                       # Worker process entry point
│
├── database/
│   └── schema.sql                      # PostgreSQL schema with TimescaleDB
│
├── frontend_ints/                      # Frontend integration examples (WIP)
│   ├── alert.ts
│   ├── auth.ts
│   ├── calculations.ts
│   └── ...
│
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── jest.config.js                      # Jest test configuration
├── .env.example                        # Environment template
├── DATABASE_SCHEMA.md                  # Detailed schema documentation
├── IMPLEMENTATION_GUIDE.md             # How to implement features
├── IMPLEMENTATION_SUMMARY.md           # Progress tracking
├── AUTH_ARCHITECTURE.md                # Authentication design details
└── README.md                           # This file
```

## Key Services & Modules

### Analysis Services

#### VolumeDetectionService

**Location**: `src/modules/analysis/services/volumeDetection.service.ts`

Detects statistically significant volume spikes using Z-score analysis.

**Key Methods**:

- `detectVolumeSpike(ticker, currentVolume)` - Analyzes volume data against 20-day average
- `calculateStats(historicalVolume)` - Computes mean and standard deviation
- `compareWithHistorical(ticker, period)` - Compare current to historical patterns

**Algorithm**:

```
z_score = (current_volume - average_volume) / standard_deviation

Alert if z_score > threshold (default: 2.0, meaning 95% confidence)
```

#### DivergenceService

**Location**: `src/modules/analysis/services/divergence.service.ts`

Identifies divergences between volume spikes and public information.

**Logic**:

1. Detects volume spike (via VolumeDetectionService)
2. Queries news, SEC filings, social media for same time period
3. If volume spike WITHOUT catalyst → Create divergence alert

**Key Methods**:

- `detectDivergence(ticker, volumeSpike, newsData)` - Main detection algorithm
- `scoreSentiment(newsContent)` - AI-powered sentiment analysis
- `getNewsSources(ticker, timerange)` - Aggregate news from multiple sources

#### SecFilingService

**Location**: `src/modules/analysis/services/secFiling.service.ts`

Processes SEC filings and extracts narrative analysis.

**Key Methods**:

- `fetchLatestFilings(ticker)` - Get recent 10-K, 10-Q, 8-K filings
- `extractNarrative(filingContent)` - AI extraction via Gemini of:
  - Strategic direction and company promises
  - Risk factors and changes
  - Management guidance and targets
  - Key competitive commentary
- `detectContradictions(ticker, currentNarrative, historicalNarrative)` - Compare narratives for inconsistencies

#### ContradictionDetectionService

**Location**: `src/modules/analysis/services/contradiction.service.ts`

Detects inconsistencies between current and historical company statements.

**Detects**:

- Broken promises (company didn't deliver on stated goals)
- Strategic shifts (sudden change in messaging)
- Risk discrepancies (different risk assessment)
- Guidance changes (updated forward guidance)

### Infrastructure Services

#### RedisService

**Location**: `src/config/redis.ts`

Centralized Redis client management with connection pooling and error recovery.

```typescript
// Singleton instance
export const redis = new RedisService();

// Usage examples
await redis.set("key", value, { ex: 300 }); // 5 min expiry
const value = await redis.get("key");
await redis.del("key");
await redis.lpush("queue", item);
```

**Features**:

- Lazy connection (deferred until first use)
- Automatic retry with exponential backoff
- Separate databases for cache (0) and queue (1)
- Connection pooling for performance

#### CacheService

**Location**: `src/shared/infra/services/cache.service.ts`

High-level cache abstraction over Redis with TTL management.

```typescript
// Simple cache operations
await cache.set("ticker:AAPL", data, 300); // 5 minutes
const value = await cache.get("ticker:AAPL");

// Get-or-fetch pattern
const data = await cache.getOrFetch(
  "ticker:AAPL",
  async () => await fetchTickerData("AAPL"),
  300, // TTL in seconds
);

// Invalidate cache
await cache.invalidate("ticker:AAPL");
await cache.invalidatePattern("ticker:*"); // Wildcard invalidation
```

**Cache Keys Format** (by convention):

```
ticker:{symbol}                    # Market data, 5 min TTL
user:{userId}:alerts              # User's alerts, 1 min TTL
watchlist:{watchlistId}            # Watchlist data, 2 min TTL
analysis:{symbol}:divergence      # Analysis cache, 1 hour TTL
narratives:{symbol}:{year}        # SEC filing analysis, 30 day TTL
```

#### QueueService

**Location**: `src/shared/infra/services/queue.service.ts`

Bull job queue management for async processing with Redis backing.

```typescript
// Enqueue a job
await queue.notificationQueue.add(
  "send-notification",
  {
    userId: "123",
    alertId: "456",
  },
  {
    delay: 5000, // Wait 5 seconds before processing
    attempts: 3, // Retry up to 3 times on failure
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
);

// Process jobs
queue.notificationQueue.process(async (job) => {
  const { userId, alertId } = job.data;
  // Process the job
  return { success: true };
});
```

**Registered Queues**:

- `notificationQueue` - User notifications for offline users
- `analysisQueue` - Market analysis jobs
- `newsQueue` - News processing and sentiment analysis
- `broadcastQueue` - WebSocket broadcasts to connected clients

#### LoggerService

**Location**: `src/config/logger.ts`

Pino structured logging with context-aware JSON output.

```typescript
// Structured logging examples
logger.info({ userId: "123", action: "login" }, "User logged in");
logger.error({ error, context: "database" }, "Query failed");
logger.warn({ threshold: 2.5, actual: 2.8 }, "Threshold exceeded");
logger.debug({ ticker: "AAPL", zScore: 2.8 }, "Volume spike detected");

// In development: Pretty-printed console output
// In production: JSON output for log aggregation services (ELK, Datadog, etc)
```

**Log Levels** (in order of severity):

- `debug` - Detailed execution traces (development only)
- `info` - Normal operations, user actions
- `warn` - Concerning conditions, threshold exceeded
- `error` - Error conditions, failed operations that can be recovered
- `fatal` - System failure, requires immediate shutdown

## Database Schema

### Core Tables

```sql
-- Users (via Supabase Authentication)
users
  ├── id (UUID) - Primary key
  ├── email (TEXT) - Unique email
  ├── full_name (TEXT)
  ├── preferences (JSONB)
  │   ├── emailNotifications (boolean)
  │   └── dailyDigest (boolean)
  ├── created_at (TIMESTAMP)
  └── updated_at (TIMESTAMP)

-- Watchlists (Per-user custom ticker lists)
watchlists
  ├── id (UUID)
  ├── user_id (UUID, FK)
  ├── name (TEXT)
  ├── tickers (TEXT[]) - Array of symbols
  ├── alert_settings (JSONB)
  │   ├── volumeThreshold (numeric)
  │   ├── sensitivityLevel (enum)
  │   └── includeAlertTypes (array)
  ├── created_at (TIMESTAMP)
  └── updated_at (TIMESTAMP)

-- Alerts (TimescaleDB Hypertable - Time-series optimized)
alerts (hypertable)
  ├── id (UUID)
  ├── watchlist_id (UUID, FK)
  ├── ticker (TEXT) - Stock symbol
  ├── alert_type (ENUM) - volume|divergence|contradiction
  ├── severity (ENUM) - low|medium|high|critical
  ├── status (ENUM) - active|acknowledged|resolved|dismissed
  ├── message (TEXT) - Alert headline
  ├── data (JSONB) - Contains:
  │   ├── volumeZScore (numeric)
  │   ├── volumeChange (numeric)
  │   ├── newsCount (integer)
  │   ├── sentimentScore (numeric)
  │   └── ... analysis-specific fields
  ├── explanation (TEXT) - Gemini AI generated explanation
  ├── related_news (UUID[]) - FK to news_articles
  ├── related_filings (UUID[]) - FK to sec_filings
  ├── timestamp (TIMESTAMP, indexed for time-queries)
  ├── created_at (TIMESTAMP)
  └── updated_at (TIMESTAMP)

-- Market Data (TimescaleDB Hypertable - Real-time price/volume)
market_data (hypertable)
  ├── ticker (TEXT) - Stock symbol
  ├── price (NUMERIC)
  ├── volume (BIGINT)
  ├── high (NUMERIC)
  ├── low (NUMERIC)
  ├── market_cap (BIGINT)
  ├── pe_ratio (NUMERIC)
  ├── dividend_yield (NUMERIC)
  ├── timestamp (TIMESTAMP, indexed)
  └── created_at (TIMESTAMP)

-- Company Narratives (Extracted from SEC filings)
company_narratives
  ├── id (UUID)
  ├── ticker (TEXT)
  ├── narrative (JSONB)
  │   ├── strategicDirection (TEXT)
  │   ├── keyPromises (TEXT[])
  │   ├── riskFactors (TEXT[])
  │   ├── guidance (TEXT)
  │   ├── competitivePosition (TEXT)
  │   └── capexPlans (TEXT)
  ├── source (ENUM) - 10-K|10-Q|8-K|earnings-call
  ├── period (TEXT) - Fiscal period
  ├── filing_date (TIMESTAMP)
  ├── processed (BOOLEAN)
  ├── analysis (JSONB) - Gemini analysis results
  ├── created_at (TIMESTAMP)
  └── updated_at (TIMESTAMP)

-- SEC Filings
sec_filings
  ├── id (UUID)
  ├── ticker (TEXT)
  ├── filing_type (ENUM) - 10-K|10-Q|8-K|etc
  ├── url (TEXT) - Link to SEC.gov
  ├── content (TEXT) - Full filing text
  ├── processed (BOOLEAN) - Whether narrative extracted
  ├── analysis (JSONB) - AI analysis results
  ├── filed_date (TIMESTAMP)
  ├── created_at (TIMESTAMP)
  └── updated_at (TIMESTAMP)

-- News Articles (Aggregated from multiple sources)
news_articles
  ├── id (UUID)
  ├── ticker (TEXT)
  ├── headline (TEXT)
  ├── content (TEXT)
  ├── source (TEXT) - Financial news source
  ├── url (TEXT)
  ├── sentiment (ENUM) - positive|neutral|negative
  ├── confidence (NUMERIC) - 0-1 sentiment confidence
  ├── published_at (TIMESTAMP)
  ├── created_at (TIMESTAMP)
  └── updated_at (TIMESTAMP)

-- Notifications (Offline user notification queue)
notifications
  ├── id (UUID)
  ├── user_id (UUID, FK)
  ├── alert_id (UUID, FK)
  ├── message (TEXT)
  ├── read (BOOLEAN)
  ├── delivered (BOOLEAN)
  ├── created_at (TIMESTAMP)
  └── expires_at (TIMESTAMP)
```

### Key Indexes

```sql
-- For fast alert queries
CREATE INDEX idx_alerts_user_status ON alerts(user_id, status, timestamp DESC);
CREATE INDEX idx_alerts_ticker_timestamp ON alerts(ticker, timestamp DESC);

-- For real-time market data
CREATE INDEX idx_market_data_ticker ON market_data(ticker, timestamp DESC);

-- For watchlist lookups
CREATE INDEX idx_watchlists_user ON watchlists(user_id);

-- For narrative searches
CREATE INDEX idx_narratives_ticker ON company_narratives(ticker, filing_date DESC);
```

## Real-time Architecture

### WebSocket Flow

```
Browser/Client
      │ WebSocket Connection
      ▼
Fastify WebSocket Handler
      │ Token validation
      │ Subscription management
      ▼
Redis Pub/Sub (for scalability)
      │
      ├── ticker:AAPL
      ├── ticker:MSFT
      └── ticker:GOOGL (user subscribed)
      │
      ▼
Broadcast Worker Process
(websocket.worker.ts)
      │
      ├─ Receives market data updates
      ├─ Receives new alert events
      └─ Sends to all subscribed WebSocket connections
      │
      ▼
Client receives real-time updates
```

### Notification Queue System

```
Alert Generated (in analysis worker)
      │
      ▼
Check User Online Status
      │
  ┌───┴────────┐
  │            │
  ▼            ▼
Online      Offline
  │            │
  ▼            ▼
WebSocket  Queue Job
 Instant   (notification-queue.worker.ts)
 Delivery       │
           ┌────┴────┐
           │         │
        Wait for   Email
        user to    (future feature)
        log in
```

## Caching Strategy

### Cache Hierarchy

```
Request arrives
      │
      ▼
┌─────────────────────┐
│ Check Redis Cache   │ ← L1 Cache (Fast)
└────────┬────────────┘
         │
     ┌───┴────┐
     │        │
    HIT      MISS
     │        │
     ▼        ▼
  Return   Query
  from     Database
  Redis    & Process
  (1ms)       │
              ▼
          ┌──────────────┐
          │ Update Cache │ ← Set TTL
          │  (with TTL)  │
          └────┬─────────┘
               │
               ▼
            Return
           Result
          (300ms)
```

**Cache TTL by Type**:

- Market data: 5-10 minutes (frequently updated)
- User alerts: 1 minute (real-time driven)
- Watchlist data: 2 minutes
- Analysis results: 1 hour (computationally expensive)
- SEC filing analysis: 30 days (static content)

## Performance & Monitoring

### Expected Response Times (p95)

| Endpoint            | Cached | Uncached |
| ------------------- | ------ | -------- |
| List alerts         | 45ms   | 200ms    |
| Create alert        | -      | 120ms    |
| Get ticker data     | 80ms   | 350ms    |
| Divergence analysis | 150ms  | 2000ms   |
| WebSocket broadcast | <50ms  | <50ms    |

### Monitoring Metrics

Track these metrics in production:

```
[API Server]
- Request count by endpoint
- Response time (p50, p95, p99)
- Error rate by status code
- Cache hit rate

[Database]
- Query count and execution time
- Slow query log (>100ms)
- Connection pool utilization

[Queue]
- Job queue depth
- Job processing time
- Failed job count
- Worker concurrency

[Alerts]
- Divergences detected per hour
- Filings processed per hour
- Alert deduplication effectiveness
```

## Development Guide

### Adding a New Alert Type

1. **Update types**:

   ```typescript
   // types/alert.types.ts
   export type AlertType =
     | "volume"
     | "divergence"
     | "contradiction"
     | "newType";
   ```

2. **Create detection service**:

   ```typescript
   // src/modules/analysis/services/newType.service.ts
   export class NewTypeDetectionService {
     async detect(ticker: string): Promise<AlertData> {
       // Implementation
     }
   }
   ```

3. **Register in worker**:

   ```typescript
   // src/worker.ts
   analysisQueue.process("detect-newType", processor);
   ```

4. **Add controller endpoint** (if needed)

### Adding an API Endpoint

1. **Create controller**:

   ```typescript
   // src/modules/feature/controllers/feature.controller.ts
   export const getFeature = async (req, res) => {
     // Implementation
   };
   ```

2. **Add route**:

   ```typescript
   // src/modules/feature/routes/index.ts
   fastify.get("/api/feature/:id", getFeature);
   ```

3. **Add types**:

   ```typescript
   // Request/response types
   ```

4. **Test**:
   ```bash
   curl http://localhost:5000/api/feature/123
   ```

## Troubleshooting

### Redis Connection Error: ENOTFOUND redis.railway.internal

**Symptoms**: Server crashes with `redis.railway.internal: ENOTFOUND`

**Cause**: ioredis tries immediate DNS resolution on startup

**Solution**: Already applied in `src/config/redis.ts`:

```typescript
const client = new Redis({
  url: REDIS_URL,
  lazyConnect: true, // Defers connection
  retryStrategy: (times) => Math.min(times * 50, 2000),
});
```

### Database Connection Timeout

**Symptoms**: Requests timeout, "Database connection failed" in logs

**Solution**:

```bash
# Test PostgreSQL
psql -U postgres -h localhost

# Check DATABASE_URL format
postgresql://user:password@host:port/database

# Verify Supabase credentials if using Supabase
```

### WebSocket Connection Fails

**Symptoms**: 404 on `/api/ws`, WebSocket connection refused

**Solution**:

```bash
# Check WebSocket route registered
grep -r "websocket: true" src/

# Verify token in URL query string
ws://localhost:5000/api/ws?token=eyJ...
```

### High Memory Usage

**Symptoms**: Node process memory continuously increases

**Cause**: Redis cache not evicting, job queue not cleaning

**Solution**:

```typescript
// Set cache expiration
await redis.set("key", value, "EX", 300);

// Clean old jobs
queue.clean(3600000, 0); // Remove jobs older than 1 hour
```

### Alerts Not Generating

**Symptoms**: No alerts despite volume spikes

**Check**:

```bash
# Worker process running?
ps aux | grep "node dist/worker.js"

# Queue has jobs?
redis-cli KEYS "*bull*"

# Check logs
tail -f logs/app.log | grep "analysis"
```

## Related Documentation

- [Root README](../README.md) - Project overview and quick start
- [Frontend README](../frontend/README.md) - UI integration and features
---

**Last Updated**: January 2026  
**Version**: Gemini-3 hackathon 
