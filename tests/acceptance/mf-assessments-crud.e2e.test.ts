/**
 * Acceptance E2E — /api/mf-assessments CRUD endpoints consumed by the FE store
 * (src/store/useMultiFrameworkStore.ts).
 *
 * The schema-drift sibling test (mf-assessments.e2e.test.ts) only proves the
 * root GET / POST / GET :id path. This file proves the FOUR endpoints the FE
 * store actually drives, which previously did not exist and 404'd — killing
 * create-from-project / save / delete / duplicate for the whole
 * Multi-Framework Assessment feature (SIRI/ADMA/CMMI/LEAN):
 *
 *   POST   /api/mf-assessments/:projectId/:framework   createAssessment()
 *   PUT    /api/mf-assessments/:id                      saveAssessment()
 *   DELETE /api/mf-assessments/:id                      deleteAssessment()
 *   POST   /api/mf-assessments/:id/duplicate            duplicateAssessment()
 *
 * Runs through the REAL router + REAL auth (minted JWT) against the REAL local
 * Postgres — zero business-logic mocks. Also asserts route-ordering
 * (/:id/duplicate must win over /:projectId/:framework) and org-scoping.
 */
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

let app: Express;
let token: string;

// A stable project id we own; seeded idempotently so the project_id FK on
// multi_framework_assessments is satisfied for the scoped-create endpoint.
const PROJECT_ID = 'odbior--proj-mfa-crud';

// A foreign organization used to prove the router's organization_id filter.
const OTHER_ORG_ID = 'odbior--org-other-mfa';

const createdIds: string[] = [];

