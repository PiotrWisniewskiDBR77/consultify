import { describe, expect, it } from 'vitest';

import {
  CreateAssessmentSchema,
  GenerateInitiativesSchema,
  SendBackSchema,
  UpdateAssessmentSchema,
} from '../../server/src/validators/assessment.validators.ts';

describe('Assessment validators (AI path) - REAL_CODE', () => {
  it('CreateAssessmentSchema requires assessmentType and name', () => {
    const bad = CreateAssessmentSchema.safeParse({ assessmentType: 'DRD' });
    expect(bad.success).toBe(false);
    const ok = CreateAssessmentSchema.parse({ assessmentType: 'DRD', name: 'X' });
    expect(ok.name).toBe('X');
  });

  it('UpdateAssessmentSchema validates navigation shape', () => {
    const res = UpdateAssessmentSchema.safeParse({
      navigation: { axisId: 1, areaId: 'a', level: 2 },
    });
    expect(res.success).toBe(true);
  });

  it('SendBackSchema enforces minimum comment length', () => {
    expect(SendBackSchema.safeParse({ comment: 'x' }).success).toBe(false);
    expect(SendBackSchema.safeParse({ comment: 'ok' }).success).toBe(true);
  });

  it('GenerateInitiativesSchema enforces count max=7', () => {
    expect(GenerateInitiativesSchema.safeParse({ methodologyId: 'm', count: 8 }).success).toBe(
      false
    );
    expect(GenerateInitiativesSchema.safeParse({ methodologyId: 'm', count: 7 }).success).toBe(
      true
    );
  });

  it('GenerateInitiativesSchema allows optional reportId', () => {
    expect(
      GenerateInitiativesSchema.safeParse({ methodologyId: 'm', count: 1, reportId: 'r' }).success
    ).toBe(true);
  });
});
