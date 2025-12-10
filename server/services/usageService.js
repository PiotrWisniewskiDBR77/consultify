/**
 * Usage Service
 * Handles token and storage usage tracking, quota enforcement, and overage calculation
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const billingService = require('./billingService');

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
        db.get(
            `SELECT 
                COALESCE(SUM(CASE WHEN type = 'token' THEN amount ELSE 0 END), 0) as tokens_used,
                COALESCE(SUM(CASE WHEN type = 'storage' THEN amount ELSE 0 END), 0) as storage_bytes
             FROM usage_records
             WHERE organization_id = ? AND recorded_at >= ?`,
            [orgId, periodStart.toISOString()],
            (err, row) => {
                if (err) return reject(err);

                const tokenLimit = plan?.token_limit || 0;
                const storageLimit = (plan?.storage_limit_gb || 0) * 1024 * 1024 * 1024; // Convert GB to bytes

                resolve({
                    tokens: {
                        used: row?.tokens_used || 0,
                        limit: tokenLimit,
                        remaining: Math.max(0, tokenLimit - (row?.tokens_used || 0)),
                        percentage: tokenLimit > 0 ? Math.round(((row?.tokens_used || 0) / tokenLimit) * 100) : 0
                    },
                    storage: {
                        used: row?.storage_bytes || 0,
                        limit: storageLimit,
                        remaining: Math.max(0, storageLimit - (row?.storage_bytes || 0)),
                        usedGB: (row?.storage_bytes || 0) / (1024 * 1024 * 1024),
                        limitGB: plan?.storage_limit_gb || 0,
                        percentage: storageLimit > 0 ? Math.round(((row?.storage_bytes || 0) / storageLimit) * 100) : 0
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

module.exports = {
    recordTokenUsage,
    recordStorageUsage,
    getCurrentUsage,
    checkQuota,
    calculateOverage,
    updateUsageSummary,
    getUsageHistory,
    getGlobalUsageStats
};
