-- Migration 915: Finance aggregate_scope (A1 firma / A2 inicjatywa / A3 portfel)
--
-- SSOT: Harvard/wdrozenie-100/_KONCEPT_FINANCE_2026-07-10.md, §2.1 (trzy agregaty
-- sprawozdań) + §10 F-1. Continues the migration sequence after 914
-- (okr_management).
--
-- Classifies rows in the EXISTING `financial_statement_packs` table by
-- consolidation level, so the same table/UI/validator/export machinery serves
-- all three agregaty instead of a parallel schema:
--   'company'    (A1) — statements of the advised client entity. DEFAULT, so
--                 every existing pack is implicitly A1 with zero backfill.
--   'initiative' (A2) — pro-forma delta-P&L/BS/CF of a single initiative
--                 (computed by financeAggregateScopeService.ts from
--                 initiative_benefits/budget_initiative_links — Finance↔Results
--                 bridge). `source_initiative_ids` holds the one initiative id.
--   'portfolio'  (A3) — A1 + sum of selected A2 = "firma po transformacji".
--                 `base_pack_id` points at the A1 pack; `source_initiative_ids`
--                 holds the included initiative ids.
--
-- Additive only (new nullable/defaulted columns + index). No backfill needed:
-- existing rows get aggregate_scope='company' via DEFAULT, which is correct
-- (every pack imported/entered before this migration IS a company statement).
--
-- Idempotent (IF NOT EXISTS / guarded DO blocks) — safe to re-run. NOT executed
-- by this task; a dry-run + apply is the supervising session's call (skill
-- consultify-promocja-demo). No NOT NULL changes; no data migration required.

-- ============================================================================
-- 1. aggregate_scope — classification (A1/A2/A3)
-- ============================================================================
ALTER TABLE financial_statement_packs
  ADD COLUMN IF NOT EXISTS aggregate_scope TEXT DEFAULT 'company';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chk_fsp_aggregate_scope'
      AND table_name = 'financial_statement_packs'
  ) THEN
    ALTER TABLE financial_statement_packs
      ADD CONSTRAINT chk_fsp_aggregate_scope
      CHECK (aggregate_scope IN ('company', 'initiative', 'portfolio'));
  END IF;
END $$;

-- ============================================================================
-- 2. base_pack_id — for A2/A3, which A1 (company) pack this is derived from.
--    ON DELETE SET NULL: a derived pack outlives a deleted base pack as an
--    orphaned record (consistent with the fk_budgets_project precedent in
--    migration 912) rather than cascading data loss.
-- ============================================================================
ALTER TABLE financial_statement_packs
  ADD COLUMN IF NOT EXISTS base_pack_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_fsp_base_pack'
      AND table_name = 'financial_statement_packs'
  ) THEN
    ALTER TABLE financial_statement_packs
      ADD CONSTRAINT fk_fsp_base_pack
      FOREIGN KEY (base_pack_id) REFERENCES financial_statement_packs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 3. source_initiative_ids — for A2 (single id) / A3 (list of included ids).
--    JSONB array of initiative ids; NULL/'[]' for A1 (company) packs.
-- ============================================================================
ALTER TABLE financial_statement_packs
  ADD COLUMN IF NOT EXISTS source_initiative_ids JSONB DEFAULT '[]'::jsonb;

-- ============================================================================
-- 4. Index — list/filter packs by org + scope (FinanceHub A1/A2/A3 tabs).
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_fsp_aggregate_scope
  ON financial_statement_packs(organization_id, aggregate_scope);
