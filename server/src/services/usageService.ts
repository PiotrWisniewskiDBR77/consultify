/**
 * Usage Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Migrated from server/services/usageService.js (CommonJS) to TypeScript (ES Modules)
 * Handles token and storage usage tracking, quota enforcement, and overage calculation
 */

import { v4 as uuidv4 } from 'uuid';
import type { IDatabase } from '../database/IDatabase.js';
import { getDatabase } from '../database/Database.js';
import * as DbPromise from '../utils/DbPromise.js';

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

// Lazy-loaded dependencies
let billingService: any;
let payAsYouGoService: any;
let budgetManagementService: any;

async function initDeps(): Promise<void> {
    if (!billingService) {
        const billingModule = await import('./billingService.js');
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
 */
export function setDependencies(newDeps: { db?: IDatabase } = {}): void {
    if (newDeps.db) {
        db = newDeps.db;
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
        const budgetCheck = await budgetManagementService.checkBudgetLimit(orgId, userId, null, 'tokens', tokens);
        if (!budgetCheck.allowed && budgetCheck.reason === 'Budget limit exceeded') {
            throw new Error(`Budget limit exceeded: ${budgetCheck.usagePercent}% used`);
        }
    } catch (budgetErr) {
        // Log but don't block if budget check fails
        const error = budgetErr as Error;
        console.warn('[UsageService] Budget check failed:', error.message);
    }

    const id = `usage-${uuidv4()}`;
    await DbPromise.run(
        db,
        `INSERT INTO usage_records (id, organization_id, user_id, type, amount, action, metadata)
         VALUES (?, ?, ?, 'token', ?, ?, ?)`,
        [id, orgId, userId, tokens, action, JSON.stringify(metadata)]
    );

    // Record PAYG usage if billing model is PAYG
    try {
        const billingModel = await billingService.getBillingModel(orgId);
        if (billingModel.billingModel === 'pay_as_you_go' || billingModel.billingModel === 'hybrid') {
            const costCalc = await payAsYouGoService.calculateUsageCost(orgId, 'tokens', tokens);
            if (costCalc.cost > 0) {
                await payAsYouGoService.recordUsage(orgId, 'tokens', tokens, costCalc.unitPrice, metadata, userId, null);
            }
        }
    } catch (paygErr) {
        const error = paygErr as Error;
        console.warn('[UsageService] PAYG recording failed:', error.message);
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
        const budgetCheck = await budgetManagementService.checkBudgetLimit(orgId, null, null, 'storage', gb);
        if (!budgetCheck.allowed && budgetCheck.reason === 'Budget limit exceeded') {
            throw new Error(`Budget limit exceeded: ${budgetCheck.usagePercent}% used`);
        }
    } catch (budgetErr) {
        const error = budgetErr as Error;
        console.warn('[UsageService] Budget check failed:', error.message);
    }

    const id = `usage-${uuidv4()}`;
    await DbPromise.run(
        db,
        `INSERT INTO usage_records (id, organization_id, user_id, type, amount, action, metadata)
         VALUES (?, ?, NULL, 'storage', ?, ?, ?)`,
        [id, orgId, bytes, action, JSON.stringify(metadata)]
    );

    // Record PAYG usage if billing model is PAYG
    try {
        const billingModel = await billingService.getBillingModel(orgId);
        if (billingModel.billingModel === 'pay_as_you_go' || billingModel.billingModel === 'hybrid') {
            const costCalc = await payAsYouGoService.calculateUsageCost(orgId, 'storage', gb);
            if (costCalc.cost > 0) {
                await payAsYouGoService.recordUsage(orgId, 'storage', gb, costCalc.unitPrice, metadata, null, null);
            }
        }
    } catch (paygErr) {
        const error = paygErr as Error;
        console.warn('[UsageService] PAYG recording failed:', error.message);
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
            percentage: tokenLimit > 0 ? Math.round(((row?.tokens_used || 0) / tokenLimit) * 100) : 0
        },
        storage: {
            used: storageUsed,
            limit: storageLimit,
            remaining: Math.max(0, storageLimit - storageUsed),
            usedGB: storageUsed / (1024 * 1024 * 1024),
            limitGB: plan?.storage_limit_gb || 0,
            percentage: storageLimit > 0 ? Math.round((storageUsed / storageLimit) * 100) : 0
        },
        plan: plan?.name || 'Free',
        periodStart,
        periodEnd: billing?.current_period_end ? new Date(billing.current_period_end) : null
    };
}

/**
 * Check if organization has quota for a specific action
 */
export async function checkQuota(orgId: string, type: 'token' | 'storage' = 'token'): Promise<QuotaCheckResult> {
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
        overageRate: type === 'token' ? plan?.token_overage_rate : plan?.storage_overage_rate
    };
}

