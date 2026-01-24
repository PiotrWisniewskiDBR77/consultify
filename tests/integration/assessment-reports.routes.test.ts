import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

const mockDb = {
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
};

vi.mock('../../server/src/database/index.js', () => ({
  getDatabase: () => mockDb,
}));

import assessmentReportsRouter from '../../server/src/routes/assessment-reports.routes';

describe('Assessment Reports Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /assessment-reports returns mapped reports', async () => {
    mockDb.all.mockImplementation((_sql: string, _params: unknown[], cb: (err: unknown, rows: any[]) => void) => {
      cb(null, [
        {
          id: 'report-123',
          assessmentId: 'assessment-1',
          name: null,
          status: 'FINAL',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-02T00:00:00Z',
          createdBy: 'user-1',
          assessmentName: 'DRD Q1',
          initiativesGenerated: 3,
        },
      ]);
    });

    const app = express();
    app.use((req, _res, next) => {
      req.user = { id: 'user-1', organizationId: 'org-1', role: 'ADMIN' };
      next();
    });
    app.use('/api/assessment-reports', assessmentReportsRouter);

    const response = await request(app).get('/api/assessment-reports');
    expect(response.status).toBe(200);
    expect(response.body.reports).toHaveLength(1);
    expect(response.body.reports[0].status).toBe('FINAL');
    expect(response.body.reports[0].initiativesGenerated).toBe(true);
  });
});
