import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { V8_PLANNING_READ_CONTRACT } from '../planning.routes.js';

const queryOneMock = vi.fn();

vi.mock('../../../utils/queryHelpers.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utils/queryHelpers.js')>();
  return {
    ...actual,
    queryOne: (...args: unknown[]) => queryOneMock(...args),
  };
});

let mockUser: {
  id: string;
  role: string;
  organizationId: string;
  isSuperAdmin: boolean;
} | null = null;

vi.mock('../../../middleware/auth.middleware.js', () => ({
  default: (req: any, res: any, next: () => void) => {
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
  },
  verifyToken: (req: any, res: any, next: () => void) => {
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
  },
  requireSuperAdmin: (req: any, res: any, next: () => void) => {
    if (!req.user?.isSuperAdmin) {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }
    next();
  },
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireOrganization: (_req: unknown, _res: unknown, next: () => void) => next(),
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

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

import v8Router from '../index.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8', v8Router);
  return app;
}

const ORG = '00000000-0000-4000-8000-000000000099';
const UID = 'user-p11-handoff';
const INIT = '00000000-0000-4000-8000-000000000077';

describe('P11 V8 planning handoff route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: UID, role: 'ADMIN', organizationId: ORG, isSuperAdmin: false };
    queryOneMock.mockImplementation(async (sql: string, params: unknown[]) => {
      if (String(sql).includes('FROM initiatives WHERE id')) {
        expect(params[0]).toBe(INIT);
        expect(params[1]).toBe(ORG);
        return {
          id: INIT,
          organization_id: ORG,
          title: 'Handoff initiative',
          status: 'PLANNING',
          owner_execution_id: UID,
          planned_start_date: '2026-01-01',
          planned_end_date: '2026-06-01',
          program_id: 'prog-1',
        };
      }
      return null;
    });
  });

  it('GET /api/v8/planning/initiatives/:id/handoff returns bounded envelope', async () => {
    const app = createApp();
    const res = await request(app).get(`/api/v8/planning/initiatives/${INIT}/handoff?kind=kpi`);

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_PLANNING_READ_CONTRACT);
    const h = res.body.data?.handoff;
    expect(h?.initiativeId).toBe(INIT);
    expect(h?.initiativeTitle).toBe('Handoff initiative');
    expect(h?.initiativeLifecycleState).toBe('planned');
    expect(h?.kpiIntent).toBeTruthy();
    expect(h?.executionIntent).toBeUndefined();
    expect(Array.isArray(h?.contextPack)).toBe(true);
    expect(h.contextPack.length).toBeLessThanOrEqual(5);
  });

  it('returns 404 when initiative missing', async () => {
    queryOneMock.mockResolvedValueOnce(null);
    const app = createApp();
    const res = await request(app).get(`/api/v8/planning/initiatives/${INIT}/handoff`);
    expect(res.status).toBe(404);
  });
});
