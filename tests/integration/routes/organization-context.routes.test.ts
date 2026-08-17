import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildResolvedContext = vi.fn();
const listTimeline = vi.fn();
const listClaims = vi.fn();
const rebuildSnapshot = vi.fn();

vi.mock('../../../server/src/middleware/auth.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/middleware/auth.middleware.js'
  )) as any;
  return {
    ...actual,
    verifyToken: (req: any, _res: any, next: any) => {
      const role = req.headers['x-test-role'] || 'ADMIN';
      req.user = { id: 'user-1', organizationId: 'org-1', role };
      req.userId = 'user-1';
      req.organizationId = 'org-1';
      next();
    },
    validateOrgMembership: (_req: any, _res: any, next: any) => next(),
  };
});

vi.mock('../../../server/src/services/organizationContext/OrganizationContextService.js', () => ({
  default: {
    buildResolvedContext: (...args: any[]) => buildResolvedContext(...args),
    listTimeline: (...args: any[]) => listTimeline(...args),
    listClaims: (...args: any[]) => listClaims(...args),
    rebuildSnapshot: (...args: any[]) => rebuildSnapshot(...args),
  },
}));

const { default: organizationContextRouter } =
  await import('../../../server/src/routes/organization-context.routes.ts');

describe('Organization context routes', () => {
  const makeApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/api/organization-context', organizationContextRouter);
    return app;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    buildResolvedContext.mockResolvedValue({
      counts: { items: 2, claims: 3, conflicts: 1 },
      trust: { mfa: { required: true, gracePeriodDays: 7, managedBy: 'admin' } },
      conflicts: [{ claimPath: 'profile.industry', values: ['A', 'B'], sourceTypes: ['chat'] }],
      snapshotUpdatedAt: '2026-03-12T13:00:00.000Z',
    });
    listTimeline.mockResolvedValue([{ id: 'item-1', summary: 'Saved from chat' }]);
    listClaims.mockResolvedValue([{ id: 'claim-1', claimPath: 'chat.explicitContext' }]);
    rebuildSnapshot.mockResolvedValue(undefined);
  });

  it('returns resolved context, timeline, and claims', async () => {
    const app = makeApp();

    const [contextRes, timelineRes, claimsRes] = await Promise.all([
      request(app).get('/api/organization-context'),
      request(app).get('/api/organization-context/timeline?limit=8'),
      request(app).get('/api/organization-context/claims?limit=8'),
    ]);

    expect(contextRes.status).toBe(200);
    expect(contextRes.body.counts.claims).toBe(3);
    expect(contextRes.body.trust.mfa.required).toBe(true);
    expect(timelineRes.status).toBe(200);
    expect(timelineRes.body.timeline).toEqual([{ id: 'item-1', summary: 'Saved from chat' }]);
    expect(claimsRes.status).toBe(200);
    expect(claimsRes.body.claims).toEqual([{ id: 'claim-1', claimPath: 'chat.explicitContext' }]);
  });

  it('allows admins to rebuild snapshot', async () => {
    const res = await request(makeApp()).post('/api/organization-context/rebuild');

    expect(res.status).toBe(200);
    expect(rebuildSnapshot).toHaveBeenCalledWith('org-1');
    expect(res.body).toEqual({
      ok: true,
      rebuiltAt: '2026-03-12T13:00:00.000Z',
      counts: { items: 2, claims: 3, conflicts: 1 },
    });
  });

  it('blocks rebuild for non-admin roles', async () => {
    const res = await request(makeApp())
      .post('/api/organization-context/rebuild')
      .set('x-test-role', 'member');

    expect(res.status).toBe(403);
    expect(rebuildSnapshot).not.toHaveBeenCalled();
  });
});
