/**
 * Budget Routes - Initiative Budget Management
 * 
 * PMO Standards Compliance:
 * - ISO 21500:2021 - Cost Management (Clause 4.4.4)
 * - PMI PMBOK 7th Edition - Cost Performance Domain
 * - PRINCE2 - Business Case / Cost Management
 * 
 * PMO Domain: RESOURCE_RESPONSIBILITY, PERFORMANCE_MONITORING
 */

import express from 'express';
const router = express.Router();
import * as BudgetServiceModule from '../services/budgetService.js';
const BudgetService = BudgetServiceModule.default || BudgetServiceModule;
import verifyToken from '../middleware/authMiddleware.js';
import { asyncHandler  } from '../dist/utils/asyncHandler.js';
import * as queryHelpers from '../utils/queryHelpers.js';

router.use(verifyToken);

// ==========================================
// GET BUDGET FOR INITIATIVE
// ==========================================
router.get('/initiative/:initiativeId', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { initiativeId } = req.params;

    const budget = await BudgetService.getBudget(initiativeId, orgId);

    if (!budget) {
        return res.json({ 
            budget: null, 
            message: 'No budget configured for this initiative' 
        });
    }

    res.json({ budget });
}));

// ==========================================
// CREATE BUDGET FOR INITIATIVE
// ==========================================
router.post('/initiative/:initiativeId', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const userId = req.user.id;
    const { initiativeId } = req.params;
    const budgetData = req.body;

    // Check if budget already exists
    const existing = await BudgetService.getBudget(initiativeId, orgId);
    if (existing) {
        return res.status(400).json({ 
            error: 'Budget already exists for this initiative',
            budgetId: existing.id
        });
    }

    const budget = await BudgetService.createBudget(orgId, initiativeId, budgetData, userId);

    res.status(201).json({ 
        success: true,
        budget,
        message: 'Budget created successfully'
    });
}));

// ==========================================
// UPDATE BUDGET
// ==========================================
router.put('/:budgetId', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { budgetId } = req.params;
    const updates = req.body;

    const allowedFields = [
        'planned_amount', 'approved_amount', 'contingency_percent',
        'notes', 'status', 'fiscal_year'
    ];

    const setClauses = [];
    const params = [];

    for (const [key, value] of Object.entries(updates)) {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (allowedFields.includes(snakeKey)) {
            setClauses.push(`${snakeKey} = ?`);
            params.push(value);
        }
    }

    if (setClauses.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Recalculate contingency if planned amount changed
    if (updates.plannedAmount && updates.contingencyPercent) {
        setClauses.push('contingency_amount = ?');
        params.push(updates.plannedAmount * (updates.contingencyPercent / 100));
    }

    setClauses.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(budgetId);
    params.push(orgId);

    const { getDatabase } = await import('../src/database/Database.js');

    await new Promise((resolve, reject) => {
        db.run(
            `UPDATE initiative_budgets SET ${setClauses.join(', ')} 
             WHERE id = ? AND organization_id = ?`,
            params,
            (err) => err ? reject(err) : resolve()
        );
    });

    res.json({ success: true, message: 'Budget updated' });
}));

// ==========================================
// ADD LINE ITEM
// ==========================================
router.post('/:budgetId/line-items', asyncHandler(async (req, res) => {
    const { budgetId } = req.params;
    const itemData = req.body;

    if (!itemData.category) {
        return res.status(400).json({ error: 'Category is required' });
    }

    const lineItem = await BudgetService.addLineItem(budgetId, itemData);

    res.status(201).json({ 
        success: true,
        lineItem,
        message: 'Line item added'
    });
}));

// ==========================================
// UPDATE LINE ITEM
// ==========================================
router.put('/:budgetId/line-items/:itemId', asyncHandler(async (req, res) => {
    const { budgetId, itemId } = req.params;
    const updates = req.body;

    const allowedFields = [
        'category', 'subcategory', 'description', 'budget_type',
        'planned_amount', 'actual_amount', 'committed_amount', 
        'forecast_amount', 'sort_order'
    ];

    const setClauses = [];
    const params = [];

    for (const [key, value] of Object.entries(updates)) {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (allowedFields.includes(snakeKey)) {
            setClauses.push(`${snakeKey} = ?`);
            params.push(value);
        }
    }

    if (setClauses.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
    }

    setClauses.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(itemId);
    params.push(budgetId);

    const { getDatabase } = await import('../src/database/Database.js');

    await new Promise((resolve, reject) => {
        db.run(
            `UPDATE budget_line_items SET ${setClauses.join(', ')} 
             WHERE id = ? AND budget_id = ?`,
            params,
            (err) => err ? reject(err) : resolve()
        );
    });

    res.json({ success: true, message: 'Line item updated' });
}));

