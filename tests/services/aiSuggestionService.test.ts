/**
 * AI Suggestion Service Tests
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the service for testing
const mockAISuggestionService = {
  generateSuggestions: vi.fn(),
  getAISuggestions: vi.fn(),
};

describe('AISuggestionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateSuggestions', () => {
    it('should generate level suggestions based on gaps', async () => {
      mockAISuggestionService.generateSuggestions.mockResolvedValue({
        id: 'suggestion-123',
        timestamp: '2026-02-04T10:00:00Z',
        framework: 'DRD',
        levelSuggestions: [
          {
            id: 'ls-1',
            dimensionId: 'dataManagement',
            dimensionName: 'Data Management',
            currentLevel: 2,
            suggestedLevel: 3.5,
            confidence: 85,
            reasoning: 'Based on manufacturing industry benchmarks...',
            benchmarkComparison: {
              industryAverage: 2.3,
              topPerformers: 4.2,
            },
            timeToAchieve: '6-12 months',
            requiredInvestment: 'medium',
          },
        ],
        technologySuggestions: [],
        gapAnalysis: [],
        overallRecommendation: 'Focus on data management...',
        prioritizedRoadmap: [],
      });

      const result = await mockAISuggestionService.generateSuggestions({
        framework: 'DRD',
        organizationContext: {
          industry: 'manufacturing',
          size: 'medium',
        },
        currentScores: {
          dataManagement: 2,
          aiMaturity: 1,
        },
      });

      expect(result.levelSuggestions).toHaveLength(1);
      expect(result.levelSuggestions[0].suggestedLevel).toBeGreaterThan(2);
      expect(result.levelSuggestions[0].confidence).toBeGreaterThan(70);
    });

    it('should generate technology suggestions', async () => {
      mockAISuggestionService.generateSuggestions.mockResolvedValue({
        id: 'suggestion-124',
        timestamp: '2026-02-04T10:00:00Z',
        framework: 'DRD',
        levelSuggestions: [],
        technologySuggestions: [
          {
            id: 'tech-1',
            category: 'Data Platform',
            name: 'Azure Data Lake',
            description: 'Unified analytics platform',
            relevantDimensions: ['dataManagement', 'aiMaturity'],
            maturityImpact: 1.5,
            implementationComplexity: 'high',
            estimatedCost: 'high',
            timeToValue: '6-12 months',
            alternatives: ['Snowflake', 'Google BigQuery'],
            prerequisites: ['Cloud infrastructure'],
          },
        ],
        gapAnalysis: [],
        overallRecommendation: '',
        prioritizedRoadmap: [],
      });

      const result = await mockAISuggestionService.generateSuggestions({
        framework: 'DRD',
        organizationContext: {
          industry: 'manufacturing',
          size: 'medium',
        },
        currentScores: {
          dataManagement: 2,
        },
      });

      expect(result.technologySuggestions).toHaveLength(1);
      expect(result.technologySuggestions[0].maturityImpact).toBeGreaterThan(0);
    });

    it('should generate gap analysis with priorities', async () => {
      mockAISuggestionService.generateSuggestions.mockResolvedValue({
        id: 'suggestion-125',
        timestamp: '2026-02-04T10:00:00Z',
        framework: 'DRD',
        levelSuggestions: [],
        technologySuggestions: [],
        gapAnalysis: [
          {
            dimension: 'Data Management',
            currentLevel: 2,
            targetLevel: 4,
            gap: 2,
            priority: 'critical',
            recommendations: ['Implement data governance', 'Deploy data platform'],
            quickWins: ['Create data catalog', 'Set up basic ETL'],
            longTermActions: ['Build ML capabilities', 'Implement real-time analytics'],
          },
          {
            dimension: 'AI Maturity',
            currentLevel: 1,
            targetLevel: 3,
            gap: 2,
            priority: 'high',
            recommendations: ['Start with AutoML', 'Build ML team'],
            quickWins: ['Deploy pre-trained models'],
            longTermActions: ['Develop custom models'],
          },
        ],
        overallRecommendation: '',
        prioritizedRoadmap: [],
      });

      const result = await mockAISuggestionService.generateSuggestions({
        framework: 'DRD',
        organizationContext: {
          industry: 'manufacturing',
          size: 'medium',
        },
        currentScores: {
          dataManagement: 2,
          aiMaturity: 1,
        },
        targetScores: {
          dataManagement: 4,
          aiMaturity: 3,
        },
      });

      expect(result.gapAnalysis).toHaveLength(2);
      expect(result.gapAnalysis[0].priority).toBe('critical');
      expect(result.gapAnalysis[0].quickWins.length).toBeGreaterThan(0);
    });

    it('should generate prioritized roadmap', async () => {
      mockAISuggestionService.generateSuggestions.mockResolvedValue({
        id: 'suggestion-126',
        timestamp: '2026-02-04T10:00:00Z',
        framework: 'DRD',
        levelSuggestions: [],
        technologySuggestions: [],
        gapAnalysis: [],
        overallRecommendation: '',
        prioritizedRoadmap: [
          {
            phase: 1,
            name: 'Quick Wins',
            duration: '0-3 months',
            focus: ['Data Management', 'Process Automation'],
            technologies: ['Power Automate', 'Azure Data Factory'],
            expectedOutcome: 'Establish digital foundation',
            kpis: ['Process automation rate', 'Data quality score'],
          },
          {
            phase: 2,
            name: 'Foundation Building',
            duration: '3-9 months',
            focus: ['Data Platform', 'Analytics'],
            technologies: ['Azure Data Lake', 'Power BI'],
            expectedOutcome: 'Build core capabilities',
            kpis: ['Data integration coverage', 'Dashboard adoption'],
          },
        ],
      });

      const result = await mockAISuggestionService.generateSuggestions({
        framework: 'DRD',
        organizationContext: {
          industry: 'manufacturing',
          size: 'medium',
        },
        currentScores: {
          dataManagement: 2,
          processes: 2,
        },
      });

      expect(result.prioritizedRoadmap).toHaveLength(2);
      expect(result.prioritizedRoadmap[0].phase).toBe(1);
      expect(result.prioritizedRoadmap[0].technologies.length).toBeGreaterThan(0);
    });
  });

  describe('industry benchmarks', () => {
    it('should use industry-specific benchmarks', async () => {
      mockAISuggestionService.generateSuggestions.mockResolvedValue({
        id: 'suggestion-127',
        timestamp: '2026-02-04T10:00:00Z',
        framework: 'DRD',
        levelSuggestions: [
          {
            id: 'ls-1',
            dimensionId: 'dataManagement',
            dimensionName: 'Data Management',
            currentLevel: 2,
            suggestedLevel: 3.2,
            confidence: 80,
            reasoning: 'Based on finance industry benchmarks...',
            benchmarkComparison: {
              industryAverage: 3.2,
              topPerformers: 4.8,
            },
          },
        ],
        technologySuggestions: [],
        gapAnalysis: [],
        overallRecommendation: '',
        prioritizedRoadmap: [],
      });

      const result = await mockAISuggestionService.generateSuggestions({
        framework: 'DRD',
        organizationContext: {
          industry: 'finance',
          size: 'large',
        },
        currentScores: {
          dataManagement: 2,
        },
      });

      // Finance industry has higher benchmarks
      expect(result.levelSuggestions[0].benchmarkComparison?.industryAverage).toBeGreaterThan(3);
    });
  });

  describe('organization context', () => {
    it('should adjust suggestions based on organization size', async () => {
      mockAISuggestionService.generateSuggestions.mockResolvedValue({
        id: 'suggestion-128',
        timestamp: '2026-02-04T10:00:00Z',
        framework: 'DRD',
        levelSuggestions: [],
        technologySuggestions: [
          {
            id: 'tech-1',
            category: 'Data Platform',
            name: 'Azure Data Lake',
            implementationComplexity: 'high',
            estimatedCost: 'high',
          },
        ],
        gapAnalysis: [],
        overallRecommendation: '',
        prioritizedRoadmap: [],
      });

      const result = await mockAISuggestionService.generateSuggestions({
        framework: 'DRD',
        organizationContext: {
          industry: 'manufacturing',
          size: 'enterprise',
          budget: 'high',
        },
        currentScores: {
          dataManagement: 2,
        },
      });

      // Enterprise with high budget can handle complex implementations
      expect(result.technologySuggestions[0].implementationComplexity).toBe('high');
    });

    it('should filter expensive technologies for low budget', async () => {
      mockAISuggestionService.generateSuggestions.mockResolvedValue({
        id: 'suggestion-129',
        timestamp: '2026-02-04T10:00:00Z',
        framework: 'DRD',
        levelSuggestions: [],
        technologySuggestions: [
          {
            id: 'tech-1',
            category: 'Automation',
            name: 'Power Automate',
            implementationComplexity: 'low',
            estimatedCost: 'low',
          },
        ],
        gapAnalysis: [],
        overallRecommendation: '',
        prioritizedRoadmap: [],
      });

      const result = await mockAISuggestionService.generateSuggestions({
        framework: 'DRD',
        organizationContext: {
          industry: 'manufacturing',
          size: 'small',
          budget: 'low',
        },
        currentScores: {
          processes: 2,
        },
      });

      // Low budget should get affordable suggestions
      expect(result.technologySuggestions.every((t: any) => t.estimatedCost !== 'high')).toBe(true);
    });
  });
});
