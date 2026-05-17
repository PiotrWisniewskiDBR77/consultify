/**
 * P02 §2.3.11 — Microsoft Graph Calendar Adapter
 *
 * Maps Microsoft Graph Calendar API responses to the canonical
 * CalendarProviderAdapter contract used by the calendar interop layer.
 */

import logger from '../../../utils/Logger.js';
import type { RecurrenceModel } from '../calendarInteropService.js';
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

const LOG_PREFIX = '[P02-MicrosoftGraph]';

type GraphRequest = {
  select: (fields: string) => GraphRequest;
  header: (name: string, value: string) => GraphRequest;
  get: () => Promise<Record<string, unknown>>;
  post: (body: unknown) => Promise<unknown>;
  patch: (body: unknown) => Promise<unknown>;
  delete: () => Promise<unknown>;
};
type GraphClient = {
  api: (path: string) => GraphRequest;
};
type GraphClientCtor = {
  init: (options: { authProvider: (done: (error: Error | null, token?: string) => void) => void }) => GraphClient;
};

let graphClientCtor: GraphClientCtor | null | undefined;

/* -------------------------------------------------------------------------- */
/*  Graph client factory                                                      */
/* -------------------------------------------------------------------------- */

async function getGraphClientCtor(): Promise<GraphClientCtor | null> {
  if (graphClientCtor !== undefined) return graphClientCtor;
  try {
    const optionalModule = '@microsoft/microsoft-graph-client';
    const mod = (await import(optionalModule)) as {
      Client?: GraphClientCtor;
      default?: { Client?: GraphClientCtor };
    };
    graphClientCtor = mod.Client ?? mod.default?.Client ?? null;
    return graphClientCtor;
  } catch {
    graphClientCtor = null;
    return null;
  }
}

async function buildGraphClient(connection: ConnectionRef): Promise<GraphClient> {
  const Client = await getGraphClientCtor();
  if (!Client) {
    throw new Error(
      `${LOG_PREFIX} @microsoft/microsoft-graph-client dependency is required for Microsoft Graph`
    );
  }

  return Client.init({
    authProvider: (done) => {
      done(null, connection.accessToken);
    },
  });
}

/* -------------------------------------------------------------------------- */
/*  Graph → ProviderEvent mapping helpers                                     */
/* -------------------------------------------------------------------------- */

const GRAPH_STATUS_MAP: Record<string, ProviderEvent['status']> = {
  organizer: 'confirmed',
  accepted: 'confirmed',
  tentativelyAccepted: 'tentative',
  declined: 'cancelled',
  notResponded: 'tentative',
};

function mapStatus(graphResponseStatus?: string): ProviderEvent['status'] {
  if (!graphResponseStatus) return 'confirmed';
  return GRAPH_STATUS_MAP[graphResponseStatus] ?? 'confirmed';
}

function mapAccessRole(calendar: Record<string, unknown>): ProviderCalendarRef['accessRole'] {
  if (calendar.isDefaultCalendar) return 'owner';
  const permission = calendar.calendarPermission as string | undefined;
  if (permission === 'read') return 'reader';
  if (permission === 'freeBusyRead') return 'freeBusyReader';
  return 'writer';
}

/* -------------------------------------------------------------------------- */
/*  Recurrence mapping: Graph pattern/range → RRULE string                    */
/* -------------------------------------------------------------------------- */

const GRAPH_DAY_MAP: Record<string, string> = {
  sunday: 'SU',
  monday: 'MO',
  tuesday: 'TU',
  wednesday: 'WE',
  thursday: 'TH',
  friday: 'FR',
  saturday: 'SA',
};

function graphRecurrenceToRrule(
  pattern: Record<string, unknown>,
  range: Record<string, unknown>
): string {
  const parts: string[] = [];

  const patternType = pattern.type as string;
  switch (patternType) {
    case 'daily':
      parts.push('FREQ=DAILY');
      break;
    case 'weekly':
      parts.push('FREQ=WEEKLY');
      break;
    case 'absoluteMonthly':
    case 'relativeMonthly':
      parts.push('FREQ=MONTHLY');
      break;
    case 'absoluteYearly':
    case 'relativeYearly':
      parts.push('FREQ=YEARLY');
      break;
    default:
      parts.push('FREQ=DAILY');
  }

  const interval = pattern.interval as number | undefined;
  if (interval && interval > 1) {
    parts.push(`INTERVAL=${interval}`);
  }

  const daysOfWeek = pattern.daysOfWeek as string[] | undefined;
  if (daysOfWeek?.length) {
    const mapped = daysOfWeek
      .map((d) => GRAPH_DAY_MAP[d.toLowerCase()] ?? d.slice(0, 2).toUpperCase())
      .join(',');
    parts.push(`BYDAY=${mapped}`);
  }

  const dayOfMonth = pattern.dayOfMonth as number | undefined;
  if (dayOfMonth && (patternType === 'absoluteMonthly' || patternType === 'absoluteYearly')) {
    parts.push(`BYMONTHDAY=${dayOfMonth}`);
  }

  const month = pattern.month as number | undefined;
  if (month && (patternType === 'absoluteYearly' || patternType === 'relativeYearly')) {
    parts.push(`BYMONTH=${month}`);
  }

  const rangeType = range.type as string;
  if (rangeType === 'endDate' && range.endDate) {
    const untilStr = (range.endDate as string).replace(/-/g, '');
    parts.push(`UNTIL=${untilStr}T235959Z`);
  } else if (rangeType === 'numbered' && range.numberOfOccurrences) {
    parts.push(`COUNT=${range.numberOfOccurrences}`);
  }

  return parts.join(';');
}

