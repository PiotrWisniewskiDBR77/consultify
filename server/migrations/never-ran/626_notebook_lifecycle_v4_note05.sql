-- V4-NOTE-05: Lifecycle (owner, verification, reviewCadence, staleAt)
-- Adds verification_status, review_cadence, stale_at for knowledge lifecycle

ALTER TABLE notebook_pages ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified';
ALTER TABLE notebook_pages ADD COLUMN IF NOT EXISTS review_cadence TEXT DEFAULT 'monthly';
ALTER TABLE notebook_pages ADD COLUMN IF NOT EXISTS stale_at TIMESTAMP;
ALTER TABLE notebook_pages ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_notebook_pages_verification ON notebook_pages(verification_status);
CREATE INDEX IF NOT EXISTS idx_notebook_pages_stale ON notebook_pages(stale_at) WHERE stale_at IS NOT NULL;
