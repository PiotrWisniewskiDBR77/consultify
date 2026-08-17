-- EXE-MVP-ACTIONS-001: the governed action ledger is append-only even when
-- application authorization is bypassed by direct SQL.
CREATE OR REPLACE FUNCTION execution_action_audit_deny_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'execution_action_audit is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_execution_action_audit_immutable ON execution_action_audit;
CREATE TRIGGER trg_execution_action_audit_immutable
BEFORE UPDATE OR DELETE ON execution_action_audit
FOR EACH ROW EXECUTE FUNCTION execution_action_audit_deny_mutation();
