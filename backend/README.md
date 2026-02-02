# SignalHub - Real-Time Narrative Detection Engine

## Overview

SignalHub is a sophisticated real-time system that detects divergences between volume spikes and public information, analyzes SEC filings for contradictions, and generates AI-powered insights about market movements.

### Key Features

- **Volume Spike Detection**: Real-time monitoring of unusual trading volume
- **Narrative Analysis**: AI-powered analysis of SEC filings using Google Gemini
- **Contradiction Detection**: Identifies inconsistencies between company statements
- **Divergence Detection**: Flags volume movements without clear public catalysts
- **Promise Tracking**: Monitors company commitments and verifies fulfillment
- **Real-time Alerts**: WebSocket-based alert system
- **User Watchlists**: Personalized ticker tracking with customizable alerts

## System Architecture

```
Data Sources → Processing Layer → AI Analysis → Alert Generation → Users
   ↓               ↓                ↓              ↓
Market Data     Volume Detection   Gemini AI     WebSocket
SEC Filings     Filing Analysis    Contradiction  REST API
News/Social     Divergence Check   Detection
```

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ with TimescaleDB
- Redis 6+
- Google Gemini API key

## Installation

### 1. Clone and Setup

```bash
git clone <repo-url>
cd signalhub
pnpm install
```

### 2. Database Setup

#### Create PostgreSQL Database

```bash
# macOS
brew install postgresql timescaledb-bundle
brew services start postgresql

# Linux
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql

# Create database
createdb signalhub
```

#### Enable Extensions

```bash
psql -U postgres -d signalhub -c "CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"
psql -U postgres -d signalhub -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

#### Run Migrations

```bash
psql -U postgres -d signalhub -f database/001_initial_schema.sql
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
LOG_LEVEL=info

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=signalhub

# JWT
JWT_SECRET=your_super_secret_key_change_this
JWT_REFRESH_SECRET=your_refresh_secret_change_this

# Gemini
GEMINI_API_KEY=your_gemini_api_key

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Supabase (optional)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 5. Install Dependencies

```bash
pnpm install
```

## Running the Application

### Development Mode

```bash
pnpm run dev
```

Server will start on `http://localhost:5000`

### Production Build

```bash
pnpm run build
NODE_ENV=production node dist/server.js
```

## Testing

### Run All Tests

```bash
pnpm run test
```

### Run Tests in Watch Mode

```bash
pnpm run test:watch
```

### Generate Coverage Report

```bash
pnpm run test:coverage
```

### Run Integration Tests Only

```bash
pnpm run test:integration
```

## API Documentation

### Authentication Endpoints

#### Register User

```
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### Login

```
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123"
}

Response:
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

#### Refresh Token

```
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJ..."
}
```

### Watchlist Endpoints

#### Get Watchlist

```
GET /api/v1/watchlist
Authorization: Bearer {accessToken}
```

#### Add Ticker

```
POST /api/v1/watchlist/:ticker
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "alertPreferences": {
    "divergence": true,
    "filing": true,
    "contradiction": true,
    "social": false,
    "severityFilter": "medium"
  }
}
```

#### Remove Ticker

```
DELETE /api/v1/watchlist/:ticker
Authorization: Bearer {accessToken}
```

### Alert Endpoints

#### Get User Alerts

```
GET /api/v1/alerts?limit=20&offset=0&read=false
Authorization: Bearer {accessToken}
```

#### Get Alert Details

```
GET /api/v1/alerts/:id
Authorization: Bearer {accessToken}
```

#### Mark Alert as Read

```
PUT /api/v1/alerts/:id/read
Authorization: Bearer {accessToken}
```

#### Dismiss Alert

```
PUT /api/v1/alerts/:id/dismiss
Authorization: Bearer {accessToken}
```

### Narratives Endpoints

#### Get Narratives for Ticker

```
GET /api/v1/narratives/:ticker?limit=20&offset=0
Authorization: Bearer {accessToken}
```

#### Get Narrative Timeline

```
GET /api/v1/narratives/:ticker/timeline
Authorization: Bearer {accessToken}
```

#### Get Contradictions

```
GET /api/v1/narratives/:ticker/contradictions
Authorization: Bearer {accessToken}
```

### WebSocket Events

#### Connect to Alerts Stream

```
WS ws://localhost:5000/ws/alerts?token={accessToken}

Server sends:
{
  "type": "DIVERGENCE_ALERT",
  "data": {
    "ticker": "AAPL",
    "severity": "high",
    "spikeMagnitude": 3.5,
    "hypothesis": "Insider information leak suspected...",
    "timestamp": "2026-01-07T12:00:00Z"
  }
}
```

## Project Structure

