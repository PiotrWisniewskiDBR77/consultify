/**
 * BUG B — /api/assessments 500 when `assessment_workflows` is absent (e.g. demo).
 *
 * The hub list handler (GET /) LEFT JOINs the optional `assessment_workflows`
 * table. On deployments where that table does not exist (demo), PG throws
 * `relation "assessment_workflows" does not exist`, the outer catch turns it into
 * a bare 500, and the live NewReport flow (GET /api/assessments?status=APPROVED,
 * from src/components/assessment/modals/NewReportModal.tsx) breaks.
 *
 * The fix gates the join on tableExists('assessment_workflows'): when the table
 * is missing we drop the join and fall back to `a.status`, still returning 200.
 *
 * Anti-false-green: this test simulates the missing table two ways at once — the
 * DB layer REJECTS any query that references `assessment_workflows`, and
 * tableExists() resolves false. On the OLD code the join is unconditional so the
 * query references the table → reject → 500. On the FIXED code the guard drops
 * the join → the query never names the table → 200 + a correct list.
 */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// db.all(sql, params, cb) — emulate a PG where `assessment_workflows` is absent:
// any SQL that still references it blows up, exactly like the live 500.
const mockDbAll = vi.fn(
  (sql: string, _params: unknown[], cb: (err: Error | null, rows?: unknown[]) => void) => {
    if (/assessment_workflows/i.test(sql)) {
      cb(new Error('relation "assessment_workflows" does not exist'));
      return;
    }
    cb(null, [
      {
        id: 'a-1',
        organizationId: 'org-1',
        name: 'Demo DRD',
        status: 'APPROVED',
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
        type: 'DRD',
        projectName: 'Digital Readiness Diagnosis',
        frameworkData: null,
        completion_percent: 100,
        answers_json: null,
        score_summary: null,
      },
    ]);
  }
);

vi.mock('../../../../server/src/database/index.js', () => ({
  getDatabase: () => ({ all: mockDbAll }),
}));

// The table is absent → the guard must consult this and drop the join.
const mockTableExists = vi.fn().mockResolvedValue(false);
vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  tableExists: (...a: unknown[]) => mockTableExists(...a),
}));

vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'user-1', role: 'ADMIN', organizationId: 'org-1' };
    req.organizationId = 'org-1';
    next();
  },
}));

vi.mock('../../../../server/src/middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockTableExists.mockResolvedValue(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function mountApp() {
  const { default: router } = await import(
    '../../../../server/src/routes/assessment/assessment-hub.routes.js'
  );
  const app = express();
  app.use('/api/assessments', router);
  return app;
}

describe('assessment hub — GET / when assessment_workflows is missing', () => {
  it('returns 200 + list (fail-soft) instead of a bare 500', async () => {
    const app = await mountApp();
    const res = await request(app).get('/api/assessments');

    // FIXED: table-existence guard dropped the join → query succeeded.
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.assessments)).toBe(true);
    expect(res.body.assessments).toHaveLength(1);
    expect(res.body.assessments[0]).toMatchObject({ id: 'a-1', status: 'APPROVED' });

    // The guard was actually consulted…
    expect(mockTableExists).toHaveBeenCalledWith('assessment_workflows');
    // …and the executed SQL must NOT reference the absent table.
    expect(mockDbAll).toHaveBeenCalledTimes(1);
    const executedSql = String(mockDbAll.mock.calls[0][0]);
    expect(executedSql).not.toMatch(/assessment_workflows/i);
    expect(executedSql).toMatch(/FROM\s+assessments\b/i);
  });

  it('applies the status filter without the workflow table (NewReport flow)', async () => {
    const app = await mountApp();
    // The exact live call: NewReportModal → /api/assessments?status=APPROVED.
    const res = await request(app).get('/api/assessments').query({ status: 'APPROVED' });

    expect(res.status).toBe(200);
    expect(res.body.assessments).toHaveLength(1);
    const executedSql = String(mockDbAll.mock.calls[0][0]);
    expect(executedSql).not.toMatch(/assessment_workflows/i);
    // Status filter still applied, against a.status (no COALESCE with w.status).
    expect(executedSql).toMatch(/UPPER\(a\.status\)\s*=/i);
  });
});