beforeAll(async () => {
  await seed(); // idempotent — org + user + membership

  // Ensure the project the scoped-create endpoint references exists.
  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO projects (id, organization_id, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [PROJECT_ID, SEED.ORG_ID, 'MFA CRUD Acceptance Project']
    );
  } finally {
    await client.end();
  }

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

afterAll(async () => {
  const client = pgClient();
  await client.connect();
  try {
    if (createdIds.length > 0) {
      await client.query('DELETE FROM multi_framework_assessments WHERE id = ANY($1)', [
        createdIds,
      ]);
    }
    // CASCADE also clears any assessment rows still tied to the project.
    await client.query('DELETE FROM projects WHERE id = $1', [PROJECT_ID]);
    await client.query('DELETE FROM organizations WHERE id = $1', [OTHER_ORG_ID]);
  } finally {
    await client.end();
  }
});

/** Create a base row through the known-good root POST / (no project_id). */
async function createBase(name: string, framework = 'CMMI'): Promise<string> {
  const res = await request(app)
    .post('/api/mf-assessments')
    .set('Authorization', `Bearer ${token}`)
    .send({ name, framework });
  expect(res.status).toBe(201);
  const id: string = res.body?.id;
  expect(id).toBeTruthy();
  createdIds.push(id);
  return id;
}

describe('Acceptance: /api/mf-assessments CRUD (FE-store contract, real runtime)', () => {
  it('POST /:projectId/:framework creates a scoped assessment and persists data JSONB', async () => {
    const name = `MFA Scoped SIRI ${Date.now()}`;
    const res = await request(app)
      .post(`/api/mf-assessments/${PROJECT_ID}/SIRI`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name, data: { dimensions: { operations: 3, supply_chain: 2.5 } } });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.framework).toBe('SIRI');
    const id: string = res.body?.id;
    expect(id).toBeTruthy();
    createdIds.push(id);

    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT project_id, name, framework, status, data FROM multi_framework_assessments WHERE id = $1`,
        [id]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].project_id).toBe(PROJECT_ID);
      expect(rows[0].name).toBe(name);
      expect(rows[0].framework).toBe('SIRI');
      expect(rows[0].status).toBe('DRAFT');
      // data is jsonb → pg returns a parsed object.
      expect(rows[0].data?.dimensions?.operations).toBe(3);
    } finally {
      await client.end();
    }
  });

  it('POST /:projectId/:framework rejects an invalid framework with 400', async () => {
    const res = await request(app)
      .post(`/api/mf-assessments/${PROJECT_ID}/NOT_A_FRAMEWORK`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'bad framework' });
    expect(res.status).toBe(400);
    expect(String(res.body.error)).toContain('Invalid framework');
  });

  it('PUT /:id updates data + name and bumps version', async () => {
    const id = await createBase(`MFA PUT ${Date.now()}`);

    const client = pgClient();
    await client.connect();
    let priorVersion: number;
    try {
      const { rows } = await client.query(
        `SELECT COALESCE(version, 1) AS version FROM multi_framework_assessments WHERE id = $1`,
        [id]
      );
      priorVersion = Number(rows[0].version);
    } finally {
      await client.end();
    }

    const res = await request(app)
      .put(`/api/mf-assessments/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed via PUT', data: { dimensions: { maturity: 5 } } });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.version).toBe('number');
    expect(res.body.version).toBeGreaterThan(priorVersion);

    const client2 = pgClient();
    await client2.connect();
    try {
      const { rows } = await client2.query(
        `SELECT name, data, version FROM multi_framework_assessments WHERE id = $1`,
        [id]
      );
      expect(rows[0].name).toBe('Renamed via PUT');
      expect(rows[0].data?.dimensions?.maturity).toBe(5);
      expect(Number(rows[0].version)).toBe(res.body.version);
    } finally {
      await client2.end();
    }
  });

  it('PUT /:id returns 404 for a non-existent assessment', async () => {
    const res = await request(app)
      .put('/api/mf-assessments/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'ghost' });
    expect(res.status).toBe(404);
  });

  it('DELETE /:id removes the row', async () => {
    const id = await createBase(`MFA DELETE ${Date.now()}`);

    const res = await request(app)
      .delete(`/api/mf-assessments/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT id FROM multi_framework_assessments WHERE id = $1`,
        [id]
      );
      expect(rows).toHaveLength(0);
    } finally {
      await client.end();
    }
  });

  it('DELETE /:id returns 404 for a non-existent assessment', async () => {
    const res = await request(app)
      .delete('/api/mf-assessments/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('POST /:id/duplicate copies data under a new id + name, resets version to 1', async () => {
    // Source created via the scoped endpoint so it carries a project_id + data.
    const srcName = `MFA Dup Source ${Date.now()}`;
    const srcRes = await request(app)
      .post(`/api/mf-assessments/${PROJECT_ID}/ADMA`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: srcName, data: { dimensions: { leadership_strategy: 4 } } });
    expect(srcRes.status).toBe(201);
    const srcId: string = srcRes.body.id;
    createdIds.push(srcId);

    const dupName = 'Duplicated Assessment';
    const dupRes = await request(app)
      .post(`/api/mf-assessments/${srcId}/duplicate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: dupName });

    // 201 (not 400) proves route-ordering: /:id/duplicate wins over
    // /:projectId/:framework (else framework='duplicate' → 400).
    expect(dupRes.status).toBe(201);
    expect(dupRes.body.success).toBe(true);
    expect(dupRes.body.framework).toBe('ADMA');
    const dupId: string = dupRes.body.id;
    expect(dupId).toBeTruthy();
    expect(dupId).not.toBe(srcId);
    createdIds.push(dupId);

    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT name, framework, data, project_id, COALESCE(version, 1) AS version
         FROM multi_framework_assessments WHERE id = $1`,
        [dupId]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe(dupName);
      expect(rows[0].framework).toBe('ADMA');
      expect(rows[0].project_id).toBe(PROJECT_ID);
      expect(rows[0].data?.dimensions?.leadership_strategy).toBe(4);
      expect(Number(rows[0].version)).toBe(1);
    } finally {
      await client.end();
    }
  });

  it('POST /:id/duplicate returns 404 for a non-existent source', async () => {
    const res = await request(app)
      .post('/api/mf-assessments/00000000-0000-4000-8000-000000000000/duplicate')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'ghost copy' });
    expect(res.status).toBe(404);
  });

  it('DELETE /:id is org-scoped — cannot delete a row owned by another org', async () => {
    // Insert a row directly under a DIFFERENT organization (no membership for
    // our user), so our token's resolved org must NOT match it.
    const foreignId = `odbior--mfa-foreign-${Date.now()}`;
    const client = pgClient();
    await client.connect();
    try {
      await client.query(
        `INSERT INTO organizations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
        [OTHER_ORG_ID]
      );
      await client.query(
        `INSERT INTO multi_framework_assessments (id, organization_id, name, framework)
         VALUES ($1, $2, $3, 'SIRI')`,
        [foreignId, OTHER_ORG_ID, 'Foreign org assessment']
      );
    } finally {
      await client.end();
    }
    createdIds.push(foreignId);

    // Our token resolves to our own org → the org-scoped DELETE must miss it.
    const res = await request(app)
      .delete(`/api/mf-assessments/${foreignId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);

    // Row must still exist — it was not deleted across the org boundary.
    const client2 = pgClient();
    await client2.connect();
    try {
      const { rows } = await client2.query(
        `SELECT id FROM multi_framework_assessments WHERE id = $1`,
        [foreignId]
      );
      expect(rows).toHaveLength(1);
    } finally {
      await client2.end();
    }
  });
});
