/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';

import {
  assertApplyParityCandidate,
  readConnectionParity,
} from '../../../server/scripts/partner-owner-organization-binding';

describe('Partner owner-binding connection parity', () => {
  it('reports equal legacy and strict counts for an unambiguous mapping', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          legacy_connected_users: 2,
          strict_eligible_users: 2,
          strict_connected_users: 2,
          exceptions: [],
        },
      ],
    });

    const parity = await readConnectionParity({ query } as any, [
      {
        partnerOrganizationId: '11111111-1111-1111-1111-111111111111',
        ownerOrganizationId: 'org-a',
      },
    ]);

    expect(parity).toEqual({
      legacyConnectedUsers: 2,
      strictEligibleUsers: 2,
      strictConnectedUsers: 2,
      exceptions: [],
    });
    expect(() => assertApplyParityCandidate(parity)).not.toThrow();
  });

  it('returns auditable exceptions and refuses a non-parity candidate', async () => {
    const exception = {
      partnerOrganizationId: '11111111-1111-1111-1111-111111111111',
      ownerOrganizationId: 'org-a',
      userId: 'user-without-membership',
      reason: 'ACTIVE_OWNER_MEMBERSHIP_MISSING' as const,
    };
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          legacy_connected_users: 2,
          strict_eligible_users: 1,
          strict_connected_users: 0,
          exceptions: [exception],
        },
      ],
    });

    const parity = await readConnectionParity({ query } as any, [
      { partnerOrganizationId: exception.partnerOrganizationId, ownerOrganizationId: 'org-a' },
    ]);

    expect(parity.exceptions).toEqual([exception]);
    expect(() => assertApplyParityCandidate(parity)).toThrow(/ACTIVE_OWNER_MEMBERSHIP_MISSING/);
  });

  it('counts a colleague-inherited legacy user and surfaces it as a COLLEAGUE_INHERITED exception, never silently dropping it', async () => {
    const colleagueException = {
      partnerOrganizationId: '11111111-1111-1111-1111-111111111111',
      ownerOrganizationId: 'org-a',
      userId: 'user-inherited-via-colleague',
      reason: 'COLLEAGUE_INHERITED' as const,
    };
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          // Legacy resolves 1 direct user + 1 colleague-inherited user = 2.
          legacy_connected_users: 2,
          // The colleague-inherited user is never eligible; only the direct
          // link counts toward strictEligibleUsers.
          strict_eligible_users: 1,
          strict_connected_users: 0,
          exceptions: [colleagueException],
        },
      ],
    });

    const mappings = [
      {
        partnerOrganizationId: colleagueException.partnerOrganizationId,
        ownerOrganizationId: colleagueException.ownerOrganizationId,
      },
    ];
    const parity = await readConnectionParity({ query } as any, mappings);

    // The colleague-inherited user is COUNTED (legacy=2) and appears in
    // exceptions with the dedicated reason — it never disappears.
    expect(parity.legacyConnectedUsers).toBe(2);
    expect(parity.exceptions).toEqual([colleagueException]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('colleague_users'), [
      mappings.map((mapping) => mapping.partnerOrganizationId),
      mappings.map((mapping) => mapping.ownerOrganizationId),
    ]);
    // A colleague-inherited exception blocks APPLY exactly like the
    // membership-missing case — it is not silently auto-connected.
    expect(() => assertApplyParityCandidate(parity)).toThrow(/legacy=2, strictEligible=1/);
  });
});
