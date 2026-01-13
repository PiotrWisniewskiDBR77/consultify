/**
 * PMO Analysis Controller
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles project analysis, progress, and dependency visualization
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import PMOHealthService from '../services/pmoHealthService.js';
import logger from '../utils/Logger.js';

export class PMOAnalysisController {
  /**
   * Get full project analysis snapshot
   */
  static getProjectAnalysis = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { projectId } = req.params;
      const orgId = req.user?.organizationId;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      try {
        const snapshot = await PMOHealthService.getHealthSnapshot(projectId);
        res.json(snapshot);
      } catch (err: any) {
        logger.error('[PMOAnalysisController] Analysis error:', err);
        res.status(500).json({ error: err.message || 'Internal Server Error' });
      }
    }
  );

  /**
   * Get project progress analysis
   */
  static getProjectProgress = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { projectId } = req.params;
      const orgId = req.user?.organizationId;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      try {
        const snapshot = await PMOHealthService.getHealthSnapshot(projectId);
        res.json({
          projectId,
          projectName: snapshot.projectName,
          phase: snapshot.phase,
          tasks: snapshot.tasks,
          initiatives: snapshot.initiatives,
          updatedAt: snapshot.updatedAt,
        });
      } catch (err: any) {
        logger.error('[PMOAnalysisController] Progress analysis error:', err);
        res.status(500).json({ error: err.message || 'Internal Server Error' });
      }
    }
  );

  /**
   * Get project dependency graph
   */
  static getProjectDependencies = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { projectId } = req.params;
      const orgId = req.user?.organizationId;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Stub dependency graph for now as dependencyService is not fully migrated
      res.json({
        projectId,
        nodes: [],
        edges: [],
        message: 'Dependency graph visualization pending full migration',
      });
    }
  );
}

export default PMOAnalysisController;
