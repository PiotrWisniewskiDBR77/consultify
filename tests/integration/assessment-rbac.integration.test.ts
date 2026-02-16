import { describe, expect, it } from 'vitest';

import {
  ApproveAssessmentAccessRequestSchema,
  AssignAssessmentRoleSchema,
  RejectAssessmentAccessRequestSchema,
  UpsertAssessmentRoleSchema,
} from '../../server/src/validators/assessment.validators.ts';

describe('Assessment RBAC validators - REAL_CODE', () => {
  it('UpsertAssessmentRoleSchema requires a role', () => {
    expect(UpsertAssessmentRoleSchema.safeParse({}).success).toBe(false);
    expect(UpsertAssessmentRoleSchema.safeParse({ role: 'viewer' }).success).toBe(true);
  });

  it('AssignAssessmentRoleSchema requires userId', () => {
    expect(AssignAssessmentRoleSchema.safeParse({ role: 'editor' }).success).toBe(false);
    expect(AssignAssessmentRoleSchema.safeParse({ role: 'editor', userId: 'u1' }).success).toBe(
      true
    );
  });

  it('ApproveAssessmentAccessRequestSchema restricts grantedRole', () => {
    expect(
      ApproveAssessmentAccessRequestSchema.safeParse({ grantedRole: 'viewer' as any }).success
    ).toBe(false);
    expect(ApproveAssessmentAccessRequestSchema.safeParse({ grantedRole: 'editor' }).success).toBe(
      true
    );
    expect(ApproveAssessmentAccessRequestSchema.safeParse({ grantedRole: 'manager' }).success).toBe(
      true
    );
  });

  it('RejectAssessmentAccessRequestSchema enforces min reason length', () => {
    expect(RejectAssessmentAccessRequestSchema.safeParse({ reason: 'x' }).success).toBe(false);
    expect(RejectAssessmentAccessRequestSchema.safeParse({ reason: 'ok' }).success).toBe(true);
  });

  it('ApproveAssessmentAccessRequestSchema allows optional areas and permissions', () => {
    expect(
      ApproveAssessmentAccessRequestSchema.safeParse({
        grantedRole: 'manager',
        grantedAreas: ['a1'],
        grantedPermissions: { canEdit: true },
      }).success
    ).toBe(true);
  });
});