```
signalhub/
├── database/
│   └── 001_initial_schema.sql      # Database schema
├── src/
│   ├── services/                   # Business logic
│   │   ├── auth.service.ts
│   │   ├── volumeDetection.service.ts
│   │   ├── secFiling.service.ts
│   │   ├── divergenceDetection.service.ts
│   │   ├── gemini.service.ts
│   │   ├── watchlist.service.ts
│   │   └── alert.service.ts
│   ├── controllers/                # API handlers
│   │   ├── alert.controllers.ts
│   │   ├── filing.controllers.ts
│   │   └── ...
│   ├── routes/                     # API routes
│   ├── middlewares/                # Auth, logging
│   ├── types/                      # TypeScript types
│   │   └── domain.ts
│   ├── libs/                       # Database, Redis
│   │   ├── database.ts
│   │   └── supabase.ts
│   ├── utils/                      # Helpers
│   │   └── helpers.ts
│   ├── app.ts                      # App setup
│   └── server.ts                   # Entry point
├── tests/
│   ├── volumeDetection.test.ts
│   ├── auth.test.ts
│   ├── divergence.integration.test.ts
│   ├── setup.ts
│   └── fixtures/
├── .env.example                    # Environment template
├── DATABASE_SCHEMA.md              # Schema documentation
├── IMPLEMENTATION_GUIDE.md         # Implementation guide
├── package.json
├── tsconfig.json
└── jest.config.js
```

## Key Services

### VolumeDetectionService

Handles volume spike detection and metrics calculation.

Key methods:

- `getMovingAverageVolume()` - 20-day baseline
- `calculateVolumeMetrics()` - Z-score analysis
- `recordVolumeSpikeEvent()` - Log spike
- `detectAnomaliesForWatchlist()` - Batch detection

### SecFilingService

Manages SEC filing processing and narrative extraction.

Key methods:

- `storeFiling()` - Save new filing
- `processFilingNarrative()` - AI analysis
- `getNarrativesForTicker()` - Get timeline
- `getPendingPromises()` - Track commitments

### GeminiService

Integrates Google Gemini AI for analysis.

Key methods:

- `filterMaterialFiling()` - Quick filter (Flash)
- `analyzeFilingNarrative()` - Deep analysis (Pro)
- `detectContradictions()` - Compare statements
- `generateDivergenceHypothesis()` - Explain spikes

### DivergenceDetectionService

Main divergence analysis engine.

Key methods:

- `analyzeSpikeForDivergence()` - Core analysis
- `createDivergenceAlert()` - Generate alerts
- `checkFilingForContradictions()` - Flag changes
- `notifyWatchingUsers()` - Send notifications

## Performance Optimization

### Caching Strategy

- Filing analyses cached 24 hours
- Watchlists cached 1 hour
- Market data compressed after 30 days

### Database Optimization

- Strategic indexes on frequently queried columns
- Materialized views for complex queries
- Archive old market data

### API Optimization

- Pagination for list endpoints
- Response compression (gzip)
- Rate limiting per user

## Monitoring

### Health Check Endpoint

```
GET /health
Response: { "status": "ok", "timestamp": "2026-01-07T12:00:00Z" }
```

### Metrics to Track

- Divergences detected per hour
- Filings processed per hour
- API response time (p95, p99)
- Database query time (p99)
- Queue depth
- Error rates

## Error Handling

### Common Error Responses

**400 Bad Request**

```json
{
  "success": false,
  "error": "Invalid ticker format",
  "code": "VALIDATION_ERROR"
}
```

**401 Unauthorized**

```json
{
  "success": false,
  "error": "Invalid or expired token",
  "code": "UNAUTHORIZED"
}
```

**500 Internal Server Error**

```json
{
  "success": false,
  "error": "Database connection failed",
  "code": "DATABASE_ERROR"
}
```

## Troubleshooting

### Database Connection Issues

```bash
# Test PostgreSQL connection
psql -U postgres -d signalhub -c "SELECT 1;"

# Check TimescaleDB installation
psql -U postgres -d signalhub -c "CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"
```

### Redis Connection Issues

```bash
# Test Redis connection
redis-cli ping

# Check Redis version
redis-cli INFO server
```

### Gemini API Issues

```bash
# Verify API key
echo $GEMINI_API_KEY
```

## Contributing

1. Create a feature branch
2. Write tests for new code
3. Ensure tests pass
4. Submit pull request

## Testing Guide

### Unit Tests

Test individual services in isolation:

```bash
pnpm run test volumeDetection.test.ts
```

### Integration Tests

Test end-to-end flows:

```bash
pnpm run test divergence.integration.test.ts
```

### Coverage

Maintain 60%+ code coverage:

```bash
pnpm run test:coverage
```

## Deployment

### Docker Setup

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN pnpm install
RUN pnpm run build
EXPOSE 5000
CMD ["node", "dist/server.js"]
```

### Environment Secrets

Store in your deployment platform:

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `GEMINI_API_KEY`
- `DB_PASSWORD`

### Scaling Considerations

- Use load balancer for API instances
- Configure RabbitMQ/Redis for job queue
- Setup database replication
- Implement caching layer

## License

MIT

## Support

For issues and questions:

1. Check documentation in `IMPLEMENTATION_GUIDE.md`
2. Review `DATABASE_SCHEMA.md` for schema details
3. Check logs: `DEBUG_TESTS=1 pnpm test`

## Roadmap

- [ ] News and social sentiment integration
- [ ] Machine learning model for pattern detection
- [ ] Mobile app notification support
- [ ] Advanced visualization dashboard
- [ ] Backtest analysis features
- [ ] Portfolio tracking
