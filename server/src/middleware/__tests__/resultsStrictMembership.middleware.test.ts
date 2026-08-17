/**
 * Contract test for the STRICT Results membership wall.
 *
 * WHAT IS UNDER TEST
 * `services/legacyCutover/requireActiveMembership.ts` — the middleware now
 * mounted on all four Results HTTP writer routers (`benefits.routes.ts`,
 * `results-kpi-reports.routes.ts`, `resultsVnext/kpi.routes.ts` and, already
 * before this packet, `v8/results.routes.ts`).
 *
 * WHY THIS FILE EXISTS
 * The middleware had ZERO tests, yet it is the only thing standing between a
 * revoked member's still-valid signed JWT and the Results writers. Its contract
 * was verified once by hand against a real server; this file makes each clause
 * a standing regression instead of a one-off observation.
 *
 * WHY IT IS NOT A REAL-DB SUITE
 * Every clause below is about the middleware's DECISION, not about SQL: given a
 * membership status (or a lookup failure), does it call the handler or refuse?
 * The one thing that must not be faked — that the wall genuinely blocks a real
 * revoked write end-to-end — is proven separately against a real server and a
 * real Postgres, not here. So this file stubs exactly one seam (the DB read)
 * and asserts the decision, which is what a unit contract can honestly prove.
 *
 * NOT `validateOrgMembership` (auth.middleware.ts): that middleware has a
 * deliberately different contract — 60s positive cache, fail-OPEN on DB error —
 * and is out of scope here. Confusing the two is precisely the mistake this
 * file's existence is meant to prevent.
 */
import type { NextFunction, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbGet = vi.hoisted(() => vi.fn());
vi.mock('../../utils/DbPromise.js', () => ({ get: dbGet }));
vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  MEMBERSHIP_REVOKED_CODE,
  MEMBERSHIP_UNVERIFIABLE_CODE,
  requireActiveMembership,
} from '../../services/legacyCutover/requireActiveMembership.js';

function makeRes(): Response & { statusCode?: number; body?: unknown } {
  const res = {
    statusCode: undefined as number | undefined,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode?: number; body?: unknown };
}

const ACTIVE_ACTOR = { id: 'user-1', organizationId: 'org-1' };

