import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

let mockUser: any = {
  id: 'user-1',
  role: 'ADMIN',
  organizationId: 'org-1',
};

vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.user = mockUser;
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    next();
  },
}));

vi.mock('../../../../server/src/middleware/requireAudit.middleware.js', () => ({
  requireAudit: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/services/notificationService.js', () => ({
  send: vi.fn(),
}));

// PRESENTATIONS-AUTH-WALL-001: the writer wall asks this resolver whether the
// caller is a public demo principal working inside its own session tenant.
// Default here is "ordinary account", so the membership branch is what these
// cases exercise.
vi.mock('../../../../server/src/services/demo/demoPrincipalGuard.js', () => ({
  resolvePublicDemoPrincipal: vi.fn(async () => ({ isPublicDemoPrincipal: false, session: null })),
}));

vi.mock('../../../../server/src/services/OrgPoliciesService.js', () => ({
  requireNoLegalHold: vi.fn(),
  OrgPoliciesError: class OrgPoliciesError extends Error {},
}));

vi.mock('../../../../server/src/services/presentationGeneratorService.js', () => ({
  generateDeck: vi.fn(),
  generateOutline: vi.fn(),
}));

vi.mock('../../../../server/src/services/v8/artifactRegistryService.js', () => ({
  getArtifactByOrigin: vi.fn(),
}));

vi.mock('../../../../server/src/services/v8/reportsPresModelService.js', () => ({
  recordCompletedExport: vi.fn(),
}));

// `membershipStatus` steers the wall's `organization_members` lookup:
//   'ACTIVE'  -> the caller is a live member (wall passes, capability decides)
//   null      -> no membership row (wall denies)
//   'THROW'   -> the lookup itself fails (wall must fail CLOSED)
let membershipStatus: string | null | 'THROW' = 'ACTIVE';

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn().mockResolvedValue([]),
  get: vi.fn(async (sql: string) => {
    if (typeof sql === 'string' && sql.includes('organization_members')) {
      if (membershipStatus === 'THROW') throw new Error('membership lookup unavailable');
      return membershipStatus ? { status: membershipStatus } : null;
    }
    return null;
  }),
  run: vi.fn().mockResolvedValue(undefined),
}));

async function mountApp() {
  const { default: router } = await import('../../../../server/src/routes/presentations.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/presentations', router);
  return app;
}

describe('presentations routes org guard', () => {
  it('returns 403 RBAC code when authenticated user has no organization', async () => {
    mockUser = {
      id: 'user-1',
      role: 'ADMIN',
      organizationId: '',
    };
    const { default: router } = await import('../../../../server/src/routes/presentations.routes.js');
    const app = express();
    app.use('/presentations', router);

    const res = await request(app).get('/presentations/templates');
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      error: 'Organization access required',
      code: 'RBAC_ORGANIZATION_ACCESS_REQUIRED',
    });
  });

  // ===========================================================================
  // PRESENTATIONS-AUTH-WALL-001 — the writer wall
  // ===========================================================================
  it('denies a VIEWER on a writer even with an ACTIVE membership', async () => {
    mockUser = { id: 'user-1', role: 'VIEWER', organizationId: 'org-1' };
    membershipStatus = 'ACTIVE';

    const res = await request(await mountApp())
      .put('/presentations/decks/deck-1/autosave')
      .send({ title: 'nope' });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('denies a writer when the caller has no ACTIVE membership row', async () => {
    mockUser = { id: 'user-1', role: 'ADMIN', organizationId: 'org-1' };
    membershipStatus = null;

    const res = await request(await mountApp())
      .put('/presentations/decks/deck-1/autosave')
      .send({ title: 'nope' });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
  });

  it('fails closed when the membership lookup itself throws', async () => {
    mockUser = { id: 'user-1', role: 'ADMIN', organizationId: 'org-1' };
    membershipStatus = 'THROW';

    const res = await request(await mountApp())
      .put('/presentations/decks/deck-1/autosave')
      .send({ title: 'nope' });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_LOOKUP_FAILED' });
  });

  it('leaves reads unwalled — a GET is not membership-rechecked', async () => {
    mockUser = { id: 'user-1', role: 'VIEWER', organizationId: 'org-1' };
    membershipStatus = null;

    const res = await request(await mountApp()).get('/presentations/templates');

    // The wall is writer-scoped: this read must not be turned into a 403 by it.
    expect(res.status).not.toBe(403);
  });
});
