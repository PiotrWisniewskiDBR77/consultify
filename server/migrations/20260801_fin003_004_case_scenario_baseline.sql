-- ============================================
-- FIN-03/FIN-04 — Investment Case scenario lifecycle + baseline
-- ============================================
--
-- Context: `financial_models` (571_financial_modeling_t054.sql /
-- 20260228_financial_model_versions.sql) is the existing "Investment Case"
-- row — one row per scenario (its own `scenario` TEXT column, one of
-- 'base'/'optimistic'/'conservative'). There was previously NO way to group
-- several scenario rows under one Investment Case, and NO baseline concept
-- at all. This migration is purely additive: two new nullable/defaulted
-- columns, one partial unique index (the real transactional guarantee for
-- "exactly one active baseline"), and two new small tables. Nothing existing
-- is dropped, renamed, or retyped, so this is zero-collision-risk against
-- every prior migration.
--
-- Grouping model: `case_id` is a self-referencing FK on `financial_models`.
-- A row with `case_id IS NULL` is itself the root of its own Investment
-- Case (its own `id` acts as the case id). A scenario created "under" an
-- existing case sets `case_id` = that case's root id. `COALESCE(case_id, id)`
-- is therefore "the case id" for any row, root or scenario, everywhere below.

ALTER TABLE financial_models
  ADD COLUMN IF NOT EXISTS case_id TEXT REFERENCES financial_models(id) ON DELETE CASCADE;

ALTER TABLE financial_models
  ADD COLUMN IF NOT EXISTS is_baseline BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_fm_case_id ON financial_models(case_id);

-- Exactly one active baseline per Investment Case, per organization, enforced
-- by Postgres itself (not application-level "hope nothing races"): a partial
-- unique index over (organization_id, COALESCE(case_id, id)) that only
-- indexes rows where is_baseline = TRUE. Two concurrent "set baseline"
-- attempts for two different scenarios of the same case can never both
-- leave is_baseline = TRUE committed — the second writer gets a real
-- Postgres unique_violation (23505).
CREATE UNIQUE INDEX IF NOT EXISTS idx_fm_one_baseline_per_case
  ON financial_models (organization_id, COALESCE(case_id, id))
  WHERE is_baseline = TRUE;

-- Idempotency ledger for Investment Case / scenario CREATE and
-- APPROVE(=save version) calls. A client-supplied Idempotency-Key, scoped
-- per org + operation, maps to the resource that call actually produced.
-- A retried request with the same key returns the ORIGINAL resource instead
-- of minting a duplicate model/version row.
CREATE TABLE IF NOT EXISTS financial_model_idempotency (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('create_model', 'approve_model')),
  resource_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, idempotency_key, operation)
);

-- Audit log for baseline changes: who/when/from/to.
CREATE TABLE IF NOT EXISTS financial_model_baseline_audit (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  previous_baseline_model_id TEXT,
  new_baseline_model_id TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fm_baseline_audit_case ON financial_model_baseline_audit(case_id);

-- Prevent duplicate (model_id, version) rows in financial_model_versions —
-- closes the "retry duplicates a version" gap (nothing previously stopped
-- two concurrent approve() calls from both computing the same nextVersion
-- and both INSERTing). Guarded: only create the index if the live schema
-- has no pre-existing duplicates to violate it (mirrors the existing
-- drift-guard pattern in 20260228_financial_model_versions.sql for
-- idx_fmver_version) — on a fresh/local DB used by these tests this always
-- succeeds; on any drifted DB with legacy duplicates it safely no-ops
-- instead of failing the migration.
DO $$
DECLARE
  has_version_col boolean;
  has_dupes boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'financial_model_versions' AND column_name = 'version'
  ) INTO has_version_col;

  IF has_version_col THEN
    SELECT EXISTS (
      SELECT 1 FROM (
        SELECT model_id, version FROM financial_model_versions
        GROUP BY model_id, version HAVING COUNT(*) > 1
      ) d
    ) INTO has_dupes;

    IF NOT has_dupes THEN
      CREATE UNIQUE INDEX IF NOT EXISTS uq_fmver_model_version
        ON financial_model_versions(model_id, version);
    END IF;
  END IF;
END $$;
