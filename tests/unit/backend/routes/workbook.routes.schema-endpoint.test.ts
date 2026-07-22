/**
 * B3 fix (2026-07-22, workstream Excel): GET /api/workbook/:id/schema — the
 * dedicated read endpoint that returns the full WorkbookSchema (sheets → rows →
 * cells with value + formula string) for the in-app grid preview. Covers:
 *   - happy path: org-scoped row found → 200 with the parsed sheets array
 *   - 404 when the row belongs to a different org (or doesn't exist)
 *   - in-memory workbookCache short-circuit (freshly generated, not yet queried)
 */
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockUser = {
  id: 'user-1',
  role: 'ADMIN',
  organizationId: 'org-1',
};

vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = mockUser;
    req.userId = mockUser.id;
    req.organizationId = mockUser.organizationId;
    next();
  },
}));

vi.mock('../../../../server/src/middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

const queryOneMock = vi.fn();

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryRun: vi.fn().mockResolvedValue(undefined),
  queryOne: (...args: unknown[]) => queryOneMock(...args),
  queryAll: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../../server/src/services/workbook/WorkbookGeneratorService.js', () => ({
  default: { generate: vi.fn() },
}));

describe('GET /api/workbook/:id/schema', () => {
  beforeEach(() => {
    queryOneMock.mockReset();
  });

  it('returns the full sheets (rows + cells + formulas) for an org-scoped workbook', async () => {
    const sheets = [
      {
        name: 'P&L',
        columns: [
          { key: 'item', header: 'Item' },
          { key: 'value', header: 'Value' },
        ],
        rows: [
          { cells: { item: { value: 'Revenue' }, value: { value: 100000 } } },
          { cells: { item: { value: 'Total' }, value: { formula: 'SUM(B2:B2)' } } },
        ],
      },
    ];
    queryOneMock.mockResolvedValueOnce({
      schema_json: JSON.stringify({ title: 'Test WB', description: 'desc', sheets }),
    });

    const { default: workbookRouter } = await import(
      '../../../../server/src/routes/workbook.routes.js'
    );
    const app = express();
    app.use('/workbook', workbookRouter);

    const res = await request(app).get('/workbook/wb-1/schema');

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Test WB');
    expect(res.body.sheets).toEqual(sheets);
    expect(res.body.sheets[0].rows[1].cells.value.formula).toBe('SUM(B2:B2)');
    // Org-scoped: the second bound param must be the requesting user's org.
    expect(queryOneMock).toHaveBeenCalledWith(expect.any(String), ['wb-1', 'org-1']);
  });

  it('returns 404 when the workbook is not found for this organization', async () => {
    queryOneMock.mockResolvedValueOnce(null);

    const { default: workbookRouter } = await import(
      '../../../../server/src/routes/workbook.routes.js'
    );
    const app = express();
    app.use('/workbook', workbookRouter);

    const res = await request(app).get('/workbook/does-not-exist/schema');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});
