/**
 * Admin Validators Unit Tests
 *
 * Regression guard for feedback #1e3d749a (superadmin "Edit User" 400s).
 * The role field on UpdateUserAdminSchema/CreateUserAdminSchema MUST stay
 * permissive: production users carry roles beyond USER/ADMIN/SUPERADMIN/MANAGER
 * (OWNER, MEMBER, PROJECT_MANAGER, CONSULTANT, VIEWER…). The Edit dialog echoes
 * the current role back on save, so a narrow enum rejects every edit of such a
 * user. This was fixed in abf1c6de58 and then silently re-narrowed by the merge
 * d675885189 — this test exists so a third regression fails CI instead of prod.
 */
import { describe, expect, it } from 'vitest';

import {
  CreateUserAdminSchema,
  UpdateUserAdminSchema,
} from '../../../server/src/validators/admin.validators.js';

describe('Admin validators — role field stays permissive (regression #1e3d749a)', () => {
  const realWorldRoles = [
    'USER',
    'ADMIN',
    'SUPERADMIN',
    'MANAGER',
    'OWNER',
    'MEMBER',
    'PROJECT_MANAGER',
    'CONSULTANT',
    'VIEWER',
    'CLIENT',
  ];

  for (const role of realWorldRoles) {
    it(`UpdateUserAdminSchema accepts role "${role}"`, () => {
      const result = UpdateUserAdminSchema.safeParse({ role });
      expect(result.success).toBe(true);
    });
    it(`CreateUserAdminSchema accepts role "${role}"`, () => {
      const result = CreateUserAdminSchema.safeParse({
        email: 'user@example.com',
        firstName: 'Test',
        lastName: 'User',
        role,
      });
      expect(result.success).toBe(true);
    });
  }

  it('still rejects garbage role tokens (spaces / injection)', () => {
    expect(UpdateUserAdminSchema.safeParse({ role: 'a role' }).success).toBe(false);
    expect(UpdateUserAdminSchema.safeParse({ role: "'; DROP TABLE" }).success).toBe(false);
  });

  it('accepts slug org ids on move (feedback #76ef6831), not just UUIDs', () => {
    for (const organizationId of ['vts', 'aplix-na', 'org-dbr77-system']) {
      expect(UpdateUserAdminSchema.safeParse({ organizationId }).success).toBe(true);
    }
  });

  it('normalizes mixed-case status to lowercase enum (feedback #682d4134)', () => {
    const parsed = UpdateUserAdminSchema.parse({ status: 'Blocked' });
    expect(parsed.status).toBe('blocked');
  });
});
