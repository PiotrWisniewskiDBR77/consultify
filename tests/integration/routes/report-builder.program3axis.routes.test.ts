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
const buildThreeAxisReportMock = vi.fn();

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
  buildThreeAxisReport: (...args: any[]) => buildThreeAxisReportMock(...args),
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

/**
 * GET /api/report-builder/program-3axis/live — Faza2 gap #2 (audyt endpointów READ):
 * threeAxisReportService.buildThreeAxisReport (+ getThreeAxisLiveView) existed with zero
 * READ-route callers — only the POST publish (snapshot) path above was wired, so the
 * timeline showed NA before anyone published. This is the additive live-view GET.
 */
describe('GET /api/report-builder/program-3axis/live', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/report-builder', reportBuilderRouter);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('own-org read succeeds → 200 with available:true + report, forwards orgId/scope/asOf', async () => {
    buildThreeAxisReportMock.mockResolvedValue({
      organizationId: 'org-legit-member',
      scope: { level: 'organization' },
      program: { rag: 'AMBER' },
      rows: [],
    });

    const res = await request(app)
      .get('/api/report-builder/program-3axis/live')
      .query({ projectId: 'proj-1', asOf: '1700000000000' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      available: true,
      report: {
        organizationId: 'org-legit-member',
        scope: { level: 'organization' },
        program: { rag: 'AMBER' },
        rows: [],
      },
    });
    expect(buildThreeAxisReportMock).toHaveBeenCalledWith({
      organizationId: 'org-legit-member',
      projectId: 'proj-1',
      programId: undefined,
      asOf: 1700000000000,
    });
  });

  it('no query params (org-wide) → scope/asOf undefined, still forwards org', async () => {
    buildThreeAxisReportMock.mockResolvedValue({ scope: { level: 'organization' } });

    const res = await request(app).get('/api/report-builder/program-3axis/live');

    expect(res.status).toBe(200);
    expect(buildThreeAxisReportMock).toHaveBeenCalledWith({
      organizationId: 'org-legit-member',
      projectId: undefined,
      programId: undefined,
      asOf: undefined,
    });
  });

  it('service throws → fail-soft 200 with available:false, report:null (read endpoint, never 500)', async () => {
    buildThreeAxisReportMock.mockRejectedValue(new Error('boom'));
    const res = await request(app).get('/api/report-builder/program-3axis/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, available: false, report: null });
  });
});
