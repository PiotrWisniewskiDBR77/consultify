import { describe, expect, it } from 'vitest';

import { __private__ } from '../../../../server/src/routes/auth.routes.ts';

describe('auth.routes switch-organization status normalization', () => {
  it('normalizes membership status to ACTIVE in a case-insensitive way', () => {
    expect(__private__.normalizeMembershipStatus('ACTIVE')).toBe('ACTIVE');
    expect(__private__.normalizeMembershipStatus('active')).toBe('ACTIVE');
    expect(__private__.normalizeMembershipStatus(' Active ')).toBe('ACTIVE');
    expect(__private__.normalizeMembershipStatus(null)).toBe('');
  });

  it('normalizes organization status to active in a case-insensitive way', () => {
    expect(__private__.normalizeOrganizationStatus('active')).toBe('active');
    expect(__private__.normalizeOrganizationStatus('ACTIVE')).toBe('active');
    expect(__private__.normalizeOrganizationStatus(' Active ')).toBe('active');
    expect(__private__.normalizeOrganizationStatus(undefined)).toBe('');
  });
});
