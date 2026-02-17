import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

function makeE2eToken(payload: Record<string, any>) {
  const base64Url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj), 'utf8')
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  const header = base64Url({ alg: 'none', typ: 'JWT' });
  const body = base64Url(payload);
  return `${header}.${body}.e2e`;
}

describe('Auth routes: /me (E2E_MODE)', () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origE2E = process.env.E2E_MODE;
  const origBypass = process.env.ENABLE_TEST_AUTH_BYPASS;
  let canListen = true;
  let router: any;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.E2E_MODE = 'true';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'false';
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
    if (origBypass === undefined) delete process.env.ENABLE_TEST_AUTH_BYPASS;
    else process.env.ENABLE_TEST_AUTH_BYPASS = origBypass;
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/auth', router });

  it('GET /api/auth/me returns user payload from token', async function () {
    if (!canListen) this.skip();
    const token = makeE2eToken({
      e2e: true,
      id: 'e2e-user-1',
      email: 'e2e@local.test',
      name: 'E2E User',
      role: 'ADMIN',
      organizationId: 'e2e-org-1',
    });

    const res = await request(makeApp())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        user: expect.objectContaining({
          id: 'e2e-user-1',
          organizationId: 'e2e-org-1',
          isAuthenticated: true,
        }),
      })
    );
  });

  it('GET /api/auth/me returns 401 for invalid token', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });
});
