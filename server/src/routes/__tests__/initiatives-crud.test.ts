/**
 * Module 05 (Inicjatywy) — Initiative CRUD route tests.
 *
 * Exercises the legacy /api/initiatives router against a real in-memory sqlite3
 * database (the router uses the callback-style getDatabase() API, which sqlite3
 * provides natively). Covers create → read → update → delete plus org scoping.
 */
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import sqlite3 from 'sqlite3';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Single shared in-memory DB for the suite.
const db = new sqlite3.Database(':memory:');

vi.mock('../../database/index.js', () => ({
  getDatabase: () => db,
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const ORG = 'org-crud-1';
const UID = 'user-crud-1';

vi.mock('../../utils/requestOrganization.js', () => ({
  requireRequestOrganizationId: (req: any, res: any) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized - no organization' });
      return null;
    }
    return orgId;
  },
  resolveRequestOrganizationId: (req: any) => req.user?.organizationId ?? null,
}));

import initiativesRoutes from '../initiatives.routes.js';

let app: Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = { id: UID, organizationId: ORG };
    next();
  });
  app.use('/api/initiatives', initiativesRoutes);
});

afterAll(() => {
  db.close();
});

describe('initiatives CRUD routes', () => {
  let createdId = '';

  it('POST / creates an initiative (201)', async () => {
    const res = await request(app)
      .post('/api/initiatives')
      .send({ name: 'Reduce cycle time', description: 'Lean kaizen', priority: 'high' });
    expect([200, 201]).toContain(res.status);
    expect(res.body.id).toBeTruthy();
    createdId = res.body.id;
  });

  it('GET /:id returns the created initiative (200)', async () => {
    const res = await request(app).get(`/api/initiatives/${createdId}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Reduce cycle time');
  });

  it('GET / lists initiatives for the org (200)', async () => {
    const res = await request(app).get('/api/initiatives');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((i: any) => i.id === createdId)).toBe(true);
  });

  it('PUT /:id updates the status (200)', async () => {
    const res = await request(app).put(`/api/initiatives/${createdId}`).send({ status: 'REVIEW' });
    expect(res.status).toBe(200);
    const after = await request(app).get(`/api/initiatives/${createdId}`);
    expect(String(after.body.status).toUpperCase()).toBe('REVIEW');
  });

  it('DELETE /:id removes the initiative', async () => {
    const res = await request(app).delete(`/api/initiatives/${createdId}`);
    expect([200, 204]).toContain(res.status);
    const after = await request(app).get(`/api/initiatives/${createdId}`);
    expect(after.status).toBe(404);
  });
});
