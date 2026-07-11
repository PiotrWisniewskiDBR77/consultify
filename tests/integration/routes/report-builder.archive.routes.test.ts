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

const archiveReportMock = vi.fn();
const unarchiveReportMock = vi.fn();
const listReportsMock = vi.fn();

vi.mock('../../../server/src/services/reportBuilderService.js', () => ({
  default: {
    archiveReport: (...args: any[]) => archiveReportMock(...args),
    unarchiveReport: (...args: any[]) => unarchiveReportMock(...args),
    listReports: (...args: any[]) => listReportsMock(...args),
  },
}));

import reportBuilderRouter from '../../../server/src/routes/report-builder.routes.js';

describe('report-builder archive routes (#68e)', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/report-builder', reportBuilderRouter);

  beforeEach(() => {
    archiveReportMock.mockReset();
    unarchiveReportMock.mockReset();
    listReportsMock.mockReset();
  });

  it('POST /:id/archive archives a report', async () => {
    archiveReportMock.mockResolvedValue({
      id: 'r-1',
      archivedAt: '2026-07-11T00:00:00.000Z',
      archivedBy: 'u-1',
    });
    const res = await request(app).post('/api/report-builder/r-1/archive').send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toBe('r-1');
    expect(archiveReportMock).toHaveBeenCalledWith('r-1', 'org-1', 'u-1');
  });

  it('POST /:id/archive 404s when report missing', async () => {
    archiveReportMock.mockResolvedValue(null);
    const res = await request(app).post('/api/report-builder/r-404/archive').send({});
    expect(res.status).toBe(404);
  });

  it('POST /:id/unarchive restores a report', async () => {
    unarchiveReportMock.mockResolvedValue({ id: 'r-1' });
    const res = await request(app).post('/api/report-builder/r-1/unarchive').send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(unarchiveReportMock).toHaveBeenCalledWith('r-1', 'org-1', 'u-1');
  });

  it('POST /:id/unarchive 404s when report missing', async () => {
    unarchiveReportMock.mockResolvedValue(null);
    const res = await request(app).post('/api/report-builder/r-404/unarchive').send({});
    expect(res.status).toBe(404);
  });

  it('GET / defaults to active (non-archived) reports only', async () => {
    listReportsMock.mockResolvedValue([]);
    const res = await request(app).get('/api/report-builder');
    expect(res.status).toBe(200);
    expect(listReportsMock).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ archived: undefined, includeArchived: false })
    );
  });

  it('GET /?archived=true lists only archived reports', async () => {
    listReportsMock.mockResolvedValue([{ id: 'r-1', archivedAt: '2026-07-11T00:00:00.000Z' }]);
    const res = await request(app).get('/api/report-builder').query({ archived: 'true' });
    expect(res.status).toBe(200);
    expect(listReportsMock).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ archived: true, includeArchived: false })
    );
  });

  it('GET /?includeArchived=true returns both active and archived', async () => {
    listReportsMock.mockResolvedValue([]);
    const res = await request(app).get('/api/report-builder').query({ includeArchived: 'true' });
    expect(res.status).toBe(200);
    expect(listReportsMock).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ includeArchived: true })
    );
  });
});
