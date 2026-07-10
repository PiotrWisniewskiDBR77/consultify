-- Migration 912: Zwornik Delta B (project finance rollup) + Delta C (initiative
-- anchoring policy) — additive plumbing only.
--
-- SSOT: Harvard/wdrozenie-100/_KONCEPT_ZWORNIK_2026-07-10.md, §4 (Delta B) + §5
-- (Delta C). Continues the migration sequence after 904 (stakeholder_registry,
-- Delta A) / 905 (artifact_evidence) / 910 (report_definitions).
--
-- 1. `budgets.project_id` (migration 570) gets an FK + index — the column already
--    exists and is populated by `budgetingService.ts`, it was just never
--    constrained/indexed. FK is ON DELETE SET NULL (a budget outlives a deleted
--    project as an orphaned record, consistent with `budgets.organization_id`'s
--    own CASCADE being the hard boundary).
-- 2. `initiatives(project_id)` plain index — the only existing index is the
--    composite `idx_initiatives_project_status` (294); a leading-column index
--    still serves it, but a dedicated one is cheap and matches the SSOT ask.
-- 3. `projects.is_system` — marks the per-org system container project
--    ("Portfel — inicjatywy bezpośrednie", §5.2 point 3) that
--    `initiativeProjectPolicyService.ts` lazy-creates for AI/background
--    initiative creation when no project_id is supplied. A partial unique index
--    keeps that lazy-create race-safe (at most one system project per org).
--
-- Idempotent (IF NOT EXISTS / guarded DO blocks) — safe to re-run. NOT executed
-- by this task; run via skill `consultify-promocja-demo` after review. No
-- NOT NULL changes here — `initiatives.project_id` stays nullable until Faza 0
-- confirms zero orphans on the live DB (see SSOT §5.2 point 3, final sentence).

-- ============================================================================
-- 1. budgets.project_id — FK + index (Delta B §4.2 point 2)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_budgets_project'
      AND table_name = 'budgets'
  ) THEN
    ALTER TABLE budgets
      ADD CONSTRAINT fk_budgets_project
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Fail-soft: never let an FK add block the run (e.g. legacy orphan rows
  -- whose project_id no longer resolves to a live project).
  RAISE NOTICE 'migration 912: FK fk_budgets_project skipped/failed (ignored): %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_budgets_project ON budgets(project_id);

-- ============================================================================
-- 2. initiatives(project_id) — plain index (Delta B §4.2 point 2)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_initiatives_project ON initiatives(project_id);

-- ============================================================================
-- 3. projects.is_system — system portfolio container marker (Delta C §5.2.3)
-- ============================================================================
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;

-- At most one system project per org (race-safe lazy-create in
-- initiativeProjectPolicyService.ts: SELECT-then-INSERT, this index is the
-- backstop against a concurrent double-insert).
CREATE UNIQUE INDEX IF NOT EXISTS uq_projects_org_system_portfolio
  ON projects(organization_id) WHERE is_system = TRUE;
