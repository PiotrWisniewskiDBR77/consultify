import { Loader2 } from 'lucide-react';
import React, { useCallback, useState } from 'react';

import { CalendarGrid } from './CalendarGrid';
import { CalendarSidebar } from './CalendarSidebar';
import type { CalendarViewMode } from './calendarTypes';
import { useCalendarData } from './useCalendarData';

interface CalendarViewProps {
  refreshTrigger?: number;
  onTaskClick?: (id: string) => void;
  onDecisionClick?: (id: string) => void;
  onInitiativeClick?: (id: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  refreshTrigger,
  onTaskClick,
  onDecisionClick,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | undefined>();

  const { events, loading, filter, setFilter } = useCalendarData(dateRange, refreshTrigger);

  const handleEventClick = useCallback(
    (eventId: string, source: string) => {
      if (source === 'task') onTaskClick?.(eventId);
      else if (source === 'decision') onDecisionClick?.(eventId);
    },
    [onTaskClick, onDecisionClick]
  );

  const handleDateRangeChange = useCallback((start: string, end: string) => {
    setDateRange({ start, end });
  }, []);

  return (
    <div className="flex h-full bg-white dark:bg-navy-950">
      <CalendarSidebar
        filter={filter}
        onFilterChange={setFilter}
        currentDate={currentDate}
        onDateChange={setCurrentDate}
      />
      <div className="flex-1 flex flex-col min-w-0 relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-navy-950/50 z-10 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-primary-400" />
          </div>
        )}
        <CalendarGrid
          events={events}
          viewMode={viewMode}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          onViewModeChange={setViewMode}
          onEventClick={handleEventClick}
          onDateRangeChange={handleDateRangeChange}
        />
      </div>
    </div>
  );
};
