/**
 * Budget Management Service
 * Handles user, project, and organization budgets with limits and alerts
 */

const deps = {
    db: require('../database'),
    uuidv4: require('uuid').v4
};

/**
 * Set dependencies (for testing)
 */
function setDependencies(newDeps = {}) {
    Object.assign(deps, newDeps);
}

/**
 * Set user budget
 */
function setUserBudget(orgId, userId, budget) {
    return new Promise((resolve, reject) => {
        const id = `budget-user-${deps.uuidv4()}`;
        const resetDay = budget.resetDayOfMonth || 1;

        deps.db.run(
            `INSERT INTO user_budgets(
                id, organization_id, user_id, monthly_token_budget, monthly_storage_budget_gb,
                monthly_cost_budget_usd, budget_alert_80, budget_alert_90, budget_alert_100,
                hard_limit_enabled, auto_upgrade_on_limit, reset_day_of_month
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(organization_id, user_id) DO UPDATE SET
                monthly_token_budget = excluded.monthly_token_budget,
                monthly_storage_budget_gb = excluded.monthly_storage_budget_gb,
                monthly_cost_budget_usd = excluded.monthly_cost_budget_usd,
                budget_alert_80 = excluded.budget_alert_80,
                budget_alert_90 = excluded.budget_alert_90,
                budget_alert_100 = excluded.budget_alert_100,
                hard_limit_enabled = excluded.hard_limit_enabled,
                auto_upgrade_on_limit = excluded.auto_upgrade_on_limit,
                reset_day_of_month = excluded.reset_day_of_month,
                updated_at = datetime('now')`,
            [
                id, orgId, userId,
                budget.monthlyTokenBudget || null,
                budget.monthlyStorageBudgetGb || null,
                budget.monthlyCostBudgetUsd || null,
                budget.alertAt80 ? 1 : 0,
                budget.alertAt90 ? 1 : 0,
                budget.alertAt100 ? 1 : 0,
                budget.hardLimitEnabled ? 1 : 0,
                budget.autoUpgradeOnLimit ? 1 : 0,
                resetDay
            ],
            (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({ success: true });
                }
            }
        );
    });
}

/**
 * Set project budget
 */
function setProjectBudget(orgId, projectId, budget) {
    return new Promise((resolve, reject) => {
        const id = `budget-project-${deps.uuidv4()}`;
        const resetDay = budget.resetDayOfMonth || 1;

        deps.db.run(
            `INSERT INTO project_budgets(
                id, organization_id, project_id, monthly_token_budget, monthly_storage_budget_gb,
                monthly_cost_budget_usd, budget_alert_80, budget_alert_90, budget_alert_100,
                hard_limit_enabled, auto_upgrade_on_limit, reset_day_of_month
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(organization_id, project_id) DO UPDATE SET
                monthly_token_budget = excluded.monthly_token_budget,
                monthly_storage_budget_gb = excluded.monthly_storage_budget_gb,
                monthly_cost_budget_usd = excluded.monthly_cost_budget_usd,
                budget_alert_80 = excluded.budget_alert_80,
                budget_alert_90 = excluded.budget_alert_90,
                budget_alert_100 = excluded.budget_alert_100,
                hard_limit_enabled = excluded.hard_limit_enabled,
                auto_upgrade_on_limit = excluded.auto_upgrade_on_limit,
                reset_day_of_month = excluded.reset_day_of_month,
                updated_at = datetime('now')`,
            [
                id, orgId, projectId,
                budget.monthlyTokenBudget || null,
                budget.monthlyStorageBudgetGb || null,
                budget.monthlyCostBudgetUsd || null,
                budget.alertAt80 ? 1 : 0,
                budget.alertAt90 ? 1 : 0,
                budget.alertAt100 ? 1 : 0,
                budget.hardLimitEnabled ? 1 : 0,
                budget.autoUpgradeOnLimit ? 1 : 0,
                resetDay
            ],
            (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({ success: true });
                }
            }
        );
    });
}

/**
 * Set organization budget (stored in billing_alerts as cost_cap_monthly)
 */
function setOrgBudget(orgId, budget) {
    return new Promise((resolve, reject) => {
        deps.db.run(
            `INSERT INTO billing_alerts(organization_id, cost_cap_monthly)
             VALUES(?, ?)
             ON CONFLICT(organization_id) DO UPDATE SET
                cost_cap_monthly = excluded.cost_cap_monthly,
                updated_at = datetime('now')`,
            [orgId, budget.monthlyCostBudgetUsd || null],
            (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({ success: true });
                }
            }
        );
    });
}

/**
 * Check budget limit before usage
 */
