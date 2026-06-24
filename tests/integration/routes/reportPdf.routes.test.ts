/**
 * Integration tests for reportPdf.routes (M14 / F8 PDF + F6 cadence).
 *
 * Mocks the auth middleware (verifyToken/isAuthenticated) so the router runs
 * with a synthetic org-scoped user, and mocks the two services it depends on:
 *   - statusReportService.getReport  → report row or null (404 path)
 *   - reportPdfService.renderReportPdf → Buffer.from('%PDF-test')
 *   - reportCadenceService.findDueReports → due list
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetReport = vi.fn();
const mockRenderReportPdf = vi.fn();
const mockFindDueReports = vi.fn();

let mockUser: { id: string; organizationId: string } | null = null;

vi.mock('../../../server/src/middleware/auth.middleware.js', () => {
  const inject = (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.user = mockUser;
    req.userId = mockUser.id;
    req.organizationId = mockUser.organizationId;
    next();
  };
  return {
    default: inject,
    verifyToken: inject,
    isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
  };
});

vi.mock('../../../server/src/services/statusReportService.js', () => ({
  default: {
    getReport: (...args: unknown[]) => mockGetReport(...args),
  },
}));

vi.mock('../../../server/src/services/reportPdfService.js', () => ({
  default: { renderReportPdf: (...args: unknown[]) => mockRenderReportPdf(...args) },
  renderReportPdf: (...args: unknown[]) => mockRenderReportPdf(...args),
}));

vi.mock('../../../server/src/services/reportCadenceService.js', () => ({
  default: { findDueReports: (...args: unknown[]) => mockFindDueReports(...args) },
  findDueReports: (...args: unknown[]) => mockFindDueReports(...args),
}));

async function makeApp(): Promise<Express> {
  const { default: router } = await import('../../../server/src/routes/reportPdf.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/reports', router);
  return app;
}

describe('reportPdf.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-1', organizationId: 'org-1' };
  });

  describe('GET /:reportId/pdf', () => {
    it('streams application/pdf with attachment disposition', async () => {
      mockGetReport.mockResolvedValue({
        id: 'rep-1',
        initiativeName: 'Alpha Initiative',
        overallStatus: 'GREEN',
      });
      mockRenderReportPdf.mockResolvedValue(Buffer.from('%PDF-test'));

      const app = await makeApp();
      const res = await request(app).get('/api/reports/rep-1/pdf');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment');
      // supertest gives a Buffer body for binary content-types.
      expect(Buffer.from(res.body).toString()).toBe('%PDF-test');
      expect(mockGetReport).toHaveBeenCalledWith('rep-1', 'org-1');
    });

    it('returns 404 when the report does not exist', async () => {
      mockGetReport.mockResolvedValue(null);

      const app = await makeApp();
      const res = await request(app).get('/api/reports/missing/pdf');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Report not found' });
      expect(mockRenderReportPdf).not.toHaveBeenCalled();
    });

    it('returns 401 when there is no org on the user', async () => {
      mockUser = null;

      const app = await makeApp();
      const res = await request(app).get('/api/reports/rep-1/pdf');

      expect(res.status).toBe(401);
      expect(mockGetReport).not.toHaveBeenCalled();
    });
  });

  describe('GET /cadence/due', () => {
    it('returns the due list (200)', async () => {
      const due = [
        { initiativeId: 'init-1', periodType: 'WEEKLY' },
        { initiativeId: 'init-2', periodType: 'MONTHLY' },
      ];
      mockFindDueReports.mockResolvedValue(due);

      const app = await makeApp();
      const res = await request(app).get('/api/reports/cadence/due');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ due });
      expect(mockFindDueReports).toHaveBeenCalledTimes(1);
      const [orgArg, nowArg] = mockFindDueReports.mock.calls[0];
      expect(orgArg).toBe('org-1');
      expect(typeof nowArg).toBe('number');
    });
  });
});
