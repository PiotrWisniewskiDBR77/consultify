/**
 * Usage Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Migrated from server/services/usageService.js (CommonJS) to TypeScript (ES Modules)
 * Handles token and storage usage tracking, quota enforcement, and overage calculation
 */

import { v4 as uuidv4Default } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

interface UsageRecordResult {
  id: string;
  tokens?: number;
  bytes?: number;
}

interface CurrentUsageResult {
  tokens: {
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
  };
  storage: {
    used: number;
    limit: number;
    remaining: number;
    usedGB: number;
    limitGB: number;
    percentage: number;
  };
  plan: string;
  periodStart: Date;
  periodEnd?: Date | null;
}

interface QuotaCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  overageEnabled: boolean;
  overageRate?: number;
}

interface OverageCalculationResult {
  tokensUsed: number;
  tokenLimit: number;
  tokenOverageAmount: number;
  tokenOverage: number;
  storagePeakGB: number;
  storageLimit: number;
  storageOverageGB: number;
  storageOverage: number;
  totalOverage: number;
}

interface UsageSummary {
  id: string;
  organization_id: string;
  period_start: string;
  period_end: string;
  tokens_used: number;
  tokens_included: number;
  tokens_overage: number;
  storage_bytes_peak: number;
  storage_gb_included: number;
  storage_gb_overage: number;
  overage_amount: number;
}

interface GlobalUsageStats {
  totalTokensThisMonth: number;
  totalStorageBytes: number;
  totalStorageGB: number;
  activeOrganizations: number;
  periodStart: Date;
}

interface ProjectQuotaResult {
  allowed: boolean;
  remaining: number;
  limit: number | null;
  used: number;
  percentage: number;
}

interface OperationalCostItem {
  provider: string;
  model: string;
  totalTokens: number;
  cost: number;
}

interface OperationalCostsResult {
  period: {
    start: Date;
    end: Date;
  };
  items: OperationalCostItem[];
  totalCost: number;
}

interface UsageRecordRow {
  tokens_used?: number;
  storage_bytes?: number;
}

interface OverageRow {
  tokens_used?: number;
  storage_peak?: number;
}

interface GlobalStatsRow {
  total_tokens?: number;
  total_storage?: number;
  active_orgs?: number;
}

interface ProjectRow {
  storage_limit_gb?: number | null;
  storage_used_bytes?: number | null;
}

interface LLMProviderRow {
  provider: string;
  model_id: string;
  cost_per_1k?: number;
}

interface UsageRecordMetadataRow {
  metadata?: string;
  total_tokens?: number;
}

// ==========================================
// SERVICE
// ==========================================

let db: IDatabase = getDatabase();
let uuidv4: () => string = uuidv4Default;

// Lazy-loaded dependencies
let billingService: any;
let payAsYouGoService: any;
let budgetManagementService: any;

async function initDeps(): Promise<void> {
  if (!billingService) {
    const billingModule = (await import('./BillingService.js')) as any;
    billingService = billingModule.default || billingModule;
  }
  if (!payAsYouGoService) {
    const payAsYouGoModule = await import('./payAsYouGoService.js');
    payAsYouGoService = payAsYouGoModule.default || payAsYouGoModule;
  }
  if (!budgetManagementService) {
    const budgetManagementModule = await import('./budgetManagementService.js');
    budgetManagementService = budgetManagementModule.default || budgetManagementModule;
  }
}

/**
 * Set dependencies for testing
 *
 * NOTE: billingService/payAsYouGoService/budgetManagementService are normally
 * populated lazily by initDeps() via dynamic import() of the real modules —
 * each of those modules holds its OWN module-level `db` set at ITS import
 * time, independent of this service's `db`. Injecting a mock db here does
 * NOT reach into them. Passing a mock service here directly (as tests do)
 * pre-fills the module-level var so initDeps()'s `if (!x)` guard skips the
 * real import and the mock is used instead — this is the intended escape
 * hatch, not a workaround.
 */
export function setDependencies(
  newDeps: {
    db?: IDatabase;
    uuidv4?: () => string;
    billingService?: any;
    payAsYouGoService?: any;
    budgetManagementService?: any;
  } = {}
): void {
  if (newDeps.db) {
    db = newDeps.db;
  }
  if (newDeps.uuidv4) {
    uuidv4 = newDeps.uuidv4;
  }
  if (newDeps.billingService) {
    billingService = newDeps.billingService;
  }
  if (newDeps.payAsYouGoService) {
    payAsYouGoService = newDeps.payAsYouGoService;
  }
  if (newDeps.budgetManagementService) {
    budgetManagementService = newDeps.budgetManagementService;
  }
}

