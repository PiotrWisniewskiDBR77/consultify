/**
 * M18 — Document Studio error-envelope regression test.
 *
 * INFO-DISCLOSURE sweep: an unexpected failure in a 5xx code path must not echo
 * the raw `err.message` (which can carry DB-driver text, file paths, or internal
 * structure). The client must receive the stable `error` code plus a generic,
 * opaque message; the real error is logged server-side only.
 *
 * Strategy: spy on `transitionDocumentStatus` (the lifecycle 5xx path) and force
 * it to throw a raw, secret-bearing Error. We keep every other export real via
 * `importOriginal` so the router wiring is untouched.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUser = { id: 'user-ds-err-1', organizationId: 'org-ds-err-A', role: 'CONSULTANT' };

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    next();
  },
}));

vi.mock('../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
}));

const RAW_SECRET = 'pg: column "schema_json" does not exist at /srv/app/dao/lifecycle.ts:117';

vi.mock('../../services/documentStudio/documentStudioService.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../services/documentStudio/documentStudioService.js')>();
  return {
    ...actual,
    ensureDocumentLifecycleHydrated: vi.fn(async () => undefined),
    transitionDocumentStatus: vi.fn(() => {
      throw new Error(RAW_SECRET);
    }),
  };
});

import documentStudioRoutes from '../document-studio.routes.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/document-studio', documentStudioRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('M18 document-studio error-envelope', () => {
  it('returns a generic message + stable code on an unexpected 5xx, never the raw error', async () => {
    const res = await request(createApp())
      .post('/api/document-studio/art-1/status')
      .send({ to: 'in_review' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('transition_failed');
    // The stable code is preserved; the raw DB text / file path must NOT leak.
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('schema_json');
    expect(serialized).not.toContain('/srv/app/dao/lifecycle.ts');
    expect(res.body.message).toBe('An unexpected error occurred. Please try again later.');
  });
});
