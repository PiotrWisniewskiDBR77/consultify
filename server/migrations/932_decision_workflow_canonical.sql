-- 932_decision_workflow_canonical.sql
--
-- MW-DEC-001 — Canonical Decision Workflow (backend packet).
--
-- ROOT PROBLEM (see MW-CORE-001_CURRENT_RUNTIME_MAP.md §4, verified
-- 2026-08-01): the Decision object's core row (`decisions`) has a solid,
-- single-owner backend (DecisionController.ts / pmo/decisions.routes.ts).
-- But everything the DecisionDetailView.tsx frontend calls "dossier" —
-- comments, alternatives, risks — has NO backend at all. The frontend fakes
-- all three in `localStorage['consultify-decision-enhancements:<id>']` with a
-- hardcoded fake author "Current User" (DecisionDetailView.tsx:2051-2110).
-- This migration gives those three objects a REAL, organization-scoped,
-- author-attributed, persisted home so a future frontend change can delete
-- the localStorage shim entirely.
--
-- Also closes two small gaps on `decisions` itself found while implementing
-- the atomic final-transition endpoint (PATCH /api/decisions/:id/decide):
--   · `decided_by`   — `decided_at` and `decision_rationale` already exist on
--                       `decisions`, but the actor who decided was only ever
--                       recoverable indirectly via `decision_history.changed_by`
--                       (per-row, not a first-class field on the current-state
--                       row). Added for symmetry with `decided_at` and so the
--                       single aggregate GET can return it without a join.
--   · `version`      — no concurrency guard existed anywhere on `decisions`.
--                       A real integer counter (not a timestamp-equality
--                       trick, which is fragile across clock/precision
--                       differences) gives the final-transition endpoint a
--                       genuine optimistic-lock 409 instead of a silent
--                       last-write-wins overwrite.
--
-- Two-axis status note (MY_WORK_TASKS_AND_DECISIONS_OPERATING_SYSTEM.md §8
-- "Zakazy projektowe" — no single `status` column may mix decision OUTCOME
-- with approval WORKFLOW): `decisions.status` (this migration extends its
-- vocabulary) is the OUTCOME axis; `decisions.workflow_status` (untouched
-- here, owned by decisionWorkflowService.ts / DecisionController.transitionWorkflow)
-- is the separate approval-PROCESS axis. This migration does not add a third
-- axis — it adds one new OUTCOME value, `returned_for_clarification`, to the
-- existing `status` column. `decisions.status` has no CHECK constraint in any
-- migration (verified by grep across server/migrations-v2/001_baseline_20260413.sql
-- and server/migrations/*.sql) so no ALTER is needed to allow the new value —
-- it is enforced in application code only, in
-- server/src/services/decisionOutcomeService.ts.
--
-- Idempotent, additive, forward-only. Safe to run against a database that
-- already has some/none of this (every statement is IF NOT EXISTS). No
-- existing column, row, or table is altered destructively.
--
-- ★ NOT run against demo/prod by this packet — per repo convention (see
--   931_interview_insight_section_overrides.sql), 9xx migrations are not
--   auto-applied by server/src/services/tablePlatform/migrationRunner.ts
--   (which only picks up /^(7\d{2}|\d{8})_/). This file IS picked up
--   unconditionally by tests/acceptance/schema.mjs (applies every
--   server/migrations/*.sql), so the acceptance harness exercises it.
--   Demo/prod application is the job of the promotion process
--   (skill consultify-promocja-demo), not this packet.

-- ── decisions: concurrency guard + decided_by symmetry ──────────────────────

ALTER TABLE decisions
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN decisions.version IS
    'Optimistic-concurrency counter. Incremented by PATCH /api/decisions/:id/decide and PUT /api/decisions/:id on every successful write. A caller-supplied `version` on the decide payload that does not match the current value returns 409 (stale read) instead of silently overwriting a concurrent change.';

ALTER TABLE decisions
    ADD COLUMN IF NOT EXISTS decided_by TEXT;

COMMENT ON COLUMN decisions.decided_by IS
    'User id of the actor who set the current terminal outcome (approved/rejected). Companion to decided_at/decision_rationale, set atomically with them in DecisionController.decide. NULL until first decided. Not a FK (matches decision_maker_id/created_by convention elsewhere on this table).';

-- ── decision_comments ─────────────────────────────────────────────────────
-- Soft-delete (deleted_at), not hard DELETE: comments are part of the
-- decision's audit-visible discussion trail (product contract
-- DECISIONS_COMPLETE_PRODUCT_CONTRACT.md §5 "Komentarze" card) and the rest
-- of the Decision domain already prefers reversible archive over destructive
-- delete (see DecisionController.deleteDecision: status='cancelled', never a
-- real DELETE). A soft-deleted comment is excluded from the aggregate GET's
-- `comments` array by the service layer, never physically removed.

CREATE TABLE IF NOT EXISTS decision_comments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    decision_id TEXT NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_decision_comments_decision
    ON decision_comments (organization_id, decision_id, created_at);

-- ── decision_alternatives ────────────────────────────────────────────────
-- Hard-delete (hard DELETE endpoint provided): unlike comments, an
-- alternative is draft dossier content, not a discussion record — removing a
-- clearly-wrong draft option is a normal authoring action, not history
-- revision. Once the parent decision reaches a terminal outcome
-- (approved/rejected) the service layer freezes further alternative
-- create/update/delete (see decisionCollaborationService.ts) so the dossier
-- that was actually decided on cannot be rewritten after the fact — deletion
-- is only ever possible pre-finalization, so soft-delete would add
-- complexity with no audit benefit.

CREATE TABLE IF NOT EXISTS decision_alternatives (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    decision_id TEXT NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    benefits TEXT,
    drawbacks TEXT,
    cost_or_feasibility TEXT,
    is_recommended BOOLEAN NOT NULL DEFAULT FALSE,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_decision_alternatives_decision
    ON decision_alternatives (organization_id, decision_id, created_at);

-- ── decision_risks ────────────────────────────────────────────────────────
-- `severity` reuses the `decisions.priority` vocabulary (LOW/MEDIUM/HIGH/
-- CRITICAL) and `likelihood` reuses the `decisions.impact` vocabulary
-- (LOW/MEDIUM/HIGH) — both normalized server-side in
-- decisionCollaborationService.ts, same pattern as normalizePriority/
-- normalizeImpact in DecisionController.ts. No separate vocabulary invented.

CREATE TABLE IF NOT EXISTS decision_risks (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    decision_id TEXT NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'MEDIUM',
    likelihood TEXT NOT NULL DEFAULT 'MEDIUM',
    mitigation TEXT,
    owner_id TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_decision_risks_decision
    ON decision_risks (organization_id, decision_id, created_at);