function mapRecurrence(event: Record<string, unknown>): RecurrenceModel | undefined {
  const recurrence = event.recurrence as
    | { pattern: Record<string, unknown>; range: Record<string, unknown> }
    | undefined;
  if (!recurrence?.pattern || !recurrence?.range) return undefined;

  const rrule = graphRecurrenceToRrule(recurrence.pattern, recurrence.range);
  return {
    seriesMasterRef: event.id as string,
    rrule,
    rdate: null,
    exdate: null,
    exceptions: [],
    materializationRule: 'window_only',
  };
}

/* -------------------------------------------------------------------------- */
/*  Graph event → ProviderEvent                                               */
/* -------------------------------------------------------------------------- */

function mapGraphEvent(event: Record<string, unknown>, calendarId: string): ProviderEvent {
  const start = event.start as { dateTime: string; timeZone: string } | undefined;
  const end = event.end as { dateTime: string; timeZone: string } | undefined;
  const isAllDay = event.isAllDay as boolean;
  const organizer = event.organizer as { emailAddress?: { address: string } } | undefined;
  const attendees = event.attendees as
    | Array<{
        emailAddress: { address: string };
        status: { response: string };
      }>
    | undefined;

  const isSeriesMaster = event.type === 'seriesMaster';
  const isSingleInstance = event.type === 'singleInstance';

  const mapped: ProviderEvent = {
    providerEventId: event.id as string,
    calendarId,
    title: (event.subject as string) ?? null,
    startAt: start?.dateTime ?? '',
    endAt: end?.dateTime ?? null,
    allDay: isAllDay ?? false,
    timezone: start?.timeZone ?? null,
    etag: (event['@odata.etag'] as string) ?? '',
    status: event.isCancelled
      ? 'cancelled'
      : mapStatus((event.responseStatus as { response?: string } | undefined)?.response),
    iCalUID: event.iCalUId as string | undefined,
    htmlLink: event.webLink as string | undefined,
  };

  if (organizer?.emailAddress) {
    mapped.organizer = {
      email: organizer.emailAddress.address,
      self: event.isOrganizer as boolean | undefined,
    };
  }

  if (attendees?.length) {
    mapped.attendees = attendees.map((a) => ({
      email: a.emailAddress.address,
      responseStatus: a.status.response,
    }));
  }

  if (isSeriesMaster) {
    mapped.isSeriesMaster = true;
    mapped.recurrence = mapRecurrence(event);
  } else if (!isSingleInstance) {
    mapped.seriesMasterId = event.seriesMasterId as string | undefined;
  }

  return mapped;
}

/* -------------------------------------------------------------------------- */
/*  Error handling helpers                                                    */
/* -------------------------------------------------------------------------- */

interface GraphApiError extends Error {
  statusCode?: number;
  code?: string;
  body?: string;
}

function extractStatusCode(error: unknown): number | undefined {
  const e = error as GraphApiError;
  return e.statusCode ?? (e as unknown as { status?: number }).status;
}

function throwOnAuthError(error: unknown): never {
  const status = extractStatusCode(error);
  if (status === 401) {
    const err = new Error(`${LOG_PREFIX} Authentication failed – access token expired or revoked`);
    (err as GraphApiError).statusCode = 401;
    throw err;
  }
  throw error;
}

function throwOnRateLimitError(error: unknown): never {
  const status = extractStatusCode(error);
  if (status === 429) {
    const err = new Error(`${LOG_PREFIX} Rate limited by Microsoft Graph API`);
    (err as GraphApiError).statusCode = 429;
    throw err;
  }
  throw error;
}

