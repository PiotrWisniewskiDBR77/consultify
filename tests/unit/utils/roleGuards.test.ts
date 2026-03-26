import { describe, expect, it } from 'vitest';

import { isSuperAdminRole, normalizeAppRole } from '@/utils/roleGuards';

describe('roleGuards', () => {
  it('normalizes SUPER_ADMIN into SUPERADMIN', () => {
    expect(normalizeAppRole('SUPER_ADMIN')).toBe('SUPERADMIN');
  });

  it('treats superadmin casing variants as superadmin', () => {
    expect(isSuperAdminRole('SUPERADMIN')).toBe(true);
    expect(isSuperAdminRole('superadmin')).toBe(true);
    expect(isSuperAdminRole('SUPER_ADMIN')).toBe(true);
  });

  it('does not elevate non-superadmin roles', () => {
    expect(isSuperAdminRole('ADMIN')).toBe(false);
    expect(isSuperAdminRole(undefined)).toBe(false);
  });
});
