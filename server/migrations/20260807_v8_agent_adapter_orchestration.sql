CREATE TABLE IF NOT EXISTS v8_agent_adapter_invocations (
  invocation_id TEXT PRIMARY KEY,
  canonical_run_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  transformation_case_id TEXT NOT NULL,
  adapter_key TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  input_digest TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running','succeeded','failed','compensation_required','compensated')),
  canonical_artifact_type TEXT,
  canonical_artifact_id TEXT,
  normalized_result_json JSONB,
  readback_digest TEXT,
  failure_code TEXT,
  compensation_policy TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (organization_id, canonical_run_id, adapter_key, idempotency_key)
);

ALTER TABLE v8_agent_adapter_invocations ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_v8_agent_adapter_run
  ON v8_agent_adapter_invocations (organization_id, canonical_run_id, created_at);

INSERT INTO wave8_agent_definitions
  (agent_id,organization_id,name,role,purpose,persona,allowed_tools_json,blocked_tools_json,
   source_scope_json,output_schema_json,approval_policy,cost_class,risk_level,editable)
VALUES
  ('consultify:teresa:transformation-agent',NULL,'Teresa Transformation Agent',
   'transformation_orchestrator','Execute approved Transformation Case work through governed adapters',
   'Teresa operates as the accountable Consultify transformation agent.',
   '["transformation.ideas.materialize","transformation.interviews.materialize","transformation.drd.materialize","transformation.initiative_candidate.materialize","transformation.finance_kpi.materialize","transformation.portfolio_decision.materialize","transformation.mobilization.materialize","transformation.initiative_lifecycle.transition","transformation.gate.initiative_results.accept","transformation.gate.finance_kpi_results.accept","transformation.gate.portfolio_decision_results.accept","transformation.gate.mobilization_results.accept","transformation.gate.execution_start.accept","transformation.gate.execution_results.accept","transformation.gate.delivery_handoff.accept","transformation.gate.benefits_review.accept","transformation.gate.sustainability_review.accept","transformation.final_outputs.publish"]',
   '[]','["transformation_case"]','{}','A05 approval plus A06 execution policy',
   'medium','high',0)
ON CONFLICT (agent_id) DO NOTHING;

WITH tool_defs(name,description,risk_class,mutation_type) AS (VALUES
  ('transformation.ideas.materialize','Materialize approved Ideas proposal','medium_risk','bounded_write'),
  ('transformation.interviews.materialize','Materialize approved Interview assignments','medium_risk','bounded_write'),
  ('transformation.drd.materialize','Materialize approved DRD assessment','medium_risk','bounded_write'),
  ('transformation.initiative_candidate.materialize','Materialize approved Initiative Candidate','medium_risk','bounded_write'),
  ('transformation.finance_kpi.materialize','Materialize approved Finance and KPI pack','high_risk','workflow_mutation'),
  ('transformation.portfolio_decision.materialize','Materialize approved portfolio decision','high_risk','workflow_mutation'),
  ('transformation.mobilization.materialize','Apply approved mobilization blueprint','high_risk','workflow_mutation'),
  ('transformation.initiative_lifecycle.transition','Apply an approved canonical Initiative lifecycle transition','high_risk','workflow_mutation'),
  ('transformation.gate.initiative_results.accept','Accept Initiative results gate','medium_risk','workflow_mutation'),
  ('transformation.gate.finance_kpi_results.accept','Accept Finance and KPI results gate','high_risk','workflow_mutation'),
  ('transformation.gate.portfolio_decision_results.accept','Accept portfolio decision results gate','high_risk','workflow_mutation'),
  ('transformation.gate.mobilization_results.accept','Accept mobilization results gate','high_risk','workflow_mutation'),
  ('transformation.gate.execution_start.accept','Accept execution start gate','high_risk','workflow_mutation'),
  ('transformation.gate.execution_results.accept','Accept execution results gate','high_risk','workflow_mutation'),
  ('transformation.gate.delivery_handoff.accept','Accept delivery and benefits handoff','high_risk','workflow_mutation'),
  ('transformation.gate.benefits_review.accept','Accept benefits review gate','high_risk','workflow_mutation'),
  ('transformation.gate.sustainability_review.accept','Accept sustainability review gate','high_risk','workflow_mutation'),
  ('transformation.final_outputs.publish','Publish approved final DOCX and PPTX outputs','high_risk','bounded_write')
)
INSERT INTO v8_tool_catalog
  (tool_id,organization_id,name,description,category,risk_class,mutation_type,
   classification_status,default_approval_mode,classified_by,classified_at,version,created_at,updated_at)
SELECT 'a06-t01:' || o.id || ':' || replace(d.name,'.',':'),o.id,d.name,d.description,
       'workflow_action',d.risk_class,d.mutation_type,'ratified','policy_approvable',
       'system:a06-t01',CURRENT_TIMESTAMP,'1.0.0',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
  FROM organizations o CROSS JOIN tool_defs d
ON CONFLICT (tool_id) DO NOTHING;

INSERT INTO v8_consumer_tool_policies
  (policy_id,organization_id,project_id,consumer_class,tool_id,allowed,
   approval_override,max_invocations_per_run,effective_from,created_at,updated_at)
SELECT 'a06-t01-policy:' || organization_id || ':' || replace(name,'.',':'),
       organization_id,NULL,'execution',tool_id,1,'force_policy_gate',64,CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
  FROM v8_tool_catalog
 WHERE tool_id LIKE 'a06-t01:%'
ON CONFLICT (policy_id) DO NOTHING;
