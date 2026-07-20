/**
 * H6.4 500-leak sweep (fala 4c) — proof that ai/ai-development.routes.ts no
 * longer echoes a raw `error.message` to the client on its 500 paths.
 *
 * Before the fix, EVERY catch block in this file did
 * `res.status(500).json({ error: '...', details: error instanceof Error ? error.message : 'Unknown error' })`
 * — a reversed-ternary leak (18 occurrences) despite each block already
 * calling `logger.error(...)` with the real error server-side. This test
 * forces an unexpected exception on the simplest route
 * (`GET /prompts/categories`) and proves the raw text never reaches the
 * response body.
 */
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'user-1', role: 'super_admin', organizationId: 'org-1' };
    req.userId = 'user-1';
    req.organizationId = 'org-1';
    next();
  },
}));

vi.mock('../../../../server/src/middleware/rbac.middleware.js', () => ({
  requireRole:
    (..._roles: string[]) =>
    (_req: any, _res: any, next: () => void) =>
      next(),
  default:
    (..._roles: string[]) =>
    (_req: any, _res: any, next: () => void) =>
      next(),
}));

const RAW_LEAK_TEXT = 'ECONNREFUSED 127.0.0.1:5432 — internal db pool exhausted';

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn(async () => {
    throw new Error(RAW_LEAK_TEXT);
  }),
  get: vi.fn(async () => null),
  run: vi.fn(async () => ({ changes: 0, lastInsertRowid: 0 })),
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

async function buildApp() {
  const { default: router } = await import(
    '../../../../server/src/routes/ai/ai-development.routes.js'
  );
  const app = express();
  app.use(express.json());
  app.use('/ai-development', router);
  return app;
}

describe('ai/ai-development GET /prompts/categories — 500-leak guard', () => {
  it('does NOT echo the raw exception message to the client', async () => {
    const app = await buildApp();
    const res = await request(app).get('/ai-development/prompts/categories');

    expect(res.status).toBe(500);
    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain(RAW_LEAK_TEXT);
    expect(bodyText).not.toContain('ECONNREFUSED');
    expect(res.body).toMatchObject({
      error: 'Failed to list categories',
      details: 'Unknown error',
    });
  });
});
