-- Migration: 018_token_ledger.sql
-- Purpose: Create immutable token ledger for AI cost tracking and metering

-- Create the token_ledger table
CREATE TABLE IF NOT EXISTS token_ledger (
    id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    organization_id TEXT NOT NULL,
    actor_user_id TEXT,
    actor_type TEXT DEFAULT 'USER' CHECK(actor_type IN ('USER', 'SYSTEM', 'API')),
    type TEXT NOT NULL CHECK(type IN ('CREDIT', 'DEBIT')),
    amount INTEGER NOT NULL CHECK(amount > 0),
    reason TEXT,
    ref_entity_type TEXT CHECK(ref_entity_type IN ('AI_CALL', 'PURCHASE', 'GRANT', 'TRIAL_BONUS', 'ADJUSTMENT', 'REFUND')),
    ref_entity_id TEXT,
    metadata_json TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_token_ledger_org_id ON token_ledger(organization_id);
CREATE INDEX IF NOT EXISTS idx_token_ledger_org_created ON token_ledger(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_ledger_type ON token_ledger(type);

-- Ensure organizations table has token_balance column (may already exist)
-- This is a safety check; if it exists, SQLite will ignore
-- ALTER TABLE organizations ADD COLUMN token_balance INTEGER DEFAULT 0;
-- Note: SQLite doesn't support IF NOT EXISTS for ADD COLUMN, so we'll handle this in code if needed.
