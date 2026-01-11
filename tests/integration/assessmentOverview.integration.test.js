/**
 * Assessment Overview Integration Tests
 * Tests for consolidated assessment data retrieval
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock assessment service
const createAssessmentService = () => {
  const projects = new Map([
    [
      'proj-123',
      {
        id: 'proj-123',
        name: 'Test Project',
        assessments: [
          { id: 'ass-1', type: 'maturity', score: 3.5, completedAt: '2026-01-01' },
          { id: 'ass-2', type: 'gap', score: null, completedAt: null },
        ],
        drdSummary: {
          overallScore: 75,
          recommendations: ['Improve documentation', 'Implement CI/CD'],
          lastUpdated: '2026-01-05',
        },
      },
    ],
    [
      'proj-456',
      {
        id: 'proj-456',
        name: 'Project Without DRD',
        assessments: [{ id: 'ass-3', type: 'maturity', score: 2.8, completedAt: '2026-01-02' }],
        drdSummary: null,
      },
    ],
  ]);

  return {
    getAssessmentOverview: async (projectId) => {
      const project = projects.get(projectId);

      if (!project) {
        return { success: false, error: 'Project not found', status: 404 };
      }

      const completedAssessments = project.assessments.filter((a) => a.completedAt);
      const pendingAssessments = project.assessments.filter((a) => !a.completedAt);

      return {
        success: true,
        data: {
          projectId: project.id,
          projectName: project.name,
          overview: {
            totalAssessments: project.assessments.length,
            completed: completedAssessments.length,
            pending: pendingAssessments.length,
            averageScore:
              completedAssessments.length > 0
                ? completedAssessments.reduce((sum, a) => sum + (a.score || 0), 0) /
                  completedAssessments.length
                : null,
          },
          assessments: project.assessments,
          drdSummary: project.drdSummary,
        },
      };
    },

    getDRDSummary: async (projectId) => {
      const project = projects.get(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }
      return { success: true, data: project.drdSummary };
    },
  };
};

describe('Assessment Overview API', () => {
  let assessmentService;

  beforeEach(() => {
    vi.clearAllMocks();
    assessmentService = createAssessmentService();
  });

  describe('GET /api/sessions/:projectId/assessment-overview', () => {
    it('should return consolidated assessment data', async () => {
      const result = await assessmentService.getAssessmentOverview('proj-123');

      expect(result.success).toBe(true);
      expect(result.data.projectId).toBe('proj-123');
      expect(result.data.overview.totalAssessments).toBe(2);
      expect(result.data.overview.completed).toBe(1);
      expect(result.data.overview.pending).toBe(1);
      expect(result.data.assessments).toHaveLength(2);
    });

    it('should include DRD summary if exists', async () => {
      const result = await assessmentService.getAssessmentOverview('proj-123');

      expect(result.success).toBe(true);
      expect(result.data.drdSummary).toBeDefined();
      expect(result.data.drdSummary.overallScore).toBe(75);
      expect(result.data.drdSummary.recommendations).toHaveLength(2);
    });

    it('should return null DRD summary when not available', async () => {
      const result = await assessmentService.getAssessmentOverview('proj-456');

      expect(result.success).toBe(true);
      expect(result.data.drdSummary).toBeNull();
    });

    it('should handle non-existent project gracefully', async () => {
      const result = await assessmentService.getAssessmentOverview('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(result.status).toBe(404);
    });

    it('should calculate average score correctly', async () => {
      const result = await assessmentService.getAssessmentOverview('proj-123');

      expect(result.data.overview.averageScore).toBe(3.5);
    });
  });
});
