/**
 * Usage Service
 * Handles token and storage usage tracking, quota enforcement, and overage calculation
 */

// Dependency injection for testing
let deps = {
    db: null,
    uuidv4: null,
    billingService: null,
    payAsYouGoService: null,
    budgetManagementService: null
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (!deps.db) {
        const dbModule = await import('../database.js');
        deps.db = dbModule.default || dbModule;
    }

    if (!deps.uuidv4) {
        const uuidModule = await import('uuid');
        deps.uuidv4 = uuidModule.v4;
    }

    if (!deps.billingService) {
        const billingModule = await import('./billingService.js');
        deps.billingService = billingModule.default || billingModule;
    }

    if (!deps.payAsYouGoService) {
        const payAsYouGoModule = await import('./payAsYouGoService.js');
        deps.payAsYouGoService = payAsYouGoModule.default || payAsYouGoModule;
    }

    if (!deps.budgetManagementService) {
        const budgetManagementModule = await import('./budgetManagementService.js');
        deps.budgetManagementService = budgetManagementModule.default || budgetManagementModule;
    }
}

/**
 * Set dependencies for testing
 */
function setDependencies(newDeps) {
    deps = { ...deps, ...newDeps };
}

/**
 * Record token usage
 */
async function recordTokenUsage(orgId, userId, tokens, action, metadata = {}) {
    await initDeps();
    // Check budget limits before recording usage
    try {
        const budgetCheck = await deps.budgetManagementService.checkBudgetLimit(orgId, userId, null, 'tokens', tokens);
        if (!budgetCheck.allowed && budgetCheck.reason === 'Budget limit exceeded') {
            throw new Error(`Budget limit exceeded: ${budgetCheck.usagePercent}% used`);
        }
    } catch (budgetErr) {
        // Log but don't block if budget check fails
        console.warn('[UsageService] Budget check failed:', budgetErr.message);
    }

    const id = `usage-${deps.uuidv4()}`;
    return new Promise(async (resolve, reject) => {
        deps.db.run(
            `INSERT INTO usage_records (id, organization_id, user_id, type, amount, action, metadata)
             VALUES (?, ?, ?, 'token', ?, ?, ?)`,
            [id, orgId, userId, tokens, action, JSON.stringify(metadata)],
            async function (err) {
                if (err) {
                    reject(err);
                    return;
                }

                // Record PAYG usage if billing model is PAYG
                try {
                    const billingModel = await deps.billingService.getBillingModel(orgId);
                    if (billingModel.billingModel === 'pay_as_you_go' || billingModel.billingModel === 'hybrid') {
                        const costCalc = await deps.payAsYouGoService.calculateUsageCost(orgId, 'tokens', tokens);
                        if (costCalc.cost > 0) {
                            await deps.payAsYouGoService.recordUsage(orgId, 'tokens', tokens, costCalc.unitPrice, metadata, userId, null);
                        }
                    }
                } catch (paygErr) {
                    console.warn('[UsageService] PAYG recording failed:', paygErr.message);
                }

                resolve({ id, tokens });
            }
        );
    });
}

/**
 * Record storage usage
 */
async function recordStorageUsage(orgId, bytes, action, metadata = {}) {
    await initDeps();
    const gb = bytes / (1024 * 1024 * 1024);

    // Check budget limits before recording usage
    try {
        const budgetCheck = await deps.budgetManagementService.checkBudgetLimit(orgId, null, null, 'storage', gb);
        if (!budgetCheck.allowed && budgetCheck.reason === 'Budget limit exceeded') {
            throw new Error(`Budget limit exceeded: ${budgetCheck.usagePercent}% used`);
        }
    } catch (budgetErr) {
        console.warn('[UsageService] Budget check failed:', budgetErr.message);
    }

    const id = `usage-${deps.uuidv4()}`;
    return new Promise(async (resolve, reject) => {
        deps.db.run(
            `INSERT INTO usage_records (id, organization_id, user_id, type, amount, action, metadata)
             VALUES (?, ?, NULL, 'storage', ?, ?, ?)`,
            [id, orgId, null, bytes, action, JSON.stringify(metadata)],
            async function (err) {
                if (err) {
                    reject(err);
                    return;
                }

                // Record PAYG usage if billing model is PAYG
                try {
                    const billingModel = await deps.billingService.getBillingModel(orgId);
                    if (billingModel.billingModel === 'pay_as_you_go' || billingModel.billingModel === 'hybrid') {
                        const costCalc = await deps.payAsYouGoService.calculateUsageCost(orgId, 'storage', gb);
                        if (costCalc.cost > 0) {
                            await deps.payAsYouGoService.recordUsage(orgId, 'storage', gb, costCalc.unitPrice, metadata, null, null);
                        }
                    }
                } catch (paygErr) {
                    console.warn('[UsageService] PAYG recording failed:', paygErr.message);
                }

                resolve({ id, bytes });
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
    await initDeps();
    const billing = await deps.billingService.getOrganizationBilling(orgId);
    const plan = billing?.subscription_plan_id
        ? await deps.billingService.getPlanById(billing.subscription_plan_id)
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
        deps.db.get(
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
    await initDeps();
    const usage = await getCurrentUsage(orgId);
    const billing = await deps.billingService.getOrganizationBilling(orgId);
    const plan = billing?.subscription_plan_id
        ? await deps.billingService.getPlanById(billing.subscription_plan_id)
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
    await initDeps();
    const billing = await deps.billingService.getOrganizationBilling(orgId);
    const plan = billing?.subscription_plan_id
        ? await deps.billingService.getPlanById(billing.subscription_plan_id)
        : null;

    if (!plan) return { tokenOverage: 0, storageOverage: 0, totalOverage: 0 };

    return new Promise((resolve, reject) => {
        deps.db.get(
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
    await initDeps();
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const overage = await calculateOverage(orgId, periodStart, periodEnd);
    const billing = await deps.billingService.getOrganizationBilling(orgId);
    const plan = billing?.subscription_plan_id
        ? await deps.billingService.getPlanById(billing.subscription_plan_id)
        : null;

    const id = `summary-${deps.uuidv4()}`;

    return new Promise((resolve, reject) => {
        deps.db.run(
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
async function getUsageHistory(orgId, limit = 12) {
    await initDeps();
    return new Promise((resolve, reject) => {
        deps.db.all(
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
async function getGlobalUsageStats() {
    await initDeps();
    return new Promise((resolve, reject) => {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        deps.db.get(
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
async function recordProjectStorageUsage(projectId, bytes, action) {
    await initDeps();
    return new Promise((resolve, reject) => {
        // Increment usage
        deps.db.run(
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
async function checkProjectQuota(projectId) {
    await initDeps();
    return new Promise((resolve, reject) => {
        deps.db.get(
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


/**
 * Get operational costs grouped by Provider/Model
 */
async function getOperationalCosts(startDate, endDate) {
    await initDeps();
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

        deps.db.all(query, [start.toISOString(), end.toISOString()], async (err, rows) => {
            if (err) return reject(err);

            try {
                // Fetch current provider costs to calculate estimated spend
                const providers = await new Promise((res, rej) => {
                    deps.db.all("SELECT provider, model_id, cost_per_1k FROM llm_providers", (e, r) => e ? rej(e) : res(r));
                });

                // Create a lookup map for costs: "provider:model" -> cost
                const costMap = {};
                providers.forEach(p => {
                    costMap[`${p.provider}:${p.model_id}`] = p.cost_per_1k || 0;
                });

                const aggregated = {};

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


export default {
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
