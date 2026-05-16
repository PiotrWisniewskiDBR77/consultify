import { describe, expect, it } from 'vitest';

import {
  getRequestAccessRole,
  getSettingsActorRole,
  isRequestSuperAdmin,
  normalizeAccessRole,
} from '../../../../server/src/middleware/requestAccess.js';

describe('requestAccess middleware helpers', () => {
  it('normalizes known access roles', () => {
    expect(normalizeAccessRole('SUPER_ADMIN')).toBe('superadmin');
    expect(normalizeAccessRole('administrator')).toBe('admin');
    expect(normalizeAccessRole('viewer')).toBe('guest');
    expect(normalizeAccessRole('team_member')).toBe('member');
    expect(normalizeAccessRole(undefined)).toBe('');
  });

  it('detects superadmin from own boolean flag or request role', () => {
    expect(isRequestSuperAdmin({ user: { isSuperAdmin: true } } as any)).toBe(true);
    expect(isRequestSuperAdmin({ userRole: 'super_admin' } as any)).toBe(true);
  });

  it('ignores inherited isSuperAdmin=true on user prototype', () => {
    const user = Object.create({ isSuperAdmin: true });
    expect(isRequestSuperAdmin({ user, userRole: 'member' } as any)).toBe(false);
  });

  it('resolves request role from userRole before own user role', () => {
    expect(getRequestAccessRole({ userRole: 'admin', user: { role: 'owner' } } as any)).toBe(
      'admin'
    );
  });

  it('ignores inherited user.role when userRole is empty', () => {
    const user = Object.create({ role: 'ADMIN' });
    expect(getRequestAccessRole({ user, userRole: undefined } as any)).toBe('');
  });

  it('maps superadmin settings actor to owner', () => {
    expect(getSettingsActorRole({ userRole: 'superadmin' } as any)).toBe('owner');
  });
});
