/**
 * Metrics Collector Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Migrated from server/services/metricsCollector.js (ES Modules) to TypeScript (ES Modules)
 * STEP 7: Metrics & Conversion Intelligence (Enterprise+)
 *
 * Single point of entry for all metric event recording.
 * This service implements an APPEND-ONLY event store for business intelligence.
 *
 * CRITICAL: This is the ONLY service that should write to metrics_events.
 * Never UPDATE or DELETE events - all analytics are derived from the event stream.
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

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
  SETTLEMENT_GENERATED: 'settlement_generated',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

export const SOURCE_TYPES = {
  DEMO: 'DEMO',
  TRIAL: 'TRIAL',
  INVITATION: 'INVITATION',
  PROMO: 'PROMO',
  PARTNER: 'PARTNER',
  SELF_SERVE: 'SELF_SERVE',
  HELP: 'HELP',
} as const;

export type SourceType = (typeof SOURCE_TYPES)[keyof typeof SOURCE_TYPES];

interface RecordEventPayload {
  userId?: string | null;
  organizationId?: string | null;
  source?: SourceType | null;
  context?: Record<string, unknown>;
}

interface RecordEventResult {
  eventId: string;
  success: boolean;
}

interface GetEventsFilters {
  startDate?: string;
  endDate?: string;
  organizationId?: string;
  source?: SourceType;
  limit?: number;
  offset?: number;
}

interface GetOrganizationEventsOptions {
  eventTypes?: EventType[];
  startDate?: string;
  endDate?: string;
  limit?: number;
}

interface GetEventCountFilters {
  startDate?: string;
  endDate?: string;
  organizationId?: string;
  source?: SourceType;
}

interface GetEventTimeSeriesOptions {
  days?: number;
}

interface GetEventsBySourceOptions {
  startDate?: string;
  endDate?: string;
}

interface MetricsEventRow {
  id: string;
  event_type: string;
  user_id?: string | null;
  organization_id?: string | null;
  source?: string | null;
  context?: string;
  created_at: string;
}

interface EventCountRow {
  count: number;
}

interface TimeSeriesRow {
  date: string;
  count: number;
}

interface EventsBySourceRow {
  source: string;
  count: number;
  unique_orgs: number;
}

interface UniqueOrgCountRow {
  count: number;
}

// ==========================================
// SERVICE
// ==========================================

let db: IDatabase = getDatabase();

/**
 * Set database instance (for testing)
 */
export function setDependencies(newDeps: { db?: IDatabase } = {}): void {
  if (newDeps.db) {
    db = newDeps.db;
  }
}

/**
 * Record a metric event (APPEND-ONLY - no updates or deletes)
 */
export async function recordEvent(
  eventType: EventType,
  payload: RecordEventPayload = {}
): Promise<RecordEventResult> {
  // Validate event type
  if (!Object.values(EVENT_TYPES).includes(eventType)) {
    logger.warn(`[MetricsCollector] Unknown event type: ${eventType}`);
  }

  const eventId = uuidv4();
  const { userId = null, organizationId = null, source = null, context = {} } = payload;

  await DbPromise.run(
    db,
    `INSERT INTO metrics_events (id, event_type, user_id, organization_id, source, context, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    [eventId, eventType, userId, organizationId, source, JSON.stringify(context)]
  );

  logger.info(`[MetricsCollector] Recorded event: ${eventType} (${eventId})`);

  return { eventId, success: true };
}

/**
 * Get events by type with optional filters
 */
export async function getEvents(
  eventType: EventType,
  filters: GetEventsFilters = {}
): Promise<MetricsEventRow[]> {
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

  const rows = await DbPromise.all<MetricsEventRow>(db, sql, params);

  return rows.map((row) => ({
    ...row,
    context: row.context ? JSON.parse(row.context) : {},
  }));
}

/**
 * Get all events for a specific organization
 */
export async function getOrganizationEvents(
  organizationId: string,
  options: GetOrganizationEventsOptions = {}
): Promise<MetricsEventRow[]> {
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

  const rows = await DbPromise.all<MetricsEventRow>(db, sql, params);

  return rows.map((row) => ({
    ...row,
    context: row.context ? JSON.parse(row.context) : {},
  }));
}

/**
 * Get event count by type
 */
export async function getEventCount(
  eventType: EventType,
  filters: GetEventCountFilters = {}
): Promise<number> {
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

  const row = await DbPromise.get<EventCountRow>(db, sql, params);

  return row?.count || 0;
}

/**
 * Get events grouped by date (for time series)
 */
export async function getEventTimeSeries(
  eventType: EventType,
  options: GetEventTimeSeriesOptions = {}
): Promise<TimeSeriesRow[]> {
  const { days = 30 } = options;

  const rows = await DbPromise.all<TimeSeriesRow>(
    db,
    `SELECT
            date(created_at) as date,
            COUNT(*) as count
        FROM metrics_events
        WHERE event_type = ?
          AND created_at >= NOW() - make_interval(days => ?)
        GROUP BY date(created_at)
        ORDER BY date ASC`,
    [eventType, days]
  );

  return rows;
}

/**
 * Get unique organization count by event type
 * Used for funnel calculations
 */
export async function getUniqueOrgCount(
  eventType: EventType,
  filters: GetEventCountFilters = {}
): Promise<number> {
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

  const row = await DbPromise.get<UniqueOrgCountRow>(db, sql, params);

  return row?.count || 0;
}

/**
 * Get events grouped by source (for attribution analysis)
 */
export async function getEventsBySource(
  eventType: EventType,
  options: GetEventsBySourceOptions = {}
): Promise<EventsBySourceRow[]> {
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

  const rows = await DbPromise.all<EventsBySourceRow>(db, sql, params);

  return rows;
}

// Default export for backward compatibility
const MetricsCollector = {
  EVENT_TYPES,
  SOURCE_TYPES,
  setDependencies,
  recordEvent,
  getEvents,
  getOrganizationEvents,
  getEventCount,
  getEventTimeSeries,
  getUniqueOrgCount,
  getEventsBySource,
};

export default MetricsCollector;
