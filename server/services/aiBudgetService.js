/**
 * AI Budget Service
 * 
 * Manages AI spending budgets, limits, and alerts
 * Tracks token usage and costs across organizations and users
 * 
 * Features:
 * - Budget creation and management
 * - Usage tracking
 * - Spending alerts
 * - Model permissions
 * - Budget enforcement
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// Cost per 1000 tokens for different models (approximate)
const MODEL_COSTS = {
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    'claude-3-opus': { input: 0.015, output: 0.075 },
    'claude-3-sonnet': { input: 0.003, output: 0.015 },
    'claude-3-haiku': { input: 0.00025, output: 0.00125 },
    'claude-3.5-sonnet': { input: 0.003, output: 0.015 },
    'gemini-pro': { input: 0.000125, output: 0.000375 },
    'gemini-pro-vision': { input: 0.000125, output: 0.000375 },
};

class AIBudgetService {
    // ====== BUDGET MANAGEMENT ======

    /**
     * Create a new budget
     */
    async createBudget(organizationId, budgetData) {
        const id = uuidv4();
        const {
            userId,
            budgetType,
            period,
            budgetLimit,
            warningThreshold = 0.8,
            hardLimit = true,
            periodStart,
            periodEnd,
            rolloverEnabled = false,
            rolloverPercentage = 0,
            createdBy,
        } = budgetData;

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO ai_budgets (
                    id, organization_id, user_id, budget_type, period,
                    budget_limit, warning_threshold, hard_limit, period_start, period_end,
                    rollover_enabled, rollover_percentage, current_usage, last_reset_at,
                    is_active, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), 1, ?)`,
                [
                    id, organizationId, userId || null, budgetType, period,
                    budgetLimit, warningThreshold, hardLimit ? 1 : 0,
                    periodStart || null, periodEnd || null,
                    rolloverEnabled ? 1 : 0, rolloverPercentage, createdBy
                ],
                function(err) {
                    if (err) return reject(err);
                    resolve({ id, created: true });
                }
            );
        });
    }

    /**
     * Get budgets for an organization
     */
    async getOrganizationBudgets(organizationId, includeUserBudgets = true) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT ab.*, u.email as user_email, u.display_name as user_display_name
                FROM ai_budgets ab
                LEFT JOIN users u ON ab.user_id = u.id
                WHERE ab.organization_id = ? AND ab.is_active = 1
            `;
            
            if (!includeUserBudgets) {
                query += ' AND ab.user_id IS NULL';
            }
            
            query += ' ORDER BY ab.user_id NULLS FIRST, ab.created_at DESC';

            db.all(query, [organizationId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    }

    /**
     * Get a specific budget
     */
    async getBudget(budgetId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT ab.*, u.email as user_email
                 FROM ai_budgets ab
                 LEFT JOIN users u ON ab.user_id = u.id
                 WHERE ab.id = ?`,
                [budgetId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });
    }

    /**
     * Update a budget
     */
    async updateBudget(budgetId, updates) {
        const allowedFields = [
            'budget_limit', 'warning_threshold', 'hard_limit',
            'period', 'period_start', 'period_end',
            'rollover_enabled', 'rollover_percentage', 'is_active'
        ];

        const setClauses = [];
        const params = [];

        for (const [key, value] of Object.entries(updates)) {
            const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            if (allowedFields.includes(dbKey)) {
                setClauses.push(`${dbKey} = ?`);
                params.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
            }
        }

        if (setClauses.length === 0) {
            return { updated: false };
        }

        setClauses.push("updated_at = datetime('now')");
        params.push(budgetId);

        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE ai_budgets SET ${setClauses.join(', ')} WHERE id = ?`,
                params,
                function(err) {
                    if (err) return reject(err);
                    resolve({ updated: this.changes > 0 });
                }
            );
        });
    }

    /**
     * Delete a budget
     */
    async deleteBudget(budgetId) {
        return new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM ai_budgets WHERE id = ?`,
                [budgetId],
                function(err) {
                    if (err) return reject(err);
                    resolve({ deleted: this.changes > 0 });
                }
            );
        });
    }

    // ====== USAGE TRACKING ======

    /**
     * Record AI usage and check against budget
     */
    async recordUsage(organizationId, userId, usage) {
        const {
            model,
            inputTokens = 0,
            outputTokens = 0,
            requestCount = 1,
        } = usage;

        // Calculate cost
        const modelCost = MODEL_COSTS[model] || { input: 0.01, output: 0.03 };
        const cost = (inputTokens / 1000 * modelCost.input) + (outputTokens / 1000 * modelCost.output);
        const totalTokens = inputTokens + outputTokens;

        // Get applicable budgets (user-level and org-level)
        const budgets = await this.getApplicableBudgets(organizationId, userId);
        
        const results = {
            recorded: true,
            cost,
            tokens: totalTokens,
            alerts: [],
            blocked: false,
        };

        // Check and update each budget
        for (const budget of budgets) {
            let usageValue;
            switch (budget.budget_type) {
                case 'tokens':
                    usageValue = totalTokens;
                    break;
                case 'cost':
                    usageValue = cost;
                    break;
                case 'requests':
                    usageValue = requestCount;
                    break;
                default:
                    usageValue = cost;
            }

            const newUsage = budget.current_usage + usageValue;
            const percentUsed = newUsage / budget.budget_limit;

            // Check if would exceed hard limit
            if (budget.hard_limit && newUsage > budget.budget_limit) {
                results.blocked = true;
                results.blockedReason = `Budget exceeded: ${budget.budget_type} limit of ${budget.budget_limit}`;
                
                // Create exceeded alert
                await this.createAlert(organizationId, userId, budget.id, {
                    alertType: 'exceeded',
                    title: `AI Budget Exceeded`,
                    message: `${budget.budget_type} budget limit of ${budget.budget_limit} has been exceeded`,
                    thresholdValue: budget.budget_limit,
                    currentValue: newUsage,
                    percentage: percentUsed,
                });
                
                results.alerts.push({
                    type: 'exceeded',
                    budgetType: budget.budget_type,
                    limit: budget.budget_limit,
                    current: newUsage,
                });
                
                continue; // Don't update this budget
            }

            // Check warning threshold
            if (percentUsed >= budget.warning_threshold && 
                budget.current_usage / budget.budget_limit < budget.warning_threshold) {
                await this.createAlert(organizationId, userId, budget.id, {
                    alertType: 'warning',
                    title: `AI Budget Warning`,
                    message: `${budget.budget_type} budget is at ${Math.round(percentUsed * 100)}% of limit`,
                    thresholdValue: budget.budget_limit * budget.warning_threshold,
                    currentValue: newUsage,
                    percentage: percentUsed,
                });
                
                results.alerts.push({
                    type: 'warning',
                    budgetType: budget.budget_type,
                    percentage: percentUsed,
                });
            }

            // Update budget usage
            await this.updateBudgetUsage(budget.id, newUsage);
        }

        return results;
    }

    /**
     * Get applicable budgets for a user
     */
    async getApplicableBudgets(organizationId, userId) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM ai_budgets
                 WHERE organization_id = ? AND is_active = 1
                 AND (user_id IS NULL OR user_id = ?)
                 ORDER BY user_id NULLS LAST`,
                [organizationId, userId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }

    /**
     * Update budget current usage
     */
    async updateBudgetUsage(budgetId, newUsage) {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE ai_budgets SET current_usage = ?, updated_at = datetime('now') WHERE id = ?`,
                [newUsage, budgetId],
                function(err) {
                    if (err) return reject(err);
                    resolve({ updated: this.changes > 0 });
                }
            );
        });
    }

    /**
     * Check if user can make AI request
     */
    async checkBudget(organizationId, userId, estimatedUsage) {
        const budgets = await this.getApplicableBudgets(organizationId, userId);

        for (const budget of budgets) {
            if (!budget.hard_limit) continue;

            let usageValue;
            switch (budget.budget_type) {
                case 'tokens':
                    usageValue = estimatedUsage.tokens || 0;
                    break;
                case 'cost':
                    usageValue = estimatedUsage.cost || 0;
                    break;
                case 'requests':
                    usageValue = 1;
                    break;
                default:
                    usageValue = estimatedUsage.cost || 0;
            }

            if (budget.current_usage + usageValue > budget.budget_limit) {
                return {
                    allowed: false,
                    reason: `Would exceed ${budget.budget_type} budget limit`,
                    budget: {
                        type: budget.budget_type,
                        limit: budget.budget_limit,
                        current: budget.current_usage,
                        remaining: budget.budget_limit - budget.current_usage,
                    },
                };
            }
        }

        return { allowed: true };
    }

    /**
     * Reset budget usage (called by scheduler)
     */
    async resetBudgetUsage(budgetId) {
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM ai_budgets WHERE id = ?`, [budgetId], (err, budget) => {
                if (err) return reject(err);
                if (!budget) return resolve({ reset: false });

                let rolloverAmount = 0;
                if (budget.rollover_enabled && budget.rollover_percentage > 0) {
                    const unused = budget.budget_limit - budget.current_usage;
                    rolloverAmount = Math.max(0, unused * budget.rollover_percentage);
                }

                db.run(
                    `UPDATE ai_budgets SET 
                        current_usage = 0, 
                        rollover_amount = ?,
                        last_reset_at = datetime('now'),
                        updated_at = datetime('now')
                     WHERE id = ?`,
                    [rolloverAmount, budgetId],
                    function(err) {
                        if (err) return reject(err);
                        resolve({ reset: this.changes > 0, rolloverAmount });
                    }
                );
            });
        });
    }

    // ====== ALERTS ======

    /**
     * Create a spending alert
     */
    async createAlert(organizationId, userId, budgetId, alertData) {
        const id = uuidv4();
        const {
            alertType,
            title,
            message,
            thresholdValue,
            currentValue,
            percentage,
            notificationChannels = ['email'],
        } = alertData;

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO ai_spending_alerts (
                    id, organization_id, user_id, budget_id, alert_type,
                    title, message, threshold_value, current_value, percentage,
                    notification_channels, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
                [
                    id, organizationId, userId, budgetId, alertType,
                    title, message, thresholdValue, currentValue, percentage,
                    JSON.stringify(notificationChannels)
                ],
                function(err) {
                    if (err) return reject(err);
                    resolve({ id, created: true });
                }
            );
        });
    }

    /**
     * Get alerts for an organization
     */
    async getAlerts(organizationId, options = {}) {
        const { status, alertType, limit = 100, offset = 0 } = options;

        let query = `
            SELECT asa.*, ab.budget_type, ab.period, u.email as user_email
            FROM ai_spending_alerts asa
            LEFT JOIN ai_budgets ab ON asa.budget_id = ab.id
            LEFT JOIN users u ON asa.user_id = u.id
            WHERE asa.organization_id = ?
        `;
        const params = [organizationId];

        if (status) {
            query += ' AND asa.status = ?';
            params.push(status);
        }

        if (alertType) {
            query += ' AND asa.alert_type = ?';
            params.push(alertType);
        }

        query += ' ORDER BY asa.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    }

    /**
     * Acknowledge an alert
     */
    async acknowledgeAlert(alertId, userId) {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE ai_spending_alerts 
                 SET status = 'acknowledged', acknowledged_at = datetime('now'), acknowledged_by = ?
                 WHERE id = ?`,
                [userId, alertId],
                function(err) {
                    if (err) return reject(err);
                    resolve({ acknowledged: this.changes > 0 });
                }
            );
        });
    }

    /**
     * Dismiss an alert
     */
    async dismissAlert(alertId) {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE ai_spending_alerts SET status = 'dismissed' WHERE id = ?`,
                [alertId],
                function(err) {
                    if (err) return reject(err);
                    resolve({ dismissed: this.changes > 0 });
                }
            );
        });
    }

    // ====== MODEL PERMISSIONS ======

    /**
     * Set model permissions
     */
    async setModelPermission(organizationId, permissionData) {
        const id = uuidv4();
        const {
            scopeType,
            scopeId,
            modelId,
            modelProvider,
            isAllowed = true,
            maxTokensPerRequest,
            dailyTokenLimit,
            priority = 0,
            createdBy,
        } = permissionData;

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO ai_model_permissions (
                    id, organization_id, scope_type, scope_id, model_id, model_provider,
                    is_allowed, max_tokens_per_request, daily_token_limit, priority, is_active, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
                ON CONFLICT(organization_id, scope_type, scope_id, model_id) DO UPDATE SET
                    is_allowed = excluded.is_allowed,
                    max_tokens_per_request = excluded.max_tokens_per_request,
                    daily_token_limit = excluded.daily_token_limit,
                    priority = excluded.priority,
                    updated_at = datetime('now')`,
                [
                    id, organizationId, scopeType, scopeId, modelId, modelProvider,
                    isAllowed ? 1 : 0, maxTokensPerRequest, dailyTokenLimit, priority, createdBy
                ],
                function(err) {
                    if (err) return reject(err);
                    resolve({ id, upserted: true });
                }
            );
        });
    }

    /**
     * Get model permissions for organization
     */
    async getModelPermissions(organizationId, scopeType = null, scopeId = null) {
        let query = `SELECT * FROM ai_model_permissions WHERE organization_id = ? AND is_active = 1`;
        const params = [organizationId];

        if (scopeType) {
            query += ' AND scope_type = ?';
            params.push(scopeType);
        }

        if (scopeId) {
            query += ' AND scope_id = ?';
            params.push(scopeId);
        }

        query += ' ORDER BY priority DESC, model_id';

        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    }

    /**
     * Check if user can use a specific model
     */
    async checkModelAccess(organizationId, userId, userRole, modelId) {
        // Get all applicable permissions
        const permissions = await new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM ai_model_permissions
                 WHERE organization_id = ? AND model_id = ? AND is_active = 1
                 AND (
                    (scope_type = 'organization' AND scope_id = ?) OR
                    (scope_type = 'role' AND scope_id = ?) OR
                    (scope_type = 'user' AND scope_id = ?)
                 )
                 ORDER BY priority DESC, 
                    CASE scope_type 
                        WHEN 'user' THEN 1 
                        WHEN 'role' THEN 2 
                        WHEN 'organization' THEN 3 
                    END`,
                [organizationId, modelId, organizationId, userRole, userId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });

        // If no explicit permissions, allow by default
        if (permissions.length === 0) {
            return { allowed: true };
        }

        // Use highest priority permission
        const permission = permissions[0];

        if (!permission.is_allowed) {
            return {
                allowed: false,
                reason: `Model ${modelId} is not allowed for your ${permission.scope_type}`,
            };
        }

        return {
            allowed: true,
            maxTokensPerRequest: permission.max_tokens_per_request,
            dailyTokenLimit: permission.daily_token_limit,
        };
    }

    /**
     * Delete model permission
     */
    async deleteModelPermission(permissionId) {
        return new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM ai_model_permissions WHERE id = ?`,
                [permissionId],
                function(err) {
                    if (err) return reject(err);
                    resolve({ deleted: this.changes > 0 });
                }
            );
        });
    }

    // ====== STATISTICS ======

    /**
     * Get usage statistics for an organization
     */
    async getUsageStats(organizationId, options = {}) {
        const { startDate, endDate, groupBy = 'day' } = options;

        // Get current budget status
        const budgets = await this.getOrganizationBudgets(organizationId);
        
        const stats = {
            budgets: budgets.map(b => ({
                id: b.id,
                type: b.budget_type,
                period: b.period,
                limit: b.budget_limit,
                current: b.current_usage,
                remaining: b.budget_limit - b.current_usage,
                percentUsed: Math.round((b.current_usage / b.budget_limit) * 100),
                userId: b.user_id,
                userEmail: b.user_email,
            })),
            totalBudgets: budgets.length,
            alertCount: 0,
        };

        // Get active alert count
        const alertCount = await new Promise((resolve, reject) => {
            db.get(
                `SELECT COUNT(*) as count FROM ai_spending_alerts 
                 WHERE organization_id = ? AND status = 'active'`,
                [organizationId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row?.count || 0);
                }
            );
        });

        stats.alertCount = alertCount;

        return stats;
    }

    /**
     * Get model cost estimates
     */
    getModelCosts() {
        return MODEL_COSTS;
    }

    /**
     * Estimate cost for a request
     */
    estimateCost(model, inputTokens, outputTokens) {
        const costs = MODEL_COSTS[model] || { input: 0.01, output: 0.03 };
        return (inputTokens / 1000 * costs.input) + (outputTokens / 1000 * costs.output);
    }
}

module.exports = new AIBudgetService();

