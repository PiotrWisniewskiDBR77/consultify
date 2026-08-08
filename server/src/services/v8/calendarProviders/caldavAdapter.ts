/**
 * P02 §2.3.11 — CalDAV Provider Adapter (read-only)
 *
 * Maps CalDAV/iCalendar data to the canonical CalendarProviderAdapter contract.
 * Write operations are intentionally omitted — CalDAV sources are read-only
 * within the Consultify interop layer.  Sync uses WebDAV sync-collection
 * tokens for incremental polling.
 */

import logger from '../../../utils/Logger.js';
import type {
  CalendarProviderAdapter,
  ConnectionRef,
  FetchEventsResult,
  ProviderCalendarRef,
  ProviderEvent,
} from './types.js';

const LOG_PREFIX = '[P02-CalDAV]';

type DAVCalendar = {
  url: string;
  displayName?: string | Record<string, unknown>;
  calendarColor?: string;
  syncToken?: string;
};
type DAVObject = {
  url: string;
  etag?: string;
  data?: unknown;
};
type DAVClientInstance = {
  login: () => Promise<void>;
  fetchCalendars: () => Promise<DAVCalendar[]>;
  syncCollection: (options: {
    url: string;
    props: Record<string, unknown>;
    syncToken: string;
    syncLevel: number;
  }) => Promise<Array<{ ok?: boolean; href?: string; props?: Record<string, any> }>>;
  fetchCalendarObjects: (options: {
    calendar: DAVCalendar;
    timeRange: { start: string; end: string };
  }) => Promise<DAVObject[]>;
};
type DAVClientCtor = new (options: {
  serverUrl: string;
  credentials: { username: string; password: string };
  authMethod: 'Basic';
  defaultAccountType: 'caldav';
}) => DAVClientInstance;

const DAV_NAMESPACE_SHORT = {
  CALDAV: 'caldav',
  DAV: 'DAV',
} as const;

type DateWithTimeZone = Date & { tz?: string };
type ParameterValue = string | { val?: string | null };
type VEvent = {
  type?: string;
  uid?: string;
  datetype?: string;
  status?: string;
  rrule?: { toString: () => string };
  exdate?: Record<string, DateWithTimeZone>;
  recurrenceid?: DateWithTimeZone;
  summary?: ParameterValue;
  start?: DateWithTimeZone;
  end?: DateWithTimeZone;
};
type CalendarResponse = Record<string, unknown>;

let nodeIcalModule:
  | { sync: { parseICS: (icsData: string) => CalendarResponse } }
  | null
  | undefined;
let tsdavModule: { DAVClient: DAVClientCtor } | null | undefined;

async function getNodeIcalModule(): Promise<{
  sync: { parseICS: (icsData: string) => CalendarResponse };
} | null> {
  if (nodeIcalModule !== undefined) return nodeIcalModule;
  try {
    const optionalModule = 'node-ical';
    const mod = (await import(optionalModule)) as {
      sync?: { parseICS?: (icsData: string) => CalendarResponse };
      default?: { sync?: { parseICS?: (icsData: string) => CalendarResponse } };
    };
    const resolved = mod.sync?.parseICS ? mod : mod.default;
    nodeIcalModule = resolved?.sync?.parseICS
      ? (resolved as NonNullable<typeof nodeIcalModule>)
      : null;
    return nodeIcalModule;
  } catch {
    nodeIcalModule = null;
    return null;
  }
}

