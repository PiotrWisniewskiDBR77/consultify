/**
 * Organization Event Service
 * 
 * Immutable audit trail for organization lifecycle events.
 * Enterprise+ compliance requirement.
 * 
 * Event Types:
 * - demo_started
 * - trial_started
 * - trial_warning_sent
 * - trial_extended
 * - trial_expired_locked
 * - trial_upgraded
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const EVENT_TYPES = {
    DEMO_STARTED: 'demo_started',
    TRIAL_STARTED: 'trial_started',
    TRIAL_WARNING_SENT: 'trial_warning_sent',
    TRIAL_EXTENDED: 'trial_extended',
    TRIAL_EXPIRED_LOCKED: 'trial_expired_locked',
    TRIAL_UPGRADED: 'trial_upgraded'
};

const OrganizationEventService = {
    EVENT_TYPES,

    /**
     * Log an organization lifecycle event
     * @param {string} organizationId 
     * @param {string} eventType - One of EVENT_TYPES
     * @param {string|null} performedByUserId 
     * @param {Object} metadata - Additional event data
     * @returns {Promise<string>} - Event ID
     */
    logEvent: async (organizationId, eventType, performedByUserId = null, metadata = {}) => {
        const eventId = uuidv4();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO organization_events (id, organization_id, event_type, performed_by_user_id, metadata, created_at)
                 VALUES (?, ?, ?, ?, ?, datetime('now'))`,
                [eventId, organizationId, eventType, performedByUserId, JSON.stringify(metadata)],
                function (err) {
                    if (err) {
                        console.error('[OrgEventService] Failed to log event:', err);
                        return reject(err);
                    }
                    console.log(`[OrgEventService] Event logged: ${eventType} for org ${organizationId}`);
                    resolve(eventId);
                }
            );
        });
    },

    /**
     * Get event history for an organization
     * @param {string} organizationId 
     * @param {number} limit 
     * @returns {Promise<Array>}
     */
    getEventHistory: async (organizationId, limit = 50) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT id, event_type, performed_by_user_id, metadata, created_at
                 FROM organization_events
                 WHERE organization_id = ?
                 ORDER BY created_at DESC
                 LIMIT ?`,
                [organizationId, limit],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve((rows || []).map(row => ({
                        id: row.id,
                        eventType: row.event_type,
                        performedByUserId: row.performed_by_user_id,
                        metadata: JSON.parse(row.metadata || '{}'),
                        createdAt: row.created_at
                    })));
                }
            );
        });
    },

    /**
     * Get events by type
     * @param {string} organizationId 
     * @param {string} eventType 
     * @returns {Promise<Array>}
     */
    getEventsByType: async (organizationId, eventType) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT id, performed_by_user_id, metadata, created_at
                 FROM organization_events
                 WHERE organization_id = ? AND event_type = ?
                 ORDER BY created_at DESC`,
                [organizationId, eventType],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve((rows || []).map(row => ({
                        id: row.id,
                        performedByUserId: row.performed_by_user_id,
                        metadata: JSON.parse(row.metadata || '{}'),
                        createdAt: row.created_at
                    })));
                }
            );
        });
    },

    /**
     * Count events of a specific type
     * @param {string} organizationId 
     * @param {string} eventType 
     * @returns {Promise<number>}
     */
    countEventsByType: async (organizationId, eventType) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT COUNT(*) as count FROM organization_events WHERE organization_id = ? AND event_type = ?`,
                [organizationId, eventType],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row?.count || 0);
                }
            );
        });
    }
};

module.exports = OrganizationEventService;
