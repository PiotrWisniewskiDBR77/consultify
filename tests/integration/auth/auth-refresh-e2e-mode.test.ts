import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

describe('Auth routes: /refresh (E2E_MODE)', () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origE2E = process.env.E2E_MODE;
  let canListen = true;
  let router: any;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.E2E_MODE = 'true';
  });

  beforeAll(async () => {
    canListen = await canBindEphemeralPort();
    router = (await import('../../../server/src/routes/auth.routes.ts')).default;
  });

  afterAll(() => {
    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;
    if (origE2E === undefined) delete process.env.E2E_MODE;
    else process.env.E2E_MODE = origE2E;
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/auth', router });

  it('POST /api/auth/refresh rejects a synthetic E2E token', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp())
      .post('/api/auth/refresh')
      .send({ refreshToken: 'e2e-refresh' });
    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty('token');
  });

  it('POST /api/auth/refresh validates refresh token', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });
});
