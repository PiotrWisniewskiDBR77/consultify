-- Create table for storing performance metrics snapshots
-- Note: For PostgreSQL, use: id SERIAL PRIMARY KEY and timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
CREATE TABLE IF NOT EXISTS metrics_snapshots (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    window_minutes INTEGER DEFAULT 60,
    
    -- Request Metrics
    total_requests INTEGER DEFAULT 0,
    avg_response_time REAL DEFAULT 0,
    request_rate REAL DEFAULT 0, -- requests per minute
    error_rate REAL DEFAULT 0,
    slow_requests_count INTEGER DEFAULT 0,
    
    -- System Metrics
    memory_heap_used_mb REAL,
    memory_rss_mb REAL,
    cpu_usage_percent REAL,
    
    -- DB Metrics
    avg_db_query_time REAL DEFAULT 0,
    db_query_count INTEGER DEFAULT 0
);

-- Index for time-based querying
CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_timestamp ON metrics_snapshots(timestamp);
