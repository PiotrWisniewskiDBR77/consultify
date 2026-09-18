-- Rollback for PMO-1b (DEC-633): remove only additive objects from 20262281.

DROP INDEX IF EXISTS idx_initiative_stage_escalation_events_due_date;
DROP INDEX IF EXISTS idx_initiative_stage_escalation_events_org_created;
DROP TABLE IF EXISTS initiative_stage_escalation_events;

DROP INDEX IF EXISTS idx_initiative_stage_due_dates_initiative;
DROP INDEX IF EXISTS idx_initiative_stage_due_dates_open;
DROP TABLE IF EXISTS initiative_stage_due_dates;

DROP INDEX IF EXISTS idx_initiative_stage_sla_policies_org_stage;
DROP TABLE IF EXISTS initiative_stage_sla_policies;

DROP INDEX IF EXISTS idx_initiative_stakeholders_initiative_pmo_role;
DROP INDEX IF EXISTS idx_initiative_stakeholders_pmo_role;

ALTER TABLE initiative_stakeholders DROP COLUMN IF EXISTS pmo_role_source;
ALTER TABLE initiative_stakeholders DROP COLUMN IF EXISTS pmo_role;
