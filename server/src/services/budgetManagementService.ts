/**
 * Budget Management Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Handles user, project, and organization budgets with limits and alerts
 * Fully migrated to Class-based Async DI pattern
 */

import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export type UsageType = 'tokens' | 'storage' | 'cost';

export interface UserBudget {
    monthlyTokenBudget?: number | null;
    monthlyStorageBudgetGb?: number | null;
    monthlyCostBudgetUsd?: number | null;
    alertAt80?: boolean;
    alertAt90?: boolean;
    alertAt100?: boolean;
    hardLimitEnabled?: boolean;
    autoUpgradeOnLimit?: boolean;
    resetDayOfMonth?: number;
}

export interface ProjectBudget {
    monthlyTokenBudget?: number | null;
    monthlyStorageBudgetGb?: number | null;
    monthlyCostBudgetUsd?: number | null;
    alertAt80?: boolean;
    alertAt90?: boolean;
    alertAt100?: boolean;
    hardLimitEnabled?: boolean;
    autoUpgradeOnLimit?: boolean;
    resetDayOfMonth?: number;
}

export interface OrgBudget {
    monthlyCostBudgetUsd?: number | null;
}

export interface CheckBudgetLimitResult {
    allowed: boolean;
    reason?: string;
    currentUsage?: number;
    budgetLimit?: number | null;
    projectedUsage?: number;
    usagePercent?: string;
}

export interface BudgetStatus {
    id?: string;
    organization_id?: string;
    user_id?: string | null;
    project_id?: string | null;
    monthly_token_budget?: number | null;
    monthly_storage_budget_gb?: number | null;
    monthly_cost_budget_usd?: number | null;
    tokens_used_this_month?: number;
    storage_used_this_month_gb?: number;
    cost_this_month_usd?: number;
    tokenUsagePercent?: string;
    storageUsagePercent?: string;
    costUsagePercent?: string;
    cost_cap_monthly?: number | null;
    hard_limit_enabled?: number;
}

interface UserBudgetRow extends BudgetStatus {
    budget_alert_80?: number;
    budget_alert_90?: number;
    budget_alert_100?: number;
    auto_upgrade_on_limit?: number;
    reset_day_of_month?: number;
}

interface ProjectBudgetRow extends BudgetStatus {
    budget_alert_80?: number;
    budget_alert_90?: number;
    budget_alert_100?: number;
    auto_upgrade_on_limit?: number;
    reset_day_of_month?: number;
}

interface OrgBudgetRow {
    cost_cap_monthly?: number | null;
}

export interface BudgetManagementServiceDependencies {
    db: IDatabase;
    uuidv4: () => string;
}

// ==========================================
// SERVICE IMPLEMENTATION
// ==========================================

class BudgetManagementServiceClass {
    #deps: BudgetManagementServiceDependencies | null = null;
    #initialized = false;
    #initPromise: Promise<void> | null = null;

    constructor() {
        // Dependencies initialized lazily
    }

