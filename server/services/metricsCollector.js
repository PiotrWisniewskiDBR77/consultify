/**
 * Metrics Collector Service
 *
 * STEP 7: Metrics & Conversion Intelligence (Enterprise+)
 *
 * Single point of entry for all metric event recording.
 * This service implements an APPEND-ONLY event store for business intelligence.
 *
 * CRITICAL: This is the ONLY service that should write to metrics_events.
 * Never UPDATE or DELETE events - all analytics are derived from the event stream.
 *
 * Event Sources:
 * - trialService: trial_started, trial_extended, trial_expired, upgraded_to_paid
 * - invitationService: invite_sent, invite_accepted
 * - helpService: help_started, help_completed
 * - settlementService: settlement_generated
 * - demoService: demo_started
 *
 * @module metricsCollector
 */
import db from '../database.js';
import { v4 as uuidv4 } from 'uuid';
// Dependency injection container (for deterministic unit tests)
const deps = {
    db: db,
    uuidv4
};
/**
 * Event type constants
 */
export const EVENT_TYPES = {
    // Trial lifecycle events
    TRIAL_STARTED: 'trial_started',
    TRIAL_EXTENDED: 'trial_extended',
    TRIAL_EXPIRED: 'trial_expired',
    UPGRADED_TO_PAID: 'upgraded_to_paid',
    // Demo events
    DEMO_STARTED: 'demo_started',
    // Invitation events
    INVITE_SENT: 'invite_sent',
    INVITE_ACCEPTED: 'invite_accepted',
    // Help/Playbook events
    HELP_STARTED: 'help_started',
    HELP_COMPLETED: 'help_completed',
    // Settlement events
    SETTLEMENT_GENERATED: 'settlement_generated'
};
/**
 * Source type constants (attribution sources)
 */
