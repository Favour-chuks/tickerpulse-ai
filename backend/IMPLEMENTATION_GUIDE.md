# SignalHub Implementation Guide

## Overview

This document outlines the complete implementation strategy for the Real-Time Narrative Detection Engine.

## Project Structure

```
signalhub/
├── src/
│   ├── services/           # Business logic services
│   │   ├── gemini.service.ts
│   │   ├── volumeDetection.service.ts
│   │   ├── secFiling.service.ts
│   │   ├── divergenceDetection.service.ts
│   │   ├── auth.service.ts
│   │   ├── watchlist.service.ts
│   │   └── alert.service.ts
│   ├── controllers/        # API endpoint handlers
│   │   ├── alert.controllers.ts
│   │   ├── divergence.controllers.ts
│   │   ├── filing.controllers.ts
│   │   ├── narrative.controllers.ts
│   │   ├── market.controllers.ts
│   │   └── analysis.controllers.ts
│   ├── routes/             # API route definitions
│   ├── middlewares/        # Auth, logging, etc.
│   ├── types/              # TypeScript types
│   ├── libs/               # Database, Redis, etc.
│   ├── workers/            # Background job processing
│   ├── utils/              # Helper functions
│   ├── app.ts              # Express/Fastify setup
│   └── server.ts           # Entry point
├── database/               # SQL migrations
│   └── 001_initial_schema.sql
├── tests/                  # Test suites
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── .env.example            # Environment variables template
└── package.json
```

## Implementation Phases

### Phase 1: Foundation (Days 1-3)
**Goal**: Set up core infrastructure and basic functionality

#### Tasks:
1. ✅ Database schema setup
2. ✅ Type definitions
3. ✅ Core services (Gemini, Volume Detection, SEC Filing)
4. Create API endpoints for:
   - Market data ingestion
   - Volume spike recording
   - Filing storage and retrieval
5. Setup Redis for caching
6. Create WebSocket handler for real-time alerts

#### Deliverables:
- Database with all tables created
- Core services working
- Basic API for market data and filings
- Real-time WebSocket connection

### Phase 2: Intelligence (Days 4-6)
**Goal**: Add AI analysis and detection logic

#### Tasks:
1. Implement Divergence Detection Service
2. Filing narrative analysis pipeline
3. Contradiction detection
4. Promise tracking
5. Alert generation and notifications
6. Create API endpoints for:
   - Alert retrieval and management
   - Narrative retrieval
   - Contradiction viewing

#### Deliverables:
- Full divergence detection working end-to-end
- Narrative analysis pipeline
- Alert system operational

### Phase 3: Scale & Polish (Days 7-10)
**Goal**: Add features and optimize performance

#### Tasks:
1. User watchlist management
2. User authentication (JWT)
3. Alert preferences
4. Dashboard data endpoints
5. Bulk filing processing
6. Background job queue (Bull/Redis)
7. Performance optimization

#### Deliverables:
- Full multi-user support
- User preferences
- Bulk processing capability
- Performance optimized

### Phase 4: Testing & Deployment (Days 11-13)
**Goal**: Comprehensive testing and production readiness

#### Tasks:
1. Unit tests (60%+ coverage)
2. Integration tests
3. Load testing
4. Error handling improvements
5. Documentation
6. Deployment setup

#### Deliverables:
- Tested, production-ready system
- Complete documentation

## Core Services Implementation

### 1. Volume Detection Service ✅
**File**: `src/services/volumeDetection.service.ts`

Handles:
- 20-day moving average calculation
- Z-score analysis
- Spike detection
- Historical spike tracking

Key Methods:
- `getMovingAverageVolume()` - Calculate baseline
- `calculateVolumeMetrics()` - Get stats
- `recordVolumeSpikeEvent()` - Log spike
- `getUnprocessedSpikes()` - Get pending analysis
- `detectAnomaliesForWatchlist()` - Batch detection

### 2. SEC Filing Service ✅
**File**: `src/services/secFiling.service.ts`

Handles:
- Filing storage and retrieval
- Narrative generation
- Promise extraction
- Filing timeline

