/**
 * Acceptance E2E — Assessment collaboration endpoints (comments/presence/activities).
 * Mounts the REAL assessment-workflow router behind REAL verifyToken against
 * the LOCAL Postgres. Proves the 404-fix: every FE-called path now responds.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

let app: Express;
let token: string;

const ASSESSMENT_ID = `odbior--asmt-collab-${Date.now()}`;
const AXIS = 'processes';

beforeAll(async () => {
  await seed();
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const router = (
    await import('../../server/src/routes/assessment/assessment-workflow.routes.js')
  ).default;
  app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/assessment-workflow', router as any);
  token = mintToken();
}, 60_000);

afterAll(async () => {
  const client = pgClient();
  await client.connect();
  try {
    await client.query('DELETE FROM assessment_comments WHERE assessment_id = $1', [ASSESSMENT_ID]);
    await client.query('DELETE FROM assessment_activities WHERE assessment_id = $1', [ASSESSMENT_ID]);
    await client.query('DELETE FROM assessment_presence WHERE assessment_id = $1', [ASSESSMENT_ID]);
  } finally {
    await client.end();
  }
});

describe('Acceptance: assessment collaboration (real runtime)', () => {
  it('comments: create parent + reply, resolve, threaded read-back', async () => {
    // Empty first
    const empty = await request(app)
      .get(`/api/assessment-workflow/${ASSESSMENT_ID}/comments`)
      .query({ axisId: AXIS })
      .set('Authorization', `Bearer ${token}`);
    expect(empty.status).toBe(200);
    expect(Array.isArray(empty.body.comments)).toBe(true);
    expect(empty.body.comments.length).toBe(0);

    // Create parent
    const parent = await request(app)
      .post(`/api/assessment-workflow/${ASSESSMENT_ID}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ axisId: AXIS, comment: 'Parent comment about processes' });
    expect(parent.status).toBe(201);
    const parentId = parent.body.comment.id;
    expect(parentId).toBeTruthy();
    expect(parent.body.comment.author_name).toBeTruthy();

    // Reply
    const reply = await request(app)
      .post(`/api/assessment-workflow/${ASSESSMENT_ID}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ axisId: AXIS, comment: 'A reply', parentCommentId: parentId });
    expect(reply.status).toBe(201);

    // Threaded read-back: one root with one reply
    const list = await request(app)
      .get(`/api/assessment-workflow/${ASSESSMENT_ID}/comments`)
      .query({ axisId: AXIS })
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.comments.length).toBe(1);
    expect(list.body.comments[0].id).toBe(parentId);
    expect(list.body.comments[0].replies.length).toBe(1);
    expect(list.body.comments[0].is_resolved).toBe(false);

    // Resolve
    const resolved = await request(app)
      .post(`/api/assessment-workflow/${ASSESSMENT_ID}/comments/${parentId}/resolve`)
      .set('Authorization', `Bearer ${token}`);
    expect(resolved.status).toBe(200);

    const afterResolve = await request(app)
      .get(`/api/assessment-workflow/${ASSESSMENT_ID}/comments`)
      .query({ axisId: AXIS })
      .set('Authorization', `Bearer ${token}`);
    expect(afterResolve.body.comments[0].is_resolved).toBe(true);
  });

  it('presence: heartbeat upserts and returns active collaborator', async () => {
    const res = await request(app)
      .post(`/api/assessment-workflow/${ASSESSMENT_ID}/presence`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: SEED.USER_ID, userName: 'Odbior Harness', currentAxis: AXIS, currentView: 'assessment' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.collaborators)).toBe(true);
    const me = res.body.collaborators.find((c: any) => c.userId === SEED.USER_ID);
    expect(me).toBeTruthy();
    expect(me.isActive).toBe(true);
    expect(me.currentAxis).toBe(AXIS);
    expect(me.avatarColor).toMatch(/^bg-/);

    // Leave marks disconnected (still within window but is_connected=false -> isActive false)
    const leave = await request(app)
      .post(`/api/assessment-workflow/${ASSESSMENT_ID}/presence/leave`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: SEED.USER_ID });
    expect(leave.status).toBe(200);
    expect(leave.body.success).toBe(true);
  });

  it('activities: log + since-cursor read-back', async () => {
    const before = new Date(Date.now() - 1000).toISOString();
    const post = await request(app)
      .post(`/api/assessment-workflow/${ASSESSMENT_ID}/activities`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'AXIS_UPDATE',
        userId: SEED.USER_ID,
        userName: 'Odbior Harness',
        data: { axisId: AXIS, axisName: 'Digital Processes', newValue: 3, message: 'updated to 3/5' },
      });
    expect(post.status).toBe(201);
    expect(post.body.activity.type).toBe('AXIS_UPDATE');

    const list = await request(app)
      .get(`/api/assessment-workflow/${ASSESSMENT_ID}/activities`)
      .query({ since: before })
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.activities.length).toBeGreaterThanOrEqual(1);
    const ev = list.body.activities[0];
    expect(ev.type).toBe('AXIS_UPDATE');
    expect(ev.userId).toBe(SEED.USER_ID);
    expect(ev.data.axisName).toBe('Digital Processes');
  });
});
