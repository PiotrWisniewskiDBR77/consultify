/**
 * Admin Data Controller
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles admin panel data endpoints
 */

import type { Response } from 'express';

import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import type { UpdateUserTierRequest } from '../validators/admin.validators.js';

// ==========================================
// CONTROLLER METHODS
// ==========================================

export class AdminDataController {
  /**
   * Get user tiers for organization
   */
  static getUserTiers = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { orgId } = req.params;

      const sql = `
            SELECT 
                u.id as "userId",
                u.first_name || ' ' || u.last_name as "userName",
                u.email,
                COALESCE(aus.tier, 'STANDARD') as "currentTier",
                COALESCE(aus.requests_count, 0) as usage,
                COALESCE(aus.cost_usd, 0) as cost
            FROM users u
            LEFT JOIN ai_usage_stats aus ON u.id = aus.user_id 
                AND aus.period_start >= date('now', '-7 days')
            WHERE u.organization_id = ?
            ORDER BY aus.cost_usd DESC NULLS LAST
        `;

      const users = await queryHelpers.queryAll(sql, [orgId]);
      res.json(users);
    }
  );

  /**
   * Update user tier
   */
  static updateUserTier = asyncHandler(
    async (req: AuthenticatedRequest<UpdateUserTierRequest>, res: Response): Promise<void> => {
      const { orgId, userId } = req.params;
      const { tier } = req.body;
      const { v4: uuidv4 } = await import('uuid');

      const sql = `
            INSERT INTO ai_usage_stats (id, organization_id, user_id, tier, period_start, period_end)
            VALUES (?, ?, ?, ?, date('now', '-7 days'), date('now'))
            ON CONFLICT(user_id, period_start) DO UPDATE SET tier = ?
        `;

      await queryHelpers.queryRun(sql, [uuidv4(), orgId, userId, tier, tier]);

      res.json({ success: true, tier });
    }
  );

  /**
   * Get cost attribution
   */
  static getCostAttribution = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { orgId } = req.params;

      // Get user cost attribution
      const userCosts = await queryHelpers.queryAll(
        `
            SELECT 
                'user' as "entityType",
                aus.user_id as "entityId",
                u.first_name || ' ' || u.last_name as "entityName",
                SUM(aus.requests_count) as requests,
                SUM(aus.tokens_used) as tokens,
                SUM(aus.cost_usd) as cost
            FROM ai_usage_stats aus
            JOIN users u ON aus.user_id = u.id
            WHERE aus.organization_id = ?
            GROUP BY aus.user_id
            ORDER BY cost DESC
        `,
        [orgId]
      );

      // Get project cost attribution
      const projectCosts = await queryHelpers.queryAll(
        `
            SELECT 
                'project' as "entityType",
                aus.project_id as "entityId",
                p.name as "entityName",
                SUM(aus.requests_count) as requests,
                SUM(aus.tokens_used) as tokens,
                SUM(aus.cost_usd) as cost
            FROM ai_usage_stats aus
            JOIN projects p ON aus.project_id = p.id
            WHERE aus.organization_id = ?
            GROUP BY aus.project_id
            ORDER BY cost DESC
        `,
        [orgId]
      );

      res.json({ users: userCosts, projects: projectCosts });
    }
  );

  /**
   * Get security events
   */
  static getSecurityEvents = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { orgId } = req.params;
      const limit = parseInt(String(req.query.limit || 50), 10);

      const sql = `
            SELECT * FROM security_events
            WHERE organization_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        `;

      const events = await queryHelpers.queryAll(sql, [orgId, limit]);
      res.json(events);
    }
  );

  /**
   * Get dashboard activity
   */
  static getDashboardActivity = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { orgId } = req.params;
      const limit = parseInt(String(req.query.limit || 50), 10);

      const sql = `
            SELECT * FROM activity_logs
            WHERE organization_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        `;

      const activities = await queryHelpers.queryAll(sql, [orgId, limit]);
      res.json(activities);
    }
  );
}

export default AdminDataController;
