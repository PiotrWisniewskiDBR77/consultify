-- FLOW-TRANSFORM-MVP-001: governed classic Candidate -> Runtime-v1 adoption.
-- The classic receipt remains authoritative in initiative_candidates.initiative_id;
-- this bridge never writes registered_initiative_id.

CREATE TABLE IF NOT EXISTS flow_accepted_classic_runtime_adoptions (
  receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  candidate_id TEXT NOT NULL REFERENCES initiative_candidates(id),
  classic_initiative_id TEXT NOT NULL REFERENCES initiatives(id),
  runtime_initiative_id TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  swot_handoff_receipt_id TEXT NOT NULL REFERENCES swot_candidate_handoffs(id),
  swot_source_revision INTEGER NOT NULL CHECK (swot_source_revision > 0),
  tool_output_id TEXT NOT NULL REFERENCES tool_outputs(id),
  tool_output_version INTEGER NOT NULL CHECK (tool_output_version > 0),
  tool_output_content_hash TEXT NOT NULL CHECK (tool_output_content_hash ~ '^[0-9a-f]{16}$'),
  policy_id TEXT NOT NULL,
  policy_version INTEGER NOT NULL CHECK (policy_version > 0),
  correlation_id TEXT NOT NULL,
  adopted_by TEXT NOT NULL,
  adopted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_flow_adoption_one_initiative_identity
    CHECK (classic_initiative_id = runtime_initiative_id),
  UNIQUE (organization_id, candidate_id),
  UNIQUE (organization_id, classic_initiative_id),
  UNIQUE (organization_id, swot_handoff_receipt_id)
);

CREATE OR REPLACE FUNCTION validate_flow_accepted_classic_runtime_adoption()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM initiative_candidates c
      JOIN initiatives i
        ON i.id = c.initiative_id
       AND i.organization_id = c.organization_id
      JOIN swot_candidate_handoffs h
        ON h.candidate_id = c.id
       AND h.organization_id = c.organization_id
      JOIN tool_outputs o
        ON o.id = h.tool_output_id
       AND o.organization_id = h.organization_id
     WHERE c.id = NEW.candidate_id
       AND c.organization_id = NEW.organization_id
       AND c.status = 'accepted'
       AND c.registered_initiative_id IS NULL
       AND i.id = NEW.classic_initiative_id
       AND i.project_id = NEW.project_id
       AND h.id = NEW.swot_handoff_receipt_id
       AND h.source_revision = NEW.swot_source_revision
       AND h.tool_output_id = NEW.tool_output_id
       AND h.tool_output_version = NEW.tool_output_version
       AND h.tool_output_content_hash = NEW.tool_output_content_hash
       AND o.version = NEW.tool_output_version
       AND o.content_hash = NEW.tool_output_content_hash
       AND o.status = 'approved'
  ) THEN
    RAISE EXCEPTION 'invalid accepted-classic adoption identity graph'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_flow_accepted_classic_runtime_adoption_validate
  ON flow_accepted_classic_runtime_adoptions;
CREATE TRIGGER trg_flow_accepted_classic_runtime_adoption_validate
BEFORE INSERT ON flow_accepted_classic_runtime_adoptions
FOR EACH ROW EXECUTE FUNCTION validate_flow_accepted_classic_runtime_adoption();

CREATE OR REPLACE FUNCTION protect_flow_accepted_classic_runtime_adoption()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'flow_accepted_classic_runtime_adoptions is append-only';
END $$;

DROP TRIGGER IF EXISTS trg_flow_accepted_classic_runtime_adoption_immutable
  ON flow_accepted_classic_runtime_adoptions;
CREATE TRIGGER trg_flow_accepted_classic_runtime_adoption_immutable
BEFORE UPDATE OR DELETE ON flow_accepted_classic_runtime_adoptions
FOR EACH ROW EXECUTE FUNCTION protect_flow_accepted_classic_runtime_adoption();