    async #initDeps(): Promise<void> {
        if (this.#initialized) return;
        if (this.#initPromise) return this.#initPromise;

        this.#initPromise = (async () => {
            try {
                const { getDatabase } = await import('../database/Database.js');
                const { v4: uuidv4 } = await import('uuid');

                const db = getDatabase();

                this.#deps = {
                    db,
                    uuidv4
                };

                this.#initialized = true;
            } catch (error: unknown) {
                logger.error('Failed to initialize BudgetManagementService dependencies:', error);
                throw error;
            } finally {
                this.#initPromise = null;
            }
        })();

        return this.#initPromise;
    }

    async #getDeps(): Promise<BudgetManagementServiceDependencies> {
        await this.#initDeps();
        if (!this.#deps) throw new Error('BudgetManagementService dependencies not initialized');
        return this.#deps;
    }

    async setDependencies(newDeps: Partial<BudgetManagementServiceDependencies>): Promise<void> {
        await this.#initDeps();
        if (this.#deps) {
            this.#deps = { ...this.#deps, ...newDeps };
        }
    }

    /**
     * Set user budget
     */
    async setUserBudget(orgId: string, userId: string, budget: UserBudget): Promise<{ id: string; success: boolean }> {
        const deps = await this.#getDeps();
        const id = `budget-user-${deps.uuidv4()}`;
        const resetDay = budget.resetDayOfMonth || 1;

        await DbPromise.run(
            deps.db,
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
            ]
        );

        return { id, success: true };
    }

    /**
     * Set project budget
     */
    async setProjectBudget(orgId: string, projectId: string, budget: ProjectBudget): Promise<{ id: string; success: boolean }> {
        const deps = await this.#getDeps();
        const id = `budget-project-${deps.uuidv4()}`;
        const resetDay = budget.resetDayOfMonth || 1;

        await DbPromise.run(
            deps.db,
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
            ]
        );

        return { id, success: true };
    }

    /**
     * Set organization budget
     */
    async setOrgBudget(orgId: string, budget: OrgBudget): Promise<{ success: boolean }> {
        const deps = await this.#getDeps();
        await DbPromise.run(
            deps.db,
            `INSERT INTO billing_alerts(organization_id, cost_cap_monthly)
             VALUES(?, ?)
             ON CONFLICT(organization_id) DO UPDATE SET
                cost_cap_monthly = excluded.cost_cap_monthly,
                updated_at = datetime('now')`,
            [orgId, budget.monthlyCostBudgetUsd || null]
        );

        return { success: true };
    }

    /**
     * Check budget limit before usage
     */
    async checkBudgetLimit(
        orgId: string,
        userId: string | null = null,
        projectId: string | null = null,
        usageType: UsageType,
        quantity: number
    ): Promise<CheckBudgetLimitResult> {
        const deps = await this.#getDeps();
        // Get relevant budget
        let budget: BudgetStatus | null = null;

        if (userId) {
            const row = await DbPromise.get<UserBudgetRow>(
                deps.db,
                `SELECT * FROM user_budgets WHERE organization_id = ? AND user_id = ?`,
                [orgId, userId]
            );
            budget = row;
        } else if (projectId) {
            const row = await DbPromise.get<ProjectBudgetRow>(
                deps.db,
                `SELECT * FROM project_budgets WHERE organization_id = ? AND project_id = ?`,
                [orgId, projectId]
            );
            budget = row;
        } else {
            // Org-level check
            const row = await DbPromise.get<OrgBudgetRow>(
                deps.db,
                `SELECT cost_cap_monthly FROM billing_alerts WHERE organization_id = ?`,
                [orgId]
            );
            budget = row as BudgetStatus;
        }

        if (!budget) {
            return { allowed: true, reason: 'No budget set' };
        }

        let currentUsage = 0;
        let budgetLimit: number | null = null;

        if (userId || projectId) {
            switch (usageType) {
                case 'tokens':
                    currentUsage = (budget.tokens_used_this_month || 0) as number;
                    budgetLimit = budget.monthly_token_budget || null;
                    break;
                case 'storage':
                    currentUsage = (budget.storage_used_this_month_gb || 0) as number;
                    budgetLimit = budget.monthly_storage_budget_gb || null;
                    break;
                case 'cost':
                    currentUsage = (budget.cost_this_month_usd || 0) as number;
                    budgetLimit = budget.monthly_cost_budget_usd || null;
                    break;
            }
        } else {
            // Org-level: check cost cap
            currentUsage = 0;
            budgetLimit = budget.cost_cap_monthly || null;
        }

        if (!budgetLimit) {
            return { allowed: true, reason: 'No limit set for this usage type' };
        }

        const projectedUsage = currentUsage + quantity;
        const usagePercent = (projectedUsage / budgetLimit) * 100;

        if (projectedUsage > budgetLimit && budget.hard_limit_enabled) {
            return {
                allowed: false,
                reason: 'Budget limit exceeded',
                currentUsage,
                budgetLimit,
                projectedUsage,
                usagePercent: usagePercent.toFixed(2)
            };
        } else {
            return {
                allowed: true,
                currentUsage,
                budgetLimit,
                projectedUsage,
                usagePercent: usagePercent.toFixed(2)
            };
        }
    }

    /**
     * Get budget status
     */
    async getBudgetStatus(
        orgId: string,
        userId: string | null = null,
        projectId: string | null = null
    ): Promise<BudgetStatus | null> {
        const deps = await this.#getDeps();
        let budget: BudgetStatus | null = null;

        if (userId) {
            const row = await DbPromise.get<UserBudgetRow>(
                deps.db,
                `SELECT * FROM user_budgets WHERE organization_id = ? AND user_id = ?`,
                [orgId, userId]
            );
            budget = row;
        } else if (projectId) {
            const row = await DbPromise.get<ProjectBudgetRow>(
                deps.db,
                `SELECT * FROM project_budgets WHERE organization_id = ? AND project_id = ?`,
                [orgId, projectId]
            );
            budget = row;
        } else {
            const row = await DbPromise.get<OrgBudgetRow>(
                deps.db,
                `SELECT cost_cap_monthly FROM billing_alerts WHERE organization_id = ?`,
                [orgId]
            );
            budget = row as BudgetStatus;
        }

        if (!budget) {
            return null;
        }

        // Calculate usage percentages
        const result: BudgetStatus = { ...budget };

        if (budget.monthly_token_budget) {
            result.tokenUsagePercent = (((budget.tokens_used_this_month || 0) as number) / (budget.monthly_token_budget || 1) * 100).toFixed(2);
        }
        if (budget.monthly_storage_budget_gb) {
            result.storageUsagePercent = (((budget.storage_used_this_month_gb || 0) as number) / (budget.monthly_storage_budget_gb || 1) * 100).toFixed(2);
        }
        if (budget.monthly_cost_budget_usd) {
            result.costUsagePercent = (((budget.cost_this_month_usd || 0) as number) / (budget.monthly_cost_budget_usd || 1) * 100).toFixed(2);
        }

        return result;
    }

    /**
     * Reset monthly budgets
     */
    async resetMonthlyBudgets(): Promise<{ reset: boolean; day: number }> {
        const deps = await this.#getDeps();
        const now = new Date();
        const today = now.getDate();

        // Reset budgets where reset_day_of_month matches today
        await DbPromise.run(
            deps.db,
            `UPDATE user_budgets SET
                tokens_used_this_month = 0,
                storage_used_this_month_gb = 0,
                cost_this_month_usd = 0,
                last_reset_date = date('now'),
                updated_at = datetime('now')
            WHERE reset_day_of_month = ?`,
            [today]
        );

        await DbPromise.run(
            deps.db,
            `UPDATE project_budgets SET
                tokens_used_this_month = 0,
                storage_used_this_month_gb = 0,
                cost_this_month_usd = 0,
                last_reset_date = date('now'),
                updated_at = datetime('now')
            WHERE reset_day_of_month = ?`,
            [today]
        );

        return { reset: true, day: today };
    }
}