/**
 * Record token usage
 */
export async function recordTokenUsage(
  orgId: string,
  userId: string,
  tokens: number,
  action: string,
  metadata: Record<string, unknown> = {}
): Promise<UsageRecordResult> {
  await initDeps();

  // Check budget limits before recording usage
  try {
    const budgetCheck = await budgetManagementService.checkBudgetLimit(
      orgId,
      userId,
      null,
      'tokens',
      tokens
    );
    if (!budgetCheck.allowed && budgetCheck.reason === 'Budget limit exceeded') {
      throw new Error(`Budget limit exceeded: ${budgetCheck.usagePercent}% used`);
    }
  } catch (budgetErr) {
    // Log but don't block if budget check fails
    const error = budgetErr as Error;
    logger.warn('[UsageService] Budget check failed:', error.message);
  }

  // fallback: false — this write is the billing/usage record of record. With
  // the default fallback:true, a real insert failure was silently swallowed
  // (DbPromise.run() resolves { success: false } instead of throwing) and
  // this function returned as if the usage had been recorded, undercounting
  // billed usage with no error surfaced to the caller.
  const id = `usage-${uuidv4()}`;
  await DbPromise.run(
    db,
    `INSERT INTO usage_records (id, organization_id, user_id, type, amount, action, metadata)
         VALUES (?, ?, ?, 'token', ?, ?, ?)`,
    [id, orgId, userId, tokens, action, JSON.stringify(metadata)],
    { fallback: false }
  );

  // Record PAYG usage if billing model is PAYG
  try {
    const billingModel = await billingService.getBillingModel(orgId);
    if (billingModel.billingModel === 'pay_as_you_go' || billingModel.billingModel === 'hybrid') {
      const costCalc = await payAsYouGoService.calculateUsageCost(orgId, 'tokens', tokens);
      if (costCalc.cost > 0) {
        await payAsYouGoService.recordUsage(
          orgId,
          'tokens',
          tokens,
          costCalc.unitPrice,
          metadata,
          userId,
          null
        );
      }
    }
  } catch (paygErr) {
    const error = paygErr as Error;
    logger.warn('[UsageService] PAYG recording failed:', error.message);
  }

  // GAP-AI-001: Check usage thresholds and send alerts
  try {
    await checkAndSendUsageAlert(orgId, 'token');
  } catch (alertErr) {
    logger.warn('[UsageService] Usage alert check failed:', alertErr);
  }

  return { id, tokens };
}

/**
 * Record storage usage
 */
export async function recordStorageUsage(
  orgId: string,
  bytes: number,
  action: string,
  metadata: Record<string, unknown> = {}
): Promise<UsageRecordResult> {
  await initDeps();
  const gb = bytes / (1024 * 1024 * 1024);

  // Check budget limits before recording usage
  try {
    const budgetCheck = await budgetManagementService.checkBudgetLimit(
      orgId,
      null,
      null,
      'storage',
      gb
    );
    if (!budgetCheck.allowed && budgetCheck.reason === 'Budget limit exceeded') {
      throw new Error(`Budget limit exceeded: ${budgetCheck.usagePercent}% used`);
    }
  } catch (budgetErr) {
    const error = budgetErr as Error;
    logger.warn('[UsageService] Budget check failed:', error.message);
  }

  // fallback: false — see recordTokenUsage() above for why this must not be
  // silently swallowed.
  const id = `usage-${uuidv4()}`;
  await DbPromise.run(
    db,
    `INSERT INTO usage_records (id, organization_id, user_id, type, amount, action, metadata)
         VALUES (?, ?, NULL, 'storage', ?, ?, ?)`,
    [id, orgId, bytes, action, JSON.stringify(metadata)],
    { fallback: false }
  );

  // Record PAYG usage if billing model is PAYG
  try {
    const billingModel = await billingService.getBillingModel(orgId);
    if (billingModel.billingModel === 'pay_as_you_go' || billingModel.billingModel === 'hybrid') {
      const costCalc = await payAsYouGoService.calculateUsageCost(orgId, 'storage', gb);
      if (costCalc.cost > 0) {
        await payAsYouGoService.recordUsage(
          orgId,
          'storage',
          gb,
          costCalc.unitPrice,
          metadata,
          null,
          null
        );
      }
    }
  } catch (paygErr) {
    const error = paygErr as Error;
    logger.warn('[UsageService] PAYG recording failed:', error.message);
  }

  return { id, bytes };
}

