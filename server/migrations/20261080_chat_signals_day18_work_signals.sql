CREATE TABLE IF NOT EXISTS work_signals (
  signal_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL,
  dedupe_key text NOT NULL,
  domain text NOT NULL,
  signal_type text NOT NULL,
  origin text NOT NULL,
  severity text NOT NULL,
  subject_type text NOT NULL,
  subject_id text NOT NULL,
  project_id text,
  audience_user_id text,
  audience_role text,
  title_key text NOT NULL,
  title_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  body_key text,
  body_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  action jsonb NOT NULL DEFAULT '{}'::jsonb,
  rule_id text NOT NULL,
  rule_version integer NOT NULL,
  provenance jsonb,
  source_signal_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'OPEN',
  first_observed_at timestamptz NOT NULL DEFAULT now(),
  last_observed_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_reason text,
  expires_at timestamptz,
  run_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_work_signals_domain') THEN
    ALTER TABLE work_signals ADD CONSTRAINT chk_work_signals_domain
      CHECK (domain IN ('EXECUTION', 'DECISION', 'RESULTS', 'FINANCE', 'ASSESSMENT', 'MEETINGS', 'MATERIALS', 'GOVERNANCE'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_work_signals_origin') THEN
    ALTER TABLE work_signals ADD CONSTRAINT chk_work_signals_origin
      CHECK (origin IN ('DETERMINISTIC', 'AGGREGATED', 'INTERPRETED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_work_signals_severity') THEN
    ALTER TABLE work_signals ADD CONSTRAINT chk_work_signals_severity
      CHECK (severity IN ('info', 'warning', 'critical', 'blocker'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_work_signals_status') THEN
    ALTER TABLE work_signals ADD CONSTRAINT chk_work_signals_status
      CHECK (status IN ('OPEN', 'RESOLVED', 'SUPERSEDED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_work_signals_resolved_reason') THEN
    ALTER TABLE work_signals ADD CONSTRAINT chk_work_signals_resolved_reason
      CHECK (resolved_reason IS NULL OR resolved_reason IN ('CONDITION_CLEARED', 'SUBJECT_DELETED', 'SUPERSEDED', 'EXPIRED', 'USER_RESOLVED'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_work_signals_open_key
  ON work_signals (organization_id, dedupe_key) WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS idx_work_signals_feed
  ON work_signals (organization_id, status, severity, last_observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_signals_audience
  ON work_signals (organization_id, audience_user_id, status);
CREATE INDEX IF NOT EXISTS idx_work_signals_project
  ON work_signals (organization_id, project_id, status);
CREATE INDEX IF NOT EXISTS idx_work_signals_subject
  ON work_signals (organization_id, subject_type, subject_id);
