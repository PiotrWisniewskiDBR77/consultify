/**
 * M18 · L-05 — Template approve/deprecate server-side role gate (regression).
 *
 * The teczka cited an OLD state where `/templates/:id/approve` and
 * `/templates/:id/deprecate` had no server-side role check, so any org member
 * could approve/deprecate firm templates. Code verification (2026-06-17) shows
 * the gate is ALREADY present:
 *
 *   document-studio.routes.ts:623  (approve)
 *   document-studio.routes.ts:653  (deprecate)
 *     if (!['admin','owner','superadmin'].includes(userRole.toLowerCase()))
 *       → 403 'Admin or owner role required to (approve|deprecate) templates'
 *
 * This is a REGRESSION test that locks the gate in: a non-admin member is
 * rejected with 403 on both endpoints, while an admin passes through to the
 * real service. If the gate is ever removed, the non-admin cases flip to
 * 200/4xx-from-service and these tests fail.
 *
 * Strategy mirrors `document-studio-share-links.routes.test.ts`: mock only the
 * auth seam (role injected per-test), seed a real draft template via the real
 * `draftTemplate`, then drive the real router through supertest.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockUser: { id: string; organizationId: string; role: string } | null = null;

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    next();
  },
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: () => Promise.resolve([]),
  get: () => Promise.resolve(null),
  run: () => Promise.resolve({ success: true, changes: 0 }),
  default: {},
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  __resetTemplateRegistryForTests,
  draftTemplate,
} from '../../../server/src/services/documentStudio/documentTemplateService.js';

import documentStudioRoutes from '../../../server/src/routes/document-studio.routes.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/document-studio', documentStudioRoutes);
  return app;
}

const ORG = 'org-template-gate';

function seedDraftTemplate(): string {
  const { template } = draftTemplate({
    organizationId: ORG,
    userId: 'seed-user',
    input: { purpose: 'Firm proposal template', documentType: 'sales_proposal' },
  });
  return template.templateId;
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetTemplateRegistryForTests();
  mockUser = { id: 'member-1', organizationId: ORG, role: 'CONSULTANT' };
});

describe('M18 · POST /templates/:id/approve — server role gate (L-05)', () => {
  it('non-admin member → 403 (gate fires before the service)', async () => {
    const templateId = seedDraftTemplate();
    mockUser = { id: 'member-1', organizationId: ORG, role: 'CONSULTANT' };

    const res = await request(createApp())
      .post(`/api/document-studio/templates/${templateId}/approve`)
      .send({ notes: 'looks good' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/role required/i);
  });

  it('admin → passes through to the service (template approved)', async () => {
    const templateId = seedDraftTemplate();
    mockUser = { id: 'admin-1', organizationId: ORG, role: 'ADMIN' };

    const res = await request(createApp())
      .post(`/api/document-studio/templates/${templateId}/approve`)
      .send({ notes: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.template.status).toBe('approved');
  });
});

describe('M18 · POST /templates/:id/deprecate — server role gate (L-05)', () => {
  it('non-admin member → 403 (gate fires before the service)', async () => {
    const templateId = seedDraftTemplate();
    mockUser = { id: 'member-1', organizationId: ORG, role: 'CONSULTANT' };

    const res = await request(createApp())
      .post(`/api/document-studio/templates/${templateId}/deprecate`)
      .send({ reason: 'stale' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/role required/i);
  });

  it('admin → passes through to the service (template deprecated)', async () => {
    const templateId = seedDraftTemplate();
    mockUser = { id: 'owner-1', organizationId: ORG, role: 'OWNER' };

    const res = await request(createApp())
      .post(`/api/document-studio/templates/${templateId}/deprecate`)
      .send({ reason: 'replaced' });

    expect(res.status).toBe(200);
    expect(res.body.template.status).toBe('deprecated');
  });
});
