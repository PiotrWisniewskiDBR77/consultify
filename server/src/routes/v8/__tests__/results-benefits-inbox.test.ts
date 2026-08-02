/**
 * M14 → M15 closure-handoff benefits inbox (Decision B1b) — reader route tests.
 *
 * Covers the three routes added to results.routes.ts:
 *   GET  /api/v8/results/benefits/inbox
 *   POST /api/v8/results/benefits/:benefitId/promote
 *   POST /api/v8/results/benefits/:benefitId/dismiss
 *
 * Focus: list shape, promote (create sustainment KPI + mark benefit promoted),
 * promote dedup (idempotency), and dismiss.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbRun = vi.fn();
const mockDbGet = vi.fn();
const mockDbAll = vi.fn();
const mockCreateKpiDefinition = vi.fn();

vi.mock('../../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
}));

// RES-02: promote now mints the sustainment KPI through kpiDefinitionService
// (the canonical writer) instead of an inline INSERT INTO initiative_kpis in
// this router.
vi.mock('../../../services/results/kpiDefinitionService.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../../services/results/kpiDefinitionService.js')
  >('../../../services/results/kpiDefinitionService.js');
  return {
    ...actual,
    createDefinition: (...args: unknown[]) => mockCreateKpiDefinition(...args),
  };
});

vi.mock('../../../services/v8/featureFlagService.js', () => ({
  getV8Flags: vi.fn().mockResolvedValue({ v8_enabled: true }),
  getAllOrgFlags: vi.fn().mockResolvedValue([]),
  setV8OrgFlag: vi.fn().mockResolvedValue({}),
  isV8Enabled: vi.fn().mockResolvedValue(true),
  isV8ShadowMode: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../../utils/v8MetricsStore.js', () => ({
  recordV8Request: vi.fn(),
  getV8MetricsSnapshot: vi.fn().mockReturnValue({}),
}));

vi.mock('../../../middleware/v8Metrics.middleware.js', () => ({
  v8MetricsMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

let mockUser: {
  id: string;
  role: string;
  organizationId: string;
  isSuperAdmin: boolean;
} | null = null;

vi.mock('../../../middleware/auth.middleware.js', () => {
  const attach = (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    req.can = () => true;
    next();
  };
  return {
    default: attach,
    verifyToken: attach,
    requireSuperAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
    requireOrganization: (_req: unknown, _res: unknown, next: () => void) => next(),
    isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
  };
});

import v8Router from '../index.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8', v8Router);
  return app;
}

const ORG = '00000000-0000-4000-8000-000000000099';
const UID = 'user-benefits-v8';
const SOURCE = 'M14_CLOSURE_HANDOFF';

describe('V8 results — M14 closure-handoff benefits inbox', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: UID, role: 'ADMIN', organizationId: ORG, isSuperAdmin: false };
    mockDbRun.mockResolvedValue({ changes: 1 });
    app = createApp();
  });

  describe('GET /benefits/inbox', () => {
    it('returns closure-handoff benefits mapped to inbox items', async () => {
      mockDbAll.mockResolvedValueOnce([
        {
          id: 'ben-1',
          initiative_id: 'init-1',
          name: 'Annual savings',
          description: 'Save money',
          kpi_id: 'kpi-src-1',
          target_value: 120000,
          status: 'tracking',
          created_at: '2026-06-30T10:00:00.000Z',
          initiative_name: 'Cost program',
          initiative_closed_at: '2026-06-29T00:00:00.000Z',
          source_kpi_unit: 'PLN',
        },
      ]);

      const res = await request(app).get('/api/v8/results/benefits/inbox');

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      const item = res.body.data.items[0];
      expect(item).toMatchObject({
        id: 'ben-1',
        initiativeId: 'init-1',
        initiativeName: 'Cost program',
        kpiName: 'Annual savings',
        unit: 'PLN',
        targetValue: 120000,
        closedAt: '2026-06-29T00:00:00.000Z',
      });
      // Query must filter by the closure source tag.
      const sqlArgs = mockDbAll.mock.calls[0];
      expect(String(sqlArgs?.[0])).toContain('source_tag');
      expect(sqlArgs?.[1]).toContain(SOURCE);
    });

    it('returns an empty list when there are no closure benefits', async () => {
      mockDbAll.mockResolvedValueOnce([]);
      const res = await request(app).get('/api/v8/results/benefits/inbox');
      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([]);
    });

    it('returns 500 when the read fails', async () => {
      mockDbAll.mockRejectedValueOnce(new Error('db down'));
      const res = await request(app).get('/api/v8/results/benefits/inbox');
      expect(res.status).toBe(500);
      expect(res.body.code).toBe('RESULTS_BENEFITS_INBOX_READ_FAILED');
    });
  });

  describe('POST /benefits/:benefitId/promote', () => {
    it('creates a sustainment KPI and marks the benefit promoted', async () => {
      // 1) benefit lookup, 2) dedup lookup (no existing KPI)
      mockDbGet
        .mockResolvedValueOnce({
          id: 'ben-1',
          initiative_id: 'init-1',
          name: 'Annual savings',
          description: 'Save money',
          kpi_id: 'kpi-src-1',
          target_value: 120000,
          status: 'tracking',
          source_tag: SOURCE,
        })
        .mockResolvedValueOnce(null);
      mockCreateKpiDefinition.mockResolvedValueOnce({ id: 'new-sustainment-kpi' });

      const res = await request(app).post('/api/v8/results/benefits/ben-1/promote');

      expect(res.status).toBe(201);
      expect(res.body.data.alreadyPromoted).toBe(false);
      expect(res.body.data.kpiId).toBe('new-sustainment-kpi');

      // RES-02: minted through kpiDefinitionService, not an inline INSERT —
      // no direct SQL against initiative_kpis in this router anymore.
      expect(mockCreateKpiDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORG,
          initiativeId: 'init-1',
          name: 'Annual savings',
        })
      );
      const runSqls = mockDbRun.mock.calls.map((c) => String(c[0]));
      expect(runSqls.some((s) => s.includes('INSERT INTO initiative_kpis'))).toBe(false);
      expect(
        runSqls.some((s) => s.includes('UPDATE initiative_benefits') && s.includes('promoted'))
      ).toBe(true);
    });

    it('is idempotent when the benefit is already promoted (no new KPI)', async () => {
      // 1) benefit lookup (already promoted), 2) existing-KPI lookup
      mockDbGet
        .mockResolvedValueOnce({
          id: 'ben-1',
          initiative_id: 'init-1',
          name: 'Annual savings',
          description: null,
          kpi_id: 'kpi-src-1',
          target_value: 120000,
          status: 'promoted',
          source_tag: SOURCE,
        })
        .mockResolvedValueOnce({ id: 'kpi-existing' });

      const res = await request(app).post('/api/v8/results/benefits/ben-1/promote');

      expect(res.status).toBe(200);
      expect(res.body.data.alreadyPromoted).toBe(true);
      expect(res.body.data.kpiId).toBe('kpi-existing');
      // No KPI creation on the idempotent path.
      expect(mockCreateKpiDefinition).not.toHaveBeenCalled();
    });

    it('reuses an existing sustainment KPI (dedup) instead of creating a duplicate', async () => {
      // 1) benefit lookup (tracking), 2) dedup lookup finds a KPI with same name
      mockDbGet
        .mockResolvedValueOnce({
          id: 'ben-1',
          initiative_id: 'init-1',
          name: 'Annual savings',
          description: null,
          kpi_id: 'kpi-src-1',
          target_value: 120000,
          status: 'tracking',
          source_tag: SOURCE,
        })
        .mockResolvedValueOnce({ id: 'kpi-dup' });

      const res = await request(app).post('/api/v8/results/benefits/ben-1/promote');

      expect(res.status).toBe(201);
      expect(res.body.data.kpiId).toBe('kpi-dup');
      // No new KPI creation; benefit is still marked promoted.
      expect(mockCreateKpiDefinition).not.toHaveBeenCalled();
      const runSqls = mockDbRun.mock.calls.map((c) => String(c[0]));
      expect(
        runSqls.some((s) => s.includes('UPDATE initiative_benefits') && s.includes('promoted'))
      ).toBe(true);
    });

    it('404s when the benefit is not a closure-handoff benefit', async () => {
      mockDbGet.mockResolvedValueOnce({
        id: 'ben-1',
        initiative_id: 'init-1',
        name: 'x',
        description: null,
        kpi_id: null,
        target_value: null,
        status: 'tracking',
        source_tag: null,
      });
      const res = await request(app).post('/api/v8/results/benefits/ben-1/promote');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('RESULTS_BENEFIT_NOT_FOUND');
    });
  });

  describe('POST /benefits/:benefitId/dismiss', () => {
    it('marks the benefit dismissed', async () => {
      mockDbGet.mockResolvedValueOnce({ id: 'ben-1', source_tag: SOURCE });
      const res = await request(app).post('/api/v8/results/benefits/ben-1/dismiss');
      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
      const runSqls = mockDbRun.mock.calls.map((c) => String(c[0]));
      expect(
        runSqls.some((s) => s.includes('UPDATE initiative_benefits') && s.includes('dismissed'))
      ).toBe(true);
    });

    it('404s for a non-closure benefit', async () => {
      mockDbGet.mockResolvedValueOnce({ id: 'ben-1', source_tag: null });
      const res = await request(app).post('/api/v8/results/benefits/ben-1/dismiss');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('RESULTS_BENEFIT_NOT_FOUND');
    });
  });
});
