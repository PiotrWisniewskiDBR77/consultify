/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    const organizationId = req.headers['x-test-org-id'];
    const id = req.headers['x-test-user-id'];
    if (!organizationId || !id) return res.status(401).json({ error: 'No token provided' });
    req.user = { id, organizationId, role: 'admin' };
    req.userRole = 'admin';
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));

function localDatabaseUrl(): string {
  const value = process.env.DATABASE_URL || '';
  if (!/localhost|127\.0\.0\.1/.test(value)) throw new Error('Local DATABASE_URL is required');
  return value;
}

const prefix = `day10-${Date.now()}-${randomUUID().slice(0, 8)}`;
const orgA = `${prefix}-org-a`;
const orgB = `${prefix}-org-b`;
const userA = `${prefix}-user-a`;
const headers = (organizationId = orgA) => ({
  'x-test-org-id': organizationId,
  'x-test-user-id': userA,
});

describe('meeting day 10 record routes (real Postgres)', () => {
  let app: express.Express;
  let pool: Pool;
  let meetingA: string;
  let meetingB: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: localDatabaseUrl() });
    meetingA = `${prefix}-meeting-a`;
    meetingB = `${prefix}-meeting-b`;
    await pool.query(
      `INSERT INTO meetings
       (id, organization_id, title, start_at, end_at, attendees_json, created_by)
       VALUES ($1,$2,'Operacyjny przegląd A',now()::text,now()::text,'[]',$3),
              ($4,$5,'Operacyjny przegląd B',now()::text,now()::text,'[]',$3)`,
      [meetingA, orgA, userA, meetingB, orgB]
    );
    const { default: meetingRoutes } = await import('../meeting.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/meeting', meetingRoutes);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM meeting_decisions WHERE organization_id IN ($1,$2)`, [
      orgA,
      orgB,
    ]);
    await pool.query(`DELETE FROM meeting_follow_ups WHERE organization_id IN ($1,$2)`, [
      orgA,
      orgB,
    ]);
    await pool.query(`DELETE FROM meetings WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.end();
  });

  it('creates, reads back, updates and deletes a structured decision', async () => {
    const created = await request(app)
      .post(`/api/meeting/${meetingA}/decision-records`)
      .set(headers())
      .send({ statement: 'Uruchamiamy pilotaż', rationale: 'Ryzyko jest kontrolowane' });
    expect(created.status).toBe(201);
    expect(created.body.decision.statement).toBe('Uruchamiamy pilotaż');

    const updated = await request(app)
      .patch(`/api/meeting/${meetingA}/decision-records/${created.body.decision.id}`)
      .set(headers())
      .send({ status: 'superseded' });
    expect(updated.status).toBe(200);
    expect(updated.body.decision.status).toBe('superseded');

    const removed = await request(app)
      .delete(`/api/meeting/${meetingA}/decision-records/${created.body.decision.id}`)
      .set(headers());
    expect(removed.status).toBe(200);
    expect(removed.body).toEqual({ deleted: true });
  });

  it('rejects an empty decision and an unknown decision update', async () => {
    const invalid = await request(app)
      .post(`/api/meeting/${meetingA}/decision-records`)
      .set(headers())
      .send({ statement: ' ' });
    expect(invalid.status).toBe(400);
    const missing = await request(app)
      .patch(`/api/meeting/${meetingA}/decision-records/missing`)
      .set(headers())
      .send({ status: 'recorded' });
    expect(missing.status).toBe(404);
  });

  it('does not disclose decision records across tenants', async () => {
    const response = await request(app)
      .get(`/api/meeting/${meetingA}/decision-records`)
      .set(headers(orgB));
    expect(response.status).toBe(404);
  });

  it('returns an honest empty decision collection', async () => {
    const response = await request(app)
      .get(`/api/meeting/${meetingA}/decision-records`)
      .set(headers());
    expect(response.status).toBe(200);
    expect(response.body.decisions).toEqual([]);
  });

  it('creates, reads back, updates and deletes a follow-up record', async () => {
    const created = await request(app)
      .post(`/api/meeting/${meetingA}/follow-up-records`)
      .set(headers())
      .send({ title: 'Potwierdzić zakres', owner: 'Anna' });
    expect(created.status).toBe(201);
    expect(created.body.followUp.status).toBe('open');

    const updated = await request(app)
      .patch(`/api/meeting/${meetingA}/follow-up-records/${created.body.followUp.id}`)
      .set(headers())
      .send({ status: 'done' });
    expect(updated.status).toBe(200);
    expect(updated.body.followUp.status).toBe('done');

    const removed = await request(app)
      .delete(`/api/meeting/${meetingA}/follow-up-records/${created.body.followUp.id}`)
      .set(headers());
    expect(removed.status).toBe(200);
  });

  it('rejects invalid follow-ups and keeps tenant isolation', async () => {
    const invalid = await request(app)
      .post(`/api/meeting/${meetingA}/follow-up-records`)
      .set(headers())
      .send({ title: '' });
    expect(invalid.status).toBe(400);
    const foreign = await request(app)
      .get(`/api/meeting/${meetingA}/follow-up-records`)
      .set(headers(orgB));
    expect(foreign.status).toBe(404);
  });
});