function handleApiError(error: unknown): never {
  const status = extractStatusCode(error);
  if (status === 401) throwOnAuthError(error);
  if (status === 429) throwOnRateLimitError(error);
  throw error;
}

function isConflictOrPreconditionFailed(error: unknown): boolean {
  const status = extractStatusCode(error);
  return status === 412 || status === 409;
}

function isDeltaTokenExpired(error: unknown): boolean {
  const status = extractStatusCode(error);
  if (status === 410) return true;
  const msg = ((error as Error).message ?? '').toLowerCase();
  return msg.includes('syncstatenotfound') || msg.includes('invalidsynctoken');
}

/* -------------------------------------------------------------------------- */
/*  Graph payload builder                                                     */
/* -------------------------------------------------------------------------- */

function buildEventBody(item: CalendarItemPayload): Record<string, unknown> {
  const body: Record<string, unknown> = {
    subject: item.title,
    isAllDay: item.allDay,
  };

  if (item.allDay) {
    body.start = { dateTime: item.startAt, timeZone: item.timezone ?? 'UTC' };
    body.end = item.endAt
      ? { dateTime: item.endAt, timeZone: item.timezone ?? 'UTC' }
      : { dateTime: item.startAt, timeZone: item.timezone ?? 'UTC' };
  } else {
    body.start = { dateTime: item.startAt, timeZone: item.timezone ?? 'UTC' };
    body.end = item.endAt ? { dateTime: item.endAt, timeZone: item.timezone ?? 'UTC' } : undefined;
  }

  return body;
}

/* -------------------------------------------------------------------------- */
/*  Adapter implementation                                                    */
/* -------------------------------------------------------------------------- */

