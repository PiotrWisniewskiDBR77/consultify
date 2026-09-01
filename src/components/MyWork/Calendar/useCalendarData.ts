import { useCallback, useEffect, useState } from 'react';

import Api from '@/services/api';

import type { CalendarEvent, CalendarEventSource, CalendarFilter } from './calendarTypes';

interface UseCalendarDataReturn {
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
  filter: CalendarFilter;
  setFilter: (filter: CalendarFilter) => void;
  refetch: () => void;
}

// FIX-13 (Day 3 layer-2 acceptance, P0): 'event' (own calendar_events, via
// POST /api/my-work/calendar/events) was never in the default source list, so
// the unfiltered read never asked the server for it and no own event survived
// a reload. Server-side default fixed too (server/src/routes/my-work/
// calendar.routes.ts) — both defaults must agree since Api.getMyWorkCalendarUnified
// omits the `sources` query param entirely when nothing is filtered out.
//
// FIX-183 (day183-kalendarz-on, own event lost on reload): the "omit when
// full" optimization above assumed the server-side default it falls back to
// always matched ALL_SOURCES. It doesn't: Api.getMyWorkCalendarUnified only
// takes the legacy route (the one with 'event' support, see the FIX-13
// comment in server/src/routes/my-work/calendar.routes.ts) when the caller's
// `sources` array explicitly includes 'event'. Any request that omits
// `sources` falls through to the V8 route (server/src/routes/v8/my-work.routes.ts
// GET /calendar/unified), whose own default source list — and its event
// handling entirely — never covers 'event' at all. So a caller that reached
// "everything selected, omit the param" always lost its own calendar_events,
// no matter how ALL_SOURCES/additionalSources were combined client-side.
// Two independent bugs compounded this: CalendarView.tsx re-added 'event' to
// additionalSources even though ALL_SOURCES already carries it (harmless now
// that this list is deduped via Set, but it used to inflate filter.sources
// past ALL_SOURCES.length and always looked "filtered" instead of "full").
// The actual fix is below: stop omitting `sources` — always send the
// deduped, explicit list so a request that includes 'event' deterministically
// takes the legacy branch in Api.getMyWorkCalendarUnified instead of gambling
// on V8's default staying in sync.
const ALL_SOURCES: CalendarEventSource[] = [
  'event',
  'task',
  'initiative',
  'decision',
  'google',
  'outlook',
  'consultify',
];

export function useCalendarData(
  dateRange?: { start: string; end: string },
  refreshTrigger?: number,
  additionalSources: CalendarEventSource[] = []
): UseCalendarDataReturn {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CalendarFilter>({
    // Dedupe defensively: any future caller (or CalendarView's own
    // `includeOwnEvents ? ['event'] : []`) that repeats a source already in
    // ALL_SOURCES must not inflate filter.sources past ALL_SOURCES.length —
    // that used to make a "full" selection look "filtered" by accident.
    sources: [...new Set([...ALL_SOURCES, ...additionalSources])],
  });

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await Api.getMyWorkCalendarUnified({
        start: dateRange?.start,
        end: dateRange?.end,
        // Always pass sources explicitly (never omit). Omitting was meant to
        // mean "no filter, give me everything", but Api.getMyWorkCalendarUnified
        // only routes to the 'event'-aware legacy endpoint when `sources`
        // explicitly includes 'event' — an omitted param silently falls back
        // to the V8 endpoint, which never returns own calendar_events. See
        // the FIX-183 comment above ALL_SOURCES.
        sources: filter.sources,
        projectId: filter.projectId,
        ownership: filter.ownership,
      });
      if (res?.events) {
        setEvents(res.events);
      } else {
        setEvents([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange?.start, dateRange?.end, filter.sources, filter.projectId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents, refreshTrigger]);

  return { events, loading, error, filter, setFilter, refetch: fetchEvents };
}
