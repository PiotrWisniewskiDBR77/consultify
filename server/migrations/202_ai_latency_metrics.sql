-- AI Latency Metrics Table
-- For P95/P99 tracking and historical performance analysis
-- Created: 2025-01-03

CREATE TABLE IF NOT EXISTS ai_latency_metrics (
    id TEXT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    sample_size INTEGER NOT NULL DEFAULT 0,
    p50 INTEGER DEFAULT 0,
    p75 INTEGER DEFAULT 0,
    p90 INTEGER DEFAULT 0,
    p95 INTEGER DEFAULT 0,
    p99 INTEGER DEFAULT 0,
    avg_ms INTEGER DEFAULT 0,
    min_ms INTEGER DEFAULT 0,
    max_ms INTEGER DEFAULT 0,
    success_rate REAL DEFAULT 0
);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_latency_metrics_timestamp ON ai_latency_metrics(timestamp);

-- Cleanup old metrics (keep 90 days of history)
-- This should be run periodically via cron job
-- DELETE FROM ai_latency_metrics WHERE timestamp < datetime('now', '-90 days');





