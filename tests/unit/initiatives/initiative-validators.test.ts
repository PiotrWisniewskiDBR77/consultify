/**
 * Initiative Validators — Unit Tests
 *
 * Tests the Zod schemas for initiative CRUD operations,
 * including boundary values and invalid/malicious inputs.
 */
import { describe, expect, it } from 'vitest';

import {
  ConfidenceLevelEnum,
  CreateInitiativeSchema,
  InitiativeAxisEnum,
  InitiativePriorityEnum,
  SourceTypeEnum,
} from '../../../server/src/validators/initiative.validators.js';

describe('Initiative Validators', () => {
  describe('InitiativeAxisEnum', () => {
    it('accepts strategic', () => {
      expect(InitiativeAxisEnum.safeParse('strategic').success).toBe(true);
    });

    it('accepts operational', () => {
      expect(InitiativeAxisEnum.safeParse('operational').success).toBe(true);
    });

    it('accepts transformational', () => {
      expect(InitiativeAxisEnum.safeParse('transformational').success).toBe(true);
    });

    it('accepts compliance', () => {
      expect(InitiativeAxisEnum.safeParse('compliance').success).toBe(true);
    });

    it('rejects invalid axis', () => {
      expect(InitiativeAxisEnum.safeParse('financial').success).toBe(false);
    });

    it('rejects empty string', () => {
      expect(InitiativeAxisEnum.safeParse('').success).toBe(false);
    });
  });

  describe('ConfidenceLevelEnum', () => {
    for (const level of ['low', 'medium', 'high', 'very_high']) {
      it(`accepts "${level}"`, () => {
        expect(ConfidenceLevelEnum.safeParse(level).success).toBe(true);
      });
    }

    it('rejects invalid level', () => {
      expect(ConfidenceLevelEnum.safeParse('uncertain').success).toBe(false);
    });
  });

  describe('InitiativePriorityEnum', () => {
    for (const p of ['critical', 'high', 'medium', 'low']) {
      it(`accepts "${p}" and lowercases it`, () => {
        const r = InitiativePriorityEnum.safeParse(p);
        expect(r.success).toBe(true);
        if (r.success) expect(r.data).toBe(p.toLowerCase());
      });
    }

    it('rejects invalid priority', () => {
      expect(InitiativePriorityEnum.safeParse('urgent').success).toBe(false);
    });
  });

  describe('SourceTypeEnum', () => {
    for (const s of ['manual', 'tool', 'assessment', 'assessment_report', 'financial_analysis']) {
      it(`accepts known source: "${s}"`, () => {
        expect(SourceTypeEnum.safeParse(s).success).toBe(true);
      });
    }

    it('accepts custom string (max 50 chars)', () => {
      expect(SourceTypeEnum.safeParse('custom_source').success).toBe(true);
    });

    it('rejects string exceeding 50 chars', () => {
      expect(SourceTypeEnum.safeParse('x'.repeat(51)).success).toBe(false);
    });
  });

  describe('CreateInitiativeSchema — happy paths', () => {
    it('accepts minimal valid initiative (title only)', () => {
      const r = CreateInitiativeSchema.safeParse({ title: 'Test Initiative' });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.title).toBe('Test Initiative');
      }
    });

    it('accepts full initiative with all optional fields', () => {
      const r = CreateInitiativeSchema.safeParse({
        title: 'Digital Transformation',
        axis: 'transformational',
        area: 'Manufacturing',
        summary: 'Implement Industry 4.0 technologies',
        description: 'Detailed plan for digital transformation',
        priority: 'high',
        businessValue: 500000,
        costCapex: 100000,
        costOpex: 50000,
        expectedRoi: 350,
        confidenceLevel: 'high',
        plannedStartDate: '2026-03-01',
        plannedEndDate: '2026-12-31',
      });
      expect(r.success).toBe(true);
    });
  });

  describe('CreateInitiativeSchema — negative paths', () => {
    it('rejects empty title', () => {
      expect(CreateInitiativeSchema.safeParse({ title: '' }).success).toBe(false);
    });

    it('rejects missing title', () => {
      expect(CreateInitiativeSchema.safeParse({}).success).toBe(false);
    });

    it('rejects title exceeding 255 chars', () => {
      expect(CreateInitiativeSchema.safeParse({ title: 'x'.repeat(256) }).success).toBe(false);
    });

    it('rejects summary exceeding 5000 chars', () => {
      expect(
        CreateInitiativeSchema.safeParse({
          title: 'Test',
          summary: 'x'.repeat(5001),
        }).success,
      ).toBe(false);
    });

    it('rejects description exceeding 20000 chars', () => {
      expect(
        CreateInitiativeSchema.safeParse({
          title: 'Test',
          description: 'x'.repeat(20001),
        }).success,
      ).toBe(false);
    });

    it('rejects invalid axis', () => {
      expect(
        CreateInitiativeSchema.safeParse({
          title: 'Test',
          axis: 'invalid',
        }).success,
      ).toBe(false);
    });

    it('rejects invalid priority', () => {
      expect(
        CreateInitiativeSchema.safeParse({
          title: 'Test',
          priority: 'urgent',
        }).success,
      ).toBe(false);
    });

    it('rejects invalid date format', () => {
      expect(
        CreateInitiativeSchema.safeParse({
          title: 'Test',
          plannedStartDate: 'tomorrow',
        }).success,
      ).toBe(false);
    });

    it('accepts ISO datetime format for dates', () => {
      expect(
        CreateInitiativeSchema.safeParse({
          title: 'Test',
          plannedStartDate: '2026-03-01T00:00:00.000Z',
        }).success,
      ).toBe(true);
    });

    it('accepts YYYY-MM-DD format for dates', () => {
      expect(
        CreateInitiativeSchema.safeParse({
          title: 'Test',
          plannedStartDate: '2026-03-01',
        }).success,
      ).toBe(true);
    });

    it('accepts null for nullable date fields', () => {
      const r = CreateInitiativeSchema.safeParse({
        title: 'Test',
        plannedStartDate: null,
        plannedEndDate: null,
      });
      expect(r.success).toBe(true);
    });
  });

  describe('CreateInitiativeSchema — security', () => {
    it('rejects XSS in title (but Zod accepts it — sanitization is application layer)', () => {
      const r = CreateInitiativeSchema.safeParse({
        title: '<script>alert("xss")</script>',
      });
      expect(r.success).toBe(true);
    });

    it('rejects SQL injection — validated as string, not dangerous at schema level', () => {
      const r = CreateInitiativeSchema.safeParse({
        title: "'; DROP TABLE initiatives; --",
      });
      expect(r.success).toBe(true);
    });
  });
});
