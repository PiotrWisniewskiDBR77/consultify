/**
 * PMO Context Routes
 * API endpoints for project PMO context retrieval
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { get as dbGet, all as dbAll } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();

/**
 * GET /api/pmo-context/:projectId
 * Get full PMO context for a project
 */
router.get(
  '/:projectId',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params;
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      // Check if project exists and belongs to org
      const project = await dbGet<any>(
        `SELECT * FROM projects WHERE id = ? AND organization_id = ?`,
        [projectId, orgId]
      );

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Get current phase info
      const currentPhase = project.current_phase || 'Execution';
      const phaseMap: Record<string, number> = {
        Initiation: 1,
        Planning: 2,
        Design: 3,
        Development: 4,
        Execution: 5,
        Closure: 6,
      };
      const phaseNumber = phaseMap[currentPhase] || 5;

      // Allowed actions based on phase
      const allowedActions = ['create_task', 'update_task', 'complete_task', 'view_reports'];
      if (phaseNumber >= 5) {
        allowedActions.push('request_gate_review');
      }

      // System messages
      const systemMessages = [
        `Project is in ${currentPhase} phase`,
        'All team members have access',
      ];

      // Blocking issues
      const blockingIssues: string[] = [];

      return res.json({
        projectId,
        currentPhase,
        phaseNumber,
        totalPhases: 6,
        allowedActions,
        systemMessages,
        blockingIssues,
        generatedAt: new Date().toISOString(),
        standardsCompliance: {
          iso21500: true,
          pmbok7: true,
          prince2: true,
        },
      });
    } catch (error: any) {
      logger.error('[PMO Context] Error fetching context:', error);
      return res.status(500).json({ error: 'Failed to fetch PMO context' });
    }
  })
);

/**
 * GET /api/pmo-context/:projectId/summary
 * Get summarized PMO context
 */
router.get(
  '/:projectId/summary',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params;
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const project = await dbGet<any>(
        `SELECT * FROM projects WHERE id = ? AND organization_id = ?`,
        [projectId, orgId]
      );

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      return res.json({
        success: true,
        data: {
          projectId,
          name: project.name,
          status: project.status,
          currentPhase: project.current_phase || 'initiation',
          healthScore: 85,
          riskLevel: 'low',
        },
      });
    } catch (error: any) {
      logger.error('[PMO Context] Error fetching summary:', error);
      return res.status(500).json({ error: 'Failed to fetch summary' });
    }
  })
);

/**
 * GET /api/pmo-context/:projectId/task-labels
 * Get task labels with PMO relevance scoring
 */
router.get(
  '/:projectId/task-labels',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params;
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const project = await dbGet<any>(
        `SELECT * FROM projects WHERE id = ? AND organization_id = ?`,
        [projectId, orgId]
      );

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Get custom labels for tasks
      const customLabels = await dbAll<any>(
        `SELECT DISTINCT label FROM task_labels WHERE project_id = ?`,
        [projectId]
      );

      const taskLabels = [
        { id: 'critical-path', name: 'Critical Path', pmoRelevance: 0.95, color: '#FF4444' },
        { id: 'milestone', name: 'Milestone', pmoRelevance: 0.9, color: '#44FF44' },
        { id: 'deliverable', name: 'Deliverable', pmoRelevance: 0.85, color: '#4444FF' },
        { id: 'risk-item', name: 'Risk Item', pmoRelevance: 0.8, color: '#FFAA00' },
        { id: 'dependency', name: 'Dependency', pmoRelevance: 0.75, color: '#AA00FF' },
        ...(customLabels || []).map((l: any, i: number) => ({
          id: `custom-${i}`,
          name: l.label,
          pmoRelevance: 0.5,
          color: '#888888',
        })),
      ];

      return res.json({
        success: true,
        taskLabels,
        projectId,
      });
    } catch (error: any) {
      logger.error('[PMO Context] Error fetching task labels:', error);
      return res.status(500).json({ error: 'Failed to fetch task labels' });
    }
  })
);

export default router;
