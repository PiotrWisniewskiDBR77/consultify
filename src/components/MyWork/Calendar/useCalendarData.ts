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

const ALL_SOURCES: CalendarEventSource[] = ['task', 'initiative', 'decision', 'google', 'outlook', 'consultify'];

export function useCalendarData(
  dateRange?: { start: string; end: string },
  refreshTrigger?: number
): UseCalendarDataReturn {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CalendarFilter>({ sources: ALL_SOURCES });

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateRange?.start) params.set('start', dateRange.start);
      if (dateRange?.end) params.set('end', dateRange.end);
      if (filter.sources.length < ALL_SOURCES.length) {
        params.set('sources', filter.sources.join(','));
      }
      if (filter.projectId) params.set('projectId', filter.projectId);

      const res = await Api.get(`/my-work/calendar/unified?${params.toString()}`);
      if (res?.data?.events) {
        setEvents(res.data.events);
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
