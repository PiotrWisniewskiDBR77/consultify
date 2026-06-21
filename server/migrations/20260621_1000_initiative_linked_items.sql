-- 20260621_1000 — M13 Depth · Seria K · K3
--
-- Durable storage for initiative ↔ artifact links ("Korelacja z innymi
-- artefaktami"). Previously LinkedItemsSection kept links only in React state
-- (lost on reload). This table persists them, org-scoped, so links survive and
-- can be queried both directions.
--
-- Conventions match 20260608_rollout_tables.sql: TEXT keys, gen_random_uuid()::TEXT
-- defaults, NOW() timestamps, additive + idempotent.

CREATE TABLE IF NOT EXISTS initiative_linked_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  organization_id TEXT NOT NULL,
  initiative_id TEXT NOT NULL,
  target_type TEXT NOT NULL,   -- 'task' | 'decision' | 'initiative' | 'document' | …
  target_id TEXT NOT NULL,
  label TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (initiative_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_initiative_linked_items_org_init
  ON initiative_linked_items (organization_id, initiative_id);
