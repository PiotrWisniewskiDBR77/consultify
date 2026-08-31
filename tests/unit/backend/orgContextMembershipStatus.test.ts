/**
 * Regression tests for bug H2.13:
 * Security & Identity → API access showed "You do not have access to this
 * organization" (403 from orgContext.middleware) for a user who IS an OWNER
 * of the organization — because his organization_members.status was stored
 * as lowercase 'active' while resolveUserOrgAccess matched `om.status = 'ACTIVE'`
 * exactly. The auth layer (auth.middleware.ts) matches case-insensitively,
 * so the token resolved to that org, then orgContext denied it.
 *
 * These tests emulate the DB's case-sensitive string comparison: the mock
 * only returns a row whose status satisfies the exact predicate present in
 * the SQL. With the pre-fix query (`om.status = 'ACTIVE'`) the OWNER test
 * fails; with the fixed query (`UPPER(om.status) = 'ACTIVE'`) it passes.
 * Security invariants stay covered: non-members and non-ACTIVE statuses are
 * still denied.
 */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn(async () => []),
  get: vi.fn(async () => undefined),
  run: vi.fn(async () => ({ changes: 0 })),
}));

import { get as dbGet } from '../../../server/src/utils/DbPromise.js';
import orgContextMiddleware, {
  resolveUserOrgAccess,
} from '../../../server/src/middleware/orgContext.middleware.js';

// ==========================================
// FIXTURES — mirrors the live demo DB rows that reproduced H2.13
// ==========================================

const OWNER_USER_ID = 'owner-user-id';
const FOREIGN_USER_ID = 'foreign-user-id';
const SUSPENDED_USER_ID = 'suspended-user-id';
const CONSULTANT_USER_ID = 'consultant-user-id';
const ORG_ID = 'org-dbr77';

interface MembershipFixture {
  id: string;
  user_id: string;
  organization_id: string;
  role: string;
  status: string;
  permission_scope: string | null;
}

const memberships: MembershipFixture[] = [
  {
    id: 'membership-owner',
    user_id: OWNER_USER_ID,
    organization_id: ORG_ID,
    // The trigger of H2.13: lowercase status in real data.
    role: 'OWNER',
    status: 'active',
    permission_scope: null,
  },
  {
    id: 'membership-suspended',
    user_id: SUSPENDED_USER_ID,
    organization_id: ORG_ID,
    role: 'MEMBER',
    status: 'suspended',
    permission_scope: null,
  },
];

const consultantLinks = [
  {
    id: 'link-consultant',
    consultant_id: CONSULTANT_USER_ID,
    organization_id: ORG_ID,
    status: 'active', // lowercase, same class of data drift
    permission_scope: null,
  },
];

/**
 * Emulate the DB evaluating the status predicate exactly as written in SQL.
 * If the query uses the strict `x.status = 'ACTIVE'` form, only rows with
 * literal uppercase 'ACTIVE' match — the pre-fix behaviour.
 */
const statusSatisfiesSql = (sql: string, alias: string, status: string): boolean => {
  const caseInsensitive = new RegExp(
    String.raw`UPPER\(\s*${alias}\.status\s*\)\s*=\s*'ACTIVE'`,
    'i'
  ).test(sql);
  if (caseInsensitive) return status.toUpperCase() === 'ACTIVE';
  return status === 'ACTIVE';
};

const installDbMock = () => {
  (dbGet as unknown as Mock).mockImplementation(async (sql: string, params: unknown[]) => {
    const [userId, orgId] = (params || []) as string[];
    if (sql.includes('FROM organization_members')) {
      const row = memberships.find(
        (m) => m.user_id === userId && m.organization_id === orgId
      );
      if (!row || !statusSatisfiesSql(sql, 'om', row.status)) return undefined;
      return {
        id: row.id,
        role: row.role,
        status: row.status,
        permission_scope: row.permission_scope,
      };
    }
    if (sql.includes('FROM consultant_org_links')) {
      const row = consultantLinks.find(
        (l) => l.consultant_id === userId && l.organization_id === orgId
      );
      if (!row || !statusSatisfiesSql(sql, 'col', row.status)) return undefined;
      return { id: row.id, permission_scope: row.permission_scope, status: row.status };
    }
    return undefined;
  });
};

