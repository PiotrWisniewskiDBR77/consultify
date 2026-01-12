/**
 * Analytics Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Full TypeScript migration of analytics.js
 * API endpoints for analytics and leadership dashboard
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet } from '../utils/DbPromise.js';

const router = Router();

// Apply auth middleware to all routes
router.use(verifyToken);

// ==========================================
// LEADERSHIP DASHBOARD ANALYTICS
// ==========================================

/**
 * GET /api/analytics/health
 * Get initiative health metrics
 */
router.get(
    '/health',
    asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(400).json({ error: 'Organization ID required' });
            return;
        }

        const sql = `
            SELECT 
                status,
                COUNT(*) as count,
                SUM(cost_capex + cost_opex) as total_investment,
                SUM(expected_roi) as total_roi
            FROM initiatives 
            WHERE organization_id = ?
            GROUP BY status
        `;

        const rows = await dbAll(sql, [orgId]);

        // Also get Tasks overdue count
        const taskSql = `
            SELECT COUNT(*) as overdue_count 
            FROM tasks 
            WHERE organization_id = ? 
            AND status != 'done' 
            AND due_date < DATE('now')
        `;

        const taskRow = await dbGet<{ overdue_count: number }>(taskSql, [orgId]);

        res.json({
            initiativesByStatus: rows,
            overdueTasks: taskRow ? taskRow.overdue_count : 0,
        });
    }),
);

/**
 * GET /api/analytics/performance
 * Get people & performance metrics
 */
router.get(
    '/performance',
    asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(400).json({ error: 'Organization ID required' });
            return;
        }

        const sql = `
            SELECT 
                u.id, u.first_name, u.last_name, u.avatar_url,
                COUNT(t.id) as total_tasks,
                SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as completed_tasks,
                SUM(CASE WHEN t.due_date < DATE('now') AND t.status != 'done' THEN 1 ELSE 0 END) as overdue_tasks
            FROM users u
            LEFT JOIN tasks t ON u.id = t.assignee_id
            WHERE u.organization_id = ?
            GROUP BY u.id
        `;

        const rows = await dbAll(sql, [orgId]);

        res.json(rows);
    }),
);

/**
 * GET /api/analytics/economics
 * Get economic impact metrics
 */
router.get(
    '/economics',
    asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(400).json({ error: 'Organization ID required' });
            return;
        }

        const sql = `
            SELECT 
                SUM(cost_capex) as total_capex,
                SUM(cost_opex) as total_opex,
                SUM(expected_roi) as expected_benefit,
                SUM(cost_capex + cost_opex) as total_cost
            FROM initiatives 
            WHERE organization_id = ?
        `;

        const row = await dbGet<{
            total_capex: number;
            total_opex: number;
            expected_benefit: number;
            total_cost: number;
        }>(sql, [orgId]);

        // Also get actual spend from Tasks
        const spendSql = `
            SELECT SUM(budget_spent) as actual_spend
            FROM tasks
            WHERE organization_id = ?
        `;

        const spendRow = await dbGet<{ actual_spend: number }>(spendSql, [orgId]);

        res.json({
            ...row,
            actualSpend: spendRow ? spendRow.actual_spend : 0,
        });
    }),
);

export default router;