Key Methods:
- `storeFiling()` - Save new filing
- `processFilingNarrative()` - Analyze with Gemini
- `getNarrativesForTicker()` - Get timeline
- `getPendingPromises()` - Get commitments to verify
- `updatePromiseStatus()` - Track promise fulfillment

### 3. Gemini Service ✅
**File**: `src/services/gemini.service.ts`

Handles:
- Filing materiality filtering (Flash)
- Deep narrative analysis (Pro)
- Contradiction detection
- Divergence hypothesis generation

Key Methods:
- `filterMaterialFiling()` - Quick filter
- `analyzeFilingNarrative()` - Deep analysis
- `detectContradictions()` - Compare statements
- `generateDivergenceHypothesis()` - Explain spikes
- `checkPromiseFulfillment()` - Verify commitments

### 4. Divergence Detection Service ✅
**File**: `src/services/divergenceDetection.service.ts`

Handles:
- Spike analysis for divergence
- Alert creation and management
- Contradiction flagging
- User notifications

Key Methods:
- `analyzeSpikeForDivergence()` - Main analysis
- `getAlertsForTicker()` - Retrieve alerts
- `updateAlertStatus()` - Manage alert lifecycle
- `checkFilingForContradictions()` - Flag changes
- `notifyWatchingUsers()` - Send notifications

## API Endpoints to Implement

### Authentication
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
```

### Watchlist
```
GET    /api/v1/watchlist
POST   /api/v1/watchlist/:ticker
DELETE /api/v1/watchlist/:ticker
PATCH  /api/v1/watchlist/:ticker/preferences
```

### Market Data
```
GET    /api/v1/market/:ticker/current
GET    /api/v1/market/:ticker/volume-profile
POST   /api/v1/market/record-spike
```

### Filings
```
GET    /api/v1/filings/:ticker
GET    /api/v1/filings/:id
POST   /api/v1/filings/upload
```

### Narratives
```
GET    /api/v1/narratives/:ticker
GET    /api/v1/narratives/:ticker/timeline
GET    /api/v1/narratives/:id
```

### Alerts
```
GET    /api/v1/alerts?ticker=AAPL&status=active
GET    /api/v1/alerts/:id
PUT    /api/v1/alerts/:id/dismiss
GET    /api/v1/alerts/user/me
```

### Analysis
```
POST   /api/v1/analyse/filing/:id
GET    /api/v1/analyse/promises/:ticker
GET    /api/v1/analyse/contradictions/:ticker
```

### WebSocket
```
WS     /ws/alerts - Real-time alert stream
WS     /ws/market - Real-time market data (future)
```

## Environment Variables

Create `.env` file:

```
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=signalhub

# JWT
JWT_SECRET=your_secret_key_here
JWT_REFRESH_SECRET=your_refresh_secret

# Gemini
GEMINI_API_KEY=your_gemini_key

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Supabase (optional)
SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_key

# Server
NODE_ENV=development
PORT=5000
LOG_LEVEL=info
```

## Database Setup

### 1. Create PostgreSQL Database

```bash
createdb signalhub
```

### 2. Install TimescaleDB

```bash
# On macOS
brew install timescaledb

# Then enable extension:
psql -U postgres -d signalhub -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
```

### 3. Install pgvector

```bash
# Required for semantic search
psql -U postgres -d signalhub -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 4. Run Migrations

```bash
psql -U postgres -d signalhub -f database/001_initial_schema.sql
```

## Redis Setup

### Install Redis

```bash
# macOS
brew install redis

# Start Redis
brew services start redis
```

### Usage in Code

```typescript
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
});
```

## Queue Setup (Bull)

Bull will handle:
- Filing analysis jobs
- Volume spike detection
- Contradiction checking
- Promise verification

### Example:

```typescript
import Queue from 'bull';

const analysisQueue = new Queue('filing-analysis', {
  redis: { host: 'localhost', port: 6379 }
});

// Add job
analysisQueue.add(
  { filingId: 123 },
  { priority: 10, attempts: 3 }
);

// Process job
analysisQueue.process(async (job) => {
  const { filingId } = job.data;
  return await secFilingService.processFilingNarrative(filingId);
});
```

