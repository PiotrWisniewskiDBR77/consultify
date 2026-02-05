/**
 * AI Cost Monitoring Service (L6.10)
 *
 * Monitors AI token usage and cost metrics including:
 * - Daily/monthly token consumption
 * - Cost estimation per tier
 * - User usage distribution
 * - Budget alerting
 *
 * @module server/src/services/ai/cost-monitoring.service.ts
 * @version 1.0.0
 */

import logger from '../../utils/Logger.js';

// ============================================================================
// Types
// ============================================================================

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface UsageRecord {
  id: string;
  userId: string;
  organizationId: string;
  tier: 'BUDGET' | 'STANDARD' | 'PREMIUM' | 'REASONING';
  provider: string;
  model: string;
  usage: TokenUsage;
  costUSD: number;
  timestamp: number;
}

export interface CostMetrics {
  timestamp: string;
  period: 'hour' | 'day' | 'week' | 'month';
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCostUSD: number;
  tierBreakdown: Record<string, { tokens: number; costUSD: number }>;
  topUsers: Array<{ userId: string; tokens: number; costUSD: number }>;
  alertLevel: 'normal' | 'warning' | 'critical';
  budgetUsedPercent: number;
}

export interface BudgetConfig {
  dailyLimitUSD: number;
  monthlyLimitUSD: number;
  perUserLimitUSD: number;
  alertThresholds: number[]; // e.g., [0.5, 0.75, 0.9] for 50%, 75%, 90%
}

// ============================================================================
// Cost Pricing (per 1M tokens)
// ============================================================================

const PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  o1: { input: 15, output: 60 },
  'o1-mini': { input: 3, output: 12 },
  'o3-mini': { input: 1.1, output: 4.4 },

  // Anthropic
  'claude-3-opus': { input: 15, output: 75 },
  'claude-3-sonnet': { input: 3, output: 15 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'claude-3.5-sonnet': { input: 3, output: 15 },

  // Google
  'gemini-1.5-pro': { input: 1.25, output: 5 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },

  // Default fallback
  default: { input: 1, output: 4 },
};

// ============================================================================
// Cost Monitoring Service
// ============================================================================

class AICostMonitoringService {
  private usageRecords: UsageRecord[] = [];
  private readonly MAX_RECORDS = 100000;
  private readonly RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  private budgetConfig: BudgetConfig = {
    dailyLimitUSD: 100,
    monthlyLimitUSD: 2000,
    perUserLimitUSD: 50,
    alertThresholds: [0.5, 0.75, 0.9],
  };

