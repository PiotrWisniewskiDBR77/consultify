import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool, type PoolClient } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const PREFIX = process.env.ADMIN_IAM_ALERT_JOB_TEST_DISPOSABLE_DB_PREFIX ?? '';
const ENABLED = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres') &&
  process.env.ADMIN_IAM_ALERT_JOB_TEST_ALLOW_FIXTURE_CLEANUP === '1' && PREFIX.length > 0;
const suite = ENABLED ? describe : describe.skip;
const RUN = randomUUID().replace(/-/g, '').slice(0, 12);
const ORGS = Array.from({ length: 10 }, (_, i) => `adm-job-${RUN}-${String(i).padStart(2, '0')}`);
const LOCK_KEY = `adm-iam-alert-job-test:${PREFIX}`;
const TICK = '2026-08-18T12:00:00.000Z';

suite('Admin IAM alert evaluation production job (real PostgreSQL)', () => {
  let pool: Pool;
  let client: PoolClient;

  async function assertDisposable(): Promise<void> {
    const result = await client.query<{ db: string }>('SELECT current_database() AS db');
    if (!String(result.rows[0]?.db ?? '').startsWith(PREFIX)) throw new Error('ADMIN_IAM_ALERT_JOB_TEST_DB_MISMATCH');
  }

  async function insertJob(org: string, status: 'succeeded' | 'failed' | 'running', id: string): Promise<void> {
    await client.query(
      `INSERT INTO admin_iam_jobs
        (id,organization_id,job_type,idempotency_key,payload_json,status,lease_expires_at,created_by)
       VALUES($1,$2,'membership_sync',$3,'{}',$4,$5,$6)`,
      [id, org, id, status, status === 'running' ? '2026-08-18T11:00:00.000Z' : null, `${RUN}-actor`],
    );
  }

  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    pool = new Pool({ connectionString: DATABASE_URL });
    client = await pool.connect();
    await assertDisposable();
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [LOCK_KEY]);
  });

  afterAll(async () => {
    if (!client) return;
    try {
      await assertDisposable();
      await client.query('BEGIN');
      await client.query('DELETE FROM operational_alert_delivery_outbox WHERE organization_id = ANY($1)', [ORGS]);
      await client.query('DELETE FROM operational_alert_tenant_states WHERE organization_id = ANY($1)', [ORGS]);
      await client.query('DELETE FROM admin_iam_job_events WHERE organization_id = ANY($1)', [ORGS]);
      await client.query('DELETE FROM admin_iam_jobs WHERE organization_id = ANY($1)', [ORGS]);
      for (const table of ['operational_alert_delivery_outbox','operational_alert_tenant_states','admin_iam_job_events','admin_iam_jobs']) {
        const residue = await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE organization_id = ANY($1)`, [ORGS]);
        expect(residue.rows[0]?.n).toBe(0);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_KEY]).catch(() => undefined);
      client.release();
      await pool.end();
    }
  });

  it('ignores succeeded/recovered noise and reaches high-id actionable and recovery tenants', async () => {
    for (let i = 0; i < 5; i += 1) await insertJob(ORGS[i], 'succeeded', `${RUN}-00-noise-${i}`);
    await insertJob(ORGS[8], 'failed', `${RUN}-zz-failed`);
    await client.query(
      `INSERT INTO operational_alert_tenant_states
       (organization_id,kind,status,latest_value,threshold,correlation_id,evaluator_id,version)
       VALUES($1,'ADMIN_IAM_JOB_STALE','ACTIVE',1,0,$2,$3,1)`,
      [ORGS[9], `${RUN}-recovery`, `${RUN}-seed`],
    );
    const { runAdminIamAlertEvaluationTick } = await import('../adminIamAlertEvaluationJob.js');
    const result = await runAdminIamAlertEvaluationTick({ evaluatorId: `${RUN}-runner`, now: TICK, batchSize: 2 });
    expect(result).toEqual({ candidates: 2, evaluated: 2, failed: 0 });
    const states = await client.query<{ organization_id: string; kind: string; status: string }>(
      `SELECT organization_id,kind,status FROM operational_alert_tenant_states
        WHERE organization_id = ANY($1) ORDER BY organization_id,kind`, [ORGS],
    );
    expect(states.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ organization_id: ORGS[8], kind: 'ADMIN_IAM_JOB_FAILED', status: 'ACTIVE' }),
      expect.objectContaining({ organization_id: ORGS[9], kind: 'ADMIN_IAM_JOB_STALE', status: 'RECOVERED' }),
    ]));
    expect(states.rows.some((row) => ORGS.slice(0, 5).includes(row.organization_id))).toBe(false);
  });

  it('keyset-drains every page so a page size of one cannot starve later actionable tenants', async () => {
    for (let i = 5; i < 8; i += 1) await insertJob(ORGS[i], 'running', `${RUN}-stale-${i}`);
    const { runAdminIamAlertEvaluationTick } = await import('../adminIamAlertEvaluationJob.js');
    const result = await runAdminIamAlertEvaluationTick({ evaluatorId: `${RUN}-fair`, now: TICK, batchSize: 1 });
    expect(result.evaluated).toBeGreaterThanOrEqual(3);
    const reached = await client.query<{ n: number }>(
      `SELECT count(DISTINCT organization_id)::int AS n FROM operational_alert_tenant_states
        WHERE organization_id = ANY($1) AND kind='ADMIN_IAM_JOB_STALE' AND status='ACTIVE'`, [ORGS.slice(5, 8)],
    );
    expect(reached.rows[0]?.n).toBe(3);
  });
});
