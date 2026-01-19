/**
 * Roadmap Controller
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles project roadmap waves and summary
 */

import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

export class RoadmapController {
  /**
   * Get roadmap waves for a project
   */
  static getWaves = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { projectId } = req.params;
      const orgId = req.user?.organizationId;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const sql = `SELECT * FROM roadmap_waves WHERE project_id = ? AND organization_id = ? ORDER BY sequence_order ASC`;
      const waves = await queryHelpers.queryAll(sql, [projectId, orgId]);

      res.json(waves);
    }
  );

  /**
   * Create a new roadmap wave
   */
  static createWave = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { projectId } = req.params;
      const { name, description, startDate, endDate, sequenceOrder } = req.body;
      const orgId = req.user?.organizationId;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const id = uuidv4();
      const sql = `
            INSERT INTO roadmap_waves (id, organization_id, project_id, name, description, start_date, end_date, sequence_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

      await queryHelpers.queryRun(sql, [
        id,
        orgId,
        projectId,
        name,
        description || null,
        startDate || null,
        endDate || null,
        sequenceOrder || 0,
      ]);

      res.status(201).json({ id, name, message: 'Wave created' });
    }
  );

  /**
   * Get roadmap summary
   */
  static getSummary = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { projectId } = req.params;
      const orgId = req.user?.organizationId;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Basic summary logic
      const [wavesCount, totalInitiatives] = await Promise.all([
        queryHelpers.queryOne<{ count: number }>(
          `SELECT COUNT(*) as count FROM roadmap_waves WHERE project_id = ?`,
          [projectId]
        ),
        queryHelpers.queryOne<{ count: number }>(
          `SELECT COUNT(*) as count FROM initiatives WHERE project_id = ?`,
          [projectId]
        ),
      ]);

      res.json({
        projectId,
        waveCount: wavesCount?.count || 0,
        initiativeCount: totalInitiatives?.count || 0,
        updatedAt: new Date().toISOString(),
      });
    }
  );
}

export default RoadmapController;
