-- AMD-FLOW-ROI-VISIBILITY-002 — governed ROI visibility policy activation.
--
-- Owner decision (docs/cleanup/agents/OWNER_DECISIONS_AND_MEASURABLE_GATES_20260816.md
-- row 42): ROI visibility is restricted to same-tenant OWNER, ADMIN and users
-- holding the canonical Finance authority/grant; OPEN_ORG is not an approved
-- production policy. This is the ONLY authority for ROI case creation AND
-- reads (a later owner decision superseded the standing RN-G5 "createRoiCase
-- stays ungated" call — see roiCaseCommands.ts's own comment on tha
-- reversal) — this migration replaced the SYNTHETIC_TEST_ONLY OPEN_ORG
-- fixture (tests/integration/crossflow/flowFixture.ts), which no longer
-- exists in that file at all.
--
-- WHY A NEW TABLE, NOT AN EXTENSION OF rvn_platform_visibility_policies
-- (impossibility proof, verified independently by the packet lead before
-- authorizing this file — see closure-b F2 Phase 1/2 findings):
--
--  1. CHECK enum closed. `rvn_platform_visibility_policies.visibility_mode`
--     (server/migrations/20260809_rvn_platform_visibility_core.sql, lines
--     18-19) is `CHECK (visibility_mode IN ('OPEN_ORG','SCOPE',
--     'MANAGEMENT_CHAIN','PRIVATE','RESTRICTED_ACL'))` — exactly five
--     literals. None of them expresses "owner/admin/current-Finance-gran
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
-- IDEMPOTENCY — CORRECTED (this table's `idempotency_key`/`request_fingerprint`
-- columns): an earlier version of this comment claimed idempoten
-- receipt/version/collision-409 semantics for the publish command would
-- come from the EXISTING generic `executeAtomicCreate` + `rvn_platform_events`
-- idempotency-key machinery (the same one `createRoiCase`/`publishProgram`
-- use). That reuse was ATTEMPTED, not merely considered, and BLOCKED:
-- `executeAtomicCreate`'s event envelope requires `aggregateType:
-- RvnResourceType` (eventEnvelope.ts), and `resourceTypes.ts`'s
-- `RVN_RESOURCE_TYPES` union has no literal for this org-level governance
-- event — adding one is outside this packet's bounded path list (a
-- shared-SSOT file per resourceTypes.ts's own header comment, consumed by
-- KPI/OKR/ROI/event-envelope typing alike). `publishRoiGovernedVisibilityPolicy`
-- (visibilityResolver.ts) therefore carries its OWN local
-- `pg_advisory_xact_lock`/replay/collision logic, keyed on THIS table's
-- `idempotency_key` + `request_fingerprint` columns (a deterministic hash of
-- organization_id + actor_user_id + the pinned policy_key/policy_digest) —
-- not merely "same actor vs different actor": a request whose fingerprint OR
-- idempotency_key differs from the row already on file collides (zero
-- writes), regardless of whether the actor matches: altered identity AND
-- altered payload both collide, only an EXACT repeat of both replays.
--
-- "The canonical Finance authority/grant" clause of the owner decision is
-- NOT a new capability or a new grant ledger. It is
-- `rvn_finance_reconciliation_grant_events` (20260928 migration) and
-- capability 'results.roi.finance_reconciliation.resolve', reused
-- UNMODIFIED — no ALTER, no new literal, no second ledger.
--
-- This table is the read-side (and, since RN-G5 was superseded, the
-- write-side gate's) projection: "has org X activated the governed ROI
-- visibility policy, and since when/by whom/under what exact request". One
-- row per organization — there is exactly one canonical policy; nothing to
-- widen, narrow, or version between. The PRIMARY KEY does double duty as
-- both the append-only anchor and the "exactly one winner" concurrency
-- guard: a second concurrent publish for the same org collides on the PK
-- with a Postgres 23505, caught by the command layer the same SAVEPOINT-retry
-- way `ux_rvn_roi_cases_one_active_per_initiative` already is in
-- roiCaseCommands.ts.

CREATE TABLE IF NOT EXISTS rvn_roi_visibility_governance (
  organization_id    TEXT PRIMARY KEY REFERENCES organizations(id),
  policy_key       TEXT NOT NULL DEFAULT 'AMD-FLOW-ROI-VISIBILITY-002/v1'
               CHECK (policy_key = 'AMD-FLOW-ROI-VISIBILITY-002/v1'),
  policy_digest     TEXT NOT NULL DEFAULT 'sha256:2c49cd371727bd19b7164b950e523c2caa9068874c88a451700d05f0ced67c65'
               CHECK (policy_digest = 'sha256:2c49cd371727bd19b7164b950e523c2caa9068874c88a451700d05f0ced67c65'),
  published_by      TEXT NOT NULL,
  published_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Idempotency identity of the ONE publish call this row is the durable
  -- record of. A retry must match BOTH exactly to replay; anything else
  -- (same actor, different idempotency_key; same idempotency_key, differen
  -- fingerprint; different actor entirely) collides. NOT NULL with no
  -- DEFAULT — every caller must supply both explicitly, on purpose (no
  -- silent legacy-row backfill possible for a table that only ever gets
  -- fresh rows from this packet onward).
  idempotency_key    TEXT NOT NULL,
  request_fingerprint  TEXT NOT NULL
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
