/**
 * M14/P0 — status-reports.routes security contract.
 *
 * Locks two P0 fixes found in the M14 deep analysis:
 *  - DELETE /:id is org-scoped (was `WHERE id = ?` → cross-tenant delete).
 *  - POST /:id/distribute requires PUBLISHED (was distributing DRAFT/APPROVED).
 * Mocked (auth + service + DbPromise) so it runs in CI without Postgres.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbAll, dbRun, getReport } = vi.hoisted(() => ({
  dbAll: vi.fn(),
  dbRun: vi.fn(),
  getReport: vi.fn(),
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1', organizationId: 'org-1' };
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../../server/src/services/statusReportService.js', () => ({
  default: {
    getReport: (...a: any[]) => getReport(...a),
    listReports: vi.fn(),
  },
}));
vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...a: any[]) => dbAll(...a),
  run: (...a: any[]) => dbRun(...a),
}));

import statusReportsRoutes from '../../../server/src/routes/status-reports.routes.js';

function app(): Express {
  const a = express();
  a.use(express.json());
  a.use('/api/status-reports', statusReportsRoutes);
  return a;
}

beforeEach(() => vi.clearAllMocks());

describe('DELETE /status-reports/:id — org-scoped', () => {
  it('deletes only within the caller org and returns success', async () => {
    dbRun.mockResolvedValueOnce({ changes: 1 });
    const res = await request(app()).delete('/api/status-reports/r1');
    expect(res.status).toBe(200);
    const [sql, params] = dbRun.mock.calls[0];
    expect(sql).toMatch(/organization_id = \?/i); // the fix: org-scoped
    expect(params).toEqual(['r1', 'org-1']);
  });

  it('returns 404 when nothing matched in the org (no cross-tenant delete)', async () => {
    dbRun.mockResolvedValueOnce({ changes: 0 });
    const res = await request(app()).delete('/api/status-reports/r-other-org');
    expect(res.status).toBe(404);
  });
});

describe('POST /status-reports/:id/distribute — PUBLISHED gate', () => {
  const body = { recipients: ['exec@corp.com'] };

  it('blocks distribution of a non-PUBLISHED report (409)', async () => {
    getReport.mockResolvedValueOnce({ id: 'r1', status: 'DRAFT' });
    const res = await request(app()).post('/api/status-reports/r1/distribute').send(body);
    expect(res.status).toBe(409);
    expect(dbRun).not.toHaveBeenCalled(); // never logs a distribution row
  });

  it('allows distribution when PUBLISHED', async () => {
    getReport.mockResolvedValueOnce({ id: 'r1', status: 'PUBLISHED' });
    dbRun.mockResolvedValue({ changes: 1 });
    const res = await request(app()).post('/api/status-reports/r1/distribute').send(body);
    expect(res.status).toBe(200);
    expect(dbRun).toHaveBeenCalled(); // distribution row written
  });

  it('404 when the report is not in the org', async () => {
    getReport.mockResolvedValueOnce(null);
    const res = await request(app()).post('/api/status-reports/r-x/distribute').send(body);
    expect(res.status).toBe(404);
  });
});
