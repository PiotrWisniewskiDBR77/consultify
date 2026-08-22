import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const runRealDb =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');
const describeRealDb = runRealDb ? describe : describe.skip;
const prefix = `fin-da-update-${randomUUID().slice(0, 8)}`;
const orgA = `${prefix}-org-a`;
const orgB = `${prefix}-org-b`;
const actor = `${prefix}-actor`;
const analysisId = `${prefix}-analysis`;

async function db() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  return client;
}

let service: typeof import('../digitizationAnalysisUpdateCommandService.js');

beforeAll(async () => {
  if (!runRealDb) return;
  const name = new URL(DATABASE_URL).pathname.slice(1);
  if (
    process.env.FIN_DA_UPDATE_ALLOW_CLEANUP !== '1' ||
    !name.startsWith(process.env.FIN_DA_UPDATE_DB_PREFIX || 'never-match')
  ) {
    throw new Error('Digitization update proof requires an explicitly guarded disposable DB');
  }
  const client = await db();
  try {
    await client.query(`INSERT INTO organizations(id,name) VALUES($1,'Update A'),($2,'Update B')`, [
      orgA,
      orgB,
    ]);
    await client.query(
      `INSERT INTO users(id,organization_id,email,first_name,last_name,role) VALUES($1,$2,$3,'Update','Owner','ADMIN')`,
      [actor, orgA, `${actor}@test.local`]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at) VALUES($1,$2,$3,'OWNER','ACTIVE',now())`,
      [randomUUID(), orgA, actor]
    );
    await client.query(
      `INSERT INTO digitization_analyses(id,name,status,organization_id,created_by,created_at,updated_at) VALUES($1,'Before','draft',$2,$3,now(),now())`,
      [analysisId, orgA, actor]
    );
  } finally {
    await client.end();
  }
  service = await import('../digitizationAnalysisUpdateCommandService.js');
});

afterAll(async () => {
  if (!runRealDb) return;
  const client = await db();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL session_replication_role=replica`);
    await client.query(
      `DELETE FROM finance_digitization_analysis_update_receipts WHERE organization_id=ANY($1::text[])`,
      [[orgA, orgB]]
    );
    await client.query(`DELETE FROM digitization_analyses WHERE organization_id=ANY($1::text[])`, [
      [orgA, orgB],
    ]);
    await client.query(`DELETE FROM organization_members WHERE organization_id=ANY($1::text[])`, [
      [orgA, orgB],
    ]);
    await client.query(`DELETE FROM users WHERE id=$1`, [actor]);
    await client.query(`DELETE FROM organizations WHERE id=ANY($1::text[])`, [[orgA, orgB]]);
    await client.query('COMMIT');
    const state = await client.query<{ residue: string; disabled: string; locks: string }>(
      `SELECT ((SELECT count(*) FROM finance_digitization_analysis_update_receipts WHERE organization_id=ANY($1::text[]))+(SELECT count(*) FROM digitization_analyses WHERE organization_id=ANY($1::text[]))+(SELECT count(*) FROM organizations WHERE id=ANY($1::text[])))::text residue,(SELECT count(*)::text FROM pg_trigger WHERE NOT tgisinternal AND tgenabled <> 'O') disabled,(SELECT count(*)::text FROM pg_locks WHERE locktype='advisory') locks`,
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

describeRealDb('ECO-W02 canonical digitization-analysis update (real PostgreSQL)', () => {
  it('applies one CAS update and immutable receipt under concurrent retries', async () => {
    const input = {
      organizationId: orgA,
      userId: actor,
      analysisId,
      idempotencyKey: `${prefix}-key`,
      body: {
        expectedVersion: 1,
        name: 'After',
        status: 'REVIEW',
        axisScores: { strategy: 3 },
        overallScore: 67.5,
        completionPercent: 80,
      },
    };
    const results = await Promise.all(
      Array.from({ length: 6 }, () => service.updateDigitizationAnalysisCommand(input))
    );
    expect(new Set(results.map((result) => result.receiptId))).toHaveLength(1);
    expect(results.filter((result) => !result.replay)).toHaveLength(1);
    const client = await db();
    try {
      expect(
        (
          await client.query(
            `SELECT name,status,axis_scores,overall_score,completion_percent,command_version
             FROM digitization_analyses WHERE id=$1`,
            [analysisId]
          )
        ).rows[0]
      ).toEqual({
        name: 'After',
        status: 'in_progress',
        axis_scores: '{"strategy":3}',
        overall_score: 67.5,
        completion_percent: 80,
        command_version: 2,
      });
      await expect(
        client.query(
          `UPDATE finance_digitization_analysis_update_receipts SET updated_by=updated_by WHERE organization_id=$1`,
          [orgA]
        )
      ).rejects.toMatchObject({ code: '55000' });
    } finally {
      await client.end();
    }
  });

  it('fails closed on stale CAS and payload collision', async () => {
    await expect(
      service.updateDigitizationAnalysisCommand({
        organizationId: orgA,
        userId: actor,
        analysisId,
        idempotencyKey: `${prefix}-stale`,
        body: { expectedVersion: 1, name: 'Stale' },
      })
    ).rejects.toMatchObject({ code: 'DIGITIZATION_ANALYSIS_VERSION_CONFLICT', status: 409 });
    await expect(
      service.updateDigitizationAnalysisCommand({
        organizationId: orgA,
        userId: actor,
        analysisId,
        idempotencyKey: `${prefix}-key`,
        body: { expectedVersion: 1, name: 'Different' },
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_COLLISION', status: 409 });
  });

  it('rejects foreign tenant and unknown fields', async () => {
    await expect(
      service.updateDigitizationAnalysisCommand({
        organizationId: orgB,
        userId: actor,
        analysisId,
        idempotencyKey: `${prefix}-foreign`,
        body: { expectedVersion: 2, name: 'Foreign' },
      })
    ).rejects.toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED', status: 403 });
    await expect(
      service.updateDigitizationAnalysisCommand({
        organizationId: orgA,
        userId: actor,
        analysisId,
        idempotencyKey: `${prefix}-unknown`,
        body: { expectedVersion: 2, forbiddenField: true },
      })
    ).rejects.toMatchObject({ code: 'INVALID_UPDATE', status: 400 });
  });
});
