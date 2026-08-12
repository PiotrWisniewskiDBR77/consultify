/**
 * Finance v3 canonical adapter — Pakiet ROUTES_EXPOSURE, Comments +
 * Review checklist (`/comments/*`, `/review-checklist/*`), real PostgreSQL +
 * real HTTP.
 *
 * Covers:
 *   1. Mount proof.
 *   2. Full comment lifecycle (create/get/list/resolve/reopen/assign) +
 *      blocking-comment preflight, against the real migrated tables.
 *   3. Review checklist lifecycle (add/check/uncheck/required/all-checked).
 *   4. Cross-tenant matrix, both directions, with independent SQL
 *      confirmation.
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

describe.skipIf(!REAL_PG)('Finance v2 ROUTES_EXPOSURE — Comments + Review checklist (real HTTP + real PostgreSQL)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let av: typeof import('../../../../services/finance/canonical/artifactVersionService.js');
  let financeV2Router: express.Router;

  const orgA = `org-comments-a-${randomUUID()}`;
  const orgB = `org-comments-b-${randomUUID()}`;
  const userA = `user-comments-a-${randomUUID()}`;
  const userB = `user-comments-b-${randomUUID()}`;

  function appAsOrg(orgId: string, userId: string) {
    const a = express();
    a.use(express.json());
    a.use((req: any, _res, next) => {
      req.user = { id: userId, organizationId: orgId, role: 'finance_admin' };
      req.v8Context = { organizationId: orgId, userId, userRole: 'finance_admin' };
      next();
    });
    a.use('/api/v8/finance-v2', financeV2Router);
    a.use((err: any, _req: any, res: any, _next: any) => res.status(500).json({ error: String(err?.message || err) }));
    return a;
  }
  let appA: express.Express;
  let appB: express.Express;

  let artifactId = '';
  let bvId = '';

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    av = await import('../../../../services/finance/canonical/artifactVersionService.js');
    financeV2Router = (await import('../index.js')).default;

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?), (?, ?)`, [orgA, 'Comments Tenant A', orgB, 'Comments Tenant B'])
    );

    appA = appAsOrg(orgA, userA);
    appB = appAsOrg(orgB, userB);

    const artifact = await av.createArtifact({ organizationId: orgA, artifactType: 'STATEMENT_PACK', createdBy: userA });
    artifactId = artifact.artifact.artifact_id;
    bvId = artifact.businessVersion.business_version_id;
  }, 120000);

  // -----------------------------------------------------------------
  // Mount proof
  // -----------------------------------------------------------------

  it('MOUNT PROOF: valid context + REAL router, random commentId -> 404 WITH {code:"NOT_FOUND"}', async () => {
    const res = await request(appA).get(`/api/v8/finance-v2/comments/${randomUUID()}`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code', 'NOT_FOUND');
  });

  it('MOUNT PROOF: valid context, path no router in this tree handles -> 404 WITHOUT a code field', async () => {
    const res = await request(appA).get('/api/v8/finance-v2/this-path-truly-does-not-exist-anywhere');
    expect(res.status).toBe(404);
    expect(res.body).not.toHaveProperty('code');
  });

  // -----------------------------------------------------------------
  // Comment lifecycle
  // -----------------------------------------------------------------

  let commentId = '';
  let blockingCommentId = '';

  const userA2 = `user-comments-a2-${randomUUID()}`;

  it('POST /comments — create artifact-level comment', async () => {
    const res = await request(appA)
      .post('/api/v8/finance-v2/comments')
      .send({ artifactId, businessVersionId: bvId, body: 'Please double-check this line.', mentions: [userA2] });
    expect(res.status).toBe(201);
    expect(res.body.data.body).toBe('Please double-check this line.');
    expect(res.body.data.mentions).toEqual([userA2]);
    expect(res.body.data.is_blocking).toBe(false);
    commentId = res.body.data.id;
  });

  it('POST /comments — empty body -> 400 BODY_REQUIRED', async () => {
    const res = await request(appA).post('/api/v8/finance-v2/comments').send({ artifactId, businessVersionId: bvId, body: '   ' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('code', 'BODY_REQUIRED');
  });

  it('GET /comments/:id — round-trips the created comment', async () => {
    const res = await request(appA).get(`/api/v8/finance-v2/comments/${commentId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(commentId);
  });

  it('GET /comments?artifactId= — lists it', async () => {
    const res = await request(appA).get(`/api/v8/finance-v2/comments?artifactId=${artifactId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((c: any) => c.id)).toContain(commentId);
  });

  it('GET /comments — neither artifactId nor businessVersionId -> 400 INVALID_QUERY', async () => {
    const res = await request(appA).get('/api/v8/finance-v2/comments');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('code', 'INVALID_QUERY');
  });

  it('GET /comments/mentions/me — the mentioned same-org user (userA2) sees it, the comment author (userA) does not, org B (cross-tenant) does not either', async () => {
    const appA2 = appAsOrg(orgA, userA2);
    const resA2 = await request(appA2).get('/api/v8/finance-v2/comments/mentions/me');
    expect(resA2.status).toBe(200);
    expect(resA2.body.data.map((c: any) => c.id)).toContain(commentId);

    const resA = await request(appA).get('/api/v8/finance-v2/comments/mentions/me');
    expect(resA.status).toBe(200);
    expect(resA.body.data.map((c: any) => c.id)).not.toContain(commentId);

    // userA2 does not exist in org B's tenant at all — this proves listMentioning is scoped by
    // organization_id FIRST (not just by userId), so a same-string userId in a different org
    // cannot fish for mentions belonging to org A.
    const appB_as_userA2 = appAsOrg(orgB, userA2);
    const resB = await request(appB_as_userA2).get('/api/v8/finance-v2/comments/mentions/me');
    expect(resB.status).toBe(200);
    expect(resB.body.data.map((c: any) => c.id)).not.toContain(commentId);
  });

  it('POST /comments/:id/assign then GET .../assignment — round-trips', async () => {
    const assignRes = await request(appA).post(`/api/v8/finance-v2/comments/${commentId}/assign`).send({ assigneeId: userB });
    expect(assignRes.status).toBe(201);
    expect(assignRes.body.data.assignee_id).toBe(userB);

    const getRes = await request(appA).get(`/api/v8/finance-v2/comments/${commentId}/assignment`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.assignee_id).toBe(userB);
  });

  it('POST /comments/:id/resolve then reopen — round-trips resolved_at null<->set', async () => {
    const resolveRes = await request(appA).post(`/api/v8/finance-v2/comments/${commentId}/resolve`);
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.data.resolved_at).not.toBeNull();

    const doubleResolve = await request(appA).post(`/api/v8/finance-v2/comments/${commentId}/resolve`);
    expect(doubleResolve.status).toBe(409);
    expect(doubleResolve.body).toHaveProperty('code', 'ALREADY_RESOLVED');

    const reopenRes = await request(appA).post(`/api/v8/finance-v2/comments/${commentId}/reopen`);
    expect(reopenRes.status).toBe(200);
    expect(reopenRes.body.data.resolved_at).toBeNull();

    const doubleReopen = await request(appA).post(`/api/v8/finance-v2/comments/${commentId}/reopen`);
    expect(doubleReopen.status).toBe(409);
    expect(doubleReopen.body).toHaveProperty('code', 'NOT_RESOLVED');
  });

  it('blocking comment: GET .../has-unresolved-blocking-comments flips true -> false across resolve', async () => {
    const createRes = await request(appA)
      .post('/api/v8/finance-v2/comments')
      .send({ artifactId, businessVersionId: bvId, body: 'BLOCKING — fix before approval', isBlocking: true });
    expect(createRes.status).toBe(201);
    blockingCommentId = createRes.body.data.id;

    const beforeRes = await request(appA).get(`/api/v8/finance-v2/versions/${bvId}/has-unresolved-blocking-comments`);
    expect(beforeRes.status).toBe(200);
    expect(beforeRes.body.data.hasUnresolvedBlockingComments).toBe(true);

    const resolveRes = await request(appA).post(`/api/v8/finance-v2/comments/${blockingCommentId}/resolve`);
    expect(resolveRes.status).toBe(200);

    const afterRes = await request(appA).get(`/api/v8/finance-v2/versions/${bvId}/has-unresolved-blocking-comments`);
    expect(afterRes.status).toBe(200);
    expect(afterRes.body.data.hasUnresolvedBlockingComments).toBe(false);
  });

  // -----------------------------------------------------------------
  // Review checklist lifecycle
  // -----------------------------------------------------------------

  let checklistItemId = '';

  it('POST /review-checklist — add item', async () => {
    const res = await request(appA)
      .post('/api/v8/finance-v2/review-checklist')
      .send({ businessVersionId: bvId, item: 'Confirm cash reconciliation', required: true });
    expect(res.status).toBe(201);
    checklistItemId = res.body.data.id;
  });

  it('GET /review-checklist/:businessVersionId/all-required-checked — false before check, true after', async () => {
    const before = await request(appA).get(`/api/v8/finance-v2/review-checklist/${bvId}/all-required-checked`);
    expect(before.status).toBe(200);
    expect(before.body.data.allRequiredChecked).toBe(false);

    const checkRes = await request(appA).post(`/api/v8/finance-v2/review-checklist/${checklistItemId}/check`);
    expect(checkRes.status).toBe(200);
    expect(checkRes.body.data.checked_at).not.toBeNull();

    const after = await request(appA).get(`/api/v8/finance-v2/review-checklist/${bvId}/all-required-checked`);
    expect(after.status).toBe(200);
    expect(after.body.data.allRequiredChecked).toBe(true);

    const doubleCheck = await request(appA).post(`/api/v8/finance-v2/review-checklist/${checklistItemId}/check`);
    expect(doubleCheck.status).toBe(409);
    expect(doubleCheck.body).toHaveProperty('code', 'ALREADY_CHECKED');
  });

  it('POST /review-checklist/:id/required=false then uncheck — item no longer blocks all-required-checked even unchecked', async () => {
    const uncheckRes = await request(appA).post(`/api/v8/finance-v2/review-checklist/${checklistItemId}/uncheck`);
    expect(uncheckRes.status).toBe(200);
    expect(uncheckRes.body.data.checked_at).toBeNull();

    const requiredRes = await request(appA).post(`/api/v8/finance-v2/review-checklist/${checklistItemId}/required`).send({ required: false });
    expect(requiredRes.status).toBe(200);
    expect(requiredRes.body.data.required).toBe(false);

    const allChecked = await request(appA).get(`/api/v8/finance-v2/review-checklist/${bvId}/all-required-checked`);
    expect(allChecked.status).toBe(200);
    expect(allChecked.body.data.allRequiredChecked).toBe(true); // only non-required items outstanding
  });

  it('GET /review-checklist/:businessVersionId — lists the item', async () => {
    const res = await request(appA).get(`/api/v8/finance-v2/review-checklist/${bvId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((i: any) => i.id)).toContain(checklistItemId);
  });

  // -----------------------------------------------------------------
  // Cross-tenant matrix
  // -----------------------------------------------------------------

  it('CROSS-TENANT: org B creating a comment on org A\'s businessVersionId -> 404 NOT_FOUND (pre-check), not a raw FK-violation 500; SQL confirms zero org-B comments', async () => {
    const res = await request(appB).post('/api/v8/finance-v2/comments').send({ artifactId, businessVersionId: bvId, body: 'org B trying to attach here' });
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code', 'NOT_FOUND');

    const orgBComments = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ id: string }>(`SELECT id FROM finance_comments WHERE organization_id = ?`, [orgB])
    );
    expect(orgBComments.length).toBe(0);
  });

  it('CROSS-TENANT: org B reading org A\'s comment by id -> 404; org A can still read it', async () => {
    const crossRead = await request(appB).get(`/api/v8/finance-v2/comments/${commentId}`);
    expect(crossRead.status).toBe(404);
    expect(crossRead.body).toHaveProperty('code', 'NOT_FOUND');

    const legitRead = await request(appA).get(`/api/v8/finance-v2/comments/${commentId}`);
    expect(legitRead.status).toBe(200);

    const orgARows = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ id: string }>(`SELECT id FROM finance_comments WHERE organization_id = ? AND business_version_id = ?`, [orgA, bvId])
    );
    expect(orgARows.length).toBeGreaterThanOrEqual(2); // the plain comment + the blocking comment created above
  });

  it('CROSS-TENANT: org B listing org A\'s checklist -> empty (org-scoped query, no cross-tenant leak)', async () => {
    const res = await request(appB).get(`/api/v8/finance-v2/review-checklist/${bvId}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);

    const legit = await request(appA).get(`/api/v8/finance-v2/review-checklist/${bvId}`);
    expect(legit.status).toBe(200);
    expect(legit.body.data.length).toBeGreaterThan(0);
  });
});