describe('requireActiveMembership — strict Results membership wall', () => {
  let next: NextFunction;

  beforeEach(() => {
    dbGet.mockReset();
    next = vi.fn();
  });

  it('lets an ACTIVE member through', async () => {
    dbGet.mockResolvedValue({ status: 'ACTIVE' });
    const res = makeRes();

    await requireActiveMembership({ user: { ...ACTIVE_ACTOR } } as never, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeUndefined();
  });

  it('reads organization_members on EVERY request — no cache across calls', async () => {
    dbGet.mockResolvedValue({ status: 'ACTIVE' });
    const req = { user: { ...ACTIVE_ACTOR } } as never;

    await requireActiveMembership(req, makeRes(), next);
    await requireActiveMembership(req, makeRes(), next);
    await requireActiveMembership(req, makeRes(), next);

    // A cached wall would answer the 2nd/3rd request without a lookup, which is
    // exactly how a revoked member keeps write access for the cache's lifetime.
    expect(dbGet).toHaveBeenCalledTimes(3);
  });

  it('denies a REVOKED member with 403 and never calls the handler', async () => {
    dbGet.mockResolvedValue({ status: 'REVOKED' });
    const res = makeRes();

    await requireActiveMembership({ user: { ...ACTIVE_ACTOR } } as never, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ success: false, code: MEMBERSHIP_REVOKED_CODE });
    expect(next).not.toHaveBeenCalled();
  });

  it('denies a MISSING membership row with 403 (absent row is not implicit access)', async () => {
    dbGet.mockResolvedValue(undefined);
    const res = makeRes();

    await requireActiveMembership({ user: { ...ACTIVE_ACTOR } } as never, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ code: MEMBERSHIP_REVOKED_CODE });
    expect(next).not.toHaveBeenCalled();
  });

  it.each(['PENDING', 'INVITED', 'SUSPENDED', 'INACTIVE', '', 'active-ish'])(
    'denies non-ACTIVE status %j with 403',
    async (status) => {
      dbGet.mockResolvedValue({ status });
      const res = makeRes();

      await requireActiveMembership({ user: { ...ACTIVE_ACTOR } } as never, res, next);

      expect(res.statusCode).toBe(403);
      expect(next).not.toHaveBeenCalled();
    }
  );

  it('accepts lowercase "active" (case-insensitive status, not a second policy)', async () => {
    dbGet.mockResolvedValue({ status: 'active' });
    const res = makeRes();

    await requireActiveMembership({ user: { ...ACTIVE_ACTOR } } as never, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeUndefined();
  });

  it('gives SUPERADMIN no bypass: a role claim cannot substitute for membership', async () => {
    dbGet.mockResolvedValue(undefined); // no membership row at all
    const res = makeRes();

    await requireActiveMembership(
      { user: { ...ACTIVE_ACTOR, role: 'SUPERADMIN', isSuperAdmin: true } } as never,
      res,
      next
    );

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('gives no wildcard-permission bypass either', async () => {
    dbGet.mockResolvedValue({ status: 'REVOKED' });
    const res = makeRes();

    await requireActiveMembership(
      { user: { ...ACTIVE_ACTOR, permissions: { '*': true }, role: 'OWNER' } } as never,
      res,
      next
    );

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('fails CLOSED with 503 when the membership lookup itself fails — never next()', async () => {
    dbGet.mockRejectedValue(new Error('connection terminated unexpectedly'));
    const res = makeRes();

    await requireActiveMembership({ user: { ...ACTIVE_ACTOR } } as never, res, next);

    // The opposite of `validateOrgMembership`'s fail-open: an unverifiable
    // tenant must not be granted a write.
    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ success: false, code: MEMBERSHIP_UNVERIFIABLE_CODE });
    expect(next).not.toHaveBeenCalled();
  });

  it('passes fallback:false to the lookup so a swallowed DB error cannot read as ACTIVE', async () => {
    dbGet.mockResolvedValue({ status: 'ACTIVE' });

    await requireActiveMembership({ user: { ...ACTIVE_ACTOR } } as never, makeRes(), next);

    // DbPromise.get defaults to fallback:true, which RESOLVES a failure instead
    // of rejecting — under that default a DB error would surface as "no row"
    // and, worse, could never reach the 503 branch above.
    expect(dbGet).toHaveBeenCalledWith(expect.stringContaining('organization_members'), [
      'user-1',
      'org-1',
    ], { fallback: false });
  });

  it('resolves tenant/actor ONLY from the signed actor context, never from body or query', async () => {
    dbGet.mockResolvedValue({ status: 'ACTIVE' });

    await requireActiveMembership(
      {
        user: { ...ACTIVE_ACTOR },
        body: { organizationId: 'org-ATTACKER', userId: 'user-ATTACKER' },
        query: { organizationId: 'org-ATTACKER' },
        params: { organizationId: 'org-ATTACKER' },
      } as never,
      makeRes(),
      next
    );

    // The lookup must be scoped to the JWT's identity; a spoofed body/query must
    // not be able to point the wall at an organization the caller does belong to.
    expect(dbGet).toHaveBeenCalledWith(expect.any(String), ['user-1', 'org-1'], {
      fallback: false,
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('prefers the v8 context identity when present (same signed-context rule)', async () => {
    dbGet.mockResolvedValue({ status: 'ACTIVE' });

    await requireActiveMembership(
      {
        v8Context: { userId: 'user-v8', organizationId: 'org-v8' },
        user: { id: 'user-1', organizationId: 'org-1' },
      } as never,
      makeRes(),
      next
    );

    expect(dbGet).toHaveBeenCalledWith(expect.any(String), ['user-v8', 'org-v8'], {
      fallback: false,
    });
  });

  it('refuses with 401 when no identity can be resolved at all (no lookup attempted)', async () => {
    const res = makeRes();

    await requireActiveMembership({} as never, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ code: MEMBERSHIP_UNVERIFIABLE_CODE });
    expect(dbGet).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
