/**
 * P02 Calendar Provider Adapter Registry
 *
 * Central export for all provider adapters + dispatcher.
 */

export type { CalendarProviderAdapter, ConnectionRef, ProviderEvent, ProviderConflictError, FetchEventsResult, ProviderCalendarRef, WatchSubscription, CalendarItemPayload } from './types.js';
export { isProviderConflict } from './types.js';

import type { CalendarProviderAdapter } from './types.js';
import { googleCalendarAdapter } from './googleCalendarAdapter.js';
import { microsoftGraphCalendarAdapter } from './microsoftGraphCalendarAdapter.js';
import { caldavAdapter } from './caldavAdapter.js';

const ADAPTER_REGISTRY: Record<string, CalendarProviderAdapter> = {
  google: googleCalendarAdapter,
  microsoft: microsoftGraphCalendarAdapter,
  caldav: caldavAdapter,
};

export function getCalendarAdapter(provider: string): CalendarProviderAdapter | null {
  return ADAPTER_REGISTRY[provider] ?? null;
}

export { googleCalendarAdapter, microsoftGraphCalendarAdapter, caldavAdapter };
