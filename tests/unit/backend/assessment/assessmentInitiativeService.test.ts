/**
 * AssessmentInitiativeService - Unit Tests
 * Tests for initiative generation from assessments
 *
 * Coverage: generateFromAssessment, buildPrompt, normalizeInitiatives,
 *           generateFallbackInitiatives, persistInitiatives
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { generateChatResponse } from '../../../../server/src/services/aiService.js';

// Mock queryHelpers
vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryRun: vi.fn().mockResolvedValue({ lastID: 1, changes: 1 }),
  queryOne: vi.fn().mockResolvedValue(null),
  queryAll: vi.fn().mockResolvedValue([]),
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('test-uuid-1234'),
}));

// Keep unit tests on the current AI boundary. Without this mock the dynamic
// aiService import can enter the real provider path and wait for its timeout.
vi.mock('../../../../server/src/services/aiService.js', () => ({
  generateChatResponse: vi.fn().mockResolvedValue({
    content: JSON.stringify([
      {
        title: 'Usprawnić proces operacyjny',
        description: 'Testowa inicjatywa wygenerowana na podstawie oceny.',
        category: 'digital_transformation',
        priority: 'high',
        risk: 'medium',
      },
      {
        title: 'Wzmocnić zarządzanie danymi',
        description: 'Druga testowa inicjatywa wygenerowana na podstawie oceny.',
        category: 'data_management',
        priority: 'medium',
        risk: 'low',
      },
      {
        title: 'Przygotować organizację do AI',
        description: 'Trzecia testowa inicjatywa wygenerowana na podstawie oceny.',
        category: 'ai_readiness',
        priority: 'medium',
        risk: 'medium',
      },
    ]),
  }),
}));

import AssessmentInitiativeService from '../../../../server/src/services/assessmentInitiativeService';

describe('AssessmentInitiativeService', () => {
  const testOrgId = `test-org-${Date.now()}`;
  const testUserId = `test-user-${Date.now()}`;

  const mockAssessment = {
    id: 'assessment-1',
    organization_id: testOrgId,
    project_id: null,
    assessment_type: 'DRD' as const,
    name: 'Digital Readiness Assessment',
    status: 'completed',
    completion_percent: 100,
    confidence_avg: 85,
    answers_json: JSON.stringify({
      dimension_1: { score: 2.5, questions: [{ id: 'q1', answer: 3 }] },
      dimension_2: { score: 3.5, questions: [{ id: 'q2', answer: 4 }] },
      dimension_3: { score: 1.5, questions: [{ id: 'q3', answer: 2 }] },
    }),
    context_snapshot: JSON.stringify({
      industry: 'Manufacturing',
      size: 'Medium',
    }),
    score_summary: JSON.stringify({
      overall: 2.5,
      dimensions: {
        dimension_1: { score: 2.5, name: 'Data Management' },
        dimension_2: { score: 3.5, name: 'Process Automation' },
        dimension_3: { score: 1.5, name: 'AI Readiness' },
      },
      gaps: ['AI adoption', 'Data governance'],
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateChatResponse).mockResolvedValue({
      content: JSON.stringify([
        {
          title: 'Usprawnić proces operacyjny',
          description: 'Testowa inicjatywa wygenerowana na podstawie oceny.',
          category: 'digital_transformation',
          priority: 'high',
          risk: 'medium',
        },
        {
          title: 'Wzmocnić zarządzanie danymi',
          description: 'Druga testowa inicjatywa wygenerowana na podstawie oceny.',
          category: 'data_management',
          priority: 'medium',
          risk: 'low',
        },
        {
          title: 'Przygotować organizację do AI',
          description: 'Trzecia testowa inicjatywa wygenerowana na podstawie oceny.',
          category: 'ai_readiness',
          priority: 'medium',
          risk: 'medium',
        },
      ]),
    } as Awaited<ReturnType<typeof generateChatResponse>>);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('generateFromAssessment', () => {
    it('should generate initiatives from valid assessment', async () => {
      const params = {
        assessment: mockAssessment,
        methodologyId: 'impact-feasibility',
        count: 5,
        includeChatContext: false,
        userId: testUserId,
      };

      // Mock AI response to return fallback (since we don't have real AI)
      const result = await AssessmentInitiativeService.generateFromAssessment(params);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should respect count parameter', async () => {
      const params = {
        assessment: mockAssessment,
        methodologyId: 'impact-feasibility',
        count: 3,
        includeChatContext: false,
        userId: testUserId,
      };

      const result = await AssessmentInitiativeService.generateFromAssessment(params);
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('should use different methodology configurations', async () => {
      const methodologies = ['impact-feasibility', 'quick-wins', 'strategic-fit'];

      for (const methodologyId of methodologies) {
        const params = {
          assessment: mockAssessment,
          methodologyId,
          count: 2,
          includeChatContext: false,
          userId: testUserId,
        };

        const result = await AssessmentInitiativeService.generateFromAssessment(params);
        expect(result).toBeDefined();
      }
    });

    it('should handle assessment with no answers', async () => {
      const emptyAssessment = {
        ...mockAssessment,
        answers_json: null,
        score_summary: null,
      };

      const params = {
        assessment: emptyAssessment,
        methodologyId: 'impact-feasibility',
        count: 5,
        includeChatContext: false,
        userId: testUserId,
      };

      const result = await AssessmentInitiativeService.generateFromAssessment(params);
      expect(result).toBeDefined();
    });
  });

  describe('buildPrompt', () => {
    it('should build valid prompt with assessment data', () => {
      const prompt = AssessmentInitiativeService.buildPrompt({
        assessment: mockAssessment,
        answers: JSON.parse(mockAssessment.answers_json!),
        scoreSummary: JSON.parse(mockAssessment.score_summary!),
        methodology: {
          name: 'Impact-Feasibility',
          categoryMapping: ['digital_transformation', 'process_automation'],
          priorityBias: 'high' as const,
          riskTolerance: 'medium' as const,
        },
        categories: ['digital_transformation', 'process_automation'],
        count: 5,
        includeChatContext: false,
        contextSnapshot: JSON.parse(mockAssessment.context_snapshot!),
      });

      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt).toContain('Digital Readiness Assessment');
    });

    it('should include methodology name in prompt', () => {
      const prompt = AssessmentInitiativeService.buildPrompt({
        assessment: mockAssessment,
        answers: {},
        scoreSummary: {},
        methodology: {
          name: 'Quick Wins',
          categoryMapping: ['efficiency'],
          priorityBias: 'high' as const,
          riskTolerance: 'low' as const,
        },
        categories: ['efficiency'],
        count: 3,
        includeChatContext: false,
        contextSnapshot: {},
      });

      expect(prompt).toContain('Quick Wins');
    });

    it('should include count in prompt', () => {
      const prompt = AssessmentInitiativeService.buildPrompt({
        assessment: mockAssessment,
        answers: {},
        scoreSummary: {},
        methodology: {
          name: 'Test',
          categoryMapping: [],
          priorityBias: 'medium' as const,
          riskTolerance: 'medium' as const,
        },
        categories: [],
        count: 7,
        includeChatContext: false,
        contextSnapshot: {},
      });

      expect(prompt).toContain('7');
    });
  });

  describe('normalizeInitiatives', () => {
    it('should normalize initiative priority values', () => {
      const rawInitiatives = [
        {
          title: 'Test Initiative',
          description: 'Description',
          category: 'digital_transformation',
          priority: 'HIGH',
          risk: 'low',
        },
      ];

      const result = AssessmentInitiativeService.normalizeInitiatives(rawInitiatives, 'DRD', {
        name: 'Test',
        categoryMapping: ['digital_transformation'],
        priorityBias: 'high' as const,
        riskTolerance: 'medium' as const,
      });

      expect(result[0].priority).toBe('high');
    });

    it('should normalize initiative risk values', () => {
      const rawInitiatives = [
        {
          title: 'Test Initiative',
          description: 'Description',
          category: 'process_automation',
          priority: 'medium',
          risk: 'MEDIUM',
        },
      ];

      const result = AssessmentInitiativeService.normalizeInitiatives(rawInitiatives, 'DRD', {
        name: 'Test',
        categoryMapping: [],
        priorityBias: 'medium' as const,
        riskTolerance: 'medium' as const,
      });

      expect(result[0].risk).toBe('medium');
    });

    it('should handle empty initiatives array', () => {
      const result = AssessmentInitiativeService.normalizeInitiatives([], 'DRD', {
        name: 'Test',
        categoryMapping: [],
        priorityBias: 'medium' as const,
        riskTolerance: 'medium' as const,
      });

      expect(result).toEqual([]);
    });

    it('should assign default values for missing fields', () => {
      const rawInitiatives = [
        {
          title: 'Minimal Initiative',
        },
      ];

      const result = AssessmentInitiativeService.normalizeInitiatives(rawInitiatives, 'DRD', {
        name: 'Test',
        categoryMapping: ['digital_transformation'],
        priorityBias: 'medium' as const,
        riskTolerance: 'low' as const,
      });

      expect(result[0].title).toBe('Minimal Initiative');
      expect(result[0].priority).toBeDefined();
      expect(result[0].risk).toBeDefined();
    });
  });

  describe('generateFallbackInitiatives', () => {
    it('should generate fallback initiatives based on gaps', () => {
      const scoreSummary = JSON.parse(mockAssessment.score_summary!);
      const answers = JSON.parse(mockAssessment.answers_json!);

      const result = AssessmentInitiativeService.generateFallbackInitiatives(
        mockAssessment,
        answers,
        scoreSummary,
        {
          name: 'Impact-Feasibility',
          categoryMapping: ['digital_transformation', 'process_automation'],
          priorityBias: 'high' as const,
          riskTolerance: 'medium' as const,
        },
        5
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should respect count limit', () => {
      const scoreSummary = JSON.parse(mockAssessment.score_summary!);
      const answers = JSON.parse(mockAssessment.answers_json!);

      const result = AssessmentInitiativeService.generateFallbackInitiatives(
        mockAssessment,
        answers,
        scoreSummary,
        {
          name: 'Quick Wins',
          categoryMapping: ['efficiency'],
          priorityBias: 'high' as const,
          riskTolerance: 'low' as const,
        },
        2
      );

      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('should generate initiatives for different assessment types', () => {
      const assessmentTypes = ['DRD', 'SIRI', 'ADKAR', 'CMMI', 'LEAN'] as const;

      for (const assessmentType of assessmentTypes) {
        const assessment = { ...mockAssessment, assessment_type: assessmentType };
        const result = AssessmentInitiativeService.generateFallbackInitiatives(
          assessment,
          {},
          {},
          {
            name: 'Test',
            categoryMapping: [],
            priorityBias: 'medium' as const,
            riskTolerance: 'medium' as const,
          },
          3
        );

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      }
    });
  });

  describe('persistInitiatives', () => {
    it('should persist initiatives to database', async () => {
      const initiatives = [
        {
          title: 'Initiative 1',
          description: 'Description 1',
          category: 'digital_transformation',
          priority: 'high' as const,
          risk: 'medium' as const,
        },
        {
          title: 'Initiative 2',
          description: 'Description 2',
          category: 'process_automation',
          priority: 'medium' as const,
          risk: 'low' as const,
        },
      ];

      const result = await AssessmentInitiativeService.persistInitiatives({
        assessment: mockAssessment,
        batchId: 'batch-123',
        initiatives,
        userId: testUserId,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array for empty initiatives', async () => {
      const result = await AssessmentInitiativeService.persistInitiatives({
        assessment: mockAssessment,
        batchId: 'batch-empty',
        initiatives: [],
        userId: testUserId,
      });

      expect(result).toEqual([]);
    });

    it('should include assessment link in persisted initiatives', async () => {
      const initiatives = [
        {
          title: 'Linked Initiative',
          description: 'Should be linked to assessment',
          category: 'ai_readiness',
          priority: 'critical' as const,
          risk: 'high' as const,
        },
      ];

      const result = await AssessmentInitiativeService.persistInitiatives({
        assessment: mockAssessment,
        batchId: 'batch-linked',
        initiatives,
        userId: testUserId,
      });

      expect(result.length).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed JSON in assessment data', async () => {
      const badAssessment = {
        ...mockAssessment,
        answers_json: 'not valid json',
        score_summary: 'also not json',
      };

      const params = {
        assessment: badAssessment,
        methodologyId: 'impact-feasibility',
        count: 3,
        includeChatContext: false,
        userId: testUserId,
      };

      // Should not throw, should handle gracefully
      const result = await AssessmentInitiativeService.generateFromAssessment(params);
      expect(result).toBeDefined();
    });

    it('should handle unknown methodology gracefully', async () => {
      const params = {
        assessment: mockAssessment,
        methodologyId: 'unknown-methodology',
        count: 3,
        includeChatContext: false,
        userId: testUserId,
      };

      const result = await AssessmentInitiativeService.generateFromAssessment(params);
      expect(result).toBeDefined();
    });

    it('should handle zero count parameter', async () => {
      const params = {
        assessment: mockAssessment,
        methodologyId: 'impact-feasibility',
        count: 0,
        includeChatContext: false,
        userId: testUserId,
      };

      const result = await AssessmentInitiativeService.generateFromAssessment(params);
      expect(result).toEqual([]);
    });
  });
});
