-- Migration 573: People, Change & Communication Management (T043 + T044 + T045)
-- T043: Capability catalog, profiles, requirements, matching
-- T044: Change pulse check-ins, feedback, sentiment, resistance alerts
-- T045: Stakeholder segments, communication plans, templates, send log

BEGIN;

-- ============================================================
-- T043: CAPABILITY MANAGEMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS capabilities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  domain          TEXT NOT NULL DEFAULT 'general',
  tags            JSONB DEFAULT '[]'::jsonb,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capabilities_org ON capabilities(organization_id);
CREATE INDEX IF NOT EXISTS idx_capabilities_org_domain ON capabilities(organization_id, domain);

CREATE TABLE IF NOT EXISTS user_capabilities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  capability_id   UUID NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
  level           INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
  certifications  JSONB DEFAULT '[]'::jsonb,
  notes           TEXT,
  verified_by     TEXT,
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, capability_id)
);

CREATE INDEX IF NOT EXISTS idx_user_capabilities_user ON user_capabilities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_capabilities_org ON user_capabilities(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_capabilities_cap ON user_capabilities(capability_id);

CREATE TABLE IF NOT EXISTS capability_requirements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  initiative_id   TEXT,
  task_id         TEXT,
  capability_id   UUID NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
  min_level       INTEGER NOT NULL CHECK (min_level BETWEEN 1 AND 5),
  priority        TEXT NOT NULL DEFAULT 'required' CHECK (priority IN ('required', 'nice_to_have')),
  notes           TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cap_req_initiative ON capability_requirements(initiative_id);
CREATE INDEX IF NOT EXISTS idx_cap_req_task ON capability_requirements(task_id);
CREATE INDEX IF NOT EXISTS idx_cap_req_org ON capability_requirements(organization_id);

CREATE TABLE IF NOT EXISTS capability_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  initiative_id   TEXT,
  task_id         TEXT,
  user_id         TEXT NOT NULL,
  match_score     NUMERIC(5,2),
  gap_summary     JSONB DEFAULT '{}'::jsonb,
  decision        TEXT NOT NULL DEFAULT 'pending' CHECK (decision IN ('assigned', 'rejected', 'pending')),
  decision_reason TEXT,
  decided_by      TEXT,
  decided_at      TIMESTAMPTZ,
  ai_suggested    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cap_assign_org ON capability_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_cap_assign_initiative ON capability_assignments(initiative_id);

-- ============================================================
-- T044: CHANGE SENTIMENT & PULSE
-- ============================================================

CREATE TABLE IF NOT EXISTS change_pulse_checkins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  initiative_id   TEXT,
  project_id      TEXT,
  user_id         TEXT,
  is_anonymous    BOOLEAN NOT NULL DEFAULT FALSE,
  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         TEXT,
  questions_json  JSONB DEFAULT '[]'::jsonb,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pulse_org ON change_pulse_checkins(organization_id);
CREATE INDEX IF NOT EXISTS idx_pulse_initiative ON change_pulse_checkins(initiative_id);
CREATE INDEX IF NOT EXISTS idx_pulse_project ON change_pulse_checkins(project_id);
CREATE INDEX IF NOT EXISTS idx_pulse_org_date ON change_pulse_checkins(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS change_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  initiative_id   TEXT,
  project_id      TEXT,
  user_id         TEXT,
  is_anonymous    BOOLEAN NOT NULL DEFAULT FALSE,
  content         TEXT NOT NULL,
  sentiment       TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  sentiment_score NUMERIC(4,3),
  categories      JSONB DEFAULT '[]'::jsonb,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_change_fb_org ON change_feedback(organization_id);
CREATE INDEX IF NOT EXISTS idx_change_fb_initiative ON change_feedback(initiative_id);

CREATE TABLE IF NOT EXISTS change_sentiment_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  initiative_id   TEXT,
  project_id      TEXT,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  avg_rating      NUMERIC(3,2),
  total_responses INTEGER NOT NULL DEFAULT 0,
  trend           TEXT CHECK (trend IN ('improving', 'stable', 'declining')),
  top_concerns    JSONB DEFAULT '[]'::jsonb,
  distribution    JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sentiment_snap_org ON change_sentiment_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_snap_initiative ON change_sentiment_snapshots(initiative_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_snap_period ON change_sentiment_snapshots(period_start, period_end);

CREATE TABLE IF NOT EXISTS change_coaching_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT,
  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT,
  trigger_signal  TEXT,
  is_global       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS change_resistance_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  initiative_id   TEXT,
  project_id      TEXT,
  alert_type      TEXT NOT NULL,
  severity        TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message         TEXT NOT NULL,
  recommendations JSONB DEFAULT '[]'::jsonb,
  is_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resistance_org ON change_resistance_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_resistance_initiative ON change_resistance_alerts(initiative_id);
CREATE INDEX IF NOT EXISTS idx_resistance_unack ON change_resistance_alerts(organization_id, is_acknowledged) WHERE NOT is_acknowledged;

-- ============================================================
-- T045: STAKEHOLDER COMMUNICATION
-- ============================================================

CREATE TABLE IF NOT EXISTS stakeholder_segments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  initiative_id   TEXT,
  name            TEXT NOT NULL,
  description     TEXT,
  segment_type    TEXT,
  members_json    JSONB DEFAULT '[]'::jsonb,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_segments_org ON stakeholder_segments(organization_id);
CREATE INDEX IF NOT EXISTS idx_segments_initiative ON stakeholder_segments(initiative_id);

CREATE TABLE IF NOT EXISTS communication_plans (
  -- FRESH-DB PARITY (2026-07-14): id is TEXT, not UUID — on the live schema the
  -- table predates this migration with a TEXT id, and communication_plan_items
  -- below declares plan_id TEXT to match (a UUID PK here made the FK fail with
  -- "cannot be implemented" on a fresh replay, where this CREATE actually runs).
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  initiative_id   TEXT,
  cadence         TEXT NOT NULL DEFAULT 'weekly' CHECK (cadence IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'ad_hoc')),
  owner_user_id   TEXT,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  next_due_at     TIMESTAMPTZ,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_plans_org ON communication_plans(organization_id);
CREATE INDEX IF NOT EXISTS idx_comm_plans_initiative ON communication_plans(initiative_id);
CREATE INDEX IF NOT EXISTS idx_comm_plans_next_due ON communication_plans(next_due_at) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS communication_plan_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- plan_id is TEXT to match communication_plans.id (TEXT on the live schema,
  -- where the table predates this migration); a UUID FK can't reference TEXT.
  plan_id         TEXT NOT NULL REFERENCES communication_plans(id) ON DELETE CASCADE,
  comm_type       TEXT NOT NULL CHECK (comm_type IN ('update', 'announcement', 'newsletter', 'escalation', 'ad_hoc')),
  segment_ids     JSONB DEFAULT '[]'::jsonb,
  subject         TEXT,
  content         TEXT,
  template_id     UUID,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'approved', 'sent', 'cancelled')),
  scheduled_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  sent_by         TEXT,
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  channel         TEXT DEFAULT 'email' CHECK (channel IN ('email', 'in_app', 'slack', 'teams', 'sms')),
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_items_plan ON communication_plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_items_status ON communication_plan_items(status);
CREATE INDEX IF NOT EXISTS idx_plan_items_scheduled ON communication_plan_items(scheduled_at) WHERE status = 'scheduled';

CREATE TABLE IF NOT EXISTS communication_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  name            TEXT NOT NULL,
  comm_type       TEXT,
  subject_template TEXT,
  body_template   TEXT,
  fields_json     JSONB DEFAULT '[]'::jsonb,
  is_global       BOOLEAN NOT NULL DEFAULT FALSE,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_templates_org ON communication_templates(organization_id);

CREATE TABLE IF NOT EXISTS communication_send_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_item_id    UUID REFERENCES communication_plan_items(id) ON DELETE SET NULL,
  organization_id TEXT NOT NULL,
  initiative_id   TEXT,
  segment_id      UUID,
  channel         TEXT,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_by         TEXT,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  follow_up_task  TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_send_log_org ON communication_send_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_send_log_item ON communication_send_log(plan_item_id);
CREATE INDEX IF NOT EXISTS idx_send_log_initiative ON communication_send_log(initiative_id);

COMMIT;
