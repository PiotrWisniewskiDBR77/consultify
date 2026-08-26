/** @vitest-environment node */
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

describe.skipIf(!REAL_DB)('Assessment day 25 — legacy workflow role removal', () => {
  let app: Express;
  let authorization = '';

  beforeAll(async () => {
    const { default: config } = await import('../../../config/Config.js');
    authorization = `Bearer ${jwt.sign(
      { id: 'day25-route-probe', organizationId: 'day25-route-probe-org', role: 'user' },
      config.JWT_SECRET,
      {
        expiresIn: '15m',
        ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
        ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
      }
    )}`;

    const { default: routes } = await import('../assessment-workflow.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/assessment-workflow', routes);
  });

  const auth = (probe: request.Test) => probe.set('Authorization', authorization);

  it('returns 404 for the removed current-role endpoint', async () => {
    expect((await auth(request(app).get('/api/assessment-workflow/missing/my-role'))).status).toBe(
      404
    );
  });

  it('returns 404 for the removed role-list and role-assignment endpoints', async () => {
    expect((await auth(request(app).get('/api/assessment-workflow/missing/roles'))).status).toBe(
      404
    );
    expect(
      (
        await auth(request(app).post('/api/assessment-workflow/missing/roles')).send({
          targetUserId: 'target',
          role: 'viewer',
        })
      ).status
    ).toBe(404);
  });

  it('returns 404 for the removed role-delete endpoint', async () => {
    expect(
      (await auth(request(app).delete('/api/assessment-workflow/missing/roles/target'))).status
    ).toBe(404);
  });

  it('keeps the nine named live route shapes mounted after the deletion', async () => {
    const probes = [
      auth(request(app).get('/api/assessment-workflow/missing/status')),
      auth(request(app).get('/api/assessment-workflow/missing/versions')),
      auth(request(app).post('/api/assessment-workflow/missing/restore/1')),
      auth(request(app).post('/api/assessment-workflow/missing/presence')).send({}),
      auth(request(app).get('/api/assessment-workflow/missing/activities')),
      auth(request(app).post('/api/assessment-workflow/missing/submit-for-review')).send({}),
      auth(request(app).post('/api/assessment-workflow/missing/approve')).send({}),
      auth(request(app).post('/api/assessment-workflow/missing/reject')).send({}),
      auth(request(app).get('/api/assessment-workflow/missing/activity-logs')),
    ];
    const responses = await Promise.all(probes);
    expect(responses.map(({ status }) => status)).toEqual([
      200, 200, 404, 200, 200, 200, 400, 400, 200,
    ]);
    expect(responses[2].body).toEqual({ error: 'Version not found' });
  });
});
