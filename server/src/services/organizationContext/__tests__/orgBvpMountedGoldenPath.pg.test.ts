/**
 * ORG-BVP-001 mounted golden path on real PostgreSQL.
 *
 * Production source writer -> pending claim -> mounted JWT approval -> immutable
 * publish -> mounted pinned reopen, with role, stale-membership and tenant negatives.
 */
import { createHash, randomUUID } from 'node:crypto';

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

describe.skipIf(!REAL_DB)('ORG-BVP-001 — mounted organization golden path (real PostgreSQL)', () => {
  const suffix = randomUUID().slice(0, 8);
  const id = (part: string) => `codex_org_bvp_${part}_${suffix}`;
  const orgId = id('org');
  const foreignOrgId = id('foreign_org');
  const ownerId = id('owner');
  const memberId = id('member');
  const staleId = id('stale');
  const foreignOwnerId = id('foreign_owner');
  const docId = id('doc');
  const fileHash = createHash('sha256').update('ORG-BVP-001 document bytes').digest('hex');

  let pool: Pool;
  let app: Express;
  let ownerToken = '';
  let memberToken = '';
  let staleToken = '';
  let foreignToken = '';
  let claimId = '';
  let publishedHash = '';

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: DATABASE_URL });

    for (const [organizationId, name] of [
      [orgId, 'ORG BVP owner tenant'],
      [foreignOrgId, 'ORG BVP foreign tenant'],
    ]) {
      await pool.query(
        `INSERT INTO organizations (id, name, plan, status) VALUES ($1,$2,'enterprise','active')`,
        [organizationId, name]
      );
    }
    for (const [userId, organizationId, role] of [
      [ownerId, orgId, 'OWNER'],
      [memberId, orgId, 'MEMBER'],
      [staleId, orgId, 'MEMBER'],
      [foreignOwnerId, foreignOrgId, 'OWNER'],
    ]) {
      await pool.query(
        `INSERT INTO users (id, organization_id, email, password, role, status)
         VALUES ($1,$2,$3,'unused',$4,'active')`,
        [userId, organizationId, `${userId}@example.test`, role]
      );
      await pool.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1,$2,$3,$4,$5)`,
        [id(`membership_${userId}`), organizationId, userId, role, userId === staleId ? 'INACTIVE' : 'ACTIVE']
      );
    }
    await pool.query(
      `INSERT INTO knowledge_docs (id, filename, file_hash, version, organization_id, status)
       VALUES ($1,'org-bvp-source.txt',$2,1,$3,'ready')`,
      [docId, fileHash, orgId]
    );

    const { default: config } = await import('../../../config/Config.js');
    const sign = (userId: string, organizationId: string, role: string) =>
      jwt.sign({ id: userId, organizationId, role, email: `${userId}@example.test` }, config.JWT_SECRET, {
        expiresIn: '10m',
      });
    ownerToken = sign(ownerId, orgId, 'OWNER');
    memberToken = sign(memberId, orgId, 'MEMBER');
    staleToken = sign(staleId, orgId, 'MEMBER');
    foreignToken = sign(foreignOwnerId, foreignOrgId, 'OWNER');

    const { default: router } = await import('../../../routes/organization-context.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/organization-context', router);
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM organization_context_snapshot_versions WHERE organization_id = ANY($1)`, [[orgId, foreignOrgId]]);
    await pool.query(`DELETE FROM organization_context_claim_reviews WHERE organization_id = ANY($1)`, [[orgId, foreignOrgId]]);
    await pool.query(`DELETE FROM organization_context_claims WHERE organization_id = ANY($1)`, [[orgId, foreignOrgId]]);
    await pool.query(`DELETE FROM organization_context_items WHERE organization_id = ANY($1)`, [[orgId, foreignOrgId]]);
    await pool.query(`DELETE FROM organization_context_snapshots WHERE organization_id = ANY($1)`, [[orgId, foreignOrgId]]);
    await pool.query(`DELETE FROM knowledge_docs WHERE id = $1`, [docId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [[orgId, foreignOrgId]]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [[ownerId, memberId, staleId, foreignOwnerId]]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgId, foreignOrgId]]);
    const residue = await pool.query<{ n: number }>(
      `SELECT
        (SELECT count(*) FROM organization_context_items WHERE organization_id = ANY($1))::int +
        (SELECT count(*) FROM organization_context_snapshot_versions WHERE organization_id = ANY($1))::int +
        (SELECT count(*) FROM users WHERE id = ANY($2))::int AS n`,
      [[orgId, foreignOrgId], [ownerId, memberId, staleId, foreignOwnerId]]
    );
    expect(residue.rows[0]?.n).toBe(0);
    await pool.end();
  }, 60_000);

  it('creates a pending document claim through the production source writer', async () => {
    const { default: organizationContextService } = await import('../OrganizationContextService.js');
    await organizationContextService.recordAttachmentExtraction({
      organizationId: orgId,
      userId: ownerId,
      payload: {
        docId,
        filename: 'org-bvp-source.txt',
        extractedText: 'The organization serves industrial transformation customers.',
      },
    });

    const claims = await request(app)
      .get('/api/organization-context/governed/claims')
      .set(auth(ownerToken));
    expect(claims.status).toBe(200);
    const proposed = claims.body.claims.find(
      (claim: any) => claim.claimPath === 'evidence.documentExtraction'
    );
    expect(proposed).toMatchObject({ approved: false, reviewState: 'pending' });
    expect(proposed.value).toMatchObject({ docId, filename: 'org-bvp-source.txt' });
    claimId = proposed.claimId;

    const before = await pool.query<{ n: number }>(
      `SELECT count(*)::int n FROM organization_context_snapshot_versions WHERE organization_id = $1`,
      [orgId]
    );
    const emptyPublish = await request(app)
      .post('/api/organization-context/governed/publish')
      .set(auth(ownerToken))
      .send({});
    expect(emptyPublish.status).toBe(422);
    expect(emptyPublish.body).toMatchObject({ code: 'NO_APPROVED_GOVERNED_CLAIMS' });
    const after = await pool.query<{ n: number }>(
      `SELECT count(*)::int n FROM organization_context_snapshot_versions WHERE organization_id = $1`,
      [orgId]
    );
    expect(before.rows[0]?.n).toBe(0);
    expect(after.rows[0]?.n).toBe(0);
  });

  it('denies insufficient role, stale membership and foreign-tenant approval', async () => {
    expect(claimId).not.toBe('');

    const member = await request(app)
      .post(`/api/organization-context/governed/claims/${claimId}/approve`)
      .set(auth(memberToken))
      .send({ note: 'must not approve' });
    expect(member.status).toBe(403);

    const stale = await request(app)
      .get('/api/organization-context/governed/claims')
      .set(auth(staleToken));
    expect(stale.status).toBe(403);
    expect(stale.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });

    const foreign = await request(app)
      .post(`/api/organization-context/governed/claims/${claimId}/approve`)
      .set(auth(foreignToken))
      .send({ note: 'foreign attempt' });
    expect(foreign.status).toBe(404);

    const stillPending = await pool.query(
      `SELECT review_state FROM organization_context_claim_reviews WHERE claim_id = $1`,
      [claimId]
    );
    expect(stillPending.rows).toHaveLength(0);
  });

  it('owner approves and publishes exactly one immutable snapshot through mounted HTTP', async () => {
    const approved = await request(app)
      .post(`/api/organization-context/governed/claims/${claimId}/approve`)
      .set(auth(ownerToken))
      .send({ note: 'human approved fixture claim' });
    expect(approved.status).toBe(200);
    expect(approved.body).toMatchObject({ reviewState: 'approved', wonDecision: true });

    const published = await request(app)
      .post('/api/organization-context/governed/publish')
      .set(auth(ownerToken))
      .send({});
    expect(published.status).toBe(201);
    expect(published.body.version).toBe(1);
    expect(published.body.contentHash).toMatch(/^[0-9a-f]{64}$/);
    publishedHash = published.body.contentHash;
  });

  it('reopens the exact tenant snapshot through HTTP and a fresh PostgreSQL connection', async () => {
    const reopened = await request(app)
      .get('/api/organization-context/governed/versions/1')
      .set(auth(ownerToken));
    expect(reopened.status).toBe(200);
    expect(reopened.body).toMatchObject({ organizationId: orgId, version: 1, contentHash: publishedHash });
    expect(reopened.body.claims.map((claim: any) => claim.claimId)).toContain(claimId);
    expect(reopened.body.sourceRefs).toContainEqual(
      expect.objectContaining({ claimId, sourceDocId: docId, fileHash, docVersion: 1, dangling: false })
    );

    const fresh = new Client({ connectionString: DATABASE_URL });
    await fresh.connect();
    const cold = await fresh.query(
      `SELECT version, content_hash, snapshot_json
       FROM organization_context_snapshot_versions
       WHERE organization_id = $1 AND version = 1`,
      [orgId]
    );
    await fresh.end();
    expect(cold.rows).toHaveLength(1);
    expect(cold.rows[0].content_hash).toBe(publishedHash);
    expect(JSON.parse(cold.rows[0].snapshot_json).claims.map((claim: any) => claim.claimId)).toContain(claimId);

    const foreignRead = await request(app)
      .get('/api/organization-context/governed/versions/1')
      .set(auth(foreignToken));
    expect(foreignRead.status).toBe(404);
  });
});
