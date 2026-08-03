import './calendar-theme.css';

import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import React, { useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { CalendarEvent, CalendarEventSource, CalendarViewMode } from './calendarTypes';
import { SOURCE_COLORS } from './calendarTypes';

const SOURCE_ICONS: Partial<Record<CalendarEventSource, string>> = {
  google: 'https://www.gstatic.com/images/branding/product/1x/calendar_2020q4_48dp.png',
  outlook: 'https://img.icons8.com/fluency/48/microsoft-outlook-2019.png',
};

const CONSULTIFY_BADGE = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="6" fill="#1e3a5f" />
    <text x="12" y="17" textAnchor="middle" fontSize="14" fontWeight="700" fill="white">
      C
    </text>
  </svg>
);

interface CalendarGridProps {
  events: CalendarEvent[];
  viewMode: CalendarViewMode;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onEventClick?: (eventId: string, source: string) => void;
  onDateRangeChange?: (start: string, end: string) => void;
  onEventMove?: (payload: {
    source: string;
    sourceId: string;
    start: string;
    end?: string;
    allDay?: boolean;
    etag?: string;
    expectedVersion?: string;
  }) => Promise<boolean>;
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
  onEventMove,
}) => {
  const { t } = useTranslation();
  const calendarRef = useRef<FullCalendar>(null);

  const fcEvents = useMemo(
    () =>
      events.map((e) => {
        const isFreeBusy = e.visibilityClass === 'free_busy_only';
        const isConflict = e.syncState === 'conflict';
        const classNames: string[] = [];
        if (e.status === 'ai_suggestion') classNames.push('fc-ai-focus');
        if (isFreeBusy) classNames.push('fc-free-busy');
        if (isConflict) classNames.push('fc-conflict');
        if (e.editAuthority === 'none') classNames.push('fc-readonly');

        return {
          id: e.id,
          title: isFreeBusy ? t('myWork.calendarGrid.busy', 'Busy') : e.title,
          start: e.start,
          end: e.end || undefined,
          allDay: e.allDay ?? false,
          backgroundColor: e.color || SOURCE_COLORS[e.source] || '#64748b',
          borderColor: isConflict
            ? 'var(--c-danger)'
            : e.status === 'ai_suggestion'
              ? 'var(--c-accent)'
              : 'transparent',
          classNames,
          editable: e.editAuthority !== 'none' && e.editAuthority !== undefined,
          extendedProps: {
            source: e.source,
            sourceId: e.sourceId,
            status: e.status,
            priority: e.priority,
            description: isFreeBusy ? undefined : e.description,
            editAuthority: e.editAuthority,
            syncState: e.syncState,
            permissionGradient: e.permissionGradient,
            visibilityClass: e.visibilityClass,
            etag: e.etag,
            projectName: e.projectName,
            provider: e.provider,
            version: e.version,
          },
        };
      }),
    [events, t]
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

  const handleEventDrop = useCallback(
    async (info: any) => {
      if (!onEventMove) return;
      const source = String(info?.event?.extendedProps?.source || '');
      const sourceId = String(info?.event?.extendedProps?.sourceId || info?.event?.id || '');
      const etag = info?.event?.extendedProps?.etag;
      const version = info?.event?.extendedProps?.version;
      const start = info?.event?.start ? new Date(info.event.start).toISOString() : '';
      const end = info?.event?.end ? new Date(info.event.end).toISOString() : undefined;
      const allDay = Boolean(info?.event?.allDay);

      const ok = await onEventMove({
        source,
        sourceId,
        start,
        end,
        allDay,
        etag: typeof etag === 'string' ? etag : undefined,
        expectedVersion: typeof version === 'string' ? version : undefined,
      });
      if (!ok) {
        info.revert();
      }
    },
    [onEventMove]
  );

  const renderEventContent = useCallback((arg: any) => {
    const source: CalendarEventSource | undefined = arg.event.extendedProps?.source;
    const iconUrl = source ? SOURCE_ICONS[source] : undefined;
    const isConsultify = source === 'consultify';
    const hasBadge = iconUrl || isConsultify;
    const projectName: string | undefined = arg.event.extendedProps?.projectName || undefined;
    const provider: string | undefined = arg.event.extendedProps?.provider || undefined;
    // Explicit project/provider lineage (MW-07 gate): visible, not hover-only \u2014
    // an honest 'internal' marker rather than a fabricated Google/Outlook badge.
    const lineageText = [projectName, provider === 'internal' ? 'Internal' : provider]
      .filter(Boolean)
      .join(' \u00B7 ');

    return (
      <div
        className="fc-event-main-frame"
        style={{ position: 'relative', overflow: 'hidden', width: '100%', height: '100%' }}
        title={lineageText || undefined}
      >
        {arg.timeText && <div className="fc-event-time">{arg.timeText}</div>}
        <div className="fc-event-title-container">
          <div className="fc-event-title fc-sticky">{arg.event.title || '\u00A0'}</div>
          {lineageText && (
            <div
              className="fc-event-lineage"
              style={{ fontSize: '10px', opacity: 0.85, lineHeight: 1.2 }}
            >
              {lineageText}
            </div>
          )}
        </div>
        {hasBadge && (
          <span
            className="fc-source-badge"
            style={{
              position: 'absolute',
              bottom: 2,
              right: 3,
              width: 14,
              height: 14,
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.85,
              pointerEvents: 'none',
            }}
          >
            {iconUrl ? (
              <img src={iconUrl} alt="" width={14} height={14} style={{ borderRadius: 3 }} />
            ) : (
              CONSULTIFY_BADGE
            )}
          </span>
        )}
      </div>
    );
  }, []);

  const viewButtons: { id: CalendarViewMode; label: string }[] = [
    { id: 'month', label: t('myWork.calendarGrid.viewMonth') },
    { id: 'week', label: t('myWork.calendarGrid.viewWeek') },
    { id: 'day', label: t('myWork.calendarGrid.viewDay') },
    { id: 'list', label: t('myWork.calendarGrid.viewList') },
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
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center gap-2">
          <button
            onClick={goToday}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-navy-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            {t('myWork.calendarGrid.today', 'Today')}
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
            {currentDate.toLocaleDateString(
              t('myWork.calendarGrid.currentDateToLocaleDateString', 'en-US'),
              {
                month: 'long',
                year: 'numeric',
              }
            )}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-navy-700 dark:bg-navy-900">
            {viewButtons.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => {
                  onViewModeChange(id);
                  const api = calendarRef.current?.getApi();
                  api?.changeView(VIEW_MAP[id]);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === id
                    ? 'bg-white text-primary-600 shadow-sm dark:bg-navy-800 dark:text-primary-400'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* FullCalendar — height=100% enables liquid mode: header+allDay stay fixed, only time grid scrolls */}
      <div className="flex-1 min-h-0 p-4 fc-consultify">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView={VIEW_MAP[viewMode]}
          initialDate={currentDate}
          events={fcEvents}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventResize={handleEventDrop}
          eventContent={renderEventContent}
          datesSet={handleDatesSet}
          headerToolbar={false}
          locale={t('myWork.calendarGrid.locale', 'en')}
          firstDay={1}
          height="100%"
          stickyHeaderDates
          nowIndicator
          dayMaxEvents={5}
          eventDisplay="block"
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          allDaySlot
          allDayText={t('myWork.calendarGrid.allDayText', 'all-day')}
        />
      </div>
    </div>
  );
};
