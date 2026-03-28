/**
 * Budget Routes
 * API endpoints for project budget management and initiative-level budget tracking.
 * Initiative-scoped endpoints use executionBudgetService (budget_entries, budget_items).
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import {
  createBudgetEntry,
  getBudgetEntries,
  getInitiativeBudgetSummary,
} from '../services/executionBudgetService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

function paramStr(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

// ─── Initiative-scoped budget (BudgetTrackingView, Execution Center) ───

router.get(
  '/initiative/:initiativeId',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const { initiativeId } = req.params;
    const summary = await getInitiativeBudgetSummary(orgId, paramStr(initiativeId));
    if (!summary) return res.status(404).json({ error: 'Initiative not found' });
    const entries = await getBudgetEntries(orgId, paramStr(initiativeId));
    const statusMap = { GREEN: 'ON_TRACK', AMBER: 'WARNING', RED: 'CRITICAL' } as const;
    const budget = {
      id: initiativeId,
      initiativeId: paramStr(initiativeId),
      initiativeName: summary.initiativeName,
      budgetType: 'COMBINED',
      plannedAmount: summary.planned.total,
      currency: summary.currency,
      lineItems: [],
      transactions: entries
        .filter((e) => e.entryType === 'ACTUAL')
        .map((e) => ({
          id: e.id,
          type: e.entryType,
          amount: e.amount,
          description: e.description || undefined,
          date: e.createdAt?.split('T')[0] || '',
          status: 'APPROVED',
        })),
      totals: {
        totalPlanned: summary.planned.total,
        totalApproved: summary.planned.total,
        totalActual: summary.actual.total,
        totalCommitted: 0,
        totalForecast: summary.forecast.total,
        remaining: Math.max(0, summary.planned.total - summary.actual.total),
        consumedPercent:
          summary.planned.total > 0
            ? Math.round((summary.actual.total / summary.planned.total) * 100)
            : 0,
        varianceAmount: summary.variance.total,
        variancePercent: summary.variance.percent,
        contingencyAmount: 0,
        isOverBudget: summary.forecast.isOverBudget,
        status: (statusMap[summary.status] || 'ON_TRACK') as
          | 'ON_TRACK'
          | 'WARNING'
          | 'CRITICAL'
          | 'OVERRUN',
      },
    };
    res.json({
      budget,
      burnRate: {
        monthlyBurnRate: summary.burnRate,
        averageMonthly: summary.burnRate,
        trend: 'STABLE' as const,
      },
      forecast: {
        estimateToComplete: Math.max(0, summary.planned.total - summary.actual.total),
        estimateAtCompletion: summary.forecast.total,
        varianceAtCompletion: summary.forecast.total - summary.planned.total,
        costPerformanceIndex:
          summary.planned.total > 0 ? summary.actual.total / summary.planned.total : 0,
        isProjectedOverrun: summary.forecast.isOverBudget,
        projectedOverrunPercent:
          summary.planned.total > 0
            ? Math.round(
                ((summary.forecast.total - summary.planned.total) / summary.planned.total) * 100
              )
            : 0,
        recommendation: summary.forecast.isOverBudget
          ? 'Review scope or secure additional budget.'
          : 'On track.',
      },
    });
  })
);

router.post(
  '/initiative/:initiativeId',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const { initiativeId } = req.params;
    const { plannedAmount, budgetType, contingencyPercent } = req.body || {};
    const amount = Number(plannedAmount) || 0;
    if (amount <= 0)
      return res.status(400).json({ error: 'plannedAmount required and must be > 0' });
    const costType = budgetType === 'CAPEX' ? 'CAPEX' : 'OPEX';
    const id = `ibi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await dbRun(
      `INSERT INTO initiative_budget_items (id, initiative_id, organization_id, category, cost_type, amount, currency, created_at, updated_at)
       VALUES (?, ?, ?, 'general', ?, ?, 'PLN', datetime('now'), datetime('now'))`,
      [id, initiativeId, orgId, costType, amount]
    );
    res.status(201).json({ success: true });
  })
);

router.post(
  '/:budgetId/transactions',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });
    const initiativeId = req.params.budgetId;
    const { amount, description, vendor, transactionType, transactionDate } = req.body || {};
    const amt = Number(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: 'amount required and must be > 0' });
    const txDate = transactionDate || new Date().toISOString().split('T')[0];
    const [year, month] = txDate.split('-').map(Number);
    await createBudgetEntry(orgId, {
      initiativeId: paramStr(initiativeId),
      entryType: 'ACTUAL',
      costType: 'OPEX',
      category: 'General',
      amount: amt,
      description: description || vendor || 'Expense',
      periodMonth: month,
      periodYear: year,
      createdBy: userId,
    });
    res.status(201).json({ success: true });
  })
);

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const { projectId } = req.query;
    let query = `SELECT id, project_id, category, planned_amount, actual_amount, currency, 
               period_start, period_end, created_at FROM budgets WHERE organization_id = ?`;
    const params: any[] = [orgId];
    if (projectId) {
      query += ' AND project_id = ?';
      params.push(projectId);
    }
    query += ' ORDER BY created_at DESC';
    const budgets = await dbAll(query, params);
    res.json(budgets || []);
  })
);

router.get(
  '/summary',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const summary = await dbGet(
      `
    SELECT SUM(planned_amount) as total_planned, SUM(actual_amount) as total_actual,
           COUNT(*) as budget_count
    FROM budgets WHERE organization_id = ?
  `,
      [orgId]
    );
    res.json(summary || { total_planned: 0, total_actual: 0, budget_count: 0 });
  })
);

router.post(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const { projectId, category, plannedAmount, currency, periodStart, periodEnd } = req.body;
    const id = uuidv4();
    await dbRun(
      `
    INSERT INTO budgets (id, organization_id, project_id, category, planned_amount, 
                         actual_amount, currency, period_start, period_end, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, datetime('now'))
  `,
      [
        id,
        orgId,
        projectId,
        category || 'general',
        plannedAmount || 0,
        currency || 'USD',
        periodStart,
        periodEnd,
      ]
    );
    logger.info(`[Budget] Created budget ${id}`);
    res.status(201).json({ success: true, id });
  })
);

router.put(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { plannedAmount, actualAmount, category } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    if (plannedAmount !== undefined) {
      updates.push('planned_amount = ?');
      params.push(plannedAmount);
    }
    if (actualAmount !== undefined) {
      updates.push('actual_amount = ?');
      params.push(actualAmount);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category);
    }
    if (!updates.length) return res.status(400).json({ error: 'No updates' });
    params.push(id);
    await dbRun(`UPDATE budgets SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true });
  })
);

router.delete(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await dbRun('DELETE FROM budgets WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  })
);

export default router;
