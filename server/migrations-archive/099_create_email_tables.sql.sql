-- Create scheduled_emails table
CREATE TABLE IF NOT EXISTS scheduled_emails (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    recipients TEXT NOT NULL, -- JSON string
    scheduled_time DATETIME NOT NULL,
    status TEXT DEFAULT 'PENDING', -- PENDING, SENT, FAILED
    sent_at DATETIME,
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create email_log table (referenced in _logEmailSent)
CREATE TABLE IF NOT EXISTS email_log (
    id TEXT PRIMARY KEY,
    report_id TEXT,
    recipients TEXT,
    results TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for better performance on cron jobs
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status_time ON scheduled_emails(status, scheduled_time);
