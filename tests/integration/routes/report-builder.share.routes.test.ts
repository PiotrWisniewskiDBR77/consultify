import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'u-1', organizationId: 'org-1' };
    next();
  },
}));

vi.mock('../../../server/src/middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  default: (_req: any, _res: any, next: any) => next(),
}));

const getReportMock = vi.fn();
const createPublicLinkMock = vi.fn();

vi.mock('../../../server/src/services/reportBuilderService.js', () => ({
  default: {
    getReport: (...args: any[]) => getReportMock(...args),
    createPublicLink: (...args: any[]) => createPublicLinkMock(...args),
  },
}));

import reportBuilderRouter from '../../../server/src/routes/report-builder.routes.js';

describe('report-builder share routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/report-builder', reportBuilderRouter);

  beforeEach(() => {
    getReportMock.mockReset();
    createPublicLinkMock.mockReset();
  });

  it('POST /api/report-builder/:id/share creates public link', async () => {
    getReportMock.mockResolvedValue({ report: { status: 'APPROVED' } });
    createPublicLinkMock.mockResolvedValue({
      id: 'link-1',
      linkToken: 'tok-1',
      expiresAt: '2026-02-01T00:00:00Z',
      showCompanyLogo: true,
      showConsultinityBranding: false,
      customMessage: 'hello',
      createdAt: '2026-01-01T00:00:00Z',
    });

    const res = await request(app)
      .post('/api/report-builder/r-1/share')
      .send({ expiresInDays: 7 });

    expect(res.status).toBe(201);
    expect(res.body.link).toEqual(
      expect.objectContaining({
        id: 'link-1',
        token: 'tok-1',
        url: '/shared/report/tok-1',
      })
    );
  });

  it('POST /api/report-builder/:id/share rejects non-generated reports', async () => {
    getReportMock.mockResolvedValue({ report: { status: 'DRAFT' } });

    const res = await request(app)
      .post('/api/report-builder/r-2/share')
      .send({ expiresInDays: 7 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Report must be generated before sharing' }));
  });
});
