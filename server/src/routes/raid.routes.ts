/**
 * RAID Routes
 * Risks, Assumptions, Issues, Dependencies management
 */
import { Router } from 'express';

import type { AuthRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import logger from '../utils/Logger.js';

const router = Router();

/**
 * GET /api/raid/summary
 * Get RAID summary for organization
 */
router.get(
  '/summary',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get RAID summary statistics
      const raidStats = await queryHelpers.queryOne<{
        open_count: number;
        high_priority_count: number;
        overdue_count: number;
        risks_count: number;
        issues_count: number;
        assumptions_count: number;
        dependencies_count: number;
      }>(
        `SELECT 
          COUNT(CASE WHEN status = 'OPEN' THEN 1 END) as open_count,
          COUNT(CASE WHEN (impact = 'HIGH' OR impact = 'CRITICAL') AND status = 'OPEN' THEN 1 END) as high_priority_count,
          COUNT(CASE WHEN status = 'OPEN' AND due_date IS NOT NULL AND due_date < CURRENT_TIMESTAMP THEN 1 END) as overdue_count,
          COUNT(CASE WHEN type = 'RISK' THEN 1 END) as risks_count,
          COUNT(CASE WHEN type = 'ISSUE' THEN 1 END) as issues_count,
          COUNT(CASE WHEN type = 'ASSUMPTION' THEN 1 END) as assumptions_count,
          COUNT(CASE WHEN type = 'DEPENDENCY' THEN 1 END) as dependencies_count
        FROM raid_items 
        WHERE organization_id = ?`,
        [orgId]
      );

      const summary = {
        openCount: raidStats?.open_count || 0,
        highPriorityCount: raidStats?.high_priority_count || 0,
        overdueCount: raidStats?.overdue_count || 0,
        risksCount: raidStats?.risks_count || 0,
        issuesCount: raidStats?.issues_count || 0,
        assumptionsCount: raidStats?.assumptions_count || 0,
        dependenciesCount: raidStats?.dependencies_count || 0,
      };

      res.json(summary);
    } catch (error: any) {
      logger.error('[RAID] Summary error:', error);
      // Return default values if table doesn't exist yet
      res.json({
        openCount: 0,
        highPriorityCount: 0,
        overdueCount: 0,
        risksCount: 0,
        issuesCount: 0,
        assumptionsCount: 0,
        dependenciesCount: 0,
      });
    }
  })
);

export default router;
