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

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { runAsync, getAsync, allAsync } = require('../db/sqliteAsync');

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
        // Only ECOSYSTEM_NODE users can generate codes
        if (userState !== 'ECOSYSTEM_NODE') {
            const err = new Error('Only users in Phase G (Ecosystem) can generate referral codes');
            err.statusCode = 403;
            throw err;
        }

        // Generate short ID from userId
        const shortId = userId.substring(0, 4).toUpperCase();
        const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase();
        const code = `${CODE_PREFIX}-${shortId}-${randomPart}`;

        const id = uuidv4();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);

        await runAsync(db,
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
        const referral = await getAsync(db,
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
        // Validate first
        const referral = await getAsync(db,
            `SELECT id FROM referrals WHERE code = ?`,
            [code]
        );

        if (!referral) {
            const err = new Error('Invalid referral code');
            err.statusCode = 400;
            throw err;
        }

        const useId = uuidv4();

        // Record usage
        await runAsync(db,
            `INSERT INTO referral_uses (id, referral_id, used_by_user_id, resulted_in_org_id)
             VALUES (?, ?, ?, ?)`,
            [useId, referral.id, usedByUserId, resultedInOrgId]
        );

        // Increment counter
        await runAsync(db,
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
        const referrals = await allAsync(db,
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
        const stats = await getAsync(db,
            `SELECT 
                (SELECT COUNT(*) FROM referrals) as total_codes,
                (SELECT COUNT(*) FROM referral_uses) as total_uses,
                (SELECT COUNT(*) FROM referral_uses WHERE resulted_in_org_id IS NOT NULL) as conversions,
                (SELECT COUNT(DISTINCT created_by_user_id) FROM referrals) as active_referrers
             FROM (SELECT 1)`
        );

        const topReferrers = await allAsync(db,
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
    }
};

module.exports = ReferralService;
