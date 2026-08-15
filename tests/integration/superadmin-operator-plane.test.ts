import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from './_helpers/testApp';

const { dbAll, dbGet } = vi.hoisted(() => ({
  dbAll: vi.fn(),
  dbGet: vi.fn(),
}));

vi.mock('../../server/src/utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  get: (...args: any[]) => dbGet(...args),
  run: vi.fn(),
}));

vi.mock('../../server/src/controllers/SuperAdminController.js', () => ({
  default: new Proxy(
    {},
    {
      get: () => (_req: any, res: any) => res.status(501).json({ error: 'stub' }),
    }
  ),
}));

vi.mock('../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../server/src/middleware/superAdmin.middleware.js', () => ({
  verifySuperAdmin: (_req: any, _res: any, next: any) => next(),
  requireSuperAdminCapability: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
}));

async function loadSuperadminRouter() {
  return (await import('../../server/src/routes/superadmin.routes.ts')).default;
}

describe('Superadmin operator plane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbAll.mockResolvedValue([]);
    dbGet.mockResolvedValue(null);
  });

  it('GET /operator/overview returns aggregated operator posture', async () => {
    dbGet.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM admin_audit_logs')) return { total: 10, unresolved: 3, critical: 1, high: 2 };
      if (sql.includes('FROM approval_requests')) return { pending: 4, approved: 6, rejected: 1 };
      if (sql.includes('FROM admin_sessions')) {
        return { total: 5, active: 3, mfaVerified: 2, jitActive: 1, breakGlassActive: 1 };
      }
      if (sql.includes('FROM security_incidents')) return { critical: 1, high: 2 };
      if (sql.includes('FROM security_events')) return { today: 9 };
      if (sql.includes('FROM org_policies')) return { legalHolds: 2, residencyReview: 1 };
      if (params?.[0] === 'platform:mfa_override') return { value: 'enforced' };
      if (params?.[0] === 'platform:sso_override') return { value: 'disabled' };
      return null;
    });

    const router = await loadSuperadminRouter();
    const app = makeTestApp({
      mountPath: '/api/superadmin',
      router,
      beforeMount: (a) =>
        a.use((req, _res, next) => {
          (req as any).user = { id: 'u1', organizationId: 'org-1', role: 'SUPERADMIN' };
          next();
        }),
    });

    const res = await request(app).get('/api/superadmin/operator/overview').expect(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        audit: expect.objectContaining({ unresolved: 3 }),
        approvals: expect.objectContaining({ pending: 4 }),
        sessions: expect.objectContaining({ jitActive: 1, breakGlassActive: 1 }),
        compliance: expect.objectContaining({ legalHolds: 2 }),
        overrides: expect.objectContaining({ mfa: 'enforced', sso: 'disabled' }),
      })
    );
  });

  it('GET /operator/timeline merges audit and approval lifecycle items', async () => {
    dbAll.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM audit_events')) {
        return [
          {
            id: 'ae-1',
            ts: '2026-04-11T09:00:00.000Z',
            action: 'platform.mfa_override',
            resource_type: 'platform',
            resource_id: 'global',
            metadata_json: JSON.stringify({ propagationState: 'propagated', recoveryPath: 'disable override' }),
          },
        ];
      }
      if (sql.includes('FROM approval_requests')) {
        return [
          {
            id: 'ar-1',
            status: 'pending',
            workflow_id: 'wf-1',
            requester_id: 'u-1',
            resolved_by: null,
            resolution_notes: null,
            created_at: '2026-04-11T10:00:00.000Z',
            resolved_at: null,
          },
        ];
      }
      return [];
    });

    const router = await loadSuperadminRouter();
    const app = makeTestApp({ mountPath: '/api/superadmin', router });
    const res = await request(app).get('/api/superadmin/operator/timeline?limit=10').expect(200);

    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toEqual(expect.objectContaining({ source: 'approval', state: 'requested' }));
    expect(res.body.items[1]).toEqual(expect.objectContaining({ source: 'audit', state: 'propagated' }));
  });

  it('GET /operator/policy-enforcement exposes drift summary', async () => {
    dbAll.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM llm_providers')) {
        return [{ id: 'p1', name: 'OpenAI', provider: 'openai', is_active: 1, health_status: 'degraded' }];
      }
      if (sql.includes('FROM integrations')) {
        return [
          { connector_type: 'slack', status: 'enabled', count: 2 },
          { connector_type: 'slack', status: 'disabled', count: 1 },
        ];
      }
      if (sql.includes("LIKE 'vw:%:status'")) {
        return [{ key: 'vw:researcher:status', value: 'suspended', updated_at: '2026-04-11T10:00:00Z' }];
      }
      if (sql.includes("platform:mfa_override")) {
        return [{ key: 'platform:mfa_override', value: 'enforced' }];
      }
      return [];
    });

    const router = await loadSuperadminRouter();
    const app = makeTestApp({ mountPath: '/api/superadmin', router });
    const res = await request(app).get('/api/superadmin/operator/policy-enforcement').expect(200);

    expect(res.body.health.status).toBe('degraded');
    expect(res.body.summary.drift).toBeGreaterThan(0);
    expect(res.body.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'provider:p1', drift: true }),
        expect.objectContaining({ id: 'connector:unknown', appliedState: 'partial', drift: true }),
      ])
    );
  });
});
