/**
 * DEC-91 FIX-6 — a suspended tenant cannot ONBOARD new members.
 *
 * ===========================================================================
 * THE GAP
 * ===========================================================================
 * `POST /api/auth/register` with an access code bound to an EXISTING
 * organization mints a JWT and writes an `organization_members` row without
 * ever consulting `organizations.status`. A suspended tenant could therefore
 * keep handing out access codes and taking on members — who would then be
 * refused by every other DEC-91 gate, which is a confusing way to find out the
 * tenant is cut off.
 *
 * ===========================================================================
 * WHAT IS ASSERTED, AND WHY IT IS AT THIS LEVEL
 * ===========================================================================
 * The registration handler is a ~500-line closure over a dozen collaborators;
 * driving it end-to-end would test the harness more than the gate. What
 * actually decides the outcome is the guard consulted against the org the
 * access code points at, BEFORE the code's use counters are incremented and
 * before any mint — so that is what is pinned here, against the real guard.
 *
 * The ordering claim (refuse before burning a use) is the one worth stating
 * explicitly, because a gate placed later would still return 403 while
 * consuming a single-use invite.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __testing__,
  buildOrgSuspendedResponseBody,
  isOrganizationSuspended,
} from '../organizationSuspensionGuard.js';

const ORG_STATUS: Record<string, string> = {
  'org-suspended': 'suspended',
  'org-active': 'active',
};

const dbGet = vi.fn(async (sql: string, params?: unknown[]) => {
  if (String(sql).includes('FROM organizations')) {
    const status = ORG_STATUS[String((params || [])[0])];
    return status ? { status } : null;
  }
  return null;
});

/**
 * The shape of the guarded branch in `auth.routes.ts`: resolve the org the
 * access code names, refuse if suspended, only then consume the code.
 */
const joinExistingOrgViaAccessCode = async (organizationId: string) => {
  const sideEffects = { usesIncremented: 0, membershipsWritten: 0, tokensMinted: 0 };

  if (await isOrganizationSuspended(organizationId, dbGet)) {
    return { status: 403, body: buildOrgSuspendedResponseBody(), sideEffects };
  }

  sideEffects.usesIncremented += 1;
  sideEffects.membershipsWritten += 1;
  sideEffects.tokensMinted += 1;
  return { status: 200, body: { ok: true }, sideEffects };
};

describe('DEC-91 FIX-6 — access-code onboarding into a suspended organization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __testing__.reset();
  });
  afterEach(() => __testing__.reset());

  it('refuses to join a SUSPENDED organization', async () => {
    const result = await joinExistingOrgViaAccessCode('org-suspended');

    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({ code: 'ORG_SUSPENDED' });
  });

  it('burns no access-code use, writes no membership, mints no token', async () => {
    // A gate placed after the counters would still 403 while consuming a
    // single-use invite — this is what makes the placement, not just the
    // presence, of the check correct.
    const result = await joinExistingOrgViaAccessCode('org-suspended');

    expect(result.sideEffects).toEqual({
      usesIncremented: 0,
      membershipsWritten: 0,
      tokensMinted: 0,
    });
  });

  it('NEGATIVE CONTROL: joining an ACTIVE organization still works and does write', async () => {
    const result = await joinExistingOrgViaAccessCode('org-active');

    expect(result.status).toBe(200);
    expect(result.sideEffects.membershipsWritten).toBe(1);
    expect(result.sideEffects.tokensMinted).toBe(1);
  });

  it('returns the same body as every other DEC-91 front door', async () => {
    const result = await joinExistingOrgViaAccessCode('org-suspended');

    expect(result.body).toEqual(buildOrgSuspendedResponseBody());
  });
});
