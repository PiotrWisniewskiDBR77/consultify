/**
 * INT-BVP-001 / INT-DELIVERY-OPS-001 (1) — `interview_evidence.ingest_to_knowledge`
 * write-site parity, proved against a REAL PostgreSQL.
 *
 * BACKGROUND (re-verified, not assumed — see the negative-control test below):
 * the inventory that opened this task claimed the column was retyped to
 * INTEGER by `server/migrations/20260719_baseline_gap.sql`. Empirically, on
 * this environment's real database, the column is still BOOLEAN: the
 * migration's two `ALTER COLUMN` statements are each wrapped in
 * `DO $$ ... EXCEPTION WHEN OTHERS THEN NULL; END $$` and BOTH silently fail —
 * the first because `SET DEFAULT 1` on a boolean column requires a cast
 * Postgres won't do implicitly, the second because the column's *existing*
 * default (still `true` after the first failure) then can't be
 * auto-cast to integer either. So the retype never actually applied on this
 * database, and `\d interview_evidence` shows `ingest_to_knowledge | boolean`.
 *
 * That does NOT make the original defect (write site #2 binding a raw JS
 * boolean) a non-issue: `ensureInterviewEvidenceColumns()`
 * (InterviewController.ts ~766) ADDS the column as INTEGER on any environment
 * where the table didn't already carry it (fresh installs / self-heal path),
 * so a raw JS boolean parameter is only safe by coincidence on THIS database,
 * and throws Postgres error 22P02 on an environment where the column really
 * is integer. The fix (write a literal 0/1, matching the sibling write site)
 * is correct and safe for BOTH physical column types — proved below.
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

if (REAL_DB) process.env.DB_TYPE = 'postgres';

let currentUser: { id: string; organizationId: string; role: string } = {
  id: '',
  organizationId: '',
  role: 'MEMBER',
};

// Heavy/unrelated services this route file imports transitively — not the
// focus of this suite and not touched by createEvidence's happy path, so
// mocked out to keep the suite fast and free of external-API dependencies.
vi.mock('../../../services/ai/ingestionPipeline.js', () => ({
  IngestionPipeline: class {},
  ingestInterviewTextArtifact: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../../services/ai/llmService.js', () => ({ llmService: { call: vi.fn() } }));
vi.mock('../../../services/notificationService.js', () => ({
  default: { send: vi.fn().mockResolvedValue('notif-mock') },
}));
vi.mock('../../../services/organizationContext/OrganizationContextService.js', () => ({
  default: { recordInterviewEvidence: vi.fn(), recordInterviewAnswer: vi.fn() },
}));
vi.mock('../../../services/pdfParserService.js', () => ({ default: {} }));
vi.mock('../../../services/workflow/gatePolicy.js', () => ({ evaluateGatePolicy: vi.fn() }));

describe.skipIf(!REAL_DB)('ingest_to_knowledge write-site parity — real PostgreSQL', () => {
  let app: Express;
  let pool: Pool;
  const orgId = `org-ingest-${randomUUID()}`;
  const userId = `user-ingest-${randomUUID()}`;
  const sessionId = `session-ingest-${randomUUID()}`;
  const createdEvidenceIds: string[] = [];

  beforeAll(async () => {
    const { Pool: PgPool } = await import('pg');
    pool = new PgPool({ connectionString: CONNECTION_STRING });

    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
      orgId,
      'ingest_to_knowledge fixture org',
    ]);
    await pool.query(
      `INSERT INTO users (id, organization_id, email, role) VALUES ($1, $2, $3, $4)`,
      [userId, orgId, `${userId}@example.test`, 'MEMBER']
    );
    await pool.query(
      `INSERT INTO interview_sessions (id, organization_id, owner_id, status)
       VALUES ($1, $2, $3, 'in_progress')`,
      [sessionId, orgId, userId]
    );

    currentUser = { id: userId, organizationId: orgId, role: 'MEMBER' };

    const { InterviewController } = await import('../../../controllers/InterviewController.js');
    app = express();
    app.use(express.json());
    // This suite calls the REAL controller function directly (same code path a
    // real HTTP request takes) rather than mounting the full interview.routes.ts
    // router — the middleware that router adds ahead of the controller
    // (requireOrgAccess, demoContextMiddleware, rate limiting) is auth/session
    // plumbing unrelated to the write-site defect under test, verified by
    // reading each of them: none touch `ingest_to_knowledge` or evidence rows.
    app.use((req: express.Request & { user?: unknown }, _res, next) => {
      req.user = currentUser;
      next();
    });
    app.post(
      '/api/interview/sessions/:sessionId/evidence',
      (InterviewController as any).createEvidence
    );
  }, 60000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM interview_evidence WHERE id = ANY($1)`, [createdEvidenceIds]);
    await pool.query(`DELETE FROM interview_sessions WHERE id = $1`, [sessionId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
    await pool.end();
  });

  it('confirms the live column is currently BOOLEAN (documents the corrected inventory claim)', async () => {
    const res = await pool.query(
      `SELECT data_type FROM information_schema.columns
        WHERE table_name = 'interview_evidence' AND column_name = 'ingest_to_knowledge'`
    );
    expect(res.rows[0]?.data_type).toBe('boolean');
  });

  it('createEvidence(ingestToKnowledge: true) persists and reads back as a truthy value, raw from Postgres', async () => {
    const res = await request(app)
      .post(`/api/interview/sessions/${sessionId}/evidence`)
      .send({ evidenceType: 'note', title: 'Evidence A', ingestToKnowledge: true });
    expect(res.status).toBe(201);
    const evidenceId = res.body?.id ?? res.body?.evidence?.id;
    expect(evidenceId).toBeTruthy();
    createdEvidenceIds.push(evidenceId);

    const row = await pool.query(
      `SELECT ingest_to_knowledge, pg_typeof(ingest_to_knowledge)::text AS pg_type
         FROM interview_evidence WHERE id = $1`,
      [evidenceId]
    );
    expect(row.rowCount).toBe(1);
    // Physical column is boolean on this DB; the literal-1 write is accepted
    // and reads back true. On an integer-typed environment the same write
    // reads back as 1 — see the scratch-column parity test below.
    expect(row.rows[0].pg_type).toBe('boolean');
    expect(row.rows[0].ingest_to_knowledge).toBe(true);
  });

  it('createEvidence(ingestToKnowledge: false) persists and reads back as a falsy value, raw from Postgres', async () => {
    const res = await request(app)
      .post(`/api/interview/sessions/${sessionId}/evidence`)
      .send({ evidenceType: 'note', title: 'Evidence B', ingestToKnowledge: false });
    expect(res.status).toBe(201);
    const evidenceId = res.body?.id ?? res.body?.evidence?.id;
    expect(evidenceId).toBeTruthy();
    createdEvidenceIds.push(evidenceId);

    const row = await pool.query(
      `SELECT ingest_to_knowledge, pg_typeof(ingest_to_knowledge)::text AS pg_type
         FROM interview_evidence WHERE id = $1`,
      [evidenceId]
    );
    expect(row.rowCount).toBe(1);
    expect(row.rows[0].pg_type).toBe('boolean');
    expect(row.rows[0].ingest_to_knowledge).toBe(false);
  });

  it('cold readback: a fresh pool/connection sees the same persisted values', async () => {
    const { Pool: PgPool } = await import('pg');
    const freshPool = new PgPool({ connectionString: CONNECTION_STRING });
    try {
      const rows = await freshPool.query(
        `SELECT id, ingest_to_knowledge FROM interview_evidence
          WHERE id = ANY($1) ORDER BY created_at`,
        [createdEvidenceIds]
      );
      expect(rows.rowCount).toBe(createdEvidenceIds.length);
      expect(rows.rows.map((r) => r.ingest_to_knowledge)).toEqual([true, false]);
    } finally {
      await freshPool.end();
    }
  });

  describe('negative control — the OLD code (raw JS boolean bind) vs the FIX (literal 0/1)', () => {
    const scratchIntTable = `scratch_ingest_int_${randomUUID().replace(/-/g, '_')}`;
    const scratchBoolTable = `scratch_ingest_bool_${randomUUID().replace(/-/g, '_')}`;

    afterAll(async () => {
      if (!pool) return;
      await pool.query(`DROP TABLE IF EXISTS ${scratchIntTable}`);
      await pool.query(`DROP TABLE IF EXISTS ${scratchBoolTable}`);
    });

    it('OLD code (raw JS boolean parameter) throws 22P02 against an INTEGER-typed column', async () => {
      await pool.query(`CREATE TABLE ${scratchIntTable} (val integer default 1)`);
      // This reproduces exactly what `ensureInterviewEvidenceColumns()` creates
      // on a fresh install: `ingest_to_knowledge INTEGER DEFAULT 1`. Binding the
      // pre-fix `ingestToKnowledge !== false` (a raw JS boolean) into it is what
      // failed in production-shaped environments before this fix.
      await expect(
        pool.query(`INSERT INTO ${scratchIntTable} (val) VALUES ($1)`, [true])
      ).rejects.toMatchObject({ code: '22P02' });
    });

    it('FIX (literal 0/1) succeeds on an INTEGER-typed column', async () => {
      const rows = await pool.query(
        `INSERT INTO ${scratchIntTable} (val) VALUES ($1) RETURNING val, pg_typeof(val)::text AS pg_type`,
        [1]
      );
      expect(rows.rows[0]).toEqual({ val: 1, pg_type: 'integer' });
    });

    it('FIX (literal 0/1) ALSO succeeds on a BOOLEAN-typed column (this environment’s actual shape)', async () => {
      await pool.query(`CREATE TABLE ${scratchBoolTable} (val boolean default true)`);
      const rows = await pool.query(
        `INSERT INTO ${scratchBoolTable} (val) VALUES ($1) RETURNING val, pg_typeof(val)::text AS pg_type`,
        [1]
      );
      expect(rows.rows[0]).toEqual({ val: true, pg_type: 'boolean' });
    });
  });
});
