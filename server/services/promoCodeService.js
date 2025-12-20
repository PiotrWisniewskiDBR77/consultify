/**
 * Promo Code Service
 * 
 * Enterprise-grade promotional code management for attribution and discounts.
 * Supports three code types:
 * - DISCOUNT: Applies discount to billing
 * - PARTNER: Attribution only (for partner settlements)
 * - CAMPAIGN: Marketing campaign tracking
 * 
 * Security Features:
 * - Case-insensitive code matching (stored uppercase)
 * - Validity window enforcement
 * - Atomic usage counter increment
 * - Rate limiting handled at route level
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const PROMO_TYPES = {
    DISCOUNT: 'DISCOUNT',
    PARTNER: 'PARTNER',
    CAMPAIGN: 'CAMPAIGN'
};

const DISCOUNT_TYPES = {
    PERCENT: 'PERCENT',
    FIXED: 'FIXED',
    NONE: 'NONE'
};

const PromoCodeService = {
    PROMO_TYPES,
    DISCOUNT_TYPES,

    /**
     * Validate a promo code without consuming it
     * @param {string} code - The promo code to validate
     * @returns {Promise<{valid: boolean, code?: object, reason?: string}>}
     */
    validatePromoCode: async (code) => {
        if (!code || typeof code !== 'string') {
            return { valid: false, reason: 'Invalid promo code format' };
        }

        const normalizedCode = code.trim().toUpperCase();

        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM promo_codes WHERE code = ? AND is_active = 1`,
                [normalizedCode],
                (err, row) => {
                    if (err) {
                        console.error('[PromoCodeService] Validation error:', err);
                        return reject(err);
                    }

                    if (!row) {
                        return resolve({ valid: false, reason: 'Promo code not found' });
                    }

                    const now = new Date().toISOString();

                    // Check validity window
                    if (row.valid_from && row.valid_from > now) {
                        return resolve({ valid: false, reason: 'Promo code is not yet active' });
                    }

                    if (row.valid_until && row.valid_until < now) {
                        return resolve({ valid: false, reason: 'Promo code has expired' });
                    }

                    // Check usage limit
                    if (row.max_uses !== null && row.used_count >= row.max_uses) {
                        return resolve({ valid: false, reason: 'Promo code usage limit reached' });
                    }

                    // Build response
                    const response = {
                        valid: true,
                        codeId: row.id,
                        code: row.code,
                        type: row.type,
                        discountType: row.discount_type,
                        discountValue: row.discount_value,
                        partnerCode: row.type === PROMO_TYPES.PARTNER ? row.code : null,
                        metadata: JSON.parse(row.metadata || '{}')
                    };

                    // Add human-readable discount message
                    if (row.discount_type === DISCOUNT_TYPES.PERCENT && row.discount_value) {
                        response.discountMessage = `-${row.discount_value}%`;
                    } else if (row.discount_type === DISCOUNT_TYPES.FIXED && row.discount_value) {
                        response.discountMessage = `-$${row.discount_value}`;
                    }

                    resolve(response);
                }
            );
        });
    },

    /**
     * Check if a promo code has been used by an organization
     * @param {string} code - The promo code
     * @param {string} organizationId - Organization ID
     * @returns {Promise<boolean>}
     */
    hasBeenUsedByOrg: async (code, organizationId) => {
        const normalizedCode = code.trim().toUpperCase();

        return new Promise((resolve, reject) => {
            db.get(
                `SELECT pcu.id FROM promo_code_usage pcu
                 JOIN promo_codes pc ON pc.id = pcu.promo_code_id
                 WHERE pc.code = ? AND pcu.organization_id = ?`,
                [normalizedCode, organizationId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(!!row);
                }
            );
        });
    },

    /**
     * Mark promo code as used by an organization (atomic increment)
     * @param {string} code - The promo code
     * @param {string} organizationId - Organization ID
     * @param {string} userId - User ID (optional)
     * @returns {Promise<{success: boolean, reason?: string}>}
     */
    markPromoCodeUsed: async (code, organizationId, userId = null) => {
        const normalizedCode = code.trim().toUpperCase();

        // First validate the code
        const validation = await PromoCodeService.validatePromoCode(normalizedCode);
        if (!validation.valid) {
            return { success: false, reason: validation.reason };
        }

        // Check if already used by this org
        const alreadyUsed = await PromoCodeService.hasBeenUsedByOrg(normalizedCode, organizationId);
        if (alreadyUsed) {
            return { success: false, reason: 'Promo code already used by this organization' };
        }

        return new Promise((resolve, reject) => {
            db.serialize(() => {
                // Atomic increment of used_count
                db.run(
                    `UPDATE promo_codes SET used_count = used_count + 1 WHERE code = ?`,
                    [normalizedCode],
                    function (err) {
                        if (err) {
                            console.error('[PromoCodeService] Usage increment error:', err);
                            return reject(err);
                        }

                        if (this.changes === 0) {
                            return resolve({ success: false, reason: 'Promo code not found' });
                        }

                        // Log usage
                        const usageId = uuidv4();
                        db.run(
                            `INSERT INTO promo_code_usage (id, promo_code_id, organization_id, user_id) VALUES (?, ?, ?, ?)`,
                            [usageId, validation.codeId, organizationId, userId],
                            (err) => {
                                if (err) {
                                    console.error('[PromoCodeService] Usage log error:', err);
                                    return reject(err);
                                }

                                console.log(`[PromoCodeService] Promo code ${normalizedCode} used by org ${organizationId}`);
                                resolve({
                                    success: true,
                                    codeId: validation.codeId,
                                    discountType: validation.discountType,
                                    discountValue: validation.discountValue
                                });
                            }
                        );
                    }
                );
            });
        });
    },

    /**
     * Create a new promo code (SuperAdmin only)
     * @param {object} params - Promo code parameters
     * @param {string} params.code - Unique code (will be uppercased)
     * @param {string} params.type - DISCOUNT | PARTNER | CAMPAIGN
     * @param {string} params.discountType - PERCENT | FIXED | NONE
     * @param {number} params.discountValue - Discount amount (optional)
     * @param {string} params.validFrom - ISO date string
     * @param {string} params.validUntil - ISO date string (optional)
     * @param {number} params.maxUses - Max usage count (optional)
     * @param {string} params.createdByUserId - Creating user ID
     * @param {object} params.metadata - Additional metadata (optional)
     * @returns {Promise<object>}
     */
    createPromoCode: async (params) => {
        const {
            code,
            type,
            discountType = DISCOUNT_TYPES.NONE,
            discountValue = null,
            validFrom,
            validUntil = null,
            maxUses = null,
            createdByUserId,
            metadata = {}
        } = params;

        if (!code || !type || !validFrom) {
            throw new Error('Code, type, and validFrom are required');
        }

        if (!Object.values(PROMO_TYPES).includes(type)) {
            throw new Error(`Invalid promo type: ${type}`);
        }

        if (!Object.values(DISCOUNT_TYPES).includes(discountType)) {
            throw new Error(`Invalid discount type: ${discountType}`);
        }

        const normalizedCode = code.trim().toUpperCase();
        const promoId = uuidv4();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO promo_codes (id, code, type, discount_type, discount_value, valid_from, valid_until, max_uses, created_by_user_id, metadata)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [promoId, normalizedCode, type, discountType, discountValue, validFrom, validUntil, maxUses, createdByUserId, JSON.stringify(metadata)],
                function (err) {
                    if (err) {
                        if (err.message.includes('UNIQUE constraint')) {
                            return reject(new Error('Promo code already exists'));
                        }
                        console.error('[PromoCodeService] Create error:', err);
                        return reject(err);
                    }

                    console.log(`[PromoCodeService] Created promo code: ${normalizedCode} (${type})`);
                    resolve({
                        id: promoId,
                        code: normalizedCode,
                        type,
                        discountType,
                        discountValue,
                        validFrom,
                        validUntil,
                        maxUses,
                        usedCount: 0,
                        isActive: true
                    });
                }
            );
        });
    },

    /**
     * List all promo codes (SuperAdmin only)
     * @param {object} options - Query options
     * @param {boolean} options.includeInactive - Include inactive codes
     * @param {string} options.type - Filter by type
     * @param {number} options.limit - Max results
     * @param {number} options.offset - Pagination offset
     * @returns {Promise<object[]>}
     */
    listPromoCodes: async (options = {}) => {
        const { includeInactive = false, type = null, limit = 100, offset = 0 } = options;

        let query = `SELECT * FROM promo_codes WHERE 1=1`;
        const params = [];

        if (!includeInactive) {
            query += ` AND is_active = 1`;
        }

        if (type) {
            query += ` AND type = ?`;
            params.push(type);
        }

        query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve((rows || []).map(row => ({
                    id: row.id,
                    code: row.code,
                    type: row.type,
                    discountType: row.discount_type,
                    discountValue: row.discount_value,
                    validFrom: row.valid_from,
                    validUntil: row.valid_until,
                    maxUses: row.max_uses,
                    usedCount: row.used_count,
                    isActive: !!row.is_active,
                    createdByUserId: row.created_by_user_id,
                    metadata: JSON.parse(row.metadata || '{}'),
                    createdAt: row.created_at
                })));
            });
        });
    },

    /**
     * Deactivate a promo code
     * @param {string} codeId - Promo code ID
     * @returns {Promise<{success: boolean}>}
     */
    deactivatePromoCode: async (codeId) => {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE promo_codes SET is_active = 0 WHERE id = ?`,
                [codeId],
                function (err) {
                    if (err) return reject(err);
                    resolve({ success: this.changes > 0 });
                }
            );
        });
    },

    /**
     * Get promo code usage history
     * @param {string} codeId - Promo code ID
     * @returns {Promise<object[]>}
     */
    getUsageHistory: async (codeId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT pcu.*, o.name as organization_name, u.email as user_email
                 FROM promo_code_usage pcu
                 LEFT JOIN organizations o ON o.id = pcu.organization_id
                 LEFT JOIN users u ON u.id = pcu.user_id
                 WHERE pcu.promo_code_id = ?
                 ORDER BY pcu.used_at DESC`,
                [codeId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve((rows || []).map(row => ({
                        id: row.id,
                        organizationId: row.organization_id,
                        organizationName: row.organization_name,
                        userId: row.user_id,
                        userEmail: row.user_email,
                        usedAt: row.used_at
                    })));
                }
            );
        });
    }
};

module.exports = PromoCodeService;
