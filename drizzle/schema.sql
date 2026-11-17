-- SLA Monitoring Dashboard Database Schema
-- Target: PostgreSQL / Neon Serverless Postgres

-- 1. Upload Batches Table (Tracks file ingestion, S3 source, row counts, and audit metadata)
CREATE TABLE IF NOT EXISTS upload_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    s3_key VARCHAR(512),
    total_rows INTEGER NOT NULL DEFAULT 0,
    valid_rows INTEGER NOT NULL DEFAULT 0,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Health Checks Table (Normalized telemetry probe records)
CREATE TABLE IF NOT EXISTS health_checks (
    id BIGSERIAL PRIMARY KEY,
    service_id VARCHAR(64) NOT NULL,
    service_name VARCHAR(64) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    status_code SMALLINT NOT NULL,
    latency_ms REAL,
    agent VARCHAR(32) NOT NULL,
    region VARCHAR(32) NOT NULL,
    is_success BOOLEAN NOT NULL,
    upload_batch_id UUID REFERENCES upload_batches(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Idempotency constraint: prevents duplicate rows if re-uploaded or retried
    CONSTRAINT uq_check_service_timestamp_agent UNIQUE (service_id, timestamp, agent)
);

-- 3. High-Performance Indexes for Filtering and Aggregations
-- Optimized for chronological sorting & date range filters in Logs view
CREATE INDEX IF NOT EXISTS idx_health_checks_timestamp 
    ON health_checks (timestamp DESC);

-- Optimized for per-service SLA queries within a time window
CREATE INDEX IF NOT EXISTS idx_health_checks_service_timestamp 
    ON health_checks (service_id, timestamp DESC);

-- Optimized for filtering failure/incident checks
CREATE INDEX IF NOT EXISTS idx_health_checks_failure 
    ON health_checks (is_success, timestamp DESC) 
    WHERE is_success = FALSE;

-- Optimized for batch-level queries and cleanups
CREATE INDEX IF NOT EXISTS idx_health_checks_batch 
    ON health_checks (upload_batch_id);
