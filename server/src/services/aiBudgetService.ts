/**
 * AI Budget Service
 * Manages AI spending budgets, alerts, and model permissions.
 * Uses ai_budgets, ai_spending_alerts, ai_model_permissions tables.
 */

import { randomUUID } from 'crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TABLE DEFINITIONS (ensured on first use)
// ==========================================

const BUDGETS_DDL = `CREATE TABLE IF NOT EXISTS ai_budgets (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT,
  budget_type TEXT NOT NULL DEFAULT 'cost',
  period TEXT NOT NULL DEFAULT 'monthly',
  period_start TEXT,
  period_end TEXT,
  budget_limit REAL NOT NULL,
  warning_threshold REAL DEFAULT 0.8,
  hard_limit INTEGER DEFAULT 1,
  current_usage REAL DEFAULT 0,
  current_month_usage REAL DEFAULT 0,
  last_reset_at TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  exceeded_at TEXT,
  rollover_enabled INTEGER DEFAULT 0,
  rollover_percentage REAL DEFAULT 0,
  rollover_amount REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  created_by TEXT
)`;

const ALERTS_DDL = `CREATE TABLE IF NOT EXISTS ai_spending_alerts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT,
  budget_id TEXT,
  alert_type TEXT NOT NULL DEFAULT 'warning',
  title TEXT NOT NULL,
  message TEXT,
  threshold_value REAL,
  current_value REAL,
  percentage REAL,
  status TEXT DEFAULT 'active',
  acknowledged_at TEXT,
  acknowledged_by TEXT,
  notification_sent INTEGER DEFAULT 0,
  notification_channels TEXT DEFAULT '["email"]',
  created_at TEXT DEFAULT (datetime('now'))
)`;

const MODEL_PERMS_DDL = `CREATE TABLE IF NOT EXISTS ai_model_permissions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  scope_type TEXT NOT NULL DEFAULT 'organization',
  scope_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  model_provider TEXT NOT NULL,
  is_allowed BOOLEAN DEFAULT TRUE,
  max_tokens_per_request INTEGER,
  daily_token_limit INTEGER,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  created_by TEXT
)`;

let tablesEnsured = false;

async function ensureTables(): Promise<void> {
  if (tablesEnsured) return;
  await dbRun(BUDGETS_DDL, []);
  await dbRun(ALERTS_DDL, []);
  await dbRun(MODEL_PERMS_DDL, []);
  tablesEnsured = true;
}

// ==========================================
// ROW MAPPERS
// ==========================================

type Row = Record<string, unknown>;

function budgetRowToDto(row: Row) {
  const wt = row.warning_threshold as number;
  const isActiveRaw: any = (row as any).is_active;
  const hardLimitRaw: any = (row as any).hard_limit;
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    userId: (row.user_id as string) ?? null,
    userEmail: null,
    budgetType: (row.budget_type as string) ?? 'cost',
    period: (row.period as string) ?? 'monthly',
    budgetLimit: (row.budget_limit as number) ?? 0,
    currentUsage: (row.current_usage as number) ?? 0,
    warningThreshold: typeof wt === 'number' && wt > 1 ? wt / 100 : (wt ?? 0.8),
    hardLimit: hardLimitRaw === true || hardLimitRaw === 1 || hardLimitRaw === 't',
    isActive: isActiveRaw === true || isActiveRaw === 1 || isActiveRaw === 't',
    createdAt: (row.created_at as string) ?? '',
  };
}

function alertRowToDto(row: Row) {
  return {
    id: row.id as string,
    alertType: (row.alert_type as string) ?? 'warning',
    title: (row.title as string) ?? '',
    message: (row.message as string) ?? '',
    status: (row.status as string) ?? 'active',
    currentValue: (row.current_value as number) ?? 0,
    thresholdValue: (row.threshold_value as number) ?? 0,
    percentage: (row.percentage as number) ?? 0,
    createdAt: (row.created_at as string) ?? '',
  };
}

function modelPermRowToDto(row: Row) {
  const isAllowedRaw: any = (row as any).is_allowed;
  return {
    id: row.id as string,
    scopeType: (row.scope_type as string) ?? 'organization',
    scopeId: (row.scope_id as string) ?? '',
    modelId: (row.model_id as string) ?? '',
    modelProvider: (row.model_provider as string) ?? '',
    isAllowed: isAllowedRaw === true || isAllowedRaw === 1 || isAllowedRaw === 't',
    maxTokensPerRequest: (row.max_tokens_per_request as number) ?? null,
    dailyTokenLimit: (row.daily_token_limit as number) ?? null,
  };
}

