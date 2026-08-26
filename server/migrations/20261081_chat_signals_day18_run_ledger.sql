CREATE TABLE IF NOT EXISTS work_signal_runs (
  run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL,
  kind text NOT NULL,
  trigger text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'RUNNING',
  rules_evaluated integer NOT NULL DEFAULT 0,
  signals_opened integer NOT NULL DEFAULT 0,
  signals_updated integer NOT NULL DEFAULT 0,
  signals_resolved integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_run_id text,
  duration_ms integer
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_work_signal_runs_kind') THEN
    ALTER TABLE work_signal_runs ADD CONSTRAINT chk_work_signal_runs_kind
      CHECK (kind IN ('DETERMINISTIC', 'INTERPRETED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_work_signal_runs_trigger') THEN
    ALTER TABLE work_signal_runs ADD CONSTRAINT chk_work_signal_runs_trigger
      CHECK (trigger IN ('CRON', 'ON_DEMAND', 'BACKFILL'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_work_signal_runs_status') THEN
    ALTER TABLE work_signal_runs ADD CONSTRAINT chk_work_signal_runs_status
      CHECK (status IN ('RUNNING', 'OK', 'PARTIAL', 'FAILED', 'SKIPPED_NO_PROVIDER', 'SKIPPED_DISABLED'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_work_signal_runs_org
  ON work_signal_runs (organization_id, started_at DESC);

ALTER TABLE my_work_signal_prefs
  ADD COLUMN IF NOT EXISTS muted_domains_json text NOT NULL DEFAULT '[]';
