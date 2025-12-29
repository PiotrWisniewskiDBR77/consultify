/**
 * Quota Service - 3-Level Token Quota Management
 * Levels: User → Project → Organization
 */

const db = require('../../database');

// Default quotas (tokens)
const DEFAULT_QUOTAS = {
    user: {
        daily: 50000,
        monthly: 500000
    },
    project: {
        daily: 200000,
        monthly: 2000000
    },
    organization: {
        daily: 1000000,
        monthly: 10000000
    }
};

class QuotaService {
    constructor() {
        this.ensureTable();
    }

    /**
     * Ensure the quota table exists
     */
    async ensureTable() {
        if (!db || !db.run) return;

        const sql = `
            CREATE TABLE IF NOT EXISTS ai_usage_quotas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                daily_token_limit INTEGER NOT NULL,
                monthly_token_limit INTEGER NOT NULL,
                tokens_used_today INTEGER DEFAULT 0,
                tokens_used_month INTEGER DEFAULT 0,
                last_reset_daily TEXT,
                last_reset_monthly TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(entity_type, entity_id)
            )
        `;

        return new Promise((resolve) => {
            db.run(sql, (err) => {
                if (err) console.warn('[QuotaService] Table creation:', err.message);
                resolve();
            });
        });
    }

    /**
     * Check if request is within quota limits
     * Checks all three levels: user, project, org
     * @returns {{ allowed: boolean, reason?: string, quotaInfo?: object }}
     */
    async checkQuota(userId, organizationId, projectId = null) {
        await this.resetExpiredQuotas();

        // Check user quota
        const userQuota = await this.getOrCreateQuota('user', userId);
        if (userQuota.tokens_used_today >= userQuota.daily_token_limit) {
            return { allowed: false, reason: 'User daily quota exceeded', level: 'user' };
        }
        if (userQuota.tokens_used_month >= userQuota.monthly_token_limit) {
            return { allowed: false, reason: 'User monthly quota exceeded', level: 'user' };
        }

        // Check project quota (if applicable)
        if (projectId) {
            const projectQuota = await this.getOrCreateQuota('project', projectId);
            if (projectQuota.tokens_used_today >= projectQuota.daily_token_limit) {
                return { allowed: false, reason: 'Project daily quota exceeded', level: 'project' };
            }
            if (projectQuota.tokens_used_month >= projectQuota.monthly_token_limit) {
                return { allowed: false, reason: 'Project monthly quota exceeded', level: 'project' };
            }
        }

        // Check organization quota
        const orgQuota = await this.getOrCreateQuota('organization', organizationId);
        if (orgQuota.tokens_used_today >= orgQuota.daily_token_limit) {
            return { allowed: false, reason: 'Organization daily quota exceeded', level: 'organization' };
        }
        if (orgQuota.tokens_used_month >= orgQuota.monthly_token_limit) {
            return { allowed: false, reason: 'Organization monthly quota exceeded', level: 'organization' };
        }

        return {
            allowed: true,
            quotaInfo: {
                user: userQuota,
                project: projectId ? await this.getQuota('project', projectId) : null,
                organization: orgQuota
            }
        };
    }

    /**
     * Consume tokens after successful LLM call
     * @param {string} userId - User ID
     * @param {string} organizationId - Organization ID
     * @param {string} projectId - Project ID (optional)
     * @param {number} tokenCount - Base token count
     * @param {Object} options - Additional options
     * @param {string} options.tier - Model tier (REASONING applies 3x multiplier)
     * @param {boolean} options.isMaxMode - Explicit MAX mode flag
     */
    async consumeTokens(userId, organizationId, projectId, tokenCount, options = {}) {
        const { tier, isMaxMode } = options;
        
        // Apply multiplier for MAX Mode / REASONING tier
        let multiplier = 1;
        if (tier === 'REASONING' || isMaxMode) {
            multiplier = 3; // MAX Mode uses 3x tokens
        } else if (tier === 'PREMIUM') {
            multiplier = 1.5; // Premium models cost more
        }

        const effectiveTokens = Math.ceil(tokenCount * multiplier);

        const updates = [
            this.incrementUsage('user', userId, effectiveTokens),
            this.incrementUsage('organization', organizationId, effectiveTokens)
        ];

        if (projectId) {
            updates.push(this.incrementUsage('project', projectId, effectiveTokens));
        }

        await Promise.all(updates);

        // Log MAX mode usage for analytics
        if (multiplier > 1) {
            console.log(`[QuotaService] MAX Mode consumption: ${tokenCount} × ${multiplier} = ${effectiveTokens} tokens`);
        }

        return { effectiveTokens, multiplier };
    }

