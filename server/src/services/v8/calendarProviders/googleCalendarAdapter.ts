/**
 * P02 §2.3.11 — Google Calendar Provider Adapter
 *
 * Maps Google Calendar API v3 to the canonical CalendarProviderAdapter contract.
 * Handles OAuth2 auth, incremental sync via syncTokens, recurrence mapping,
 * and ETag-based optimistic concurrency on writes.
 */

import { v4 as uuidv4 } from 'uuid';

import logger from '../../../utils/Logger.js';
import type {
  CalendarItemPayload,
  CalendarProviderAdapter,
  ConnectionRef,
  FetchEventsResult,
  ProviderCalendarRef,
  ProviderConflictError,
  ProviderEvent,
  WatchSubscription,
} from './types.js';

const LOG_PREFIX = '[P02-GoogleCalendar]';

type GoogleAuthClient = {
  setCredentials: (credentials: { access_token: string }) => void;
};
type GoogleCalendarEvent = {
  id?: string;
  summary?: string | null;
  recurrence?: string[];
  start?: { dateTime?: string | null; date?: string | null; timeZone?: string | null };
  end?: { dateTime?: string | null; date?: string | null; timeZone?: string | null };
  etag?: string | null;
  status?: string | null;
  organizer?: { email?: string | null; self?: boolean | null };
  attendees?: Array<{ email?: string | null; responseStatus?: string | null }>;
  iCalUID?: string | null;
  htmlLink?: string | null;
  recurringEventId?: string | null;
  originalStartTime?: { dateTime?: string | null; date?: string | null };
};
type GoogleCalendarClient = {
  calendarList: {
    list: (params: { maxResults: number }) => Promise<{ data: { items?: Array<any> } }>;
  };
  events: {
    list: (params: Record<string, unknown>) => Promise<{
      data: {
        items?: GoogleCalendarEvent[];
        nextPageToken?: string | null;
        nextSyncToken?: string | null;
      };
    }>;
    insert: (params: {
      calendarId: string;
      requestBody: GoogleCalendarEvent;
    }) => Promise<{ data: GoogleCalendarEvent }>;
    update: Function;
    delete: Function;
    watch: (params: {
      calendarId: string;
      requestBody: { id: string; type: 'web_hook'; address: string };
    }) => Promise<{ data: { resourceId?: string | null; expiration?: string | null } }>;
  };
};
type GoogleApi = {
  auth: { OAuth2: new () => GoogleAuthClient };
  calendar: (options: { version: 'v3'; auth: GoogleAuthClient }) => GoogleCalendarClient;
};

let googleApiModule: GoogleApi | null | undefined;

