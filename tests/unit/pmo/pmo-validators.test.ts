/**
 * PMO Validators — Unit Tests (REAL CODE)
 *
 * Tests Zod schemas from server/src/validators/projects.validators.ts
 * and server/src/validators/decision.validators.ts
 */
import { describe, expect, it } from 'vitest';

import {
  CreateDecisionSchema,
  DecideSchema,
  PMODomain,
  DecisionStatusEnum,
} from '../../../server/src/validators/decision.validators.js';
import {
  CreateProjectRequestSchema,
  UpdateProjectRequestSchema,
  UpdateAIRoleSchema,
  UpdateRegulatoryModeSchema,
} from '../../../server/src/validators/projects.validators.js';

describe('PMO Validators (REAL)', () => {
  describe('CreateProjectRequestSchema', () => {
    it('accepts minimal valid input', () => {
      const r = CreateProjectRequestSchema.safeParse({ name: 'New Project' });
      expect(r.success).toBe(true);
    });

    it('rejects empty name', () => {
      expect(CreateProjectRequestSchema.safeParse({ name: '' }).success).toBe(false);
    });

    it('rejects name exceeding 255 chars', () => {
      expect(CreateProjectRequestSchema.safeParse({ name: 'x'.repeat(256) }).success).toBe(false);
    });

    it('accepts optional description', () => {
      const r = CreateProjectRequestSchema.safeParse({
        name: 'Project',
        description: 'Project description',
      });
      expect(r.success).toBe(true);
    });
  });

  describe('UpdateProjectRequestSchema', () => {
    it('accepts valid status', () => {
      for (const s of ['active', 'archived', 'completed']) {
        expect(UpdateProjectRequestSchema.safeParse({ status: s }).success).toBe(true);
      }
    });

    it('rejects invalid status', () => {
      expect(UpdateProjectRequestSchema.safeParse({ status: 'deleted' }).success).toBe(false);
    });
  });

  describe('UpdateAIRoleSchema', () => {
    it('accepts all AI roles', () => {
      for (const r of ['ADVISOR', 'MANAGER', 'OPERATOR']) {
        expect(UpdateAIRoleSchema.safeParse({ aiRole: r }).success).toBe(true);
      }
    });

    it('rejects invalid aiRole', () => {
      expect(UpdateAIRoleSchema.safeParse({ aiRole: 'ADMIN' }).success).toBe(false);
    });
  });

  describe('UpdateRegulatoryModeSchema', () => {
    it('accepts enabled true', () => {
      expect(UpdateRegulatoryModeSchema.safeParse({ enabled: true }).success).toBe(true);
    });

    it('accepts enabled false', () => {
      expect(UpdateRegulatoryModeSchema.safeParse({ enabled: false }).success).toBe(true);
    });

    it('rejects missing enabled', () => {
      expect(UpdateRegulatoryModeSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('CreateDecisionSchema', () => {
    it('accepts minimal valid input', () => {
      const r = CreateDecisionSchema.safeParse({ title: 'Approve scope change' });
      expect(r.success).toBe(true);
    });

    it('rejects empty title', () => {
      expect(CreateDecisionSchema.safeParse({ title: '' }).success).toBe(false);
    });

    it('accepts valid pmoDomain', () => {
      const r = CreateDecisionSchema.safeParse({
        title: 'Decision',
        pmoDomain: PMODomain.GOVERNANCE_DECISION_MAKING,
      });
      expect(r.success).toBe(true);
    });

    it('accepts valid priority', () => {
      for (const p of ['low', 'medium', 'high', 'critical']) {
        expect(CreateDecisionSchema.safeParse({ title: 'X', priority: p }).success).toBe(true);
      }
    });
  });

  describe('DecideSchema', () => {
    it('accepts decision approved', () => {
      const r = DecideSchema.safeParse({ decision: 'approved', rationale: 'Looks good' });
      expect(r.success).toBe(true);
    });

    it('accepts status APPROVED', () => {
      const r = DecideSchema.safeParse({ status: 'APPROVED', rationale: 'Approved' });
      expect(r.success).toBe(true);
    });

    it('rejects empty when both decision and status missing', () => {
      expect(DecideSchema.safeParse({ rationale: 'Only rationale' }).success).toBe(false);
    });

    it('rejects rationale shorter than 1 when provided', () => {
      const r = DecideSchema.safeParse({ decision: 'approved', rationale: '' });
      expect(r.success).toBe(false);
    });
  });

  describe('DecisionStatusEnum', () => {
    for (const s of ['pending', 'approved', 'rejected', 'escalated', 'cancelled']) {
      it(`accepts "${s}"`, () => {
        expect(DecisionStatusEnum.safeParse(s).success).toBe(true);
      });
    }

    it('rejects invalid status', () => {
      expect(DecisionStatusEnum.safeParse('resolved').success).toBe(false);
    });
  });
});