## Testing Strategy

### Unit Tests
Location: `tests/unit/`

Test each service in isolation:
```typescript
// Example: volumeDetection.test.ts
describe('VolumeDetectionService', () => {
  it('should detect volume spike', () => {
    // Mock market data
    // Call calculateVolumeMetrics()
    // Assert spike detected
  });
});
```

### Integration Tests
Location: `tests/integration/`

Test end-to-end flows:
```typescript
// Example: divergence.integration.test.ts
describe('Divergence Detection Flow', () => {
  it('should detect divergence and create alert', async () => {
    // 1. Record volume spike
    // 2. Check for catalysts
    // 3. Generate hypothesis
    // 4. Verify alert created
  });
});
```

### Test Fixtures
Location: `tests/fixtures/`

Pre-built test data:
- Mock market data
- Sample SEC filings
- Test user data
- Expected Gemini responses

## Monitoring & Logging

### Structured Logging

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

logger.info({ ticker: 'AAPL', volume: 1000 }, 'Volume spike detected');
```

### Key Metrics to Track

```typescript
// Application metrics
- divergences_detected_per_hour
- filings_processed_per_hour
- gemini_api_calls_per_minute
- alert_accuracy_rate

// System metrics
- api_response_time_p95
- database_query_time_p99
- queue_depth
```

## Error Handling

### Standard Error Response

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  timestamp: Date;
}

// Example
{
  "success": false,
  "error": "Filing analysis failed",
  "code": "ANALYSIS_FAILED",
  "timestamp": "2026-01-07T12:00:00Z"
}
```

### Error Codes

- `VALIDATION_ERROR` - Input validation failed
- `NOT_FOUND` - Resource not found
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `RATE_LIMITED` - Too many requests
- `GEMINI_ERROR` - AI service error
- `DATABASE_ERROR` - Database operation failed
- `INTERNAL_ERROR` - Unexpected server error

## Performance Optimization

### Caching Strategy

```typescript
// Cache filing analysis for 24 hours
await redis.setex(
  `narrative:${filingId}`,
  86400,
  JSON.stringify(narrative)
);

// Cache watchlist for 1 hour
await redis.setex(
  `watchlist:${userId}`,
  3600,
  JSON.stringify(watchlist)
);
```

### Database Optimization

1. Create indexes (done in migration)
2. Use materialized views for complex queries
3. Archive old market data
4. Batch insert alerts

### API Optimization

1. Pagination for list endpoints
2. Lazy load nested data
3. Compress responses (gzip)
4. Rate limiting per user

## Deployment Checklist

- [ ] All environment variables configured
- [ ] Database migrations applied
- [ ] Redis running
- [ ] SSL certificates configured
- [ ] Logging configured
- [ ] Monitoring set up
- [ ] Error tracking (Sentry)
- [ ] API documentation generated
- [ ] Load testing passed
- [ ] Backup strategy verified

## Next Steps

1. **Implement remaining services** based on phase 2-3
2. **Create API controllers** for each endpoint
3. **Setup background workers** for processing
4. **Write tests** as features are implemented
5. **Setup CI/CD** pipeline
6. **Deploy to staging** for UAT
7. **Production deployment** with monitoring

## Key Files to Create Next

```
src/services/
  ├── auth.service.ts        # User authentication
  ├── watchlist.service.ts    # Watchlist management
  ├── alert.service.ts        # Alert management
  └── market.service.ts       # Market data handling

src/controllers/
  ├── market.controllers.ts
  ├── filing.controllers.ts
  ├── alert.controllers.ts
  └── analysis.controllers.ts

src/workers/
  ├── filing-processor.worker.ts
  ├── volume-detector.worker.ts
  └── contradiction-checker.worker.ts

src/utils/
  ├── validators.ts
  ├── transformers.ts
  └── constants.ts

tests/
  ├── unit/services.test.ts
  ├── integration/flow.test.ts
  └── fixtures/data.ts
```
