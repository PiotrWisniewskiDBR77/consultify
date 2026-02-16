import { describe, expect, it } from 'vitest';

import { mapOrgRoleToChatRole } from '../../../../server/src/services/chatPermissionService.ts';

describe('chatPermissionService: mapOrgRoleToChatRole', () => {
  it('maps OWNER/ADMIN variants to owner', () => {
    expect(mapOrgRoleToChatRole('OWNER')).toBe('owner');
    expect(mapOrgRoleToChatRole('admin')).toBe('owner');
    expect(mapOrgRoleToChatRole(' SUPERADMIN ')).toBe('owner');
    expect(mapOrgRoleToChatRole('SUPER_ADMIN')).toBe('owner');
    expect(mapOrgRoleToChatRole('ADMINISTRATOR')).toBe('owner');
  });

  it('maps MEMBER/TEAM_MEMBER variants to contributor', () => {
    expect(mapOrgRoleToChatRole('MEMBER')).toBe('contributor');
    expect(mapOrgRoleToChatRole('team_member')).toBe('contributor');
    expect(mapOrgRoleToChatRole('PROJECT_MANAGER')).toBe('contributor');
    expect(mapOrgRoleToChatRole('manager')).toBe('contributor');
  });

  it('maps CONSULTANT/VIEWER variants to viewer', () => {
    expect(mapOrgRoleToChatRole('CONSULTANT')).toBe('viewer');
    expect(mapOrgRoleToChatRole('viewer')).toBe('viewer');
    expect(mapOrgRoleToChatRole('GUEST')).toBe('viewer');
    expect(mapOrgRoleToChatRole('client')).toBe('viewer');
  });

  it('returns none for missing roles', () => {
    expect(mapOrgRoleToChatRole(undefined)).toBe('none');
    expect(mapOrgRoleToChatRole(null)).toBe('none');
    expect(mapOrgRoleToChatRole('')).toBe('none');
  });

  it('defaults unknown roles to viewer (conservative)', () => {
    expect(mapOrgRoleToChatRole('SOMETHING_ELSE')).toBe('viewer');
  });
});
