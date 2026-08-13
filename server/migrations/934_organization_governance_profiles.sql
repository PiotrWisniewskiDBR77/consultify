BEGIN;
ALTER TABLE ie_governance_policies DROP CONSTRAINT IF EXISTS ie_governance_policies_baseline_check;
UPDATE ie_governance_policies SET baseline='BASELINE_SMALL' WHERE baseline='LITE';
ALTER TABLE ie_governance_policies ADD CONSTRAINT ie_governance_policies_baseline_check CHECK (baseline IN ('BASELINE_SMALL','STANDARD','COMPLEX'));
CREATE TABLE IF NOT EXISTS ie_governance_role_bindings(
 organization_id TEXT NOT NULL, policy_id TEXT NOT NULL, policy_version INTEGER NOT NULL,
 role_key TEXT NOT NULL, principal_id TEXT NOT NULL, project_id TEXT NOT NULL DEFAULT '*',
 delegation_json JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(organization_id,policy_id,policy_version,role_key,principal_id,project_id)
);
COMMIT;
