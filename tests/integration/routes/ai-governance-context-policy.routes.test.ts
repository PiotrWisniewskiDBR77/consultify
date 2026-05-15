import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  userId: 'u-1' as string | null,
  organizationId: 'org-1' as string | null,
  role: 'ADMIN' as string | null,
}));

const getOrgContextPolicyMock = vi.fn(async () => ({ categories: {}, piiRedaction: 'inherit' }));
const updateOrgContextPolicyMock = vi.fn(async () => undefined);
const getEffectivePolicyMock = vi.fn(async () => ({ internetEnabled: true }));
const getPolicySummaryMock = vi.fn(async () => ({
  currentLevel: 'balanced',
  description: 'Balanced',
  internetEnabled: true,
  auditRequired: true,
}));
const updatePolicyMock = vi.fn(async () => undefined);

vi.mock('../../../server/src/middleware/auth.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/middleware/auth.middleware.js'
  )) as Record<string, unknown>;
  return {
    ...actual,
    verifyToken: (req: any, _res: any, next: any) => {
      req.user = authState.userId
        ? {
            id: authState.userId,
            organizationId: authState.organizationId,
            role: authState.role || 'ADMIN',
          }
        : undefined;
      next();
    },
  };
});

vi.mock('../../../server/src/middleware/rbac.middleware.js', () => ({
  requireRole:
    (...requiredRoles: string[]) =>
    (req: any, res: any, next: any) => {
      const role = String(req.user?.role || '').toLowerCase();
      if (!requiredRoles.map((r) => r.toLowerCase()).includes(role)) {
        return res.status(403).json({ error: 'Insufficient role', code: 'RBAC_INSUFFICIENT_ROLE' });
      }
      next();
    },
}));

vi.mock('../../../server/src/services/ai/contextGovernance.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/services/ai/contextGovernance.js'
  )) as Record<string, unknown>;
  return {
    ...actual,
    getOrgContextPolicy: (...args: unknown[]) => getOrgContextPolicyMock(...args),
    updateOrgContextPolicy: (...args: unknown[]) => updateOrgContextPolicyMock(...args),
  };
});

vi.mock('../../../server/src/services/aiPolicyEngine.js', () => ({
  default: {
    getEffectivePolicy: (...args: unknown[]) => getEffectivePolicyMock(...args),
    getPolicySummary: (...args: unknown[]) => getPolicySummaryMock(...args),
    updatePolicy: (...args: unknown[]) => updatePolicyMock(...args),
  },
}));

vi.mock('../../../server/src/services/ai/runtimeWebSearchService.js', () => ({
  getRuntimeWebSearchStatus: () => ({ available: true }),
}));

const { default: aiGovernanceRouter } = await import('../../../server/src/routes/ai-governance.routes.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/ai-governance', aiGovernanceRouter);
  return app;
}

describe('ai-governance context-policy routes', () => {
  beforeEach(() => {
    authState.userId = 'u-1';
    authState.organizationId = 'org-1';
    authState.role = 'ADMIN';
    vi.clearAllMocks();
  });

  it('returns 500 with code when context-policy persistence fails', async () => {
    updateOrgContextPolicyMock.mockRejectedValueOnce(new Error('db-write-failed'));
    const app = createApp();

    const res = await request(app)
      .put('/api/ai-governance/context-policy')
      .send({ retention: 'strict' });
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('CONTEXT_POLICY_PERSIST_FAILED');
    expect(res.body.error).toBe('Context policy could not be saved');
  });

  it('returns 500 with code when context-policy store is invalid', async () => {
    getOrgContextPolicyMock.mockRejectedValueOnce(new SyntaxError('invalid-json'));
    const app = createApp();

    const res = await request(app).get('/api/ai-governance/context-policy');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('CONTEXT_POLICY_INVALID_STORE');
    expect(res.body.error).toBe('Context policy store is invalid');
  });

  it('returns coded 400 when organization context is missing', async () => {
    authState.organizationId = null;
    const app = createApp();

    const getContextRes = await request(app).get('/api/ai-governance/context-policy');
    expect(getContextRes.status).toBe(400);
    expect(getContextRes.body.code).toBe('ORG_CONTEXT_REQUIRED');
    expect(getOrgContextPolicyMock).not.toHaveBeenCalled();

    const putContextRes = await request(app)
      .put('/api/ai-governance/context-policy')
      .send({ retention: 'strict' });
    expect(putContextRes.status).toBe(400);
    expect(putContextRes.body.code).toBe('ORG_CONTEXT_REQUIRED');
    expect(updateOrgContextPolicyMock).not.toHaveBeenCalled();

    const getPolicyRes = await request(app).get('/api/ai-governance/policy');
    expect(getPolicyRes.status).toBe(400);
    expect(getPolicyRes.body.code).toBe('ORG_CONTEXT_REQUIRED');
    expect(getEffectivePolicyMock).not.toHaveBeenCalled();
    expect(getPolicySummaryMock).not.toHaveBeenCalled();
  });

  it('returns coded 500 when policy read fails', async () => {
    getEffectivePolicyMock.mockRejectedValueOnce(new Error('policy-read-failed'));
    const app = createApp();

    const res = await request(app).get('/api/ai-governance/policy');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('AI_GOVERNANCE_ORG_POLICY_READ_FAILED');
    expect(res.body.error).toBe('AI governance policy could not be loaded');
  });

  it('returns coded 500 when policy update fails', async () => {
    updatePolicyMock.mockRejectedValueOnce(new Error('policy-update-failed'));
    const app = createApp();

    const res = await request(app).put('/api/ai-governance/policy').send({ internetEnabled: false });
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('AI_GOVERNANCE_ORG_POLICY_UPDATE_FAILED');
    expect(res.body.error).toBe('AI governance policy could not be updated');
  });
});
