-- CW-T-A (Case Workspace, Case Identity) — cardinality and name.
--
-- ===========================================================================
-- WHAT THIS MIGRATION UNDOES, AND WHY
-- ===========================================================================
-- 20260809_case_workspace_case_core.sql modeled `case_core` as 1:1 with
-- `projects` — `project_id TEXT NOT NULL UNIQUE REFERENCES projects(id)` — on
-- the stated authority of OD-01 ("one Case, no separate Engagement/Job
-- object -> UNIQUE(project_id) enforces exactly one case_core row per
-- project").
--
-- Binding, later product ruling from the owner (2026-08-10, this packet's own
-- brief): a Case is a WORK ORDER (zlecenie). One project MAY and MUST be able
-- to hold MANY independent Cases — a consulting engagement runs several
-- distinct work orders against one client project over time, and conflating
-- them into one row was the actual modeling defect, not a database detail.
-- `UNIQUE (project_id)` is therefore CONTRARY to the canon, not merely
-- superseded, and `caseIntakeService.confirmWorkOrder`'s own PROVENANCE GATE
-- (added 20260810, `intake_existing_case_work_order_conflict`) was a correct
-- patch for the wrong constraint: it correctly refused to hand a human the
-- WRONG Case, by making the entire feature of "a second Case in this
-- project" impossible. This migration removes the constraint that made that
-- patch necessary; caseCoreService.ts / caseIntakeService.ts (same packet,
-- see their own header comments) remove the patch itself.
--
-- ===========================================================================
-- 1. DROP THE WRONG UNIQUENESS, KEEP A PLAIN QUERY INDEX
-- ===========================================================================
-- Real constraint name confirmed against the live schema (never guessed —
-- `information_schema.table_constraints` / `pg_constraint`, both on a fresh
-- migrated DB and on `case_workspace_test`, which carries pre-existing rows):
--   case_core_project_id_key   UNIQUE, btree (project_id)
-- (Postgres's default name for an inline `UNIQUE` column constraint —
-- `<table>_<column>_key`.)
--
-- `idx_case_core_project_id` (plain, non-unique, already added by the
-- original migration) already serves point lookups by project_id alone and
-- is left untouched. This migration adds the COMPOSITE
-- `(organization_id, project_id)` index the packet brief asks for
-- specifically, for the query shape "every Case for project X, scoped to
-- tenant Y" (`listCasesForOrganization` + a project filter, and the intake
-- provenance/backfill queries below) without relying on the planner
-- combining two single-column indexes.
ALTER TABLE case_core DROP CONSTRAINT IF EXISTS case_core_project_id_key;

CREATE INDEX IF NOT EXISTS idx_case_core_org_project
  ON case_core (organization_id, project_id);

