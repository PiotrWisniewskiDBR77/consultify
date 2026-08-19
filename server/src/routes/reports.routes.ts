/**
 * Reports Routes
 * API endpoints for report generation and retrieval
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { computeCanonicalExecutionHealth } from '../services/execution/canonicalExecutionHealthService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();

function isSchemaMissingError(error: unknown): boolean {
  const msg = String((error as any)?.message || '').toLowerCase();
  return (
    msg.includes('no such table') ||
    msg.includes('does not exist') ||
    msg.includes('relation') ||
    msg.includes('no such column')
  );
}

/**
 * GET /api/reports/executive-overview
 * Get executive overview report
 */
router.get(
  '/executive-overview',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const summary = await dbGet<{
        totalProjects: number;
        activeProjects: number;
        completedProjects: number;
        totalUsers: number;
        totalTasks: number;
        completedTasks: number;
        avgProjectProgress: number;
        onTrackProjects: number;
      }>(
        `SELECT
            (SELECT COUNT(*) FROM projects WHERE organization_id = ?) as "totalProjects",
            (SELECT COUNT(*) FROM projects WHERE organization_id = ? AND COALESCE(status, '') NOT IN ('completed', 'COMPLETED', 'done', 'DONE', 'cancelled', 'CANCELLED')) as "activeProjects",
            (SELECT COUNT(*) FROM projects WHERE organization_id = ? AND COALESCE(status, '') IN ('completed', 'COMPLETED', 'done', 'DONE')) as "completedProjects",
            (SELECT COUNT(*) FROM users WHERE organization_id = ?) as "totalUsers",
            (SELECT COUNT(*) FROM tasks WHERE organization_id = ?) as "totalTasks",
            (SELECT COUNT(*) FROM tasks WHERE organization_id = ? AND COALESCE(status, '') IN ('completed', 'COMPLETED', 'done', 'DONE')) as "completedTasks",
            (SELECT COALESCE(AVG(COALESCE(progress, 0)), 0) FROM projects WHERE organization_id = ?) as "avgProjectProgress",
            (SELECT COUNT(*) FROM projects WHERE organization_id = ? AND COALESCE(progress, 0) >= 80) as "onTrackProjects"`,
        [orgId, orgId, orgId, orgId, orgId, orgId, orgId, orgId]
      );
      const totalProjects = Number(summary?.totalProjects || 0);
      const totalTasks = Number(summary?.totalTasks || 0);
      const avgProjectProgress = Math.round(Number(summary?.avgProjectProgress || 0));
      const onTrackPercentage =
        totalProjects > 0
          ? Math.round((Number(summary?.onTrackProjects || 0) / totalProjects) * 100)
          : 0;
      const taskCompletionRate =
        totalTasks > 0 ? Math.round((Number(summary?.completedTasks || 0) / totalTasks) * 100) : 0;
      const executionHealth = computeCanonicalExecutionHealth({
        progressPct: avgProjectProgress,
        taskCompletionPct: taskCompletionRate,
      });
      const healthScore = executionHealth.score ?? 0;
      const riskLevel = executionHealth.rag === 'GREEN'
        ? 'low'
        : executionHealth.rag === 'AMBER'
          ? 'medium'
          : 'high';

      return res.json({
        success: true,
        data: {
          organizationId: orgId,
          summary: {
            totalProjects,
            totalUsers: Number(summary?.totalUsers || 0),
            activeProjects: Number(summary?.activeProjects || 0),
            completedProjects: Number(summary?.completedProjects || 0),
          },
          metrics: {
            healthScore,
            riskLevel,
            healthFormulaVersion: executionHealth.formulaVersion,
            onTrackPercentage,
          },
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      logger.error('[Reports] Error generating executive overview:', error);
      if (isSchemaMissingError(error)) {
        return res.status(503).json({ error: 'Reports overview unavailable: storage not ready' });
      }
      return res.status(500).json({ error: 'Failed to generate executive overview' });
    }
  })
);

/**
 * GET /api/reports/org-overview
 * Get organization overview report
 */
router.get(
  '/org-overview',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const org = await dbGet<any>(`SELECT * FROM organizations WHERE id = ?`, [orgId]);
      const stats = await dbGet<{
        memberCount: number;
        projectCount: number;
        taskCompletionRate: number;
      }>(
        `SELECT
            (SELECT COUNT(*) FROM users WHERE organization_id = ?) as "memberCount",
            (SELECT COUNT(*) FROM projects WHERE organization_id = ?) as "projectCount",
            CASE
              WHEN (SELECT COUNT(*) FROM tasks WHERE organization_id = ?) = 0 THEN 0
              ELSE ROUND(
                (
                  (SELECT COUNT(*) FROM tasks WHERE organization_id = ? AND COALESCE(status, '') IN ('completed', 'COMPLETED', 'done', 'DONE')) * 100.0
                ) / NULLIF((SELECT COUNT(*) FROM tasks WHERE organization_id = ?), 0)
              )
            END as "taskCompletionRate"`,
        [orgId, orgId, orgId, orgId, orgId]
      );

      return res.json({
        success: true,
        data: {
          organization: org || { id: orgId, name: 'Unknown' },
          statistics: {
            memberCount: Number(stats?.memberCount || 0),
            projectCount: Number(stats?.projectCount || 0),
            taskCompletionRate: Number(stats?.taskCompletionRate || 0),
          },
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      logger.error('[Reports] Error generating org overview:', error);
      if (isSchemaMissingError(error)) {
        return res
          .status(503)
          .json({ error: 'Organization overview unavailable: storage not ready' });
      }
      return res.status(500).json({ error: 'Failed to generate organization overview' });
    }
  })
);

/**
 * GET /api/reports/project/:projectId
 * Get project-specific report
 */
router.get(
  '/project/:projectId',
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

      const taskMetrics = await dbGet<{
        tasksCompleted: number;
        tasksTotal: number;
        openTasks: number;
      }>(
        `SELECT
            COUNT(*) as "tasksTotal",
            SUM(CASE WHEN COALESCE(status, '') IN ('completed', 'COMPLETED', 'done', 'DONE') THEN 1 ELSE 0 END) as "tasksCompleted",
            SUM(CASE WHEN COALESCE(status, '') NOT IN ('completed', 'COMPLETED', 'done', 'DONE', 'cancelled', 'CANCELLED') THEN 1 ELSE 0 END) as "openTasks"
         FROM tasks
         WHERE project_id = ?`,
        [projectId]
      );

      return res.json({
        success: true,
        data: {
          project,
          metrics: {
            progress: Number(project.progress || 0),
            tasksCompleted: Number(taskMetrics?.tasksCompleted || 0),
            tasksTotal: Number(taskMetrics?.tasksTotal || 0),
            openTasks: Number(taskMetrics?.openTasks || 0),
          },
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      logger.error('[Reports] Error generating project report:', error);
      if (isSchemaMissingError(error)) {
        return res.status(503).json({ error: 'Project report unavailable: storage not ready' });
      }
      return res.status(500).json({ error: 'Failed to generate report' });
    }
  })
);

export default router;
