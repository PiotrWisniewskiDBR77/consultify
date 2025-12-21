/**
 * Usage Service
 * Handles token and storage usage tracking, quota enforcement, and overage calculation
 */

// Dependency injection for testing
const deps = {
    db: require('../database'),
    uuidv4: require('uuid').v4,
    billingService: require('./billingService')
};

/**
 * Record token usage
 */
function recordTokenUsage(orgId, userId, tokens, action, metadata = {}) {
    const id = `usage-${uuidv4()}`;
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO usage_records (id, organization_id, user_id, type, amount, action, metadata)
             VALUES (?, ?, ?, 'token', ?, ?, ?)`,
            [id, orgId, userId, tokens, action, JSON.stringify(metadata)],
            function (err) {
                if (err) reject(err);
                else resolve({ id, tokens });
            }
        );
    });
}

/**
 * Record storage usage
 */
function recordStorageUsage(orgId, bytes, action, metadata = {}) {
    const id = `usage-${uuidv4()}`;
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO usage_records (id, organization_id, user_id, type, amount, action, metadata)
             VALUES (?, ?, NULL, 'storage', ?, ?, ?)`,
            [id, orgId, bytes, action, JSON.stringify(metadata)],
            function (err) {
                if (err) reject(err);
                else resolve({ id, bytes });
            }
        );
    });
}

/**
 * Get current period usage for an organization
 */
/**
 * Get current period usage for an organization
 */
async function getCurrentUsage(orgId) {
    const billing = await billingService.getOrganizationBilling(orgId);
    const plan = billing?.subscription_plan_id
        ? await billingService.getPlanById(billing.subscription_plan_id)
        : null;

    // Default period: current month
    const now = new Date();
    const periodStart = billing?.current_period_start
        ? new Date(billing.current_period_start)
        : new Date(now.getFullYear(), now.getMonth(), 1);

    return new Promise((resolve, reject) => {
        // Fix: Token usage is periodic (monthly), but Storage usage is cumulative (all-time)
        // We sum tokens only since periodStart
        // We sum storage for ALL time (records are +bytes for upload, -bytes for delete)
        db.get(
            `SELECT 
                COALESCE(SUM(CASE WHEN type = 'token' AND recorded_at >= ? THEN amount ELSE 0 END), 0) as tokens_used,
                COALESCE(SUM(CASE WHEN type = 'storage' THEN amount ELSE 0 END), 0) as storage_bytes
             FROM usage_records
             WHERE organization_id = ?`,
            [periodStart.toISOString(), orgId],
            (err, row) => {
                if (err) return reject(err);

                const tokenLimit = plan?.token_limit || 0;
                const storageLimit = (plan?.storage_limit_gb || 0) * 1024 * 1024 * 1024; // Convert GB to bytes

                // Ensure storage never goes below 0 (in case of data anomalies)
                const storageUsed = Math.max(0, row?.storage_bytes || 0);

                resolve({
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
                    periodEnd: billing?.current_period_end
                });
            }
        );
    });
}

/**
 * Check if organization has quota for a specific action
 * Returns: { allowed: boolean, remaining: number, overageEnabled: boolean }
 */
