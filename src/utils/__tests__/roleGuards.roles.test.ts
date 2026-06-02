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

  it('treats user and guest as pilot restricted roles', () => {
    expect(isPilotRestrictedRole('MEMBER')).toBe(true);
    expect(isPilotRestrictedRole('VIEWER')).toBe(true);
    expect(isPilotRestrictedRole('ADMIN')).toBe(false);
  });
});
