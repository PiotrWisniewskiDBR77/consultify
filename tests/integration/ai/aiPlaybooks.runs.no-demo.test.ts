import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

const { missingSchemaAll } = vi.hoisted(() => ({
  missingSchemaAll: vi
    .fn()
    .mockRejectedValue(
      Object.assign(new Error('relation "ai_playbook_runs" does not exist'), { code: '42P01' })
    ),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: missingSchemaAll,
  get: vi.fn(),
  run: vi.fn(),
}));

describe('AI playbooks runs (no demo placeholders)', () => {
  const basePath = '/api/ai/playbooks';
  let router: any;

  const makeApp = () =>
    makeTestApp({
      mountPath: basePath,
      router,
      beforeMount: (app) => {
        app.use((req, _res, next) => {
          (req as any).user = {
            id: 'u-ai-1',
            organizationId: 'o-ai-1',
            role: 'admin',
          };
          next();
        });
      },
    });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    vi.resetModules();
    router = (await import('../../../server/src/routes/ai/aiPlaybooks.routes.ts')).default;
  });

  it('GET /api/ai/playbooks/runs does not return demo runs (503 when schema missing)', async () => {
    const res = await request(makeApp()).get(`${basePath}/runs`);
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('run-1');
    expect(JSON.stringify(res.body)).not.toContain('test_template');
  });
});
