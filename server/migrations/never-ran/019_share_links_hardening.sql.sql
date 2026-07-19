-- Migration: Share Links Hardening (Part 1)
-- Adds token_hash for secure storage, status for revocation

-- Add status column for revocation support (if not exists)
ALTER TABLE share_links ADD COLUMN status TEXT DEFAULT 'ACTIVE';

-- Add token_hash column for secure token verification (if not exists)
ALTER TABLE share_links ADD COLUMN token_hash TEXT;

-- Create index on token_hash for fast lookup
CREATE UNIQUE INDEX IF NOT EXISTS uniq_share_links_token_hash ON share_links(token_hash);

-- Create index on expires_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_share_links_expires ON share_links(expires_at);
