import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const runRealDb =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');
const describeRealDb = runRealDb ? describe : describe.skip;
const prefix = `fin-da-register-${randomUUID().slice(0, 8)}`;
const orgA = `${prefix}-org-a`;
const orgB = `${prefix}-org-b`;
const actor = `${prefix}-actor`;

async function db() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  return client;
}

let service: typeof import('../digitizationAnalysisRegistrationService.js');

beforeAll(async () => {
  if (!runRealDb) return;
  const name = new URL(DATABASE_URL).pathname.slice(1);
  if (
    process.env.FIN_DA_REGISTER_ALLOW_CLEANUP !== '1' ||
    !name.startsWith(process.env.FIN_DA_REGISTER_DB_PREFIX || 'never-match')
  ) {
    throw new Error('Digitization registration proof requires an explicitly guarded disposable DB');
  }
  const client = await db();
  try {
    await client.query(
      `INSERT INTO organizations(id,name) VALUES($1,'Register A'),($2,'Register B')`,
      [orgA, orgB]
    );
    await client.query(
      `INSERT INTO users(id,organization_id,email,first_name,last_name,role)
       VALUES($1,$2,$3,'Register','Owner','ADMIN')`,
      [actor, orgA, `${actor}@test.local`]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
       VALUES($1,$2,$3,'OWNER','ACTIVE',now())`,
      [randomUUID(), orgA, actor]
    );
  } finally {
    await client.end();
  }
  service = await import('../digitizationAnalysisRegistrationService.js');
});

afterAll(async () => {
  if (!runRealDb) return;
  const client = await db();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL session_replication_role=replica`);
    await client.query(
      `DELETE FROM finance_digitization_analysis_registration_receipts
       WHERE organization_id=ANY($1::text[])`,
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
      `SELECT
        ((SELECT count(*) FROM finance_digitization_analysis_registration_receipts WHERE organization_id=ANY($1::text[]))+
         (SELECT count(*) FROM digitization_analyses WHERE organization_id=ANY($1::text[]))+
         (SELECT count(*) FROM organizations WHERE id=ANY($1::text[])))::text residue,
        (SELECT count(*)::text FROM pg_trigger WHERE NOT tgisinternal AND tgenabled <> 'O') disabled,
        (SELECT count(*)::text FROM pg_locks WHERE locktype='advisory') locks`,
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

describeRealDb('ECO-W01 canonical digitization-analysis registration (real PostgreSQL)', () => {
  const body = {
    name: 'MyWork analysis',
    description: 'Converted from governed source',
    analysisType: 'financial',
    sourceType: 'tool_session',
    sourceId: `${prefix}-session`,
  };

  it('creates one analysis and immutable receipt under concurrent retries', async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        service.registerDigitizationAnalysis({
          organizationId: orgA,
          userId: actor,
          idempotencyKey: `${prefix}-key`,
          body,
        })
      )
    );
    expect(new Set(results.map((result) => result.id))).toHaveLength(1);
    expect(results.filter((result) => !result.replay)).toHaveLength(1);
    const client = await db();
    try {
      const state = await client.query<{ analyses: number; receipts: number }>(
        `SELECT
          (SELECT count(*)::int FROM digitization_analyses WHERE organization_id=$1) analyses,
          (SELECT count(*)::int FROM finance_digitization_analysis_registration_receipts
           WHERE organization_id=$1) receipts`,
        [orgA]
      );
      expect(state.rows[0]).toEqual({ analyses: 1, receipts: 1 });
      await expect(
        client.query(
          `UPDATE finance_digitization_analysis_registration_receipts SET source_id=source_id
           WHERE organization_id=$1`,
          [orgA]
        )
      ).rejects.toMatchObject({ code: '55000' });
    } finally {
      await client.end();
    }
  });

  it('deduplicates the same source across a different transport key', async () => {
    const replay = await service.registerDigitizationAnalysis({
      organizationId: orgA,
      userId: actor,
      idempotencyKey: `${prefix}-second-key`,
      body,
    });
    expect(replay).toMatchObject({ replay: true, name: body.name });
  });

  it('fails closed on key collision, foreign tenant and unknown fields', async () => {
    await expect(
      service.registerDigitizationAnalysis({
        organizationId: orgA,
        userId: actor,
        idempotencyKey: `${prefix}-key`,
        body: { ...body, name: 'Different' },
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_COLLISION', status: 409 });
    await expect(
      service.registerDigitizationAnalysis({
        organizationId: orgB,
        userId: actor,
        idempotencyKey: `${prefix}-foreign`,
        body,
      })
    ).rejects.toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED', status: 403 });
    await expect(
      service.registerDigitizationAnalysis({
        organizationId: orgA,
        userId: actor,
        idempotencyKey: `${prefix}-unknown`,
        body: { ...body, status: 'completed' },
      })
    ).rejects.toMatchObject({ code: 'INVALID_REGISTRATION', status: 400 });
  });
});