/**
 * Calculate overage charges for a billing period
 */
export async function calculateOverage(orgId: string, periodStart: Date, periodEnd: Date): Promise<OverageCalculationResult> {
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
            totalOverage: 0
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
    const storageOverageGB = Math.max(0, (storagePeak / (1024 * 1024 * 1024)) - (plan.storage_limit_gb || 0));

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
        totalOverage: Math.round((tokenOverage + storageOverage) * 100) / 100
    };
}

/**
 * Create or update monthly usage summary
 */
export async function updateUsageSummary(orgId: string, periodStart: Date): Promise<OverageCalculationResult & { id: string }> {
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
            id, orgId, periodStart.toISOString(), periodEnd.toISOString(),
            overage.tokensUsed, plan?.token_limit || 0,
            overage.tokenOverageAmount, overage.storagePeakGB * 1024 * 1024 * 1024,
            plan?.storage_limit_gb || 0, overage.storageOverageGB, overage.totalOverage
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
        periodStart: monthStart
    };
}

/**
 * Record project-level storage usage
 */
export async function recordProjectStorageUsage(projectId: string, bytes: number, action: string): Promise<{ projectId: string; bytes: number }> {
    await initDeps();
    await DbPromise.run(
        db,
        `UPDATE projects SET storage_used_bytes = storage_used_bytes + ? WHERE id = ?`,
        [bytes, projectId]
    );

    return { projectId, bytes };
}

/**
 * Check if project has storage quota
 */
export async function checkProjectQuota(projectId: string): Promise<ProjectQuotaResult> {
    await initDeps();
    const row = await DbPromise.get<ProjectRow>(
        db,
        `SELECT storage_limit_gb, storage_used_bytes FROM projects WHERE id = ?`,
        [projectId]
    );

    if (!row) {
        throw new Error('Project not found');
    }

    // If limit is NULL, it means unlimited (or falls back to Org quota which is checked separately)
    if (row.storage_limit_gb === null) {
        return { allowed: true, remaining: Infinity, limit: null, used: 0, percentage: 0 };
    }

    const limitBytes = (row.storage_limit_gb || 0) * 1024 * 1024 * 1024;
    const usedBytes = row.storage_used_bytes || 0;
    const remaining = Math.max(0, limitBytes - usedBytes);

    return {
        allowed: remaining > 0,
        remaining,
        limit: limitBytes,
        used: usedBytes,
        percentage: limitBytes > 0 ? (usedBytes / limitBytes) * 100 : 0
    };
}

/**
 * Get operational costs grouped by Provider/Model
 */
export async function getOperationalCosts(startDate?: Date, endDate?: Date): Promise<OperationalCostsResult> {
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
    providers.forEach(p => {
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
                cost: 0
            };
        }

        aggregated[key].totalTokens += row.total_tokens || 0;

        let cleanModelId = model;
        if (model.includes(':')) {
            cleanModelId = model.split(':')[1];
        }

        let costPer1k = 0;

        const matchedProvider = providers.find(p =>
            (p.provider === provider && p.model_id === cleanModelId) ||
            (`${p.provider}:${p.model_id}` === model)
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
        totalCost: results.reduce((sum, item) => sum + item.cost, 0)
    };
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
    getOperationalCosts
};

export default UsageService;
