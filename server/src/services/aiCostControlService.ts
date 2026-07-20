/**
 * AI Cost Control Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Manages AI usage budgets at global, tenant, and project levels.
 * Provides cost tracking, budget enforcement, and automatic model downgrading.
 * Fully migrated from server/services/aiCostControlService.js
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

interface ModelCost {
  input: number;
  output: number;
}

type ModelId =
  | 'gpt-4'
  | 'gpt-4-turbo'
  | 'claude-3-opus'
  | 'gemini-1.5-pro'
  | 'gpt-3.5-turbo'
  | 'claude-3-sonnet'
  | 'gemini-1.5-flash'
  | 'gpt-4o-mini'
  | 'claude-3-haiku'
  | 'glm-4'
  | 'glm-4-plus'
  | 'qwen-turbo'
  | 'command-r-plus'
  | 'deepseek-chat'
  | 'meta/llama-3.1-405b-instruct';

type ModelCategory = 'reasoning' | 'execution' | 'chat' | 'summarization';
type ScopeType = 'global' | 'tenant' | 'project';
type AIRole = 'ADVISOR' | 'PMO_MANAGER' | 'EXECUTOR' | 'EDUCATOR';
type ActionType =
  | 'chat'
  | 'analysis'
  | 'deep_diagnose'
  | 'generation'
  | 'task_insight'
  | 'report'
  | 'executive_summary';

interface BudgetRow {
  id: string;
  scope_type: ScopeType;
  scope_id: string | null;
  monthly_limit_usd: number;
  current_month_usage: number;
  hard_limit_usd?: number;
  freeze_on_limit?: number;
  auto_downgrade: number;
  reset_day?: number;
  created_at: string;
  updated_at: string;
}

interface BudgetStatus {
  allowed: boolean;
  remainingBudget: number | null;
  shouldDowngrade: boolean;
  currentUsage: number;
  limit: number | null;
  restrictingScope?: ScopeType;
  percentUsed?: number;
  isFrozen: boolean;
  reason?: string;
}

interface UsageLogParams {
  organizationId: string;
  projectId?: string | null;
  userId: string;
  modelUsed: string;
  modelCategory: ModelCategory;
  actionType: ActionType;
  inputTokens: number;
  outputTokens: number;
  wasDowngraded?: boolean;
  downgradeReason?: string | null;
}

interface UsageLogResult {
  id: string;
  estimatedCost: number;
  inputTokens: number;
  outputTokens: number;
  modelUsed: string;
  modelCategory: ModelCategory;
}

interface UsageSummary {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  downgradedRequests: number;
  byCategory: Record<string, number>;
  byModel: Record<string, number>;
}

interface UserUsageRow {
  date: string;
  requests: number;
  total_tokens: number;
  cost: number;
}

interface AICostControlServiceDependencies {
  db?: IDatabase;
  uuidv4?: () => string;
}

// ==========================================
// CONSTANTS
// ==========================================

// Model cost estimates (per 1K tokens, in USD)
const MODEL_COSTS: Record<ModelId, ModelCost> = {
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
  'glm-4': { input: 0.001, output: 0.001 },
  'glm-4-plus': { input: 0.01, output: 0.01 },
  'qwen-turbo': { input: 0.002, output: 0.006 },
  'command-r-plus': { input: 0.003, output: 0.015 },
  'deepseek-chat': { input: 0.001, output: 0.002 },
  'meta/llama-3.1-405b-instruct': { input: 0.003, output: 0.005 },
};

// Model categories and their tier mapping
export const MODEL_CATEGORIES = {
  REASONING: 'reasoning' as const,
  EXECUTION: 'execution' as const,
  CHAT: 'chat' as const,
  SUMMARIZATION: 'summarization' as const,
};

// Category to tier preference (higher tier = more expensive but capable)
const CATEGORY_TIER_PREFERENCE: Record<ModelCategory, number> = {
  [MODEL_CATEGORIES.REASONING]: 1, // Premium
  [MODEL_CATEGORIES.EXECUTION]: 2, // Standard
  [MODEL_CATEGORIES.CHAT]: 3, // Budget
  [MODEL_CATEGORIES.SUMMARIZATION]: 2, // Standard
};

// Role to category mapping
export const ROLE_TO_CATEGORY: Record<AIRole, ModelCategory> = {
  ADVISOR: MODEL_CATEGORIES.CHAT,
  PMO_MANAGER: MODEL_CATEGORIES.REASONING,
  EXECUTOR: MODEL_CATEGORIES.EXECUTION,
  EDUCATOR: MODEL_CATEGORIES.CHAT,
};

// Action to category mapping
export const ACTION_TO_CATEGORY: Record<ActionType, ModelCategory> = {
  chat: MODEL_CATEGORIES.CHAT,
  analysis: MODEL_CATEGORIES.REASONING,
  deep_diagnose: MODEL_CATEGORIES.REASONING,
  generation: MODEL_CATEGORIES.EXECUTION,
  task_insight: MODEL_CATEGORIES.EXECUTION,
  report: MODEL_CATEGORIES.SUMMARIZATION,
  executive_summary: MODEL_CATEGORIES.SUMMARIZATION,
};

// ==========================================
// SERVICE CLASS
// ==========================================

class AICostControlServiceClass {
  private db: IDatabase;
  private uuidv4Fn: () => string;

  constructor(deps?: AICostControlServiceDependencies) {
    this.db = deps?.db || getDatabase();
    this.uuidv4Fn = deps?.uuidv4 || uuidv4;
  }

  /**
   * For testing: allow overriding dependencies
   */
  setDependencies(newDeps: Partial<AICostControlServiceDependencies>): void {
    if (newDeps.db) this.db = newDeps.db;
    if (newDeps.uuidv4) this.uuidv4Fn = newDeps.uuidv4;
  }

  /**
   * Database helper: Get single row
   */
  private async dbGet<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    return new Promise((resolve, reject) => {
      this.db.get<T>(sql, params, (err: Error | null, row: unknown) => {
        if (err) reject(err);
        else resolve((row as T) || null);
      });
    });
  }

  /**
   * Database helper: Get all rows
   */
  private async dbAll<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all<T>(sql, params, (err: Error | null, rows: unknown) => {
        if (err) reject(err);
        else resolve((rows as T[]) || []);
      });
    });
  }

  /**
   * Database helper: Run query
   */
  private async dbRun(
    sql: string,
    params: unknown[] = []
  ): Promise<{ lastID?: number; changes: number }> {
    return new Promise((resolve, reject) => {
      this.db.run(
        sql,
        params,
        function (this: { lastID?: number; changes: number }, err: Error | null) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes || 0 });
        }
      );
    });
  }

  /**
   * Database helper: Serialize (for multiple queries)
   */
  private async dbSerialize<T>(callback: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        callback().then(resolve).catch(reject);
      });
    });
  }

  // ==========================================
  // BUDGET MANAGEMENT
  //
  // (fala 4, 2026-07-20) The six schema-drift methods that used to live here
  // (setGlobalBudget/setTenantBudget/setProjectBudget/getBudget/checkBudget/logUsage, plus the
  // private _updateBudgetUsage helper) wrote an `ai_budgets` shape (scope_type/scope_id/
  // monthly_limit_usd/auto_downgrade) that never matched the real table and had zero live
  // callers — removed outright. The real budget logic lives in `aiBudgetService.ts` (wired to
  // routes/ai-budgets.routes.ts and routes/ai/ai-budgets.routes.ts). The only live caller of
  // this class remains `server/src/cron/Scheduler.ts` job8, calling `resetMonthlyUsage()` below.
  // ==========================================

  // ==========================================
  // USAGE TRACKING
  // ==========================================

  /**
   * Estimate cost for a request
   */
  estimateCost(modelId: string, inputTokens: number, outputTokens = 0): number {
    const costs = MODEL_COSTS[modelId as ModelId] || { input: 0.001, output: 0.002 };
    return (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output;
  }

  /**
   * Reset monthly usage (called by scheduler on reset_day)
   *
   * LIVE — this is the only method on this class with a real caller:
   * `server/src/cron/Scheduler.ts` job8 calls `resetMonthlyUsage()` with no args (monthly cron,
   * 1st of the month). With no `scopeType`, the UPDATE only touches `current_month_usage` /
   * `updated_at`, which do exist on the real `ai_budgets` table — so this is NOT part of the
   * schema-drift affecting the methods above. Do not deprecate; do not change behavior here.
   */
  async resetMonthlyUsage(scopeType: ScopeType | null = null): Promise<{ resetCount: number }> {
    const sql = scopeType
      ? `UPDATE ai_budgets SET current_month_usage = 0, updated_at = CURRENT_TIMESTAMP WHERE scope_type = ?`
      : `UPDATE ai_budgets SET current_month_usage = 0, updated_at = CURRENT_TIMESTAMP`;
    const params = scopeType ? [scopeType] : [];

    const result = await this.dbRun(sql, params);
    return { resetCount: result.changes };
  }

  // ==========================================
  // MODEL SELECTION
  // ==========================================

  /**
   * Get recommended model category for an action or role
   */
  getCategoryForAction(actionType: ActionType | null, aiRole: AIRole | null = null): ModelCategory {
    // Action takes precedence over role
    if (actionType && ACTION_TO_CATEGORY[actionType]) {
      return ACTION_TO_CATEGORY[actionType];
    }
    if (aiRole && ROLE_TO_CATEGORY[aiRole]) {
      return ROLE_TO_CATEGORY[aiRole];
    }
    return MODEL_CATEGORIES.CHAT; // Default
  }

  /**
   * Get tier for budget-aware model selection
   * Returns 1 (premium), 2 (standard), or 3 (budget)
   */
  getTierForBudget(budgetStatus: BudgetStatus, preferredCategory: ModelCategory): number {
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
  }

  // ==========================================
  // ANALYTICS
  // ==========================================

  /**
   * Get usage summary for an organization
   */
  async getUsageSummary(
    organizationId: string,
    startDate: string | null = null,
    endDate: string | null = null
  ): Promise<UsageSummary> {
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
    const params: unknown[] = [organizationId];

    if (startDate) {
      sql += ` AND created_at >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      sql += ` AND created_at <= ?`;
      params.push(endDate);
    }

    sql += ` GROUP BY model_category, model_used`;

    interface UsageRow {
      total_requests: number;
      total_input_tokens: number | null;
      total_output_tokens: number | null;
      total_cost: number | null;
      downgraded_requests: number;
      model_category: string | null;
      model_used: string | null;
    }

    const rows = await this.dbAll<UsageRow>(sql, params);

    const summary: UsageSummary = {
      totalRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      downgradedRequests: 0,
      byCategory: {},
      byModel: {},
    };

    for (const row of rows) {
      summary.totalRequests += row.total_requests;
      summary.totalInputTokens += row.total_input_tokens || 0;
      summary.totalOutputTokens += row.total_output_tokens || 0;
      summary.totalCost += row.total_cost || 0;
      summary.downgradedRequests += row.downgraded_requests || 0;

      if (row.model_category) {
        summary.byCategory[row.model_category] =
          (summary.byCategory[row.model_category] || 0) + row.total_requests;
      }
      if (row.model_used) {
        summary.byModel[row.model_used] =
          (summary.byModel[row.model_used] || 0) + row.total_requests;
      }
    }

    summary.totalCost = Math.round(summary.totalCost * 100) / 100;
    return summary;
  }

  /**
   * Get user usage (read-only visibility)
   */
  async getUserUsage(userId: string, organizationId: string, days = 30): Promise<UserUsageRow[]> {
    const rows = await this.dbAll<UserUsageRow>(
      `
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as requests,
                SUM(input_tokens + output_tokens) as total_tokens,
                SUM(estimated_cost_usd) as cost
            FROM ai_usage_log
            WHERE user_id = ? AND organization_id = ?
            AND created_at >= datetime('now', '-' || ? || ' days')
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `,
      [userId, organizationId, days]
    );

    return rows;
  }

  /**
   * Get all budgets for admin view
   */
  async getAllBudgets(): Promise<BudgetRow[]> {
    return this.dbAll<BudgetRow>(
      `
            SELECT * FROM ai_budgets
            ORDER BY scope_type, scope_id
        `,
      []
    );
  }
}

// ==========================================
// EXPORTS
// ==========================================

// Export class
export { AICostControlServiceClass };

// Export constants

// Export types
export type {
  ActionType,
  AIRole,
  BudgetRow,
  BudgetStatus,
  ModelCategory,
  ScopeType,
  UsageLogParams,
  UsageLogResult,
  UsageSummary,
  UserUsageRow,
};

// Create singleton instance
const aiCostControlServiceInstance = new AICostControlServiceClass();

// Export default instance (for backward compatibility)
export default aiCostControlServiceInstance;
