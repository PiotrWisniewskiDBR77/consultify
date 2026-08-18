/**
 * The Audits strict membership guard must fail CLOSED, and — since the
 * tenant-authoritative decision — must grant NO platform-level exemption.
 *
 * The general `validateOrgMembership` deliberately fails **open** when the
 * database errors, so one bad query cannot lock the whole product out. On the
 * Audits mounts that trade-off is unacceptable: an unreadable
 * `organization_members` table must not become an open door to audit evidence,
 * findings and corrective actions.
 *
 * A browser run cannot prove these branches — they need the database to break
 * mid-request, or a super-admin with no membership row — so they are proven
 * here, at the unit the branches live in.
 *
 * This file covers BOTH exports deliberately. They are two different contracts
 * living in one module, and the Tools block below exists so that narrowing
 * Audits can never silently narrow Tools as a side effect.
 */

import type { NextFunction, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/DbPromise.js', () => ({
  get: vi.fn(),
}));
vi.mock('../../utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const DbPromise = await import('../../utils/DbPromise.js');
const {
  requireActiveAuditsMembership,
  requireActiveTenantMembership,
  requireActiveTenantMembershipOrUnavailable,
} = await import('../auditsStrictMembership.middleware.js');

function makeRes() {
  const res = {
    statusCode: 0,
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
  return res as unknown as Response & { statusCode: number; body: any };
}

const ACTIVE_REQ = {
  user: { id: 'u1', organizationId: 'org1', isSuperAdmin: false },
  organizationId: 'org1',
} as any;

describe('requireActiveAuditsMembership', () => {
  beforeEach(() => vi.clearAllMocks());

  it('denies when the membership lookup throws (fail-closed, not fail-open)', async () => {
    (DbPromise.get as any).mockRejectedValue(new Error('connection terminated unexpectedly'));
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await requireActiveAuditsMembership(ACTIVE_REQ, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
  });

  it('denies when no membership row exists', async () => {
    (DbPromise.get as any).mockResolvedValue(undefined);
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await requireActiveAuditsMembership(ACTIVE_REQ, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('denies when the membership exists but is not ACTIVE', async () => {
    (DbPromise.get as any).mockResolvedValue({ status: 'REVOKED' });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await requireActiveAuditsMembership(ACTIVE_REQ, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('denies when there is no identity or no organization on the request', async () => {
    (DbPromise.get as any).mockResolvedValue({ status: 'ACTIVE' });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await requireActiveAuditsMembership({ user: {} } as any, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(DbPromise.get).not.toHaveBeenCalled();
  });

  it('admits an ACTIVE membership, reading the table on every call (no cache)', async () => {
    (DbPromise.get as any).mockResolvedValue({ status: 'ACTIVE' });
    const next = vi.fn() as unknown as NextFunction;

    await requireActiveAuditsMembership(ACTIVE_REQ, makeRes(), next);
    await requireActiveAuditsMembership(ACTIVE_REQ, makeRes(), next);

    expect(next).toHaveBeenCalledTimes(2);
    // Two requests, two lookups: a cached positive is exactly the defect this
    // middleware exists to remove.
    expect(DbPromise.get).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // Tenant-authoritative: a platform super-admin gets NO exemption.
  //
  // This replaces the previous "exempts a genuine super-admin without
  // consulting the table" case. That expectation was the platform contract;
  // it is deliberately reversed for Audits, because audit evidence, findings
  // and corrective actions are tenant property and platform role is not a
  // substitute for membership in the tenant that owns them. The Tools export
  // keeps the old contract — see the block below.
  // -------------------------------------------------------------------------
  const SUPERADMIN_REQ = {
    user: { id: 'sa', organizationId: 'org1', isSuperAdmin: true },
    organizationId: 'org1',
  } as any;

  it('denies a SUPERADMIN with no membership row — and genuinely queries the table', async () => {
    (DbPromise.get as any).mockResolvedValue(undefined);
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await requireActiveAuditsMembership(SUPERADMIN_REQ, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
    // The lookup is not short-circuited for a super-admin: the guard must
    // actually ask the tenant, not assume.
    expect(DbPromise.get).toHaveBeenCalledTimes(1);
  });

  it('admits a SUPERADMIN who holds an ACTIVE membership in the target tenant', async () => {
    (DbPromise.get as any).mockResolvedValue({ status: 'ACTIVE' });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await requireActiveAuditsMembership(SUPERADMIN_REQ, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(0); // never denied
    expect(DbPromise.get).toHaveBeenCalledTimes(1);
  });

  it('denies a SUPERADMIN whose membership was REVOKED', async () => {
    (DbPromise.get as any).mockResolvedValue({ status: 'REVOKED' });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await requireActiveAuditsMembership(SUPERADMIN_REQ, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(DbPromise.get).toHaveBeenCalledTimes(1);
  });

  it('denies a SUPERADMIN from a FOREIGN tenant (membership is looked up per target org)', async () => {
    (DbPromise.get as any).mockResolvedValue(undefined);
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await requireActiveAuditsMembership(
      { user: { id: 'sa', organizationId: 'org-home', isSuperAdmin: true }, organizationId: 'org-foreign' } as any,
      res,
      next
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    // The org actually queried is the TARGET tenant, not the caller's own.
    expect((DbPromise.get as any).mock.calls[0][1]).toEqual(['sa', 'org-foreign']);
  });

  it('re-reads membership for a SUPERADMIN on every request (no cache) — a same-token revoke bites on the next request', async () => {
    const next = vi.fn() as unknown as NextFunction;
    (DbPromise.get as any).mockResolvedValueOnce({ status: 'ACTIVE' });
    const firstRes = makeRes();
    await requireActiveAuditsMembership(SUPERADMIN_REQ, firstRes, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Same token, membership revoked between the two requests.
    (DbPromise.get as any).mockResolvedValueOnce({ status: 'REVOKED' });
    const secondRes = makeRes();
    await requireActiveAuditsMembership(SUPERADMIN_REQ, secondRes, next);

    expect(next).toHaveBeenCalledTimes(1); // not called again
    expect(secondRes.statusCode).toBe(403);
    expect(DbPromise.get).toHaveBeenCalledTimes(2); // two requests, two lookups
  });

  it('fails closed for a SUPERADMIN when the database errors (403, no next)', async () => {
    (DbPromise.get as any).mockRejectedValue(new Error('connection terminated unexpectedly'));
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await requireActiveAuditsMembership(SUPERADMIN_REQ, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
  });
});

/**
 * Tools consumes `requireActiveTenantMembership` (routes/tools.routes.ts:34).
 * Its contract is intentionally NOT changed by the Audits decision — Tools
 * narrows it under its own DoD. These tests exist to make that boundary
 * explicit: if someone later "unifies" the two exports, this block fails and
 * says why, instead of Tools silently changing behaviour.
 */
describe('requireActiveTenantMembership (Tools export) — original contract preserved', () => {
  beforeEach(() => vi.clearAllMocks());

  it('still exempts a genuine super-admin without consulting the table', async () => {
    const next = vi.fn() as unknown as NextFunction;
    const res = makeRes();

    await requireActiveTenantMembership(
      { user: { id: 'sa', isSuperAdmin: true }, organizationId: 'org1' } as any,
      res,
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(DbPromise.get).not.toHaveBeenCalled();
  });

  it('is a DIFFERENT function from the Audits guard — the two contracts are not aliases', () => {
    expect(requireActiveTenantMembership).not.toBe(requireActiveAuditsMembership);
  });

  it('still denies a non-super-admin without an ACTIVE membership', async () => {
    (DbPromise.get as any).mockResolvedValue({ status: 'REVOKED' });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await requireActiveTenantMembership(ACTIVE_REQ, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('still fails closed on a database error for a non-super-admin', async () => {
    (DbPromise.get as any).mockRejectedValue(new Error('connection terminated unexpectedly'));
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await requireActiveTenantMembership(ACTIVE_REQ, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});

describe('requireActiveTenantMembershipOrUnavailable (MFA export)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps ordinary missing and revoked membership at 403', async () => {
    for (const membership of [undefined, { status: 'REVOKED' }]) {
      (DbPromise.get as any).mockResolvedValueOnce(membership);
      const res = makeRes();
      const next = vi.fn() as unknown as NextFunction;
      await requireActiveTenantMembershipOrUnavailable(ACTIVE_REQ, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
      expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
    }
  });

  it('returns exact 503 only when the membership lookup is unavailable', async () => {
    (DbPromise.get as any).mockRejectedValueOnce(new Error('database offline'));
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    await requireActiveTenantMembershipOrUnavailable(ACTIVE_REQ, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({
      error: 'Organization membership could not be verified',
      code: 'ORG_MEMBERSHIP_UNAVAILABLE',
    });
  });

  it('retains the platform SUPERADMIN own-user bypass without a membership lookup', async () => {
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    await requireActiveTenantMembershipOrUnavailable(
      { user: { id: 'platform-admin', isSuperAdmin: true }, organizationId: 'org1' } as any,
      res,
      next
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(DbPromise.get).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(0);
  });
});
