-- EXE-08 — closure/evidence gate. An initiative cannot reach DONE without a
-- persistent evidence pack, an explicit approver decision, and the canonical
-- transition engine (server/src/services/initiative/initiativeTransitionService.ts,
-- read-only / not modified by this packet) performing the actual status write
-- and its own atomic audit (initiative_status_history + initiative_history).
--
-- Two tables, both additive/idempotent (IF NOT EXISTS throughout):
--   initiative_closure_requests — the evidence pack + approval workflow record.
--   initiative_closure_evidence — evidence references, child of a request.
--     Evidence MUST point at a real (task|milestone|decision) row that exists
--     and belongs to the same organization — validated at insert time by the
--     application, not by a DB FK (the three referent tables have no shared
--     parent to FK against polymorphically). A bare external URL is stored
--     only as supplementary `notes`, never as the sole evidence reference.
--
-- Defensive reconciliation (does NOT modify the frozen
-- 20260802_exe005006_change_progress_spine.sql — same "additive, replay
-- -safe" reasoning as that file's own header comment): this migration's
-- `writeInitiativeHistory` helper (initiativeClosureService.ts) always
-- supplies an `idempotency_key` when writing `initiative_history`. That
-- column is added by the EXE-05/06 migration above, but on a fresh-Postgres
-- bootstrap that file can fail LATER in its own body (its final statement
-- touches `execution_audit_log`, which does not exist yet at that point in
-- migration order) and, since one migration file commits as one
-- transaction, its earlier, otherwise-successful
-- `ALTER TABLE initiative_history ADD COLUMN idempotency_key` is rolled
-- back with it — confirmed by reproducing a fresh-Postgres bootstrap.
-- `initiative_history` itself is guaranteed to already exist by the time
-- THIS file runs (created by an earlier baseline migration, independent of
-- the EXE-05/06 file — verified against the live schema), so this ALTER is
-- always safe here, whether or not the sibling file succeeded.
ALTER TABLE initiative_history ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_initiative_history_idempotency
  ON initiative_history(initiative_id, action, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS initiative_closure_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  initiative_id TEXT NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,

  -- No FK to users(id): this is a NOT NULL audit-identity column ("who
  -- requested this"), same convention as decisions.decision_maker_id and
  -- initiative_history.changed_by elsewhere in this schema — a NOT NULL
  -- column can never carry ON DELETE SET NULL without self-contradiction
  -- (that combination throws at the FIRST user deletion, not at migration
  -- time — caught by Codex review against a real Postgres run).
  requested_by TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Optimistic-concurrency token: the initiative's own `updated_at` as read at
  -- request-creation/last-resubmit time. Re-checked with `WHERE ... AND
  -- updated_at = ?` immediately before calling the canonical transition —
  -- same CAS shape already proven in this codebase (presentations.routes.ts).
  expected_initiative_version TEXT,

  closure_rationale TEXT,
  outcome_summary TEXT,

  -- Point-in-time snapshots captured at submit time, so the evidence pack a
  -- reviewer approved is provably the one that gets audited — later edits to
  -- success_criteria/tasks elsewhere in the app cannot retroactively change
  -- what was actually reviewed.
  acceptance_criteria_snapshot JSONB,
  completed_items_snapshot JSONB,
  exceptions_waivers JSONB,

  -- Request-workflow status, distinct from initiatives.status:
  --   draft -> submitted -> (returned -> submitted)* -> approved_pending_transition -> done
  --                       -> transition_failed (retryable, self-heals to done on read
  --                          if the underlying initiative is confirmed DONE)
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','returned','approved_pending_transition','transition_failed','done')),

  approver_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending','approved','returned')),
  approved_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  review_rationale TEXT,

  -- Set once the canonical engine has actually performed the transition —
  -- points at the initiative_history row it wrote, proving the closure
  -- snapshot and the audit trail agree.
  transition_audit_ref TEXT,

  idempotency_key TEXT,
  -- This row's OWN optimistic-lock version (separate from
  -- expected_initiative_version, which is about the *initiative* row).
  -- Incremented on every state-changing write to this closure request.
  version INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_closure_requests_initiative
  ON initiative_closure_requests(initiative_id);
CREATE INDEX IF NOT EXISTS idx_closure_requests_org
  ON initiative_closure_requests(organization_id);

-- At most one closure request may be "in flight" (submitted or mid-approval)
-- per initiative at a time — prevents two independent closure workflows from
-- racing the canonical engine's own row lock on the SAME initiative from two
-- different closure_request rows. `draft` is deliberately excluded (a user
-- may have an abandoned draft while another request is active) and terminal
-- states (returned/done) are excluded (returned goes back to draft-equivalent
-- editing; done is final).
CREATE UNIQUE INDEX IF NOT EXISTS idx_closure_requests_one_active_per_initiative
  ON initiative_closure_requests(initiative_id)
  WHERE status IN ('submitted','approved_pending_transition','transition_failed');

CREATE UNIQUE INDEX IF NOT EXISTS idx_closure_requests_idempotency
  ON initiative_closure_requests(initiative_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS initiative_closure_evidence (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  closure_request_id TEXT NOT NULL REFERENCES initiative_closure_requests(id) ON DELETE CASCADE,
  initiative_id TEXT NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,

  -- Polymorphic reference to a real, org-owned row — validated by the
  -- application at insert time (see file header). No DB-level FK is possible
  -- across three different referent tables.
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('task','milestone','decision')),
  evidence_ref_id TEXT NOT NULL,

  notes TEXT,
  -- No FK to users(id) — see requested_by comment above (same contradiction,
  -- same fix).
  added_by TEXT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  idempotency_key TEXT
);

-- Reconciliation for environments where this migration already ran with the
-- earlier, self-contradictory FK definitions (NOT NULL + ON DELETE SET
-- NULL) — drop those two constraints if present. Additive/idempotent: a
-- no-op on a fresh install (the CREATE TABLE above never adds them) and a
-- no-op on a second run here (constraint already gone).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'initiative_closure_requests'
      AND constraint_name = 'initiative_closure_requests_requested_by_fkey'
  ) THEN
    ALTER TABLE initiative_closure_requests DROP CONSTRAINT initiative_closure_requests_requested_by_fkey;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'initiative_closure_evidence'
      AND constraint_name = 'initiative_closure_evidence_added_by_fkey'
  ) THEN
    ALTER TABLE initiative_closure_evidence DROP CONSTRAINT initiative_closure_evidence_added_by_fkey;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_closure_evidence_request
  ON initiative_closure_evidence(closure_request_id);