// ==========================================
// MODEL COSTS (static reference data)
// ==========================================

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  'claude-3.5-sonnet': { input: 0.003, output: 0.015 },
  'gemini-pro': { input: 0.00025, output: 0.0005 },
  'gemini-pro-vision': { input: 0.00025, output: 0.0005 },
};

// ==========================================
// SERVICE IMPLEMENTATION
// ==========================================

const aiBudgetService = {
  // ------ BUDGETS ------

  async getOrganizationBudgets(organizationId: string, includeUserBudgets = true) {
    await ensureTables();
    let sql = 'SELECT * FROM ai_budgets WHERE organization_id = ?';
    const params: unknown[] = [organizationId];
    if (!includeUserBudgets) {
      sql += " AND (user_id IS NULL OR user_id = '')";
    }
    sql += ' ORDER BY created_at DESC';
    const rows = await dbAll<Row>(sql, params);
    return rows.map(budgetRowToDto);
  },

  async createBudget(
    organizationId: string,
    data: {
      userId?: string;
      budgetType: string;
      period: string;
      budgetLimit: number;
      warningThreshold?: number;
      hardLimit?: number | boolean;
      periodStart?: string;
      periodEnd?: string;
      rolloverEnabled?: boolean;
      rolloverPercentage?: number;
      createdBy: string;
    }
  ) {
    await ensureTables();
    const id = randomUUID();
    const now = new Date().toISOString();
    const wt = data.warningThreshold ?? 0.8;
    const wtStored = wt > 1 ? wt / 100 : wt;
    const hardLimitVal = data.hardLimit ? 1 : 0;

    await dbRun(
      `INSERT INTO ai_budgets
        (id, organization_id, user_id, budget_type, period, period_start, period_end,
         budget_limit, warning_threshold, hard_limit, current_usage, is_active,
         rollover_enabled, rollover_percentage, created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, true, ?, ?, ?, ?, ?)`,
      [
        id,
        organizationId,
        data.userId ?? null,
        data.budgetType,
        data.period,
        data.periodStart ?? null,
        data.periodEnd ?? null,
        data.budgetLimit,
        wtStored,
        hardLimitVal,
        data.rolloverEnabled ? 1 : 0,
        data.rolloverPercentage ?? 0,
        now,
        now,
        data.createdBy,
      ]
    );

    const row = await dbGet<Row>('SELECT * FROM ai_budgets WHERE id = ?', [id]);
    return row ? budgetRowToDto(row) : { id };
  },

  async getBudget(id: string) {
    await ensureTables();
    const row = await dbGet<Row>('SELECT * FROM ai_budgets WHERE id = ?', [id]);
    return row ? budgetRowToDto(row) : null;
  },

  async updateBudget(id: string, data: Record<string, unknown>) {
    await ensureTables();
    const existing = await dbGet<Row>('SELECT * FROM ai_budgets WHERE id = ?', [id]);
    if (!existing) return { updated: false };

    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.budgetType !== undefined) {
      updates.push('budget_type = ?');
      params.push(data.budgetType);
    }
    if (data.period !== undefined) {
      updates.push('period = ?');
      params.push(data.period);
    }
    if (data.budgetLimit !== undefined) {
      updates.push('budget_limit = ?');
      params.push(data.budgetLimit);
    }
    if (data.currentUsage !== undefined) {
      updates.push('current_usage = ?');
      params.push(data.currentUsage);
    }
    if (data.warningThreshold !== undefined) {
      const wt = data.warningThreshold as number;
      updates.push('warning_threshold = ?');
      params.push(wt > 1 ? wt / 100 : wt);
    }
    if (data.hardLimit !== undefined) {
      updates.push('hard_limit = ?');
      params.push(data.hardLimit ? 1 : 0);
    }
    if (data.isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(data.isActive ? true : false);
    }

    if (updates.length === 0) return { updated: true };

    updates.push('updated_at = ?');
    params.push(new Date().toISOString(), id);

    await dbRun(`UPDATE ai_budgets SET ${updates.join(', ')} WHERE id = ?`, params);
    return { updated: true };
  },

  async deleteBudget(id: string) {
    await ensureTables();
    const existing = await dbGet<Row>('SELECT * FROM ai_budgets WHERE id = ?', [id]);
    if (!existing) return { deleted: false };
    const result = await dbRun('DELETE FROM ai_budgets WHERE id = ?', [id]);
    return { deleted: (result as { changes?: number })?.changes !== 0 };
  },

  async resetBudgetUsage(id: string) {
    await ensureTables();
    const existing = await dbGet<Row>('SELECT * FROM ai_budgets WHERE id = ?', [id]);
    if (!existing) return { reset: false };
    await dbRun(
      'UPDATE ai_budgets SET current_usage = 0, last_reset_at = ?, updated_at = ? WHERE id = ?',
      [new Date().toISOString(), new Date().toISOString(), id]
    );
    return { reset: true };
  },

  // ------ USAGE & CHECKING ------

  async checkBudget(
    organizationId: string,
    userId: string,
    usage: { tokens: number; cost: number }
  ) {
    await ensureTables();
    const budgets = await dbAll<Row>(
      'SELECT * FROM ai_budgets WHERE organization_id = ? AND is_active = true',
      [organizationId]
    );

    let allowed = true;
    const warnings: string[] = [];

    for (const b of budgets) {
      const limit = (b.budget_limit as number) ?? 0;
      const current = (b.current_usage as number) ?? 0;
      const wt = (b.warning_threshold as number) ?? 0.8;
      const threshold = wt > 1 ? wt / 100 : wt;
      const hardLimit = !!(b.hard_limit as number);
      const budgetType = b.budget_type as string;

      const isUserBudget = b.user_id && b.user_id === userId;
      const isOrgBudget = !b.user_id;
      if (!isUserBudget && !isOrgBudget) continue;

      const addedUsage = budgetType === 'cost' ? usage.cost : usage.tokens;
      const projected = current + addedUsage;
      const pct = limit > 0 ? projected / limit : 0;

      if (pct >= 1 && hardLimit) {
        allowed = false;
        warnings.push(`${budgetType} budget exceeded`);
      } else if (pct >= threshold) {
        warnings.push(`${budgetType} budget at ${(pct * 100).toFixed(0)}%`);
      }
    }

    return { allowed, warnings, budgetsChecked: budgets.length };
  },

  async recordUsage(
    organizationId: string,
    userId: string,
    data: {
      model?: string;
      inputTokens?: number;
      outputTokens?: number;
      requestCount?: number;
    }
  ) {
    await ensureTables();
    const costs = MODEL_COSTS[data.model ?? ''] ?? { input: 0.001, output: 0.002 };
    const cost =
      ((data.inputTokens ?? 0) / 1000) * costs.input +
      ((data.outputTokens ?? 0) / 1000) * costs.output;
    const tokens = (data.inputTokens ?? 0) + (data.outputTokens ?? 0);

    const budgets = await dbAll<Row>(
      `SELECT * FROM ai_budgets WHERE organization_id = ? AND is_active = true
       AND (user_id IS NULL OR user_id = '' OR user_id = ?)`,
      [organizationId, userId]
    );

    for (const b of budgets) {
      const budgetType = b.budget_type as string;
      const addedUsage =
        budgetType === 'cost' ? cost : budgetType === 'tokens' ? tokens : (data.requestCount ?? 1);
      await dbRun(
        'UPDATE ai_budgets SET current_usage = current_usage + ?, updated_at = ? WHERE id = ?',
        [addedUsage, new Date().toISOString(), b.id]
      );
    }

    return { recorded: true, cost, tokens };
  },

  async getUsageStats(
    organizationId: string,
    _options: { startDate?: string; endDate?: string; groupBy?: string }
  ) {
    await ensureTables();
    const rows = await dbAll<Row>(
      'SELECT * FROM ai_budgets WHERE organization_id = ? AND is_active = true',
      [organizationId]
    );

    const alertRows = await dbAll<Row>(
      "SELECT COUNT(*) as cnt FROM ai_spending_alerts WHERE organization_id = ? AND status = 'active'",
      [organizationId]
    );
    const alertCount = (alertRows[0]?.cnt as number) ?? 0;

    const budgets = rows.map((r) => {
      const limit = (r.budget_limit as number) ?? 0;
      const current = (r.current_usage as number) ?? 0;
      return {
        id: r.id as string,
        type: (r.budget_type as string) ?? 'cost',
        period: (r.period as string) ?? 'monthly',
        limit,
        current,
        remaining: Math.max(0, limit - current),
        percentUsed: limit > 0 ? (current / limit) * 100 : 0,
      };
    });

    return { budgets, alertCount };
  },

  // ------ ALERTS ------

  async getAlerts(
    organizationId: string,
    options: { status?: string; alertType?: string; limit?: number; offset?: number }
  ) {
    await ensureTables();
    let sql = 'SELECT * FROM ai_spending_alerts WHERE organization_id = ?';
    const params: unknown[] = [organizationId];

    if (options.status) {
      sql += ' AND status = ?';
      params.push(options.status);
    }
    if (options.alertType) {
      sql += ' AND alert_type = ?';
      params.push(options.alertType);
    }
    sql += ' ORDER BY created_at DESC';
    sql += ` LIMIT ? OFFSET ?`;
    params.push(options.limit ?? 100, options.offset ?? 0);

    const rows = await dbAll<Row>(sql, params);
    return rows.map(alertRowToDto);
  },

  async acknowledgeAlert(id: string, userId: string) {
    await ensureTables();
    const existing = await dbGet<Row>('SELECT * FROM ai_spending_alerts WHERE id = ?', [id]);
    if (!existing) return { acknowledged: false };
    await dbRun(
      "UPDATE ai_spending_alerts SET status = 'acknowledged', acknowledged_at = ?, acknowledged_by = ? WHERE id = ?",
      [new Date().toISOString(), userId, id]
    );
    return { acknowledged: true };
  },

  async dismissAlert(id: string) {
    await ensureTables();
    const existing = await dbGet<Row>('SELECT * FROM ai_spending_alerts WHERE id = ?', [id]);
    if (!existing) return { dismissed: false };
    await dbRun("UPDATE ai_spending_alerts SET status = 'dismissed' WHERE id = ?", [id]);
    return { dismissed: true };
  },

  // ------ MODEL PERMISSIONS ------

  async getModelPermissions(organizationId: string, scopeType?: string, scopeId?: string) {
    await ensureTables();
    let sql = 'SELECT * FROM ai_model_permissions WHERE organization_id = ? AND is_active = true';
    const params: unknown[] = [organizationId];

    if (scopeType) {
      sql += ' AND scope_type = ?';
      params.push(scopeType);
    }
    if (scopeId) {
      sql += ' AND scope_id = ?';
      params.push(scopeId);
    }
    sql += ' ORDER BY priority DESC, created_at DESC';

    const rows = await dbAll<Row>(sql, params);
    return rows.map(modelPermRowToDto);
  },

  async setModelPermission(
    organizationId: string,
    data: {
      scopeType: string;
      scopeId: string;
      modelId: string;
      modelProvider: string;
      isAllowed?: boolean;
      maxTokensPerRequest?: number;
      dailyTokenLimit?: number;
      priority?: number;
      createdBy: string;
    }
  ) {
    await ensureTables();
    const id = randomUUID();
    const now = new Date().toISOString();

    await dbRun(
      `INSERT INTO ai_model_permissions
        (id, organization_id, scope_type, scope_id, model_id, model_provider,
         is_allowed, max_tokens_per_request, daily_token_limit, priority,
         is_active, created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true, ?, ?, ?)`,
      [
        id,
        organizationId,
        data.scopeType,
        data.scopeId,
        data.modelId,
        data.modelProvider,
        data.isAllowed !== false ? true : false,
        data.maxTokensPerRequest ?? null,
        data.dailyTokenLimit ?? null,
        data.priority ?? 0,
        now,
        now,
        data.createdBy,
      ]
    );

    const row = await dbGet<Row>('SELECT * FROM ai_model_permissions WHERE id = ?', [id]);
    return row ? modelPermRowToDto(row) : { id };
  },

  async checkModelAccess(
    organizationId: string,
    userId: string,
    userRole: string,
    modelId: string
  ) {
    await ensureTables();
    const permissions = await dbAll<Row>(
      `SELECT * FROM ai_model_permissions
       WHERE organization_id = ? AND model_id = ? AND is_active = true
       ORDER BY priority DESC`,
      [organizationId, modelId]
    );

    if (permissions.length === 0) {
      return { allowed: true, reason: 'no restrictions configured' };
    }

    for (const p of permissions) {
      const scopeType = p.scope_type as string;
      const scopeId = p.scope_id as string;
      const isAllowedRaw: any = (p as any).is_allowed;
      const isAllowed = isAllowedRaw === true || isAllowedRaw === 1 || isAllowedRaw === 't';

      let matches = false;
      if (scopeType === 'organization') matches = true;
      else if (scopeType === 'role') matches = scopeId === userRole;
      else if (scopeType === 'user') matches = scopeId === userId;

      if (matches) {
        return {
          allowed: isAllowed,
          maxTokensPerRequest: (p.max_tokens_per_request as number) ?? null,
          dailyTokenLimit: (p.daily_token_limit as number) ?? null,
          reason: isAllowed ? 'allowed by policy' : 'blocked by policy',
        };
      }
    }

    return { allowed: true, reason: 'no matching restriction' };
  },

  async deleteModelPermission(id: string) {
    await ensureTables();
    const existing = await dbGet<Row>('SELECT * FROM ai_model_permissions WHERE id = ?', [id]);
    if (!existing) return { deleted: false };
    await dbRun('DELETE FROM ai_model_permissions WHERE id = ?', [id]);
    return { deleted: true };
  },

  // ------ MODEL COSTS ------

  getModelCosts() {
    return MODEL_COSTS;
  },

  estimateCost(model: string, inputTokens: number, outputTokens: number) {
    const c = MODEL_COSTS[model] ?? { input: 0.001, output: 0.002 };
    return (inputTokens / 1000) * c.input + (outputTokens / 1000) * c.output;
  },
};

export default aiBudgetService;
