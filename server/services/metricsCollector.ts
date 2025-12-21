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

import db from '../database';
import { v4 as uuidv4 } from 'uuid';

interface Database {
    run: (sql: string, params: unknown[], callback: (this: { lastID?: number; changes: number }, err: Error | null) => void) => void;
    all: (sql: string, params: unknown[], callback: (err: Error | null, rows: unknown[]) => void) => void;
    get: (sql: string, params: unknown[], callback: (err: Error | null, row: unknown) => void) => void;
}

interface Dependencies {
    db: Database;
    uuidv4: () => string;
}

// Dependency injection container (for deterministic unit tests)
const deps: Dependencies = {
    db: db as Database,
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
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

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
} as const;

export type SourceType = typeof SOURCE_TYPES[keyof typeof SOURCE_TYPES];

export interface EventPayload {
    userId?: string | null;
    organizationId?: string | null;
    source?: SourceType | null;
    context?: Record<string, unknown>;
}

export interface EventRecordResult {
    eventId: string;
    success: boolean;
}

export interface EventFilters {
    startDate?: string;
    endDate?: string;
    organizationId?: string;
    source?: SourceType;
    limit?: number;
    offset?: number;
}

export interface EventRecord {
    id: string;
    event_type: EventType;
    user_id?: string;
    organization_id?: string;
    source?: SourceType;
    context: Record<string, unknown>;
    created_at: string;
}

export interface OrganizationEventOptions {
    eventTypes?: EventType[];
    startDate?: string;
    endDate?: string;
    limit?: number;
}

export interface TimeSeriesOptions {
    days?: number;
}

export interface TimeSeriesRecord {
    date: string;
    count: number;
}

export interface SourceAnalysisRecord {
    source: SourceType;
    count: number;
    unique_orgs: number;
}

interface MetricsCollector {
    EVENT_TYPES: typeof EVENT_TYPES;
    SOURCE_TYPES: typeof SOURCE_TYPES;
    setDependencies: (newDeps?: Partial<Dependencies>) => void;
    recordEvent: (eventType: EventType, payload?: EventPayload) => Promise<EventRecordResult>;
    getEvents: (eventType: EventType, filters?: EventFilters) => Promise<EventRecord[]>;
    getOrganizationEvents: (organizationId: string, options?: OrganizationEventOptions) => Promise<EventRecord[]>;
    getEventCount: (eventType: EventType, filters?: EventFilters) => Promise<number>;
    getEventTimeSeries: (eventType: EventType, options?: TimeSeriesOptions) => Promise<TimeSeriesRecord[]>;
    getUniqueOrgCount: (eventType: EventType, filters?: EventFilters) => Promise<number>;
    getEventsBySource: (eventType: EventType, options?: TimeSeriesOptions) => Promise<SourceAnalysisRecord[]>;
}

const MetricsCollector: MetricsCollector = {
    EVENT_TYPES,
    SOURCE_TYPES,

    // For testing: allow overriding dependencies
    setDependencies: (newDeps: Partial<Dependencies> = {}) => {
        Object.assign(deps, newDeps);
    },

    /**
     * Record a metric event (APPEND-ONLY - no updates or deletes)
     */
    recordEvent: async (eventType: EventType, payload: EventPayload = {}): Promise<EventRecordResult> => {
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
            ], function (this: { lastID?: number; changes: number }, err: Error | null) {
                if (err) {
                    console.error(`[MetricsCollector] Failed to record event ${eventType}:`, err.message);
                    reject(err);
                } else {
                    console.log(`[MetricsCollector] Recorded event: ${eventType} (${eventId})`);
                    resolve({ eventId, success: true });
                }
            });
        });
    },

    /**
     * Get events by type with optional filters
     */
    getEvents: async (eventType: EventType, filters: EventFilters = {}): Promise<EventRecord[]> => {
        const { startDate, endDate, organizationId, source, limit = 100, offset = 0 } = filters;

        let sql = `SELECT * FROM metrics_events WHERE event_type = ?`;
        const params: unknown[] = [eventType];

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
            deps.db.all(sql, params, (err: Error | null, rows: unknown[]) => {
                if (err) {
                    reject(err);
                } else {
                    resolve((rows as EventRecord[]).map(row => ({
                        ...row,
                        context: row.context ? JSON.parse(row.context as string) : {}
                    })));
                }
            });
        });
    },

    /**
     * Get all events for a specific organization
     */
    getOrganizationEvents: async (organizationId: string, options: OrganizationEventOptions = {}): Promise<EventRecord[]> => {
        const { eventTypes, startDate, endDate, limit = 100 } = options;

        let sql = `SELECT * FROM metrics_events WHERE organization_id = ?`;
        const params: unknown[] = [organizationId];

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
            deps.db.all(sql, params, (err: Error | null, rows: unknown[]) => {
                if (err) {
                    reject(err);
                } else {
                    resolve((rows as EventRecord[]).map(row => ({
                        ...row,
                        context: row.context ? JSON.parse(row.context as string) : {}
                    })));
                }
            });
        });
    },

    /**
     * Get event count by type
     */
    getEventCount: async (eventType: EventType, filters: EventFilters = {}): Promise<number> => {
        const { startDate, endDate, organizationId, source } = filters;

        let sql = `SELECT COUNT(*) as count FROM metrics_events WHERE event_type = ?`;
        const params: unknown[] = [eventType];

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
            deps.db.get(sql, params, (err: Error | null, row: unknown) => {
                if (err) {
                    reject(err);
                } else {
                    const result = row as { count?: number };
                    resolve(result?.count || 0);
                }
            });
        });
    },

    /**
     * Get events grouped by date (for time series)
     */
    getEventTimeSeries: async (eventType: EventType, options: TimeSeriesOptions = {}): Promise<TimeSeriesRecord[]> => {
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
            deps.db.all(sql, [eventType, `-${days} days`], (err: Error | null, rows: unknown[]) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows as TimeSeriesRecord[]);
                }
            });
        });
    },

    /**
     * Get unique organization count by event type
     * Used for funnel calculations
     */
    getUniqueOrgCount: async (eventType: EventType, filters: EventFilters = {}): Promise<number> => {
        const { startDate, endDate, source } = filters;

        let sql = `
            SELECT COUNT(DISTINCT organization_id) as count 
            FROM metrics_events 
            WHERE event_type = ?
        `;
        const params: unknown[] = [eventType];

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
            deps.db.get(sql, params, (err: Error | null, row: unknown) => {
                if (err) {
                    reject(err);
                } else {
                    const result = row as { count?: number };
                    resolve(result?.count || 0);
                }
            });
        });
    },

    /**
     * Get events grouped by source (for attribution analysis)
     */
    getEventsBySource: async (eventType: EventType, options: TimeSeriesOptions = {}): Promise<SourceAnalysisRecord[]> => {
        const { startDate, endDate } = options;

        let sql = `
            SELECT 
                source,
                COUNT(*) as count,
                COUNT(DISTINCT organization_id) as unique_orgs
            FROM metrics_events
            WHERE event_type = ?
        `;
        const params: unknown[] = [eventType];

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
            (db as Database).all(sql, params, (err: Error | null, rows: unknown[]) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows as SourceAnalysisRecord[]);
                }
            });
        });
    }
};

export default MetricsCollector;

