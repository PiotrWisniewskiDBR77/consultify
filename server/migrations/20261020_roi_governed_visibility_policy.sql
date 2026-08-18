-- AMD-FLOW-ROI-VISIBILITY-002 — governed ROI visibility policy activation.
--
-- Owner decision (docs/cleanup/agents/OWNER_DECISIONS_AND_MEASURABLE_GATES_20260816.md
-- row 42): ROI visibility is restricted to same-tenant OWNER, ADMIN and users
-- holding the canonical Finance authority/grant; OPEN_ORG is not an approved
-- production policy. This migration replaces the SYNTHETIC_TEST_ONLY OPEN_ORG
-- fixture (tests/integration/crossflow/flowFixture.ts,
-- provisionSyntheticRoiVisibilityPolicy) with a real, governed, production
-- publish path.
--
-- WHY A NEW TABLE, NOT AN EXTENSION OF rvn_platform_visibility_policies
-- (impossibility proof, verified independently by the packet lead before
-- authorizing this file — see closure-b F2 Phase 1/2 findings):
--
--  1. CHECK enum closed. `rvn_platform_visibility_policies.visibility_mode`
--     (server/migrations/20260809_rvn_platform_visibility_core.sql, lines
--     18-19) is `CHECK (visibility_mode IN ('OPEN_ORG','SCOPE',
--     'MANAGEMENT_CHAIN','PRIVATE','RESTRICTED_ACL'))` — exactly five
--     literals. None of them expresses "owner/admin/current-Finance-grant
--     only". Representing the governed regime as a sixth value requires an
--     `ALTER ... CHECK` on that table.
--
--  2. That table is a SHARED component, not ROI-owned. It is written by
--     three domains' migrations (20260809 platform core, 20260810 KPI core,
--     20260815 ROI core) and by OKR's live production command
--     `publishProgram` (server/src/services/resultsVnext/okr/okrProgramCommands.ts:574).
--     Altering its CHECK constraint is a shared-component edit — forbidden
--     for this packet regardless of the ROI-local justification.
--
--  3. It is not append-only, and cannot be made so without breaking the
--     existing writer. `publishVisibilityPolicy()`
--     (server/src/services/resultsVnext/platform/visibilityResolver.ts:292-299)
--     performs `UPDATE rvn_platform_visibility_policies SET effective_to =
--     now() WHERE ... is_active = true` on the PRIOR row every time it is
--     called — a real, live UPDATE, today, in production, via OKR's
--     publishProgram. Zero triggers exist on this table
--     (grep -rn "TRIGGER.*rvn_platform_visibility_policies" server/migrations
--     — no matches). A BEFORE UPDATE OR DELETE append-only guard, the shape
--     every other governed ledger in this codebase uses
--     (rvn_finance_reconciliation_grant_events, 20260928 migration), would
--     reject that existing UPDATE outright and break OKR's live write path.
--
-- Per the CTO's rule ("no new migration unless the literal current schema
-- cannot represent the command"), all three properties above — a sixth
-- enum value, a shared-table alteration, and true append-only-ness — are
-- independently unrepresentable without touching a shared, actively-written
-- table. This migration is the minimum necessary consequence of that rule,
-- not a bypass of it.
--
-- WHAT IS DELIBERATELY *NOT* HERE (reuse, not reinvention):
--  - Idempotent receipt / version / exactly-one-winner / collision-409
--    semantics for the PUBLISH command come from the EXISTING generic
--    `executeAtomicCreate` + `rvn_platform_events` idempotency-key unique
--    index `ux_rvn_events_idem` (server/migrations/20260809_rvn_platform_events_outbox.sql,
--    lines 35/41) — the same machinery `createRoiCase` and `publishProgram`
--    already use. Nothing new is added here for that.
--  - "The canonical Finance authority/grant" clause of the owner decision is
--    NOT a new capability or a new grant ledger. It is
--    `rvn_finance_reconciliation_grant_events` (20260928 migration) and
--    capability 'results.roi.finance_reconciliation.resolve', reused
--    UNMODIFIED — no ALTER, no new literal, no second ledger.
--
-- This table is ONLY the read-side projection a resolver needs to answer,
-- cheaply and without scanning the event log: "has org X activated the
-- governed ROI visibility policy, and since when/by whom". One row per
-- organization — there is exactly one canonical policy; nothing to widen,
-- narrow, or version between. The PRIMARY KEY does double duty as both the
-- append-only anchor and the "exactly one winner" concurrency guard: a
-- second concurrent publish for the same org collides on the PK with a
-- Postgres 23505, caught by the command layer the same SAVEPOINT-retry way
-- `ux_rvn_roi_cases_one_active_per_initiative` already is in
-- roiCaseCommands.ts.

CREATE TABLE IF NOT EXISTS rvn_roi_visibility_governance (
  organization_id  TEXT PRIMARY KEY REFERENCES organizations(id),
  policy_key     TEXT NOT NULL DEFAULT 'AMD-FLOW-ROI-VISIBILITY-002/v1'
             CHECK (policy_key = 'AMD-FLOW-ROI-VISIBILITY-002/v1'),
  policy_digest   TEXT NOT NULL DEFAULT 'sha256:2c49cd371727bd19b7164b950e523c2caa9068874c88a451700d05f0ced67c65'
             CHECK (policy_digest = 'sha256:2c49cd371727bd19b7164b950e523c2caa9068874c88a451700d05f0ced67c65'),
  published_by    TEXT NOT NULL,
  published_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only: once an org's governed ROI visibility policy is published,
-- this row must never change or disappear. Same shape as
-- rvn_fin_reconciliation_decision_append_only (20260928 migration).
CREATE OR REPLACE FUNCTION rvn_roi_visibility_governance_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ROI governed-visibility policy activation is append-only (organization_id=%)', OLD.organization_id;
END $$;

DROP TRIGGER IF EXISTS trg_rvn_roi_visibility_governance_append_only
  ON rvn_roi_visibility_governance;
CREATE TRIGGER trg_rvn_roi_visibility_governance_append_only
  BEFORE UPDATE OR DELETE ON rvn_roi_visibility_governance
  FOR EACH ROW EXECUTE FUNCTION rvn_roi_visibility_governance_append_only();
