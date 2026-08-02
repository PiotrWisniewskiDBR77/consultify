-- TLS-04 — Teresa-assisted SWOT: durable, reviewable AI proposals.
--
-- Teresa (AI) may PROPOSE SWOT edits, but a proposal must NEVER auto-save
-- into tool_sessions.answers_json. It is a standalone, audited record the
-- user explicitly accepts/edits/rejects before anything touches the real
-- SWOT data (see server/src/controllers/ToolController.ts
-- createSwotProposals/acceptSwotProposal/rejectSwotProposal).
--
-- `version` on tool_sessions is the optimistic-concurrency guard for the
-- accept flow: a proposal records the session version it was generated
-- against (expected_version); accepting re-checks the CURRENT version at
-- write time so a proposal generated against stale data cannot silently
-- clobber a concurrent edit.
--
-- Wzór: server/migrations/20260728_vault_folders.sql — fully additive +
-- idempotent (safe to re-run / safe on a shared DB): only
-- CREATE TABLE/INDEX IF NOT EXISTS and ADD COLUMN IF NOT EXISTS.

ALTER TABLE tool_sessions ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS swot_proposals (
  id TEXT PRIMARY KEY,
  tool_session_id TEXT NOT NULL REFERENCES tool_sessions(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  quadrant TEXT NOT NULL,
  operation TEXT NOT NULL,
  target_item_id TEXT,
  before_json TEXT,
  proposed_after_json TEXT,
  final_after_json TEXT,
  rationale TEXT NOT NULL,
  source_refs_json TEXT,
  is_assumption BOOLEAN NOT NULL DEFAULT FALSE,
  confidence NUMERIC NOT NULL,
  model_metadata_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expected_version INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_by TEXT,
  decided_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_swot_proposals_session_status ON swot_proposals(tool_session_id, status);
CREATE INDEX IF NOT EXISTS idx_swot_proposals_org ON swot_proposals(organization_id);
