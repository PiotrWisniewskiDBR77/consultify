import { describe, expect, it } from 'vitest';

import { CreateInitiativeGenerationRunSchema } from '../../server/src/validators/assessment.validators.ts';

describe('Assessment workflow validators - REAL_CODE', () => {
  it('CreateInitiativeGenerationRunSchema validates mode enum', () => {
    expect(
      CreateInitiativeGenerationRunSchema.safeParse({
        mode: 'ASSESSMENT_REPORT',
        methodologyId: 'm1',
        requestedCount: 1,
      }).success
    ).toBe(true);
    expect(
      CreateInitiativeGenerationRunSchema.safeParse({
        mode: 'NOPE' as any,
        methodologyId: 'm1',
        requestedCount: 1,
      }).success
    ).toBe(false);
  });

  it('enforces requestedCount max=200', () => {
    expect(
      CreateInitiativeGenerationRunSchema.safeParse({
        mode: 'REPORT_ONLY',
        methodologyId: 'm1',
        requestedCount: 201,
      }).success
    ).toBe(false);
  });

  it('enforces batchSize max=7 when provided', () => {
    expect(
      CreateInitiativeGenerationRunSchema.safeParse({
        mode: 'REPORT_ONLY',
        methodologyId: 'm1',
        requestedCount: 10,
        batchSize: 7,
      }).success
    ).toBe(true);
    expect(
      CreateInitiativeGenerationRunSchema.safeParse({
        mode: 'REPORT_ONLY',
        methodologyId: 'm1',
        requestedCount: 10,
        batchSize: 8,
      }).success
    ).toBe(false);
  });

  it('allows consultantBrief up to 20000 chars', () => {
    expect(
      CreateInitiativeGenerationRunSchema.safeParse({
        mode: 'REPORT_ONLY',
        methodologyId: 'm1',
        requestedCount: 1,
        consultantBrief: 'x'.repeat(20000),
      }).success
    ).toBe(true);
  });

  it('allows optional templateId and reportId', () => {
    expect(
      CreateInitiativeGenerationRunSchema.safeParse({
        mode: 'ASSESSMENT_REPORT',
        methodologyId: 'm1',
        requestedCount: 1,
        templateId: 't1',
        reportId: 'r1',
      }).success
    ).toBe(true);
  });
});
