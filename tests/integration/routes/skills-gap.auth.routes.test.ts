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
import { beforeAll, describe, expect, it } from 'vitest';

import skillsGapRoutes from '../../../server/src/routes/skills-gap.routes.js';

describe('E-AUTH-A: /api/skills-gap requires auth', () => {
  let app: express.Express;

  beforeAll(() => {
    // Guarantee the no-token → 401 path (not the test-auth-bypass path).
    delete process.env.ENABLE_TEST_AUTH_BYPASS;
    app = express();
    app.use(express.json());
    app.use('/api/skills-gap', skillsGapRoutes);
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
