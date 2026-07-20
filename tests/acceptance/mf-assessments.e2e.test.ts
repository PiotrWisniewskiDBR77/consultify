/**
 * Acceptance E2E — /api/mf-assessments schema-drift fix (fala 4).
 *
 * `multi-framework-assessment.routes.ts` used to SELECT/INSERT non-existent
 * columns `title` / `frameworks` (plural JSON array) — a mismatch against the
 * real `multi_framework_assessments` table (columns `name` / `framework`
 * singular, CHECK-constrained). Every request 500'd with
 * "column does not exist". This proves the fix against the REAL local
 * Postgres schema: POST create + GET list + GET by id, through the real
 * router + real auth (minted JWT), zero business-logic mocks.
 */
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { seed } from './seed.mjs';

let app: Express;
let token: string;

beforeAll(async () => {
  await seed(); // idempotent
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const mfaRouter = (await import('../../server/src/routes/multi-framework-assessment.routes.js'))
    .default;
  const express = (await import('express')).default;
  const a = express();
  a.use(express.json({ limit: '1mb' }));
  a.use('/api/mf-assessments', verifyToken as any, mfaRouter);
  app = a;
  token = mintToken();
}, 60_000);

const createdIds: string[] = [];

afterAll(async () => {
  if (createdIds.length === 0) return;
  const client = pgClient();
  await client.connect();
  try {
    await client.query('DELETE FROM multi_framework_assessments WHERE id = ANY($1)', [
      createdIds,
    ]);
  } finally {
    await client.end();
  }
});

describe('Acceptance: /api/mf-assessments schema-drift fix (real runtime)', () => {
  it('creates via POST /, persists real columns (name/framework), and lists via GET /', async () => {
    const uniqueName = `MFA Odbior ${Date.now()}`;

    // 1) CREATE through the real API + real auth.
    const createRes = await request(app)
      .post('/api/mf-assessments')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: uniqueName, framework: 'SIRI' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    const id: string = createRes.body?.id;
    expect(id).toBeTruthy();
    createdIds.push(id);

    // 2) PERSISTENCE — read the row straight from Postgres (hard proof the
    // real columns `name`/`framework` were written, not `title`/`frameworks`).
    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, name, framework, status, organization_id FROM multi_framework_assessments WHERE id = $1`,
        [id]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe(uniqueName);
      expect(rows[0].framework).toBe('SIRI');
      expect(rows[0].status).toBe('DRAFT');
    } finally {
      await client.end();
    }

    // 3) LIST through the API — proves GET / no longer 500s on the old
    // title/frameworks column names.
    const listRes = await request(app)
      .get('/api/mf-assessments')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    const found = listRes.body.find((row: any) => row.id === id);
    expect(found).toBeTruthy();
    expect(found.name).toBe(uniqueName);
    expect(found.framework).toBe('SIRI');

    // 4) READ-BACK single row through GET /:id (already used `SELECT *`,
    // was already correct — regression guard).
    const getRes = await request(app)
      .get(`/api/mf-assessments/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(id);
    expect(getRes.body.name).toBe(uniqueName);
  });

  it('falls back to framework DRD and rejects an invalid framework value gracefully', async () => {
    const createRes = await request(app)
      .post('/api/mf-assessments')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `MFA Odbior Fallback ${Date.now()}`, framework: 'NOT_A_REAL_FRAMEWORK' });

    expect(createRes.status).toBe(201);
    const id: string = createRes.body?.id;
    createdIds.push(id);

    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT framework FROM multi_framework_assessments WHERE id = $1`,
        [id]
      );
      // Invalid framework must not violate the CHECK constraint — route falls back to DRD.
      expect(rows[0].framework).toBe('DRD');
    } finally {
      await client.end();
    }
  });
});
