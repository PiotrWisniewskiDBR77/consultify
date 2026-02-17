/**
 * L1: User validators (honest unit tests).
 */

import { describe, expect, it } from 'vitest';

import {
  GetUsersQuerySchema,
  UpdateUserRoleSchema,
  UpdateUserSchema,
  UserRoleEnum,
  UserStatusEnum,
} from '../../../server/src/validators/user.validators.js';

describe('user.validators', () => {
  it('UpdateUserSchema: accepts partial updates', () => {
    const parsed = UpdateUserSchema.parse({ email: 'a@b.com' });
    expect(parsed.email).toBe('a@b.com');
  });

  it('UpdateUserRoleSchema: requires role', () => {
    const parsed = UpdateUserRoleSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it('GetUsersQuerySchema: supports canReview true/false', () => {
    const parsed = GetUsersQuerySchema.parse({ canReview: 'true' });
    expect(parsed.canReview).toBe('true');
  });

  it('enums: contain expected values', () => {
    expect(UserRoleEnum.options).toContain('SUPERADMIN');
    expect(UserStatusEnum.options).toContain('ACTIVE');
  });
});
