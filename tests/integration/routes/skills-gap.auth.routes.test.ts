/**
 * AUTH-SWEEP (E-AUTH-A) regression test.
 *
 * Precedent: transactionReadiness was mountable without auth. The sweep found
 * skills-gap.routes.ts mounted at /api/skills-gap (Gateway.ts) with NO
 * verifyToken — every route reads org-scoped data via req.organizationId /
 * req.user. This test mounts ONLY the narrow router (no full boot) with the
 * REAL verifyToken and asserts an unauthenticated request is rejected with 401.
 */
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

describe('E-AUTH-A: /api/skills-gap requires auth', () => {
  let app: express.Express;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousAuthBypass = process.env.ENABLE_TEST_AUTH_BYPASS;
  const previousMockDb = process.env.MOCK_DB;

  beforeAll(async () => {
    // Set fail-closed auth state before importing the router. Env loading during
    // the router graph must not recapture an ambient test bypass.
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'false';
    process.env.MOCK_DB = 'false';
    vi.resetModules();
    const { default: skillsGapRoutes } = await import(
      '../../../server/src/routes/skills-gap.routes.js'
    );
    app = express();
    app.use(express.json());
    app.use('/api/skills-gap', skillsGapRoutes);
  });

  afterAll(() => {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousAuthBypass === undefined) delete process.env.ENABLE_TEST_AUTH_BYPASS;
    else process.env.ENABLE_TEST_AUTH_BYPASS = previousAuthBypass;
    if (previousMockDb === undefined) delete process.env.MOCK_DB;
    else process.env.MOCK_DB = previousMockDb;
    vi.resetModules();
  });

  it('GET /by-competency without a token → 401', async () => {
    const res = await request(app).get('/api/skills-gap/by-competency');
    expect(res.status).toBe(401);
  });

  it('GET /initiatives/:id without a token → 401', async () => {
    const res = await request(app).get('/api/skills-gap/initiatives/abc-123');
    expect(res.status).toBe(401);
  });

  it('POST /initiatives/:id/snapshot without a token → 401', async () => {
    const res = await request(app)
      .post('/api/skills-gap/initiatives/abc-123/snapshot')
      .send({});
    expect(res.status).toBe(401);
  });

  it('GET /initiatives/:id/snapshots without a token → 401', async () => {
    const res = await request(app).get('/api/skills-gap/initiatives/abc-123/snapshots');
    expect(res.status).toBe(401);
  });
});
