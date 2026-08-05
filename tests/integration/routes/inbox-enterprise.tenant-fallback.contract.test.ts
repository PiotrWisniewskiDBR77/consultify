/**
 * M02-P03 / finding M02-006 — inbox-enterprise.routes.ts `requireUser` used to
 * fall back to a client-supplied `x-organization-id` header or
 * `?organizationId=` query param whenever the server-resolved org context
 * (`req.user.organizationId` / `req.organizationId`, both set exclusively by
 * `attachUser` in auth.middleware.ts from the verified JWT / confirmed org
 * membership / active-membership fallback) was empty. That happens for any
 * authenticated caller with no resolvable active org membership — a real,
 * reachable state, not a hypothetical — and every one of the ~25 org-scoped
 * enterprise Inbox endpoints in this router trusted it. Fixed by removing the
 * header/query fallback: with no server-resolved org, every route now fails
 * closed with 401 instead of trusting anything the client sent.
 *
 * Contract-level (mocked verifyToken + mocked service layer), no DB —
 * proves the ROUTING decision (which orgId reaches the service layer), not
 * the service's own tenant-scoping (covered separately in
 * m02p03-inbox-lifecycle.realdb.test.ts).
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetInboxTable = vi.hoisted(() => vi.fn().mockResolvedValue({ items: [], total: 0 }));

vi.mock('../../../server/src/services/inboxEnterpriseService.js', () => ({
  inboxEnterpriseService: {
    getInboxTable: (...a: unknown[]) => mockGetInboxTable(...a),
  },
}));

// Simulates a request whose JWT verified fine but carries no resolvable org
// context at all (e.g. a user with no ACTIVE organization_members row) —
// attachUser's real resolution logic can legitimately land here.
let mockOrgId: string | undefined;
let mockUserId: string | undefined;
vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: unknown, next: () => void) => {
    req.userId = mockUserId;
    req.organizationId = mockOrgId;
    req.user = mockUserId ? { id: mockUserId, organizationId: mockOrgId || '' } : undefined;
    next();
  },
}));

import inboxEnterpriseRoutes from '../../../server/src/routes/inbox-enterprise.routes.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/inbox-enterprise', inboxEnterpriseRoutes);
  return app;
}

describe('inbox-enterprise.routes requireUser — forged/client-supplied org id (M02-006)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrgId = undefined;
    mockUserId = undefined;
  });

  it('a caller with NO server-resolved org context and a forged x-organization-id header is rejected, not routed to the forged org', async () => {
    mockUserId = 'user-no-org';
    mockOrgId = undefined; // server could not resolve any org for this user

    const res = await request(buildApp())
      .get('/api/inbox-enterprise/table')
      .set('x-organization-id', 'victim-org');

    expect(res.status).toBe(401);
    expect(mockGetInboxTable).not.toHaveBeenCalled();
  });

  it('a caller with NO server-resolved org context and a forged ?organizationId= query param is rejected, not routed to the forged org', async () => {
    mockUserId = 'user-no-org';
    mockOrgId = undefined;

    const res = await request(buildApp()).get(
      '/api/inbox-enterprise/table?organizationId=victim-org'
    );

    expect(res.status).toBe(401);
    expect(mockGetInboxTable).not.toHaveBeenCalled();
  });

  it('a caller with a server-resolved org is routed to THAT org even if a different org is forged in the header', async () => {
    mockUserId = 'user-org-a';
    mockOrgId = 'org-a';

    const res = await request(buildApp())
      .get('/api/inbox-enterprise/table')
      .set('x-organization-id', 'org-b-victim');

    expect(res.status).toBe(200);
    expect(mockGetInboxTable).toHaveBeenCalledTimes(1);
    expect(mockGetInboxTable.mock.calls[0][1]).toBe('org-a');
  });

  it('the honest, un-forged path still works end to end', async () => {
    mockUserId = 'user-org-a';
    mockOrgId = 'org-a';

    const res = await request(buildApp()).get('/api/inbox-enterprise/table');

    expect(res.status).toBe(200);
    expect(mockGetInboxTable.mock.calls[0][1]).toBe('org-a');
  });
});
