-- M14/F8 (8.5) — Post-Implementation Review (PIR) as an artifact (lessons learned).
--
-- A PIR captures the retrospective for a delivered initiative:
--   - went_well        — what worked
--   - went_wrong       — what failed / hurt
--   - do_better        — what we'd change next time
--   - recommendations  — forward-looking actions
--
-- Design notes:
--   - id TEXT PK (uuid) — append-friendly; an initiative can accumulate
--     multiple reviews over its lifecycle (e.g. phase-gate retros).
--   - org-scoped (organization_id) on every read/write for tenant isolation.
--   - status DRAFT → FINALIZED; finalize stamps reviewed_by / reviewed_at.
--   - org + initiative indexes for the getPir(orgId, initiativeId) lookup.

CREATE TABLE IF NOT EXISTS post_implementation_reviews (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL,
  initiative_id    TEXT NOT NULL,
  title            TEXT,
  went_well        TEXT,
  went_wrong       TEXT,
  do_better        TEXT,
  recommendations  TEXT,
  status           TEXT NOT NULL DEFAULT 'DRAFT',
  reviewed_by      TEXT,
  reviewed_at      TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pir_org
  ON post_implementation_reviews(organization_id);

CREATE INDEX IF NOT EXISTS idx_pir_initiative
  ON post_implementation_reviews(organization_id, initiative_id);
