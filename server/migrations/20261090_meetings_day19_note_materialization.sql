-- Meetings day 19 (DEC-87 option B / DEC-98 reserved namespace).
-- Additive, retry-safe materialization attempt ledger owned by Meetings.

CREATE TABLE IF NOT EXISTS meeting_note_materializations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  meeting_id TEXT NOT NULL,
  note_id TEXT NOT NULL,
  proposal_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'failed', 'materialized')),
  stage TEXT CHECK (stage IN ('content', 'registry', 'receipt')),
  artifact_id TEXT,
  receipt_id TEXT,
  failure_code TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, meeting_id, note_id)
);

CREATE INDEX IF NOT EXISTS idx_meeting_note_materializations_lookup
  ON meeting_note_materializations(organization_id, meeting_id, status);
