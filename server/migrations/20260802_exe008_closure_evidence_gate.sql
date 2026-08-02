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

CREATE TABLE IF NOT EXISTS initiative_closure_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  initiative_id TEXT NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,

  requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE SET NULL,
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
  added_by TEXT NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  idempotency_key TEXT
);

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
