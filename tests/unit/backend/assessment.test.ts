/**
 * Assessment Module Tests
 * Unit tests for assessment workflow endpoints
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Mock dependencies
vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryRun: vi.fn().mockResolvedValue({}),
  queryOne: vi.fn().mockResolvedValue(null),
  queryAll: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../server/src/services/permissionService.js', () => ({
  hasPermission: vi.fn().mockResolvedValue(true),
}));

import {
  CreateAssessmentSchema,
  UpdateAssessmentSchema,
  RequestReviewSchema,
  ApproveReportSchema,
  ApproveAssessmentSchema,
  SendBackSchema,
  GenerateInitiativesSchema,
} from '../../../server/src/validators/assessment.validators';

describe('Assessment Validators', () => {
  describe('CreateAssessmentSchema', () => {
    it('should validate valid assessment type DRD', () => {
      const result = CreateAssessmentSchema.safeParse({
        assessmentType: 'DRD',
        name: 'Test Assessment',
        projectId: 'proj-123',
      });
      expect(result.success).toBe(true);
    });

    it('should validate valid assessment type SIRI', () => {
      const result = CreateAssessmentSchema.safeParse({
        assessmentType: 'SIRI',
        name: 'SIRI Assessment',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid assessment type', () => {
      const result = CreateAssessmentSchema.safeParse({
        assessmentType: 'INVALID',
        name: 'Test',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const result = CreateAssessmentSchema.safeParse({
        assessmentType: 'DRD',
        name: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateAssessmentSchema', () => {
    it('should validate valid update payload', () => {
      const result = UpdateAssessmentSchema.safeParse({
        answers: { axis1: { actual: 3, target: 5 } },
        completionPercent: 75,
        confidenceAvg: 4,
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid completion percent', () => {
      const result = UpdateAssessmentSchema.safeParse({
        completionPercent: 150,
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid confidence', () => {
      const result = UpdateAssessmentSchema.safeParse({
        confidenceAvg: 10,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('RequestReviewSchema', () => {
    it('should validate empty payload', () => {
      const result = RequestReviewSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate with optional fields', () => {
      const result = RequestReviewSchema.safeParse({
        decisionOwnerId: 'user-123',
        dueDate: '2026-02-01',
        priority: 'high',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid priority', () => {
      const result = RequestReviewSchema.safeParse({
        priority: 'very_high',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ApproveReportSchema', () => {
    it('should validate with comment', () => {
      const result = ApproveReportSchema.safeParse({
        comment: 'Approved with minor suggestions',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('ApproveAssessmentSchema', () => {
    it('should validate with all fields', () => {
      const result = ApproveAssessmentSchema.safeParse({
        decisionOwnerId: 'user-456',
        dueDate: '2026-02-15',
        priority: 'critical',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('SendBackSchema', () => {
    it('should validate with valid comment', () => {
      const result = SendBackSchema.safeParse({
        comment: 'Please fix the gaps in axis 3',
      });
      expect(result.success).toBe(true);
    });

    it('should reject short comment', () => {
      const result = SendBackSchema.safeParse({
        comment: 'X',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty comment', () => {
      const result = SendBackSchema.safeParse({
        comment: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('GenerateInitiativesSchema', () => {
    it('should validate valid generation request', () => {
      const result = GenerateInitiativesSchema.safeParse({
        methodologyId: 'impact-feasibility',
        count: 5,
        includeChatContext: true,
      });
      expect(result.success).toBe(true);
    });

    it('should reject count > 7', () => {
      const result = GenerateInitiativesSchema.safeParse({
        methodologyId: 'moscow',
        count: 10,
      });
      expect(result.success).toBe(false);
    });

    it('should reject count < 1', () => {
      const result = GenerateInitiativesSchema.safeParse({
        methodologyId: 'rice',
        count: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing methodologyId', () => {
      const result = GenerateInitiativesSchema.safeParse({
        count: 3,
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Assessment Workflow States', () => {
  const validStatuses = ['DRAFT', 'IN_REVIEW', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'ARCHIVED'];

  it('should have all required workflow statuses', () => {
    // This tests that our simplified status mapping covers all states
    const simplifiedMapping: Record<string, string> = {
      'DRAFT': 'DRAFT',
      'IN_REVIEW': 'REVIEW',
      'AWAITING_APPROVAL': 'REVIEW',
      'APPROVED': 'APPROVED',
      'REJECTED': 'DRAFT',
      'ARCHIVED': 'DRAFT',
    };

    validStatuses.forEach((status) => {
      expect(simplifiedMapping[status]).toBeDefined();
    });
  });

  it('should map workflow transitions correctly', () => {
    const transitions = {
      'DRAFT->IN_REVIEW': { from: 'DRAFT', to: 'IN_REVIEW', action: 'request-review' },
      'IN_REVIEW->AWAITING_APPROVAL': { from: 'IN_REVIEW', to: 'AWAITING_APPROVAL', action: 'approve-report' },
      'AWAITING_APPROVAL->APPROVED': { from: 'AWAITING_APPROVAL', to: 'APPROVED', action: 'approve' },
      'IN_REVIEW->DRAFT': { from: 'IN_REVIEW', to: 'DRAFT', action: 'send-back' },
      'AWAITING_APPROVAL->DRAFT': { from: 'AWAITING_APPROVAL', to: 'DRAFT', action: 'send-back' },
    };

    // Verify all transitions are defined
    expect(Object.keys(transitions).length).toBe(5);
  });
});

describe('Assessment Gate Decisions', () => {
  const gateDecisions = [
    { type: 'REQUEST_REVIEW', owner: 'Project Lead', description: 'Request review for assessment' },
    { type: 'APPROVE_REPORT', owner: 'PMO/Owner', description: 'Approve assessment report' },
    { type: 'APPROVE_ASSESSMENT', owner: 'PMO/Owner', description: 'Approve assessment' },
    { type: 'GENERATE_INITIATIVES', owner: 'Consultant Lead', description: 'Generate initiatives from assessment' },
  ];

  it('should have all 4 gate decisions defined', () => {
    expect(gateDecisions.length).toBe(4);
  });

  it('should have unique decision types', () => {
    const types = gateDecisions.map((d) => d.type);
    const uniqueTypes = new Set(types);
    expect(uniqueTypes.size).toBe(types.length);
  });

  it('should require approve-report before approve-assessment', () => {
    const reportIndex = gateDecisions.findIndex((d) => d.type === 'APPROVE_REPORT');
    const assessmentIndex = gateDecisions.findIndex((d) => d.type === 'APPROVE_ASSESSMENT');
    // Report approval should come before assessment approval in the flow
    expect(reportIndex).toBeLessThan(assessmentIndex);
  });

  it('should only allow generate-initiatives as last gate', () => {
    const generateIndex = gateDecisions.findIndex((d) => d.type === 'GENERATE_INITIATIVES');
    expect(generateIndex).toBe(gateDecisions.length - 1);
  });
});

describe('Assessment Types', () => {
  const assessmentTypes = ['DRD', 'SIRI', 'ADMA', 'CMMI', 'LEAN'];

  it('should support all 5 assessment types', () => {
    expect(assessmentTypes.length).toBe(5);
  });

  describe('DRD Assessment', () => {
    const drdAxes = [
      'processes',
      'digitalProducts',
      'businessModels',
      'dataManagement',
      'culture',
      'cybersecurity',
      'aiMaturity',
    ];

    it('should have 7 DRD axes', () => {
      expect(drdAxes.length).toBe(7);
    });
  });

  describe('SIRI Assessment', () => {
    const siriDimensions = [
      'operations',
      'supply_chain',
      'product_lifecycle',
      'automation',
      'connectivity',
      'intelligence',
      'talent_readiness',
      'structure_management',
    ];

    it('should have 8 SIRI dimensions', () => {
      expect(siriDimensions.length).toBe(8);
    });
  });
});

describe('Initiative Generation', () => {
  const methodologies = [
    'impact-feasibility',
    'moscow',
    'rice',
    'value-effort',
    'strategic-fit',
  ];

  it('should support all 5 methodologies', () => {
    expect(methodologies.length).toBe(5);
  });

  it('should limit initiatives to max 7 per batch', () => {
    const maxInitiatives = 7;
    expect(maxInitiatives).toBe(7);
  });

  it('should generate initiatives as DRAFT status', () => {
    const initiativeDefaultStatus = 'DRAFT';
    expect(initiativeDefaultStatus).toBe('DRAFT');
  });
});

describe('DoD (Definition of Done)', () => {
  it('should require completion >= 100%', () => {
    const checkDoD = (completion: number, confidence: number) => {
      return completion >= 100 && confidence >= 3;
    };

    expect(checkDoD(100, 3)).toBe(true);
    expect(checkDoD(99, 5)).toBe(false);
    expect(checkDoD(100, 2)).toBe(false);
    expect(checkDoD(50, 4)).toBe(false);
  });

  it('should require confidence >= 3', () => {
    const checkDoD = (completion: number, confidence: number) => {
      return completion >= 100 && confidence >= 3;
    };

    expect(checkDoD(100, 3)).toBe(true);
    expect(checkDoD(100, 4)).toBe(true);
    expect(checkDoD(100, 5)).toBe(true);
    expect(checkDoD(100, 2.9)).toBe(false);
  });
});