CREATE INDEX IF NOT EXISTS idx_closure_evidence_initiative
  ON initiative_closure_evidence(initiative_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_closure_evidence_idempotency
  ON initiative_closure_evidence(closure_request_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Prevent the exact same (task|milestone|decision) row from being attached as
-- evidence to the same closure request twice via a plain duplicate click
-- (distinct from the idempotency_key path, which guards retried requests).
CREATE UNIQUE INDEX IF NOT EXISTS idx_closure_evidence_no_dup_ref
  ON initiative_closure_evidence(closure_request_id, evidence_type, evidence_ref_id);

-- The "closure" initiative_section_types seed row is intentionally NOT in
-- this file — see server/migrations/933_initiative_section_types_closure.sql.
-- This file's own filename prefix ("20260802_...") sorts, in this project's
-- migration runner, BEFORE every plain-numbered file including
-- 529_initiative_section_types.sql (verified empirically: a fresh-Postgres
-- bootstrap applies every "2026....sql"-prefixed file, in date order, before
-- ANY plain-numbered file — the runner sorts filenames as plain strings, and
-- '2' < '5'). A seed INSERT into initiative_section_types placed HERE would
-- run before that table exists on a truly fresh install, failing (and, since
-- each migration file commits as one transaction, rolling back this file's
-- own CREATE TABLEs too) — silently deleting the whole closure/evidence
-- feature on fresh installs. Confirmed by reproducing a fresh-Postgres
-- bootstrap and inspecting schema_migrations: this file executed at
-- 05:50:50, 529_initiative_section_types.sql at 05:50:51 (a whole second
-- later, once the plain-numbered block starts). Splitting the seed into a
-- separately, later-numbered file is the fix — not reordering statements
-- within this one, which cannot change WHEN this file itself runs.
