/**
 * Attribution Service
 * 
 * Central service for recording organization acquisition sources.
 * Implements IMMUTABLE append-only audit trail for:
 * - Partner settlements
 * - Marketing analytics
 * - Campaign ROI tracking
 * 
 * CRITICAL: This table should NEVER have UPDATE or DELETE operations.
 * Follows the same pattern as organization_events, legal_events, invitation_events.
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const SOURCE_TYPES = {
    PROMO_CODE: 'PROMO_CODE',
    INVITATION: 'INVITATION',
    DEMO: 'DEMO',
    SALES: 'SALES',
    SELF_SERVE: 'SELF_SERVE'
};

const AttributionService = {
    SOURCE_TYPES,

    /**
     * Record a new attribution event (append-only, never updates)
     * @param {object} params - Attribution parameters
     * @param {string} params.organizationId - Organization ID (required)
     * @param {string} params.userId - User ID (optional, for anonymous demos)
     * @param {string} params.sourceType - One of SOURCE_TYPES (required)
     * @param {string} params.sourceId - ID of source (promo_code_id, invitation_id, etc.)
     * @param {string} params.campaign - UTM campaign or similar
     * @param {string} params.partnerCode - Partner attribution code
     * @param {string} params.medium - UTM medium or channel
     * @param {object} params.metadata - Additional metadata
     * @returns {Promise<{eventId: string}>}
     */
    recordAttribution: async (params) => {
        const {
            organizationId,
            userId = null,
            sourceType,
            sourceId = null,
            campaign = null,
            partnerCode = null,
            medium = null,
            metadata = {}
        } = params;

        if (!organizationId || !sourceType) {
            throw new Error('organizationId and sourceType are required');
        }

        if (!Object.values(SOURCE_TYPES).includes(sourceType)) {
            throw new Error(`Invalid source type: ${sourceType}`);
        }

        const eventId = uuidv4();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO attribution_events (id, organization_id, user_id, source_type, source_id, campaign, partner_code, medium, metadata)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [eventId, organizationId, userId, sourceType, sourceId, campaign, partnerCode, medium, JSON.stringify(metadata)],
                function (err) {
                    if (err) {
                        console.error('[AttributionService] Record error:', err);
                        return reject(err);
                    }

                    console.log(`[AttributionService] Attribution recorded: ${sourceType} for org ${organizationId}${partnerCode ? ` (partner: ${partnerCode})` : ''}`);
                    resolve({ eventId });
                }
            );
        });
    },

    /**
     * Get all attribution events for an organization
     * @param {string} organizationId - Organization ID
     * @returns {Promise<object[]>}
     */
    getOrganizationAttribution: async (organizationId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT ae.*, u.email as user_email, u.first_name, u.last_name
                 FROM attribution_events ae
                 LEFT JOIN users u ON u.id = ae.user_id
                 WHERE ae.organization_id = ?
                 ORDER BY ae.created_at ASC`,
                [organizationId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve((rows || []).map(row => ({
                        id: row.id,
                        organizationId: row.organization_id,
                        userId: row.user_id,
                        userEmail: row.user_email,
                        userName: row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : null,
                        sourceType: row.source_type,
                        sourceId: row.source_id,
                        campaign: row.campaign,
                        partnerCode: row.partner_code,
                        medium: row.medium,
                        metadata: JSON.parse(row.metadata || '{}'),
                        createdAt: row.created_at
                    })));
                }
            );
        });
    },

    /**
     * Get the first (original) attribution for an organization
     * This is the primary source used for partner settlements
     * @param {string} organizationId - Organization ID
     * @returns {Promise<object|null>}
     */
    getFirstAttribution: async (organizationId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT ae.*, u.email as user_email
                 FROM attribution_events ae
                 LEFT JOIN users u ON u.id = ae.user_id
                 WHERE ae.organization_id = ?
                 ORDER BY ae.created_at ASC
                 LIMIT 1`,
                [organizationId],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve(null);

                    resolve({
                        id: row.id,
                        organizationId: row.organization_id,
                        userId: row.user_id,
                        userEmail: row.user_email,
                        sourceType: row.source_type,
                        sourceId: row.source_id,
                        campaign: row.campaign,
                        partnerCode: row.partner_code,
                        medium: row.medium,
                        metadata: JSON.parse(row.metadata || '{}'),
                        createdAt: row.created_at
                    });
                }
            );
        });
    },

    /**
     * Check if an organization has any attribution
     * @param {string} organizationId - Organization ID
     * @returns {Promise<boolean>}
     */
    hasAttribution: async (organizationId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT COUNT(*) as count FROM attribution_events WHERE organization_id = ?`,
                [organizationId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve((row?.count || 0) > 0);
                }
            );
        });
    },

    /**
     * Export attribution data for compliance or settlement calculations
     * @param {object} filters - Query filters
     * @param {string} filters.startDate - Start date (ISO string)
     * @param {string} filters.endDate - End date (ISO string)
     * @param {string} filters.partnerCode - Filter by partner
     * @param {string} filters.sourceType - Filter by source type
     * @returns {Promise<object[]>}
     */
    exportAttribution: async (filters = {}) => {
        const { startDate, endDate, partnerCode, sourceType } = filters;

        let query = `
            SELECT ae.*, o.name as organization_name, o.organization_type, o.created_at as org_created_at
            FROM attribution_events ae
            JOIN organizations o ON o.id = ae.organization_id
            WHERE 1=1
        `;
        const params = [];

        if (startDate) {
            query += ` AND ae.created_at >= ?`;
            params.push(startDate);
        }

        if (endDate) {
            query += ` AND ae.created_at <= ?`;
            params.push(endDate);
        }

        if (partnerCode) {
            query += ` AND ae.partner_code = ?`;
            params.push(partnerCode);
        }

        if (sourceType) {
            query += ` AND ae.source_type = ?`;
            params.push(sourceType);
        }

        query += ` ORDER BY ae.created_at DESC`;

        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve((rows || []).map(row => ({
                    eventId: row.id,
                    organizationId: row.organization_id,
                    organizationName: row.organization_name,
                    organizationType: row.organization_type,
                    organizationCreatedAt: row.org_created_at,
                    userId: row.user_id,
                    sourceType: row.source_type,
                    sourceId: row.source_id,
                    campaign: row.campaign,
                    partnerCode: row.partner_code,
                    medium: row.medium,
                    metadata: JSON.parse(row.metadata || '{}'),
                    attributedAt: row.created_at
                })));
            });
        });
    },

    /**
     * Get attribution summary by partner code
     * For partner settlement calculations
     * @param {string} startDate - Start date (ISO string)
     * @param {string} endDate - End date (ISO string)
     * @returns {Promise<object[]>}
     */
    getPartnerSummary: async (startDate = null, endDate = null) => {
        let query = `
            SELECT 
                ae.partner_code,
                COUNT(DISTINCT ae.organization_id) as organization_count,
                COUNT(*) as event_count,
                MIN(ae.created_at) as first_attribution,
                MAX(ae.created_at) as last_attribution
            FROM attribution_events ae
            WHERE ae.partner_code IS NOT NULL
        `;
        const params = [];

        if (startDate) {
            query += ` AND ae.created_at >= ?`;
            params.push(startDate);
        }

        if (endDate) {
            query += ` AND ae.created_at <= ?`;
            params.push(endDate);
        }

        query += ` GROUP BY ae.partner_code ORDER BY organization_count DESC`;

        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve((rows || []).map(row => ({
                    partnerCode: row.partner_code,
                    organizationCount: row.organization_count,
                    eventCount: row.event_count,
                    firstAttribution: row.first_attribution,
                    lastAttribution: row.last_attribution
                })));
            });
        });
    }
};

module.exports = AttributionService;
