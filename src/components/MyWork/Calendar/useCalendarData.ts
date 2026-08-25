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
    sources: [...ALL_SOURCES, ...additionalSources],
  });

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await Api.getMyWorkCalendarUnified({
        start: dateRange?.start,
        end: dateRange?.end,
        sources: filter.sources.length < ALL_SOURCES.length ? filter.sources : undefined,
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
