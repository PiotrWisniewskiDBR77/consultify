import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const runRealDb =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');
const describeRealDb = runRealDb ? describe : describe.skip;
const prefix = `fin-archive-${randomUUID().slice(0, 8)}`;
const orgA = `${prefix}-org-a`;
const orgB = `${prefix}-org-b`;
const actor = `${prefix}-actor`;
const analysisA = `${prefix}-analysis-a`;
const analysisRollback = `${prefix}-analysis-rollback`;

async function db() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  return client;
}

let service: typeof import('../digitizationAnalysisArchiveCommandService.js');

beforeAll(async () => {
  if (!runRealDb) return;
  const databaseName = new URL(DATABASE_URL).pathname.slice(1);
  if (
    process.env.FIN_ARCHIVE_ALLOW_IMMUTABLE_FIXTURE_CLEANUP !== '1' ||
    !databaseName.startsWith(process.env.FIN_ARCHIVE_DISPOSABLE_DB_PREFIX || 'never-match')
  ) {
    throw new Error(
      'Digitization archive proof requires an explicitly guarded disposable database'
    );
  }
  const client = await db();
  try {
    await client.query(
      `INSERT INTO organizations(id,name) VALUES($1,'Archive A'),($2,'Archive B')`,
      [orgA, orgB]
    );
    await client.query(
      `INSERT INTO users(id,organization_id,email,first_name,last_name,role)
       VALUES($1,$2,$3,'Finance','Owner','ADMIN')`,
      [actor, orgA, `${actor}@test.local`]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
       VALUES($1,$2,$3,'OWNER','ACTIVE',now())`,
      [randomUUID(), orgA, actor]
    );
    await client.query(
      `INSERT INTO digitization_analyses
       (id,name,status,organization_id,created_by,created_at,updated_at)
       VALUES($1,'Preserve me','draft',$2,$3,now(),now()),
             ($4,'Rollback me','draft',$2,$3,now(),now())`,
      [analysisA, orgA, actor, analysisRollback]
    );
  } finally {
    await client.end();
  }
  service = await import('../digitizationAnalysisArchiveCommandService.js');
});

afterAll(async () => {
  if (!runRealDb) return;
  service?.setDigitizationAnalysisArchiveFaultInjectorForTests(null);
  const client = await db();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL session_replication_role=replica`);
    await client.query(
      `DELETE FROM finance_digitization_analysis_archive_receipts WHERE organization_id=ANY($1::text[])`,
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
        ((SELECT count(*) FROM finance_digitization_analysis_archive_receipts WHERE organization_id=ANY($1::text[]))+
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

describeRealDb('ECO-W12 canonical digitization-analysis archive (real PostgreSQL)', () => {
  it('preserves the source graph, writes one immutable receipt and replays exactly', async () => {
    const input = {
      organizationId: orgA,
      userId: actor,
      analysisId: analysisA,
      expectedVersion: 1,
      idempotencyKey: `${prefix}-archive`,
      reason: 'Owner requested removal from active workspace',
    };
    const results = await Promise.all(
      Array.from({ length: 6 }, () => service.archiveDigitizationAnalysisCommand(input))
    );
    expect(results.filter((result) => !result.replay)).toHaveLength(1);
    expect(results.every((result) => result.status === 'ARCHIVED' && result.version === 2)).toBe(
      true
    );
    const client = await db();
    try {
      const readback = await client.query<{
        archived_by: string;
        archive_version: number;
        receipt: number;
      }>(
        `SELECT archived_by,archive_version,
          (SELECT count(*)::int FROM finance_digitization_analysis_archive_receipts
           WHERE organization_id=$2 AND analysis_id=$1) receipt
         FROM digitization_analyses WHERE id=$1 AND organization_id=$2`,
        [analysisA, orgA]
      );
      expect(readback.rows[0]).toEqual({ archived_by: actor, archive_version: 2, receipt: 1 });
      await expect(
        client.query(
          `UPDATE finance_digitization_analysis_archive_receipts SET reason=reason
           WHERE organization_id=$1 AND analysis_id=$2`,
          [orgA, analysisA]
        )
      ).rejects.toMatchObject({ code: '55000' });
    } finally {
      await client.end();
    }
    await expect(
      service.archiveDigitizationAnalysisCommand({ ...input, reason: 'Different payload' })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_COLLISION', status: 409 });
  });

  it('fails closed for a foreign tenant without revealing or mutating the row', async () => {
    await expect(
      service.archiveDigitizationAnalysisCommand({
        organizationId: orgB,
        userId: actor,
        analysisId: analysisRollback,
        expectedVersion: 1,
        idempotencyKey: `${prefix}-foreign`,
        reason: 'Foreign attempt',
      })
    ).rejects.toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED', status: 403 });
  });

  it('rolls the archive marker back if receipt persistence fails', async () => {
    service.setDigitizationAnalysisArchiveFaultInjectorForTests(() => {
      throw new Error('injected receipt failure');
    });
    await expect(
      service.archiveDigitizationAnalysisCommand({
        organizationId: orgA,
        userId: actor,
        analysisId: analysisRollback,
        expectedVersion: 1,
        idempotencyKey: `${prefix}-rollback`,
        reason: 'Rollback proof',
      })
    ).rejects.toThrow('injected receipt failure');
    service.setDigitizationAnalysisArchiveFaultInjectorForTests(null);
    const client = await db();
    try {
      const readback = await client.query<{ archived_at: string | null; archive_version: number }>(
        `SELECT archived_at,archive_version FROM digitization_analyses WHERE id=$1`,
        [analysisRollback]
      );
      expect(readback.rows[0]).toEqual({ archived_at: null, archive_version: 1 });
      expect(
        await client.query(
          `SELECT 1 FROM finance_digitization_analysis_archive_receipts
           WHERE organization_id=$1 AND analysis_id=$2`,
          [orgA, analysisRollback]
        )
      ).toHaveProperty('rowCount', 0);
    } finally {
      await client.end();
    }
  });
});
