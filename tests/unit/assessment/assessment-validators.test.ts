/**
 * Assessment Validators — Unit Tests (REAL CODE)
 *
 * Tests Zod schemas from server/src/validators/assessment.validators.ts
 */
import { describe, expect, it } from 'vitest';

import {
  AssessmentTypeSchema,
  CreateAssessmentSchema,
  GenerateInitiativesSchema,
  ListAssessmentsQuerySchema,
  SendBackSchema,
  UpdateAssessmentSchema,
} from '../../../server/src/validators/assessment.validators.js';

describe('Assessment Validators (REAL)', () => {
  describe('AssessmentTypeSchema', () => {
    for (const t of ['DRD', 'SIRI', 'ADMA', 'CMMI', 'LEAN']) {
      it(`accepts "${t}"`, () => {
        expect(AssessmentTypeSchema.safeParse(t).success).toBe(true);
      });
    }

    it('rejects invalid type', () => {
      expect(AssessmentTypeSchema.safeParse('CUSTOM').success).toBe(false);
    });
  });

  describe('CreateAssessmentSchema', () => {
    it('accepts minimal valid input', () => {
      const r = CreateAssessmentSchema.safeParse({
        assessmentType: 'DRD',
        name: 'Q1 Assessment',
      });
      expect(r.success).toBe(true);
    });

    it('rejects empty name', () => {
      expect(
        CreateAssessmentSchema.safeParse({ assessmentType: 'DRD', name: '' }).success,
      ).toBe(false);
    });

    it('rejects name exceeding 200 chars', () => {
      expect(
        CreateAssessmentSchema.safeParse({
          assessmentType: 'DRD',
          name: 'x'.repeat(201),
        }).success,
      ).toBe(false);
    });

    it('rejects invalid assessmentType', () => {
      expect(
        CreateAssessmentSchema.safeParse({ assessmentType: 'INVALID', name: 'Test' }).success,
      ).toBe(false);
    });

    it('accepts optional projectId', () => {
      const r = CreateAssessmentSchema.safeParse({
        assessmentType: 'ADMA',
        name: 'Test',
        projectId: '00000000-0000-4000-a000-000000000000',
      });
      expect(r.success).toBe(true);
    });
  });

  describe('UpdateAssessmentSchema', () => {
    it('accepts partial update', () => {
      expect(UpdateAssessmentSchema.safeParse({ name: 'Updated' }).success).toBe(true);
    });

    it('rejects completionPercent > 100', () => {
      expect(
        UpdateAssessmentSchema.safeParse({ completionPercent: 101 }).success,
      ).toBe(false);
    });

    it('rejects confidenceAvg > 5', () => {
      expect(UpdateAssessmentSchema.safeParse({ confidenceAvg: 6 }).success).toBe(false);
    });

    it('accepts valid navigation', () => {
      const r = UpdateAssessmentSchema.safeParse({
        navigation: { axisId: 1, areaId: 'area-1', level: 1 },
      });
      expect(r.success).toBe(true);
    });
  });

  describe('SendBackSchema', () => {
    it('accepts valid comment', () => {
      expect(SendBackSchema.safeParse({ comment: 'Please revise' }).success).toBe(true);
    });

    it('rejects comment shorter than 2 chars', () => {
      expect(SendBackSchema.safeParse({ comment: 'x' }).success).toBe(false);
    });

    it('rejects missing comment', () => {
      expect(SendBackSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('GenerateInitiativesSchema', () => {
    it('accepts valid input', () => {
      const r = GenerateInitiativesSchema.safeParse({
        methodologyId: 'meth-1',
        count: 3,
      });
      expect(r.success).toBe(true);
    });

    it('rejects count > 7', () => {
      const r = GenerateInitiativesSchema.safeParse({
        methodologyId: 'meth-1',
        count: 10,
      });
      expect(r.success).toBe(false);
    });

    it('rejects empty methodologyId', () => {
      expect(
        GenerateInitiativesSchema.safeParse({ methodologyId: '', count: 1 }).success,
      ).toBe(false);
    });
  });

  describe('ListAssessmentsQuerySchema', () => {
    it('accepts valid status', () => {
      for (const s of ['DRAFT', 'IN_REVIEW', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'ARCHIVED']) {
        expect(ListAssessmentsQuerySchema.safeParse({ status: s }).success).toBe(true);
      }
    });

    it('rejects invalid status', () => {
      expect(ListAssessmentsQuerySchema.safeParse({ status: 'DELETED' }).success).toBe(false);
    });
  });
});
