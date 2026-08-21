/** @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbGet, mockDbRun } = vi.hoisted(() => ({
  mockDbGet: vi.fn(),
  mockDbRun: vi.fn(),
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'user-1', organizationId: 'org-1', role: 'OWNER' };
    next();
  },
}));

vi.mock('../../middleware/requireAudit.middleware.js', () => ({
  requireAudit: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../services/legacyCutover/requireActiveMembership.js', () => ({
  requireActiveMembership: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  all: vi.fn(),
  get: (...args: unknown[]) => mockDbGet(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import dataExportRoutes from '../dataExport.routes.js';

describe('legacy data-export deletion writer approved-out boundary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 410 and performs zero database writes', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/user', dataExportRoutes);

    const res = await request(app)
      .post('/api/user/delete-request')
      .send({ confirmationEmail: 'user@example.test', reason: 'legacy retry' });

    expect(res.status).toBe(410);
    expect(res.body).toMatchObject({
      success: false,
      code: 'SET_DELETE_APPROVED_OUT',
      destructiveExecution: false,
    });
    expect(mockDbGet).not.toHaveBeenCalled();
    expect(mockDbRun).not.toHaveBeenCalled();
  });
});