const buildRes = () => {
  const res: {
    statusCode: number | null;
    body: unknown;
    headersSent: boolean;
    status: (code: number) => typeof res;
    json: (body: unknown) => typeof res;
  } = {
    statusCode: null,
    body: null,
    headersSent: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      this.headersSent = true;
      return this;
    },
  };
  return res;
};

const buildReq = (userId: string, defaultOrgId: string) => ({
  method: 'GET',
  params: {},
  headers: {},
  user: { id: userId, organizationId: defaultOrgId },
});

describe('orgContext membership status casing (H2.13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installDbMock();
  });

  describe('resolveUserOrgAccess', () => {
    it("allows an OWNER whose membership status is lowercase 'active'", async () => {
      const access = await resolveUserOrgAccess(OWNER_USER_ID, ORG_ID);
      expect(access.allowed).toBe(true);
      expect(access.isMember).toBe(true);
      expect(access.role).toBe('OWNER');
      expect(access.membershipId).toBe('membership-owner');
    });

    it('denies a consultant-link-only user — Consultant Mode removed (DEC-116)', async () => {
      const access = await resolveUserOrgAccess(CONSULTANT_USER_ID, ORG_ID);
      expect(access.allowed).toBe(false);
    });

    it('still denies a user with no membership at all (negative / security)', async () => {
      const access = await resolveUserOrgAccess(FOREIGN_USER_ID, ORG_ID);
      expect(access.allowed).toBe(false);
    });

    it('still denies a non-ACTIVE membership regardless of casing (negative / security)', async () => {
      const access = await resolveUserOrgAccess(SUSPENDED_USER_ID, ORG_ID);
      expect(access.allowed).toBe(false);
    });

    it('denies when orgId does not match any membership of the user', async () => {
      const access = await resolveUserOrgAccess(OWNER_USER_ID, 'some-other-org');
      expect(access.allowed).toBe(false);
    });
  });

  describe('orgContextMiddleware end-to-end (the /api/api-keys path)', () => {
    it("attaches org context and calls next() for the OWNER with lowercase 'active' status", async () => {
      // /api/api-keys mounts orgContextMiddleware({ strictWrite: false }) with
      // no :orgId param and no allowed header → falls back to user default org.
      const middleware = orgContextMiddleware({ strictWrite: false });
      const req = buildReq(OWNER_USER_ID, ORG_ID) as never;
      const res = buildRes();
      const next = vi.fn();

      await middleware(req, res as never, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBeNull();
      const org = (req as { org?: { id: string; role: string; isMember: boolean } }).org;
      expect(org?.id).toBe(ORG_ID);
      expect(org?.role).toBe('OWNER');
      expect(org?.isMember).toBe(true);
    });

    it('returns 403 for a user who is not a member of the organization (negative / security)', async () => {
      const middleware = orgContextMiddleware({ strictWrite: false });
      const req = buildReq(FOREIGN_USER_ID, ORG_ID) as never;
      const res = buildRes();
      const next = vi.fn();

      await middleware(req, res as never, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
      expect(res.body).toMatchObject({
        error: 'Access denied',
        message: 'You do not have access to this organization.',
      });
    });

    it('returns 403 for a suspended member (status normalization must not widen access)', async () => {
      const middleware = orgContextMiddleware({ strictWrite: false });
      const req = buildReq(SUSPENDED_USER_ID, ORG_ID) as never;
      const res = buildRes();
      const next = vi.fn();

      await middleware(req, res as never, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
    });
  });
});