// Create singleton instance
const budgetManagementServiceInstance = new BudgetManagementServiceClass();

// Export individual functions for backward compatibility
export const setDependencies = (newDeps: Partial<BudgetManagementServiceDependencies>) => budgetManagementServiceInstance.setDependencies(newDeps);
export const setUserBudget = (orgId: string, userId: string, budget: UserBudget) => budgetManagementServiceInstance.setUserBudget(orgId, userId, budget);
export const setProjectBudget = (orgId: string, projectId: string, budget: ProjectBudget) => budgetManagementServiceInstance.setProjectBudget(orgId, projectId, budget);
export const setOrgBudget = (orgId: string, budget: OrgBudget) => budgetManagementServiceInstance.setOrgBudget(orgId, budget);
export const checkBudgetLimit = (orgId: string, userId: string | null = null, projectId: string | null = null, usageType: UsageType, quantity: number) => budgetManagementServiceInstance.checkBudgetLimit(orgId, userId, projectId, usageType, quantity);
export const getBudgetStatus = (orgId: string, userId: string | null = null, projectId: string | null = null) => budgetManagementServiceInstance.getBudgetStatus(orgId, userId, projectId);
export const resetMonthlyBudgets = () => budgetManagementServiceInstance.resetMonthlyBudgets();
export const getBudgetUsage = (orgId: string, userId: string | null = null, projectId: string | null = null) => budgetManagementServiceInstance.getBudgetStatus(orgId, userId, projectId);

// Default export for backward compatibility
const BudgetManagementService = {
    setDependencies,
    setUserBudget,
    setProjectBudget,
    setOrgBudget,
    checkBudgetLimit,
    getBudgetStatus,
    resetMonthlyBudgets,
    getBudgetUsage
};

export default BudgetManagementService;
