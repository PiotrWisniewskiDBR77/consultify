import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  GovernancePolicyResolutionError,
  PostgresGovernancePolicyResolver,
} from '../../../server/src/domain/initiatives-execution/postgresGovernancePolicyResolver';

const databaseUrl = process.env.DATABASE_URL?.trim();
const describeRealDb = databaseUrl ? describe : describe.skip;

describeRealDb('governance policy PostgreSQL resolution', () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 3 });
  const resolver = new PostgresGovernancePolicyResolver(pool);

  beforeAll(async () => {
    for (const migrationName of [
      '932_initiatives_execution_material_commands.sql',
      '934_organization_governance_profiles.sql',
    ]) {
      await pool.query(await readFile(path.resolve('server/migrations', migrationName), 'utf8'));
    }
  });
  beforeEach(async () => {
    await pool.query(`DELETE FROM ie_governance_policies WHERE organization_id <> '*'`);
  });
  afterAll(async () => pool.end());

  const insert = async (
    scopeType: 'ORGANIZATION' | 'PROJECT',
    scopeId: string,
    policyId: string,
    strictness: number,
    downgradeDecisionId: string | null = null
  ) => {
    await pool.query(
      `INSERT INTO ie_governance_policies
        (organization_id, scope_type, scope_id, policy_id, version, baseline, strictness,
         downgrade_decision_id, config_json)
       VALUES ('nordwerk-e2e',$1,$2,$3,1,$4,$5,$6,'{"selfApproval":false}'::jsonb)`,
      [
        scopeType,
        scopeId,
        policyId,
        strictness === 1 ? 'BASELINE_SMALL' : strictness === 3 ? 'COMPLEX' : 'STANDARD',
        strictness,
        downgradeDecisionId,
      ]
    );
  };

  it('resolves product -> organization -> stricter project override', async () => {
    await insert('ORGANIZATION', 'nordwerk-e2e', 'nordwerk-standard', 2);
    await insert('PROJECT', 'operations-transformation-2027', 'standard-industrial', 3);
    await expect(
      resolver.resolve('nordwerk-e2e', 'operations-transformation-2027')
    ).resolves.toMatchObject({
      policyId: 'standard-industrial',
      version: 1,
      strictness: 3,
      source: 'PROJECT',
    });
  });

  it('fails closed when a project lowers strictness without an authorized Decision', async () => {
    await insert('ORGANIZATION', 'nordwerk-e2e', 'nordwerk-complex', 3);
    await insert('PROJECT', 'operations-transformation-2027', 'project-lite', 1);
    await expect(
      resolver.resolve('nordwerk-e2e', 'operations-transformation-2027')
    ).rejects.toBeInstanceOf(GovernancePolicyResolutionError);
  });

  it('accepts an explicit downgrade only when its Decision reference is persisted', async () => {
    await insert('ORGANIZATION', 'nordwerk-e2e', 'nordwerk-complex', 3);
    await insert(
      'PROJECT',
      'operations-transformation-2027',
      'project-standard',
      2,
      'decision-downgrade-001'
    );
    await expect(
      resolver.resolve('nordwerk-e2e', 'operations-transformation-2027')
    ).resolves.toMatchObject({ policyId: 'project-standard', strictness: 2 });
  });
});
