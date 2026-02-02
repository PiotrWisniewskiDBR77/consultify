/**
 * ReportGenerationService - Unit Tests (L1)
 * Tests for report generation functionality
 *
 * Coverage target: 95%+
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock database
const mockDb = {
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
};

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: vi.fn().mockResolvedValue(mockDb),
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('test-report-uuid'),
}));

// Mock logger
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// ReportGenerationService exports individual functions
import { generateReport } from '../../../server/src/services/reportGenerationService';

describe('ReportGenerationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateReport', () => {
    it('should generate assessment report successfully', async () => {
      const mockAssessment = {
        id: 'assessment-1',
        name: 'Test Assessment',
        framework: 'DRD',
        overall_score: 75,
        maturity_level: 3,
        completed_at: '2026-01-26T10:00:00Z',
      };

      const mockDimensionScores = [
        { dimension_id: 'dim-1', dimension_name: 'Data Management', score: 80, max_score: 100 },
        { dimension_id: 'dim-2', dimension_name: 'Process Automation', score: 70, max_score: 100 },
      ];

      mockDb.get.mockResolvedValue(mockAssessment);
      mockDb.all.mockResolvedValue(mockDimensionScores);
      mockDb.run.mockResolvedValue({ lastID: 1, changes: 1 });

      const result = await generateReport(
        {
          reportType: 'assessment',
          sourceId: 'assessment-1',
          language: 'en',
        },
        'org-1'
      );

      expect(result).toBeDefined();
      expect(result.type).toBe('assessment');
      expect(mockDb.get).toHaveBeenCalled();
      expect(mockDb.all).toHaveBeenCalled();
    });

    it('should throw error if assessment not found', async () => {
      mockDb.get.mockResolvedValue(null);

      await expect(
        generateReport(
          {
            reportType: 'assessment',
            sourceId: 'non-existent',
            language: 'en',
          },
          'org-1'
        )
      ).rejects.toThrow();
    });

    it('should handle missing dimension scores gracefully', async () => {
      const mockAssessment = {
        id: 'assessment-1',
        name: 'Test Assessment',
        framework: 'DRD',
        overall_score: 75,
        maturity_level: 3,
        completed_at: '2026-01-26T10:00:00Z',
      };

      mockDb.get.mockResolvedValue(mockAssessment);
      mockDb.all.mockResolvedValue([]); // No dimension scores
      mockDb.run.mockResolvedValue({ lastID: 1, changes: 1 });

      const result = await generateReport(
        {
          reportType: 'assessment',
          sourceId: 'assessment-1',
          language: 'en',
        },
        'org-1'
      );

      expect(result).toBeDefined();
      expect(result.type).toBe('assessment');
    });
  });

  describe('generateAssessmentReport (private)', () => {
    it('should create report with correct structure', async () => {
      const mockAssessment = {
        id: 'assessment-1',
        name: 'Test Assessment',
        framework: 'DRD',
        overall_score: 75,
        maturity_level: 3,
        completed_at: '2026-01-26T10:00:00Z',
      };

      mockDb.get.mockResolvedValue(mockAssessment);
      mockDb.all.mockResolvedValue([]);
      mockDb.run.mockResolvedValue({ lastID: 1, changes: 1 });

      const result = await generateReport(
        {
          reportType: 'assessment',
          sourceId: 'assessment-1',
          language: 'en',
        },
        'org-1'
      );

      expect(result.id).toContain('report-');
      expect(result.title).toContain('DRD');
      expect(result.title).toContain('Test Assessment');
    });

    it('should map maturity levels correctly', async () => {
      const maturityLevels = [1, 2, 3, 4, 5];
      const expectedLabels = ['Initial', 'Developing', 'Defined', 'Managed', 'Optimizing'];

      for (let i = 0; i < maturityLevels.length; i++) {
        const mockAssessment = {
          id: `assessment-${i}`,
          name: 'Test',
          framework: 'DRD',
          overall_score: 50,
          maturity_level: maturityLevels[i],
          completed_at: '2026-01-26T10:00:00Z',
        };

        mockDb.get.mockResolvedValue(mockAssessment);
        mockDb.all.mockResolvedValue([]);
        mockDb.run.mockResolvedValue({ lastID: 1, changes: 1 });

        const result = await generateReport({
          reportType: 'assessment',
          sourceId: `assessment-${i}`,
          language: 'en',
          organizationId: 'org-1',
        });

        expect(result.content).toContain(expectedLabels[i]);
      }
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDb.get.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        generateReport({
          reportType: 'assessment',
          sourceId: 'assessment-1',
          language: 'en',
          organizationId: 'org-1',
        })
      ).rejects.toThrow();
    });

    it('should validate required parameters', async () => {
      await expect(
        generateReport({
          reportType: 'assessment' as any,
          sourceId: '',
          language: 'en',
          organizationId: 'org-1',
        })
      ).rejects.toThrow();
    });
  });
});
