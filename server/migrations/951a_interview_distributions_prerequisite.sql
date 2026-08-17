-- Fresh-install prerequisite for the public Interview distribution path.
--
-- `952_interview_public_distribution_answers.sql` is a numbered migration and
-- therefore runs before the dated `20260719_baseline_gap.sql` that also carries
-- this legacy table. Existing databases already have the table; a database
-- created from zero did not, so 952 failed before the dated repair could run.
-- Keep this producer additive and byte-stable. The later baseline and invite
-- governance migrations remain authoritative extensions.

CREATE TABLE IF NOT EXISTS interview_distributions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  recipient_email TEXT,
  recipient_name TEXT,
  public_token TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  anonymity_mode TEXT NOT NULL DEFAULT 'identified',
  sent_at TIMESTAMP,
  opened_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  reminder_count INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_intv_dist_token
  ON interview_distributions(public_token);

CREATE INDEX IF NOT EXISTS idx_intv_dist_session
  ON interview_distributions(organization_id, session_id, status);