    /**
     * Get or create quota record
     */
    async getOrCreateQuota(entityType, entityId) {
        let quota = await this.getQuota(entityType, entityId);

        if (!quota) {
            await this.createQuota(entityType, entityId);
            quota = await this.getQuota(entityType, entityId);
        }

        return quota;
    }

    async getQuota(entityType, entityId) {
        if (!db || !db.get) return null;

        return new Promise((resolve) => {
            db.get(
                `SELECT * FROM ai_usage_quotas WHERE entity_type = ? AND entity_id = ?`,
                [entityType, entityId],
                (err, row) => resolve(err ? null : row)
            );
        });
    }

    async createQuota(entityType, entityId) {
        if (!db || !db.run) return;

        const defaults = DEFAULT_QUOTAS[entityType] || DEFAULT_QUOTAS.user;
        const now = new Date().toISOString();

        return new Promise((resolve) => {
            db.run(
                `INSERT OR IGNORE INTO ai_usage_quotas 
                 (entity_type, entity_id, daily_token_limit, monthly_token_limit, 
                  tokens_used_today, tokens_used_month, last_reset_daily, last_reset_monthly)
                 VALUES (?, ?, ?, ?, 0, 0, ?, ?)`,
                [entityType, entityId, defaults.daily, defaults.monthly, now, now],
                (err) => resolve()
            );
        });
    }

    async incrementUsage(entityType, entityId, tokenCount) {
        if (!db || !db.run) return;

        return new Promise((resolve) => {
            db.run(
                `UPDATE ai_usage_quotas 
                 SET tokens_used_today = tokens_used_today + ?,
                     tokens_used_month = tokens_used_month + ?,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE entity_type = ? AND entity_id = ?`,
                [tokenCount, tokenCount, entityType, entityId],
                (err) => resolve()
            );
        });
    }

    /**
     * Reset expired quotas (daily and monthly)
     */
    async resetExpiredQuotas() {
        if (!db || !db.run) return;

        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

        // Reset daily quotas
        await new Promise((resolve) => {
            db.run(
                `UPDATE ai_usage_quotas 
                 SET tokens_used_today = 0, last_reset_daily = ?
                 WHERE date(last_reset_daily) < date(?)`,
                [now.toISOString(), today],
                (err) => resolve()
            );
        });

        // Reset monthly quotas
        await new Promise((resolve) => {
            db.run(
                `UPDATE ai_usage_quotas 
                 SET tokens_used_month = 0, last_reset_monthly = ?
                 WHERE date(last_reset_monthly) < date(?)`,
                [now.toISOString(), firstOfMonth],
                (err) => resolve()
            );
        });
    }

    /**
     * Get usage statistics for an entity
     */
    async getUsage(entityType, entityId) {
        const quota = await this.getQuota(entityType, entityId);
        if (!quota) return null;

        return {
            entityType,
            entityId,
            daily: {
                used: quota.tokens_used_today,
                limit: quota.daily_token_limit,
                remaining: quota.daily_token_limit - quota.tokens_used_today,
                percentUsed: Math.round((quota.tokens_used_today / quota.daily_token_limit) * 100)
            },
            monthly: {
                used: quota.tokens_used_month,
                limit: quota.monthly_token_limit,
                remaining: quota.monthly_token_limit - quota.tokens_used_month,
                percentUsed: Math.round((quota.tokens_used_month / quota.monthly_token_limit) * 100)
            }
        };
    }

    /**
     * Update quota limits for an entity
     */
    async setQuotaLimits(entityType, entityId, dailyLimit, monthlyLimit) {
        if (!db || !db.run) return;

        await this.getOrCreateQuota(entityType, entityId);

        return new Promise((resolve) => {
            db.run(
                `UPDATE ai_usage_quotas 
                 SET daily_token_limit = ?, monthly_token_limit = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE entity_type = ? AND entity_id = ?`,
                [dailyLimit, monthlyLimit, entityType, entityId],
                (err) => resolve(!err)
            );
        });
    }
}

// Singleton
const quotaService = new QuotaService();

module.exports = { QuotaService, quotaService, DEFAULT_QUOTAS };
