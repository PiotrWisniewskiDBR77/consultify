-- M14/F6 (6.2): Real distribution worker support.
-- report_distributions only tracked intent (created_at / sent_at) but had no
-- delivery-state columns the email-worker can claim/settle on.
-- delivered_at IS NULL = "not yet delivered" → the worker's work queue.

-- FRESH-DB GUARD (2026-07-14): report_distributions was originally created by
-- 066_status_reports.sql, which the Postgres runner filters out (<500 legacy).
-- On a fresh replay the table therefore never exists — create it here with the
-- shape 066 declared (created_at default corrected from the SQLite-ism
-- `TEXT DEFAULT CURRENT_TIMESTAMP` to `(now()::text)`, same as the 2026-06-08
-- drift catch-up did for other tables). CREATE IF NOT EXISTS = no-op on DBs
-- where the table already exists (staging/prod).
CREATE TABLE IF NOT EXISTS report_distributions (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    recipient_id TEXT,
    recipient_email TEXT,
    recipient_type TEXT DEFAULT 'STAKEHOLDER', -- STAKEHOLDER, SPONSOR, TEAM, EXTERNAL
    distribution_method TEXT DEFAULT 'EMAIL', -- EMAIL, LINK, PDF
    sent_at TEXT,
    opened_at TEXT,
    link_token TEXT,
    created_at TEXT DEFAULT (now()::text),
    FOREIGN KEY (report_id) REFERENCES status_reports(id) ON DELETE CASCADE
);

ALTER TABLE report_distributions ADD COLUMN IF NOT EXISTS delivered_at TEXT;
ALTER TABLE report_distributions ADD COLUMN IF NOT EXISTS delivery_status TEXT;