/**
 * Get current period usage for an organization
 */
export async function getCurrentUsage(orgId: string): Promise<CurrentUsageResult> {
  await initDeps();
  const billing = await billingService.getOrganizationBilling(orgId);
  const plan = billing?.subscription_plan_id
    ? await billingService.getPlanById(billing.subscription_plan_id)
    : null;

  // Default period: current month
  const now = new Date();
  const periodStart = billing?.current_period_start
    ? new Date(billing.current_period_start)
    : new Date(now.getFullYear(), now.getMonth(), 1);

  const row = await DbPromise.get<UsageRecordRow>(
    db,
    `SELECT 
            COALESCE(SUM(CASE WHEN type = 'token' AND recorded_at >= ? THEN amount ELSE 0 END), 0) as tokens_used,
            COALESCE(SUM(CASE WHEN type = 'storage' THEN amount ELSE 0 END), 0) as storage_bytes
         FROM usage_records
         WHERE organization_id = ?`,
    [periodStart.toISOString(), orgId]
  );

  const tokenLimit = plan?.token_limit || 0;
  const storageLimit = (plan?.storage_limit_gb || 0) * 1024 * 1024 * 1024; // Convert GB to bytes

  // Ensure storage never goes below 0 (in case of data anomalies)
  const storageUsed = Math.max(0, row?.storage_bytes || 0);

  return {
    tokens: {
      used: row?.tokens_used || 0,
      limit: tokenLimit,
      remaining: Math.max(0, tokenLimit - (row?.tokens_used || 0)),
      percentage: tokenLimit > 0 ? Math.round(((row?.tokens_used || 0) / tokenLimit) * 100) : 0,
    },
    storage: {
      used: storageUsed,
      limit: storageLimit,
      remaining: Math.max(0, storageLimit - storageUsed),
      usedGB: storageUsed / (1024 * 1024 * 1024),
      limitGB: plan?.storage_limit_gb || 0,
      percentage: storageLimit > 0 ? Math.round((storageUsed / storageLimit) * 100) : 0,
    },
    plan: plan?.name || 'Free',
    periodStart,
    periodEnd: billing?.current_period_end ? new Date(billing.current_period_end) : null,
  };
}

/**
 * Check if organization has quota for a specific action
 */
export async function checkQuota(
  orgId: string,
  type: 'token' | 'storage' = 'token'
): Promise<QuotaCheckResult> {
  await initDeps();
  const usage = await getCurrentUsage(orgId);
  const billing = await billingService.getOrganizationBilling(orgId);
  const plan = billing?.subscription_plan_id
    ? await billingService.getPlanById(billing.subscription_plan_id)
    : null;

  const quotaData = type === 'token' ? usage.tokens : usage.storage;

  // Pay-as-you-go or plans with overage: always allow but track
  const overageEnabled = plan?.token_overage_rate > 0 || plan?.storage_overage_rate > 0;

  // If no limit set (unlimited) or overage enabled
  const allowed = quotaData.limit === 0 || quotaData.remaining > 0 || overageEnabled;

  return {
    allowed,
    used: quotaData.used,
    limit: quotaData.limit,
    remaining: quotaData.remaining,
    percentage: quotaData.percentage,
    overageEnabled,
    overageRate: type === 'token' ? plan?.token_overage_rate : plan?.storage_overage_rate,
  };
}

/**
 * Calculate overage charges for a billing period
 */
