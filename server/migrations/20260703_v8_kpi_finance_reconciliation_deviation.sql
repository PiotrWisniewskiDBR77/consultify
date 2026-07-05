-- ============================================================================
-- 20260703 — M15 (Rezultaty) ↔ M16 (Finanse) reconciliation: deviation columns
-- ----------------------------------------------------------------------------
-- Gap closed (Harvard R4 #10 / chain #11): the existing reconciliation surface
-- (`v8_kpi_finance_reconciliations` + resultsROIService.getReconciliationOverview)
-- is DISPLAY-ONLY. It requires a pre-created row and compares KPI `target_value`
-- against a raw SUM of realized entries with NO unit conversion — so a KPI in %
-- or units never reconciles against a money-denominated finance driver (the
-- source of the "absurd OEE/wariancja" Fable flagged in R3).
--
-- This migration adds the fields needed to PULL actuals from Results per
-- initiative, MAP each KPI to a finance-model driver/benefit with an explicit
-- unit-conversion multiplier, and persist a realized-vs-projected DEVIATION plus
-- an advisory CONCLUSION_LAYER (deviation → co znaczy → co robić).
--
-- Idempotent (ADD COLUMN IF NOT EXISTS); auto-applied by DatabaseInitializer
-- (pattern ^\d{8}_.*\.sql$) and tracked in the migration history table.
-- ============================================================================

-- The finance-model driver / benefit line this KPI reconciles against.
-- Free-text key resolvable to a financial_model_events / statement-line driver.
ALTER TABLE v8_kpi_finance_reconciliations
  ADD COLUMN IF NOT EXISTS driver_key TEXT;

-- KPI-unit → finance-unit conversion factor. realized_finance = kpi_actual ×
-- unit_multiplier. Default 1.0 (identity) keeps money↔money reconciliations
-- unchanged; a % / count / duration KPI carries the €-per-unit factor here so
-- both sides share one currency basis before deviation is computed.
ALTER TABLE v8_kpi_finance_reconciliations
  ADD COLUMN IF NOT EXISTS unit_multiplier REAL DEFAULT 1.0;

-- Snapshot of the two reconciled figures (both already unit-normalised to the
-- finance basis) so the deviation is auditable without recomputation.
ALTER TABLE v8_kpi_finance_reconciliations
  ADD COLUMN IF NOT EXISTS projected_value REAL;
ALTER TABLE v8_kpi_finance_reconciliations
  ADD COLUMN IF NOT EXISTS realized_value REAL;

-- Deviation = realized − projected (finance basis) and its % of |projected|.
ALTER TABLE v8_kpi_finance_reconciliations
  ADD COLUMN IF NOT EXISTS deviation_absolute REAL;
ALTER TABLE v8_kpi_finance_reconciliations
  ADD COLUMN IF NOT EXISTS deviation_percent REAL;

-- CONCLUSION_LAYER payload (headline / K2 meaning / K3 actions / K4 effect),
-- serialised JSON. Deterministic, numbers-from-engine only.
ALTER TABLE v8_kpi_finance_reconciliations
  ADD COLUMN IF NOT EXISTS conclusion_json TEXT;

-- When the actuals were last pulled + reconciled.
ALTER TABLE v8_kpi_finance_reconciliations
  ADD COLUMN IF NOT EXISTS reconciled_at TEXT;

CREATE INDEX IF NOT EXISTS idx_v8_kfr_initiative_driver
  ON v8_kpi_finance_reconciliations(kpi_id, driver_key);