export const SOURCE_TYPES = {
    DEMO: 'DEMO',
    TRIAL: 'TRIAL',
    INVITATION: 'INVITATION',
    PROMO: 'PROMO',
    PARTNER: 'PARTNER',
    SELF_SERVE: 'SELF_SERVE',
    HELP: 'HELP'
};
const MetricsCollector = {
    EVENT_TYPES,
    SOURCE_TYPES,
    // For testing: allow overriding dependencies
    setDependencies: (newDeps = {}) => {
        Object.assign(deps, newDeps);
    },
    /**
     * Record a metric event (APPEND-ONLY - no updates or deletes)
     */
    recordEvent: async (eventType, payload = {}) => {
        // Validate event type
        if (!Object.values(EVENT_TYPES).includes(eventType)) {
            console.warn(`[MetricsCollector] Unknown event type: ${eventType}`);
        }
        const eventId = deps.uuidv4();
        const { userId = null, organizationId = null, source = null, context = {} } = payload;
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO metrics_events (id, event_type, user_id, organization_id, source, context, created_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            `;
            deps.db.run(sql, [
                eventId,
                eventType,
                userId,
                organizationId,
                source,
                JSON.stringify(context)
            ], function (err) {
                if (err) {
                    console.error(`[MetricsCollector] Failed to record event ${eventType}:`, err.message);
                    reject(err);
                }
                else {
                    console.log(`[MetricsCollector] Recorded event: ${eventType} (${eventId})`);
                    resolve({ eventId, success: true });
                }
            });
        });
    },
    /**
     * Get events by type with optional filters
     */
    getEvents: async (eventType, filters = {}) => {
        const { startDate, endDate, organizationId, source, limit = 100, offset = 0 } = filters;
        let sql = `SELECT * FROM metrics_events WHERE event_type = ?`;
        const params = [eventType];
        if (startDate) {
            sql += ` AND created_at >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            sql += ` AND created_at <= ?`;
            params.push(endDate);
        }
        if (organizationId) {
            sql += ` AND organization_id = ?`;
            params.push(organizationId);
        }
        if (source) {
            sql += ` AND source = ?`;
            params.push(source);
        }
        sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);
        return new Promise((resolve, reject) => {
            deps.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(rows.map(row => ({
                        ...row,
                        context: row.context ? JSON.parse(row.context) : {}
                    })));
                }
            });
        });
    },
    /**
     * Get all events for a specific organization
     */
    getOrganizationEvents: async (organizationId, options = {}) => {
        const { eventTypes, startDate, endDate, limit = 100 } = options;
        let sql = `SELECT * FROM metrics_events WHERE organization_id = ?`;
        const params = [organizationId];
        if (eventTypes && eventTypes.length > 0) {
            sql += ` AND event_type IN (${eventTypes.map(() => '?').join(',')})`;
            params.push(...eventTypes);
        }
        if (startDate) {
            sql += ` AND created_at >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            sql += ` AND created_at <= ?`;
            params.push(endDate);
        }
        sql += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(limit);
        return new Promise((resolve, reject) => {
            deps.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(rows.map(row => ({
                        ...row,
                        context: row.context ? JSON.parse(row.context) : {}
                    })));
                }
            });
        });
    },
    /**
     * Get event count by type
     */
    getEventCount: async (eventType, filters = {}) => {
        const { startDate, endDate, organizationId, source } = filters;
        let sql = `SELECT COUNT(*) as count FROM metrics_events WHERE event_type = ?`;
        const params = [eventType];
        if (startDate) {
            sql += ` AND created_at >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            sql += ` AND created_at <= ?`;
            params.push(endDate);
        }
        if (organizationId) {
            sql += ` AND organization_id = ?`;
            params.push(organizationId);
        }
        if (source) {
            sql += ` AND source = ?`;
            params.push(source);
        }
        return new Promise((resolve, reject) => {
            deps.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                }
                else {
                    const result = row;
                    resolve(result?.count || 0);
                }
            });
        });
    },
    /**
     * Get events grouped by date (for time series)
     */
    getEventTimeSeries: async (eventType, options = {}) => {
        const { days = 30 } = options;
        const sql = `
            SELECT 
                date(created_at) as date,
                COUNT(*) as count
            FROM metrics_events
            WHERE event_type = ?
              AND created_at >= datetime('now', ?)
            GROUP BY date(created_at)
            ORDER BY date ASC
        `;
        return new Promise((resolve, reject) => {
            deps.db.all(sql, [eventType, `-${days} days`], (err, rows) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(rows);
                }
            });
        });
    },
    /**
     * Get unique organization count by event type
     * Used for funnel calculations
     */
    getUniqueOrgCount: async (eventType, filters = {}) => {
        const { startDate, endDate, source } = filters;
        let sql = `
            SELECT COUNT(DISTINCT organization_id) as count 
            FROM metrics_events 
            WHERE event_type = ?
        `;
        const params = [eventType];
        if (startDate) {
            sql += ` AND created_at >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            sql += ` AND created_at <= ?`;
            params.push(endDate);
        }
        if (source) {
            sql += ` AND source = ?`;
            params.push(source);
        }
        return new Promise((resolve, reject) => {
            deps.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                }
                else {
                    const result = row;
                    resolve(result?.count || 0);
                }
            });
        });
    },
    /**
     * Get events grouped by source (for attribution analysis)
     */
    getEventsBySource: async (eventType, options = {}) => {
        const { startDate, endDate } = options;
        let sql = `
            SELECT 
                source,
                COUNT(*) as count,
                COUNT(DISTINCT organization_id) as unique_orgs
            FROM metrics_events
            WHERE event_type = ?
        `;
        const params = [eventType];
        if (startDate) {
            sql += ` AND created_at >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            sql += ` AND created_at <= ?`;
            params.push(endDate);
        }
        sql += ` GROUP BY source ORDER BY count DESC`;
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(rows);
                }
            });
        });
    }
};
export default MetricsCollector;
//# sourceMappingURL=metricsCollector.js.map