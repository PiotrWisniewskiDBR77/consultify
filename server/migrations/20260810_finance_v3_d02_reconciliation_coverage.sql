-- Finance v3 — BUGFIX RC-01 / RC-05: reconciliation coverage + DEC-FIN-009 result quality.
--
-- Source finding: docs/validation/finance-v3/generated/gate-d/REAL_COMPANY_PROOF_report.md
--   RC-01 (P1) — 212 of 280 real Apator line-values had no target in the 31-code P0 taxonomy,
--                yet the import reported status='CLEAN' with residual 0, because both
--                `unmapped_total` and `excluded_total` are SUBTRACTED in the residual GENERATED
--                column. The loss was counted and then netted away — silent success.
--   RC-05 (P1) — a 99.2% one-year collapse in trade payables (93 591 -> 722 tys. PLN) passed the
--                whole chain with no flag at all.
-- Fix report: docs/validation/finance-v3/generated/gate-d/BUGFIX_RC01_RC05_report.md
--
-- ADDITIVE ONLY. No DROP, no RENAME, no ALTER ... TYPE, no CHECK constraint is dropped or
-- widened on any existing column. `status` keeps its original three values verbatim
-- ('CLEAN','WITHIN_TOLERANCE','EXCEEDS_MATERIALITY') — completeness gets its OWN column rather
-- than overloading a residual-tolerance vocabulary, and rather than forcing a constraint
-- rewrite on a shipped table.
--
-- WHY result_quality here as well as on finance_business_versions (WP-B05 already added it
-- there): the business-version column is frozen at approve and describes the artifact; this one
-- is append-only per reconciliation RUN and describes that run's verdict. A run must be able to
-- say "PROVISIONAL" the moment it happens, before and independently of any approval.
--
-- RC-05 needs no DDL: the control is a service-level check that writes into the existing
-- append-only `finance_exceptions` ledger (severity='WARNING', reason_code='PERIOD_OVER_PERIOD_JUMP').
-- No trigger/function is added, deliberately — a plausibility heuristic with a tunable threshold
-- belongs where it can be overridden per call, not baked into a constraint that would BLOCK the
-- write (DEC-FIN-009: mark, never block).

BEGIN;

ALTER TABLE finance_reconciliation_runs
  ADD COLUMN IF NOT EXISTS result_quality TEXT
    CHECK (result_quality IN ('CLEAN', 'CONDITIONAL', 'PROVISIONAL'));

-- Absolute-value coverage: |sum of source magnitudes that reached the canonical model| divided
-- by |sum of all source magnitudes|. NULL when every source value is 0 (undefined, not 100%).
ALTER TABLE finance_reconciliation_runs
  ADD COLUMN IF NOT EXISTS source_value_coverage_pct NUMERIC
    CHECK (source_value_coverage_pct IS NULL OR (source_value_coverage_pct >= 0 AND source_value_coverage_pct <= 1));

-- Distinct from linked_exception_id (which points at the RESIDUAL exception): one run can carry
-- both a residual defect and a coverage defect, and collapsing them into one FK would hide one.
ALTER TABLE finance_reconciliation_runs
  ADD COLUMN IF NOT EXISTS coverage_exception_id TEXT REFERENCES finance_exceptions(id);

-- Exception-inbox / quality-dashboard access path: "show me every run that is not CLEAN".
CREATE INDEX IF NOT EXISTS idx_finance_recon_result_quality
  ON finance_reconciliation_runs(organization_id, result_quality, created_at DESC);

COMMIT;
