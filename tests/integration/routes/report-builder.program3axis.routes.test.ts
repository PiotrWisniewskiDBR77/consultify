/**
 * HTTP wiring test for the F5 "silnik→route" endpoint added to
 * report-builder.routes.ts (additive — threeAxisReportService.publishThreeAxisSnapshot
 * existed as a service with zero route callers, exactly the finance-section gap):
 *
 *   POST /api/report-builder/program-3axis/publish → threeAxisReportService.publishThreeAxisSnapshot
 *
 * Wzorem `server/src/routes/__tests__/finance-statements.routes.f5wiring.test.ts`
 * (POST /packs/:id/report-section). Thin route→service wiring test (service mocked) —
 * pins success payload shape + forwarded args, blank-string trimming, and 500 on
 * service failure (write endpoint, not fail-soft).
 */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const publishThreeAxisSnapshotMock = vi.fn();

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-legit', organizationId: 'org-legit-member' };
    req.userId = 'user-legit';
    req.organizationId = 'org-legit-member';
    next();
  },
}));

vi.mock('../../../server/src/middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  default: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/services/execution/threeAxisReportService.js', () => ({
  publishThreeAxisSnapshot: (...args: any[]) => publishThreeAxisSnapshotMock(...args),
}));

import reportBuilderRouter from '../../../server/src/routes/report-builder.routes.js';

describe('POST /api/report-builder/program-3axis/publish', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/report-builder', reportBuilderRouter);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('own-org publish succeeds → 201 with reportId/snapshotId/report, forwards orgId/createdBy/scope', async () => {
    publishThreeAxisSnapshotMock.mockResolvedValue({
      reportId: 'report-1',
      snapshotId: 'snap-1',
      report: { scope: { level: 'organization' }, program: { rag: 'GREEN' } },
      envelope: { id: 'env-1' },
    });

    const res = await request(app)
      .post('/api/report-builder/program-3axis/publish')
      .send({ projectId: 'proj-1', title: 'Raport Q1' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      success: true,
      reportId: 'report-1',
      snapshotId: 'snap-1',
      report: { scope: { level: 'organization' }, program: { rag: 'GREEN' } },
    });
    expect(publishThreeAxisSnapshotMock).toHaveBeenCalledWith({
      organizationId: 'org-legit-member',
      createdBy: 'user-legit',
      projectId: 'proj-1',
      programId: undefined,
      title: 'Raport Q1',
      periodFrom: undefined,
      periodTo: undefined,
    });
  });

  it('no scope in body (org-wide) → blank strings trimmed to undefined, still forwards org/user', async () => {
    publishThreeAxisSnapshotMock.mockResolvedValue({
      reportId: 'report-2',
      snapshotId: 'snap-2',
      report: { scope: { level: 'organization' } },
      envelope: { id: 'env-2' },
    });

    const res = await request(app)
      .post('/api/report-builder/program-3axis/publish')
      .send({ projectId: '  ', programId: '' });

    expect(res.status).toBe(201);
    expect(publishThreeAxisSnapshotMock).toHaveBeenCalledWith({
      organizationId: 'org-legit-member',
      createdBy: 'user-legit',
      projectId: undefined,
      programId: undefined,
      title: undefined,
      periodFrom: undefined,
      periodTo: undefined,
    });
  });

  it('service throws → 500, not silently swallowed (write endpoint, not fail-soft)', async () => {
    publishThreeAxisSnapshotMock.mockRejectedValue(new Error('boom'));
    const res = await request(app).post('/api/report-builder/program-3axis/publish').send({});
    expect(res.status).toBe(500);
  });
});
