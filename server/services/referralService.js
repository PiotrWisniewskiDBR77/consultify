/**
 * Referral Service
 * 
 * Handles Phase G: Ecosystem Participation referral system.
 * Provides organic growth through value-based recommendations.
 * 
 * Features:
 * - Referral code generation and validation
 * - Usage tracking and attribution
 * - No financial incentives (value-driven growth)
 */

const deps = {
    _db: null,
    _uuidv4: null,
    _crypto: null,
    _sqliteAsync: null,

    get db() { return this._db; },
    set db(val) { this._db = val; },

    get uuidv4() { return this._uuidv4; },
    set uuidv4(val) { this._uuidv4 = val; },

    get crypto() { return this._crypto; },
    set crypto(val) { this._crypto = val; },

    get sqliteAsync() { return this._sqliteAsync; },
    set sqliteAsync(val) { this._sqliteAsync = val; }
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (!deps._db) {
        const { default: db } = await import('../src/database/index.js');
        deps._db = db;
    }
    if (!deps._uuidv4) {
        const { v4 } = await import('uuid');
        deps._uuidv4 = v4;
    }
    if (!deps._crypto) {
        const crypto = await import('crypto');
        deps._crypto = crypto;
    }
    if (!deps._sqliteAsync) {
        const sqliteAsync = await import('../db/sqliteAsync.js');
        deps._sqliteAsync = sqliteAsync;
    }
}

/**
 * Set dependencies (for testing)
 */
function setDependencies(newDeps = {}) {
    if (newDeps.db) deps.db = newDeps.db;
    if (newDeps.uuidv4) deps.uuidv4 = newDeps.uuidv4;
    if (newDeps.crypto) deps.crypto = newDeps.crypto;
    if (newDeps.sqliteAsync) deps.sqliteAsync = newDeps.sqliteAsync;
}

// Code format: REF-[SHORT_ID]-[RANDOM]
const CODE_PREFIX = 'REF';

const ReferralService = {
    /**
     * Generate a new referral code for a user.
     * @param {string} userId - User creating the referral
     * @param {string} userState - Current state of the user
     * @param {number} expiresInDays - Days until expiration (default 90)
     * @returns {Promise<Object>} { code, expiresAt }
     */
    generateCode: async (userId, userState, expiresInDays = 90) => {
        await initDeps();
        // Only ECOSYSTEM_NODE users can generate codes
        if (userState !== 'ECOSYSTEM_NODE') {
            const err = new Error('Only users in Phase G (Ecosystem) can generate referral codes');
            err.statusCode = 403;
            throw err;
        }

        // Generate short ID from userId
        const shortId = userId.substring(0, 4).toUpperCase();
        const randomPart = deps.crypto.randomBytes(2).toString('hex').toUpperCase();
        const code = `${CODE_PREFIX}-${shortId}-${randomPart}`;

        const id = deps.uuidv4();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);

        await deps.sqliteAsync.runAsync(deps.db,
            `INSERT INTO referrals (id, code, created_by_user_id, expires_at)
             VALUES (?, ?, ?, ?)`,
            [id, code, userId, expiresAt.toISOString()]
        );

        return {
            id,
            code,
            expiresAt: expiresAt.toISOString()
        };
    },

    /**
     * Validate a referral code.
     * @param {string} code - The referral code
     * @returns {Promise<Object|null>} Referral info if valid, null otherwise
     */
    validateCode: async (code) => {
        await initDeps();
        const referral = await deps.sqliteAsync.getAsync(deps.db,
            `SELECT id, code, created_by_user_id, expires_at, use_count
             FROM referrals 
             WHERE code = ? AND expires_at > datetime('now')`,
            [code]
        );

        if (!referral) {
            return null;
        }

        return {
            valid: true,
            referralId: referral.id,
            createdByUserId: referral.created_by_user_id,
            useCount: referral.use_count || 0,
            expiresAt: referral.expires_at
        };
    },

    /**
     * Record usage of a referral code.
     * @param {string} code - The referral code
     * @param {string} usedByUserId - User who used the code
     * @param {string} resultedInOrgId - Organization created (optional)
     * @returns {Promise<Object>} { success, useId }
     */
    recordUsage: async (code, usedByUserId, resultedInOrgId = null) => {
        await initDeps();
        // Validate first
        const referral = await deps.sqliteAsync.getAsync(deps.db,
            `SELECT id FROM referrals WHERE code = ?`,
            [code]
        );

        if (!referral) {
            const err = new Error('Invalid referral code');
            err.statusCode = 400;
            throw err;
        }

        const useId = deps.uuidv4();

        // Record usage
        await deps.sqliteAsync.runAsync(deps.db,
            `INSERT INTO referral_uses (id, referral_id, used_by_user_id, resulted_in_org_id)
             VALUES (?, ?, ?, ?)`,
            [useId, referral.id, usedByUserId, resultedInOrgId]
        );

        // Increment counter
        await deps.sqliteAsync.runAsync(deps.db,
            `UPDATE referrals SET use_count = COALESCE(use_count, 0) + 1 WHERE id = ?`,
            [referral.id]
        );

        return { success: true, useId };
    },

    /**
     * Get referrals created by a user.
     * @param {string} userId 
     * @returns {Promise<Array>}
     */
    getUserReferrals: async (userId) => {
        await initDeps();
        const referrals = await deps.sqliteAsync.allAsync(deps.db,
            `SELECT r.id, r.code, r.created_at, r.expires_at, r.use_count,
                    (SELECT COUNT(*) FROM referral_uses ru WHERE ru.referral_id = r.id AND ru.resulted_in_org_id IS NOT NULL) as conversions
             FROM referrals r
             WHERE r.created_by_user_id = ?
             ORDER BY r.created_at DESC`,
            [userId]
        );

        return referrals || [];
    },

    /**
     * Get referral statistics for ecosystem analytics.
     * @returns {Promise<Object>}
     */
    getEcosystemStats: async () => {
        await initDeps();
        const stats = await deps.sqliteAsync.getAsync(deps.db,
            `SELECT 
                (SELECT COUNT(*) FROM referrals) as total_codes,
                (SELECT COUNT(*) FROM referral_uses) as total_uses,
                (SELECT COUNT(*) FROM referral_uses WHERE resulted_in_org_id IS NOT NULL) as conversions,
                (SELECT COUNT(DISTINCT created_by_user_id) FROM referrals) as active_referrers
             FROM (SELECT 1)`
        );

        const topReferrers = await deps.sqliteAsync.allAsync(deps.db,
            `SELECT u.email, u.first_name, u.last_name, COUNT(ru.id) as total_conversions
             FROM referral_uses ru
             JOIN referrals r ON ru.referral_id = r.id
             JOIN users u ON r.created_by_user_id = u.id
             WHERE ru.resulted_in_org_id IS NOT NULL
             GROUP BY u.id
             ORDER BY total_conversions DESC
             LIMIT 5`,
            []
        );

        const conversionRate = stats.total_uses > 0
            ? (stats.conversions / stats.total_uses * 100).toFixed(1)
            : 0;

        return {
            totalCodes: stats.total_codes || 0,
            totalUses: stats.total_uses || 0,
            conversions: stats.conversions || 0,
            activeReferrers: stats.active_referrers || 0,
            conversionRate: parseFloat(conversionRate),
            topReferrers: topReferrers || []
        };
    },
    setDependencies
};

export default ReferralService;
