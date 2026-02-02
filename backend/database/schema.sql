-- =============================================================================
-- STOCK ALERT SYSTEM SCHEMA - SUPABASE EDITION
-- =============================================================================
-- This schema is optimized for Supabase with PostgreSQL backend
-- Supabase Auth is handled via auth.users table (built-in)
-- =============================================================================
-- For AI Embeddings (The VECTOR error)
CREATE EXTENSION IF NOT EXISTS vector;

-- For Automation/Scheduling (The CRON error)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- For Performance/Statistics (Recommended for technical analysis)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
-- ==========================================================a===================
-- TICKERS (Foundation table)
-- =============================================================================
CREATE TABLE tickers (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) UNIQUE NOT NULL,
    company_name TEXT,
    exchange VARCHAR(10),
    sector VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tickers_symbol ON tickers(symbol);
CREATE INDEX idx_tickers_active ON tickers(is_active) WHERE is_active = true;
CREATE INDEX idx_tickers_sector ON tickers(sector);
-- =============================================================================
-- USER PROFILES (Extended user data - Supabase auth.users + custom)
-- =============================================================================
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    oauth_provider VARCHAR(50),  -- 'google', 'email', etc
    oauth_id VARCHAR(255),       -- OAuth provider user ID
    preferences JSONB DEFAULT '{
        "theme": "light",
        "alerts_enabled": true,
        "email_notifications": true,
        "sms_notifications": false,
        "alert_frequency": "immediate"
    }'::jsonb,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_oauth ON user_profiles(oauth_provider, oauth_id);

-- =============================================================================
-- USER WATCHLISTS
-- =============================================================================
CREATE TABLE watchlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

CREATE TABLE watchlist_items (
    id SERIAL PRIMARY KEY,
    watchlist_id UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
    ticker_id INTEGER NOT NULL REFERENCES tickers(id) ON DELETE CASCADE,
    alert_settings JSONB DEFAULT '{
        "divergence_alerts": true,
        "contradiction_alerts": true,
        "news_alerts": true,
        "min_severity": "medium"
    }'::jsonb,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(watchlist_id, ticker_id)
);

CREATE INDEX idx_watchlists_user ON watchlists(user_id);
CREATE INDEX idx_watchlist_items_watchlist ON watchlist_items(watchlist_id);
CREATE INDEX idx_watchlist_items_ticker_id ON watchlist_items(ticker_id);
CREATE INDEX idx_watchlist_items_ticker_watchlist ON watchlist_items(ticker_id, watchlist_id);

-- =============================================================================
-- MARKET DATA (Regular PostgreSQL table with partitioning)
-- =============================================================================
CREATE TABLE market_data (
    time TIMESTAMPTZ NOT NULL,
    ticker_id INTEGER REFERENCES tickers(id),
    price DECIMAL(10,2),
    volume BIGINT,
    open DECIMAL(10,2),
    high DECIMAL(10,2),
    low DECIMAL(10,2),
    close DECIMAL(10,2),
    PRIMARY KEY (time, ticker_id)
) PARTITION BY RANGE (time);

-- Create indexes on the parent table
CREATE INDEX idx_market_data_ticker_time ON market_data(ticker_id, time DESC);
CREATE INDEX idx_market_data_ticker_time_volume ON market_data(ticker_id, time DESC, volume);
CREATE INDEX idx_market_data_ticker_time_close ON market_data(ticker_id, time DESC, close);

CREATE TABLE market_data_default PARTITION OF market_data DEFAULT;

-- Function to auto-create future partitions
CREATE OR REPLACE FUNCTION create_market_data_partition(partition_date DATE)
RETURNS void AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    partition_name := 'market_data_' || to_char(partition_date, 'YYYY_MM');
    start_date := date_trunc('month', partition_date);
    end_date := start_date + INTERVAL '1 month';
    
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF market_data FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        start_date,
        end_date
    );
    
    RAISE NOTICE 'Created partition % for range [%, %)', partition_name, start_date, end_date;
END;
$$ LANGUAGE plpgsql;

-- Auto-create partitions for next 3 months
SELECT create_market_data_partition((current_date)::date);
SELECT create_market_data_partition((current_date + interval '1 month')::date);
SELECT create_market_data_partition((current_date + interval '2 months')::date);
SELECT create_market_data_partition((current_date + interval '3 months')::date);

