-- V4-INTV-01..07: Enterprise Interview module
-- Extends question types, adds distribution, evidence governance,
-- diagnostics, pipeline, anonymity, and company context versioning.

-- ============================================================
-- 1) V4-INTV-01: Extended question types + branching + quotas
-- ============================================================

CREATE TABLE IF NOT EXISTS interview_templates (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    status TEXT DEFAULT 'approved',
    visibility TEXT DEFAULT 'org',
    is_default INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interview_template_questions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    template_id TEXT NOT NULL REFERENCES interview_templates(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    question_text TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    answer_type TEXT DEFAULT 'open',
    is_required INTEGER DEFAULT 0,
    help_hint TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interview_templates_org ON interview_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_interview_templates_status ON interview_templates(status);
CREATE INDEX IF NOT EXISTS idx_interview_templates_category ON interview_templates(category);
CREATE INDEX IF NOT EXISTS idx_interview_template_questions_template ON interview_template_questions(template_id);
CREATE INDEX IF NOT EXISTS idx_interview_template_questions_category ON interview_template_questions(category);

CREATE TABLE IF NOT EXISTS interview_sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    name TEXT DEFAULT 'Discovery Interview',
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'in_progress',
    progress_json TEXT DEFAULT '{}',
    total_questions INTEGER DEFAULT 0,
    answered_questions INTEGER DEFAULT 0,
    summary_facts TEXT DEFAULT '[]',
    summary_gaps TEXT DEFAULT '[]',
    summary_constraints TEXT DEFAULT '[]',
    summary_pain_points TEXT DEFAULT '[]',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_org ON interview_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_owner ON interview_sessions(owner_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_status ON interview_sessions(status);

CREATE TABLE IF NOT EXISTS interview_questions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    session_id TEXT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    question_text TEXT NOT NULL,
    answer_text TEXT,
    status TEXT DEFAULT 'not_started',
    confidence_score INTEGER DEFAULT 0,
    answered_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    answered_at TIMESTAMP,
    tags TEXT DEFAULT '[]',
    sort_order INTEGER DEFAULT 0,
    is_template INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interview_questions_session ON interview_questions(session_id);
CREATE INDEX IF NOT EXISTS idx_interview_questions_org ON interview_questions(organization_id);

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

CREATE TABLE IF NOT EXISTS interview_evidence (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  session_id TEXT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  question_id TEXT REFERENCES interview_questions(id) ON DELETE SET NULL,
  evidence_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  file_type TEXT,
  url TEXT,
  uploaded_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interview_evidence_session ON interview_evidence(session_id);
CREATE INDEX IF NOT EXISTS idx_interview_evidence_question ON interview_evidence(question_id);

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
