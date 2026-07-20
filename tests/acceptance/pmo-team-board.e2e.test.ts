/**
 * Acceptance E2E — ProjectTeamBoard team-membership endpoints.
 *
 * src/components/Projects/ProjectTeamBoard.tsx calls 4 endpoints under
 * `/api/pmo-roles/projects/:projectId/team*` that did not exist on the
 * backend (confirmed gap on demo: board always empty, 404 swallowed
 * silently). This test drives the REAL router (server/src/routes/pmo/
 * pmoRoles.routes.ts) behind REAL auth (verifyToken) against REAL local
 * Postgres — no business-logic mocks.
 *
 * Flow: POST member -> GET grouped (visible at the right level) -> GET
 * stats (numbers reflect the member) -> DELETE -> GET (empty again).
 *
 * Isolation prefix: `odbior--teamboard--`. Reuses harness.ts (mintToken/
 * pgClient) + seed.mjs (SEED org/user).
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

async function buildApp(): Promise<Express> {
  const pmoRolesRouter = (await import('../../server/src/routes/pmo/pmoRoles.routes.js')).default;

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/pmo-roles', pmoRolesRouter);
  return app;
}

const PROJECT_ID = `odbior--teamboard--project-${Date.now()}`;

let app: Express;
let token: string;

beforeAll(async () => {
  await seed(); // idempotent — SEED.ORG_ID / SEED.USER_ID

  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO projects (id, organization_id, name, status, owner_id, created_at)
       VALUES ($1, $2, 'Odbior Team Board Project', 'active', $3, now())
       ON CONFLICT (id) DO NOTHING`,
      [PROJECT_ID, SEED.ORG_ID, SEED.USER_ID]
    );
  } finally {
    await client.end();
  }

  app = await buildApp();
  token = mintToken();
}, 60_000);

afterAll(async () => {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(`DELETE FROM project_team_members WHERE project_id = $1`, [PROJECT_ID]);
    await client.query(`DELETE FROM projects WHERE id = $1`, [PROJECT_ID]);
  } finally {
    await client.end();
  }
}, 30_000);

describe('Acceptance · ProjectTeamBoard endpoints (real router + auth + DB)', () => {
  it('unauthenticated read is rejected (real verifyToken enforced)', async () => {
    const res = await request(app).get(`/api/pmo-roles/projects/${PROJECT_ID}/team?grouped=true`);
    expect(res.status).toBe(401);
  });

  it('starts empty: grouped team has no members, stats are zeroed', async () => {
    const teamRes = await request(app)
      .get(`/api/pmo-roles/projects/${PROJECT_ID}/team?grouped=true`)
      .set('Authorization', `Bearer ${token}`);
    expect(teamRes.status).toBe(200);
    expect(teamRes.body).toEqual({
      executive: [],
      manager: [],
      lead: [],
      member: [],
      stakeholder: [],
      unassigned: [],
    });

    const statsRes = await request(app)
      .get(`/api/pmo-roles/projects/${PROJECT_ID}/team/stats`)
      .set('Authorization', `Bearer ${token}`);
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.totalMembers).toBe(0);
    expect(statsRes.body.requiredRoles.missing.map((m: { code: string }) => m.code).sort()).toEqual(
      ['project-manager', 'team-member']
    );
  });

  it('POST adds a member (project-manager, level 1) -> visible under manager', async () => {
    const postRes = await request(app)
      .post(`/api/pmo-roles/projects/${PROJECT_ID}/team`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: SEED.USER_ID, pmoRoleId: 'project-manager', allocationPercent: 80 });

    expect(postRes.status).toBe(201);
    expect(postRes.body.userId).toBe(SEED.USER_ID);
    expect(postRes.body.pmoRole?.id).toBe('project-manager');
    expect(postRes.body.pmoRole?.level).toBe(1);
    expect(postRes.body.allocationPercent).toBe(80);

    const teamRes = await request(app)
      .get(`/api/pmo-roles/projects/${PROJECT_ID}/team?grouped=true`)
      .set('Authorization', `Bearer ${token}`);
    expect(teamRes.status).toBe(200);
    expect(teamRes.body.manager).toHaveLength(1);
    expect(teamRes.body.manager[0].userId).toBe(SEED.USER_ID);
    expect(teamRes.body.manager[0].userEmail).toBe(SEED.EMAIL);
    expect(teamRes.body.manager[0].pmoRole).toEqual({
      id: 'project-manager',
      code: 'project-manager',
      name: 'Project Manager',
      namePl: 'Kierownik Projektu',
      level: 1,
    });
    expect(teamRes.body.executive).toHaveLength(0);
  });

  it('GET stats reflects the member (totals + byLevel + requiredRoles partially filled)', async () => {
    const statsRes = await request(app)
      .get(`/api/pmo-roles/projects/${PROJECT_ID}/team/stats`)
      .set('Authorization', `Bearer ${token}`);

    expect(statsRes.status).toBe(200);
    expect(statsRes.body.totalMembers).toBe(1);
    expect(statsRes.body.totalAllocation).toBe(80);
    expect(statsRes.body.averageAllocation).toBe(80);
    expect(statsRes.body.byLevel.manager).toBe(1);
    expect(statsRes.body.byLevel.executive).toBe(0);
    expect(statsRes.body.requiredRoles.filled).toBe(1);
    expect(statsRes.body.requiredRoles.missing).toEqual([
      { code: 'team-member', name: 'Team Member' },
    ]);
  });

  it('POST again with the same user upserts (allocation/role update, no duplicate row)', async () => {
    const postRes = await request(app)
      .post(`/api/pmo-roles/projects/${PROJECT_ID}/team`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: SEED.USER_ID, pmoRoleId: 'team-member', allocationPercent: 50 });

    expect(postRes.status).toBe(201);
    expect(postRes.body.pmoRole?.id).toBe('team-member');
    expect(postRes.body.allocationPercent).toBe(50);

    const teamRes = await request(app)
      .get(`/api/pmo-roles/projects/${PROJECT_ID}/team?grouped=true`)
      .set('Authorization', `Bearer ${token}`);
    expect(teamRes.body.member).toHaveLength(1);
    expect(teamRes.body.manager).toHaveLength(0);

    const statsRes = await request(app)
      .get(`/api/pmo-roles/projects/${PROJECT_ID}/team/stats`)
      .set('Authorization', `Bearer ${token}`);
    expect(statsRes.body.totalMembers).toBe(1);
  });

  it('DELETE removes the member; GET returns to empty', async () => {
    const delRes = await request(app)
      .delete(`/api/pmo-roles/projects/${PROJECT_ID}/team/${SEED.USER_ID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(delRes.status).toBe(200);

    const teamRes = await request(app)
      .get(`/api/pmo-roles/projects/${PROJECT_ID}/team?grouped=true`)
      .set('Authorization', `Bearer ${token}`);
    expect(teamRes.body).toEqual({
      executive: [],
      manager: [],
      lead: [],
      member: [],
      stakeholder: [],
      unassigned: [],
    });

    const statsRes = await request(app)
      .get(`/api/pmo-roles/projects/${PROJECT_ID}/team/stats`)
      .set('Authorization', `Bearer ${token}`);
    expect(statsRes.body.totalMembers).toBe(0);

    // Deleting again is a 404 (not found).
    const delAgainRes = await request(app)
      .delete(`/api/pmo-roles/projects/${PROJECT_ID}/team/${SEED.USER_ID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(delAgainRes.status).toBe(404);
  });
});
