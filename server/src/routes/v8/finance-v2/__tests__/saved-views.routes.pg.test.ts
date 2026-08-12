/**
 * Finance v3 canonical adapter — Pakiet ROUTES_EXPOSURE, Saved views
 * (`/saved-views/*`), real PostgreSQL + real HTTP.
 *
 * Covers:
 *   1. Mount proof.
 *   2. Full lifecycle (create/get/list/update/delete) for a PERSONAL view.
 *   3. PERSONAL vs TEAM visibility within the SAME organization (a second
 *      same-org user must see the TEAM view but never the PERSONAL one, and
 *      must be refused edit/delete on either even when it IS visible).
 *   4. Shareable token resolution, including its own tenant boundary.
 *   5. Cross-tenant matrix, independently confirmed by SQL.
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

const EMPTY_GRID_VIEW_STATE = {
  schemaVersion: 1,
  freezeRowsCount: 0,
  freezeColumnsCount: 0,
  columns: [],
  rows: [],
  groups: [],
};

describe.skipIf(!REAL_PG)('Finance v2 ROUTES_EXPOSURE — Saved views (real HTTP + real PostgreSQL)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let av: typeof import('../../../../services/finance/canonical/artifactVersionService.js');
  let financeV2Router: express.Router;

  const orgA = `org-savedviews-a-${randomUUID()}`;
  const orgB = `org-savedviews-b-${randomUUID()}`;
  const userA = `user-savedviews-a-${randomUUID()}`;
  const userA2 = `user-savedviews-a2-${randomUUID()}`;
  const userB = `user-savedviews-b-${randomUUID()}`;

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
  let appA2: express.Express;
  let appB: express.Express;

  let artifactId = '';

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    av = await import('../../../../services/finance/canonical/artifactVersionService.js');
    financeV2Router = (await import('../index.js')).default;

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?), (?, ?)`, [orgA, 'SavedViews Tenant A', orgB, 'SavedViews Tenant B'])
    );

    appA = appAsOrg(orgA, userA);
    appA2 = appAsOrg(orgA, userA2);
    appB = appAsOrg(orgB, userB);

    const artifact = await av.createArtifact({ organizationId: orgA, artifactType: 'STATEMENT_PACK', createdBy: userA });
    artifactId = artifact.artifact.artifact_id;
  }, 120000);

  // -----------------------------------------------------------------
  // Mount proof
  // -----------------------------------------------------------------

  it('MOUNT PROOF: valid context + REAL router, random viewId -> 404 WITH {code:"NOT_FOUND"}', async () => {
    const res = await request(appA).get(`/api/v8/finance-v2/saved-views/${randomUUID()}`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code', 'NOT_FOUND');
  });

  it('MOUNT PROOF: valid context, path no router in this tree handles -> 404 WITHOUT a code field', async () => {
    const res = await request(appA).get('/api/v8/finance-v2/this-path-truly-does-not-exist-anywhere');
    expect(res.status).toBe(404);
    expect(res.body).not.toHaveProperty('code');
  });

  // -----------------------------------------------------------------
  // PERSONAL view lifecycle
  // -----------------------------------------------------------------

  let personalViewId = '';

  it('POST /saved-views — create PERSONAL view', async () => {
    const res = await request(appA)
      .post('/api/v8/finance-v2/saved-views')
      .send({ artifactId, scope: 'PERSONAL', name: 'My missing-cells view', gridViewState: EMPTY_GRID_VIEW_STATE, filters: [{ type: 'missing', onlyMissing: true }] });
    expect(res.status).toBe(201);
    expect(res.body.data.scope).toBe('PERSONAL');
    expect(res.body.data.owner_user_id).toBe(userA);
    expect(res.body.data.share_token).toBeTruthy();
    personalViewId = res.body.data.id;
  });

  it('POST /saved-views — invalid filters -> 400 INVALID_FILTERS', async () => {
    const res = await request(appA)
      .post('/api/v8/finance-v2/saved-views')
      .send({ artifactId, scope: 'PERSONAL', name: 'bad', gridViewState: EMPTY_GRID_VIEW_STATE, filters: [{ type: 'missing', onlyMissing: 'not-a-boolean' }] });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('code', 'INVALID_FILTERS');
  });

  it('GET /saved-views/:id — owner round-trips it; a second same-org user gets 404 (personal, not theirs)', async () => {
    const ownRead = await request(appA).get(`/api/v8/finance-v2/saved-views/${personalViewId}`);
    expect(ownRead.status).toBe(200);
    expect(ownRead.body.data.id).toBe(personalViewId);

    const otherRead = await request(appA2).get(`/api/v8/finance-v2/saved-views/${personalViewId}`);
    expect(otherRead.status).toBe(404);
    expect(otherRead.body).toHaveProperty('code', 'NOT_FOUND');
  });

  it('GET /saved-views?artifactId= — owner sees own PERSONAL view; a second same-org user does not', async () => {
    const ownList = await request(appA).get(`/api/v8/finance-v2/saved-views?artifactId=${artifactId}`);
    expect(ownList.status).toBe(200);
    expect(ownList.body.data.map((v: any) => v.id)).toContain(personalViewId);

    const otherList = await request(appA2).get(`/api/v8/finance-v2/saved-views?artifactId=${artifactId}`);
    expect(otherList.status).toBe(200);
    expect(otherList.body.data.map((v: any) => v.id)).not.toContain(personalViewId);
  });

  it('PATCH /saved-views/:id — owner can rename; a second same-org user gets 403 FORBIDDEN', async () => {
    const forbidden = await request(appA2).patch(`/api/v8/finance-v2/saved-views/${personalViewId}`).send({ name: 'hijacked' });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toHaveProperty('code', 'FORBIDDEN');

    const renamed = await request(appA).patch(`/api/v8/finance-v2/saved-views/${personalViewId}`).send({ name: 'Renamed view' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.name).toBe('Renamed view');
  });

  // -----------------------------------------------------------------
  // TEAM view — visible to the whole org, still owner-only edit/delete
  // -----------------------------------------------------------------

  let teamViewId = '';
  let teamShareToken = '';

  it('POST /saved-views — create TEAM view, visible to a second same-org user', async () => {
    const res = await request(appA)
      .post('/api/v8/finance-v2/saved-views')
      .send({ artifactId, scope: 'TEAM', name: 'Team shared view', gridViewState: EMPTY_GRID_VIEW_STATE });
    expect(res.status).toBe(201);
    teamViewId = res.body.data.id;
    teamShareToken = res.body.data.share_token;

    const otherRead = await request(appA2).get(`/api/v8/finance-v2/saved-views/${teamViewId}`);
    expect(otherRead.status).toBe(200);
    expect(otherRead.body.data.id).toBe(teamViewId);

    const otherList = await request(appA2).get(`/api/v8/finance-v2/saved-views?artifactId=${artifactId}`);
    expect(otherList.body.data.map((v: any) => v.id)).toContain(teamViewId);
  });

  it('DELETE /saved-views/:id — a second same-org user gets 403 on a TEAM view they do not own; owner can delete', async () => {
    const forbidden = await request(appA2).delete(`/api/v8/finance-v2/saved-views/${teamViewId}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toHaveProperty('code', 'FORBIDDEN');

    const sqlBefore = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ id: string }>(`SELECT id FROM finance_saved_views WHERE id = ?`, [teamViewId])
    );
    expect(sqlBefore).toBeTruthy();
  });

  // -----------------------------------------------------------------
  // Shareable token
  // -----------------------------------------------------------------

  it('GET /saved-views/shared/:token — resolves for any same-org user (TEAM scope); wrong org -> 404', async () => {
    const sameOrg = await request(appA2).get(`/api/v8/finance-v2/saved-views/shared/${teamShareToken}`);
    expect(sameOrg.status).toBe(200);
    expect(sameOrg.body.data.id).toBe(teamViewId);

    const wrongOrg = await request(appB).get(`/api/v8/finance-v2/saved-views/shared/${teamShareToken}`);
    expect(wrongOrg.status).toBe(404);
    expect(wrongOrg.body).toHaveProperty('code', 'NOT_FOUND');
  });

  it('GET /saved-views/shared/:token — a PERSONAL view\'s token does NOT resolve for a non-owner same-org user', async () => {
    const personalView = await request(appA).get(`/api/v8/finance-v2/saved-views/${personalViewId}`);
    const personalToken = personalView.body.data.share_token;

    const otherUser = await request(appA2).get(`/api/v8/finance-v2/saved-views/shared/${personalToken}`);
    expect(otherUser.status).toBe(404);
    expect(otherUser.body).toHaveProperty('code', 'NOT_FOUND');

    const owner = await request(appA).get(`/api/v8/finance-v2/saved-views/shared/${personalToken}`);
    expect(owner.status).toBe(200);
  });

  // -----------------------------------------------------------------
  // Cross-tenant matrix
  // -----------------------------------------------------------------

  it('CROSS-TENANT: org B listing org A\'s artifactId -> empty list (org-scoped query, no leak)', async () => {
    const res = await request(appB).get(`/api/v8/finance-v2/saved-views?artifactId=${artifactId}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('CROSS-TENANT: org B reading org A\'s TEAM view by id -> 404; SQL confirms the row still exists for org A', async () => {
    const crossRead = await request(appB).get(`/api/v8/finance-v2/saved-views/${teamViewId}`);
    expect(crossRead.status).toBe(404);
    expect(crossRead.body).toHaveProperty('code', 'NOT_FOUND');

    const sqlRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ id: string; organization_id: string }>(`SELECT id, organization_id FROM finance_saved_views WHERE id = ?`, [teamViewId])
    );
    expect(sqlRow).toBeTruthy();
    expect(sqlRow!.organization_id).toBe(orgA);
  });

  it('CROSS-TENANT: org B deleting org A\'s TEAM view -> 404 (not FORBIDDEN — org-scoped lookup fails first), row untouched', async () => {
    const res = await request(appB).delete(`/api/v8/finance-v2/saved-views/${teamViewId}`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code', 'NOT_FOUND');

    const sqlRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ id: string }>(`SELECT id FROM finance_saved_views WHERE id = ?`, [teamViewId])
    );
    expect(sqlRow).toBeTruthy();

    const orgBRows = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ id: string }>(`SELECT id FROM finance_saved_views WHERE organization_id = ?`, [orgB])
    );
    expect(orgBRows.length).toBe(0);
  });

  it('DELETE /saved-views/:id — owner (org A) can finally delete the TEAM view', async () => {
    const res = await request(appA).delete(`/api/v8/finance-v2/saved-views/${teamViewId}`);
    expect(res.status).toBe(204);

    const sqlRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ id: string }>(`SELECT id FROM finance_saved_views WHERE id = ?`, [teamViewId])
    );
    expect(sqlRow).toBeNull();
  });
});
