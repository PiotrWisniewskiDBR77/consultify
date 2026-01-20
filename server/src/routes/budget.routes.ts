/**
 * budget Routes
 * Portfolio budget summary and management
 */
import { Router } from 'express';

import type { AuthRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import logger from '../utils/Logger.js';

const router = Router();

/**
 * GET /api/budget/portfolio/summary
 * Get portfolio budget summary for organization
 */
router.get(
  '/portfolio/summary',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get budget summary from initiatives
      const budgetStats = await queryHelpers.queryOne<{
        total_capex: number;
        total_opex: number;
        total_budget: number;
        avg_roi: number;
        initiative_count: number;
        budgeted_count: number;
      }>(
        `SELECT 
          COALESCE(SUM(cost_capex), 0) as total_capex,
          COALESCE(SUM(cost_opex), 0) as total_opex,
          COALESCE(SUM(COALESCE(cost_capex, 0) + COALESCE(cost_opex, 0)), 0) as total_budget,
          COALESCE(AVG(expected_roi), 0) as avg_roi,
          COUNT(*) as initiative_count,
          COUNT(CASE WHEN cost_capex > 0 OR cost_opex > 0 THEN 1 END) as budgeted_count
        FROM initiatives 
        WHERE organization_id = ?`,
        [orgId]
      );

      // Get actual spend from tasks
      const spendStats = await queryHelpers.queryOne<{
        actual_spend: number;
      }>(
        `SELECT COALESCE(SUM(budget_spent), 0) as actual_spend
         FROM tasks
         WHERE organization_id = ?`,
        [orgId]
      );

      const summary = {
        totalBudget: budgetStats?.total_budget || 0,
        totalCapex: budgetStats?.total_capex || 0,
        totalOpex: budgetStats?.total_opex || 0,
        actualSpend: spendStats?.actual_spend || 0,
        remainingBudget: (budgetStats?.total_budget || 0) - (spendStats?.actual_spend || 0),
        averageROI: budgetStats?.avg_roi || 0,
        initiativeCount: budgetStats?.initiative_count || 0,
        budgetedCount: budgetStats?.budgeted_count || 0,
        budgetCoverage: budgetStats?.initiative_count 
          ? Math.round(((budgetStats.budgeted_count || 0) / budgetStats.initiative_count) * 100)
          : 0,
      };

      res.json({ summary });
    } catch (error: any) {
      logger.error('[Budget] Portfolio summary error:', error);
      res.status(500).json({ error: 'Failed to fetch budget summary' });
    }
  })
);

export default router;