  /**
   * Record token usage for a request
   */
  recordUsage(
    userId: string,
    organizationId: string,
    tier: UsageRecord['tier'],
    provider: string,
    model: string,
    usage: TokenUsage
  ): UsageRecord {
    const costUSD = this.calculateCost(model, usage);

    const record: UsageRecord = {
      id: `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      organizationId,
      tier,
      provider,
      model,
      usage,
      costUSD,
      timestamp: Date.now(),
    };

    this.usageRecords.push(record);
    this.pruneOldRecords();

    // Check for budget alerts
    this.checkBudgetAlerts(organizationId);

    return record;
  }

  /**
   * Get cost metrics for a period
   */
  getMetrics(period: CostMetrics['period'] = 'day', organizationId?: string): CostMetrics {
    const cutoff = this.getCutoffTime(period);
    let records = this.usageRecords.filter((r) => r.timestamp >= cutoff);

    if (organizationId) {
      records = records.filter((r) => r.organizationId === organizationId);
    }

    if (records.length === 0) {
      return this.getEmptyMetrics(period);
    }

    // Calculate totals
    const totalTokens = records.reduce((sum, r) => sum + r.usage.totalTokens, 0);
    const inputTokens = records.reduce((sum, r) => sum + r.usage.inputTokens, 0);
    const outputTokens = records.reduce((sum, r) => sum + r.usage.outputTokens, 0);
    const totalCostUSD = records.reduce((sum, r) => sum + r.costUSD, 0);

    // Tier breakdown
    const tierBreakdown: Record<string, { tokens: number; costUSD: number }> = {};
    for (const record of records) {
      if (!tierBreakdown[record.tier]) {
        tierBreakdown[record.tier] = { tokens: 0, costUSD: 0 };
      }
      tierBreakdown[record.tier].tokens += record.usage.totalTokens;
      tierBreakdown[record.tier].costUSD += record.costUSD;
    }

    // Top users
    const userUsage: Record<string, { tokens: number; costUSD: number }> = {};
    for (const record of records) {
      if (!userUsage[record.userId]) {
        userUsage[record.userId] = { tokens: 0, costUSD: 0 };
      }
      userUsage[record.userId].tokens += record.usage.totalTokens;
      userUsage[record.userId].costUSD += record.costUSD;
    }

    const topUsers = Object.entries(userUsage)
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.costUSD - a.costUSD)
      .slice(0, 10);

    // Calculate alert level
    const budgetLimit =
      period === 'day' ? this.budgetConfig.dailyLimitUSD : this.budgetConfig.monthlyLimitUSD;
    const budgetUsedPercent = budgetLimit > 0 ? totalCostUSD / budgetLimit : 0;

    let alertLevel: 'normal' | 'warning' | 'critical' = 'normal';
    if (budgetUsedPercent >= 0.9) {
      alertLevel = 'critical';
    } else if (budgetUsedPercent >= 0.75) {
      alertLevel = 'warning';
    }

    return {
      timestamp: new Date().toISOString(),
      period,
      totalTokens,
      inputTokens,
      outputTokens,
      totalCostUSD: Math.round(totalCostUSD * 100) / 100,
      tierBreakdown,
      topUsers,
      alertLevel,
      budgetUsedPercent: Math.round(budgetUsedPercent * 100) / 100,
    };
  }

  /**
   * Get user's usage for the current period
   */
  getUserUsage(
    userId: string,
    period: 'day' | 'month' = 'day'
  ): {
    tokens: number;
    costUSD: number;
    limitUSD: number;
    usedPercent: number;
  } {
    const cutoff = this.getCutoffTime(period);
    const records = this.usageRecords.filter((r) => r.userId === userId && r.timestamp >= cutoff);

    const tokens = records.reduce((sum, r) => sum + r.usage.totalTokens, 0);
    const costUSD = records.reduce((sum, r) => sum + r.costUSD, 0);
    const limitUSD = this.budgetConfig.perUserLimitUSD;

    return {
      tokens,
      costUSD: Math.round(costUSD * 100) / 100,
      limitUSD,
      usedPercent: limitUSD > 0 ? Math.round((costUSD / limitUSD) * 100) : 0,
    };
  }

  /**
   * Update budget configuration
   */
  setBudgetConfig(config: Partial<BudgetConfig>): void {
    this.budgetConfig = { ...this.budgetConfig, ...config };
  }

  /**
   * Get budget configuration
   */
  getBudgetConfig(): BudgetConfig {
    return { ...this.budgetConfig };
  }

  /**
   * Get health check result for L6 integration
   */
  getHealthCheck(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    message: string;
    details: Record<string, unknown>;
  } {
    const dailyMetrics = this.getMetrics('day');

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (dailyMetrics.alertLevel === 'critical') {
      status = 'unhealthy';
    } else if (dailyMetrics.alertLevel === 'warning') {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      message:
        status === 'healthy'
          ? 'AI cost metrics are within budget'
          : `Budget alert: ${Math.round(dailyMetrics.budgetUsedPercent * 100)}% of daily limit used`,
      details: {
        dailyCostUSD: dailyMetrics.totalCostUSD,
        dailyTokens: dailyMetrics.totalTokens,
        budgetUsedPercent: dailyMetrics.budgetUsedPercent,
        tierBreakdown: dailyMetrics.tierBreakdown,
        alertLevel: dailyMetrics.alertLevel,
      },
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private calculateCost(model: string, usage: TokenUsage): number {
    const pricing = PRICING[model] || PRICING['default'];
    const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
    const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
    return inputCost + outputCost;
  }

  private getCutoffTime(period: CostMetrics['period']): number {
    const now = Date.now();
    switch (period) {
      case 'hour':
        return now - 60 * 60 * 1000;
      case 'day':
        return now - 24 * 60 * 60 * 1000;
      case 'week':
        return now - 7 * 24 * 60 * 60 * 1000;
      case 'month':
        return now - 30 * 24 * 60 * 60 * 1000;
      default:
        return now - 24 * 60 * 60 * 1000;
    }
  }

  private checkBudgetAlerts(organizationId: string): void {
    const metrics = this.getMetrics('day', organizationId);

    for (const threshold of this.budgetConfig.alertThresholds) {
      if (metrics.budgetUsedPercent >= threshold) {
        logger.warn(
          `[Cost Monitoring] Budget alert: ${Math.round(metrics.budgetUsedPercent * 100)}% of daily limit used for org ${organizationId}`
        );
        break;
      }
    }
  }

  private pruneOldRecords(): void {
    const cutoff = Date.now() - this.RETENTION_MS;
    this.usageRecords = this.usageRecords.filter((r) => r.timestamp >= cutoff);

    if (this.usageRecords.length > this.MAX_RECORDS) {
      this.usageRecords = this.usageRecords.slice(-this.MAX_RECORDS);
    }
  }

  private getEmptyMetrics(period: CostMetrics['period']): CostMetrics {
    return {
      timestamp: new Date().toISOString(),
      period,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalCostUSD: 0,
      tierBreakdown: {},
      topUsers: [],
      alertLevel: 'normal',
      budgetUsedPercent: 0,
    };
  }
}

// Export singleton instance
export const aiCostMonitoring = new AICostMonitoringService();

// Export class for testing
export { AICostMonitoringService };
