-- V4-INBX-01: Canonical inbox item schema
-- Persistent, materialized inbox items with lifecycle, SLA, and delegation support.

CREATE TABLE IF NOT EXISTS canonical_inbox_items (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  source_entity_type TEXT NOT NULL,
  source_entity_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'normal',
  section TEXT NOT NULL DEFAULT 'assigned_tasks',
  status TEXT NOT NULL DEFAULT 'pending',
  sla_deadline TIMESTAMPTZ,
  sla_status TEXT DEFAULT 'on_track',
  delegated_to TEXT,
  delegated_at TIMESTAMPTZ,
  delegated_by TEXT,
  delegation_notes TEXT,
  metadata_json TEXT DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  UNIQUE(user_id, source_entity_type, source_entity_id)
);

CREATE INDEX IF NOT EXISTS idx_canonical_inbox_user ON canonical_inbox_items(user_id);
CREATE INDEX IF NOT EXISTS idx_canonical_inbox_org ON canonical_inbox_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_canonical_inbox_status ON canonical_inbox_items(status);
CREATE INDEX IF NOT EXISTS idx_canonical_inbox_section ON canonical_inbox_items(section);
CREATE INDEX IF NOT EXISTS idx_canonical_inbox_sla ON canonical_inbox_items(sla_deadline) WHERE sla_status != 'resolved';
CREATE INDEX IF NOT EXISTS idx_canonical_inbox_delegated ON canonical_inbox_items(delegated_to) WHERE delegated_to IS NOT NULL;
