-- Day214: governed Teresa chat draft -> Runtime-v1 initiative adoption.

CREATE TABLE IF NOT EXISTS flow_teresa_chat_draft_adoptions (
  receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  chat_initiative_id TEXT NOT NULL REFERENCES initiatives(id),
  runtime_initiative_id TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  adopted_by TEXT NOT NULL,
  adopted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  policy_id TEXT NOT NULL,
  policy_version INTEGER NOT NULL CHECK (policy_version > 0),
  correlation_id TEXT NOT NULL,
  CONSTRAINT ck_flow_teresa_chat_one_initiative_identity
    CHECK (chat_initiative_id = runtime_initiative_id),
  UNIQUE (organization_id, chat_initiative_id),
  UNIQUE (organization_id, runtime_initiative_id)
);

CREATE OR REPLACE FUNCTION validate_flow_teresa_chat_draft_adoption()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM initiatives i
     WHERE i.id = NEW.chat_initiative_id
       AND i.organization_id = NEW.organization_id
       AND i.source_type = 'teresa_chat'
       AND i.project_id = NEW.project_id
       AND NULLIF(BTRIM(i.title), '') IS NOT NULL
       AND NULLIF(BTRIM(i.problem_statement), '') IS NOT NULL
       AND COALESCE(i.owner_execution_id, i.owner_business_id) IS NOT NULL
       AND NEW.runtime_initiative_id = i.id
  ) THEN
    RAISE EXCEPTION 'invalid Teresa chat-draft adoption identity graph'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE TRIGGER trg_flow_teresa_chat_draft_adoption_validate
BEFORE INSERT ON flow_teresa_chat_draft_adoptions
FOR EACH ROW EXECUTE FUNCTION validate_flow_teresa_chat_draft_adoption();

CREATE OR REPLACE FUNCTION protect_flow_teresa_chat_draft_adoption()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'flow_teresa_chat_draft_adoptions is append-only';
END $$;

CREATE OR REPLACE TRIGGER trg_flow_teresa_chat_draft_adoption_immutable
BEFORE UPDATE OR DELETE ON flow_teresa_chat_draft_adoptions
FOR EACH ROW EXECUTE FUNCTION protect_flow_teresa_chat_draft_adoption();
