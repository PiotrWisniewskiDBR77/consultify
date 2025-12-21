/**
 * Legal Event Logger
 * 
 * Append-only audit trail for legal compliance events.
 * CRITICAL: This service only appends records - never updates or deletes.
 * 
 * Used for:
 * - ISO/SOC2 compliance audits
 * - Enterprise procurement due diligence
 * - Legal department reviews
 */

// Dependency injection for testing
const deps = {
    db: require('../database'),
    uuidv4: require('uuid').v4
};

/**
 * Legal Event Types
 * Exhaustive list of auditable legal compliance actions
 */
const EVENT_TYPES = {
    // Document lifecycle events
    PUBLISH: 'publish',
    ACTIVATE: 'activate',
    DEACTIVATE: 'deactivate',
    ROLLBACK: 'rollback',

    // Acceptance events
    ACCEPT: 'accept',
    ORG_ACCEPT_COMPLETE: 'org_accept_complete',
    REJECT: 'reject',

    // Administrative events
    FORCE_REACCEPT: 'force_reaccept',
    SCOPE_CHANGE: 'scope_change',
    LIFECYCLE_UPDATE: 'lifecycle_update'
};

const LegalEventLogger = {
    /**
     * Allow dependency injection for testing
     */
    _setDependencies: (newDeps) => {
        Object.assign(deps, newDeps);
    },

    /**
     * Log a legal event (append-only)
     * 
     * @param {Object} params - Event parameters
     * @param {string} params.eventType - One of EVENT_TYPES
     * @param {string} [params.documentId] - Related document ID
     * @param {string} [params.documentVersion] - Related document version
     * @param {string} [params.userId] - Affected user ID
     * @param {string} [params.organizationId] - Affected organization ID
     * @param {string} params.performedBy - Actor who triggered the event (userId or 'system')
     * @param {Object} [params.metadata] - Additional event context
     * @returns {Promise<string>} Event ID
     */
    log: ({ eventType, documentId, documentVersion, userId, organizationId, performedBy, metadata = {} }) => {
        return new Promise((resolve, reject) => {
            const eventId = deps.uuidv4();

            // Validate event type
            if (!Object.values(EVENT_TYPES).includes(eventType)) {
                console.warn(`[LegalEventLogger] Unknown event type: ${eventType}`);
            }

            const sql = `
                INSERT INTO legal_events 
                (id, event_type, document_id, document_version, user_id, organization_id, performed_by, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            deps.db.run(sql, [
                eventId,
                eventType,
                documentId || null,
                documentVersion || null,
                userId || null,
                organizationId || null,
                performedBy,
                JSON.stringify(metadata)
            ], function (err) {
                if (err) {
                    console.error('[LegalEventLogger] Failed to log event:', err);
                    // Don't reject - logging failures shouldn't break operations
                    resolve(null);
                } else {
                    resolve(eventId);
                }
            });
        });
    },

    /**
     * Log document publish event
     */
    logPublish: (documentId, documentVersion, performedBy, metadata = {}) => {
        return LegalEventLogger.log({
            eventType: EVENT_TYPES.PUBLISH,
            documentId,
            documentVersion,
            performedBy,
            metadata: {
                ...metadata,
                action: 'New document version published'
            }
        });
    },

    /**
     * Log document activation
     */
    logActivate: (documentId, documentVersion, performedBy, metadata = {}) => {
        return LegalEventLogger.log({
            eventType: EVENT_TYPES.ACTIVATE,
            documentId,
            documentVersion,
            performedBy,
            metadata: {
                ...metadata,
                action: 'Document activated for enforcement'
            }
        });
    },

    /**
     * Log document deactivation
     */
    logDeactivate: (documentId, documentVersion, performedBy, metadata = {}) => {
        return LegalEventLogger.log({
            eventType: EVENT_TYPES.DEACTIVATE,
            documentId,
            documentVersion,
            performedBy,
            metadata: {
                ...metadata,
                action: 'Document deactivated'
            }
        });
    },

    /**
     * Log user acceptance
     */
    logAccept: (documentId, documentVersion, userId, organizationId, performedBy, metadata = {}) => {
        return LegalEventLogger.log({
            eventType: EVENT_TYPES.ACCEPT,
            documentId,
            documentVersion,
            userId,
            organizationId,
            performedBy,
            metadata: {
                ...metadata,
                action: 'User accepted document'
            }
        });
    },

    /**
     * Log organization acceptance completion
     */
    logOrgAcceptComplete: (documentId, documentVersion, organizationId, performedBy, metadata = {}) => {
        return LegalEventLogger.log({
            eventType: EVENT_TYPES.ORG_ACCEPT_COMPLETE,
            documentId,
            documentVersion,
            organizationId,
            performedBy,
            metadata: {
                ...metadata,
                action: 'Organization-wide acceptance completed'
            }
        });
    },

    /**
     * Log forced re-acceptance requirement
     */
    logForceReaccept: (documentId, documentVersion, performedBy, reacceptFrom, metadata = {}) => {
        return LegalEventLogger.log({
            eventType: EVENT_TYPES.FORCE_REACCEPT,
            documentId,
            documentVersion,
            performedBy,
            metadata: {
                ...metadata,
                reaccept_required_from: reacceptFrom,
                action: 'Forced re-acceptance required'
            }
        });
    },

    /**
     * Get events with filters (for audit export)
     * 
     * @param {Object} filters - Query filters
     * @returns {Promise<Array>} Matching events
     */
    getEvents: ({ organizationId, userId, documentId, eventTypes, dateFrom, dateTo, limit = 1000 }) => {
        return new Promise((resolve, reject) => {
            let sql = 'SELECT * FROM legal_events WHERE 1=1';
            const params = [];

            if (organizationId) {
                sql += ' AND organization_id = ?';
                params.push(organizationId);
            }

            if (userId) {
                sql += ' AND user_id = ?';
                params.push(userId);
            }

            if (documentId) {
                sql += ' AND document_id = ?';
                params.push(documentId);
            }

            if (eventTypes && eventTypes.length > 0) {
                sql += ` AND event_type IN (${eventTypes.map(() => '?').join(',')})`;
                params.push(...eventTypes);
            }

            if (dateFrom) {
                sql += ' AND created_at >= ?';
                params.push(dateFrom);
            }

            if (dateTo) {
                sql += ' AND created_at <= ?';
                params.push(dateTo);
            }

            sql += ' ORDER BY created_at DESC LIMIT ?';
            params.push(limit);

            deps.db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    /**
     * Get event count by type (for dashboard)
     */
    getEventStats: (organizationId = null, days = 30) => {
        return new Promise((resolve, reject) => {
            let sql = `
                SELECT event_type, COUNT(*) as count
                FROM legal_events
                WHERE created_at >= datetime('now', '-${days} days')
            `;
            const params = [];

            if (organizationId) {
                sql += ' AND organization_id = ?';
                params.push(organizationId);
            }

            sql += ' GROUP BY event_type';

            deps.db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    }
};

module.exports = { LegalEventLogger, EVENT_TYPES };
