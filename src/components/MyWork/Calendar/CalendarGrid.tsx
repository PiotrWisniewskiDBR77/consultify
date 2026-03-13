import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import React, { useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import './calendar-theme.css';

import type { CalendarEvent, CalendarViewMode } from './calendarTypes';
import { SOURCE_COLORS } from './calendarTypes';

interface CalendarGridProps {
  events: CalendarEvent[];
  viewMode: CalendarViewMode;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onEventClick?: (eventId: string, source: string) => void;
  onDateRangeChange?: (start: string, end: string) => void;
}

const VIEW_MAP: Record<CalendarViewMode, string> = {
  month: 'dayGridMonth',
  week: 'timeGridWeek',
  day: 'timeGridDay',
  list: 'listWeek',
};

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  events,
  viewMode,
  currentDate,
  onDateChange,
  onViewModeChange,
  onEventClick,
  onDateRangeChange,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const calendarRef = useRef<FullCalendar>(null);

  const fcEvents = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end || undefined,
        allDay: e.allDay ?? false,
        backgroundColor: e.color || SOURCE_COLORS[e.source] || '#64748b',
        borderColor: 'transparent',
        extendedProps: {
          source: e.source,
          sourceId: e.sourceId,
          status: e.status,
          priority: e.priority,
          description: e.description,
        },
      })),
    [events]
  );

  const handleEventClick = useCallback(
    (info: any) => {
      const { source, sourceId } = info.event.extendedProps;
      onEventClick?.(sourceId || info.event.id, source);
    },
    [onEventClick]
  );

  const handleDatesSet = useCallback(
    (info: any) => {
      onDateRangeChange?.(info.startStr, info.endStr);
    },
    [onDateRangeChange]
  );

  const viewButtons: { id: CalendarViewMode; label: string; labelPl: string }[] = [
    { id: 'month', label: 'Month', labelPl: 'Miesiąc' },
    { id: 'week', label: 'Week', labelPl: 'Tydzień' },
    { id: 'day', label: 'Day', labelPl: 'Dzień' },
    { id: 'list', label: 'List', labelPl: 'Lista' },
  ];

  const goToday = () => {
    const api = calendarRef.current?.getApi();
    api?.today();
    onDateChange(new Date());
  };

  const goPrev = () => {
    const api = calendarRef.current?.getApi();
    api?.prev();
    if (api) onDateChange(api.getDate());
  };

  const goNext = () => {
    const api = calendarRef.current?.getApi();
    api?.next();
    if (api) onDateChange(api.getDate());
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center gap-2">
          <button
            onClick={goToday}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-navy-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            {isPolish ? 'Dziś' : 'Today'}
          </button>
          <button
            onClick={goPrev}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            &lsaquo;
          </button>
          <button
            onClick={goNext}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            &rsaquo;
          </button>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white ml-2">
            {currentDate.toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
              month: 'long',
              year: 'numeric',
            })}
          </h3>
        </div>

        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900">
          {viewButtons.map(({ id, label, labelPl }) => (
            <button
              key={id}
              onClick={() => {
                onViewModeChange(id);
                const api = calendarRef.current?.getApi();
                api?.changeView(VIEW_MAP[id]);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === id
                  ? 'bg-white dark:bg-navy-800 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {isPolish ? labelPl : label}
            </button>
          ))}
        </div>
      </div>

      {/* FullCalendar */}
      <div className="flex-1 p-4 fc-consultify">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView={VIEW_MAP[viewMode]}
          initialDate={currentDate}
          events={fcEvents}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          headerToolbar={false}
          locale={isPolish ? 'pl' : 'en'}
          firstDay={1}
          height="auto"
          nowIndicator
          dayMaxEvents={3}
          eventDisplay="block"
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
        />
      </div>
    </div>
  );
};
