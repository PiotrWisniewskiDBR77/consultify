-- V4-INTV-01..07: Enterprise Interview module
-- Extends question types, adds distribution, evidence governance,
-- diagnostics, pipeline, anonymity, and company context versioning.

-- ============================================================
-- 1) V4-INTV-01: Extended question types + branching + quotas
-- ============================================================

ALTER TABLE interview_template_questions ADD COLUMN IF NOT EXISTS answer_options TEXT DEFAULT '[]';
ALTER TABLE interview_template_questions ADD COLUMN IF NOT EXISTS question_config TEXT DEFAULT '{}';
ALTER TABLE interview_template_questions ADD COLUMN IF NOT EXISTS branching_rules TEXT DEFAULT '[]';
ALTER TABLE interview_template_questions ADD COLUMN IF NOT EXISTS is_repeatable INTEGER DEFAULT 0;
ALTER TABLE interview_template_questions ADD COLUMN IF NOT EXISTS repeat_min INTEGER DEFAULT 0;
ALTER TABLE interview_template_questions ADD COLUMN IF NOT EXISTS repeat_max INTEGER DEFAULT 10;

ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS answer_options TEXT DEFAULT '[]';
ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS question_config TEXT DEFAULT '{}';
ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS branching_rules TEXT DEFAULT '[]';
ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS is_repeatable INTEGER DEFAULT 0;

-- Respondent segmentation
CREATE TABLE IF NOT EXISTS interview_respondent_segments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  segment_name TEXT NOT NULL,
  criteria TEXT NOT NULL DEFAULT '{}',
  respondent_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_intv_segments_session
  ON interview_respondent_segments(organization_id, session_id);

-- Quotas per segment
CREATE TABLE IF NOT EXISTS interview_quotas (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  segment_id TEXT,
  target_count INTEGER NOT NULL DEFAULT 10,
  current_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_intv_quotas_session
  ON interview_quotas(organization_id, session_id);

-- ============================================================
-- 2) V4-INTV-02: Distribution engine
-- ============================================================

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

CREATE TABLE IF NOT EXISTS interview_reminder_schedules (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  reminder_type TEXT NOT NULL DEFAULT 'email',
  schedule_cron TEXT,
  send_after_hours INTEGER DEFAULT 48,
  max_reminders INTEGER DEFAULT 3,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_intv_reminders_session
  ON interview_reminder_schedules(organization_id, session_id);

-- ============================================================
-- 3) V4-INTV-03: Evidence storage governance
-- ============================================================

ALTER TABLE interview_evidence ADD COLUMN IF NOT EXISTS storage_backend TEXT DEFAULT 'db';
ALTER TABLE interview_evidence ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE interview_evidence ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER;
ALTER TABLE interview_evidence ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE interview_evidence ADD COLUMN IF NOT EXISTS virus_scan_status TEXT DEFAULT 'pending';
ALTER TABLE interview_evidence ADD COLUMN IF NOT EXISTS virus_scan_at TIMESTAMP;
ALTER TABLE interview_evidence ADD COLUMN IF NOT EXISTS retention_until TIMESTAMP;

CREATE TABLE IF NOT EXISTS interview_evidence_access_log (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_intv_evidence_access
  ON interview_evidence_access_log(organization_id, evidence_id);

-- ============================================================
-- 4) V4-INTV-04: Diagnostics
-- ============================================================

CREATE TABLE IF NOT EXISTS interview_diagnostics_snapshots (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  snapshot_type TEXT NOT NULL DEFAULT 'themes',
  data TEXT NOT NULL DEFAULT '{}',
  generated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_intv_diag_session
  ON interview_diagnostics_snapshots(organization_id, session_id, snapshot_type);

-- ============================================================
-- 5) V4-INTV-05: Pipeline findings → recommendations → initiatives
-- ============================================================

CREATE TABLE IF NOT EXISTS interview_findings (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  insight_id TEXT,
  finding_type TEXT NOT NULL DEFAULT 'gap',
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT DEFAULT 'medium',
  evidence_refs TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'identified',
  recommendation_id TEXT,
  initiative_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_intv_findings_session
  ON interview_findings(organization_id, session_id, status);
CREATE INDEX IF NOT EXISTS idx_intv_findings_initiative
  ON interview_findings(initiative_id);

-- ============================================================
-- 6) V4-INTV-06: Anonymity modes
-- ============================================================

ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS anonymity_mode TEXT DEFAULT 'identified';
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS min_cohort_size INTEGER DEFAULT 5;
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS redaction_rules TEXT DEFAULT '{}';
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS export_gating TEXT DEFAULT 'none';

-- ============================================================
-- 7) V4-INTV-07: Company context versioning
-- ============================================================

CREATE TABLE IF NOT EXISTS organization_context_versions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  context_data TEXT NOT NULL DEFAULT '{}',
  confidence_scores TEXT DEFAULT '{}',
  source_citations TEXT DEFAULT '[]',
  reviewer_id TEXT,
  reviewer_sign_off_at TIMESTAMP,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_org_ctx_versions
  ON organization_context_versions(organization_id, version);
