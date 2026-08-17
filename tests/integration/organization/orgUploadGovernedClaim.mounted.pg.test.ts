import { createHash, randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres.js';

// tests/setup.ts provides a generic multipart stand-in that exposes the whole
// request envelope as `buffer`. This mounted route proof needs production
// Multer semantics so file_hash is bound to the uploaded bytes themselves.
vi.unmock('multer');

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
  let pool: Pool;
  let app: Express;
  let tokenA = '';
  let tokenB = '';
  let claimA = '';

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: DATABASE_URL, max: 3 });
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
    await pool.query(`DELETE FROM organization_context_snapshot_versions WHERE organization_id=ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM organization_context_claim_reviews WHERE organization_id=ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM organization_context_claims WHERE organization_id=ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM organization_context_items WHERE organization_id=ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM organization_context_snapshots WHERE organization_id=ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM knowledge_chunks WHERE doc_id IN (SELECT id FROM knowledge_docs WHERE organization_id=ANY($1) AND filename=ANY($2))`, [[orgA, orgB], [filenameA, filenameB]]);
    await pool.query(`DELETE FROM knowledge_docs WHERE organization_id=ANY($1) AND filename=ANY($2)`, [[orgA, orgB], [filenameA, filenameB]]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id=ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM users WHERE id=ANY($1)`, [[ownerA, ownerB]]);
    await pool.query(`DELETE FROM organizations WHERE id=ANY($1)`, [[orgA, orgB]]);
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
        (SELECT count(*) FROM knowledge_chunks WHERE doc_id IN (SELECT id FROM knowledge_docs WHERE filename=ANY($3)))::int +
        (SELECT count(*) FROM knowledge_docs WHERE filename=ANY($3))::int AS n`,
      [[orgA, orgB], [ownerA, ownerB], [filenameA, filenameB]]
    );
    expect(residue.rows[0]?.n).toBe(0);
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

  it('ingests in each caller tenant without body spoofing or cross-tenant claim leakage', async () => {
    const uploadA = await request(app)
      .post('/api/ai/attachments/ingest')
      .set(bearer(tokenA))
      .attach('file', Buffer.from('Organization A governed source'), { filename: filenameA, contentType: 'text/plain' });
    expect(uploadA.status).toBe(201);
    expect(uploadA.body).toMatchObject({ success: true, filename: filenameA, extractionStatus: 'extracted' });

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
