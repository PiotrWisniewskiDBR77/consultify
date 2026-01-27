/**
 * Budget Tracking Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Comprehensive budget management for organizations including:
 * - Budget initialization and configuration
 * - Expense tracking across categories
 * - Budget status monitoring
 * - Alert threshold management
 */

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface BudgetConfig {
  organizationId: string;
  monthlyBudgetUsd: number;
  alertThreshold?: number; // 0-1, default 0.8 (80%)
}

export interface ExpenseRecord {
  amount: number;
  category: 'TOKENS' | 'STORAGE' | 'COMPUTE' | 'API' | 'OTHER';
  description: string;
  metadata?: Record<string, unknown>;
}

export interface BudgetStatus {
  organizationId: string;
  monthlyBudget: number;
  spent: number;
  remaining: number;
  percentageUsed: number;
  alertThreshold: number;
  exceeded: boolean;
  approachingLimit: boolean; // true if > alert threshold
  periodStart: Date | null;
  periodEnd: Date | null;
}

export interface BudgetExpense {
  id: string;
  organizationId: string;
  amount: number;
  category: string;
  description: string;
  metadata: string;
  recordedAt: Date;
}

// ==========================================
// SERVICE IMPLEMENTATION
// ==========================================

export class BudgetTrackingService {
  private db: IDatabase;

  constructor(db?: IDatabase) {
    this.db = db || getDatabase();
  }

  /**
   * Initialize budget for an organization
   */
  async initializeBudget(config: BudgetConfig): Promise<void> {
    const { organizationId, monthlyBudgetUsd, alertThreshold = 0.8 } = config;

    try {
      const now = new Date();
      await this.db.run(
        `UPDATE organizations 
                 SET monthly_budget_usd = ?,
                     budget_spent_current_period = 0,
                     budget_alert_threshold = ?,
                     budget_period_start = ?
                 WHERE id = ?`,
        [monthlyBudgetUsd, alertThreshold, now.toISOString(), organizationId]
      );

      logger.info(
        `[BudgetTracking] Initialized budget for org ${organizationId}: $${monthlyBudgetUsd}/month`
      );
    } catch (error) {
      logger.error('[BudgetTracking] Error initializing budget:', error);
      throw error;
    }
  }

  /**
   * Record an expense
   */
  async recordExpense(organizationId: string, expense: ExpenseRecord): Promise<void> {
    const { amount, category, description, metadata } = expense;

    try {
      // Insert into budget_expenses table (to be created)
      await this.db.run(
        `INSERT INTO budget_expenses (
                    id, organization_id, amount, category, description, metadata, recorded_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          this.generateId(),
          organizationId,
          amount,
          category,
          description,
          JSON.stringify(metadata || {}),
          new Date().toISOString(),
        ]
      );

      // Update current period spending
      await this.db.run(
        `UPDATE organizations 
                 SET budget_spent_current_period = budget_spent_current_period + ?
                 WHERE id = ?`,
        [amount, organizationId]
      );

      logger.info(
        `[BudgetTracking] Recorded expense for org ${organizationId}: $${amount} (${category}) - ${description}`
      );

      // Check if budget exceeded and send alert
      const status = await this.getBudgetStatus(organizationId);
      if (status.approachingLimit || status.exceeded) {
        await this.sendBudgetAlert(organizationId, status);
      }
    } catch (error) {
      logger.error('[BudgetTracking] Error recording expense:', error);
      throw error;
    }
  }

  /**
   * Get current budget status
   */
  async getBudgetStatus(organizationId: string): Promise<BudgetStatus> {
    try {
      const org = await this.db.get<{
        monthly_budget_usd: number | null;
        budget_spent_current_period: number;
        budget_alert_threshold: number;
        budget_period_start: string | null;
      }>(
        `SELECT monthly_budget_usd, budget_spent_current_period, 
                        budget_alert_threshold, budget_period_start
                 FROM organizations 
                 WHERE id = ?`,
        [organizationId]
      );

      if (!org) {
        throw new Error(`Organization ${organizationId} not found`);
      }

      const monthlyBudget = org.monthly_budget_usd || 0;
      const spent = org.budget_spent_current_period || 0;
      const remaining = Math.max(0, monthlyBudget - spent);
      const percentageUsed = monthlyBudget > 0 ? (spent / monthlyBudget) * 100 : 0;
      const alertThreshold = org.budget_alert_threshold || 0.8;

      const periodStart = org.budget_period_start ? new Date(org.budget_period_start) : null;
      const periodEnd = periodStart
        ? new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0)
        : null;

      return {
        organizationId,
        monthlyBudget,
        spent,
        remaining,
        percentageUsed,
        alertThreshold: alertThreshold * 100,
        exceeded: spent > monthlyBudget,
        approachingLimit: percentageUsed >= alertThreshold * 100,
        periodStart,
        periodEnd,
      };
    } catch (error) {
      logger.error('[BudgetTracking] Error getting budget status:', error);
      throw error;
    }
  }

  /**
   * Check if budget is exceeded
   */
  async checkBudgetExceeded(organizationId: string): Promise<boolean> {
    const status = await this.getBudgetStatus(organizationId);
    return status.exceeded;
  }

  /**
   * Reset budget for new period (to be called by cron job)
   */
  async resetBudgetPeriod(organizationId: string): Promise<void> {
    try {
      const now = new Date();
      await this.db.run(
        `UPDATE organizations 
                 SET budget_spent_current_period = 0,
                     budget_period_start = ?
                 WHERE id = ?`,
        [now.toISOString(), organizationId]
      );

      logger.info(`[BudgetTracking] Reset budget period for org ${organizationId}`);
    } catch (error) {
      logger.error('[BudgetTracking] Error resetting budget period:', error);
      throw error;
    }
  }

  /**
   * Get expense history
   */
  async getExpenseHistory(
    organizationId: string,
    options: { limit?: number; offset?: number; category?: string } = {}
  ): Promise<BudgetExpense[]> {
    const { limit = 50, offset = 0, category } = options;

    try {
      let query = `SELECT * FROM budget_expenses WHERE organization_id = ?`;
      const params: unknown[] = [organizationId];

      if (category) {
        query += ` AND category = ?`;
        params.push(category);
      }

      query += ` ORDER BY recorded_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const expenses = await this.db.all<BudgetExpense>(query, params);
      return expenses || [];
    } catch (error) {
      logger.error('[BudgetTracking] Error getting expense history:', error);
      throw error;
    }
  }

  /**
   * Send budget alert (to be implemented with email/notification service)
   */
  private async sendBudgetAlert(organizationId: string, status: BudgetStatus): Promise<void> {
    // This will be implemented in production with actual notification service
    logger.warn(
      `[BudgetTracking] BUDGET ALERT for org ${organizationId}: 
            ${status.percentageUsed.toFixed(1)}% of budget used ($${status.spent}/$${status.monthlyBudget})`
    );

    // TODO: Integrate with notification service
    // - Send email to organization admins
    // - Create in-app notification
    // - Send webhook if configured
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

// ==========================================
// SINGLETON EXPORT
// ==========================================

export const budgetTrackingService = new BudgetTrackingService();
export default budgetTrackingService;
