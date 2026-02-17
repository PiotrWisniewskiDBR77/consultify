import { describe, expect, it } from 'vitest';

import {
  CreateAssessmentSchema,
  ListAssessmentsQuerySchema,
} from '../../server/src/validators/assessment.validators.ts';

describe('Assessment API validators - REAL_CODE', () => {
  it('CreateAssessmentSchema accepts nullable projectId', () => {
    const a = CreateAssessmentSchema.parse({ assessmentType: 'DRD', name: 'A', projectId: null });
    expect(a.projectId).toBeNull();
  });

  it('CreateAssessmentSchema rejects empty name', () => {
    expect(CreateAssessmentSchema.safeParse({ assessmentType: 'DRD', name: '' }).success).toBe(
      false
    );
  });

  it('ListAssessmentsQuerySchema transforms limit/offset to numbers', () => {
    const q = ListAssessmentsQuerySchema.parse({ limit: '10', offset: '5' });
    expect(q.limit).toBe(10);
    expect(q.offset).toBe(5);
  });

  it('ListAssessmentsQuerySchema validates status enum', () => {
    expect(ListAssessmentsQuerySchema.safeParse({ status: 'DRAFT' }).success).toBe(true);
    expect(ListAssessmentsQuerySchema.safeParse({ status: 'nope' as any }).success).toBe(false);
  });

  it('ListAssessmentsQuerySchema allows optional filters', () => {
    expect(ListAssessmentsQuerySchema.safeParse({ projectId: 'p' }).success).toBe(true);
  });
});