async function checkQuota(orgId, type = 'token') {
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
async function calculateOverage(orgId, periodStart, periodEnd) {
    const billing = await billingService.getOrganizationBilling(orgId);
    const plan = billing?.subscription_plan_id
        ? await billingService.getPlanById(billing.subscription_plan_id)
        : null;

    if (!plan) return { tokenOverage: 0, storageOverage: 0, totalOverage: 0 };

    return new Promise((resolve, reject) => {
        db.get(
            `SELECT 
                COALESCE(SUM(CASE WHEN type = 'token' THEN amount ELSE 0 END), 0) as tokens_used,
                COALESCE(MAX(CASE WHEN type = 'storage' THEN amount ELSE 0 END), 0) as storage_peak
             FROM usage_records
             WHERE organization_id = ? AND recorded_at >= ? AND recorded_at < ?`,
            [orgId, periodStart, periodEnd],
            (err, row) => {
                if (err) return reject(err);

                const tokensUsed = row?.tokens_used || 0;
                const storagePeak = row?.storage_peak || 0;

                const tokenOverageAmount = Math.max(0, tokensUsed - (plan.token_limit || 0));
                const storageOverageGB = Math.max(0, (storagePeak / (1024 * 1024 * 1024)) - (plan.storage_limit_gb || 0));

                // Calculate charges (rate is per 1K tokens, per GB storage)
                const tokenOverage = (tokenOverageAmount / 1000) * (plan.token_overage_rate || 0);
                const storageOverage = storageOverageGB * (plan.storage_overage_rate || 0);

                resolve({
                    tokensUsed,
                    tokenLimit: plan.token_limit || 0,
                    tokenOverageAmount,
                    tokenOverage: Math.round(tokenOverage * 100) / 100,
                    storagePeakGB: storagePeak / (1024 * 1024 * 1024),
                    storageLimit: plan.storage_limit_gb || 0,
                    storageOverageGB,
                    storageOverage: Math.round(storageOverage * 100) / 100,
                    totalOverage: Math.round((tokenOverage + storageOverage) * 100) / 100
                });
            }
        );
    });
}

/**
 * Create or update monthly usage summary
 */
async function updateUsageSummary(orgId, periodStart) {
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const overage = await calculateOverage(orgId, periodStart, periodEnd);
    const billing = await billingService.getOrganizationBilling(orgId);
    const plan = billing?.subscription_plan_id
        ? await billingService.getPlanById(billing.subscription_plan_id)
        : null;

    const id = `summary-${uuidv4()}`;

    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO usage_summaries (id, organization_id, period_start, period_end, tokens_used, tokens_included, tokens_overage, storage_bytes_peak, storage_gb_included, storage_gb_overage, overage_amount)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(organization_id, period_start) DO UPDATE SET
             tokens_used = excluded.tokens_used,
             tokens_overage = excluded.tokens_overage,
             storage_bytes_peak = excluded.storage_bytes_peak,
             storage_gb_overage = excluded.storage_gb_overage,
             overage_amount = excluded.overage_amount`,
            [id, orgId, periodStart, periodEnd, overage.tokensUsed, plan?.token_limit || 0,
                overage.tokenOverageAmount, overage.storagePeakGB * 1024 * 1024 * 1024,
                plan?.storage_limit_gb || 0, overage.storageOverageGB, overage.totalOverage],
            function (err) {
                if (err) reject(err);
                else resolve({ id, ...overage });
            }
        );
    });
}

/**
 * Get usage history for organization
 */
function getUsageHistory(orgId, limit = 12) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT * FROM usage_summaries 
             WHERE organization_id = ? 
             ORDER BY period_start DESC 
             LIMIT ?`,
            [orgId, limit],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            }
        );
    });
}

/**
 * Get global usage statistics (Superadmin)
 */
function getGlobalUsageStats() {
    return new Promise((resolve, reject) => {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        db.get(
            `SELECT 
                COALESCE(SUM(CASE WHEN type = 'token' THEN amount ELSE 0 END), 0) as total_tokens,
                COALESCE(SUM(CASE WHEN type = 'storage' THEN amount ELSE 0 END), 0) as total_storage,
                COUNT(DISTINCT organization_id) as active_orgs
             FROM usage_records
             WHERE recorded_at >= ?`,
            [monthStart.toISOString()],
            (err, row) => {
                if (err) return reject(err);

                resolve({
                    totalTokensThisMonth: row?.total_tokens || 0,
                    totalStorageBytes: row?.total_storage || 0,
                    totalStorageGB: (row?.total_storage || 0) / (1024 * 1024 * 1024),
                    activeOrganizations: row?.active_orgs || 0,
                    periodStart: monthStart
                });
            }
        );
    });
}

/**
 * Record project-level storage usage
 */
function recordProjectStorageUsage(projectId, bytes, action) {
    return new Promise((resolve, reject) => {
        // Increment usage
        db.run(
            `UPDATE projects SET storage_used_bytes = storage_used_bytes + ? WHERE id = ?`,
            [bytes, projectId],
            function (err) {
                if (err) reject(err);
                else resolve({ projectId, bytes });
            }
        );
    });
}

/**
 * Check if project has storage quota
 * Returns: { allowed: boolean, remaining: number }
 */
