/**
 * Budget Service - Initiative Budget Management
 * 
 * PMO Standards Compliance:
 * - ISO 21500:2021 - Cost Management (Clause 4.4.4)
 * - PMI PMBOK 7th Edition - Cost Performance Domain
 * - PRINCE2 - Business Case / Cost Management
 * 
 * PMO Domain: RESOURCE_RESPONSIBILITY, PERFORMANCE_MONITORING
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const queryHelpers = require('../utils/queryHelpers');

// Budget Categories
const BUDGET_CATEGORIES = {
    PERSONNEL: 'PERSONNEL',
    TECHNOLOGY: 'TECHNOLOGY',
    CONSULTING: 'CONSULTING',
    TRAINING: 'TRAINING',
    INFRASTRUCTURE: 'INFRASTRUCTURE',
    TRAVEL: 'TRAVEL',
    SOFTWARE: 'SOFTWARE',
    HARDWARE: 'HARDWARE',
    OTHER: 'OTHER'
};

// Budget Types
const BUDGET_TYPES = {
    CAPEX: 'CAPEX',
    OPEX: 'OPEX',
    COMBINED: 'COMBINED'
};

// Alert Thresholds
const ALERT_THRESHOLDS = {
    WARNING: 80,    // 80% consumed
    CRITICAL: 95,   // 95% consumed
    OVERRUN: 100    // 100%+ overrun
};

const BudgetService = {
    /**
     * Create budget for initiative
     */
    createBudget: async (orgId, initiativeId, budgetData, userId) => {
        const id = uuidv4();
        const now = new Date().toISOString();

        const {
            budgetType = 'COMBINED',
            plannedAmount = 0,
            currency = 'PLN',
            fiscalYear,
            contingencyPercent = 10,
            notes
        } = budgetData;

        const contingencyAmount = plannedAmount * (contingencyPercent / 100);

        await queryHelpers.queryRun(`
            INSERT INTO initiative_budgets (
                id, organization_id, initiative_id, budget_type,
                planned_amount, approved_amount, currency, fiscal_year,
                contingency_percent, contingency_amount, notes,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, orgId, initiativeId, budgetType,
            plannedAmount, plannedAmount, currency, fiscalYear || new Date().getFullYear(),
            contingencyPercent, contingencyAmount, notes,
            now, now
        ]);

        return {
            id,
            initiativeId,
            budgetType,
            plannedAmount,
            contingencyAmount,
            currency
        };
    },

    /**
     * Get budget for initiative
     */
    getBudget: async (initiativeId, orgId) => {
        const budget = await queryHelpers.queryOne(`
            SELECT b.*, i.name as initiative_name
            FROM initiative_budgets b
            JOIN initiatives i ON b.initiative_id = i.id
            WHERE b.initiative_id = ? AND b.organization_id = ?
        `, [initiativeId, orgId]);

        if (!budget) return null;

        // Get line items
        const lineItems = await queryHelpers.queryAll(`
            SELECT * FROM budget_line_items
            WHERE budget_id = ?
            ORDER BY sort_order ASC
        `, [budget.id]);

        // Get recent transactions
        const transactions = await queryHelpers.queryAll(`
            SELECT t.*, u.first_name, u.last_name
            FROM budget_transactions t
            LEFT JOIN users u ON t.created_by = u.id
            WHERE t.budget_id = ?
            ORDER BY t.transaction_date DESC
            LIMIT 50
        `, [budget.id]);

        // Calculate totals
        const totals = await BudgetService.calculateTotals(budget.id);

        return {
            id: budget.id,
            initiativeId: budget.initiative_id,
            initiativeName: budget.initiative_name,
            budgetType: budget.budget_type,
            plannedAmount: budget.planned_amount,
            approvedAmount: budget.approved_amount,
            currency: budget.currency,
            fiscalYear: budget.fiscal_year,
            contingencyPercent: budget.contingency_percent,
            contingencyAmount: budget.contingency_amount,
            status: budget.status,
            notes: budget.notes,
            lineItems: lineItems.map(li => ({
                id: li.id,
                category: li.category,
                subcategory: li.subcategory,
                description: li.description,
                budgetType: li.budget_type,
                plannedAmount: li.planned_amount,
                actualAmount: li.actual_amount,
                committedAmount: li.committed_amount,
                varianceAmount: li.variance_amount,
                forecastAmount: li.forecast_amount
            })),
            transactions: transactions.map(t => ({
                id: t.id,
                type: t.transaction_type,
                amount: t.amount,
                description: t.description,
                vendor: t.vendor,
                date: t.transaction_date,
                status: t.status,
                createdBy: t.first_name ? `${t.first_name} ${t.last_name}` : null
            })),
            totals,
            createdAt: budget.created_at,
            updatedAt: budget.updated_at
        };
    },

    /**
     * Calculate budget totals
     */
    calculateTotals: async (budgetId) => {
        const result = await queryHelpers.queryOne(`
            SELECT 
                SUM(planned_amount) as total_planned,
                SUM(actual_amount) as total_actual,
                SUM(committed_amount) as total_committed,
                SUM(forecast_amount) as total_forecast
            FROM budget_line_items
            WHERE budget_id = ?
        `, [budgetId]);

        const budget = await queryHelpers.queryOne(`
            SELECT planned_amount, approved_amount, contingency_amount
            FROM initiative_budgets WHERE id = ?
        `, [budgetId]);

        const totalPlanned = result?.total_planned || budget?.planned_amount || 0;
        const totalActual = result?.total_actual || 0;
        const totalCommitted = result?.total_committed || 0;
        const totalForecast = result?.total_forecast || totalActual;

        const remaining = totalPlanned - totalActual;
        const consumedPercent = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;
        const varianceAmount = totalActual - totalPlanned;
        const variancePercent = totalPlanned > 0 ? Math.round((varianceAmount / totalPlanned) * 100) : 0;

        return {
            totalPlanned,
            totalApproved: budget?.approved_amount || totalPlanned,
            totalActual,
            totalCommitted,
            totalForecast,
            remaining,
            consumedPercent,
            varianceAmount,
            variancePercent,
            contingencyAmount: budget?.contingency_amount || 0,
            isOverBudget: totalActual > totalPlanned,
            status: consumedPercent >= 100 ? 'OVERRUN' : 
                    consumedPercent >= 95 ? 'CRITICAL' :
                    consumedPercent >= 80 ? 'WARNING' : 'ON_TRACK'
        };
    },

    /**
     * Add line item to budget
     */
    addLineItem: async (budgetId, itemData) => {
        const id = uuidv4();
        const now = new Date().toISOString();

        const {
            category,
            subcategory,
            description,
            budgetType = 'OPEX',
            plannedAmount = 0,
            sortOrder = 0
        } = itemData;

        await queryHelpers.queryRun(`
            INSERT INTO budget_line_items (
                id, budget_id, category, subcategory, description,
                budget_type, planned_amount, sort_order, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, budgetId, category, subcategory, description, budgetType, plannedAmount, sortOrder, now, now]);

        return { id, category, plannedAmount };
    },

    /**
     * Add transaction
     */
    addTransaction: async (budgetId, transactionData, userId) => {
        const id = uuidv4();
        const now = new Date().toISOString();

        const {
            lineItemId,
            transactionType = 'EXPENSE',
            amount,
            description,
            vendor,
            invoiceNumber,
            transactionDate,
            costCenter,
            glAccount
        } = transactionData;

        const txDate = new Date(transactionDate || now);
        const periodMonth = txDate.getMonth() + 1;
        const periodYear = txDate.getFullYear();

        await queryHelpers.queryRun(`
            INSERT INTO budget_transactions (
                id, budget_id, line_item_id, transaction_type, amount,
                description, vendor, invoice_number, transaction_date,
                period_month, period_year, cost_center, gl_account,
                created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, budgetId, lineItemId, transactionType, amount,
            description, vendor, invoiceNumber, transactionDate || now,
            periodMonth, periodYear, costCenter, glAccount,
            userId, now, now
        ]);

        // Update line item actual if linked
        if (lineItemId && transactionType === 'EXPENSE') {
            await queryHelpers.queryRun(`
                UPDATE budget_line_items 
                SET actual_amount = COALESCE(actual_amount, 0) + ?,
                    updated_at = ?
                WHERE id = ?
            `, [amount, now, lineItemId]);
        }

        // Check for alerts
        await BudgetService.checkAlerts(budgetId);

        return { id, amount, transactionType };
    },

    /**
     * Calculate burn rate
     */
    calculateBurnRate: async (budgetId) => {
        // Get transactions for the last 3 months
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        const transactions = await queryHelpers.queryAll(`
            SELECT SUM(amount) as total, COUNT(*) as count,
                   strftime('%Y-%m', transaction_date) as month
            FROM budget_transactions
            WHERE budget_id = ? 
              AND transaction_type = 'EXPENSE'
              AND transaction_date >= ?
            GROUP BY strftime('%Y-%m', transaction_date)
            ORDER BY month DESC
        `, [budgetId, threeMonthsAgo.toISOString()]);

        if (transactions.length === 0) {
            return { monthlyBurnRate: 0, trend: 'STABLE', averageMonthly: 0 };
        }

        const monthlyTotals = transactions.map(t => t.total);
        const averageMonthly = monthlyTotals.reduce((a, b) => a + b, 0) / monthlyTotals.length;

        // Determine trend
        let trend = 'STABLE';
        if (monthlyTotals.length >= 2) {
            const recent = monthlyTotals[0];
            const previous = monthlyTotals[1];
            if (recent > previous * 1.2) trend = 'INCREASING';
            else if (recent < previous * 0.8) trend = 'DECREASING';
        }

        return {
            monthlyBurnRate: monthlyTotals[0] || 0,
            averageMonthly: Math.round(averageMonthly),
            trend,
            monthlyBreakdown: transactions
        };
    },

    /**
     * Forecast at completion
     */
    forecastCompletion: async (budgetId) => {
        const budget = await queryHelpers.queryOne(`
            SELECT * FROM initiative_budgets WHERE id = ?
        `, [budgetId]);

        if (!budget) return null;

        const totals = await BudgetService.calculateTotals(budgetId);
        const burnRate = await BudgetService.calculateBurnRate(budgetId);

        // Get initiative timeline
        const initiative = await queryHelpers.queryOne(`
            SELECT planned_end_date, actual_end_date, progress
            FROM initiatives WHERE id = ?
        `, [budget.initiative_id]);

        const progress = initiative?.progress || 0;
        const actualSpent = totals.totalActual;
        const plannedBudget = totals.totalPlanned;

        // EAC = AC + ETC (Estimate at Completion = Actual Cost + Estimate to Complete)
        let estimateAtCompletion;
        let estimateToComplete;

        if (progress > 0) {
            // Based on progress
            estimateAtCompletion = (actualSpent / (progress / 100));
            estimateToComplete = estimateAtCompletion - actualSpent;
        } else if (burnRate.averageMonthly > 0) {
            // Based on burn rate and remaining time
            const endDate = initiative?.planned_end_date ? new Date(initiative.planned_end_date) : new Date();
            const now = new Date();
            const monthsRemaining = Math.max(0, (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));
            estimateToComplete = burnRate.averageMonthly * monthsRemaining;
            estimateAtCompletion = actualSpent + estimateToComplete;
        } else {
            estimateAtCompletion = plannedBudget;
            estimateToComplete = plannedBudget - actualSpent;
        }

        const varianceAtCompletion = estimateAtCompletion - plannedBudget;
        const costPerformanceIndex = actualSpent > 0 && progress > 0 
            ? (plannedBudget * (progress / 100)) / actualSpent 
            : 1;

        return {
            budgetId,
            plannedBudget,
            actualSpent,
            estimateToComplete: Math.round(estimateToComplete),
            estimateAtCompletion: Math.round(estimateAtCompletion),
            varianceAtCompletion: Math.round(varianceAtCompletion),
            costPerformanceIndex: Math.round(costPerformanceIndex * 100) / 100,
            isProjectedOverrun: estimateAtCompletion > plannedBudget,
            projectedOverrunPercent: plannedBudget > 0 
                ? Math.round((varianceAtCompletion / plannedBudget) * 100) 
                : 0,
            recommendation: costPerformanceIndex < 0.9 
                ? 'REVIEW_SPENDING' 
                : costPerformanceIndex < 1 
                    ? 'MONITOR_CLOSELY' 
                    : 'ON_TRACK'
        };
    },

    /**
     * Check and generate alerts
     */
    checkAlerts: async (budgetId) => {
        const totals = await BudgetService.calculateTotals(budgetId);
        const now = new Date().toISOString();
        const alerts = [];

        // Check threshold alerts
        if (totals.consumedPercent >= ALERT_THRESHOLDS.OVERRUN) {
            alerts.push({
                id: uuidv4(),
                budgetId,
                alertType: 'OVERRUN',
                thresholdPercent: 100,
                currentPercent: totals.consumedPercent,
                message: `Budget overrun: ${totals.consumedPercent}% consumed`,
                severity: 'CRITICAL',
                createdAt: now
            });
        } else if (totals.consumedPercent >= ALERT_THRESHOLDS.CRITICAL) {
            alerts.push({
                id: uuidv4(),
                budgetId,
                alertType: 'THRESHOLD_CRITICAL',
                thresholdPercent: ALERT_THRESHOLDS.CRITICAL,
                currentPercent: totals.consumedPercent,
                message: `Critical threshold reached: ${totals.consumedPercent}% of budget consumed`,
                severity: 'CRITICAL',
                createdAt: now
            });
        } else if (totals.consumedPercent >= ALERT_THRESHOLDS.WARNING) {
            alerts.push({
                id: uuidv4(),
                budgetId,
                alertType: 'THRESHOLD_WARNING',
                thresholdPercent: ALERT_THRESHOLDS.WARNING,
                currentPercent: totals.consumedPercent,
                message: `Warning threshold reached: ${totals.consumedPercent}% of budget consumed`,
                severity: 'WARNING',
                createdAt: now
            });
        }

        // Insert alerts
        for (const alert of alerts) {
            // Check if similar alert already exists (unacknowledged)
            const existing = await queryHelpers.queryOne(`
                SELECT id FROM budget_alerts 
                WHERE budget_id = ? AND alert_type = ? AND is_acknowledged = 0
            `, [budgetId, alert.alertType]);

            if (!existing) {
                await queryHelpers.queryRun(`
                    INSERT INTO budget_alerts (
                        id, budget_id, alert_type, threshold_percent, 
                        current_percent, message, severity, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    alert.id, alert.budgetId, alert.alertType, 
                    alert.thresholdPercent, alert.currentPercent, 
                    alert.message, alert.severity, alert.createdAt
                ]);
            }
        }

        return alerts;
    },

    /**
     * Get budget alerts
     */
    getAlerts: async (budgetId, includeAcknowledged = false) => {
        const sql = includeAcknowledged
            ? `SELECT * FROM budget_alerts WHERE budget_id = ? ORDER BY created_at DESC`
            : `SELECT * FROM budget_alerts WHERE budget_id = ? AND is_acknowledged = 0 ORDER BY created_at DESC`;

        return await queryHelpers.queryAll(sql, [budgetId]);
    },

    /**
     * Acknowledge alert
     */
    acknowledgeAlert: async (alertId, userId) => {
        await queryHelpers.queryRun(`
            UPDATE budget_alerts 
            SET is_acknowledged = 1, acknowledged_by = ?, acknowledged_at = ?
            WHERE id = ?
        `, [userId, new Date().toISOString(), alertId]);
    },

    /**
     * Get portfolio budget summary
     */
    getPortfolioSummary: async (orgId, filters = {}) => {
        const { fiscalYear, status } = filters;

        let sql = `
            SELECT 
                b.id,
                b.initiative_id,
                i.name as initiative_name,
                i.status as initiative_status,
                b.planned_amount,
                b.approved_amount,
                b.currency,
                b.fiscal_year,
                b.status as budget_status,
                COALESCE(SUM(li.actual_amount), 0) as total_actual,
                COALESCE(SUM(li.committed_amount), 0) as total_committed
            FROM initiative_budgets b
            JOIN initiatives i ON b.initiative_id = i.id
            LEFT JOIN budget_line_items li ON li.budget_id = b.id
            WHERE b.organization_id = ?
        `;
        const params = [orgId];

        if (fiscalYear) {
            sql += ` AND b.fiscal_year = ?`;
            params.push(fiscalYear);
        }

        if (status) {
            sql += ` AND i.status = ?`;
            params.push(status);
        }

        sql += ` GROUP BY b.id ORDER BY i.name`;

        const budgets = await queryHelpers.queryAll(sql, params);

        // Calculate portfolio totals
        const portfolioTotals = budgets.reduce((acc, b) => {
            acc.totalPlanned += b.planned_amount || 0;
            acc.totalApproved += b.approved_amount || 0;
            acc.totalActual += b.total_actual || 0;
            acc.totalCommitted += b.total_committed || 0;
            return acc;
        }, { totalPlanned: 0, totalApproved: 0, totalActual: 0, totalCommitted: 0 });

        const remaining = portfolioTotals.totalPlanned - portfolioTotals.totalActual;
        const consumedPercent = portfolioTotals.totalPlanned > 0 
            ? Math.round((portfolioTotals.totalActual / portfolioTotals.totalPlanned) * 100) 
            : 0;

        // Count initiatives by budget health
        const healthCounts = budgets.reduce((acc, b) => {
            const pct = b.planned_amount > 0 ? (b.total_actual / b.planned_amount) * 100 : 0;
            if (pct >= 100) acc.overrun++;
            else if (pct >= 95) acc.critical++;
            else if (pct >= 80) acc.warning++;
            else acc.healthy++;
            return acc;
        }, { healthy: 0, warning: 0, critical: 0, overrun: 0 });

        return {
            initiatives: budgets.map(b => ({
                id: b.id,
                initiativeId: b.initiative_id,
                initiativeName: b.initiative_name,
                initiativeStatus: b.initiative_status,
                plannedAmount: b.planned_amount,
                actualAmount: b.total_actual,
                committedAmount: b.total_committed,
                consumedPercent: b.planned_amount > 0 
                    ? Math.round((b.total_actual / b.planned_amount) * 100) 
                    : 0,
                currency: b.currency
            })),
            totals: {
                ...portfolioTotals,
                remaining,
                consumedPercent
            },
            healthCounts,
            initiativeCount: budgets.length
        };
    },

    /**
     * Create budget snapshot
     */
    createSnapshot: async (budgetId, snapshotType, userId) => {
        const totals = await BudgetService.calculateTotals(budgetId);
        const forecast = await BudgetService.forecastCompletion(budgetId);
        const burnRate = await BudgetService.calculateBurnRate(budgetId);

        const id = uuidv4();
        const now = new Date().toISOString();

        await queryHelpers.queryRun(`
            INSERT INTO budget_snapshots (
                id, budget_id, snapshot_type, snapshot_date,
                planned_total, actual_total, committed_total, forecast_total,
                variance_total, burn_rate, forecast_at_completion, estimate_to_complete,
                created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, budgetId, snapshotType, now,
            totals.totalPlanned, totals.totalActual, totals.totalCommitted, totals.totalForecast,
            totals.varianceAmount, burnRate.monthlyBurnRate, 
            forecast?.estimateAtCompletion || 0, forecast?.estimateToComplete || 0,
            userId, now
        ]);

        return { id, snapshotType, createdAt: now };
    },

    BUDGET_CATEGORIES,
    BUDGET_TYPES,
    ALERT_THRESHOLDS
};

module.exports = BudgetService;



