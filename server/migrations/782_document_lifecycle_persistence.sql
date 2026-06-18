-- M18 Document Studio — lifecycle state persistence (Epic E5).
-- Replaces the in-memory `persistedLifecycleStore` Map in
-- documentLifecycleService.ts with real Postgres so lifecycle transitions
-- (draft → in_review → approved → published → archived) survive a
-- deploy / restart.
--
-- Design notes:
--   - PRIMARY KEY (artifact_id, organization_id) — one row per artifact.
--     Upsert via ON CONFLICT DO UPDATE (the lifecycle state is a single
--     mutable object, not an append-only ledger).
--   - `history_json` holds the DocumentLifecycleTransition[] array;
--     `status_changed_at/by/reason` mirror the latest transition for fast
--     SELECT without deserializing the array.
--   - org-index for the loadLifecycleStatesForOrg (cold-start hydration)
--     query that fetches all states for an org at once.

CREATE TABLE IF NOT EXISTS document_lifecycle_states (
  artifact_id        TEXT NOT NULL,
  organization_id    TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'draft',
  status_changed_at  TEXT,
  status_changed_by  TEXT,
  status_reason      TEXT,
  history_json       JSONB NOT NULL DEFAULT '[]',
  updated_at         TEXT NOT NULL,
  PRIMARY KEY (artifact_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_dlcs_org
  ON document_lifecycle_states(organization_id);
