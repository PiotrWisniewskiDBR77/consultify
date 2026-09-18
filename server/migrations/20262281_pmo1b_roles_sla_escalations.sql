-- PMO-1b (DEC-633): additive PMO roles + stage SLA due dates/escalations.
-- Boundaries from CTO W234:
--   * do not alter initiative_stakeholders.role semantics,
--   * add only pmo_role + pmo_role_source to initiative_stakeholders,
--   * add the three PMO-1b tables below.

ALTER TABLE initiative_stakeholders
  ADD COLUMN IF NOT EXISTS pmo_role TEXT;

ALTER TABLE initiative_stakeholders
  ADD COLUMN IF NOT EXISTS pmo_role_source TEXT;

UPDATE initiative_stakeholders
   SET pmo_role = CASE UPPER(COALESCE(role, ''))
        WHEN 'SPONSOR' THEN 'SPONSOR'
        WHEN 'OWNER' THEN 'OWNER'
        WHEN 'CONTRIBUTOR' THEN 'MEMBER'
        WHEN 'REVIEWER' THEN 'PMO'
        WHEN 'INFORMED' THEN 'VIEWER'
        WHEN '' THEN 'VIEWER'
      END,
       pmo_role_source = 'derived'
 WHERE pmo_role IS NULL
   AND UPPER(COALESCE(role, '')) IN ('SPONSOR', 'OWNER', 'CONTRIBUTOR', 'REVIEWER', 'INFORMED', '');

CREATE INDEX IF NOT EXISTS idx_initiative_stakeholders_pmo_role
  ON initiative_stakeholders(pmo_role);

CREATE INDEX IF NOT EXISTS idx_initiative_stakeholders_initiative_pmo_role
  ON initiative_stakeholders(initiative_id, pmo_role);

CREATE TABLE IF NOT EXISTS initiative_stage_sla_policies (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  lifecycle_stage TEXT NOT NULL,
  next_lifecycle_stage TEXT NOT NULL,
  due_in_days INTEGER NOT NULL DEFAULT 7,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, lifecycle_stage, next_lifecycle_stage)
);

CREATE INDEX IF NOT EXISTS idx_initiative_stage_sla_policies_org_stage
  ON initiative_stage_sla_policies(organization_id, lifecycle_stage, next_lifecycle_stage)
  WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS initiative_stage_due_dates (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  initiative_id TEXT NOT NULL,
  policy_id TEXT,
  lifecycle_stage TEXT NOT NULL,
  next_lifecycle_stage TEXT NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  source TEXT NOT NULL DEFAULT 'manual',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_initiative_stage_due_dates_initiative
    FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
  CONSTRAINT fk_initiative_stage_due_dates_policy
    FOREIGN KEY (policy_id) REFERENCES initiative_stage_sla_policies(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_initiative_stage_due_dates_open
  ON initiative_stage_due_dates(organization_id, due_at)
  WHERE status = 'OPEN';

CREATE INDEX IF NOT EXISTS idx_initiative_stage_due_dates_initiative
  ON initiative_stage_due_dates(initiative_id, lifecycle_stage, next_lifecycle_stage);

CREATE TABLE IF NOT EXISTS initiative_stage_escalation_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  initiative_id TEXT NOT NULL,
  due_date_id TEXT NOT NULL,
  lifecycle_stage TEXT NOT NULL,
  next_lifecycle_stage TEXT NOT NULL,
  escalation_level INTEGER NOT NULL DEFAULT 1,
  target_pmo_role TEXT,
  target_user_id TEXT,
  route TEXT NOT NULL,
  reason TEXT NOT NULL,
  triggered_by TEXT NOT NULL DEFAULT 'system',
  trigger_type TEXT NOT NULL DEFAULT 'PMO_STAGE_SLA_OVERDUE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_initiative_stage_escalation_events_initiative
    FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
  CONSTRAINT fk_initiative_stage_escalation_events_due_date
    FOREIGN KEY (due_date_id) REFERENCES initiative_stage_due_dates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_initiative_stage_escalation_events_org_created
  ON initiative_stage_escalation_events(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_initiative_stage_escalation_events_due_date
  ON initiative_stage_escalation_events(due_date_id, escalation_level, created_at DESC);