-- =============================================================================
-- CACHED TECHNICAL STATS (Replaces continuous aggregates)
-- =============================================================================
CREATE TABLE cached_tech_stats (
    ticker_id INTEGER PRIMARY KEY REFERENCES tickers(id) ON DELETE CASCADE,
    ma_20 DECIMAL(12,4),
    ma_50 DECIMAL(12,4),
    ma_200 DECIMAL(12,4),
    avg_volume BIGINT,
    std_volume BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cached_stats_updated ON cached_tech_stats(updated_at);

SELECT ticker_id, 
       -- 20-Period Moving Average
AVG(close) OVER(
  PARTITION BY ticker_id ORDER BY time DESC 
  ROWS BETWEEN 19 PRECEDING AND CURRENT ROW
),

-- 50-Period Moving Average
AVG(close) OVER(
  PARTITION BY ticker_id ORDER BY time DESC 
  ROWS BETWEEN 49 PRECEDING AND CURRENT ROW
),

-- 200-Period Moving Average
AVG(close) OVER(
  PARTITION BY ticker_id ORDER BY time DESC 
  ROWS BETWEEN 199 PRECEDING AND CURRENT ROW
),

-- 20-Period Volume Average
AVG(volume) OVER(
  PARTITION BY ticker_id ORDER BY time DESC 
  ROWS BETWEEN 19 PRECEDING AND CURRENT ROW
),

-- 20-Period Volume Standard Deviation
STDDEV_SAMP(volume) OVER(
  PARTITION BY ticker_id ORDER BY time DESC 
  ROWS BETWEEN 19 PRECEDING AND CURRENT ROW
)
FROM market_data;

-- Function to update technical stats (call this periodically)
CREATE OR REPLACE FUNCTION update_cached_tech_stats()
RETURNS void AS $$
BEGIN
    INSERT INTO cached_tech_stats (ticker_id, ma_20, ma_50, ma_200, avg_volume, std_volume, updated_at)
    SELECT 
        ticker_id,
        (SELECT AVG(close) FROM (
            SELECT close FROM market_data 
            WHERE ticker_id = t.id 
            ORDER BY time DESC LIMIT 20
        ) s) as ma_20,
        (SELECT AVG(close) FROM (
            SELECT close FROM market_data 
            WHERE ticker_id = t.id 
            ORDER BY time DESC LIMIT 50
        ) s) as ma_50,
        (SELECT AVG(close) FROM (
            SELECT close FROM market_data 
            WHERE ticker_id = t.id 
            ORDER BY time DESC LIMIT 200
        ) s) as ma_200,
        (SELECT AVG(volume) FROM (
            SELECT volume FROM market_data 
            WHERE ticker_id = t.id 
            ORDER BY time DESC LIMIT 20
        ) s) as avg_volume,
        (SELECT STDDEV_SAMP(volume) FROM (
            SELECT volume FROM market_data 
            WHERE ticker_id = t.id 
            ORDER BY time DESC LIMIT 20
        ) s) as std_volume,
        NOW()
    FROM tickers t
    WHERE t.is_active = true
    ON CONFLICT (ticker_id) 
    DO UPDATE SET
        ma_20 = EXCLUDED.ma_20,
        ma_50 = EXCLUDED.ma_50,
        ma_200 = EXCLUDED.ma_200,
        avg_volume = EXCLUDED.avg_volume,
        std_volume = EXCLUDED.std_volume,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule updates (runs every 5 minutes)
SELECT cron.schedule(
    'update-cached-stats',
    '*/5 * * * *',
    'SELECT update_cached_tech_stats()'
);

-- =============================================================================
-- VOLUME SPIKES (Event Log) - With Gemini Worker Integration
-- =============================================================================
CREATE TABLE volume_spikes (
    id SERIAL PRIMARY KEY,
    ticker_id INTEGER NOT NULL REFERENCES tickers(id),
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Volume Stats
    volume BIGINT NOT NULL,
    avg_volume BIGINT,
    deviation_multiple DECIMAL(5,2) NOT NULL,
    z_score DECIMAL(5,2),
    
    -- Price Context
    price_at_spike DECIMAL(12,4),
    price_change_percent DECIMAL(5,2),
    
    -- Sentiment Context (enriched by Gemini worker)
    social_polarity DECIMAL(5,3),
    filing_uncertainty DECIMAL(5,3),
    divergence_score DECIMAL(5,3),
    
    -- Classification (enriched by Gemini worker)
    has_catalyst BOOLEAN DEFAULT FALSE,
    catalyst_type VARCHAR(50),
    catalyst_source VARCHAR(50),  -- 'news', 'filing', 'social'
    movement_type VARCHAR(50),
    
    -- Gemini Worker Processing
    gemini_hypothesis TEXT,
    gemini_confidence DECIMAL(5,2),  -- 0.0-1.0
    gemini_processed BOOLEAN DEFAULT FALSE,
    gemini_processed_at TIMESTAMP WITH TIME ZONE,
    
    -- Alert Generation
    alert_created BOOLEAN DEFAULT FALSE,
    alert_id INTEGER,
    alert_severity VARCHAR(20),
    
    -- Processing State
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    validation_status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'valid', 'invalid'
    validation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_spikes_ticker_id ON volume_spikes(ticker_id);
CREATE INDEX idx_spikes_detected_at ON volume_spikes(detected_at DESC);
CREATE INDEX idx_spikes_unprocessed ON volume_spikes(ticker_id, processed) 
    WHERE processed = false;
CREATE INDEX idx_spikes_gemini_unprocessed ON volume_spikes(ticker_id, gemini_processed)
    WHERE gemini_processed = false;
CREATE INDEX idx_spikes_validation ON volume_spikes(validation_status)
    WHERE validation_status = 'pending';

-- =============================================================================
-- SEC FILINGS & NARRATIVES
-- =============================================================================
CREATE TABLE sec_filings (
    id SERIAL PRIMARY KEY,
    ticker_id INTEGER REFERENCES tickers(id),
    filing_type VARCHAR(10) NOT NULL,
    accession_number VARCHAR(50) UNIQUE NOT NULL,
    cik VARCHAR(20),
    filed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    url TEXT NOT NULL,
    raw_content TEXT,
    is_material BOOLEAN,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_filings_ticker_id ON sec_filings(ticker_id);
CREATE INDEX idx_filings_filed_at ON sec_filings(filed_at DESC);
CREATE INDEX idx_filings_accession ON sec_filings(accession_number);
CREATE INDEX idx_filings_processed ON sec_filings(processed, filed_at) WHERE NOT processed;

CREATE TABLE company_narratives (
    id SERIAL PRIMARY KEY,
    filing_id INTEGER REFERENCES sec_filings(id) ON DELETE CASCADE,
    ticker_id INTEGER REFERENCES tickers(id),
    filing_type VARCHAR(10),
    summary TEXT,
    key_changes JSONB,
    risk_changes JSONB,
    tone_shift TEXT,
    guidance JSONB,
    management_confidence INTEGER CHECK (management_confidence BETWEEN 1 AND 10),
    embedding VECTOR(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_narratives_ticker ON company_narratives(ticker_id);
CREATE INDEX idx_narratives_filing_id ON company_narratives(filing_id);
CREATE INDEX idx_narratives_created ON company_narratives(created_at DESC);
CREATE INDEX idx_narratives_confidence ON company_narratives(management_confidence);

-- =============================================================================
-- NEWS INGESTION SERVICE (Finnhub + Gemini Analysis)
-- =============================================================================
CREATE TABLE news_sources (
    id SERIAL PRIMARY KEY,
    ticker_id INTEGER NOT NULL REFERENCES tickers(id),
    source_name VARCHAR(100) NOT NULL,  -- 'finnhub', 'polygon', custom
    source_type VARCHAR(50) NOT NULL,   -- 'market_news', 'press_release', 'research'
    last_fetched TIMESTAMP WITH TIME ZONE,
    fetch_frequency_minutes INTEGER DEFAULT 15,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_news_sources_ticker ON news_sources(ticker_id);
CREATE INDEX idx_news_sources_active ON news_sources(is_active);

CREATE TABLE raw_news_articles (
    id SERIAL PRIMARY KEY,
    ticker_id INTEGER NOT NULL REFERENCES tickers(id),
    source_id VARCHAR(255),  -- Finnhub article ID
    headline TEXT NOT NULL,
    summary TEXT,
    url TEXT UNIQUE NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE NOT NULL,
    source VARCHAR(100),
    image_url TEXT,
    category VARCHAR(50),
    
    -- Processing state
    gemini_analyzed BOOLEAN DEFAULT FALSE,
    analysis_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_raw_news_ticker ON raw_news_articles(ticker_id);
CREATE INDEX idx_raw_news_published ON raw_news_articles(published_at DESC);
CREATE INDEX idx_raw_news_unanalyzed ON raw_news_articles(ticker_id, gemini_analyzed)
    WHERE gemini_analyzed = false;

-- =============================================================================
-- SOCIAL MENTIONS & SENTIMENT (Enhanced with Gemini Analysis)
-- =============================================================================
CREATE TABLE social_mentions (
    id SERIAL PRIMARY KEY,
    ticker_id INTEGER NOT NULL REFERENCES tickers(id),
    
    -- Source information
    source VARCHAR(50) NOT NULL CHECK (source IN ('sec_filing', 'news', 'reddit', 'twitter', 'finnhub', 'polygon', 'other')),
    source_id VARCHAR(255) UNIQUE,
    
    -- Content
    text TEXT NOT NULL,
    url TEXT,
    headline TEXT,
    
    -- Simple sentiment
    sentiment VARCHAR(20) CHECK (sentiment IN ('positive', 'negative', 'neutral', 'mixed')),
    sentiment_score DECIMAL(5,2) CHECK (sentiment_score BETWEEN -1 AND 1),
    
    -- Detailed metrics (from Gemini analysis)
    polarity_score DECIMAL(5,4),          -- -1 to 1
    uncertainty_score DECIMAL(5,4),       -- 0 to 1 (how uncertain is the text)
    litigious_score DECIMAL(5,4),         -- legal risk mentions
    constraining_score DECIMAL(5,4),      -- limiting language
    modal_weak_score DECIMAL(5,4),        -- 'may', 'could' language
    modal_strong_score DECIMAL(5,4),      -- 'will', 'must' language
    sentiment_detail JSONB DEFAULT '{}'::jsonb,
    
    -- Gemini enrichment
    gemini_summary TEXT,
    gemini_key_themes TEXT[],
    gemini_relevance_score DECIMAL(5,2),  -- How relevant is this to the stock?
    gemini_analyzed BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    author VARCHAR(255),
    author_followers INTEGER,
    engagement_score INTEGER,
    published_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- SEC filing reference
    cik VARCHAR(20),
    accession_number VARCHAR(50) REFERENCES sec_filings(accession_number)
);

CREATE INDEX idx_social_ticker ON social_mentions(ticker_id);
CREATE INDEX idx_social_published ON social_mentions(published_at DESC);
CREATE INDEX idx_social_ticker_time ON social_mentions(ticker_id, published_at DESC);
CREATE INDEX idx_social_source ON social_mentions(source);
CREATE INDEX idx_social_uncertainty ON social_mentions(uncertainty_score DESC) 
    WHERE uncertainty_score IS NOT NULL;
CREATE INDEX idx_social_ticker_uncertainty ON social_mentions(ticker_id, uncertainty_score DESC)
    WHERE uncertainty_score IS NOT NULL;
CREATE INDEX idx_social_gemini_unanalyzed ON social_mentions(ticker_id, gemini_analyzed)
    WHERE gemini_analyzed = false;
CREATE INDEX idx_social_divergence_check ON social_mentions(ticker_id, source, uncertainty_score DESC, published_at DESC)
    WHERE source IN ('news', 'sec_filing') AND uncertainty_score > 0.3;

-- =============================================================================
-- FLASHBACK ENGINE & CONTRADICTION DETECTION
-- =============================================================================
CREATE TABLE company_promises (
    id SERIAL PRIMARY KEY,
    ticker_id INTEGER NOT NULL REFERENCES tickers(id),
    promise_text TEXT NOT NULL,
    made_in_filing_id INTEGER REFERENCES sec_filings(id),
    promise_date TIMESTAMP WITH TIME ZONE NOT NULL,
    expected_fulfillment_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) CHECK (status IN ('kept', 'broken', 'pending')),
    verification_notes TEXT,
    verified_in_filing_id INTEGER REFERENCES sec_filings(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_promises_ticker ON company_promises(ticker_id);
CREATE INDEX idx_promises_status ON company_promises(status);
CREATE INDEX idx_promises_date ON company_promises(promise_date DESC);

-- Enhanced narrative contradictions with market trend analysis
CREATE TABLE narrative_contradictions (
    id SERIAL PRIMARY KEY,
    ticker_id INTEGER NOT NULL REFERENCES tickers(id),
    statement_1_id INTEGER REFERENCES company_narratives(id) ON DELETE SET NULL,
    statement_2_id INTEGER REFERENCES company_narratives(id) ON DELETE SET NULL,
    news_article_id INTEGER REFERENCES raw_news_articles(id) ON DELETE SET NULL,
    
    -- Contradiction details
    contradiction_type VARCHAR(50) NOT NULL,  -- 'guidance_miss', 'strategy_change', 'risk_reversal', 'broken_promise', 'market_divergence'
    explanation TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Evidence
    quote_1 TEXT,
    quote_2 TEXT,
    news_headline TEXT,
    
    -- Market context
    market_trend_before VARCHAR(20),  -- 'bullish', 'bearish', 'neutral'
    market_trend_after VARCHAR(20),
    price_impact DECIMAL(5,2),
    volume_impact DECIMAL(5,2),
    
    -- Validation
    gemini_confidence DECIMAL(5,2),
    is_validated BOOLEAN DEFAULT FALSE,
    validation_notes TEXT,
    
    -- Alert
    alert_created BOOLEAN DEFAULT FALSE,
    alert_id INTEGER,
    
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_contradictions_ticker ON narrative_contradictions(ticker_id);
CREATE INDEX idx_contradictions_severity ON narrative_contradictions(severity);
CREATE INDEX idx_contradictions_detected ON narrative_contradictions(detected_at DESC);
CREATE INDEX idx_contradictions_validated ON narrative_contradictions(is_validated)
    WHERE is_validated = false;
CREATE INDEX idx_contradictions_type ON narrative_contradictions(contradiction_type);

-- =============================================================================
-- WORKER QUEUE SYSTEM (For Gemini Processing & News Injection)
-- =============================================================================
CREATE TABLE worker_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(50) NOT NULL,  -- 'gemini_spike_analysis', 'news_injection', 'contradiction_check', 'alert_validation'
    ticker_id INTEGER REFERENCES tickers(id),
    volume_spike_id INTEGER REFERENCES volume_spikes(id),
    news_article_id INTEGER REFERENCES raw_news_articles(id),
    social_mention_id INTEGER REFERENCES social_mentions(id),
    
    -- Job configuration
    priority VARCHAR(20) DEFAULT 'normal',  -- 'high', 'normal', 'low'
    status VARCHAR(20) DEFAULT 'pending',   -- 'pending', 'processing', 'completed', 'failed'
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Processing details
    worker_name VARCHAR(100),
    error_message TEXT,
    result JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_worker_jobs_status ON worker_jobs(status);
CREATE INDEX idx_worker_jobs_type ON worker_jobs(job_type, status);
CREATE INDEX idx_worker_jobs_ticker ON worker_jobs(ticker_id);
CREATE INDEX idx_worker_jobs_created ON worker_jobs(created_at DESC);
CREATE INDEX idx_worker_jobs_pending ON worker_jobs(priority DESC, created_at)
    WHERE status = 'pending';

-- =============================================================================
-- ALERT VALIDATION SYSTEM
-- =============================================================================
CREATE TABLE alert_validation_rules (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL UNIQUE,
    rule_type VARCHAR(50) NOT NULL,  -- 'volume_confirmation', 'price_confirmation', 'sentiment_check', 'historical_comparison'
    ticker_id INTEGER REFERENCES tickers(id),
    
    -- Rule configuration
    is_active BOOLEAN DEFAULT TRUE,
    threshold_value DECIMAL(10,4),
    lookback_days INTEGER,
    description TEXT,
    
    -- Validation logic
    rule_logic JSONB NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_validation_rules_active ON alert_validation_rules(is_active);
CREATE INDEX idx_validation_rules_type ON alert_validation_rules(rule_type);

CREATE TABLE alert_validations (
    id SERIAL PRIMARY KEY,
    volume_spike_id INTEGER NOT NULL REFERENCES volume_spikes(id),
    rule_id INTEGER REFERENCES alert_validation_rules(id),
    
    -- Validation result
    is_valid BOOLEAN,
    confidence_score DECIMAL(5,2),
    validation_details JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_alert_validations_spike ON alert_validations(volume_spike_id);
CREATE INDEX idx_alert_validations_rule ON alert_validations(rule_id);

-- Historical data for validation comparisons
CREATE TABLE ticker_historical_snapshots (
    id SERIAL PRIMARY KEY,
    ticker_id INTEGER NOT NULL REFERENCES tickers(id),
    snapshot_date DATE NOT NULL,
    
    -- Price metrics
    open_price DECIMAL(12,4),
    close_price DECIMAL(12,4),
    high_price DECIMAL(12,4),
    low_price DECIMAL(12,4),
    volume BIGINT,
    
    -- Technical indicators
    ma_20 DECIMAL(12,4),
    ma_50 DECIMAL(12,4),
    ma_200 DECIMAL(12,4),
    
    -- Sentiment aggregate
    avg_sentiment_score DECIMAL(5,2),
    news_count INTEGER,
    social_mention_count INTEGER,
    
    -- Trend
    trend VARCHAR(20),  -- 'strong_bullish', 'bullish', 'neutral', 'bearish', 'strong_bearish'
    trend_strength DECIMAL(5,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(ticker_id, snapshot_date)
);

CREATE INDEX idx_snapshots_ticker_date ON ticker_historical_snapshots(ticker_id, snapshot_date DESC);
CREATE INDEX idx_snapshots_date ON ticker_historical_snapshots(snapshot_date DESC);
CREATE TABLE websocket_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    connection_id TEXT NOT NULL,
    ticker_id INTEGER REFERENCES tickers(id),
    subscription_type VARCHAR(20) DEFAULT 'alerts' CHECK (subscription_type IN ('alerts', 'market_data', 'both')),
    subscribed_at TIMESTAMPTZ DEFAULT NOW(),
    last_ping TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(connection_id, ticker_id)
);

CREATE INDEX idx_ws_subs_ticker ON websocket_subscriptions(ticker_id);
CREATE INDEX idx_ws_subs_user ON websocket_subscriptions(user_id);
CREATE INDEX idx_ws_subs_connection ON websocket_subscriptions(connection_id);
CREATE INDEX IF NOT EXISTS idx_ws_subs_last_ping ON websocket_subscriptions(last_ping);
CREATE INDEX idx_ws_subs_type ON websocket_subscriptions(subscription_type);
CREATE INDEX idx_ws_subs_ticker_type ON websocket_subscriptions(ticker_id, subscription_type);

-- Offline message queue
CREATE TABLE notification_queue (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ticker_id INTEGER REFERENCES tickers(id),
    payload JSONB NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX idx_notif_queue_user_pending ON notification_queue(user_id, created_at)
    WHERE delivered_at IS NULL;
CREATE INDEX idx_notif_queue_expires ON notification_queue(expires_at)
    WHERE delivered_at IS NULL;

-- Track market data delivery performance
CREATE TABLE market_data_delivery_stats (
    ticker_id INTEGER REFERENCES tickers(id),
    timestamp TIMESTAMPTZ NOT NULL,
    subscribers_count INTEGER NOT NULL,
    delivery_time_ms INTEGER NOT NULL,
    PRIMARY KEY (ticker_id, timestamp)
);

CREATE INDEX idx_delivery_stats_timestamp ON market_data_delivery_stats(timestamp DESC);
CREATE INDEX idx_delivery_stats_ticker ON market_data_delivery_stats(ticker_id, timestamp DESC);

-- Rate limiting for alerts
CREATE TABLE alert_cooldowns (
    ticker_id INTEGER REFERENCES tickers(id),
    alert_type VARCHAR(50),
    last_alert_at TIMESTAMPTZ NOT NULL,
    alert_count INTEGER DEFAULT 1,
    PRIMARY KEY (ticker_id, alert_type)
);

CREATE INDEX idx_cooldowns_last_alert ON alert_cooldowns(last_alert_at);

-- =============================================================================
-- HISTORICAL ALERT LOG
-- =============================================================================
CREATE TABLE alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker_id INTEGER REFERENCES tickers(id),
    alert_type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    users_notified INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_alert_history_ticker ON alert_history(ticker_id);
CREATE INDEX idx_alert_history_created ON alert_history(created_at DESC);
CREATE INDEX idx_alert_history_type ON alert_history(alert_type);

-- =============================================================================
-- OPTIMIZED SPIKE DETECTION TRIGGER
-- =============================================================================
CREATE OR REPLACE FUNCTION detect_volume_spike()
RETURNS TRIGGER AS $$
DECLARE
    v_avg_vol BIGINT;
    v_dev_mult DECIMAL;
BEGIN
    -- Fast lookup from cached stats
    SELECT avg_volume INTO v_avg_vol
    FROM cached_tech_stats
    WHERE ticker_id = NEW.ticker_id;
    
    -- Quick exit if no stats or normal volume
    IF v_avg_vol IS NULL OR v_avg_vol = 0 THEN
        RETURN NEW;
    END IF;
    
    v_dev_mult := NEW.volume::DECIMAL / v_avg_vol;
    
    -- Filter 90% of normal volume (between 0.3x and 2.5x)
    IF v_dev_mult BETWEEN 0.3 AND 2.5 THEN
        RETURN NEW;
    END IF;
    
    -- Log the spike (minimal data, enriched by worker)
    INSERT INTO volume_spikes (
        ticker_id,
        detected_at,
        volume,
        deviation_multiple,
        price_at_spike,
        processed
    ) VALUES (
        NEW.ticker_id,
        NEW.time,
        NEW.volume,
        v_dev_mult,
        NEW.close,
        FALSE
    );
    
    -- Signal async worker
    PERFORM pg_notify(
        'spike_detected',
        json_build_object(
            'ticker_id', NEW.ticker_id,
            'time', NEW.time,
            'deviation', v_dev_mult
        )::text
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_market_data_insert
AFTER INSERT ON market_data
FOR EACH ROW
WHEN (NEW.volume > 100000)
EXECUTE FUNCTION detect_volume_spike();

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Check sentiment divergence
CREATE OR REPLACE FUNCTION check_sentiment_divergence(p_ticker_id INTEGER)
RETURNS TABLE (
    has_divergence BOOLEAN,
    filing_uncertainty DECIMAL,
    social_polarity DECIMAL,
    divergence_score DECIMAL
) AS $$
DECLARE
    v_filing_uncertainty DECIMAL;
    v_social_polarity DECIMAL;
    v_divergence DECIMAL;
BEGIN
    SELECT uncertainty_score INTO v_filing_uncertainty
    FROM social_mentions
    WHERE ticker_id = p_ticker_id
    AND source = 'sec_filing'
    ORDER BY published_at DESC
    LIMIT 1;
    
    SELECT AVG(polarity_score) INTO v_social_polarity
    FROM social_mentions
    WHERE ticker_id = p_ticker_id
    AND source IN ('reddit', 'twitter', 'news')
    AND published_at >= NOW() - INTERVAL '7 days';
    
    v_divergence := COALESCE(v_filing_uncertainty, 0) * ABS(COALESCE(v_social_polarity, 0));
    
    RETURN QUERY
    SELECT 
        (v_filing_uncertainty > 1.0 AND ABS(v_social_polarity) > 0.3),
        v_filing_uncertainty,
        v_social_polarity,
        v_divergence;
END;
$$ LANGUAGE plpgsql;

-- Get enriched spike data
CREATE OR REPLACE FUNCTION get_spike_context(p_ticker_id INTEGER)
RETURNS TABLE (
    symbol VARCHAR(10),
    ma_20 DECIMAL,
    ma_50 DECIMAL,
    ma_200 DECIMAL,
    avg_volume BIGINT,
    std_volume BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.symbol,
        s.ma_20,
        s.ma_50,
        s.ma_200,
        s.avg_volume,
        s.std_volume
    FROM tickers t
    JOIN cached_tech_stats s ON s.ticker_id = t.id
    WHERE t.id = p_ticker_id;
END;
$$ LANGUAGE plpgsql;

-- Check if alert should be throttled
CREATE OR REPLACE FUNCTION should_throttle_alert(
    p_ticker_id INTEGER,
    p_alert_type VARCHAR(50),
    p_cooldown_minutes INTEGER DEFAULT 15
) RETURNS BOOLEAN AS $$
DECLARE
    v_last_alert TIMESTAMPTZ;
BEGIN
    SELECT last_alert_at INTO v_last_alert
    FROM alert_cooldowns
    WHERE ticker_id = p_ticker_id
    AND alert_type = p_alert_type;
    
    IF v_last_alert IS NULL OR 
       v_last_alert < NOW() - (p_cooldown_minutes || ' minutes')::INTERVAL THEN
        
        INSERT INTO alert_cooldowns (ticker_id, alert_type, last_alert_at, alert_count)
        VALUES (p_ticker_id, p_alert_type, NOW(), 1)
        ON CONFLICT (ticker_id, alert_type)
        DO UPDATE SET 
            last_alert_at = NOW(),
            alert_count = alert_cooldowns.alert_count + 1;
        
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE websocket_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own watchlists" ON watchlists
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own subscriptions" ON websocket_subscriptions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users view own notifications" ON notification_queue
    FOR SELECT USING (auth.uid() = user_id);

-- =============================================================================
-- CLEANUP JOBS
-- =============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS void AS $$
BEGIN
    DELETE FROM notification_queue
    WHERE expires_at < NOW()
    AND delivered_at IS NULL;
    
    DELETE FROM notification_queue
    WHERE delivered_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Cleanup old partitions (keep last 250 days by default)
CREATE OR REPLACE FUNCTION cleanup_old_partitions(p_keep_days integer DEFAULT 250)
RETURNS void AS $$
DECLARE
    partition_name TEXT;
    part_start DATE;
    part_end   TIMESTAMPTZ;
    cutoff_ts  TIMESTAMPTZ;
BEGIN
    cutoff_ts := NOW() - make_interval(days => p_keep_days);

    FOR partition_name IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename ~ '^market_data_\d{4}_\d{2}$'
    LOOP
        -- market_data_YYYY_MM -> first day of that month
        part_start := to_date(
            substring(partition_name from 'market_data_(\d{4}_\d{2})'),
            'YYYY_MM'
        );

        part_end := (part_start + INTERVAL '1 month')::timestamptz;

        -- Drop partitions fully older than retention
        IF part_end < cutoff_ts THEN
            EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', partition_name);
            RAISE NOTICE 'Dropped old partition: % (ended %)', partition_name, part_end;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- MISSING GEMINI WORKER TRIGGERS - ADD THESE TO YOUR SCHEMA
-- =============================================================================

-- =============================================================================
-- 1. TRIGGER: New SEC Filing → Queue for Gemini Analysis
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_filing_analysis()
RETURNS TRIGGER AS $$
BEGIN
    -- Create a high-priority worker job for Gemini filing analysis
    INSERT INTO worker_jobs (
        job_type,
        ticker_id,
        priority,
        status,
        result
    ) VALUES (
        'gemini_filing_analysis',
        NEW.ticker_id,
        'high',  -- Filings are important
        'pending',
        json_build_object(
            'filing_id', NEW.id,
            'filing_type', NEW.filing_type,
            'accession_number', NEW.accession_number
        )::jsonb
    );
    
    -- Also notify via pg_notify for real-time workers
    PERFORM pg_notify(
        'new_filing',
        json_build_object(
            'filing_id', NEW.id,
            'ticker_id', NEW.ticker_id,
            'filing_type', NEW.filing_type
        )::text
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to sec_filings table
CREATE TRIGGER on_sec_filing_insert
AFTER INSERT ON sec_filings
FOR EACH ROW
EXECUTE FUNCTION trigger_filing_analysis();

-- =============================================================================
-- 2. TRIGGER: New News Article → Queue for Gemini Sentiment Analysis
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_news_analysis()
RETURNS TRIGGER AS $$
BEGIN
    -- Create worker job for Gemini news analysis
    INSERT INTO worker_jobs (
        job_type,
        ticker_id,
        news_article_id,
        priority,
        status,
        result
    ) VALUES (
        'gemini_news_analysis',
        NEW.ticker_id,
        NEW.id,
        'normal',  -- News is less urgent than filings
        'pending',
        json_build_object(
            'article_id', NEW.id,
            'headline', NEW.headline,
            'published_at', NEW.published_at
        )::jsonb
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to raw_news_articles table
CREATE TRIGGER on_news_article_insert
AFTER INSERT ON raw_news_articles
FOR EACH ROW
EXECUTE FUNCTION trigger_news_analysis();

-- =============================================================================
-- 3. TRIGGER: Volume Spike Detected → Queue for Divergence Analysis
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_divergence_analysis()
RETURNS TRIGGER AS $$
BEGIN
    -- Create HIGH priority worker job for divergence analysis
    INSERT INTO worker_jobs (
        job_type,
        ticker_id,
        volume_spike_id,
        priority,
        status,
        result
    ) VALUES (
        'gemini_divergence_analysis',
        NEW.ticker_id,
        NEW.id,
        'high',  -- Spikes need immediate analysis
        'pending',
        json_build_object(
            'spike_id', NEW.id,
            'deviation', NEW.deviation_multiple,
            'detected_at', NEW.detected_at
        )::jsonb
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to volume_spikes table
CREATE TRIGGER on_volume_spike_insert
AFTER INSERT ON volume_spikes
FOR EACH ROW
EXECUTE FUNCTION trigger_divergence_analysis();

-- =============================================================================
-- 4. TRIGGER: New Narrative → Check for Contradictions
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_contradiction_check()
RETURNS TRIGGER AS $$
DECLARE
    v_narrative_count INTEGER;
BEGIN
    -- Only check contradictions if there are at least 2 historical narratives
    SELECT COUNT(*) INTO v_narrative_count
    FROM company_narratives
    WHERE ticker_id = NEW.ticker_id
    AND id != NEW.id;
    
    IF v_narrative_count >= 2 THEN
        -- Create worker job for Gemini contradiction detection
        INSERT INTO worker_jobs (
            job_type,
            ticker_id,
            priority,
            status,
            result
        ) VALUES (
            'gemini_contradiction_check',
            NEW.ticker_id,
            'high',  -- Contradictions are important
            'pending',
            json_build_object(
                'new_narrative_id', NEW.id,
                'ticker_id', NEW.ticker_id,
                'filing_type', NEW.filing_type
            )::jsonb
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to company_narratives table
CREATE TRIGGER on_narrative_insert
AFTER INSERT ON company_narratives
FOR EACH ROW
EXECUTE FUNCTION trigger_contradiction_check();

-- =============================================================================
-- 5. TRIGGER: New Narrative → Check Promise Fulfillment
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_promise_check()
RETURNS TRIGGER AS $$
DECLARE
    v_pending_promises INTEGER;
BEGIN
    -- Check if there are any pending promises for this ticker
    SELECT COUNT(*) INTO v_pending_promises
    FROM company_promises
    WHERE ticker_id = NEW.ticker_id
    AND status = 'pending'
    AND expected_fulfillment_date <= NOW();
    
    IF v_pending_promises > 0 THEN
        -- Create worker job for Gemini promise verification
        INSERT INTO worker_jobs (
            job_type,
            ticker_id,
            priority,
            status,
            result
        ) VALUES (
            'gemini_promise_verification',
            NEW.ticker_id,
            'normal',
            'pending',
            json_build_object(
                'narrative_id', NEW.id,
                'filing_id', NEW.filing_id,
                'pending_promises', v_pending_promises
            )::jsonb
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to company_narratives table (for promise checking)
CREATE TRIGGER on_narrative_check_promises
AFTER INSERT ON company_narratives
FOR EACH ROW
EXECUTE FUNCTION trigger_promise_check();

-- =============================================================================
-- 6. FUNCTION: Manually Queue Filing for Analysis (For Testing/Reprocessing)
-- =============================================================================
CREATE OR REPLACE FUNCTION queue_filing_for_analysis(p_filing_id INTEGER)
RETURNS UUID AS $$
DECLARE
    v_job_id UUID;
    v_ticker_id INTEGER;
    v_filing_type VARCHAR(10);
BEGIN
    -- Get filing details
    SELECT ticker_id, filing_type 
    INTO v_ticker_id, v_filing_type
    FROM sec_filings
    WHERE id = p_filing_id;
    
    IF v_ticker_id IS NULL THEN
        RAISE EXCEPTION 'Filing % not found', p_filing_id;
    END IF;
    
    -- Create worker job
    INSERT INTO worker_jobs (
        job_type,
        ticker_id,
        priority,
        status,
        result
    ) VALUES (
        'gemini_filing_analysis',
        v_ticker_id,
        'high',
        'pending',
        json_build_object(
            'filing_id', p_filing_id,
            'filing_type', v_filing_type,
            'manual_trigger', true
        )::jsonb
    )
    RETURNING id INTO v_job_id;
    
    RETURN v_job_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 7. FUNCTION: Manually Queue Spike for Analysis (For Testing/Reprocessing)
-- =============================================================================
CREATE OR REPLACE FUNCTION queue_spike_for_analysis(p_spike_id INTEGER)
RETURNS UUID AS $$
DECLARE
    v_job_id UUID;
    v_ticker_id INTEGER;
    v_deviation DECIMAL;
BEGIN
    -- Get spike details
    SELECT ticker_id, deviation_multiple
    INTO v_ticker_id, v_deviation
    FROM volume_spikes
    WHERE id = p_spike_id;
    
    IF v_ticker_id IS NULL THEN
        RAISE EXCEPTION 'Spike % not found', p_spike_id;
    END IF;
    
    -- Create worker job
    INSERT INTO worker_jobs (
        job_type,
        ticker_id,
        volume_spike_id,
        priority,
        status,
        result
    ) VALUES (
        'gemini_divergence_analysis',
        v_ticker_id,
        p_spike_id,
        'high',
        'pending',
        json_build_object(
            'spike_id', p_spike_id,
            'deviation', v_deviation,
            'manual_trigger', true
        )::jsonb
    )
    RETURNING id INTO v_job_id;
    
    RETURN v_job_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 8. FUNCTION: Get Pending Worker Jobs (For Worker Consumption)
-- =============================================================================
CREATE OR REPLACE FUNCTION get_pending_jobs(
    p_job_type VARCHAR(50) DEFAULT NULL,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    job_id UUID,
    job_type VARCHAR(50),
    ticker_id INTEGER,
    ticker_symbol VARCHAR(10),
    priority VARCHAR(20),
    created_at TIMESTAMPTZ,
    result JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wj.id,
        wj.job_type,
        wj.ticker_id,
        t.symbol,
        wj.priority,
        wj.created_at,
        wj.result
    FROM worker_jobs wj
    LEFT JOIN tickers t ON t.id = wj.ticker_id
    WHERE wj.status = 'pending'
    AND (p_job_type IS NULL OR wj.job_type = p_job_type)
    AND wj.retry_count < wj.max_retries
    ORDER BY 
        CASE wj.priority
            WHEN 'high' THEN 1
            WHEN 'normal' THEN 2
            WHEN 'low' THEN 3
        END,
        wj.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 9. FUNCTION: Mark Job as Processing
-- =============================================================================
CREATE OR REPLACE FUNCTION mark_job_processing(
    p_job_id UUID,
    p_worker_name VARCHAR(100)
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE worker_jobs
    SET 
        status = 'processing',
        worker_name = p_worker_name,
        started_at = NOW(),
        updated_at = NOW()
    WHERE id = p_job_id
    AND status = 'pending';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 10. FUNCTION: Mark Job as Completed
-- =============================================================================
CREATE OR REPLACE FUNCTION mark_job_completed(
    p_job_id UUID,
    p_result JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE worker_jobs
    SET 
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW(),
        result = COALESCE(p_result, result)
    WHERE id = p_job_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 11. FUNCTION: Mark Job as Failed (with Retry Logic)
-- =============================================================================
CREATE OR REPLACE FUNCTION mark_job_failed(
    p_job_id UUID,
    p_error_message TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_retry_count INTEGER;
    v_max_retries INTEGER;
BEGIN
    -- Get current retry count
    SELECT retry_count, max_retries
    INTO v_retry_count, v_max_retries
    FROM worker_jobs
    WHERE id = p_job_id;
    
    IF v_retry_count + 1 >= v_max_retries THEN
        -- Max retries reached - mark as failed permanently
        UPDATE worker_jobs
        SET 
            status = 'failed',
            error_message = p_error_message,
            retry_count = v_retry_count + 1,
            updated_at = NOW()
        WHERE id = p_job_id;
    ELSE
        -- Reset to pending for retry
        UPDATE worker_jobs
        SET 
            status = 'pending',
            error_message = p_error_message,
            retry_count = v_retry_count + 1,
            updated_at = NOW()
        WHERE id = p_job_id;
    END IF;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 12. VIEW: Job Queue Status (For Monitoring)
-- =============================================================================
CREATE OR REPLACE VIEW worker_job_stats AS
SELECT 
    job_type,
    status,
    priority,
    COUNT(*) as job_count,
    MIN(created_at) as oldest_job,
    MAX(created_at) as newest_job,
    AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_processing_time_seconds
FROM worker_jobs
GROUP BY job_type, status, priority
ORDER BY job_type, 
    CASE status
        WHEN 'pending' THEN 1
        WHEN 'processing' THEN 2
        WHEN 'completed' THEN 3
        WHEN 'failed' THEN 4
    END;

-- =============================================================================
-- 13. CLEANUP: Failed Jobs Older Than 7 Days
-- =============================================================================
CREATE OR REPLACE FUNCTION cleanup_old_jobs()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM worker_jobs
        WHERE status IN ('completed', 'failed')
        AND created_at < NOW() - INTERVAL '7 days'
        RETURNING *
    )
    SELECT COUNT(*) INTO v_deleted_count FROM deleted;
    
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (starts daily at 2 AM)
SELECT cron.schedule(
    'cleanup-worker-jobs',
    '0 2 * * *',
    'SELECT cleanup_old_jobs()'
);
SELECT cron.schedule('cleanup-notifications', '0 3 * * *', 'SELECT cleanup_expired_notifications()');
SELECT cron.schedule('cleanup-partitions', '10 4 1 * *', 'SELECT cleanup_old_partitions(250)');
SELECT cron.schedule('create-future-partitions', '0 5 1 * *', 
    'SELECT create_market_data_partition(current_date + interval ''2 months'')');ume
    FROM tickers t
    JOIN cached_tech_stats s ON s.ticker_id = t.id
    WHERE t.id = p_ticker_id;
END;
$$ LANGUAGE plpgsql;

-- Check if alert should be throttled
CREATE OR REPLACE FUNCTION should_throttle_alert(
    p_ticker_id INTEGER,
    p_alert_type VARCHAR(50),
    p_cooldown_minutes INTEGER DEFAULT 15
) RETURNS BOOLEAN AS $$
DECLARE
    v_last_alert TIMESTAMPTZ;
BEGIN
    SELECT last_alert_at INTO v_last_alert
    FROM alert_cooldowns
    WHERE ticker_id = p_ticker_id
    AND alert_type = p_alert_type;
    
    IF v_last_alert IS NULL OR 
       v_last_alert < NOW() - (p_cooldown_minutes || ' minutes')::INTERVAL THEN
        
        INSERT INTO alert_cooldowns (ticker_id, alert_type, last_alert_at, alert_count)
        VALUES (p_ticker_id, p_alert_type, NOW(), 1)
        ON CONFLICT (ticker_id, alert_type)
        DO UPDATE SET 
            last_alert_at = NOW(),
            alert_count = alert_cooldowns.alert_count + 1;
        
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE websocket_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own watchlists" ON watchlists
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own subscriptions" ON websocket_subscriptions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users view own notifications" ON notification_queue
    FOR SELECT USING (auth.uid() = user_id);

-- =============================================================================
-- CLEANUP JOBS
-- =============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS void AS $$
BEGIN
    DELETE FROM notification_queue
    WHERE expires_at < NOW()
    AND delivered_at IS NULL;
    
    DELETE FROM notification_queue
    WHERE delivered_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Cleanup old partitions (keep last 250 days by default)
CREATE OR REPLACE FUNCTION cleanup_old_partitions(p_keep_days integer DEFAULT 250)
RETURNS void AS $$
DECLARE
    partition_name TEXT;
    part_start DATE;
    part_end   TIMESTAMPTZ;
    cutoff_ts  TIMESTAMPTZ;
BEGIN
    cutoff_ts := NOW() - make_interval(days => p_keep_days);

    FOR partition_name IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename ~ '^market_data_\d{4}_\d{2}$'
    LOOP
        -- market_data_YYYY_MM -> first day of that month
        part_start := to_date(
            substring(partition_name from 'market_data_(\d{4}_\d{2})'),
            'YYYY_MM'
        );

        part_end := (part_start + INTERVAL '1 month')::timestamptz;

        -- Drop partitions fully older than retention
        IF part_end < cutoff_ts THEN
            EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', partition_name);
            RAISE NOTICE 'Dropped old partition: % (ended %)', partition_name, part_end;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- MISSING GEMINI WORKER TRIGGERS - ADD THESE TO YOUR SCHEMA
-- =============================================================================

-- =============================================================================
-- 1. TRIGGER: New SEC Filing → Queue for Gemini Analysis
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_filing_analysis()
RETURNS TRIGGER AS $$
BEGIN
    -- Create a high-priority worker job for Gemini filing analysis
    INSERT INTO worker_jobs (
        job_type,
        ticker_id,
        priority,
        status,
        result
    ) VALUES (
        'gemini_filing_analysis',
        NEW.ticker_id,
        'high',  -- Filings are important
        'pending',
        json_build_object(
            'filing_id', NEW.id,
            'filing_type', NEW.filing_type,
            'accession_number', NEW.accession_number
        )::jsonb
    );
    
    -- Also notify via pg_notify for real-time workers
    PERFORM pg_notify(
        'new_filing',
        json_build_object(
            'filing_id', NEW.id,
            'ticker_id', NEW.ticker_id,
            'filing_type', NEW.filing_type
        )::text
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to sec_filings table
CREATE TRIGGER on_sec_filing_insert
AFTER INSERT ON sec_filings
FOR EACH ROW
EXECUTE FUNCTION trigger_filing_analysis();

-- =============================================================================
-- 2. TRIGGER: New News Article → Queue for Gemini Sentiment Analysis
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_news_analysis()
RETURNS TRIGGER AS $$
BEGIN
    -- Create worker job for Gemini news analysis
    INSERT INTO worker_jobs (
        job_type,
        ticker_id,
        news_article_id,
        priority,
        status,
        result
    ) VALUES (
        'gemini_news_analysis',
        NEW.ticker_id,
        NEW.id,
        'normal',  -- News is less urgent than filings
        'pending',
        json_build_object(
            'article_id', NEW.id,
            'headline', NEW.headline,
            'published_at', NEW.published_at
        )::jsonb
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to raw_news_articles table
CREATE TRIGGER on_news_article_insert
AFTER INSERT ON raw_news_articles
FOR EACH ROW
EXECUTE FUNCTION trigger_news_analysis();

-- =============================================================================
-- 3. TRIGGER: Volume Spike Detected → Queue for Divergence Analysis
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_divergence_analysis()
RETURNS TRIGGER AS $$
BEGIN
    -- Create HIGH priority worker job for divergence analysis
    INSERT INTO worker_jobs (
        job_type,
        ticker_id,
        volume_spike_id,
        priority,
        status,
        result
    ) VALUES (
        'gemini_divergence_analysis',
        NEW.ticker_id,
        NEW.id,
        'high',  -- Spikes need immediate analysis
        'pending',
        json_build_object(
            'spike_id', NEW.id,
            'deviation', NEW.deviation_multiple,
            'detected_at', NEW.detected_at
        )::jsonb
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to volume_spikes table
CREATE TRIGGER on_volume_spike_insert
AFTER INSERT ON volume_spikes
FOR EACH ROW
EXECUTE FUNCTION trigger_divergence_analysis();

-- =============================================================================
-- 4. TRIGGER: New Narrative → Check for Contradictions
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_contradiction_check()
RETURNS TRIGGER AS $$
DECLARE
    v_narrative_count INTEGER;
BEGIN
    -- Only check contradictions if there are at least 2 historical narratives
    SELECT COUNT(*) INTO v_narrative_count
    FROM company_narratives
    WHERE ticker_id = NEW.ticker_id
    AND id != NEW.id;
    
    IF v_narrative_count >= 2 THEN
        -- Create worker job for Gemini contradiction detection
        INSERT INTO worker_jobs (
            job_type,
            ticker_id,
            priority,
            status,
            result
        ) VALUES (
            'gemini_contradiction_check',
            NEW.ticker_id,
            'high',  -- Contradictions are important
            'pending',
            json_build_object(
                'new_narrative_id', NEW.id,
                'ticker_id', NEW.ticker_id,
                'filing_type', NEW.filing_type
            )::jsonb
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to company_narratives table
CREATE TRIGGER on_narrative_insert
AFTER INSERT ON company_narratives
FOR EACH ROW
EXECUTE FUNCTION trigger_contradiction_check();

-- =============================================================================
-- 5. TRIGGER: New Narrative → Check Promise Fulfillment
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_promise_check()
RETURNS TRIGGER AS $$
DECLARE
    v_pending_promises INTEGER;
BEGIN
    -- Check if there are any pending promises for this ticker
    SELECT COUNT(*) INTO v_pending_promises
    FROM company_promises
    WHERE ticker_id = NEW.ticker_id
    AND status = 'pending'
    AND expected_fulfillment_date <= NOW();
    
    IF v_pending_promises > 0 THEN
        -- Create worker job for Gemini promise verification
        INSERT INTO worker_jobs (
            job_type,
            ticker_id,
            priority,
            status,
            result
        ) VALUES (
            'gemini_promise_verification',
            NEW.ticker_id,
            'normal',
            'pending',
            json_build_object(
                'narrative_id', NEW.id,
                'filing_id', NEW.filing_id,
                'pending_promises', v_pending_promises
            )::jsonb
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to company_narratives table (for promise checking)
CREATE TRIGGER on_narrative_check_promises
AFTER INSERT ON company_narratives
FOR EACH ROW
EXECUTE FUNCTION trigger_promise_check();

-- =============================================================================
-- 6. FUNCTION: Manually Queue Filing for Analysis (For Testing/Reprocessing)
-- =============================================================================
CREATE OR REPLACE FUNCTION queue_filing_for_analysis(p_filing_id INTEGER)
RETURNS UUID AS $$
DECLARE
    v_job_id UUID;
    v_ticker_id INTEGER;
    v_filing_type VARCHAR(10);
BEGIN
    -- Get filing details
    SELECT ticker_id, filing_type 
    INTO v_ticker_id, v_filing_type
    FROM sec_filings
    WHERE id = p_filing_id;
    
    IF v_ticker_id IS NULL THEN
        RAISE EXCEPTION 'Filing % not found', p_filing_id;
    END IF;
    
    -- Create worker job
    INSERT INTO worker_jobs (
        job_type,
        ticker_id,
        priority,
        status,
        result
    ) VALUES (
        'gemini_filing_analysis',
        v_ticker_id,
        'high',
        'pending',
        json_build_object(
            'filing_id', p_filing_id,
            'filing_type', v_filing_type,
            'manual_trigger', true
        )::jsonb
    )
    RETURNING id INTO v_job_id;
    
    RETURN v_job_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 7. FUNCTION: Manually Queue Spike for Analysis (For Testing/Reprocessing)
-- =============================================================================
CREATE OR REPLACE FUNCTION queue_spike_for_analysis(p_spike_id INTEGER)
RETURNS UUID AS $$
DECLARE
    v_job_id UUID;
    v_ticker_id INTEGER;
    v_deviation DECIMAL;
BEGIN
    -- Get spike details
    SELECT ticker_id, deviation_multiple
    INTO v_ticker_id, v_deviation
    FROM volume_spikes
    WHERE id = p_spike_id;
    
    IF v_ticker_id IS NULL THEN
        RAISE EXCEPTION 'Spike % not found', p_spike_id;
    END IF;
    
    -- Create worker job
    INSERT INTO worker_jobs (
        job_type,
        ticker_id,
        volume_spike_id,
        priority,
        status,
        result
    ) VALUES (
        'gemini_divergence_analysis',
        v_ticker_id,
        p_spike_id,
        'high',
        'pending',
        json_build_object(
            'spike_id', p_spike_id,
            'deviation', v_deviation,
            'manual_trigger', true
        )::jsonb
    )
    RETURNING id INTO v_job_id;
    
    RETURN v_job_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 8. FUNCTION: Get Pending Worker Jobs (For Worker Consumption)
-- =============================================================================
CREATE OR REPLACE FUNCTION get_pending_jobs(
    p_job_type VARCHAR(50) DEFAULT NULL,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    job_id UUID,
    job_type VARCHAR(50),
    ticker_id INTEGER,
    ticker_symbol VARCHAR(10),
    priority VARCHAR(20),
    created_at TIMESTAMPTZ,
    result JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wj.id,
        wj.job_type,
        wj.ticker_id,
        t.symbol,
        wj.priority,
        wj.created_at,
        wj.result
    FROM worker_jobs wj
    LEFT JOIN tickers t ON t.id = wj.ticker_id
    WHERE wj.status = 'pending'
    AND (p_job_type IS NULL OR wj.job_type = p_job_type)
    AND wj.retry_count < wj.max_retries
    ORDER BY 
        CASE wj.priority
            WHEN 'high' THEN 1
            WHEN 'normal' THEN 2
            WHEN 'low' THEN 3
        END,
        wj.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 9. FUNCTION: Mark Job as Processing
-- =============================================================================
CREATE OR REPLACE FUNCTION mark_job_processing(
    p_job_id UUID,
    p_worker_name VARCHAR(100)
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE worker_jobs
    SET 
        status = 'processing',
        worker_name = p_worker_name,
        started_at = NOW(),
        updated_at = NOW()
    WHERE id = p_job_id
    AND status = 'pending';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 10. FUNCTION: Mark Job as Completed
-- =============================================================================
CREATE OR REPLACE FUNCTION mark_job_completed(
    p_job_id UUID,
    p_result JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE worker_jobs
    SET 
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW(),
        result = COALESCE(p_result, result)
    WHERE id = p_job_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 11. FUNCTION: Mark Job as Failed (with Retry Logic)
-- =============================================================================
CREATE OR REPLACE FUNCTION mark_job_failed(
    p_job_id UUID,
    p_error_message TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_retry_count INTEGER;
    v_max_retries INTEGER;
BEGIN
    -- Get current retry count
    SELECT retry_count, max_retries
    INTO v_retry_count, v_max_retries
    FROM worker_jobs
    WHERE id = p_job_id;
    
    IF v_retry_count + 1 >= v_max_retries THEN
        -- Max retries reached - mark as failed permanently
        UPDATE worker_jobs
        SET 
            status = 'failed',
            error_message = p_error_message,
            retry_count = v_retry_count + 1,
            updated_at = NOW()
        WHERE id = p_job_id;
    ELSE
        -- Reset to pending for retry
        UPDATE worker_jobs
        SET 
            status = 'pending',
            error_message = p_error_message,
            retry_count = v_retry_count + 1,
            updated_at = NOW()
        WHERE id = p_job_id;
    END IF;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 12. VIEW: Job Queue Status (For Monitoring)
-- =============================================================================
CREATE OR REPLACE VIEW worker_job_stats AS
SELECT 
    job_type,
    status,
    priority,
    COUNT(*) as job_count,
    MIN(created_at) as oldest_job,
    MAX(created_at) as newest_job,
    AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_processing_time_seconds
FROM worker_jobs
GROUP BY job_type, status, priority
ORDER BY job_type, 
    CASE status
        WHEN 'pending' THEN 1
        WHEN 'processing' THEN 2
        WHEN 'completed' THEN 3
        WHEN 'failed' THEN 4
    END;

-- =============================================================================
-- 13. CLEANUP: Failed Jobs Older Than 7 Days
-- =============================================================================
CREATE OR REPLACE FUNCTION cleanup_old_jobs()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM worker_jobs
        WHERE status IN ('completed', 'failed')
        AND created_at < NOW() - INTERVAL '7 days'
        RETURNING *
    )
    SELECT COUNT(*) INTO v_deleted_count FROM deleted;
    
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (starts daily at 2 AM)
SELECT cron.schedule(
    'cleanup-worker-jobs',
    '0 2 * * *',
    'SELECT cleanup_old_jobs()'
);
SELECT cron.schedule('cleanup-notifications', '0 3 * * *', 'SELECT cleanup_expired_notifications()');
SELECT cron.schedule('cleanup-partitions', '10 4 1 * *', 'SELECT cleanup_old_partitions(250)');
SELECT cron.schedule('create-future-partitions', '0 5 1 * *', 
    'SELECT create_market_data_partition(current_date + interval ''2 months'')');