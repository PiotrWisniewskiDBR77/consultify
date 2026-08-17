/**
 * The Audits strict membership guard must fail CLOSED.
 *
 * The general `validateOrgMembership` deliberately fails **open** when the
 * database errors, so one bad query cannot lock the whole product out. On the
 * Audits mounts that trade-off is unacceptable: an unreadable
 * `organization_members` table must not become an open door to audit evidence,
 * findings and corrective actions.
 *
 * A browser run cannot prove this branch — it would need the database to break
 * mid-request — so it is proven here, at the unit the branch lives in.
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
const { requireActiveAuditsMembership } = await import('../auditsStrictMembership.middleware.js');

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

  it('exempts a genuine super-admin without consulting the table', async () => {
    const next = vi.fn() as unknown as NextFunction;
    await requireActiveAuditsMembership(
      { user: { id: 'sa', isSuperAdmin: true }, organizationId: 'org1' } as any,
      makeRes(),
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(DbPromise.get).not.toHaveBeenCalled();
  });
});