export const microsoftGraphCalendarAdapter: CalendarProviderAdapter = {
  providerId: 'microsoft',

  /* ── listCalendars ────────────────────────────────────────────────────── */

  async listCalendars(connection: ConnectionRef): Promise<ProviderCalendarRef[]> {
    logger.debug(`${LOG_PREFIX} listCalendars for account=${connection.accountRef}`);

    const client = await buildGraphClient(connection);

    try {
      const response = await client
        .api('/me/calendars')
        .select('id,name,isDefaultCalendar,color,canEdit,owner')
        .get();

      const calendars = (response.value ?? []) as Array<Record<string, unknown>>;

      return calendars.map(
        (cal): ProviderCalendarRef => ({
          calendarId: cal.id as string,
          name: cal.name as string,
          primary: (cal.isDefaultCalendar as boolean) ?? false,
          accessRole: mapAccessRole(cal),
          color: cal.color as string | undefined,
        })
      );
    } catch (error) {
      logger.error(`${LOG_PREFIX} listCalendars failed`, { error });
      handleApiError(error);
    }
  },

  /* ── fetchEvents (delta sync) ─────────────────────────────────────────── */

  async fetchEvents(
    connection: ConnectionRef,
    window: { startAt: string; endAt: string },
    cursor?: string | null
  ): Promise<FetchEventsResult> {
    logger.debug(`${LOG_PREFIX} fetchEvents cursor=${cursor ? 'deltaLink' : 'initial'}`, {
      window,
    });

    const client = await buildGraphClient(connection);
    const allEvents: ProviderEvent[] = [];
    let nextCursor: string | null = null;

    try {
      let response: Record<string, unknown>;

      if (cursor) {
        try {
          response = await client.api(cursor).get();
        } catch (deltaError) {
          if (isDeltaTokenExpired(deltaError)) {
            logger.warn(`${LOG_PREFIX} Delta token expired, full sync required`);
            return { events: [], nextCursor: null, fullSyncRequired: true };
          }
          throw deltaError;
        }
      } else {
        const startDateTime = encodeURIComponent(window.startAt);
        const endDateTime = encodeURIComponent(window.endAt);
        response = await client
          .api(`/me/calendarView/delta?startDateTime=${startDateTime}&endDateTime=${endDateTime}`)
          .get();
      }

      let page = response;
      while (page) {
        const events = (page.value ?? []) as Array<Record<string, unknown>>;
        for (const event of events) {
          const calId = (event.parentFolderId as string) ?? connection.selectedCalendars[0] ?? '';
          allEvents.push(mapGraphEvent(event, calId));
        }

        const nextLink = page['@odata.nextLink'] as string | undefined;
        const deltaLink = page['@odata.deltaLink'] as string | undefined;

        if (nextLink) {
          page = await client.api(nextLink).get();
        } else {
          nextCursor = deltaLink ?? null;
          break;
        }
      }

      return { events: allEvents, nextCursor, fullSyncRequired: false };
    } catch (error) {
      if (isDeltaTokenExpired(error)) {
        logger.warn(`${LOG_PREFIX} Delta sync error (410 Gone), full sync required`);
        return { events: [], nextCursor: null, fullSyncRequired: true };
      }
      logger.error(`${LOG_PREFIX} fetchEvents failed`, { error });
      handleApiError(error);
    }
  },

  /* ── createEvent ──────────────────────────────────────────────────────── */

  async createEvent(
    connection: ConnectionRef,
    item: CalendarItemPayload,
    transactionId?: string
  ): Promise<ProviderEvent> {
    logger.debug(`${LOG_PREFIX} createEvent calendar=${item.calendarId}`, {
      transactionId,
    });

    const client = await buildGraphClient(connection);
    const body = buildEventBody(item);

    if (transactionId) {
      (body as Record<string, unknown>).transactionId = transactionId;
    }

    try {
      const apiPath = item.calendarId
        ? `/me/calendars/${item.calendarId}/events`
        : '/me/calendar/events';
      let request = client.api(apiPath);
      if (transactionId) {
        request = request.header('Prefer', 'IdType="ImmutableId"');
      }

      const created = await request.post(body);
      return mapGraphEvent(created as Record<string, unknown>, item.calendarId);
    } catch (error) {
      logger.error(`${LOG_PREFIX} createEvent failed`, { error });
      handleApiError(error);
    }
  },

  /* ── updateEvent ──────────────────────────────────────────────────────── */

  async updateEvent(
    connection: ConnectionRef,
    item: CalendarItemPayload,
    providerEtag: string
  ): Promise<ProviderEvent | ProviderConflictError> {
    logger.debug(`${LOG_PREFIX} updateEvent id=${item.providerEventId}`);

    if (!item.providerEventId) {
      throw new Error(`${LOG_PREFIX} updateEvent requires providerEventId on the item`);
    }

    const client = await buildGraphClient(connection);
    const body = buildEventBody(item);

    try {
      const updated = await client
        .api(`/me/calendar/events/${item.providerEventId}`)
        .header('If-Match', providerEtag)
        .patch(body);

      return mapGraphEvent(updated as Record<string, unknown>, item.calendarId);
    } catch (error) {
      if (isConflictOrPreconditionFailed(error)) {
        logger.warn(`${LOG_PREFIX} ETag conflict on updateEvent id=${item.providerEventId}`);
        return {
          type: 'conflict',
          providerEventId: item.providerEventId,
          currentEtag: 'unknown',
          providedEtag: providerEtag,
          message: `Concurrent modification detected for event ${item.providerEventId}`,
        };
      }
      logger.error(`${LOG_PREFIX} updateEvent failed`, { error });
      handleApiError(error);
    }
  },

  /* ── deleteEvent ──────────────────────────────────────────────────────── */

  async deleteEvent(
    connection: ConnectionRef,
    providerEventId: string,
    providerEtag: string
  ): Promise<void | ProviderConflictError> {
    logger.debug(`${LOG_PREFIX} deleteEvent id=${providerEventId}`);

    const client = await buildGraphClient(connection);

    try {
      await client
        .api(`/me/calendar/events/${providerEventId}`)
        .header('If-Match', providerEtag)
        .delete();
    } catch (error) {
      if (isConflictOrPreconditionFailed(error)) {
        logger.warn(`${LOG_PREFIX} ETag conflict on deleteEvent id=${providerEventId}`);
        return {
          type: 'conflict',
          providerEventId,
          currentEtag: 'unknown',
          providedEtag: providerEtag,
          message: `Concurrent modification detected for event ${providerEventId}`,
        };
      }
      logger.error(`${LOG_PREFIX} deleteEvent failed`, { error });
      handleApiError(error);
    }
  },

  /* ── watchChanges ─────────────────────────────────────────────────────── */

  async watchChanges(connection: ConnectionRef, callbackUrl: string): Promise<WatchSubscription> {
    logger.debug(`${LOG_PREFIX} watchChanges callbackUrl=${callbackUrl}`);

    const client = await buildGraphClient(connection);

    const expirationDateTime = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    const subscriptionPayload = {
      changeType: 'created,updated,deleted',
      notificationUrl: callbackUrl,
      resource: '/me/calendar/events',
      expirationDateTime,
    };

    try {
      const subscription = (await client.api('/subscriptions').post(subscriptionPayload)) as Record<
        string,
        unknown
      >;

      return {
        subscriptionId: subscription.id as string,
        resourceId: subscription.resource as string | undefined,
        expiration: subscription.expirationDateTime as string,
        callbackUrl,
      };
    } catch (error) {
      logger.error(`${LOG_PREFIX} watchChanges failed`, { error });
      handleApiError(error);
    }
  },
};
