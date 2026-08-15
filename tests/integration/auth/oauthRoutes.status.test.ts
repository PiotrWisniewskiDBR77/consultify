import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

describe('OAuth routes status (admin UI contract)', () => {
  const basePath = '/api/auth';
  let router: any;

  const makeApp = () =>
    makeTestApp({
      mountPath: basePath,
      router,
    });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    vi.resetModules();
    router = (await import('../../../server/src/routes/oauthRoutes.routes.ts')).default;
  });

  it('GET /api/auth/oauth/status returns configured flags + loginUrl', async () => {
    const res = await request(makeApp()).get(`${basePath}/oauth/status`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('google');
    expect(res.body).toHaveProperty('linkedin');
    expect(Object.keys(res.body).sort()).toEqual(['google', 'linkedin']);
    expect(typeof res.body.google.configured).toBe('boolean');
    expect(typeof res.body.google.loginUrl).toBe('string');
  });
});
