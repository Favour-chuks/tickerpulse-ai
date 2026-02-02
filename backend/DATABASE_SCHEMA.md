# SignalHub Database Schema

This document defines the complete PostgreSQL schema for the Real-Time Narrative Detection Engine.

## 1. Users and Authentication

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Create index on email
CREATE INDEX idx_users_email ON users(email);

-- Sessions table (for JWT refresh tokens)
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
```

## 2. Watchlist Management

```sql
-- User watchlists
CREATE TABLE watchlists (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticker VARCHAR(10) NOT NULL,
    added_at TIMESTAMP DEFAULT NOW(),
    alert_preferences JSONB DEFAULT '{
        "divergence": true,
        "filing": true,
        "contradiction": true,
        "social": false,
        "severity_filter": "medium"
    }',
    UNIQUE(user_id, ticker)
);

CREATE INDEX idx_watchlists_user_id ON watchlists(user_id);
CREATE INDEX idx_watchlists_ticker ON watchlists(ticker);
```

## 3. Market Data (TimescaleDB)

```sql
-- Market data hypertable
CREATE TABLE IF NOT EXISTS market_data (
    time TIMESTAMPTZ NOT NULL,
    ticker VARCHAR(10) NOT NULL,
    price DECIMAL(10,2),
    volume BIGINT,
    open DECIMAL(10,2),
    high DECIMAL(10,2),
    low DECIMAL(10,2),
    close DECIMAL(10,2),
    previous_close DECIMAL(10,2)
);

-- Convert to hypertable (TimescaleDB)
SELECT create_hypertable('market_data', 'time', if_not_exists => TRUE);

-- Compress old data
SELECT add_compression_policy('market_data', INTERVAL '30 days');

