/**
 * AI Cost Control Service
 * 
 * Manages AI usage budgets at global, tenant, and project levels.
 * Provides cost tracking, budget enforcement, and automatic model downgrading.
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// Model cost estimates (per 1K tokens, in USD)
const MODEL_COSTS = {
    // Premium tier (reasoning)
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'claude-3-opus': { input: 0.015, output: 0.075 },
    'gemini-1.5-pro': { input: 0.00125, output: 0.005 },

    // Standard tier (execution)
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    'claude-3-sonnet': { input: 0.003, output: 0.015 },
    'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },

    // Budget tier (chat)
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'claude-3-haiku': { input: 0.00025, output: 0.00125 },
    'glm-4': { input: 0.001, output: 0.001 }
};

// Model categories and their tier mapping
const MODEL_CATEGORIES = {
    REASONING: 'reasoning',      // Planning, analysis, decisions
    EXECUTION: 'execution',      // Drafts, tasks, reports
    CHAT: 'chat',               // Conversation, explanations
    SUMMARIZATION: 'summarization' // Reports, executive summaries
};

// Category to tier preference (higher tier = more expensive but capable)
const CATEGORY_TIER_PREFERENCE = {
    [MODEL_CATEGORIES.REASONING]: 1,      // Premium
    [MODEL_CATEGORIES.EXECUTION]: 2,      // Standard
    [MODEL_CATEGORIES.CHAT]: 3,           // Budget
    [MODEL_CATEGORIES.SUMMARIZATION]: 2   // Standard
};

// Role to category mapping
const ROLE_TO_CATEGORY = {
    'ADVISOR': MODEL_CATEGORIES.CHAT,
    'PMO_MANAGER': MODEL_CATEGORIES.REASONING,
    'EXECUTOR': MODEL_CATEGORIES.EXECUTION,
    'EDUCATOR': MODEL_CATEGORIES.CHAT
};

// Action to category mapping
const ACTION_TO_CATEGORY = {
    'chat': MODEL_CATEGORIES.CHAT,
    'analysis': MODEL_CATEGORIES.REASONING,
    'deep_diagnose': MODEL_CATEGORIES.REASONING,
    'generation': MODEL_CATEGORIES.EXECUTION,
    'task_insight': MODEL_CATEGORIES.EXECUTION,
    'report': MODEL_CATEGORIES.SUMMARIZATION,
    'executive_summary': MODEL_CATEGORIES.SUMMARIZATION
};

const AICostControlService = {
    MODEL_CATEGORIES,
    ROLE_TO_CATEGORY,
    ACTION_TO_CATEGORY,

    // ==========================================
    // BUDGET MANAGEMENT
    // ==========================================

    /**
     * Set global monthly budget (SuperAdmin only)
     */
    setGlobalBudget: async (monthlyLimitUsd, autoDowngrade = true) => {
        const id = 'budget-global';
        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO ai_budgets (id, scope_type, scope_id, monthly_limit_usd, auto_downgrade)
                VALUES (?, 'global', NULL, ?, ?)
                ON CONFLICT(scope_type, scope_id) 
                DO UPDATE SET monthly_limit_usd = ?, auto_downgrade = ?, updated_at = CURRENT_TIMESTAMP
            `, [id, monthlyLimitUsd, autoDowngrade ? 1 : 0, monthlyLimitUsd, autoDowngrade ? 1 : 0], function (err) {
                if (err) reject(err);
                else resolve({ id, monthlyLimitUsd, autoDowngrade });
            });
        });
    },

    /**
     * Set tenant (organization) monthly budget
     */
    setTenantBudget: async (organizationId, monthlyLimitUsd, autoDowngrade = true) => {
        const id = `budget-tenant-${organizationId}`;
        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO ai_budgets (id, scope_type, scope_id, monthly_limit_usd, auto_downgrade)
                VALUES (?, 'tenant', ?, ?, ?)
                ON CONFLICT(scope_type, scope_id) 
                DO UPDATE SET monthly_limit_usd = ?, auto_downgrade = ?, updated_at = CURRENT_TIMESTAMP
            `, [id, organizationId, monthlyLimitUsd, autoDowngrade ? 1 : 0, monthlyLimitUsd, autoDowngrade ? 1 : 0], function (err) {
                if (err) reject(err);
                else resolve({ id, organizationId, monthlyLimitUsd, autoDowngrade });
            });
        });
    },

    /**
     * Set project budget
     */
    setProjectBudget: async (projectId, monthlyLimitUsd, autoDowngrade = true) => {
        const id = `budget-project-${projectId}`;
        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO ai_budgets (id, scope_type, scope_id, monthly_limit_usd, auto_downgrade)
                VALUES (?, 'project', ?, ?, ?)
                ON CONFLICT(scope_type, scope_id) 
                DO UPDATE SET monthly_limit_usd = ?, auto_downgrade = ?, updated_at = CURRENT_TIMESTAMP
            `, [id, projectId, monthlyLimitUsd, autoDowngrade ? 1 : 0, monthlyLimitUsd, autoDowngrade ? 1 : 0], function (err) {
                if (err) reject(err);
                else resolve({ id, projectId, monthlyLimitUsd, autoDowngrade });
            });
        });
    },

    /**
     * Get budget for a scope
     */
    getBudget: async (scopeType, scopeId = null) => {
        return new Promise((resolve, reject) => {
            const sql = scopeId
                ? `SELECT * FROM ai_budgets WHERE scope_type = ? AND scope_id = ?`
                : `SELECT * FROM ai_budgets WHERE scope_type = ? AND scope_id IS NULL`;
            const params = scopeId ? [scopeType, scopeId] : [scopeType];

            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    },

    /**
     * Check budget status and determine if action is allowed
     * Returns: { allowed, remainingBudget, shouldDowngrade, currentUsage, limit }
     */
    checkBudget: async (organizationId, projectId = null, estimatedCost = 0) => {
        const budgets = [];

        // Check global budget
        const globalBudget = await AICostControlService.getBudget('global');
        if (globalBudget) budgets.push({ ...globalBudget, scope: 'global' });

        // Check tenant budget
        if (organizationId) {
            const tenantBudget = await AICostControlService.getBudget('tenant', organizationId);
            if (tenantBudget) budgets.push({ ...tenantBudget, scope: 'tenant' });
        }

        // Check project budget
        if (projectId) {
            const projectBudget = await AICostControlService.getBudget('project', projectId);
            if (projectBudget) budgets.push({ ...projectBudget, scope: 'project' });
        }

        // If no budgets set, allow everything
        if (budgets.length === 0) {
            return {
                allowed: true,
                remainingBudget: null,
                shouldDowngrade: false,
                currentUsage: 0,
                limit: null,
                restrictingScope: null
            };
        }

        // Find the most restrictive budget
        let mostRestrictive = null;
        for (const budget of budgets) {
            const remaining = budget.monthly_limit_usd - budget.current_month_usage;
            const wouldExceed = remaining < estimatedCost;

            if (!mostRestrictive || remaining < (mostRestrictive.monthly_limit_usd - mostRestrictive.current_month_usage)) {
                mostRestrictive = budget;
            }
        }

        const remaining = mostRestrictive.monthly_limit_usd - mostRestrictive.current_month_usage;
        const percentUsed = (mostRestrictive.current_month_usage / mostRestrictive.monthly_limit_usd) * 100;

        return {
            allowed: remaining >= estimatedCost || mostRestrictive.auto_downgrade,
            remainingBudget: Math.max(0, remaining),
            shouldDowngrade: percentUsed >= 80, // Start downgrading at 80%
            currentUsage: mostRestrictive.current_month_usage,
            limit: mostRestrictive.monthly_limit_usd,
            restrictingScope: mostRestrictive.scope,
            percentUsed: Math.round(percentUsed)
        };
    },

    // ==========================================
    // USAGE TRACKING
    // ==========================================

    /**
     * Estimate cost for a request
     */
    estimateCost: (modelId, inputTokens, outputTokens = 0) => {
        const costs = MODEL_COSTS[modelId] || { input: 0.001, output: 0.002 };
        return ((inputTokens / 1000) * costs.input) + ((outputTokens / 1000) * costs.output);
    },

    /**
     * Log AI usage for audit and billing
     */
    logUsage: async ({
        organizationId,
        projectId,
        userId,
        modelUsed,
        modelCategory,
        actionType,
        inputTokens,
        outputTokens,
        wasDowngraded = false,
        downgradeReason = null
    }) => {
        const id = uuidv4();
        const estimatedCost = AICostControlService.estimateCost(modelUsed, inputTokens, outputTokens);

        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO ai_usage_log 
                (id, organization_id, project_id, user_id, model_used, model_category, action_type, 
                 input_tokens, output_tokens, estimated_cost_usd, was_downgraded, downgrade_reason)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id, organizationId, projectId, userId, modelUsed, modelCategory, actionType,
                inputTokens, outputTokens, estimatedCost, wasDowngraded ? 1 : 0, downgradeReason
            ], async function (err) {
                if (err) {
                    console.error('[AICostControl] Log usage error:', err);
                    reject(err);
                    return;
                }

                // Update budget usage
                await AICostControlService._updateBudgetUsage(organizationId, projectId, estimatedCost);

                resolve({
                    id,
                    estimatedCost,
                    inputTokens,
                    outputTokens,
                    modelUsed,
                    modelCategory
                });
            });
        });
    },

    /**
     * Update budget usage after logging
     */
    _updateBudgetUsage: async (organizationId, projectId, cost) => {
        // Update all applicable budgets
        return new Promise((resolve) => {
            db.serialize(() => {
                // Global
                db.run(`
                    UPDATE ai_budgets 
                    SET current_month_usage = current_month_usage + ?, updated_at = CURRENT_TIMESTAMP
                    WHERE scope_type = 'global'
                `, [cost]);

                // Tenant
                if (organizationId) {
                    db.run(`
                        UPDATE ai_budgets 
                        SET current_month_usage = current_month_usage + ?, updated_at = CURRENT_TIMESTAMP
                        WHERE scope_type = 'tenant' AND scope_id = ?
                    `, [cost, organizationId]);
                }

                // Project
                if (projectId) {
                    db.run(`
                        UPDATE ai_budgets 
                        SET current_month_usage = current_month_usage + ?, updated_at = CURRENT_TIMESTAMP
                        WHERE scope_type = 'project' AND scope_id = ?
                    `, [cost, projectId]);
                }

                resolve();
            });
        });
    },

    /**
     * Reset monthly usage (called by scheduler on reset_day)
     */
    resetMonthlyUsage: async (scopeType = null) => {
        return new Promise((resolve, reject) => {
            const sql = scopeType
                ? `UPDATE ai_budgets SET current_month_usage = 0, updated_at = CURRENT_TIMESTAMP WHERE scope_type = ?`
                : `UPDATE ai_budgets SET current_month_usage = 0, updated_at = CURRENT_TIMESTAMP`;
            const params = scopeType ? [scopeType] : [];

            db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve({ resetCount: this.changes });
            });
        });
    },

    // ==========================================
    // MODEL SELECTION
    // ==========================================

    /**
     * Get recommended model category for an action or role
     */
    getCategoryForAction: (actionType, aiRole = null) => {
        // Action takes precedence over role
        if (actionType && ACTION_TO_CATEGORY[actionType]) {
            return ACTION_TO_CATEGORY[actionType];
        }
        if (aiRole && ROLE_TO_CATEGORY[aiRole]) {
            return ROLE_TO_CATEGORY[aiRole];
        }
        return MODEL_CATEGORIES.CHAT; // Default
    },

    /**
     * Get tier for budget-aware model selection
     * Returns 1 (premium), 2 (standard), or 3 (budget)
     */
    getTierForBudget: (budgetStatus, preferredCategory) => {
        const baseTier = CATEGORY_TIER_PREFERENCE[preferredCategory] || 2;

        if (!budgetStatus.shouldDowngrade) {
            return baseTier;
        }

        // Progressive downgrade based on usage
        const percentUsed = budgetStatus.percentUsed || 0;

        if (percentUsed >= 95) {
            return 3; // Force budget tier
        } else if (percentUsed >= 90) {
            return Math.min(3, baseTier + 1);
        } else if (percentUsed >= 80) {
            return Math.min(3, baseTier);
        }

        return baseTier;
    },

    // ==========================================
    // ANALYTICS
    // ==========================================

    /**
     * Get usage summary for an organization
     */
    getUsageSummary: async (organizationId, startDate = null, endDate = null) => {
        return new Promise((resolve, reject) => {
            let sql = `
                SELECT 
                    COUNT(*) as total_requests,
                    SUM(input_tokens) as total_input_tokens,
                    SUM(output_tokens) as total_output_tokens,
                    SUM(estimated_cost_usd) as total_cost,
                    SUM(CASE WHEN was_downgraded = 1 THEN 1 ELSE 0 END) as downgraded_requests,
                    model_category,
                    model_used
                FROM ai_usage_log
                WHERE organization_id = ?
            `;
            const params = [organizationId];

            if (startDate) {
                sql += ` AND created_at >= ?`;
                params.push(startDate);
            }
            if (endDate) {
                sql += ` AND created_at <= ?`;
                params.push(endDate);
            }

            sql += ` GROUP BY model_category, model_used`;

            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else {
                    const summary = {
                        totalRequests: 0,
                        totalInputTokens: 0,
                        totalOutputTokens: 0,
                        totalCost: 0,
                        downgradedRequests: 0,
                        byCategory: {},
                        byModel: {}
                    };

                    for (const row of (rows || [])) {
                        summary.totalRequests += row.total_requests;
                        summary.totalInputTokens += row.total_input_tokens || 0;
                        summary.totalOutputTokens += row.total_output_tokens || 0;
                        summary.totalCost += row.total_cost || 0;
                        summary.downgradedRequests += row.downgraded_requests || 0;

                        if (row.model_category) {
                            summary.byCategory[row.model_category] = (summary.byCategory[row.model_category] || 0) + row.total_requests;
                        }
                        if (row.model_used) {
                            summary.byModel[row.model_used] = (summary.byModel[row.model_used] || 0) + row.total_requests;
                        }
                    }

                    summary.totalCost = Math.round(summary.totalCost * 100) / 100;
                    resolve(summary);
                }
            });
        });
    },

    /**
     * Get user usage (read-only visibility)
     */
    getUserUsage: async (userId, organizationId, days = 30) => {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as requests,
                    SUM(input_tokens + output_tokens) as total_tokens,
                    SUM(estimated_cost_usd) as cost
                FROM ai_usage_log
                WHERE user_id = ? AND organization_id = ?
                AND created_at >= datetime('now', '-${days} days')
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            `, [userId, organizationId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    },

    /**
     * Get all budgets for admin view
     */
    getAllBudgets: async () => {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT * FROM ai_budgets
                ORDER BY scope_type, scope_id
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }
};

module.exports = AICostControlService;
