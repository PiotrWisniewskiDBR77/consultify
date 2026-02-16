import { describe, expect, it } from 'vitest';

import {
  ApproveReportSchema,
  GenerateReportSchema,
} from '../../server/src/validators/assessment.validators.ts';

describe('Assessment reports validators - REAL_CODE', () => {
  it('ApproveReportSchema allows optional comment', () => {
    expect(ApproveReportSchema.safeParse({}).success).toBe(true);
    expect(ApproveReportSchema.safeParse({ comment: 'ok' }).success).toBe(true);
  });

  it('ApproveReportSchema enforces priority enum when provided', () => {
    expect(ApproveReportSchema.safeParse({ priority: 'high' }).success).toBe(true);
    expect(ApproveReportSchema.safeParse({ priority: 'nope' as any }).success).toBe(false);
  });

  it('GenerateReportSchema accepts optional booleans', () => {
    expect(GenerateReportSchema.safeParse({ includeRecommendations: true }).success).toBe(true);
    expect(GenerateReportSchema.safeParse({ includeGapAnalysis: false }).success).toBe(true);
  });

  it('GenerateReportSchema rejects non-boolean values', () => {
    expect(GenerateReportSchema.safeParse({ includeRecommendations: 'yes' as any }).success).toBe(
      false
    );
  });

  it('ApproveReportSchema passes through decision owner fields', () => {
    expect(
      ApproveReportSchema.safeParse({ decisionOwnerId: 'u1', dueDate: '2026-01-01' }).success
    ).toBe(true);
  });
});
