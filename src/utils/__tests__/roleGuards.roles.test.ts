import { describe, expect, it } from 'vitest';

import {
  isAdminOwnerOrSuperAdminRole,
  isPilotRestrictedRole,
  normalizeAppRole,
} from '../roleGuards';

describe('roleGuards canonical application roles', () => {
  it('normalizes legacy application aliases without promoting project roles to admin', () => {
    expect(normalizeAppRole('administrator')).toBe('ADMIN');
    expect(normalizeAppRole('team_member')).toBe('USER');
    expect(normalizeAppRole('viewer')).toBe('GUEST');
    expect(normalizeAppRole('client')).toBe('GUEST');
    expect(normalizeAppRole('project_manager')).toBe('USER');
    expect(normalizeAppRole('consultant')).toBe('USER');
  });

  it('keeps admin routing limited to owner, admin, and superadmin', () => {
    expect(isAdminOwnerOrSuperAdminRole('OWNER')).toBe(true);
    expect(isAdminOwnerOrSuperAdminRole('ADMIN')).toBe(true);
    expect(isAdminOwnerOrSuperAdminRole('SUPER_ADMIN')).toBe(true);
    expect(isAdminOwnerOrSuperAdminRole('PROJECT_MANAGER')).toBe(false);
    expect(isAdminOwnerOrSuperAdminRole('CONSULTANT')).toBe(false);
  });

  it('treats bare user and guest respondents as pilot restricted roles', () => {
    expect(isPilotRestrictedRole('MEMBER')).toBe(true);
    expect(isPilotRestrictedRole('TEAM_MEMBER')).toBe(true);
    expect(isPilotRestrictedRole('USER')).toBe(true);
    expect(isPilotRestrictedRole('VIEWER')).toBe(true);
    expect(isPilotRestrictedRole('CLIENT')).toBe(true);
    expect(isPilotRestrictedRole('ADMIN')).toBe(false);
  });

  it('exempts delivery/staff roles (PROJECT_MANAGER/MANAGER/CONSULTANT) from pilot restriction', () => {
    // These normalize to the USER band but operate the platform — they must be
    // able to create initiatives and use the full app, not the pilot-locked view.
    expect(isPilotRestrictedRole('PROJECT_MANAGER')).toBe(false);
    expect(isPilotRestrictedRole('project_manager')).toBe(false);
    expect(isPilotRestrictedRole('MANAGER')).toBe(false);
    expect(isPilotRestrictedRole('CONSULTANT')).toBe(false);
    // …but still normalize to USER for permission-band purposes.
    expect(normalizeAppRole('PROJECT_MANAGER')).toBe('USER');
  });
});
