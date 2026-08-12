import { describe, expect, it } from 'vitest';

import {
  isForcedSuperAdminEmail,
  resolveAuthEffectiveRole,
} from '../../../../server/src/utils/platformRoles';

describe('platform role resolution', () => {
  it('does not downgrade a platform SUPERADMIN with a tenant OWNER membership', () => {
    expect(
      resolveAuthEffectiveRole({
        email: 'piotr.wisniewski@dbr77.com',
        userRole: 'SUPERADMIN',
        membershipRole: 'OWNER',
      })
    ).toBe('SUPERADMIN');
  });

  it('does not downgrade legacy SUPER_ADMIN spelling', () => {
    expect(
      resolveAuthEffectiveRole({
        email: 'platform@example.com',
        userRole: 'SUPER_ADMIN',
        membershipRole: 'ADMIN',
      })
    ).toBe('SUPERADMIN');
  });

  it('keeps forced SuperAdmin emails above tenant membership roles', () => {
    expect(isForcedSuperAdminEmail('PIOTR.WISNIEWSKI@DBR77.COM', 'piotr.wisniewski@dbr77.com')).toBe(
      true
    );
    expect(
      resolveAuthEffectiveRole({
        email: 'PIOTR.WISNIEWSKI@DBR77.COM',
        userRole: 'OWNER',
        membershipRole: 'OWNER',
        forcedSuperAdminEmails: 'piotr.wisniewski@dbr77.com',
      })
    ).toBe('SUPERADMIN');
  });

  it('still lets tenant membership define ordinary non-platform roles', () => {
    expect(
      resolveAuthEffectiveRole({
        email: 'admin@dbr77.com',
        userRole: 'USER',
        membershipRole: 'ADMIN',
      })
    ).toBe('ADMIN');
  });

  // --- RN-G6 defect: role without membership was silently downgraded ---
  //
  // `normalizeApplicationRole` (roleNormalization.ts) has a non-nullable
  // return type and defaults unrecognized/empty input to USER. Before the
  // fix, `resolveAuthEffectiveRole` normalized `membershipRole` with a
  // wrapper built on top of that function, so a missing membership row
  // (membershipRole = null/undefined/'') normalized to the truthy string
  // 'USER' instead of falling through to the user's own role — making the
  // `|| userRole` fallback dead code. These cases pin the fixed behavior:
  // no membership row must fall back to the user's own role, unchanged.
  it('falls back to the user role when there is no membership row (null)', () => {
    expect(
      resolveAuthEffectiveRole({
        email: 'lone.admin@dbr77.com',
        userRole: 'ADMIN',
        membershipRole: null,
      })
    ).toBe('ADMIN');
  });

  it('falls back to the user role when there is no membership row (undefined)', () => {
    expect(
      resolveAuthEffectiveRole({
        email: 'lone.owner@dbr77.com',
        userRole: 'OWNER',
        membershipRole: undefined,
      })
    ).toBe('OWNER');
  });

  it('falls back to the user role when membershipRole is an empty/blank string', () => {
    expect(
      resolveAuthEffectiveRole({
        email: 'lone.owner2@dbr77.com',
        userRole: 'OWNER',
        membershipRole: '   ',
      })
    ).toBe('OWNER');
  });

  it('still defaults to USER when neither userRole nor membershipRole is present', () => {
    expect(
      resolveAuthEffectiveRole({
        email: 'nobody@dbr77.com',
        userRole: null,
        membershipRole: null,
      })
    ).toBe('USER');
  });

  it('a present membership row still wins over the user role, even with an unrecognized string', () => {
    // Unchanged legacy behavior: once a membership row exists, its role
    // string (however unrecognized) is normalized and used — it does not
    // fall back to the user's own role. Only an *absent* row falls back.
    expect(
      resolveAuthEffectiveRole({
        email: 'weird.role@dbr77.com',
        userRole: 'ADMIN',
        membershipRole: 'SOME_UNRECOGNIZED_STRING',
      })
    ).toBe('USER');
  });

  it('forced SuperAdmin email wins even without any membership row', () => {
    expect(
      resolveAuthEffectiveRole({
        email: 'PIOTR.WISNIEWSKI@DBR77.COM',
        userRole: 'USER',
        membershipRole: null,
        forcedSuperAdminEmails: 'piotr.wisniewski@dbr77.com',
      })
    ).toBe('SUPERADMIN');
  });
});
