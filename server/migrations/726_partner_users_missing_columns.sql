-- =============================================================================
-- Migration: 726_partner_users_missing_columns.sql
-- Description: Bring legacy `partner_users` table up to Partner Portal schema.
-- =============================================================================

CREATE TABLE IF NOT EXISTS partner_users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_org_id TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  role TEXT DEFAULT 'consultant',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_partner_users_user ON partner_users(user_id);

-- Columns required by Partner Portal routes/services
ALTER TABLE partner_users ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE partner_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill for existing rows (safe no-ops if table is empty)
UPDATE partner_users
SET joined_at = COALESCE(joined_at, created_at, NOW())
WHERE joined_at IS NULL;

UPDATE partner_users
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;

-- Constraints/indexes (idempotent via DO blocks / IF NOT EXISTS)
-- NOTE: legacy `partner_users.partner_org_id` is `text` in some environments, so we avoid
-- adding a FK here (it would require a type migration to UUID).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'partner_users_partner_org_id_user_id_key'
  ) THEN
    ALTER TABLE partner_users
      ADD CONSTRAINT partner_users_partner_org_id_user_id_key
      UNIQUE (partner_org_id, user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_partner_users_user_id ON partner_users(user_id);
CREATE INDEX IF NOT EXISTS idx_partner_users_partner_org_id ON partner_users(partner_org_id);

