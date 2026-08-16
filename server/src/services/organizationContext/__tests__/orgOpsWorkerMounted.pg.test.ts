/** ORG-OPS-001 — tenant-scoped worker/retry/audit/metrics proof on real PostgreSQL. */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client, Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_DB)('ORG-OPS-001 — mounted worker operations (real PostgreSQL)', () => {
  const suffix = randomUUID().slice(0, 8);
  const makeId = (part: string) => `codex_org_ops_${part}_${suffix}`;
  const orgA = makeId('org_a');
  const orgB = makeId('org_b');
  const ownerA = makeId('owner_a');
  const ownerB = makeId('owner_b');
  const staleA = makeId('stale_a');
  const docA = makeId('doc_a');
  const docB = makeId('doc_b');
  const staleDocA = makeId('stale_doc_a');
  const staleDocB = makeId('stale_doc_b');
  const jobA = makeId('job_a');
  const jobB = makeId('job_b');
  const staleJobA = makeId('stale_job_a');
  const staleJobB = makeId('stale_job_b');

  let pool: Pool;
  let app: Express;
  let ownerAToken = '';
  let ownerBToken = '';
  let staleToken = '';

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: DATABASE_URL });

    for (const [organizationId, name] of [[orgA, 'ORG OPS A'], [orgB, 'ORG OPS B']]) {
      await pool.query(`INSERT INTO organizations (id, name, plan, status) VALUES ($1,$2,'enterprise','active')`, [organizationId, name]);
    }
    for (const [userId, organizationId, membershipStatus] of [
      [ownerA, orgA, 'ACTIVE'],
      [ownerB, orgB, 'ACTIVE'],
      [staleA, orgA, 'INACTIVE'],
    ]) {
      await pool.query(
        `INSERT INTO users (id, organization_id, email, password, role, status)
         VALUES ($1,$2,$3,'unused','OWNER','active')`,
        [userId, organizationId, `${userId}@example.test`]
      );
      await pool.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1,$2,$3,'OWNER',$4)`,
        [makeId(`membership_${userId}`), organizationId, userId, membershipStatus]
      );
    }

    for (const [documentId, organizationId] of [
      [docA, orgA], [docB, orgB], [staleDocA, orgA], [staleDocB, orgB],
    ]) {
      await pool.query(
        `INSERT INTO knowledge_docs
           (id, filename, original_name, filepath, file_hash, version, organization_id, status, scope, owner_id)
         VALUES ($1,$2,$2,$3,$4,1,$5,'uploaded','project',$6)`,
        [documentId, `${documentId}.txt`, `/nonexistent/${documentId}.txt`, 'a'.repeat(64), organizationId, organizationId === orgA ? ownerA : ownerB]
      );
    }
    for (const [jobId, documentId, organizationId, status] of [
      [jobA, docA, orgA, 'queued'],
      [jobB, docB, orgB, 'queued'],
    ]) {
      await pool.query(
        `INSERT INTO organization_context_processing_jobs
           (id, organization_id, user_id, document_id, scope, pipeline_type, status,
            attempt_count, locked_at, locked_by, lease_expires_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,'project','document_text_extraction',$5,0,$6,$7,$6,NOW(),NOW())`,
        [jobId, organizationId, organizationId === orgA ? ownerA : ownerB, documentId, status,
         null, null]
      );
    }

    const { default: config } = await import('../../../config/Config.js');
    const sign = (userId: string, organizationId: string) =>
      jwt.sign({ id: userId, organizationId, role: 'OWNER', email: `${userId}@example.test` }, config.JWT_SECRET, { expiresIn: '10m' });
    ownerAToken = sign(ownerA, orgA);
    ownerBToken = sign(ownerB, orgB);
    staleToken = sign(staleA, orgA);

    const { default: router } = await import('../../../routes/auditLog.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/audit-logs', router);
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM audit_log WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM organization_context_processing_jobs WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM knowledge_docs WHERE id = ANY($1)`, [[docA, docB, staleDocA, staleDocB]]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [[ownerA, ownerB, staleA]]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgA, orgB]]);
    const residue = await pool.query<{ n: number }>(
      `SELECT (SELECT count(*) FROM organization_context_processing_jobs WHERE organization_id = ANY($1))::int +
              (SELECT count(*) FROM users WHERE id = ANY($2))::int AS n`,
      [[orgA, orgB], [ownerA, ownerB, staleA]]
    );
    expect(residue.rows[0]?.n).toBe(0);
    await pool.end();
  }, 60_000);

  it('operator tick retries only its own tenant and records an audit receipt', async () => {
    const response = await request(app)
      .post('/api/audit-logs/organization-context/processing-jobs/run-worker')
      .set(bearer(ownerAToken))
      .send({ confirmation: 'run_context_worker_once', limit: 25 });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ processed: 0, retried: 1, deadLettered: 0, auditRecorded: true });
    expect(response.body.data.errors).toEqual([
      expect.objectContaining({ jobId: jobA, documentId: docA }),
    ]);
    expect(response.body.data.errors[0].errorCode).toMatch(/^enoent/);

    const rows = await pool.query(`SELECT id, status, attempt_count FROM organization_context_processing_jobs WHERE id = ANY($1) ORDER BY id`, [[jobA, jobB]]);
    expect(rows.rows.find((row) => row.id === jobA)).toMatchObject({ status: 'retry_scheduled', attempt_count: 1 });
    expect(rows.rows.find((row) => row.id === jobB)).toMatchObject({ status: 'queued', attempt_count: 0 });
  });

  it('retries deterministically to dead-letter while metrics remain tenant-scoped', async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await request(app)
        .post('/api/audit-logs/organization-context/processing-jobs/run-worker')
        .set(bearer(ownerAToken))
        .send({ confirmation: 'run_context_worker_once', limit: 25 });
      expect(response.status).toBe(200);
    }
    const dead = await pool.query(`SELECT status, attempt_count, error_code FROM organization_context_processing_jobs WHERE id = $1`, [jobA]);
    expect(dead.rows[0]).toMatchObject({ status: 'dead_letter', attempt_count: 3 });
    expect(dead.rows[0].error_code).toMatch(/^enoent/);

    const summaryA = await request(app)
      .get('/api/audit-logs/organization-context/processing-jobs/summary')
      .set(bearer(ownerAToken));
    expect(summaryA.status).toBe(200);
    expect(summaryA.body.data).toMatchObject({ deadLetterCount: 1 });
    expect(summaryA.body.data.statusCounts.queued ?? 0).toBe(0);

    const summaryB = await request(app)
      .get('/api/audit-logs/organization-context/processing-jobs/summary')
      .set(bearer(ownerBToken));
    expect(summaryB.status).toBe(200);
    expect(summaryB.body.data).toMatchObject({ deadLetterCount: 0 });
    expect(summaryB.body.data.statusCounts.queued).toBe(1);
  });

  it('foreign tenant cannot requeue the dead letter; owner can and gets durable audit', async () => {
    const foreign = await request(app)
      .post(`/api/audit-logs/organization-context/processing-jobs/${jobA}/requeue`)
      .set(bearer(ownerBToken))
      .send({ confirmation: 'requeue_context_processing_job' });
    expect(foreign.status).toBe(404);

    const owner = await request(app)
      .post(`/api/audit-logs/organization-context/processing-jobs/${jobA}/requeue`)
      .set(bearer(ownerAToken))
      .send({ confirmation: 'requeue_context_processing_job' });
    expect(owner.status).toBe(200);
    expect(owner.body.data).toMatchObject({ requeued: true, jobId: jobA, status: 'retry_scheduled' });
  });

  it('stale-lock recovery is tenant-scoped and stale membership is denied', async () => {
    const old = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    for (const [jobId, documentId, organizationId, userId] of [
      [staleJobA, staleDocA, orgA, ownerA],
      [staleJobB, staleDocB, orgB, ownerB],
    ]) {
      await pool.query(
        `INSERT INTO organization_context_processing_jobs
           (id, organization_id, user_id, document_id, scope, pipeline_type, status,
            attempt_count, locked_at, locked_by, lease_expires_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,'project','document_text_extraction','claimed',0,$5,'dead-worker',$5,NOW(),NOW())`,
        [jobId, organizationId, userId, documentId, old]
      );
    }

    const recovered = await request(app)
      .post('/api/audit-logs/organization-context/processing-jobs/recover-stale-locks')
      .set(bearer(ownerAToken))
      .send({ confirmation: 'recover_context_stale_locks', staleLockMs: 60_000 });
    expect(recovered.status).toBe(200);
    expect(recovered.body.data.recoveredLocks).toBe(1);

    const locks = await pool.query(`SELECT id, status FROM organization_context_processing_jobs WHERE id = ANY($1)`, [[staleJobA, staleJobB]]);
    expect(locks.rows.find((row) => row.id === staleJobA)?.status).toBe('retry_scheduled');
    expect(locks.rows.find((row) => row.id === staleJobB)?.status).toBe('claimed');

    const stale = await request(app)
      .get('/api/audit-logs/organization-context/processing-jobs/summary')
      .set(bearer(staleToken));
    expect(stale.status).toBe(403);
    expect(stale.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
  });

  it('cold connection sees tenant-only job state and durable operator audit', async () => {
    const cold = new Client({ connectionString: DATABASE_URL });
    await cold.connect();
    const jobs = await cold.query(`SELECT id, organization_id, status, attempt_count FROM organization_context_processing_jobs WHERE id = ANY($1)`, [[jobA, jobB, staleJobA, staleJobB]]);
    const audits = await cold.query(`SELECT organization_id, action_type, resource_id FROM audit_log WHERE organization_id = ANY($1) AND action_type LIKE 'organization_context.%'`, [[orgA, orgB]]);
    await cold.end();

    expect(jobs.rows.find((row) => row.id === jobA)).toMatchObject({ organization_id: orgA, status: 'retry_scheduled', attempt_count: 0 });
    expect(jobs.rows.find((row) => row.id === jobB)).toMatchObject({ organization_id: orgB, status: 'queued', attempt_count: 0 });
    expect(audits.rows.filter((row) => row.organization_id === orgA)).toHaveLength(5);
    expect(audits.rows.filter((row) => row.organization_id === orgB)).toHaveLength(0);
  });
});