export async function calculateOverage(
  orgId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<OverageCalculationResult> {
  await initDeps();
  const billing = await billingService.getOrganizationBilling(orgId);
  const plan = billing?.subscription_plan_id
    ? await billingService.getPlanById(billing.subscription_plan_id)
    : null;

  if (!plan) {
    return {
      tokensUsed: 0,
      tokenLimit: 0,
      tokenOverageAmount: 0,
      tokenOverage: 0,
      storagePeakGB: 0,
      storageLimit: 0,
      storageOverageGB: 0,
      storageOverage: 0,
      totalOverage: 0,
    };
  }

  const row = await DbPromise.get<OverageRow>(
    db,
    `SELECT 
            COALESCE(SUM(CASE WHEN type = 'token' THEN amount ELSE 0 END), 0) as tokens_used,
            COALESCE(MAX(CASE WHEN type = 'storage' THEN amount ELSE 0 END), 0) as storage_peak
         FROM usage_records
         WHERE organization_id = ? AND recorded_at >= ? AND recorded_at < ?`,
    [orgId, periodStart.toISOString(), periodEnd.toISOString()]
  );

  const tokensUsed = row?.tokens_used || 0;
  const storagePeak = row?.storage_peak || 0;

  const tokenOverageAmount = Math.max(0, tokensUsed - (plan.token_limit || 0));
  const storageOverageGB = Math.max(
    0,
    storagePeak / (1024 * 1024 * 1024) - (plan.storage_limit_gb || 0)
  );

  // Calculate charges (rate is per 1K tokens, per GB storage)
  const tokenOverage = (tokenOverageAmount / 1000) * (plan.token_overage_rate || 0);
  const storageOverage = storageOverageGB * (plan.storage_overage_rate || 0);

  return {
    tokensUsed,
    tokenLimit: plan.token_limit || 0,
    tokenOverageAmount,
    tokenOverage: Math.round(tokenOverage * 100) / 100,
    storagePeakGB: storagePeak / (1024 * 1024 * 1024),
    storageLimit: plan.storage_limit_gb || 0,
    storageOverageGB,
    storageOverage: Math.round(storageOverage * 100) / 100,
    totalOverage: Math.round((tokenOverage + storageOverage) * 100) / 100,
  };
}

/**
 * Create or update monthly usage summary
 */
export async function updateUsageSummary(
  orgId: string,
  periodStart: Date
): Promise<OverageCalculationResult & { id: string }> {
  await initDeps();
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const overage = await calculateOverage(orgId, periodStart, periodEnd);
  const billing = await billingService.getOrganizationBilling(orgId);
  const plan = billing?.subscription_plan_id
    ? await billingService.getPlanById(billing.subscription_plan_id)
    : null;

  const id = `summary-${uuidv4()}`;

  await DbPromise.run(
    db,
    `INSERT INTO usage_summaries (id, organization_id, period_start, period_end, tokens_used, tokens_included, tokens_overage, storage_bytes_peak, storage_gb_included, storage_gb_overage, overage_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(organization_id, period_start) DO UPDATE SET
         tokens_used = excluded.tokens_used,
         tokens_overage = excluded.tokens_overage,
         storage_bytes_peak = excluded.storage_bytes_peak,
         storage_gb_overage = excluded.storage_gb_overage,
         overage_amount = excluded.overage_amount`,
    [
      id,
      orgId,
      periodStart.toISOString(),
      periodEnd.toISOString(),
      overage.tokensUsed,
      plan?.token_limit || 0,
      overage.tokenOverageAmount,
      overage.storagePeakGB * 1024 * 1024 * 1024,
      plan?.storage_limit_gb || 0,
      overage.storageOverageGB,
      overage.totalOverage,
    ]
  );

  return { id, ...overage };
}

/**
 * Get usage history for organization
 */
export async function getUsageHistory(orgId: string, limit: number = 12): Promise<UsageSummary[]> {
  await initDeps();
  const rows = await DbPromise.all<UsageSummary>(
    db,
    `SELECT * FROM usage_summaries 
         WHERE organization_id = ? 
         ORDER BY period_start DESC 
         LIMIT ?`,
    [orgId, limit]
  );

  return rows || [];
}

/**
 * Get global usage statistics (Superadmin)
 */
export async function getGlobalUsageStats(): Promise<GlobalUsageStats> {
  await initDeps();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const row = await DbPromise.get<GlobalStatsRow>(
    db,
    `SELECT 
            COALESCE(SUM(CASE WHEN type = 'token' THEN amount ELSE 0 END), 0) as total_tokens,
            COALESCE(SUM(CASE WHEN type = 'storage' THEN amount ELSE 0 END), 0) as total_storage,
            COUNT(DISTINCT organization_id) as active_orgs
         FROM usage_records
         WHERE recorded_at >= ?`,
    [monthStart.toISOString()]
  );

  return {
    totalTokensThisMonth: row?.total_tokens || 0,
    totalStorageBytes: row?.total_storage || 0,
    totalStorageGB: (row?.total_storage || 0) / (1024 * 1024 * 1024),
    activeOrganizations: row?.active_orgs || 0,
    periodStart: monthStart,
  };
}

/**
 * ★ Limity storage PER PROJEKT nie istnieją w schemacie (2026-07-24).
 *
 * `projects` NIE ma kolumn `storage_limit_gb` / `storage_used_bytes` — ani w
 * `server/migrations/000_initdb_core_tables.sql`, ani w baseline
 * `server/migrations-v2/001_baseline_20260413.sql` (te kolumny żyją wyłącznie na
 * `subscription_plans`, czyli na poziomie ORGANIZACJI). Zapytania poniżej były
 * więc pewnym błędem SQL (42703 undefined_column) na każdym środowisku.
 *
 * Skutek dla użytkownika: `enforceProjectQuota` (middleware POST
 * /api/knowledge/documents) łapał wyjątek, „fail closed" i zwracał 500
 * `Failed to verify project quota` — czerwony błąd we wnętrzu sejfu Vault przy
 * KAŻDYM wgraniu dokumentu na poziomie „Projekt". Limit organizacji
 * (`enforceStorageQuota`) jest sprawdzany osobno, WCZEŚNIEJ w łańcuchu, więc
 * brak limitu projektowego nie otwiera żadnej dziury — to po prostu funkcja,
 * której schemat nie ma.
 *
 * Rozwiązanie: wykryj brak kolumn RAZ (cache) i traktuj to jak „limit nie
 * skonfigurowany" = unlimited — dokładnie tak, jak kod już traktuje
 * `storage_limit_gb IS NULL`. Gdy kolumny kiedyś powstaną (migracja), kod bez
 * zmiany wraca do liczenia realnego limitu.
 */
let projectStorageColumnsAvailable: boolean | null = null;

const PROJECT_QUOTA_UNLIMITED: ProjectQuotaResult = {
  allowed: true,
  remaining: Infinity,
  limit: null,
  used: 0,
  percentage: 0,
};

/**
 * Record project-level storage usage
 *
 * `DbPromise.run` z domyślnym `fallback: true` NIE rzuca — zwraca
 * `{ success:false, error }`. Brak kolumny wyglądał więc jak cicha porażka
 * zapisu; teraz zapamiętujemy to raz i przestajemy próbować (zero szumu w logach).
 */
export async function recordProjectStorageUsage(
  projectId: string,
  bytes: number,
  _action: string
): Promise<{ projectId: string; bytes: number }> {
  await initDeps();
  if (projectStorageColumnsAvailable === false) {
    return { projectId, bytes };
  }
  const result = await DbPromise.run(
    db,
    `UPDATE projects SET storage_used_bytes = storage_used_bytes + ? WHERE id = ?`,
    [bytes, projectId]
  );
  if (!result?.success) {
    projectStorageColumnsAvailable = false;
    logger.warn(
      '[usage] projects.storage_used_bytes niedostępne — pomijam licznik storage per projekt (limity storage są na poziomie organizacji)',
      { error: result?.error }
    );
  }

  return { projectId, bytes };
}

/**
 * Check if project has storage quota
 */
export async function checkProjectQuota(projectId: string): Promise<ProjectQuotaResult> {
  await initDeps();

  if (projectStorageColumnsAvailable === false) return PROJECT_QUOTA_UNLIMITED;

  // KROK 1 — czy projekt w ogóle istnieje. Zapytanie po samym `id` nie może paść
  // na brakującej kolumnie, więc rozróżnia „nie ma projektu" od „nie ma limitów".
  const exists = await DbPromise.get<{ id: string }>(db, `SELECT id FROM projects WHERE id = ?`, [
    projectId,
  ]);
  if (!exists) {
    throw new Error('Project not found');
  }

  // KROK 2 — limit projektowy. `fallback: false`, żeby błąd SQL był błędem, a nie
  // niemym `null` nieodróżnialnym od „brak wiersza" (to właśnie ta zamiana dawała
  // 500 „Failed to verify project quota" przy uploadzie do sejfu projektowego).
  let row: ProjectRow | null = null;
  try {
    row = await DbPromise.get<ProjectRow>(
      db,
      `SELECT storage_limit_gb, storage_used_bytes FROM projects WHERE id = ?`,
      [projectId],
      { fallback: false }
    );
    projectStorageColumnsAvailable = true;
  } catch (error: unknown) {
    projectStorageColumnsAvailable = false;
    logger.warn(
      '[usage] projects.storage_limit_gb niedostępne — limit storage per projekt nieskonfigurowany, obowiązuje limit organizacji',
      { error: error instanceof Error ? error.message : String(error) }
    );
    return PROJECT_QUOTA_UNLIMITED;
  }

  // If limit is NULL, it means unlimited (or falls back to Org quota which is checked separately)
  if (!row || row.storage_limit_gb === null || row.storage_limit_gb === undefined) {
    return PROJECT_QUOTA_UNLIMITED;
  }

  const limitBytes = (row.storage_limit_gb || 0) * 1024 * 1024 * 1024;
  const usedBytes = row.storage_used_bytes || 0;
  const remaining = Math.max(0, limitBytes - usedBytes);

  return {
    allowed: remaining > 0,
    remaining,
    limit: limitBytes,
    used: usedBytes,
    percentage: limitBytes > 0 ? (usedBytes / limitBytes) * 100 : 0,
  };
}

/**
 * Get operational costs grouped by Provider/Model
 */
export async function getOperationalCosts(
  startDate?: Date,
  endDate?: Date
): Promise<OperationalCostsResult> {
  await initDeps();

  // Default to last 30 days if no dates provided
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate ? new Date(startDate) : new Date(new Date().setDate(end.getDate() - 30));

  const rows = await DbPromise.all<UsageRecordMetadataRow>(
    db,
    `SELECT 
            u.metadata,
            SUM(u.amount) as total_tokens
        FROM usage_records u
        WHERE u.type = 'token' 
        AND u.recorded_at >= ? 
        AND u.recorded_at <= ?
        GROUP BY u.metadata`,
    [start.toISOString(), end.toISOString()]
  );

  // Fetch current provider costs to calculate estimated spend
  const providers = await DbPromise.all<LLMProviderRow>(
    db,
    'SELECT provider, model_id, cost_per_1k FROM llm_providers',
    []
  );

  // Create a lookup map for costs: "provider:model" -> cost
  const costMap: Record<string, number> = {};
  providers.forEach((p) => {
    costMap[`${p.provider}:${p.model_id}`] = p.cost_per_1k || 0;
  });

  const aggregated: Record<string, OperationalCostItem> = {};

  for (const row of rows) {
    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(row.metadata || '{}');
    } catch {
      continue;
    }

    const provider = (meta.llmProvider || 'unknown') as string;
    const model = (meta.modelUsed || 'unknown') as string;
    const key = `${provider}|${model}`;

    if (!aggregated[key]) {
      aggregated[key] = {
        provider,
        model,
        totalTokens: 0,
        cost: 0,
      };
    }

    aggregated[key].totalTokens += row.total_tokens || 0;

    let cleanModelId = model;
    if (model.includes(':')) {
      cleanModelId = model.split(':')[1];
    }

    let costPer1k = 0;

    const matchedProvider = providers.find(
      (p) =>
        (p.provider === provider && p.model_id === cleanModelId) ||
        `${p.provider}:${p.model_id}` === model
    );

    if (matchedProvider) {
      costPer1k = matchedProvider.cost_per_1k || 0;
    }

    aggregated[key].cost += ((row.total_tokens || 0) / 1000) * costPer1k;
  }

  // Convert to array
  const results = Object.values(aggregated).sort((a, b) => b.cost - a.cost);

  return {
    period: { start, end },
    items: results,
    totalCost: results.reduce((sum, item) => sum + item.cost, 0),
  };
}