-- ===========================================================================
-- 2. CANONICAL NAME/TITLE — separate from goal/expectedOutcome
-- ===========================================================================
-- `case_name` is the Case's own short, human title. It is deliberately its
-- own column, never derived on the fly from `goal` (the one-sentence "what
-- are we doing" carried by the intake work order) or from `projects.name`
-- (the CLIENT PROJECT's name, shared by every Case under it) — a goal is a
-- sentence a human writes to describe intent; a name is what a human scans a
-- list by, and CW-T-A's whole point is that a project's Cases must be
-- tellable apart AT A GLANCE (see docs/product/case-workspace/... UI
-- acceptance: "list shows two DIFFERENT names for two Cases in one
-- project"). Two Cases sharing a project already share `projects.name`, so
-- that column alone can never satisfy the requirement; `goal` could, IF two
-- work orders always differ in their first sentence, but coupling display
-- identity to a field whose job is something else is exactly the mistake
-- this column exists to correct.
--
-- Added nullable first, backfilled below, THEN made NOT NULL — the only safe
-- order on a table that (per the packet brief) already carries real rows on
-- `case_workspace_test`.
ALTER TABLE case_core ADD COLUMN IF NOT EXISTS case_name TEXT;

-- ---------------------------------------------------------------------------
-- BACKFILL — additive, never merges or deletes a row (verified by the
-- caller's before/after row-count probe; see the integration test in
-- caseCardinality.pg.test.ts). Two honest sources, in priority order:
--
--   (a) The GOAL of this Case's own CONFIRMED work order, when one exists —
--       `case_workspace_event_outbox` rows of type
--       `case.intake.work_order_confirmed` carry `redacted_summary->>'goal'`
--       (caseIntakeService.ts's `workOrderSummary`), keyed by `case_id`. This
--       is REAL text a human actually wrote and confirmed for THIS Case, not
--       an invention — it is reused here only because pre-2026-08-10
--       confirmed-work-order events predate this migration's dedicated
--       `caseName` field (see caseIntakeService.ts's WORK_ORDER_SCHEMA_VERSION
--       bump — this backfill is the one-time reason the schema version had
--       to move) and so never had a name of their own to carry forward.
--       `DISTINCT ON (case_id) ... ORDER BY case_id, occurred_at ASC` takes
--       the FIRST confirmation per Case (the one that actually created it;
--       see caseIntakeService.ts's own `findCaseForConversation` comment
--       for why "first" is the createCase-equivalent event).
--   (b) For every remaining row (created via the direct `POST /cases`
--       endpoint, i.e. caseCoreService.createCase, which never wrote an
--       intake confirmation event) — an HONEST IDENTIFIER, not a fabricated
--       title: `'Zlecenie ' || short case id`, the exact same
--       `case-XXXXXXXX` shortening scheme `skrotZlecenia()` already applies
--       client-side (src/components/CaseWorkspace/CasesListScreen.tsx) so a
--       backfilled row's fallback name matches what the UI would have shown
--       anyway before this column existed.
-- ---------------------------------------------------------------------------
UPDATE case_core c
   SET case_name = wo.goal
  FROM (
    SELECT DISTINCT ON (case_id) case_id, redacted_summary->>'goal' AS goal
      FROM case_workspace_event_outbox
     WHERE event_type = 'case.intake.work_order_confirmed'
       AND case_id IS NOT NULL
       AND coalesce(redacted_summary->>'goal', '') <> ''
     ORDER BY case_id, occurred_at ASC, created_at ASC
  ) wo
 WHERE c.case_id = wo.case_id
   AND coalesce(c.case_name, '') = '';

UPDATE case_core
   SET case_name = 'Zlecenie ' || upper(substring(replace(case_id, 'case-', '') from 1 for 8))
 WHERE coalesce(case_name, '') = '';

ALTER TABLE case_core ALTER COLUMN case_name SET NOT NULL;

ALTER TABLE case_core DROP CONSTRAINT IF EXISTS case_core_case_name_not_blank;
ALTER TABLE case_core ADD CONSTRAINT case_core_case_name_not_blank CHECK (case_name <> '');

-- ===========================================================================
-- 3. THE REAL INTAKE IDEMPOTENCY KEY — replaces `project_id` uniqueness
-- ===========================================================================
-- Per the packet brief: tenant + actor/conversation + confirmation
-- idempotency key + exact work-order digest. `caseIntakeService.ts`
-- (`computeIntakeConfirmationKey`, same packet) hashes those four factors
-- into this single deterministic column and inserts with
-- `ON CONFLICT (intake_confirmation_key) DO NOTHING` where `case_core.project_id`
-- used to carry that role. Two DIFFERENT work orders in the same project now
-- compute two DIFFERENT keys (the digest differs) and both INSERTs succeed —
-- CW-T-A's cardinality requirement, enforced by Postgres, not by a
-- read-then-write race. A retried or racing confirmation of the SAME work
-- order (same four factors) computes the SAME key, so the second INSERT
-- collides and the caller re-reads the first — idempotent replay, no second
-- Case.
--
-- NULL for every Case created outside intake (`caseCoreService.createCase`,
-- which has no work order / digest concept at all) — the partial unique
-- index below deliberately excludes NULLs, so direct creates never collide
-- with one another or with an intake-created Case.
ALTER TABLE case_core ADD COLUMN IF NOT EXISTS intake_confirmation_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS case_core_intake_confirmation_key_key
  ON case_core (intake_confirmation_key)
  WHERE intake_confirmation_key IS NOT NULL;