async function getTsdavModule(): Promise<{ DAVClient: DAVClientCtor } | null> {
  if (tsdavModule !== undefined) return tsdavModule;
  try {
    const optionalModule = 'tsdav';
    const mod = (await import(optionalModule)) as {
      DAVClient?: DAVClientCtor;
      default?: { DAVClient?: DAVClientCtor };
    };
    const DAVClient = mod.DAVClient ?? mod.default?.DAVClient;
    tsdavModule = DAVClient ? { DAVClient } : null;
    return tsdavModule;
  } catch {
    tsdavModule = null;
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildDAVClient(connection: ConnectionRef): Promise<DAVClientInstance> {
  if (!connection.serverUrl) {
    throw new Error(`${LOG_PREFIX} serverUrl is required for CalDAV connections`);
  }

  const tsdav = await getTsdavModule();
  if (!tsdav) {
    throw new Error(`${LOG_PREFIX} tsdav dependency is required for CalDAV connections`);
  }

  const client = new tsdav.DAVClient({
    serverUrl: connection.serverUrl,
    credentials: {
      username: connection.accountRef,
      password: connection.accessToken,
    },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  });

  await client.login();
  return client;
}

function parameterValueToString(val: ParameterValue | undefined): string | null {
  if (val == null) return null;
  if (typeof val === 'string') return val;
  return val.val ?? null;
}

function dateToISO(d: DateWithTimeZone | Date | undefined): string | null {
  if (!d) return null;
  return d.toISOString();
}

function isAllDay(event: VEvent): boolean {
  return event.datetype === 'date';
}

function mapStatus(icalStatus: string | undefined): ProviderEvent['status'] {
  switch (icalStatus?.toUpperCase()) {
    case 'TENTATIVE':
      return 'tentative';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'confirmed';
  }
}

/**
 * Extract the RRULE as a plain string from the node-ical RRule wrapper.
 * `rrule.toString()` returns the RFC 5545 RRULE line including the
 * "RRULE:" prefix — strip it so callers get a bare rule string.
 */
function extractRRule(event: VEvent): string | null {
  if (!event.rrule) return null;
  const raw = event.rrule.toString();
  return raw.replace(/^RRULE:/i, '');
}

/**
 * EXDATE in node-ical is a Record<string, DateWithTimeZone>.
 * Convert to an array of ISO strings.
 */
function extractExdates(event: VEvent): string[] | null {
  if (!event.exdate || typeof event.exdate !== 'object') return null;
  const dates = Object.values(event.exdate)
    .filter((d): d is DateWithTimeZone => d instanceof Date)
    .map((d) => d.toISOString());
  return dates.length > 0 ? dates : null;
}

/**
 * RDATE may appear as a custom property on the raw component.
 * node-ical doesn't expose a dedicated rdate field, so we pull it
 * from the underlying BaseComponent bag if present.
 */
function extractRdates(event: VEvent): string[] | null {
  const raw = (event as Record<string, unknown>)['rdate'];
  if (!raw) return null;

  if (typeof raw === 'string') return [raw];

  if (Array.isArray(raw)) {
    return raw.map((d) => (d instanceof Date ? d.toISOString() : String(d)));
  }

  if (raw instanceof Date) return [raw.toISOString()];

  if (typeof raw === 'object' && raw !== null) {
    return Object.values(raw as Record<string, unknown>)
      .filter((d): d is Date => d instanceof Date)
      .map((d) => d.toISOString());
  }

  return null;
}

// ---------------------------------------------------------------------------
// iCal → ProviderEvent mapping
// ---------------------------------------------------------------------------

interface ParsedVEvents {
  masters: Map<string, { event: VEvent; calObj: DAVObject }>;
  exceptions: Map<string, Array<{ event: VEvent; calObj: DAVObject }>>;
}

async function collectVEvents(
  calendarObjects: DAVObject[],
  calendarId: string
): Promise<ParsedVEvents> {
  const masters = new Map<string, { event: VEvent; calObj: DAVObject }>();
  const exceptions = new Map<string, Array<{ event: VEvent; calObj: DAVObject }>>();
  const ical = await getNodeIcalModule();
  if (!ical) {
    throw new Error(`${LOG_PREFIX} node-ical dependency is required to parse CalDAV events`);
  }

  for (const calObj of calendarObjects) {
    if (!calObj.data) continue;

    const icsData = typeof calObj.data === 'string' ? calObj.data : String(calObj.data);
    let parsed: CalendarResponse;
    try {
      parsed = ical.sync.parseICS(icsData);
    } catch (err) {
      logger.warn(`${LOG_PREFIX} Failed to parse ICS object at ${calObj.url}`, err);
      continue;
    }

    for (const component of Object.values(parsed) as unknown[]) {
      if (!component || (component as { type?: string }).type !== 'VEVENT') continue;
      const vevent = component as VEvent;
      const uid = vevent.uid;
      if (!uid) continue;

      if (vevent.recurrenceid) {
        const list = exceptions.get(uid) ?? [];
        list.push({ event: vevent, calObj });
        exceptions.set(uid, list);
      } else {
        masters.set(uid, { event: vevent, calObj });
      }
    }
  }

  return { masters, exceptions };
}

function buildProviderEvent(
  vevent: VEvent,
  calObj: DAVObject,
  calendarId: string,
  recurrenceExceptions: Array<{ event: VEvent; calObj: DAVObject }> | undefined
): ProviderEvent {
  const uid = vevent.uid;
  const rruleStr = extractRRule(vevent);
  const isSeriesMaster = rruleStr != null;

  const pe: ProviderEvent = {
    providerEventId: uid,
    calendarId,
    title: parameterValueToString(vevent.summary),
    startAt: dateToISO(vevent.start) ?? new Date(0).toISOString(),
    endAt: dateToISO(vevent.end),
    allDay: isAllDay(vevent),
    timezone: (vevent.start as DateWithTimeZone)?.tz ?? null,
    etag: calObj.etag ?? '',
    status: mapStatus(vevent.status),
    iCalUID: uid,
    isSeriesMaster,
  };

  if (isSeriesMaster) {
    const exdates = extractExdates(vevent);
    const rdates = extractRdates(vevent);

    const mappedExceptions = (recurrenceExceptions ?? []).map((exc) => ({
      recurrenceId: dateToISO(exc.event.recurrenceid!) ?? '',
      action: (exc.event.status?.toUpperCase() === 'CANCELLED' ? 'cancelled' : 'modified') as
        | 'modified'
        | 'cancelled',
      overrides: {
        title: parameterValueToString(exc.event.summary),
        startAt: dateToISO(exc.event.start),
        endAt: dateToISO(exc.event.end),
        status: mapStatus(exc.event.status),
      },
    }));

    pe.recurrence = {
      seriesMasterRef: uid,
      rrule: rruleStr,
      rdate: rdates,
      exdate: exdates,
      exceptions: mappedExceptions,
      materializationRule: 'window_only',
    };
  }

  if (vevent.recurrenceid) {
    pe.recurrenceId = dateToISO(vevent.recurrenceid) ?? undefined;
    pe.seriesMasterId = uid;
    pe.isSeriesMaster = false;
  }

  return pe;
}

async function mapCalendarObjects(
  calendarObjects: DAVObject[],
  calendarId: string
): Promise<ProviderEvent[]> {
  const { masters, exceptions } = await collectVEvents(calendarObjects, calendarId);
  const events: ProviderEvent[] = [];

  for (const [uid, { event, calObj }] of masters) {
    events.push(buildProviderEvent(event, calObj, calendarId, exceptions.get(uid)));
  }

  for (const [uid, excList] of exceptions) {
    if (masters.has(uid)) continue;
    for (const { event, calObj } of excList) {
      events.push(buildProviderEvent(event, calObj, calendarId, undefined));
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Sync-token extraction from WebDAV responses
// ---------------------------------------------------------------------------

function extractSyncToken(responses: Array<{ props?: Record<string, any> }>): string | null {
  for (const r of responses) {
    const token =
      r.props?.['sync-token']?.value ??
      r.props?.['sync-token'] ??
      r.props?.['syncToken']?.value ??
      r.props?.['syncToken'];
    if (typeof token === 'string' && token.length > 0) return token;
  }
  return null;
}

function isSyncTokenInvalid(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('403') || msg.includes('forbidden')) return true;
    if (msg.includes('invalid') && msg.includes('sync')) return true;
    if (msg.includes('valid-sync-token')) return true;
  }

  const status = (err as { status?: number })?.status;
  if (status === 403) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Adapter implementation
// ---------------------------------------------------------------------------

export const caldavAdapter: CalendarProviderAdapter = {
  providerId: 'caldav',

  async listCalendars(connection: ConnectionRef): Promise<ProviderCalendarRef[]> {
    logger.info(`${LOG_PREFIX} listCalendars for account=${connection.accountRef}`);

    try {
      const client = await buildDAVClient(connection);
      const calendars: DAVCalendar[] = await client.fetchCalendars();

      return calendars.map((cal, idx) => {
        const displayName =
          typeof cal.displayName === 'string'
            ? cal.displayName
            : (((cal.displayName as Record<string, unknown> | undefined)?.['_cdata'] as string) ??
              cal.url);

        return {
          calendarId: cal.url,
          name: displayName,
          primary: idx === 0,
          accessRole: 'reader' as const,
          color: cal.calendarColor ?? undefined,
        };
      });
    } catch (err) {
      logger.error(`${LOG_PREFIX} listCalendars failed`, err);
      throw new Error(
        `${LOG_PREFIX} Failed to list CalDAV calendars: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  },

  async fetchEvents(
    connection: ConnectionRef,
    window: { startAt: string; endAt: string },
    cursor?: string | null
  ): Promise<FetchEventsResult> {
    logger.info(
      `${LOG_PREFIX} fetchEvents window=${window.startAt}..${window.endAt} cursor=${cursor ? 'present' : 'none'}`
    );

    try {
      const client = await buildDAVClient(connection);
      const calendars = await client.fetchCalendars();

      const allEvents: ProviderEvent[] = [];
      let latestSyncToken: string | null = null;

      for (const cal of calendars) {
        const calendarId = cal.url;

        if (
          connection.selectedCalendars.length > 0 &&
          !connection.selectedCalendars.includes(calendarId)
        ) {
          continue;
        }

        if (cursor) {
          // Incremental sync via WebDAV sync-collection
          try {
            const syncResponses = await client.syncCollection({
              url: calendarId,
              props: {
                [`${DAV_NAMESPACE_SHORT.CALDAV}:calendar-data`]: {},
                [`${DAV_NAMESPACE_SHORT.DAV}:getetag`]: {},
              },
              syncToken: cursor,
              syncLevel: 1,
            });

            const token = extractSyncToken(syncResponses);
            if (token) latestSyncToken = token;

            const calObjects: DAVObject[] = syncResponses
              .filter((r) => r.ok && r.href)
              .map((r) => ({
                url: r.href!,
                etag: r.props?.getetag?.value ?? r.props?.getetag ?? '',
                data: r.props?.['calendar-data']?.value ?? r.props?.['calendar-data'] ?? '',
              }));

            allEvents.push(...(await mapCalendarObjects(calObjects, calendarId)));
          } catch (syncErr) {
            if (isSyncTokenInvalid(syncErr)) {
              logger.warn(
                `${LOG_PREFIX} Sync token invalid/rejected for ${calendarId}, requesting full sync`
              );
              return { events: [], nextCursor: null, fullSyncRequired: true };
            }
            throw syncErr;
          }
        } else {
          // Full fetch with time-range filter
          const calObjects = await client.fetchCalendarObjects({
            calendar: cal,
            timeRange: {
              start: window.startAt,
              end: window.endAt,
            },
          });

          allEvents.push(...(await mapCalendarObjects(calObjects, calendarId)));

          if (cal.syncToken) {
            latestSyncToken = cal.syncToken;
          }
        }
      }

      return {
        events: allEvents,
        nextCursor: latestSyncToken,
        fullSyncRequired: false,
      };
    } catch (err) {
      if (isSyncTokenInvalid(err)) {
        logger.warn(`${LOG_PREFIX} Sync token rejected globally, requesting full sync`);
        return { events: [], nextCursor: null, fullSyncRequired: true };
      }

      logger.error(`${LOG_PREFIX} fetchEvents failed`, err);
      throw new Error(
        `${LOG_PREFIX} Failed to fetch CalDAV events: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  },
};