// ==========================================
// GAP-AI-001: USAGE ALERTS
// ==========================================

interface AlertThresholds {
  token_threshold_80: number;
  token_threshold_90: number;
  token_threshold_100: number;
  storage_threshold_80: number;
  storage_threshold_90: number;
  storage_threshold_100: number;
}

interface AlertSentRecord {
  threshold: number;
  sent_at: string;
}

/**
 * Check usage percentage and send alerts if thresholds crossed
 * GAP-AI-001: Automatic usage alerts at 80%, 90%, 100%
 */
export async function checkAndSendUsageAlert(
  orgId: string,
  type: 'token' | 'storage' = 'token'
): Promise<void> {
  await initDeps();

  // Get current usage
  const usage = await getCurrentUsage(orgId);
  const percentage = type === 'token' ? usage.tokens.percentage : usage.storage.percentage;

  // Get alert thresholds from billing_alerts
  const alertSettings = await DbPromise.get<AlertThresholds>(
    db,
    `SELECT token_threshold_80, token_threshold_90, token_threshold_100,
                storage_threshold_80, storage_threshold_90, storage_threshold_100
         FROM billing_alerts WHERE organization_id = ?`,
    [orgId]
  );

  // Default thresholds if not set
  const thresholds = {
    80:
      type === 'token'
        ? (alertSettings?.token_threshold_80 ?? 1)
        : (alertSettings?.storage_threshold_80 ?? 1),
    90:
      type === 'token'
        ? (alertSettings?.token_threshold_90 ?? 1)
        : (alertSettings?.storage_threshold_90 ?? 1),
    100:
      type === 'token'
        ? (alertSettings?.token_threshold_100 ?? 1)
        : (alertSettings?.storage_threshold_100 ?? 1),
  };

  // Determine which threshold was crossed
  let thresholdCrossed: 80 | 90 | 100 | null = null;
  if (percentage >= 100 && thresholds[100]) {
    thresholdCrossed = 100;
  } else if (percentage >= 90 && thresholds[90]) {
    thresholdCrossed = 90;
  } else if (percentage >= 80 && thresholds[80]) {
    thresholdCrossed = 80;
  }

  if (!thresholdCrossed) return;

  // Check if alert already sent for this threshold in current period
  const alertKey = `usage_alert_${type}_${thresholdCrossed}`;
  const existingAlert = await DbPromise.get<AlertSentRecord>(
    db,
    `SELECT threshold, sent_at FROM usage_alerts_sent 
         WHERE organization_id = ? AND alert_type = ? AND threshold = ?
         AND sent_at > datetime('now', '-1 day')`,
    [orgId, type, thresholdCrossed]
  );

  if (existingAlert) {
    // Already sent alert for this threshold recently
    return;
  }

  // Get admins for this org
  const admins = await DbPromise.all<{ id: string; email: string; first_name: string }>(
    db,
    `SELECT id, email, first_name FROM users
         WHERE organization_id = ? AND role IN ('ADMIN', 'SUPERADMIN')`,
    [orgId]
  );

  if (!admins || admins.length === 0) return;

  // Get org name
  const org = await DbPromise.get<{ name: string }>(
    db,
    `SELECT name FROM organizations WHERE id = ?`,
    [orgId]
  );

  // N2 (DEC-2026-08-25-21): routed through the notification engine instead
  // of a direct EmailService.send() call, so `usage_alert` (registered
  // in_app+email, is_critical in server/migrations/257_notification_system.sql:60)
  // starts respecting per-user preferences instead of unconditionally
  // emailing every admin (notyfikacje-audyt.md §1C). The daily
  // per-org/per-threshold dedup above is unchanged; `dedupe: false` is
  // passed to send() so its own (much shorter) default dedupe window
  // doesn't collapse the per-admin sends in this loop into one.
  try {
    const { send: sendNotification } = await import('./notificationService.js');
    const title = `⚠️ ${type === 'token' ? 'Token' : 'Storage'} Usage Alert: ${thresholdCrossed}% reached`;
    const body = `${org?.name || 'Your organization'} has reached ${thresholdCrossed}% of its ${
      type === 'token' ? 'token' : 'storage'
    } limit (${Math.round(percentage)}% used).`;

    for (const admin of admins) {
      await sendNotification({
        userId: admin.id,
        organizationId: orgId,
        type: 'usage_alert',
        title,
        body,
        priority: thresholdCrossed >= 100 ? 'critical' : thresholdCrossed >= 90 ? 'urgent' : 'high',
        entityType: 'billing',
        dedupe: false,
        data: {
          usageType: type,
          threshold: thresholdCrossed,
          percentage: Math.round(percentage),
          used: type === 'token' ? usage.tokens.used : usage.storage.usedGB,
          limit: type === 'token' ? usage.tokens.limit : usage.storage.limitGB,
          unit: type === 'token' ? 'tokens' : 'GB',
        },
      });
    }

    // Record that alert was sent
    await DbPromise.run(
      db,
      `INSERT INTO usage_alerts_sent (id, organization_id, alert_type, threshold, sent_at)
             VALUES (?, ?, ?, ?, datetime('now'))
             ON CONFLICT(organization_id, alert_type, threshold) 
             DO UPDATE SET sent_at = datetime('now')`,
      [`alert-${uuidv4()}`, orgId, type, thresholdCrossed]
    );

    logger.info(`[UsageService] Usage alert sent: ${orgId} - ${type} at ${thresholdCrossed}%`);
  } catch (emailErr) {
    logger.error('[UsageService] Failed to send usage alert email:', emailErr);
  }
}

