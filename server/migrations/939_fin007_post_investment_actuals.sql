-- FIN-007: post-investment actuals round-trip — additive only.
--
-- CTO DECISION (see docs/program/.../FIN-007 discovery report): NO second
-- actuals ledger. `roi_realized_values` (565_kpi_time_series_roi_attribution_
-- finance.sql) stays the ONE canonical realization table. This migration
-- only (a) extends it with columns needed for a keyed, baseline-bound write,
-- and (b) adds ONE minimal owner table for the post-investment review
-- receipt, which references the canonical rows by ID rather than copying
-- their values.
--
-- Numbered (not dated 2026...) so it sorts AFTER every dated migration in
-- this repo's known migration-ordering quirk (dated files sort before
-- numbered ones in the plain filename sort `migrate.postgres.ts` uses) —
-- the same position 937/938 already occupy for the same reason: both alter
-- `roi_realized_values` and depend on it already existing.

-- ─── 1. roi_realized_values: keyed, baseline-bound writes ──────────────────
--
-- All four columns are NULLABLE and default NULL, so the three PRE-EXISTING
-- writers (benefits.routes.ts, v8/results.routes.ts, and
-- executionRealizationService's human-entry path) are completely unaffected
-- — they never set these columns, exactly like `closure_receipt_id` (937)
-- before them.

-- Idempotency for a NEW keyed write path (FIN-007's actual-recording
-- endpoint). Distinct from `closure_receipt_id` (937, EXE-09-specific,
-- one-shot system writes) — this is a general Idempotency-Key + payload-hash
-- pair, mirroring FIN-005's reservation columns on
-- `financial_statement_upload_idempotency`.
ALTER TABLE roi_realized_values ADD COLUMN IF NOT EXISTS operation_key TEXT;
ALTER TABLE roi_realized_values ADD COLUMN IF NOT EXISTS request_hash TEXT;

-- Which APPROVED, IMMUTABLE Finance baseline this actual was recorded
-- against. Stamped once at write time — reconciliation later reads THIS
-- pointer, never "whatever is currently approved" (that would be a TOCTOU:
-- the model could be unapproved/re-approved between recording and
-- reconciling). No FK on the version half: `financial_model_versions` has
-- no natural (model_id, version) unique constraint to hang an FK off without
-- a broader migration outside this packet's scope — enforced in the
-- application layer instead (see recordExecutionRealizationForBaseline).
ALTER TABLE roi_realized_values ADD COLUMN IF NOT EXISTS baseline_model_id TEXT
  REFERENCES financial_models(id);
ALTER TABLE roi_realized_values ADD COLUMN IF NOT EXISTS baseline_version INTEGER;

-- Provenance to Execution/Results evidence — a free-form pointer (e.g. an
-- initiative_history id, an EXE-09 closure_receipt id, or a short operator
-- note) the caller supplies to say WHERE this number came from. Deliberately
-- TEXT, not a typed FK: the evidence a caller points at is heterogeneous by
-- design (this round-trip does not invent a universal evidence registry).
ALTER TABLE roi_realized_values ADD COLUMN IF NOT EXISTS evidence_ref TEXT;

-- One actual per (org, operation_key) — the idempotency guarantee for the
-- NEW keyed path. Partial: NULL (every pre-existing/human-entry row) never
-- participates, so old data cannot collide with itself or with new rows.
CREATE UNIQUE INDEX IF NOT EXISTS idx_roi_realized_values_operation_key
  ON roi_realized_values (organization_id, operation_key)
  WHERE operation_key IS NOT NULL;

-- ─── 2. finance_post_investment_reviews: the durable receipt ───────────────
--
-- Owner object for "approved baseline vs realized actual(s), reconciled."
-- Confirmed in discovery that NO existing table plays this role:
--   - post_implementation_reviews (20260623_pir.sql) is a qualitative
--     retrospective (went_well/went_wrong/do_better) with no baseline,
--     actual, or variance columns at all.
--   - v8_kpi_finance_reconciliations compares a KPI against a `finance_ref`
--     string, initiated by 'results'/'finance' — a different domain (KPI
--     status tracking), not initiative-baseline-vs-realized-actual, and has
--     no baseline version pointer.
--   - closure_delivery_receipts (935) is EXE-09's DONE-transition delivery
--     status (results/finance payload delivery), not a projected-vs-realized
--     verdict.
--
-- References the canonical actual rows by ID (`actual_ids`) rather than
-- copying their values — the receipt's own `realized_value`/`variance` are
-- DERIVED numbers computed once at creation time and frozen for a stable
-- read-back, not a second store of the actuals themselves.
CREATE TABLE IF NOT EXISTS finance_post_investment_reviews (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  initiative_id TEXT NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,

  -- The immutable baseline this review is against — see roi_realized_values
  -- above for why this must be a stamped pointer, not "current approved".
  baseline_model_id TEXT NOT NULL REFERENCES financial_models(id),
  baseline_version INTEGER NOT NULL,

  -- Explicit, caller-supplied locator into the FROZEN baseline snapshot
  -- (financial_model_versions.snapshot_data) — never an auto-derived
  -- revenue/cost heuristic. Discovery found no existing canonical mapping
  -- from a financial model's P&L line codes to "the" projected
  -- revenue/cost/savings figure for a period; inventing one would be
  -- guessing across domains, which this packet explicitly forbids. The
  -- caller (human, via the UI) names exactly which line in the approved
  -- snapshot is the projection to compare, and the server resolves +
  -- freezes that number — it never invents the mapping itself.
  baseline_statement_type TEXT NOT NULL CHECK (baseline_statement_type IN ('P&L', 'BS', 'CF')),
  baseline_line_code TEXT NOT NULL,
  baseline_period_date DATE NOT NULL,
  projected_value REAL NOT NULL,

  -- The canonical actual rows this review reconciles — REFERENCES, not a
  -- copy. All must share organization_id/initiative_id and the same
  -- period_month (enforced in the service, not here — see
  -- postInvestmentReviewService.createPostInvestmentReview).
  actual_ids JSONB NOT NULL,
  actual_period_month DATE NOT NULL,

  -- Derived once at creation from the referenced actual_ids' own columns
  -- (sum of realized_revenue_delta + realized_cost_delta + realized_savings)
  -- — frozen for a stable read-back even if a later (separate) actual entry
  -- is recorded for the same initiative/period; this review always reports
  -- what it reconciled AT THE TIME it was created.
  realized_value REAL NOT NULL,
  variance REAL NOT NULL,
  variance_pct REAL NOT NULL,
  reconciliation_status TEXT NOT NULL CHECK (reconciliation_status IN ('matched', 'variance')),

  -- Lineage: what was compared and how, beyond the columns above — e.g. the
  -- resolved snapshot pointer's raw value, tolerance used, timestamps.
  evidence_json JSONB,

  -- FIN-05-proven reservation/finalize state machine, applied to THIS
  -- receipt: a review is 'in_progress' the instant its row exists, and only
  -- 'completed' once every derived field above has been durably written.
  -- Contract requirement 11 ("a failed final receipt write must never leave
  -- a false completed") is this state machine, not a comment.
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
  idempotency_key TEXT,
  request_hash TEXT,

  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fpir_org_initiative
  ON finance_post_investment_reviews (organization_id, initiative_id);

-- One review per (org, idempotency_key) — same partial-unique pattern as
-- roi_realized_values above and FIN-05's idempotency ledger.
CREATE UNIQUE INDEX IF NOT EXISTS idx_fpir_org_key
  ON finance_post_investment_reviews (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
