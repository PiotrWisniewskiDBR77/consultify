-- RED-SCHEMA-500 (2026-07-19): manager_action_audit_log — new additive table.
--
-- ROOT CAUSE: server/src/services/v8/managerActionExecutionService.ts::managerAuditLog()
-- writes generic manager-cockpit action audit rows (id, organization_id, entity_type,
-- entity_id, action, old_value, new_value, reason, user_id, created_at) into
-- `execution_audit_log`. That table is a DIFFERENT, pre-existing feature (initiative
-- field-change history — see server/migrations/561_execution_control_t039_t040.sql)
-- with a disjoint, tightly-constrained schema: initiative_id/field_changed/change_reason/
-- changed_by, all NOT NULL, initiative_id has FOREIGN KEY -> initiatives(id).
-- managerAuditLog's entityType is not always 'initiative' (e.g. 'DECISION'), so remapping
-- to the existing columns would still fail the FK/NOT NULL constraints for non-initiative
-- entities. Result on demo/parity: INSERT always throws 42703 (unknown column), silently
-- swallowed by the caller's try/catch ("audit log table may not exist; non-blocking") —
-- manager cockpit actions were NEVER actually audit-logged.
--
-- ADDITIVE + IDEMPOTENT. New, separate table — does not touch execution_audit_log.
-- Column shapes mirror the service SQL exactly (see managerAuditLog()).

CREATE TABLE IF NOT EXISTS manager_action_audit_log (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL,
  entity_type      TEXT NOT NULL,
  entity_id        TEXT NOT NULL,
  action           TEXT NOT NULL,
  old_value        TEXT,
  new_value        TEXT,
  reason           TEXT,
  user_id          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manager_action_audit_org
  ON manager_action_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_manager_action_audit_entity
  ON manager_action_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_manager_action_audit_created
  ON manager_action_audit_log(organization_id, created_at DESC);
