import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgresGovernancePolicyResolver } from '../../../server/src/domain/initiatives-execution/postgresGovernancePolicyResolver';
const url = process.env.IE_TEST_DATABASE_URL?.trim(),
  real = url ? describe : describe.skip;
real('Organization Governance policy resolution realDB', () => {
  const pool = new Pool({ connectionString: url, max: 2 }),
    resolver = new PostgresGovernancePolicyResolver(pool),
    org = 'org-governance';
  beforeAll(async () => {
    for (const f of [
      '932_initiatives_execution_material_commands.sql',
      '934_organization_governance_profiles.sql',
    ])
      await pool.query(await readFile(path.resolve('server/migrations', f), 'utf8'));
  });
  beforeEach(async () => {
    await pool.query(`DELETE FROM ie_governance_role_bindings WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM ie_governance_policies WHERE organization_id=$1`, [org]);
    await pool.query(
      `INSERT INTO ie_governance_policies(organization_id,scope_type,scope_id,policy_id,version,baseline,strictness,config_json,downgrade_decision_id,status)VALUES($1,'ORGANIZATION',$1,'org-small',2,'BASELINE_SMALL',1,'{"enforceGateGovernance":true}'::jsonb,'downgrade-approved','ACTIVE'),($1,'PROJECT','complex-project','project-complex',5,'COMPLEX',3,'{"enforceGateGovernance":true}'::jsonb,NULL,'ACTIVE')`,
      [org]
    );
    await pool.query(
      `INSERT INTO ie_governance_role_bindings(organization_id,policy_id,policy_version,role_key,principal_id,project_id)VALUES($1,'org-small',2,'TEAM_LEAD','boss','*'),($1,'project-complex',5,'BUSINESS_AUTHORITY','business','complex-project'),($1,'project-complex',5,'DOMAIN_AUTHORITY','domain','complex-project')`,
      [org]
    );
  });
  afterAll(async () => pool.end());
  it('uses project override with organization fallback and exact versioned role bindings', async () => {
    const fallback = await resolver.resolve(org, 'small-project'),
      override = await resolver.resolve(org, 'complex-project');
    expect(fallback).toEqual(
      expect.objectContaining({
        policyId: 'org-small',
        version: 2,
        baseline: 'BASELINE_SMALL',
        source: 'ORGANIZATION',
        config: expect.objectContaining({
          roleBindings: [expect.objectContaining({ roleKey: 'TEAM_LEAD', principalId: 'boss' })],
        }),
      })
    );
    expect(override).toEqual(
      expect.objectContaining({
        policyId: 'project-complex',
        version: 5,
        baseline: 'COMPLEX',
        source: 'PROJECT',
        config: expect.objectContaining({
          roleBindings: expect.arrayContaining([
            expect.objectContaining({ principalId: 'business' }),
            expect.objectContaining({ principalId: 'domain' }),
          ]),
        }),
      })
    );
  });
});
