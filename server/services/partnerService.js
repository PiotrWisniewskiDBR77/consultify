/**
 * Partner Service
 * 
 * Manages partner entities for the settlement system:
 * - Referral partners
 * - Resellers
 * - Sales partners
 * 
 * @module partnerService
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const PARTNER_TYPES = {
    REFERRAL: 'REFERRAL',
    RESELLER: 'RESELLER',
    SALES: 'SALES'
};

const PartnerService = {
    PARTNER_TYPES,

    /**
     * Create a new partner
     * @param {Object} params - Partner data
     * @param {string} params.name - Partner name
     * @param {string} params.partnerType - REFERRAL | RESELLER | SALES
     * @param {string} [params.email] - Contact email
     * @param {string} [params.contactName] - Contact person name
     * @param {number} [params.defaultRevenueSharePercent] - Default revenue share %
     * @param {Object} [params.metadata] - Additional metadata
     * @returns {Promise<Object>} Created partner
     */
    async createPartner(params) {
        const {
            name,
            partnerType,
            email = null,
            contactName = null,
            defaultRevenueSharePercent = 10,
            metadata = {}
        } = params;

        if (!name || !partnerType) {
            throw { errorCode: 'MISSING_REQUIRED', message: 'name and partnerType are required' };
        }

        if (!Object.values(PARTNER_TYPES).includes(partnerType)) {
            throw { errorCode: 'INVALID_PARTNER_TYPE', message: `Invalid partnerType: ${partnerType}` };
        }

        const id = uuidv4();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO partners 
                 (id, name, partner_type, email, contact_name, default_revenue_share_percent, metadata)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, name, partnerType, email, contactName, defaultRevenueSharePercent, JSON.stringify(metadata)],
                function (err) {
                    if (err) {
                        console.error('[PartnerService] Create error:', err);
                        return reject(err);
                    }

                    console.log(`[PartnerService] Created partner: ${name} (${partnerType})`);
                    resolve({
                        id,
                        name,
                        partnerType,
                        email,
                        contactName,
                        defaultRevenueSharePercent,
                        isActive: true,
                        metadata,
                        createdAt: new Date().toISOString()
                    });
                }
            );
        });
    },

    /**
     * Get partner by ID
     * @param {string} id - Partner ID
     * @returns {Promise<Object|null>}
     */
    async getPartner(id) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM partners WHERE id = ?`,
                [id],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve(null);

                    resolve({
                        id: row.id,
                        name: row.name,
                        partnerType: row.partner_type,
                        email: row.email,
                        contactName: row.contact_name,
                        defaultRevenueSharePercent: row.default_revenue_share_percent,
                        isActive: !!row.is_active,
                        metadata: JSON.parse(row.metadata || '{}'),
                        createdAt: row.created_at,
                        updatedAt: row.updated_at
                    });
                }
            );
        });
    },

    /**
     * List all partners
     * @param {Object} filters - Filter options
     * @returns {Promise<Array>}
     */
    async listPartners(filters = {}) {
        const { partnerType, isActive, limit = 100, offset = 0 } = filters;

        let sql = `SELECT * FROM partners WHERE 1=1`;
        const params = [];

        if (partnerType) {
            sql += ` AND partner_type = ?`;
            params.push(partnerType);
        }

        if (isActive !== undefined) {
            sql += ` AND is_active = ?`;
            params.push(isActive ? 1 : 0);
        }

        sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);

                resolve((rows || []).map(row => ({
                    id: row.id,
                    name: row.name,
                    partnerType: row.partner_type,
                    email: row.email,
                    contactName: row.contact_name,
                    defaultRevenueSharePercent: row.default_revenue_share_percent,
                    isActive: !!row.is_active,
                    createdAt: row.created_at
                })));
            });
        });
    },

    /**
     * Update partner
     * @param {string} id - Partner ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>}
     */
    async updatePartner(id, updates) {
        const allowedFields = ['name', 'email', 'contact_name', 'default_revenue_share_percent', 'is_active', 'metadata'];
        const fieldMapping = {
            contactName: 'contact_name',
            defaultRevenueSharePercent: 'default_revenue_share_percent',
            isActive: 'is_active'
        };

        const setClauses = [];
        const params = [];

        for (const [key, value] of Object.entries(updates)) {
            const dbField = fieldMapping[key] || key;
            if (allowedFields.includes(dbField)) {
                setClauses.push(`${dbField} = ?`);
                params.push(key === 'metadata' ? JSON.stringify(value) :
                    key === 'isActive' ? (value ? 1 : 0) : value);
            }
        }

        if (setClauses.length === 0) {
            return this.getPartner(id);
        }

        setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
        params.push(id);

        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE partners SET ${setClauses.join(', ')} WHERE id = ?`,
                params,
                async function (err) {
                    if (err) return reject(err);
                    if (this.changes === 0) {
                        return reject({ errorCode: 'NOT_FOUND', message: 'Partner not found' });
                    }
                    resolve(await PartnerService.getPartner(id));
                }
            );
        });
    },

    /**
     * Create a partner agreement
     * @param {Object} params - Agreement data
     * @returns {Promise<Object>}
     */
    async createAgreement(params) {
        const {
            partnerId,
            validFrom,
            validUntil = null,
            revenueSharePercent,
            appliesTo = 'GLOBAL',
            appliesValue = null
        } = params;

        if (!partnerId || !validFrom || revenueSharePercent === undefined) {
            throw { errorCode: 'MISSING_REQUIRED', message: 'partnerId, validFrom, and revenueSharePercent are required' };
        }

        const id = uuidv4();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO partner_agreements 
                 (id, partner_id, valid_from, valid_until, revenue_share_percent, applies_to, applies_value)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, partnerId, validFrom, validUntil, revenueSharePercent, appliesTo, appliesValue],
                function (err) {
                    if (err) {
                        console.error('[PartnerService] Agreement create error:', err);
                        return reject(err);
                    }

                    console.log(`[PartnerService] Created agreement for partner ${partnerId}: ${revenueSharePercent}%`);
                    resolve({
                        id,
                        partnerId,
                        validFrom,
                        validUntil,
                        revenueSharePercent,
                        appliesTo,
                        appliesValue,
                        createdAt: new Date().toISOString()
                    });
                }
            );
        });
    },

    /**
     * Get the active agreement for a partner at a specific date
     * @param {string} partnerId - Partner ID
     * @param {string} [atDate] - Date to check (ISO string, defaults to now)
     * @returns {Promise<Object|null>}
     */
    async getActiveAgreement(partnerId, atDate = null) {
        const checkDate = atDate || new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM partner_agreements 
                 WHERE partner_id = ?
                   AND valid_from <= ?
                   AND (valid_until IS NULL OR valid_until >= ?)
                 ORDER BY valid_from DESC
                 LIMIT 1`,
                [partnerId, checkDate, checkDate],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve(null);

                    resolve({
                        id: row.id,
                        partnerId: row.partner_id,
                        validFrom: row.valid_from,
                        validUntil: row.valid_until,
                        revenueSharePercent: row.revenue_share_percent,
                        appliesTo: row.applies_to,
                        appliesValue: row.applies_value,
                        createdAt: row.created_at
                    });
                }
            );
        });
    },

    /**
     * Get all agreements for a partner
     * @param {string} partnerId - Partner ID
     * @returns {Promise<Array>}
     */
    async getAgreements(partnerId) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM partner_agreements WHERE partner_id = ? ORDER BY valid_from DESC`,
                [partnerId],
                (err, rows) => {
                    if (err) return reject(err);

                    resolve((rows || []).map(row => ({
                        id: row.id,
                        partnerId: row.partner_id,
                        validFrom: row.valid_from,
                        validUntil: row.valid_until,
                        revenueSharePercent: row.revenue_share_percent,
                        appliesTo: row.applies_to,
                        appliesValue: row.applies_value,
                        createdAt: row.created_at
                    })));
                }
            );
        });
    },

    /**
     * Get partner by their partner code (for attribution lookups)
     * Partner codes link promo codes to partners
     * @param {string} partnerCode - Partner code from promo_codes table
     * @returns {Promise<Object|null>}
     */
    async getByPartnerCode(partnerCode) {
        return new Promise((resolve, reject) => {
            // Lookup partner via promo_codes table
            db.get(
                `SELECT p.* FROM partners p
                 JOIN promo_codes pc ON pc.partner_id = p.id
                 WHERE pc.code = ?
                 LIMIT 1`,
                [partnerCode.toUpperCase()],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve(null);

                    resolve({
                        id: row.id,
                        name: row.name,
                        partnerType: row.partner_type,
                        email: row.email,
                        contactName: row.contact_name,
                        defaultRevenueSharePercent: row.default_revenue_share_percent,
                        isActive: !!row.is_active,
                        metadata: JSON.parse(row.metadata || '{}')
                    });
                }
            );
        });
    }
};

module.exports = PartnerService;
