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
interface Database {
    run: (sql: string, params: unknown[], callback: (this: {
        lastID?: number;
        changes: number;
    }, err: Error | null) => void) => void;
    all: (sql: string, params: unknown[], callback: (err: Error | null, rows: unknown[]) => void) => void;
    get: (sql: string, params: unknown[], callback: (err: Error | null, row: unknown) => void) => void;
}
interface Dependencies {
    db: Database;
    uuidv4: () => string;
}
/**
 * Event type constants
 */
export declare const EVENT_TYPES: {
    readonly TRIAL_STARTED: "trial_started";
    readonly TRIAL_EXTENDED: "trial_extended";
    readonly TRIAL_EXPIRED: "trial_expired";
    readonly UPGRADED_TO_PAID: "upgraded_to_paid";
    readonly DEMO_STARTED: "demo_started";
    readonly INVITE_SENT: "invite_sent";
    readonly INVITE_ACCEPTED: "invite_accepted";
    readonly HELP_STARTED: "help_started";
    readonly HELP_COMPLETED: "help_completed";
    readonly SETTLEMENT_GENERATED: "settlement_generated";
};
export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];
/**
 * Source type constants (attribution sources)
 */
export declare const SOURCE_TYPES: {
    readonly DEMO: "DEMO";
    readonly TRIAL: "TRIAL";
    readonly INVITATION: "INVITATION";
    readonly PROMO: "PROMO";
    readonly PARTNER: "PARTNER";
    readonly SELF_SERVE: "SELF_SERVE";
    readonly HELP: "HELP";
};
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
declare const MetricsCollector: MetricsCollector;
export default MetricsCollector;
//# sourceMappingURL=metricsCollector.d.ts.map