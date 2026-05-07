-- Migration 768: Presentation Benchmark Runs (Epic H1)
--
-- Backing store for the monthly DBR77/VTS benchmark scorecard cadence.
-- Each row represents a single monthly run (`run_label`) per organization
-- and reference deck set (e.g. `DBR77+VTS`), capturing the averaged
-- per-dimension scores, the verdict, and per-dimension deltas vs the
-- prior run.
--
-- Schema-tolerant: `presentationBenchmarkScorecardService.persistBenchmarkRun`
-- and `listBenchmarkRunHistory` swallow missing-table / missing-column
-- errors and return `storage_error` rather than throwing 500.

CREATE TABLE IF NOT EXISTS presentation_benchmark_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  run_label TEXT NOT NULL,
  reference_set TEXT NOT NULL,
  total_decks_scored INTEGER NOT NULL DEFAULT 0,
  scores JSONB NOT NULL,
  verdict TEXT NOT NULL,
  delta_vs_prior JSONB,
  notes TEXT,
  reported_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, run_label)
);

CREATE INDEX IF NOT EXISTS idx_benchmark_runs_org_label
  ON presentation_benchmark_runs(organization_id, run_label DESC);
