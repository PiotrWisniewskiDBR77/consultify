-- AUD-MVP-LIFECYCLE-001: the audit trail is evidence, not mutable state.
-- Corrections must be appended and linked through `supersedes`; neither the
-- application nor a future direct SQL writer may rewrite or erase history.

CREATE OR REPLACE FUNCTION audit_domain_events_append_only_guard()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_domain_events is append-only; append a superseding event instead'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_domain_events_append_only
  ON audit_domain_events;
CREATE TRIGGER trg_audit_domain_events_append_only
BEFORE UPDATE OR DELETE ON audit_domain_events
FOR EACH ROW EXECUTE FUNCTION audit_domain_events_append_only_guard();
