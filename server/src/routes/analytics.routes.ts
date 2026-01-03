/**
 * Analytics Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Full TypeScript migration of analytics.js
 * API endpoints for analytics and leadership dashboard
 */

import { Router, Response } from 'express';
import { verifyToken, type AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';

const router = Router();
const db = getDatabase();

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

        const rows = await new Promise<unknown[]>((resolve, reject) => {
            db.all(sql, [orgId], (err: Error | null, result: unknown[]) => {
                if (err) return reject(err);
                resolve(result || []);
            });
        });

        // Also get Tasks overdue count
        const taskSql = `
            SELECT COUNT(*) as overdue_count 
            FROM tasks 
            WHERE organization_id = ? 
            AND status != 'done' 
            AND due_date < DATE('now')
        `;

        const taskRow = await new Promise<{ overdue_count: number } | null>((resolve, reject) => {
            db.get(taskSql, [orgId], (err: Error | null, row: { overdue_count: number } | null) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        res.json({
            initiativesByStatus: rows,
            overdueTasks: taskRow ? taskRow.overdue_count : 0
        });
    })
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

        const rows = await new Promise<unknown[]>((resolve, reject) => {
            db.all(sql, [orgId], (err: Error | null, result: unknown[]) => {
                if (err) return reject(err);
                resolve(result || []);
            });
        });

        res.json(rows);
    })
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

        const row = await new Promise<{
            total_capex: number;
            total_opex: number;
            expected_benefit: number;
            total_cost: number;
        } | null>((resolve, reject) => {
            db.get(sql, [orgId], (err: Error | null, result: unknown) => {
                if (err) return reject(err);
                resolve(result as typeof row);
            });
        });

        // Also get actual spend from Tasks
        const spendSql = `
            SELECT SUM(budget_spent) as actual_spend
            FROM tasks
            WHERE organization_id = ?
        `;

        const spendRow = await new Promise<{ actual_spend: number } | null>((resolve, reject) => {
            db.get(spendSql, [orgId], (err: Error | null, result: unknown) => {
                if (err) return reject(err);
                resolve(result as typeof spendRow);
            });
        });

        res.json({
            ...row,
            actualSpend: spendRow ? spendRow.actual_spend : 0
        });
    })
);

export default router;