-- Create indexes
CREATE INDEX idx_market_data_ticker_time ON market_data(ticker, time DESC);
```

## 4. Volume Spikes Detection

```sql
-- Volume spike events
CREATE TABLE volume_spikes (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    detected_at TIMESTAMP NOT NULL,
    volume BIGINT NOT NULL,
    avg_volume BIGINT NOT NULL,
    deviation_multiple DECIMAL(5,2) NOT NULL,
    z_score DECIMAL(5,2),
    has_catalyst BOOLEAN DEFAULT FALSE,
    processed BOOLEAN DEFAULT FALSE,
    analysis_id INTEGER REFERENCES divergence_alerts(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_volume_spikes_ticker ON volume_spikes(ticker);
CREATE INDEX idx_volume_spikes_detected_at ON volume_spikes(detected_at DESC);
CREATE INDEX idx_volume_spikes_processed ON volume_spikes(processed);
```

## 5. SEC Filings

```sql
-- SEC filings storage
CREATE TABLE sec_filings (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    filing_type VARCHAR(20) NOT NULL, -- '10-K', '10-Q', '8-K', 'DEF 14A', 'S-1'
    accession_number VARCHAR(50) UNIQUE NOT NULL,
    filed_at TIMESTAMP NOT NULL,
    url TEXT NOT NULL,
    raw_content TEXT,
    is_material BOOLEAN DEFAULT NULL, -- NULL = not yet analyzed
    processed BOOLEAN DEFAULT FALSE,
    processing_error TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sec_filings_ticker ON sec_filings(ticker);
CREATE INDEX idx_sec_filings_filed_at ON sec_filings(filed_at DESC);
CREATE INDEX idx_sec_filings_processed ON sec_filings(processed);
CREATE INDEX idx_sec_filings_accession ON sec_filings(accession_number);
```

## 6. Narratives (Output of Gemini Analysis)

```sql
-- Processed narratives from filings
CREATE TABLE company_narratives (
    id SERIAL PRIMARY KEY,
    filing_id INTEGER NOT NULL REFERENCES sec_filings(id) ON DELETE CASCADE,
    ticker VARCHAR(10) NOT NULL,
    summary TEXT,
    key_changes JSONB, -- Array of significant changes
    risk_changes JSONB, -- New/removed risk factors
    tone_shift TEXT, -- Description of confidence shift
    guidance JSONB, -- Financial guidance info
    management_confidence_score INTEGER CHECK (management_confidence_score >= 0 AND management_confidence_score <= 10),
    language_shifts JSONB, -- Specific language changes noted
    embedding VECTOR(1536), -- For semantic search (pgvector extension needed)
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_company_narratives_ticker ON company_narratives(ticker);
CREATE INDEX idx_company_narratives_filing_id ON company_narratives(filing_id);
```

## 7. Promises and Commitments Tracking

```sql
-- Track specific promises made by companies
CREATE TABLE company_promises (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    promise_text TEXT NOT NULL,
    promise_context JSONB, -- Full context of where promise was made
    filing_id INTEGER REFERENCES sec_filings(id),
    promise_date TIMESTAMP NOT NULL,
    expected_fulfillment_date TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending', -- 'kept', 'broken', 'pending', 'partially_met'
    verification_notes TEXT,
    verification_filing_id INTEGER REFERENCES sec_filings(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_company_promises_ticker ON company_promises(ticker);
CREATE INDEX idx_company_promises_status ON company_promises(status);
CREATE INDEX idx_company_promises_date ON company_promises(promise_date);
```

## 8. Narrative Contradictions

```sql
-- Track contradictions between statements
CREATE TABLE narrative_contradictions (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    narrative_1_id INTEGER NOT NULL REFERENCES company_narratives(id) ON DELETE CASCADE,
    narrative_2_id INTEGER NOT NULL REFERENCES company_narratives(id) ON DELETE CASCADE,
    contradiction_type VARCHAR(50), -- 'guidance_miss', 'strategy_change', 'risk_reversal', 'broken_promise'
    explanation TEXT,
    severity VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
    quote_1 TEXT,
    quote_2 TEXT,
    detected_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_narrative_contradictions_ticker ON narrative_contradictions(ticker);
CREATE INDEX idx_narrative_contradictions_severity ON narrative_contradictions(severity);
```

## 9. News and Social Mentions

```sql
-- News and social media mentions
CREATE TABLE social_mentions (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    source VARCHAR(50), -- 'news', 'reddit', 'twitter', 'stocktwits'
    source_id VARCHAR(255), -- Original source ID
    text TEXT,
    url TEXT,
    sentiment VARCHAR(20), -- 'positive', 'negative', 'neutral'
    sentiment_score DECIMAL(3,2), -- -1.0 to 1.0
    author VARCHAR(255),
    author_followers INTEGER,
    published_at TIMESTAMP NOT NULL,
    engagement_score INTEGER, -- likes, comments, etc.
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_social_mentions_ticker_time ON social_mentions(ticker, published_at DESC);
CREATE INDEX idx_social_mentions_source ON social_mentions(source);
CREATE INDEX idx_social_mentions_sentiment ON social_mentions(sentiment);
```

## 10. Divergence Alerts

```sql
-- Main divergence detection alerts
CREATE TABLE divergence_alerts (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    spike_id INTEGER NOT NULL REFERENCES volume_spikes(id) ON DELETE CASCADE,
    severity VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
    alert_type VARCHAR(50), -- 'divergence_detected', 'filing_contradiction', 'promise_broken'
    hypothesis TEXT, -- AI-generated hypothesis about cause
    supporting_evidence JSONB,
    watch_for TEXT[], -- Signals to watch
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'resolved', 'dismissed', 'investigating'
    created_at TIMESTAMP NOT NULL,
    resolved_at TIMESTAMP,
    resolution_reason TEXT
);

CREATE INDEX idx_divergence_alerts_ticker ON divergence_alerts(ticker);
CREATE INDEX idx_divergence_alerts_status ON divergence_alerts(status);
CREATE INDEX idx_divergence_alerts_created_at ON divergence_alerts(created_at DESC);
```

## 11. User Alert Notifications

```sql
-- Track which users see which alerts
CREATE TABLE user_alerts (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_id INTEGER NOT NULL REFERENCES divergence_alerts(id) ON DELETE CASCADE,
    read BOOLEAN DEFAULT FALSE,
    dismissed BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    dismissed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, alert_id)
);

CREATE INDEX idx_user_alerts_user_id ON user_alerts(user_id);
CREATE INDEX idx_user_alerts_alert_id ON user_alerts(alert_id);
CREATE INDEX idx_user_alerts_read ON user_alerts(read);
```

## 12. Audit Log

```sql
-- Audit trail for debugging and compliance
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    action VARCHAR(50) NOT NULL, -- 'filing_processed', 'alert_created', 'alert_dismissed'
    entity_type VARCHAR(50), -- 'filing', 'alert', 'narrative'
    entity_id INTEGER,
    user_id UUID REFERENCES users(id),
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(created_at DESC);
```

## 13. Processing Queue State

```sql
-- Track processing state for jobs
CREATE TABLE processing_queue (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(50) NOT NULL, -- 'analyze_filing', 'detect_volume_spike'
    ticker VARCHAR(10),
    filing_id INTEGER REFERENCES sec_filings(id),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_processing_queue_status ON processing_queue(status);
CREATE INDEX idx_processing_queue_job_type ON processing_queue(job_type);
```

## Required Extensions

```sql
-- Enable pgvector for embeddings (if using semantic search)
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable JSON functions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

## Notes

1. **TimescaleDB**: For optimal performance with market data, use TimescaleDB extension for the `market_data` table
2. **Embeddings**: The `embedding` column uses pgvector; requires `pgvector` extension
3. **Foreign Keys**: All foreign keys have cascading deletes where appropriate
4. **Indexes**: Strategic indexes on frequently queried columns
5. **JSONB**: Used for flexible schema for AI outputs (narratives, analysis results)
6. **Timestamps**: All timestamps stored as TIMESTAMP DEFAULT NOW() for consistency

## Initial Data Seeding

See `database/seeds/` for initial seed files:

- `001_create_test_users.sql`
- `002_create_test_watchlists.sql`
