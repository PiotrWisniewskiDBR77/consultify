import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const runRealDb =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');
const describeRealDb = runRealDb ? describe : describe.skip;
const prefix = `fin-da-link-${randomUUID().slice(0, 8)}`;
const orgA = `${prefix}-org-a`;
const orgB = `${prefix}-org-b`;
const actor = `${prefix}-actor`;
const projectId = `${prefix}-project`;
const initiativeId = `${prefix}-initiative`;
const analysisId = `${prefix}-analysis`;

async function db() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  return client;
}
let service: typeof import('../digitizationAnalysisInitiativeLinkCommandService.js');

beforeAll(async () => {
  if (!runRealDb) return;
  const name = new URL(DATABASE_URL).pathname.slice(1);
  if (
    process.env.FIN_DA_LINK_ALLOW_CLEANUP !== '1' ||
    !name.startsWith(process.env.FIN_DA_LINK_DB_PREFIX || 'never-match')
  ) {
    throw new Error(
      'Digitization initiative-link proof requires an explicitly guarded disposable DB'
    );
  }
  const client = await db();
  try {
    await client.query(`INSERT INTO organizations(id,name) VALUES($1,'Link A'),($2,'Link B')`, [
      orgA,
      orgB,
    ]);
    await client.query(
      `INSERT INTO users(id,organization_id,email,first_name,last_name,role) VALUES($1,$2,$3,'Link','Owner','ADMIN')`,
      [actor, orgA, `${actor}@test.local`]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at) VALUES($1,$2,$3,'OWNER','ACTIVE',now())`,
      [randomUUID(), orgA, actor]
    );
    await client.query(
      `INSERT INTO projects(id,organization_id,name) VALUES($1,$2,'Link project')`,
      [projectId, orgA]
    );
    await client.query(
      `INSERT INTO initiatives(id,organization_id,project_id,name,title,status) VALUES($1,$2,$3,'Link initiative','Link initiative','DRAFT')`,
      [initiativeId, orgA, projectId]
    );
    await client.query(
      `INSERT INTO digitization_analyses(id,name,status,organization_id,created_by,created_at,updated_at) VALUES($1,'Link analysis','draft',$2,$3,now(),now())`,
      [analysisId, orgA, actor]
    );
  } finally {
    await client.end();
  }
  service = await import('../digitizationAnalysisInitiativeLinkCommandService.js');
});

afterAll(async () => {
  if (!runRealDb) return;
  const client = await db();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL session_replication_role=replica`);
    await client.query(
      `DELETE FROM finance_digitization_analysis_initiative_link_receipts WHERE organization_id=ANY($1::text[])`,
      [[orgA, orgB]]
    );
    await client.query(`DELETE FROM analysis_financials WHERE organization_id=ANY($1::text[])`, [
      [orgA, orgB],
    ]);
    await client.query(`DELETE FROM digitization_analyses WHERE organization_id=ANY($1::text[])`, [
      [orgA, orgB],
    ]);
    await client.query(`DELETE FROM initiatives WHERE organization_id=ANY($1::text[])`, [
      [orgA, orgB],
    ]);
    await client.query(`DELETE FROM projects WHERE organization_id=ANY($1::text[])`, [
      [orgA, orgB],
    ]);
    await client.query(`DELETE FROM organization_members WHERE organization_id=ANY($1::text[])`, [
      [orgA, orgB],
    ]);
    await client.query(`DELETE FROM users WHERE id=$1`, [actor]);
    await client.query(`DELETE FROM organizations WHERE id=ANY($1::text[])`, [[orgA, orgB]]);
    await client.query('COMMIT');
    const state = await client.query<{ residue: string; disabled: string; locks: string }>(
      `SELECT ((SELECT count(*) FROM finance_digitization_analysis_initiative_link_receipts WHERE organization_id=ANY($1::text[]))+(SELECT count(*) FROM analysis_financials WHERE organization_id=ANY($1::text[]))+(SELECT count(*) FROM digitization_analyses WHERE organization_id=ANY($1::text[]))+(SELECT count(*) FROM organizations WHERE id=ANY($1::text[])))::text residue,(SELECT count(*)::text FROM pg_trigger WHERE NOT tgisinternal AND tgenabled <> 'O') disabled,(SELECT count(*)::text FROM pg_locks WHERE locktype='advisory') locks`,
      [[orgA, orgB]]
    );
    expect(state.rows[0]).toEqual({ residue: '0', disabled: '0', locks: '0' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
});

describeRealDb('ECO-W03 canonical digitization-analysis Initiative link (real PostgreSQL)', () => {
  it('atomically links analysis and financials once under concurrent retries', async () => {
    const input = {
      organizationId: orgA,
      userId: actor,
      analysisId,
      initiativeId,
      expectedVersion: 1,
      idempotencyKey: `${prefix}-key`,
    };
    const results = await Promise.all(
      Array.from({ length: 6 }, () => service.linkDigitizationAnalysisInitiativeCommand(input))
    );
    expect(new Set(results.map((result) => result.receiptId))).toHaveLength(1);
    expect(results.filter((result) => !result.replay)).toHaveLength(1);
    const client = await db();
    try {
      expect(
        (
          await client.query(
            `SELECT initiative_id,project_id,command_version FROM digitization_analyses WHERE id=$1`,
            [analysisId]
          )
        ).rows[0]
      ).toEqual({ initiative_id: initiativeId, project_id: projectId, command_version: 2 });
      expect(
        (
          await client.query(
            `SELECT initiative_id,count(*)::int n FROM analysis_financials WHERE analysis_id=$1 GROUP BY initiative_id`,
            [analysisId]
          )
        ).rows
      ).toEqual([{ initiative_id: initiativeId, n: 1 }]);
      await expect(
        client.query(
          `UPDATE finance_digitization_analysis_initiative_link_receipts SET linked_by=linked_by WHERE organization_id=$1`,
          [orgA]
        )
      ).rejects.toMatchObject({ code: '55000' });
    } finally {
      await client.end();
    }
  });

  it('fails closed on stale CAS, payload collision and foreign tenant', async () => {
    await expect(
      service.linkDigitizationAnalysisInitiativeCommand({
        organizationId: orgA,
        userId: actor,
        analysisId,
        initiativeId,
        expectedVersion: 1,
        idempotencyKey: `${prefix}-stale`,
      })
    ).rejects.toMatchObject({ code: 'DIGITIZATION_ANALYSIS_VERSION_CONFLICT', status: 409 });
    await expect(
      service.linkDigitizationAnalysisInitiativeCommand({
        organizationId: orgA,
        userId: actor,
        analysisId,
        initiativeId: `${prefix}-other`,
        expectedVersion: 1,
        idempotencyKey: `${prefix}-key`,
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_COLLISION', status: 409 });
    await expect(
      service.linkDigitizationAnalysisInitiativeCommand({
        organizationId: orgB,
        userId: actor,
        analysisId,
        initiativeId,
        expectedVersion: 2,
        idempotencyKey: `${prefix}-foreign`,
      })
    ).rejects.toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED', status: 403 });
  });
});