// ==========================================
// DELETE LINE ITEM
// ==========================================
router.delete('/:budgetId/line-items/:itemId', asyncHandler(async (req, res) => {
    const { budgetId, itemId } = req.params;

    const { getDatabase } = await import('../src/database/Database.js');

    await new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM budget_line_items WHERE id = ? AND budget_id = ?`,
            [itemId, budgetId],
            (err) => err ? reject(err) : resolve()
        );
    });

    res.json({ success: true, message: 'Line item deleted' });
}));

// ==========================================
// ADD TRANSACTION
// ==========================================
router.post('/:budgetId/transactions', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { budgetId } = req.params;
    const transactionData = req.body;

    if (!transactionData.amount) {
        return res.status(400).json({ error: 'Amount is required' });
    }

    const transaction = await BudgetService.addTransaction(budgetId, transactionData, userId);

    res.status(201).json({ 
        success: true,
        transaction,
        message: 'Transaction recorded'
    });
}));

// ==========================================
// GET TRANSACTIONS
// ==========================================
router.get('/:budgetId/transactions', asyncHandler(async (req, res) => {
    const { budgetId } = req.params;
    const { limit = 50, offset = 0, type, startDate, endDate } = req.query;

    let sql = `
        SELECT t.*, u.first_name, u.last_name
        FROM budget_transactions t
        LEFT JOIN users u ON t.created_by = u.id
        WHERE t.budget_id = ?
    `;
    const params = [budgetId];

    if (type) {
        sql += ` AND t.transaction_type = ?`;
        params.push(type);
    }

    if (startDate) {
        sql += ` AND t.transaction_date >= ?`;
        params.push(startDate);
    }

    if (endDate) {
        sql += ` AND t.transaction_date <= ?`;
        params.push(endDate);
    }

    sql += ` ORDER BY t.transaction_date DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));


    const transactions = await queryHelpers.queryAll(sql, params);

    res.json({ 
        transactions: transactions.map(t => ({
            id: t.id,
            type: t.transaction_type,
            amount: t.amount,
            description: t.description,
            vendor: t.vendor,
            invoiceNumber: t.invoice_number,
            date: t.transaction_date,
            status: t.status,
            costCenter: t.cost_center,
            createdBy: t.first_name ? `${t.first_name} ${t.last_name}` : null,
            createdAt: t.created_at
        }))
    });
}));

// ==========================================
// GET BUDGET SUMMARY
// ==========================================
router.get('/:budgetId/summary', asyncHandler(async (req, res) => {
    const { budgetId } = req.params;

    const totals = await BudgetService.calculateTotals(budgetId);
    const burnRate = await BudgetService.calculateBurnRate(budgetId);
    const forecast = await BudgetService.forecastCompletion(budgetId);
    const alerts = await BudgetService.getAlerts(budgetId);

    res.json({
        totals,
        burnRate,
        forecast,
        alerts,
        generatedAt: new Date().toISOString()
    });
}));

// ==========================================
// GET BURN RATE
// ==========================================
router.get('/:budgetId/burn-rate', asyncHandler(async (req, res) => {
    const { budgetId } = req.params;

    const burnRate = await BudgetService.calculateBurnRate(budgetId);

    res.json({ burnRate });
}));

// ==========================================
// GET FORECAST
// ==========================================
router.get('/:budgetId/forecast', asyncHandler(async (req, res) => {
    const { budgetId } = req.params;

    const forecast = await BudgetService.forecastCompletion(budgetId);

    if (!forecast) {
        return res.status(404).json({ error: 'Budget not found' });
    }

    res.json({ forecast });
}));

// ==========================================
// GET ALERTS
// ==========================================
router.get('/:budgetId/alerts', asyncHandler(async (req, res) => {
    const { budgetId } = req.params;
    const { includeAcknowledged } = req.query;

    const alerts = await BudgetService.getAlerts(
        budgetId, 
        includeAcknowledged === 'true'
    );

    res.json({ alerts });
}));

// ==========================================
// ACKNOWLEDGE ALERT
// ==========================================
router.post('/alerts/:alertId/acknowledge', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { alertId } = req.params;

    await BudgetService.acknowledgeAlert(alertId, userId);

    res.json({ success: true, message: 'Alert acknowledged' });
}));

// ==========================================
// CREATE SNAPSHOT
// ==========================================
router.post('/:budgetId/snapshots', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { budgetId } = req.params;
    const { snapshotType = 'MANUAL' } = req.body;

    const snapshot = await BudgetService.createSnapshot(budgetId, snapshotType, userId);

    res.status(201).json({ 
        success: true,
        snapshot,
        message: 'Snapshot created'
    });
}));

// ==========================================
// GET SNAPSHOTS
// ==========================================
router.get('/:budgetId/snapshots', asyncHandler(async (req, res) => {
    const { budgetId } = req.params;


    const snapshots = await queryHelpers.queryAll(`
        SELECT * FROM budget_snapshots 
        WHERE budget_id = ?
        ORDER BY snapshot_date DESC
    `, [budgetId]);

    res.json({ 
        snapshots: snapshots.map(s => ({
            id: s.id,
            type: s.snapshot_type,
            date: s.snapshot_date,
            plannedTotal: s.planned_total,
            actualTotal: s.actual_total,
            committedTotal: s.committed_total,
            varianceTotal: s.variance_total,
            burnRate: s.burn_rate,
            forecastAtCompletion: s.forecast_at_completion,
            estimateToComplete: s.estimate_to_complete
        }))
    });
}));

// ==========================================
// PORTFOLIO SUMMARY
// ==========================================
router.get('/portfolio/summary', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { fiscalYear, status } = req.query;

    const summary = await BudgetService.getPortfolioSummary(orgId, { fiscalYear, status });

    res.json({ summary });
}));

// ==========================================
// GET BUDGET CATEGORIES
// ==========================================
router.get('/metadata/categories', asyncHandler(async (req, res) => {
    res.json({
        categories: Object.values(BudgetService.BUDGET_CATEGORIES),
        budgetTypes: Object.values(BudgetService.BUDGET_TYPES),
        alertThresholds: BudgetService.ALERT_THRESHOLDS
    });
}));

export default router;