/**
 * Generate usage alert email HTML.
 *
 * N2 (DEC-2026-08-25-21): no longer called — checkAndSendUsageAlert() now
 * routes through notificationService.send(), whose email channel renders
 * a generic templated body from title/body (renderEmailNotification) like
 * every other registry-driven type, not this bespoke template. Left in
 * place rather than deleted since removing it is out of this ticket's
 * scope.
 */
function generateUsageAlertEmail(data: {
  firstName: string;
  orgName: string;
  type: 'token' | 'storage';
  percentage: number;
  threshold: number;
  used: number;
  limit: number;
  unit: string;
}): string {
  const severityColor =
    data.threshold >= 100 ? '#dc2626' : data.threshold >= 90 ? '#f59e0b' : '#3b82f6';
  const severityText =
    data.threshold >= 100 ? 'CRITICAL' : data.threshold >= 90 ? 'WARNING' : 'NOTICE';

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${severityColor}; padding: 20px; border-radius: 8px 8px 0 0; }
        .header h1 { color: white; margin: 0; font-size: 20px; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .alert-box { background: white; border-left: 4px solid ${severityColor}; padding: 15px; margin: 20px 0; }
        .progress-bar { background: #e5e7eb; height: 24px; border-radius: 12px; overflow: hidden; margin: 15px 0; }
        .progress-fill { background: ${severityColor}; height: 100%; transition: width 0.3s; }
        .stats { display: flex; justify-content: space-between; margin: 15px 0; }
        .stat { text-align: center; }
        .stat-value { font-size: 24px; font-weight: bold; color: ${severityColor}; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚠️ ${severityText}: ${data.type === 'token' ? 'Token' : 'Storage'} Usage Alert</h1>
        </div>
        <div class="content">
            <p>Hi ${data.firstName},</p>
            
            <div class="alert-box">
                <strong>${data.orgName}</strong> has reached <strong>${data.percentage}%</strong> of its ${data.type === 'token' ? 'token' : 'storage'} limit.
            </div>
            
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${Math.min(data.percentage, 100)}%"></div>
            </div>
            
            <div class="stats">
                <div class="stat">
                    <div class="stat-value">${data.used.toLocaleString()}</div>
                    <div>Used ${data.unit}</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${data.limit.toLocaleString()}</div>
                    <div>Limit ${data.unit}</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${data.percentage}%</div>
                    <div>Usage</div>
                </div>
            </div>
            
            ${
              data.threshold >= 100
                ? `
            <p style="color: #dc2626; font-weight: bold;">
                Your organization has exceeded its ${data.type} limit. Further usage may be restricted or incur overage charges.
            </p>
            `
                : data.threshold >= 90
                  ? `
            <p>
                You're approaching your limit. Consider upgrading your plan to avoid service interruptions.
            </p>
            `
                  : `
            <p>
                This is a friendly reminder to monitor your usage. You still have capacity remaining.
            </p>
            `
            }
            
            <p>
                <a href="${process.env.FRONTEND_URL || 'https://app.consultify.com'}/settings/billing" 
                   style="display: inline-block; background: ${severityColor}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                    View Billing Settings
                </a>
            </p>
            
            <p>Best regards,<br>The Consultify Team</p>
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} Consultify. All rights reserved.</p>
            <p>You're receiving this because you have billing alerts enabled.</p>
        </div>
    </div>
</body>
</html>
    `;
}

// Default export for backward compatibility
const UsageService = {
  recordTokenUsage,
  recordStorageUsage,
  getCurrentUsage,
  checkQuota,
  calculateOverage,
  updateUsageSummary,
  getUsageHistory,
  getGlobalUsageStats,
  recordProjectStorageUsage,
  checkProjectQuota,
  setDependencies,
  getOperationalCosts,
  checkAndSendUsageAlert,
};

export default UsageService;
