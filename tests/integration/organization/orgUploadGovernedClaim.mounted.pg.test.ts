import { createHash, randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Pool, type PoolClient } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres.js';

// tests/setup.ts provides a generic multipart stand-in that exposes the whole
// request envelope as `buffer`. This mounted route proof needs production
// Multer semantics so file_hash is bound to the uploaded bytes themselves.
vi.unmock('multer');

const commitControl = vi.hoisted(() => ({ failNext: false }));
vi.mock('../../../server/src/database/PostgresDatabase.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, any>>();
  return {
    ...actual,
    getPoolClientForPinnedTransaction: async () => {
      const client = await actual.getPoolClientForPinnedTransaction();
      return new Proxy(client, {
        get(target, property) {
          if (property === 'query') {
            return async (sql: unknown, params?: unknown[]) => {
              if (commitControl.failNext && String(sql).trim().toUpperCase() === 'COMMIT') {
                commitControl.failNext = false;
                await target.query('ROLLBACK');
                throw new Error('forced commit failure after rollback');
              }
              return target.query(sql as any, params as any);
            };
          }
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    },
  };
});

vi.mock('../../../server/src/services/ragService.js', () => ({
  default: { generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]) },
}));

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_DB)('ORG-UI upload -> governed claim mounted seam', () => {
  const run = randomUUID().slice(0, 8);
  const id = (part: string) => `org_ui_upload_${part}_${run}`;
  const orgA = id('org_a');
  const orgB = id('org_b');
  const ownerA = id('owner_a');
  const ownerB = id('owner_b');
  const filenameA = `${id('source_a')}.txt`;
  const filenameB = `${id('source_b')}.txt`;
  const commitFailureFilename = `${id('commit_failure')}.txt`;
  const fixtureFilenames = [filenameA, filenameB, commitFailureFilename];
  let pool: Pool;
  let lockClient: PoolClient;
  let app: Express;
  let tokenA = '';
  let tokenB = '';
  let claimA = '';

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: DATABASE_URL, max: 3 });
    lockClient = await pool.connect();
    const db = await lockClient.query<{ name: string }>('SELECT current_database() AS name');
    expect(db.rows[0]?.name).toMatch(/^consultify_org_/);
    await lockClient.query(`SELECT pg_advisory_lock(hashtext('org-ui-upload-mounted'))`);
    for (const [org, name] of [[orgA, 'ORG upload A'], [orgB, 'ORG upload B']]) {
      await pool.query(`INSERT INTO organizations(id,name,plan,status) VALUES($1,$2,'enterprise','active')`, [org, name]);
    }
    for (const [user, org] of [[ownerA, orgA], [ownerB, orgB]]) {
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,'unused','OWNER','active')`,
        [user, org, `${user}@example.test`]
      );
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE')`,
        [id(`membership_${user}`), org, user]
      );
    }
    const { default: config } = await import('../../../server/src/config/Config.js');
    const sign = (user: string, org: string) =>
      jwt.sign({ id: user, organizationId: org, role: 'OWNER', email: `${user}@example.test` }, config.JWT_SECRET, { expiresIn: '10m' });
    tokenA = sign(ownerA, orgA);
    tokenB = sign(ownerB, orgB);

    const [{ default: aiRouter }, { default: orgRouter }] = await Promise.all([
      import('../../../server/src/routes/ai.routes.js'),
      import('../../../server/src/routes/organization-context.routes.js'),
    ]);
    app = express();
    app.use(express.json());
    app.use('/api/ai', aiRouter);
    app.use('/api/organization-context', orgRouter);
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    const cleanup = await pool.connect();
    try {
      await cleanup.query('BEGIN');
      const trigger = await cleanup.query<{ tgenabled: string }>(
        `SELECT tgenabled FROM pg_trigger
          WHERE tgrelid='organization_context_upload_receipts'::regclass
            AND tgname='trg_org_context_upload_receipt_immutable' AND NOT tgisinternal`
      );
      expect(trigger.rows).toEqual([{ tgenabled: 'O' }]);
      await cleanup.query(
        `ALTER TABLE organization_context_upload_receipts DISABLE TRIGGER trg_org_context_upload_receipt_immutable`
      );
      await cleanup.query(`DELETE FROM organization_context_upload_receipts WHERE organization_id=ANY($1)`, [[orgA, orgB]]);
      await cleanup.query(
        `ALTER TABLE organization_context_upload_receipts ENABLE TRIGGER trg_org_context_upload_receipt_immutable`
      );
      await cleanup.query(`DELETE FROM organization_context_snapshot_versions WHERE organization_id=ANY($1)`, [[orgA, orgB]]);
      await cleanup.query(`DELETE FROM organization_context_claim_reviews WHERE organization_id=ANY($1)`, [[orgA, orgB]]);
      await cleanup.query(`DELETE FROM organization_context_claims WHERE organization_id=ANY($1)`, [[orgA, orgB]]);
      await cleanup.query(`DELETE FROM organization_context_items WHERE organization_id=ANY($1)`, [[orgA, orgB]]);
      await cleanup.query(`DELETE FROM organization_context_snapshots WHERE organization_id=ANY($1)`, [[orgA, orgB]]);
      await cleanup.query(`DELETE FROM knowledge_chunks WHERE doc_id IN (SELECT id FROM knowledge_docs WHERE organization_id=ANY($1) AND filename=ANY($2))`, [[orgA, orgB], fixtureFilenames]);
      await cleanup.query(`DELETE FROM knowledge_docs WHERE organization_id=ANY($1) AND filename=ANY($2)`, [[orgA, orgB], fixtureFilenames]);
      await cleanup.query(`DELETE FROM organization_members WHERE organization_id=ANY($1)`, [[orgA, orgB]]);
      await cleanup.query(`DELETE FROM users WHERE id=ANY($1)`, [[ownerA, ownerB]]);
      await cleanup.query(`DELETE FROM organizations WHERE id=ANY($1)`, [[orgA, orgB]]);
      await cleanup.query('COMMIT');
    } catch (error) {
      await cleanup.query('ROLLBACK');
      throw error;
    } finally {
      cleanup.release();
    }
    const residue = await pool.query<{ n: number }>(
      `SELECT
        (SELECT count(*) FROM organizations WHERE id=ANY($1))::int +
        (SELECT count(*) FROM users WHERE id=ANY($2))::int +
        (SELECT count(*) FROM organization_members WHERE organization_id=ANY($1))::int +
        (SELECT count(*) FROM organization_context_items WHERE organization_id=ANY($1))::int +
        (SELECT count(*) FROM organization_context_claims WHERE organization_id=ANY($1))::int +
        (SELECT count(*) FROM organization_context_claim_reviews WHERE organization_id=ANY($1))::int +
        (SELECT count(*) FROM organization_context_snapshots WHERE organization_id=ANY($1))::int +
        (SELECT count(*) FROM organization_context_snapshot_versions WHERE organization_id=ANY($1))::int +
        (SELECT count(*) FROM organization_context_upload_receipts WHERE organization_id=ANY($1))::int +
        (SELECT count(*) FROM knowledge_chunks WHERE doc_id IN (SELECT id FROM knowledge_docs WHERE filename=ANY($3)))::int +
        (SELECT count(*) FROM knowledge_docs WHERE filename=ANY($3))::int AS n`,
      [[orgA, orgB], [ownerA, ownerB], fixtureFilenames]
    );
    expect(residue.rows[0]?.n).toBe(0);
    expect(
      (
        await pool.query<{ tgenabled: string }>(
          `SELECT tgenabled FROM pg_trigger
            WHERE tgrelid='organization_context_upload_receipts'::regclass
              AND tgname='trg_org_context_upload_receipt_immutable' AND NOT tgisinternal`
        )
      ).rows
    ).toEqual([{ tgenabled: 'O' }]);
    await lockClient.query(`SELECT pg_advisory_unlock(hashtext('org-ui-upload-mounted'))`);
    lockClient.release();
    await pool.end();
  }, 60_000);

  it('denies missing identity and an immediately revoked membership without writes', async () => {
    const unauth = await request(app)
      .post('/api/ai/attachments/ingest')
      .attach('file', Buffer.from('unauthorized'), { filename: filenameA, contentType: 'text/plain' });
    expect(unauth.status).toBe(401);

    await pool.query(`UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`, [orgA, ownerA]);
    const before = await pool.query<{ docs: number; claims: number }>(
      `SELECT
        (SELECT count(*)::int FROM knowledge_docs WHERE organization_id=$1 AND filename=$2) docs,
        (SELECT count(*)::int FROM organization_context_claims WHERE organization_id=$1) claims`,
      [orgA, filenameA]
    );
    const revoked = await request(app)
      .post('/api/ai/attachments/ingest')
      .set(bearer(tokenA))
      .attach('file', Buffer.from('revoked'), { filename: filenameA, contentType: 'text/plain' });
    expect(revoked.status).toBe(403);
    const after = await pool.query<{ docs: number; claims: number }>(
      `SELECT
        (SELECT count(*)::int FROM knowledge_docs WHERE organization_id=$1 AND filename=$2) docs,
        (SELECT count(*)::int FROM organization_context_claims WHERE organization_id=$1) claims`,
      [orgA, filenameA]
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
    await pool.query(`UPDATE organization_members SET status='ACTIVE' WHERE organization_id=$1 AND user_id=$2`, [orgA, ownerA]);
  });

  it('preserves the default DbPromise caller placeholder contract', async () => {
    const { default: service } = await import(
      '../../../server/src/services/organizationContext/OrganizationContextService.js'
    );
    const sourceId = id('default_writer');
    const result = await service.recordContextSource({
      organizationId: orgA,
      sourceType: 'organization_metadata',
      sourceId,
      content: { key: 'default-writer-regression', value: true },
      rebuildSnapshot: false,
    });
    expect(
      (
        await pool.query(
          `SELECT source_id FROM organization_context_items
            WHERE id=$1 AND organization_id=$2`,
          [result.itemId, orgA]
        )
      ).rows[0]?.source_id
    ).toBe(sourceId);
  });

  it('ingests in each caller tenant without body spoofing or cross-tenant claim leakage', async () => {
    const keyA = id('idem_a');
    const concurrent = await Promise.all(
      Array.from({ length: 8 }, () =>
        request(app)
          .post('/api/ai/attachments/ingest')
          .set(bearer(tokenA))
          .set('Idempotency-Key', keyA)
          .attach('file', Buffer.from('Organization A governed source'), {
            filename: filenameA,
            contentType: 'text/plain',
          })
      )
    );
    expect(concurrent.map((response) => response.status).sort()).toEqual([
      200, 200, 200, 200, 200, 200, 200, 201,
    ]);
    const uploadA = concurrent.find((response) => response.status === 201)!;
    expect(new Set(concurrent.map((response) => response.body.docId))).toEqual(
      new Set([uploadA.body.docId])
    );
    expect(uploadA.body).toMatchObject({ success: true, filename: filenameA, extractionStatus: 'extracted' });

    const coldApp = express();
    coldApp.use(express.json());
    const [{ default: coldAiRouter }, { default: coldOrgRouter }] = await Promise.all([
      import('../../../server/src/routes/ai.routes.js'),
      import('../../../server/src/routes/organization-context.routes.js'),
    ]);
    coldApp.use('/api/ai', coldAiRouter);
    coldApp.use('/api/organization-context', coldOrgRouter);
    const coldReplay = await request(coldApp)
      .post('/api/ai/attachments/ingest')
      .set(bearer(tokenA))
      .set('Idempotency-Key', keyA)
      .attach('file', Buffer.from('Organization A governed source'), {
        filename: filenameA,
        contentType: 'text/plain',
      });
    expect(coldReplay.status).toBe(200);
    expect(coldReplay.body).toMatchObject({ docId: uploadA.body.docId, replayed: true });

    const beforeCollision = await pool.query(
      `SELECT
        (SELECT count(*)::int FROM knowledge_docs WHERE organization_id=$1) docs,
        (SELECT count(*)::int FROM organization_context_items WHERE organization_id=$1) items,
        (SELECT count(*)::int FROM organization_context_claims WHERE organization_id=$1) claims`,
      [orgA]
    );
    const collision = await request(app)
      .post('/api/ai/attachments/ingest')
      .set(bearer(tokenA))
      .set('Idempotency-Key', keyA)
      .attach('file', Buffer.from('ALTERED bytes'), { filename: filenameA, contentType: 'text/plain' });
    expect(collision.status).toBe(409);
    expect(collision.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(
      (
        await pool.query(
          `SELECT
            (SELECT count(*)::int FROM knowledge_docs WHERE organization_id=$1) docs,
            (SELECT count(*)::int FROM organization_context_items WHERE organization_id=$1) items,
            (SELECT count(*)::int FROM organization_context_claims WHERE organization_id=$1) claims`,
          [orgA]
        )
      ).rows[0]
    ).toEqual(beforeCollision.rows[0]);

    const claimsA = await request(app).get('/api/organization-context/governed/claims').set(bearer(tokenA));
    expect(claimsA.status).toBe(200);
    const pending = claimsA.body.claims.find((claim: any) => claim.value?.filename === filenameA);
    claimA = pending.claimId;
    expect(pending).toMatchObject({ sourceType: 'document_extraction', reviewState: 'pending', approved: false });

    const uploadB = await request(app)
      .post('/api/ai/attachments/ingest')
      .set(bearer(tokenB))
      .attach('file', Buffer.from('Organization B governed source'), { filename: filenameB, contentType: 'text/plain' })
      .field('organizationId', orgA);
    expect(uploadB.status).toBe(201);
    const claimsB = await request(app).get('/api/organization-context/governed/claims').set(bearer(tokenB));
    expect(claimsB.body.claims.some((claim: any) => claim.value?.filename === filenameB)).toBe(true);
    expect(claimsB.body.claims.some((claim: any) => claim.claimId === claimA)).toBe(false);
    expect((await pool.query(`SELECT organization_id FROM knowledge_docs WHERE id=$1`, [uploadB.body.docId])).rows[0]?.organization_id).toBe(orgB);
    expect(
      (
        await pool.query(
          `SELECT organization_id, status, source_type, file_hash, version
             FROM knowledge_docs WHERE id=$1`,
          [uploadA.body.docId]
        )
      ).rows[0]
    ).toEqual({
      organization_id: orgA,
      status: 'ready',
      source_type: 'document_extraction',
      file_hash: createHash('sha256').update('Organization A governed source').digest('hex'),
      version: 1,
    });
  });

  it('rolls back the receipt and every business row when COMMIT fails, then recovers', async () => {
    const key = id('commit_failure');
    const filename = commitFailureFilename;
    commitControl.failNext = true;
    const failed = await request(app)
      .post('/api/ai/attachments/ingest')
      .set(bearer(tokenA))
      .set('Idempotency-Key', key)
      .attach('file', Buffer.from('commit rollback source'), {
        filename,
        contentType: 'text/plain',
      });
    expect(failed.status).toBeGreaterThanOrEqual(500);
    expect(
      (
        await pool.query(
          `SELECT
            (SELECT count(*)::int FROM organization_context_upload_receipts WHERE organization_id=$1 AND idempotency_key=$2) receipts,
            (SELECT count(*)::int FROM knowledge_docs WHERE organization_id=$1 AND filename=$3) docs,
            (SELECT count(*)::int FROM organization_context_items WHERE organization_id=$1 AND source_label=$3) items`,
          [orgA, key, filename]
        )
      ).rows[0]
    ).toEqual({ receipts: 0, docs: 0, items: 0 });

    const recovered = await request(app)
      .post('/api/ai/attachments/ingest')
      .set(bearer(tokenA))
      .set('Idempotency-Key', key)
      .attach('file', Buffer.from('commit rollback source'), {
        filename,
        contentType: 'text/plain',
      });
    expect(recovered.status).toBe(201);
  });

  it('approves, publishes, and cold-reopens the uploaded source reference', async () => {
    const approved = await request(app)
      .post(`/api/organization-context/governed/claims/${claimA}/approve`)
      .set(bearer(tokenA))
      .send({ note: 'Reviewed uploaded source' });
    expect(approved.status).toBe(200);
    const published = await request(app)
      .post('/api/organization-context/governed/publish')
      .set(bearer(tokenA))
      .send({});
    expect(published.status).toBe(201);

    const coldApp = express();
    coldApp.use(express.json());
    const { default: coldRouter } = await import('../../../server/src/routes/organization-context.routes.js');
    coldApp.use('/api/organization-context', coldRouter);
    const reopened = await request(coldApp)
      .get(`/api/organization-context/governed/versions/${published.body.version}`)
      .set(bearer(tokenA));
    expect(reopened.status).toBe(200);
    expect(reopened.body.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ claimId: claimA, approvalSource: 'explicit_review' }),
      ])
    );
    expect(reopened.body.sourceRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        claimId: claimA,
        sourceType: 'document_extraction',
        fileHash: createHash('sha256').update('Organization A governed source').digest('hex'),
        docVersion: 1,
        dangling: false,
        danglingReason: null,
      }),
    ]));
  });
});
