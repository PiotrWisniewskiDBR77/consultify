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
const listOpenSessionsMock = vi.fn();
const openSessionMock = vi.fn();
const closeSessionMock = vi.fn();

vi.mock('../../../server/src/services/reportBuilderService.js', () => ({
  default: {
    getReport: (...args: any[]) => getReportMock(...args),
    listOpenSessions: (...args: any[]) => listOpenSessionsMock(...args),
    openSession: (...args: any[]) => openSessionMock(...args),
    closeSession: (...args: any[]) => closeSessionMock(...args),
  },
}));

import reportBuilderRouter from '../../../server/src/routes/report-builder.routes.js';

describe('report-builder sessions routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/report-builder', reportBuilderRouter);

  beforeEach(() => {
    getReportMock.mockReset();
    listOpenSessionsMock.mockReset();
    openSessionMock.mockReset();
    closeSessionMock.mockReset();
  });

  it('GET /api/report-builder/sessions returns sessions', async () => {
    listOpenSessionsMock.mockResolvedValue([{ id: 's-1', reportId: 'r-1' }]);
    const res = await request(app).get('/api/report-builder/sessions');
    expect(res.status).toBe(200);
    expect(res.body.sessions).toEqual([{ id: 's-1', reportId: 'r-1' }]);
    expect(listOpenSessionsMock).toHaveBeenCalledWith('org-1', 'u-1');
  });

  it('POST /api/report-builder/:id/session/open 404 when report missing', async () => {
    getReportMock.mockResolvedValue(null);
    const res = await request(app).post('/api/report-builder/r-404/session/open').send({});
    expect(res.status).toBe(404);
  });

  it('POST /api/report-builder/:id/session/open upserts session', async () => {
    getReportMock.mockResolvedValue({ report: { id: 'r-1' } });
    openSessionMock.mockResolvedValue({ id: 's-1', reportId: 'r-1' });
    const res = await request(app)
      .post('/api/report-builder/r-1/session/open')
      .send({ navigationState: { step: 'wizard' } });
    expect(res.status).toBe(200);
    expect(res.body.session).toEqual({ id: 's-1', reportId: 'r-1' });
    expect(openSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'u-1',
        reportId: 'r-1',
      })
    );
  });

  it('POST /api/report-builder/:id/session/close returns success', async () => {
    getReportMock.mockResolvedValue({ report: { id: 'r-1' } });
    closeSessionMock.mockResolvedValue(true);
    const res = await request(app).post('/api/report-builder/r-1/session/close').send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(closeSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'u-1',
        reportId: 'r-1',
      })
    );
  });
});

