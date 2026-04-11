/**
 * P02 §2.3.11 — Provider Adapter Contract
 *
 * Shared types for all calendar provider adapters (Google, Microsoft, CalDAV).
 * Each adapter maps provider-native responses to these canonical types.
 */

import type { RecurrenceModel, SyncCheckpoint } from '../calendarInteropService.js';

export interface ConnectionRef {
  connectionId: string;
  provider: 'google' | 'microsoft' | 'caldav';
  accessToken: string;
  refreshToken?: string;
  accountRef: string;
  selectedCalendars: string[];
  serverUrl?: string;
}

export interface ProviderCalendarRef {
  calendarId: string;
  name: string;
  primary: boolean;
  accessRole: 'freeBusyReader' | 'reader' | 'writer' | 'owner';
  color?: string;
}

export interface ProviderEvent {
  providerEventId: string;
  calendarId: string;
  title: string | null;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  timezone: string | null;
  etag: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  organizer?: { email: string; self?: boolean };
  attendees?: Array<{ email: string; responseStatus: string }>;
  recurrence?: RecurrenceModel;
  iCalUID?: string;
  htmlLink?: string;
  isSeriesMaster?: boolean;
  seriesMasterId?: string;
  recurrenceId?: string;
}

export interface ProviderConflictError {
  type: 'conflict';
  providerEventId: string;
  currentEtag: string;
  providedEtag: string;
  message: string;
}

export interface CalendarItemPayload {
  title: string | null;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  timezone: string | null;
  providerEventId?: string;
  calendarId: string;
}

export interface WatchSubscription {
  subscriptionId: string;
  resourceId?: string;
  expiration: string;
  callbackUrl: string;
}

export interface FetchEventsResult {
  events: ProviderEvent[];
  nextCursor: string | null;
  fullSyncRequired: boolean;
}

export interface CalendarProviderAdapter {
  readonly providerId: 'google' | 'microsoft' | 'caldav';

  listCalendars(connection: ConnectionRef): Promise<ProviderCalendarRef[]>;

  fetchEvents(
    connection: ConnectionRef,
    window: { startAt: string; endAt: string },
    cursor?: string | null,
  ): Promise<FetchEventsResult>;

  createEvent?(
    connection: ConnectionRef,
    item: CalendarItemPayload,
    transactionId?: string,
  ): Promise<ProviderEvent>;

  updateEvent?(
    connection: ConnectionRef,
    item: CalendarItemPayload,
    providerEtag: string,
  ): Promise<ProviderEvent | ProviderConflictError>;

  deleteEvent?(
    connection: ConnectionRef,
    providerEventId: string,
    providerEtag: string,
  ): Promise<void | ProviderConflictError>;

  watchChanges?(
    connection: ConnectionRef,
    callbackUrl: string,
  ): Promise<WatchSubscription>;
}

export function isProviderConflict(value: unknown): value is ProviderConflictError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value as { type: unknown }).type === 'conflict'
  );
}
