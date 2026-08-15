import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

const { missingProjectMembers } = vi.hoisted(() => ({
  missingProjectMembers: vi
    .fn()
    .mockRejectedValue(
      Object.assign(new Error('relation "project_members" does not exist'), { code: '42P01' })
    ),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: missingProjectMembers,
  get: missingProjectMembers,
  run: missingProjectMembers,
}));

describe('Project members compat routes (no stub responses)', () => {
  const basePath = '/api/project-members';
  let router: any;

  const makeApp = () =>
    makeTestApp({
      mountPath: basePath,
      router,
    });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    vi.resetModules();
    router = (await import('../../../server/src/routes/project-members.routes.ts')).default;
  });

  it('GET /api/project-members/:projectId returns canonical not-configured boundary', async () => {
    const res = await request(makeApp()).get(`${basePath}/project-1`);
    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ status: false, type: 'not_configured' }));
  });
});
