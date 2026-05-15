/**
 * P02 Calendar Provider Adapter Registry
 *
 * Central export for all provider adapters + dispatcher.
 */

export type {
  CalendarItemPayload,
  CalendarProviderAdapter,
  ConnectionRef,
  FetchEventsResult,
  ProviderCalendarRef,
  ProviderConflictError,
  ProviderEvent,
  WatchSubscription,
} from './types.js';
export { isProviderConflict } from './types.js';

import { caldavAdapter } from './caldavAdapter.js';
import { googleCalendarAdapter } from './googleCalendarAdapter.js';
import { microsoftGraphCalendarAdapter } from './microsoftGraphCalendarAdapter.js';
import type { CalendarProviderAdapter } from './types.js';

const ADAPTER_REGISTRY: Record<string, CalendarProviderAdapter> = {
  google: googleCalendarAdapter,
  microsoft: microsoftGraphCalendarAdapter,
  caldav: caldavAdapter,
};

export function getCalendarAdapter(provider: string): CalendarProviderAdapter | null {
  return ADAPTER_REGISTRY[provider] ?? null;
}

export { caldavAdapter, googleCalendarAdapter, microsoftGraphCalendarAdapter };
