-- Tenant-bound chat partial-response checkpoints.
--
-- Historical rows may have a NULL organization_id.  They are deliberately
-- left untouched and become unreachable through the canonical runtime.  This
-- avoids inventing tenant ownership during a late upgrade.

-- The original table made session_id globally unique. Session identifiers are
-- client supplied, so two tenants may legitimately use the same value. Remove
-- both historical shapes (table constraint and standalone unique index) before
-- installing the tenant-bound identity used by the runtime upsert.
ALTER TABLE ai_partial_responses
  DROP CONSTRAINT IF EXISTS ai_partial_responses_session_id_key;
DROP INDEX IF EXISTS idx_partial_responses_session;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_partial_responses_tenant_session
  ON ai_partial_responses (organization_id, user_id, session_id);

CREATE OR REPLACE FUNCTION enforce_ai_partial_response_tenant_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.organization_id IS NULL OR btrim(NEW.organization_id) = '' THEN
    RAISE EXCEPTION 'chat_partial_response_organization_required'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.user_id IS NULL OR btrim(NEW.user_id) = '' THEN
    RAISE EXCEPTION 'chat_partial_response_user_required'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.session_id IS NULL OR btrim(NEW.session_id) = '' THEN
    RAISE EXCEPTION 'chat_partial_response_session_required'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_partial_response_tenant_scope ON ai_partial_responses;
CREATE TRIGGER trg_ai_partial_response_tenant_scope
BEFORE INSERT OR UPDATE OF organization_id, user_id, session_id ON ai_partial_responses
FOR EACH ROW EXECUTE FUNCTION enforce_ai_partial_response_tenant_scope();
