import { describe, expect, it } from 'vitest';

import {
  defaultProjectRoleForApplicationRole,
  getPermissionRoleCandidates,
  normalizeApplicationRole,
  normalizePlatformRole,
  normalizeProjectRole,
} from '../../utils/roleNormalization.js';

describe('roleNormalization', () => {
  it('keeps SUPERADMIN as platform-only role', () => {
    expect(normalizePlatformRole('SUPER_ADMIN')).toBe('SUPERADMIN');
    expect(normalizeApplicationRole('SUPERADMIN')).toBe('USER');
    expect(getPermissionRoleCandidates('OWNER')).not.toContain('SUPERADMIN');
  });

  it('maps legacy application aliases into the canonical application roles', () => {
    expect(normalizeApplicationRole('administrator')).toBe('ADMIN');
    expect(normalizeApplicationRole('member')).toBe('USER');
    expect(normalizeApplicationRole('team_member')).toBe('USER');
    expect(normalizeApplicationRole('viewer')).toBe('GUEST');
    expect(normalizeApplicationRole('client')).toBe('GUEST');
    expect(normalizeApplicationRole('project_manager')).toBe('USER');
    expect(normalizeApplicationRole('consultant')).toBe('USER');
  });

  it('maps legacy project roles into the canonical project roles', () => {
    expect(normalizeProjectRole('SPONSOR')).toBe('PROJECT_SPONSOR');
    expect(normalizeProjectRole('PMO_LEAD')).toBe('PMO');
    expect(normalizeProjectRole('PROJECT_MANAGER')).toBe('PROJECT_LEADER');
    expect(normalizeProjectRole('TEAM_MEMBER')).toBe('TASK_ASSIGNEE');
    expect(normalizeProjectRole('STAKEHOLDER')).toBe('OBSERVER');
    expect(normalizeProjectRole('DECISION_OWNER')).toBe('REVIEWER');
    expect(normalizeProjectRole('CONSULTANT')).toBe('CONSULTANT');
  });

  it('returns default project roles from application roles', () => {
    expect(defaultProjectRoleForApplicationRole('OWNER')).toBe('PROJECT_SPONSOR');
    expect(defaultProjectRoleForApplicationRole('ADMIN')).toBe('PROJECT_LEADER');
    expect(defaultProjectRoleForApplicationRole('USER')).toBe('TASK_ASSIGNEE');
    expect(defaultProjectRoleForApplicationRole('GUEST')).toBe('OBSERVER');
  });
});