async function getGoogleApi(): Promise<GoogleApi | null> {
  if (googleApiModule !== undefined) return googleApiModule;
  try {
    const optionalModule = 'googleapis';
    const mod = (await import(optionalModule)) as {
      google?: GoogleApi;
      default?: { google?: GoogleApi };
    };
    googleApiModule = mod.google ?? mod.default?.google ?? null;
    return googleApiModule;
  } catch {
    googleApiModule = null;
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildCalendarClient(connection: ConnectionRef): Promise<GoogleCalendarClient> {
  const google = await getGoogleApi();
  if (!google) {
    throw new Error(`${LOG_PREFIX} googleapis dependency is required for Google Calendar`);
  }
  const oauth2 = new google.auth.OAuth2();
  oauth2.setCredentials({ access_token: connection.accessToken });
  return google.calendar({ version: 'v3', auth: oauth2 });
}

function parseCursorMap(cursor: string): Record<string, string> {
  try {
    const parsed = JSON.parse(cursor);
    if (typeof parsed === 'object' && parsed !== null) return parsed as Record<string, string>;
  } catch {
    /* not JSON — treat as legacy single token */
  }
  return {};
}

const ACCESS_ROLE_MAP: Record<string, ProviderCalendarRef['accessRole']> = {
  freeBusyReader: 'freeBusyReader',
  reader: 'reader',
  writer: 'writer',
  owner: 'owner',
};

function mapAccessRole(role: string | undefined | null): ProviderCalendarRef['accessRole'] {
  return ((role && ACCESS_ROLE_MAP[role]) ?? 'reader') as ProviderCalendarRef['accessRole'];
}

function mapEventStatus(status: string | undefined | null): ProviderEvent['status'] {
  if (status === 'tentative') return 'tentative';
  if (status === 'cancelled') return 'cancelled';
  return 'confirmed';
}

function extractRecurrence(event: GoogleCalendarEvent) {
  const lines = event.recurrence;
  if (!lines || lines.length === 0) return undefined;

  let rrule: string | null = null;
  const rdate: string[] = [];
  const exdate: string[] = [];

  for (const line of lines) {
    if (line.startsWith('RRULE:')) {
      rrule = line.slice('RRULE:'.length);
    } else if (line.startsWith('RDATE')) {
      rdate.push(line);
    } else if (line.startsWith('EXDATE')) {
      exdate.push(line);
    }
  }

  return {
    seriesMasterRef: event.id!,
    rrule,
    rdate: rdate.length > 0 ? rdate : null,
    exdate: exdate.length > 0 ? exdate : null,
    exceptions: [] as Array<{
      recurrenceId: string;
      action: 'modified' | 'cancelled';
      overrides?: Record<string, unknown>;
    }>,
    materializationRule: 'window_only' as const,
  };
}

function mapGoogleEvent(event: GoogleCalendarEvent, calendarId: string): ProviderEvent {
  const isAllDay = !event.start?.dateTime;
  const startAt = event.start?.dateTime ?? event.start?.date ?? '';
  const endAt = event.end?.dateTime ?? event.end?.date ?? null;
  const timezone = event.start?.timeZone ?? null;

  const recurrence = extractRecurrence(event);
  const isSeriesMaster = !!event.recurrence && event.recurrence.length > 0;
  const seriesMasterId = event.recurringEventId ?? undefined;

  return {
    providerEventId: event.id!,
    calendarId,
    title: event.summary ?? null,
    startAt,
    endAt,
    allDay: isAllDay,
    timezone,
    etag: event.etag ?? '',
    status: mapEventStatus(event.status),
    organizer: event.organizer
      ? { email: event.organizer.email!, self: event.organizer.self ?? undefined }
      : undefined,
    attendees: event.attendees?.map((a: any) => ({
      email: a.email!,
      responseStatus: a.responseStatus ?? 'needsAction',
    })),
    recurrence,
    iCalUID: event.iCalUID ?? undefined,
    htmlLink: event.htmlLink ?? undefined,
    isSeriesMaster,
    seriesMasterId,
    recurrenceId: event.originalStartTime?.dateTime ?? event.originalStartTime?.date ?? undefined,
  };
}

function isGaxiosError(
  err: unknown
): err is { code: number; message: string; response?: { data?: unknown } } {
  return typeof err === 'object' && err !== null && 'code' in err;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const googleCalendarAdapter: CalendarProviderAdapter = {
  providerId: 'google',

  // -----------------------------------------------------------------------
  // listCalendars
  // -----------------------------------------------------------------------
  async listCalendars(connection: ConnectionRef): Promise<ProviderCalendarRef[]> {
    logger.info(`${LOG_PREFIX} listCalendars for account=${connection.accountRef}`);
    const cal = await buildCalendarClient(connection);

    try {
      const res = await cal.calendarList.list({ maxResults: 250 });
      const items = res.data.items ?? [];

      return items.map((entry: any) => ({
        calendarId: entry.id!,
        name: entry.summary ?? entry.id!,
        primary: entry.primary === true,
        accessRole: mapAccessRole(entry.accessRole),
        color: entry.backgroundColor ?? undefined,
      }));
    } catch (err) {
      logger.error(`${LOG_PREFIX} listCalendars failed`, err);
      throw err;
    }
  },

  // -----------------------------------------------------------------------
  // fetchEvents
  // -----------------------------------------------------------------------
  async fetchEvents(
    connection: ConnectionRef,
    window: { startAt: string; endAt: string },
    cursor?: string | null
  ): Promise<FetchEventsResult> {
    const cal = await buildCalendarClient(connection);
    const allEvents: ProviderEvent[] = [];
    const nextCursorMap: Record<string, string> = {};

    const cursorMap: Record<string, string> = cursor ? parseCursorMap(cursor) : {};

    for (const calendarId of connection.selectedCalendars) {
      const calCursor = cursorMap[calendarId] ?? null;
      logger.debug(
        `${LOG_PREFIX} fetchEvents calendar=${calendarId} cursor=${calCursor ? 'sync' : 'initial'}`
      );

      try {
        let pageToken: string | undefined;
        let nextSyncToken: string | null = null;

        do {
          const params: Record<string, unknown> = {
            calendarId,
            maxResults: 2500,
            pageToken,
          };

          if (calCursor) {
            params.syncToken = calCursor;
          } else {
            params.timeMin = window.startAt;
            params.timeMax = window.endAt;
            params.singleEvents = false;
          }

          const res = await cal.events.list(params);
          const items = res.data.items ?? [];

          for (const item of items) {
            if (!item.id) continue;
            allEvents.push(mapGoogleEvent(item, calendarId));
          }

          pageToken = res.data.nextPageToken ?? undefined;
          if (res.data.nextSyncToken) {
            nextSyncToken = res.data.nextSyncToken;
          }
        } while (pageToken);

        if (nextSyncToken) nextCursorMap[calendarId] = nextSyncToken;
      } catch (err) {
        if (isGaxiosError(err) && err.code === 410) {
          logger.warn(
            `${LOG_PREFIX} syncToken expired (410 Gone) for calendar=${calendarId}, full sync required`
          );
          return { events: [], nextCursor: null, fullSyncRequired: true };
        }
        logger.error(`${LOG_PREFIX} fetchEvents failed for calendar=${calendarId}`, err);
        throw err;
      }
    }

    const serialized = Object.keys(nextCursorMap).length > 0 ? JSON.stringify(nextCursorMap) : null;
    return { events: allEvents, nextCursor: serialized, fullSyncRequired: false };
  },

  // -----------------------------------------------------------------------
  // createEvent
  // -----------------------------------------------------------------------
  async createEvent(connection: ConnectionRef, item: CalendarItemPayload): Promise<ProviderEvent> {
    logger.info(`${LOG_PREFIX} createEvent on calendar=${item.calendarId}`);
    const cal = await buildCalendarClient(connection);

    const body: GoogleCalendarEvent = {
      summary: item.title ?? undefined,
      start: item.allDay
        ? { date: item.startAt.slice(0, 10) }
        : { dateTime: item.startAt, timeZone: item.timezone ?? undefined },
      end: item.endAt
        ? item.allDay
          ? { date: item.endAt.slice(0, 10) }
          : { dateTime: item.endAt, timeZone: item.timezone ?? undefined }
        : undefined,
    };

    try {
      const res = await cal.events.insert({
        calendarId: item.calendarId,
        requestBody: body,
      });

      return mapGoogleEvent(res.data, item.calendarId);
    } catch (err) {
      logger.error(`${LOG_PREFIX} createEvent failed`, err);
      throw err;
    }
  },

  // -----------------------------------------------------------------------
  // updateEvent
  // -----------------------------------------------------------------------
  async updateEvent(
    connection: ConnectionRef,
    item: CalendarItemPayload,
    providerEtag: string
  ): Promise<ProviderEvent | ProviderConflictError> {
    logger.info(
      `${LOG_PREFIX} updateEvent id=${item.providerEventId} on calendar=${item.calendarId}`
    );
    const cal = await buildCalendarClient(connection);

    const body: GoogleCalendarEvent = {
      summary: item.title ?? undefined,
      start: item.allDay
        ? { date: item.startAt.slice(0, 10) }
        : { dateTime: item.startAt, timeZone: item.timezone ?? undefined },
      end: item.endAt
        ? item.allDay
          ? { date: item.endAt.slice(0, 10) }
          : { dateTime: item.endAt, timeZone: item.timezone ?? undefined }
        : undefined,
    };

    try {
      const res = await (cal.events.update as Function)({
        calendarId: item.calendarId,
        eventId: item.providerEventId!,
        requestBody: body,
        headers: { 'If-Match': providerEtag },
      });

      return mapGoogleEvent(res.data, item.calendarId);
    } catch (err) {
      if (isGaxiosError(err) && err.code === 412) {
        logger.warn(`${LOG_PREFIX} updateEvent 412 conflict for id=${item.providerEventId}`);
        return {
          type: 'conflict',
          providerEventId: item.providerEventId!,
          currentEtag: 'unknown',
          providedEtag: providerEtag,
          message: `ETag mismatch on update: server rejected If-Match ${providerEtag}`,
        };
      }
      logger.error(`${LOG_PREFIX} updateEvent failed`, err);
      throw err;
    }
  },

  // -----------------------------------------------------------------------
  // deleteEvent
  // -----------------------------------------------------------------------
  async deleteEvent(
    connection: ConnectionRef,
    providerEventId: string,
    providerEtag: string
  ): Promise<void | ProviderConflictError> {
    logger.info(`${LOG_PREFIX} deleteEvent id=${providerEventId}`);
    const cal = await buildCalendarClient(connection);

    try {
      await (cal.events.delete as Function)({
        calendarId: connection.selectedCalendars[0],
        eventId: providerEventId,
        headers: { 'If-Match': providerEtag },
      });
    } catch (err) {
      if (isGaxiosError(err) && err.code === 412) {
        logger.warn(`${LOG_PREFIX} deleteEvent 412 conflict for id=${providerEventId}`);
        return {
          type: 'conflict',
          providerEventId,
          currentEtag: 'unknown',
          providedEtag: providerEtag,
          message: `ETag mismatch on delete: server rejected If-Match ${providerEtag}`,
        };
      }
      logger.error(`${LOG_PREFIX} deleteEvent failed`, err);
      throw err;
    }
  },

  // -----------------------------------------------------------------------
  // watchChanges
  // -----------------------------------------------------------------------
  async watchChanges(connection: ConnectionRef, callbackUrl: string): Promise<WatchSubscription> {
    logger.info(`${LOG_PREFIX} watchChanges callback=${callbackUrl}`);
    const cal = await buildCalendarClient(connection);

    const channelId = uuidv4();
    const calendarId = connection.selectedCalendars[0];

    try {
      const res = await cal.events.watch({
        calendarId,
        requestBody: {
          id: channelId,
          type: 'web_hook',
          address: callbackUrl,
        },
      });

      return {
        subscriptionId: channelId,
        resourceId: res.data.resourceId ?? undefined,
        expiration: res.data.expiration
          ? new Date(Number(res.data.expiration)).toISOString()
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        callbackUrl,
      };
    } catch (err) {
      logger.error(`${LOG_PREFIX} watchChanges failed`, err);
      throw err;
    }
  },
};