function checkBudgetLimit(orgId, userId = null, projectId = null, usageType, quantity) {
    return new Promise((resolve, reject) => {
        // Get relevant budget
        let budgetQuery;
        let params;

        if (userId) {
            budgetQuery = `SELECT * FROM user_budgets WHERE organization_id = ? AND user_id = ?`;
            params = [orgId, userId];
        } else if (projectId) {
            budgetQuery = `SELECT * FROM project_budgets WHERE organization_id = ? AND project_id = ?`;
            params = [orgId, projectId];
        } else {
            // Org-level check
            budgetQuery = `SELECT cost_cap_monthly FROM billing_alerts WHERE organization_id = ?`;
            params = [orgId];
        }

        deps.db.get(budgetQuery, params, (err, budget) => {
            if (err) {
                reject(err);
                return;
            }

            if (!budget) {
                resolve({ allowed: true, reason: 'No budget set' });
                return;
            }

            // Calculate current usage for this month
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

            // For now, we'll check against the budget fields
            // In a full implementation, we'd query actual usage from usage_records
            let currentUsage = 0;
            let budgetLimit = null;

            if (userId || projectId) {
                switch (usageType) {
                    case 'tokens':
                        currentUsage = budget.tokens_used_this_month || 0;
                        budgetLimit = budget.monthly_token_budget;
                        break;
                    case 'storage':
                        currentUsage = budget.storage_used_this_month_gb || 0;
                        budgetLimit = budget.monthly_storage_budget_gb;
                        break;
                    case 'cost':
                        currentUsage = budget.cost_this_month_usd || 0;
                        budgetLimit = budget.monthly_cost_budget_usd;
                        break;
                }
            } else {
                // Org-level: check cost cap
                currentUsage = 0; // Would need to calculate from invoices/usage
                budgetLimit = budget.cost_cap_monthly;
            }

            if (!budgetLimit) {
                resolve({ allowed: true, reason: 'No limit set for this usage type' });
                return;
            }

            const projectedUsage = currentUsage + quantity;
            const usagePercent = (projectedUsage / budgetLimit) * 100;

            if (projectedUsage > budgetLimit && budget.hard_limit_enabled) {
                resolve({
                    allowed: false,
                    reason: 'Budget limit exceeded',
                    currentUsage,
                    budgetLimit,
                    projectedUsage,
                    usagePercent: usagePercent.toFixed(2)
                });
            } else {
                resolve({
                    allowed: true,
                    currentUsage,
                    budgetLimit,
                    projectedUsage,
                    usagePercent: usagePercent.toFixed(2)
                });
            }
        });
    });
}

/**
 * Get budget status
 */
function getBudgetStatus(orgId, userId = null, projectId = null) {
    return new Promise((resolve, reject) => {
        let query;
        let params;

        if (userId) {
            query = `SELECT * FROM user_budgets WHERE organization_id = ? AND user_id = ?`;
            params = [orgId, userId];
        } else if (projectId) {
            query = `SELECT * FROM project_budgets WHERE organization_id = ? AND project_id = ?`;
            params = [orgId, projectId];
        } else {
            query = `SELECT cost_cap_monthly FROM billing_alerts WHERE organization_id = ?`;
            params = [orgId];
        }

        deps.db.get(query, params, (err, budget) => {
            if (err) {
                reject(err);
                return;
            }

            if (!budget) {
                resolve(null);
                return;
            }

            // Calculate usage percentages
            const result = { ...budget };

            if (budget.monthly_token_budget) {
                result.tokenUsagePercent = ((budget.tokens_used_this_month || 0) / budget.monthly_token_budget * 100).toFixed(2);
            }
            if (budget.monthly_storage_budget_gb) {
                result.storageUsagePercent = ((budget.storage_used_this_month_gb || 0) / budget.monthly_storage_budget_gb * 100).toFixed(2);
            }
            if (budget.monthly_cost_budget_usd) {
                result.costUsagePercent = ((budget.cost_this_month_usd || 0) / budget.monthly_cost_budget_usd * 100).toFixed(2);
            }

            resolve(result);
        });
    });
}

/**
 * Reset monthly budgets (cron job)
 */
function resetMonthlyBudgets() {
    return new Promise((resolve, reject) => {
        const now = new Date();
        const today = now.getDate();

        // Reset budgets where reset_day_of_month matches today
        deps.db.run(
            `UPDATE user_budgets SET
                tokens_used_this_month = 0,
                storage_used_this_month_gb = 0,
                cost_this_month_usd = 0,
                last_reset_date = date('now'),
                updated_at = datetime('now')
            WHERE reset_day_of_month = ?`,
            [today],
            (err) => {
                if (err) {
                    reject(err);
                    return;
                }

                deps.db.run(
                    `UPDATE project_budgets SET
                        tokens_used_this_month = 0,
                        storage_used_this_month_gb = 0,
                        cost_this_month_usd = 0,
                        last_reset_date = date('now'),
                        updated_at = datetime('now')
                    WHERE reset_day_of_month = ?`,
                    [today],
                    (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve({ reset: true, day: today });
                        }
                    }
                );
            }
        );
    });
}

/**
 * Get budget usage
 */
function getBudgetUsage(orgId, userId = null, projectId = null) {
    return getBudgetStatus(orgId, userId, projectId);
}

module.exports = {
    setDependencies,
    setUserBudget,
    setProjectBudget,
    setOrgBudget,
    checkBudgetLimit,
    getBudgetStatus,
    resetMonthlyBudgets,
    getBudgetUsage
};