function checkProjectQuota(projectId) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT storage_limit_gb, storage_used_bytes FROM projects WHERE id = ?`,
            [projectId],
            (err, row) => {
                if (err) return reject(err);
                if (!row) return reject(new Error('Project not found'));

                // If limit is NULL, it means unlimited (or falls back to Org quota which is checked separately)
                if (row.storage_limit_gb === null) {
                    return resolve({ allowed: true, remaining: Infinity, limit: null });
                }

                const limitBytes = row.storage_limit_gb * 1024 * 1024 * 1024;
                const usedBytes = row.storage_used_bytes || 0;
                const remaining = Math.max(0, limitBytes - usedBytes);

                resolve({
                    allowed: remaining > 0,
                    remaining,
                    limit: limitBytes,
                    used: usedBytes,
                    percentage: limitBytes > 0 ? (usedBytes / limitBytes) * 100 : 0
                });
            }
        );
    });
}


module.exports = {
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

    /**
     * Get operational costs grouped by Provider/Model
     */
    getOperationalCosts: async (startDate, endDate) => {
        return new Promise((resolve, reject) => {
            // Default to last 30 days if no dates provided
            const end = endDate ? new Date(endDate) : new Date();
            const start = startDate ? new Date(startDate) : new Date(new Date().setDate(end.getDate() - 30));

            const query = `
                SELECT 
                    u.metadata,
                    SUM(u.amount) as total_tokens
                FROM usage_records u
                WHERE u.type = 'token' 
                AND u.recorded_at >= ? 
                AND u.recorded_at <= ?
                GROUP BY u.metadata
            `;

            db.all(query, [start.toISOString(), end.toISOString()], async (err, rows) => {
                if (err) return reject(err);

                try {
                    // Fetch current provider costs to calculate estimated spend
                    const providers = await new Promise((res, rej) => {
                        db.all("SELECT provider, model_id, cost_per_1k FROM llm_providers", (e, r) => e ? rej(e) : res(r));
                    });

                    // Create a lookup map for costs: "provider:model" -> cost
                    const costMap = {};
                    providers.forEach(p => {
                        costMap[`${p.provider}:${p.model_id}`] = p.cost_per_1k || 0;
                        // Also fallback for just provider if model specific not found? 
                        // Or just fuzzy match. For now exact match on what we logged.
                    });

                    const aggregated = {};
                    let totalCost = 0;

                    for (const row of rows) {
                        let meta = {};
                        try {
                            meta = JSON.parse(row.metadata || '{}');
                        } catch (e) { continue; }

                        const provider = meta.llmProvider || 'unknown';
                        const model = meta.modelUsed || 'unknown';
                        const key = `${provider}|${model}`;

                        if (!aggregated[key]) {
                            aggregated[key] = {
                                provider,
                                model,
                                totalTokens: 0,
                                cost: 0
                            };
                        }

                        aggregated[key].totalTokens += row.total_tokens;

                        // Calculate cost
                        // Try to find cost in map
                        // Metadata model might be "openai:gpt-4", but provider table has provider="openai", model_id="gpt-4"
                        // Or metadata provider="openai", model="gpt-4"

                        // We need to match efficiently.
                        // Let's assume usage service logged: llmProvider="openai", modelUsed="openai:gpt-4" (as seen in aiService)
                        // Wait, aiService logs: modelUsed = `${provider}:${model_id}`

                        // So let's extract real model id if it contains colon
                        let cleanModelId = model;
                        if (model.includes(':')) {
                            cleanModelId = model.split(':')[1];
                        }

                        // Lookup cost
                        // We try matches: "provider:model"
                        let costPer1k = 0;

                        // 1. Direct match on modelUsed (which is provider:model)
                        // 2. Match on provider + cleanModelId

                        // Let's iterate providers to find best match
                        const matchedProvider = providers.find(p =>
                            (p.provider === provider && p.model_id === cleanModelId) ||
                            (`${p.provider}:${p.model_id}` === model)
                        );

                        if (matchedProvider) {
                            costPer1k = matchedProvider.cost_per_1k || 0;
                        }

                        aggregated[key].cost += (row.total_tokens / 1000) * costPer1k;
                    }

                    // Convert to array
                    const results = Object.values(aggregated).sort((a, b) => b.cost - a.cost);

                    resolve({
                        period: { start, end },
                        items: results,
                        totalCost: results.reduce((sum, item) => sum + item.cost, 0)
                    });

                } catch (e) {
                    reject(e);
                }
            });
        });
    }
};
