/**
 * P11 §5.1.3 — Two entry points create initiatives that are read through the
 * same V8 planning portfolio read path with consistent lifecycle normalization.
 *
 * Entry A: PMO create (simulated via direct INSERT, same as InitiativeController.createInitiative)
 * Entry B: Assessment-generated create (simulated via direct INSERT, same as
 *          assessmentInitiativeService.persistInitiatives)
 *
 * Both must appear in the V8 portfolio read with:
 *  - identical normalized status for the same raw DB status
 *  - displayStatus, p11LifecycleState, statusReadDrift fields present
 *  - consistent lifecycle mapping regardless of sourceType
 *
 * This test uses supertest against the real V8 router with mocked DB.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryAllMock = vi.fn();
const queryOneMock = vi.fn();

vi.mock('../../server/src/utils/queryHelpers.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/src/utils/queryHelpers.js')>();
  return {
    ...actual,
    queryAll: (...args: unknown[]) => queryAllMock(...args),
    queryOne: (...args: unknown[]) => queryOneMock(...args),
  };
});

vi.mock('../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: vi.fn().mockResolvedValue(
    new Set([
      'id', 'name', 'title', 'status', 'priority', 'organization_id', 'project_id',
      'planned_start_date', 'planned_end_date', 'start_date', 'actual_end_date',
      'owner_business_id', 'owner_execution_id', 'source_type', 'source_id',
      'progress', 'created_at', 'updated_at', 'program_id', 'axis', 'area',
      'summary', 'hypothesis', 'business_value', 'cost_capex', 'cost_opex',
      'expected_roi', 'value_driver', 'confidence_level', 'value_timing',
      'current_stage', 'actual_start_date',
    ])
  ),
}));

let mockUser: { id: string; role: string; organizationId: string; isSuperAdmin: boolean } | null =
  null;

vi.mock('../../server/src/middleware/auth.middleware.js', () => ({
  default: (req: any, res: any, next: () => void) => {
    if (!mockUser) { res.status(401).json({ error: 'No token' }); return; }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    req.can = () => true;
    next();
  },
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) { res.status(401).json({ error: 'No token' }); return; }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    req.can = () => true;
    next();
  },
  requireSuperAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireOrganization: (_req: unknown, _res: unknown, next: () => void) => next(),
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../server/src/services/v8/featureFlagService.js', () => ({
  getV8Flags: vi.fn().mockResolvedValue({ v8_enabled: true }),
  getAllOrgFlags: vi.fn().mockResolvedValue([]),
  setV8OrgFlag: vi.fn().mockResolvedValue({}),
  isV8Enabled: vi.fn().mockResolvedValue(true),
  isV8ShadowMode: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../server/src/utils/v8MetricsStore.js', () => ({
  recordV8Request: vi.fn(),
  getV8MetricsSnapshot: vi.fn().mockReturnValue({}),
}));

vi.mock('../../server/src/middleware/v8Metrics.middleware.js', () => ({
  v8MetricsMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import v8Router from '../../server/src/routes/v8/index.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8', v8Router);
  return app;
}

const ORG = '00000000-0000-4000-8000-000000000099';
const UID = 'user-p11-e2e';

const PMO_INITIATIVE = {
  id: 'init-pmo-001',
  organization_id: ORG,
  project_id: 'proj-1',
  program_id: null,
  title: 'PMO-Created Initiative',
  name: 'PMO-Created Initiative',
  axis: 'operational',
  area: 'ops',
  summary: 'Created via PMO module',
  hypothesis: null,
  status: 'EXECUTING',
  progress: 45,
  current_stage: null,
  business_value: 100000,
  cost_capex: 50000,
  cost_opex: 20000,
  expected_roi: 30,
  value_driver: 'efficiency',
  confidence_level: 'high',
  value_timing: 'short',
  planned_start_date: '2026-01-01',
  planned_end_date: '2026-06-01',
  actual_start_date: '2026-01-15',
  actual_end_date: null,
  priority: 'HIGH',
  source_type: 'manual',
  source_id: null,
  owner_business_id: 'owner-biz-1',
  ob_first_name: 'Jan',
  ob_last_name: 'Kowalski',
  ob_avatar: null,
  owner_execution_id: 'owner-exec-1',
  oe_first_name: 'Anna',
  oe_last_name: 'Nowak',
  oe_avatar: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-03-15T10:00:00.000Z',
};

const ASSESSMENT_INITIATIVE = {
  ...PMO_INITIATIVE,
  id: 'init-assess-001',
  title: 'Assessment-Generated Initiative',
  name: 'Assessment-Generated Initiative',
  summary: 'Created via assessment module',
  source_type: 'assessment',
  source_id: 'assess-abc-123',
  status: 'EXECUTING',
  created_at: '2026-01-05T00:00:00.000Z',
  updated_at: '2026-03-20T10:00:00.000Z',
};

const DRIFT_INITIATIVE = {
  ...PMO_INITIATIVE,
  id: 'init-drift-001',
  title: 'Drift Initiative',
  name: 'Drift Initiative',
  status: 'UNKNOWN_LEGACY_STATUS',
  source_type: 'tool',
  source_id: 'tool-xyz',
};

describe('P11 §5.1.3 — two entry points → same V8 portfolio read truth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: UID, role: 'ADMIN', organizationId: ORG, isSuperAdmin: false };
  });

  it('PMO and assessment initiatives appear in portfolio with identical lifecycle fields for same raw status', async () => {
    queryAllMock.mockImplementation(async (sql: string) => {
      if (String(sql).includes('FROM initiatives')) {
        return [PMO_INITIATIVE, ASSESSMENT_INITIATIVE];
      }
      return [];
    });

    const app = createApp();
    const res = await request(app).get('/api/v8/planning/initiatives/portfolio');

    expect(res.status).toBe(200);

    const initiatives = res.body.data?.initiatives;
    expect(initiatives).toBeDefined();
    expect(initiatives.length).toBeGreaterThanOrEqual(2);

    const pmo = initiatives.find((i: any) => i.id === 'init-pmo-001');
    const assess = initiatives.find((i: any) => i.id === 'init-assess-001');

    expect(pmo).toBeDefined();
    expect(assess).toBeDefined();

    expect(pmo.status).toBe(assess.status);
    expect(pmo.status).toBe('EXECUTING');

    expect(pmo.displayStatus).toBe(assess.displayStatus);
    expect(pmo.p11LifecycleState).toBe(assess.p11LifecycleState);
    expect(pmo.p11LifecycleState).toBe('executing');

    expect(pmo.statusReadDrift).toBe(false);
    expect(assess.statusReadDrift).toBe(false);
  });

  it('drift initiative shows statusReadDrift=true on portfolio list', async () => {
    queryAllMock.mockImplementation(async (sql: string) => {
      if (String(sql).includes('FROM initiatives')) {
        return [DRIFT_INITIATIVE];
      }
      return [];
    });

    const app = createApp();
    const res = await request(app).get('/api/v8/planning/initiatives/portfolio');

    expect(res.status).toBe(200);

    const initiatives = res.body.data?.initiatives;
    const drift = initiatives?.find((i: any) => i.id === 'init-drift-001');

    expect(drift).toBeDefined();
    expect(drift.statusReadDrift).toBe(true);
    expect(drift.p11LifecycleState).toBe('intake');
    expect(drift.displayStatus).toBe('DRAFT');
  });

  it('handoff from either entry point produces identical envelope structure', async () => {
    for (const init of [PMO_INITIATIVE, ASSESSMENT_INITIATIVE]) {
      queryOneMock.mockResolvedValueOnce(init);

      const app = createApp();
      const res = await request(app).get(
        `/api/v8/planning/initiatives/${init.id}/handoff?kind=execution`
      );

      expect(res.status).toBe(200);
      const h = res.body.data?.handoff;
      expect(h?.initiativeId).toBe(init.id);
      expect(h?.initiativeLifecycleState).toBe('executing');
      expect(h?.initiativeOwnerId).toBeTruthy();
      expect(h?.executionIntent).toBeTruthy();
      expect(Array.isArray(h?.contextPack)).toBe(true);
      expect(h.contextPack.length).toBeLessThanOrEqual(5);
      expect(h?.handoffAt).toBeTruthy();
    }
  });

  it('all lifecycle states normalize consistently regardless of sourceType', async () => {
    const statuses = [
      'DRAFT', 'PENDING_REVIEW', 'REVIEW', 'PROMOTED', 'PLANNING',
      'APPROVED', 'SCHEDULED', 'EXECUTING', 'BLOCKED', 'DONE',
      'TRACKING', 'CANCELLED', 'ARCHIVED',
    ];

    for (const rawStatus of statuses) {
      const pmoRow = { ...PMO_INITIATIVE, id: `pmo-${rawStatus}`, status: rawStatus, source_type: 'manual' };
      const assessRow = { ...ASSESSMENT_INITIATIVE, id: `assess-${rawStatus}`, status: rawStatus, source_type: 'assessment' };

      queryAllMock.mockResolvedValueOnce([pmoRow, assessRow]);

      const app = createApp();
      const res = await request(app).get('/api/v8/planning/initiatives/portfolio');

      expect(res.status).toBe(200);
      const inits = res.body.data?.initiatives;
      const pmo = inits?.find((i: any) => i.id === `pmo-${rawStatus}`);
      const assess = inits?.find((i: any) => i.id === `assess-${rawStatus}`);

      expect(pmo?.status).toBe(assess?.status);
      expect(pmo?.displayStatus).toBe(assess?.displayStatus);
      expect(pmo?.p11LifecycleState).toBe(assess?.p11LifecycleState);
      expect(pmo?.statusReadDrift).toBe(assess?.statusReadDrift);
    }
  });
});
