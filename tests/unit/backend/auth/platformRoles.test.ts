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
});
