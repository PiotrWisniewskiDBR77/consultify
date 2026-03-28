import { AlertTriangle, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Api from '@/services/api';
import { EmptyStateInline } from '@/components/shared/NModeBlocks/EmptyStateInline';

import { CalendarCreateEventModal } from './CalendarCreateEventModal';
import { CalendarGrid } from './CalendarGrid';
import { CalendarSidebar } from './CalendarSidebar';
import type { CalendarViewMode } from './calendarTypes';
import { useCalendarData } from './useCalendarData';

interface CalendarViewProps {
  refreshTrigger?: number;
  createRequestId?: number;
  onTaskClick?: (id: string) => void;
  onDecisionClick?: (id: string) => void;
  onInitiativeClick?: (id: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  refreshTrigger,
  createRequestId,
  onTaskClick,
  onDecisionClick,
  onInitiativeClick,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | undefined>();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [externalSourceAvailability, setExternalSourceAvailability] = useState<{
    google: boolean;
    outlook: boolean;
  }>({
    google: false,
    outlook: false,
  });

  const { events, loading, error, filter, setFilter, refetch } = useCalendarData(
    dateRange,
    refreshTrigger
  );

  useEffect(() => {
    let cancelled = false;

    const fetchAvailability = async () => {
      try {
        const response = await Api.getIntegrations();
        const rows = Array.isArray(response) ? response : response?.integrations || [];
        const next = rows.reduce(
          (acc: { google: boolean; outlook: boolean }, item: any) => {
            const provider = String(item?.provider || '').toLowerCase();
            const status = String(item?.status || '').toLowerCase();
            const onboardingStatus = item?.onboarding_status;
            const isReady = (status === 'active' || status === 'connected') && !onboardingStatus;

            if (!isReady) {
              return acc;
            }

            if (provider === 'google' || provider === 'google_calendar') {
              acc.google = true;
            }

            if (
              provider === 'outlook' ||
              provider === 'microsoft' ||
              provider === 'microsoft_365' ||
              provider === 'outlook_calendar'
            ) {
              acc.outlook = true;
            }

            return acc;
          },
          { google: false, outlook: false }
        );

        if (!cancelled) {
          setExternalSourceAvailability(next);
        }
      } catch {
        if (!cancelled) {
          setExternalSourceAvailability({ google: false, outlook: false });
        }
      }
    };

    fetchAvailability();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleEventClick = useCallback(
    (eventId: string, source: string) => {
      if (source === 'task') onTaskClick?.(eventId);
      else if (source === 'decision') onDecisionClick?.(eventId);
      else if (source === 'initiative') onInitiativeClick?.(eventId);
    },
    [onTaskClick, onDecisionClick, onInitiativeClick]
  );

  const handleDateRangeChange = useCallback((start: string, end: string) => {
    setDateRange({ start, end });
  }, []);

  const handleCreated = useCallback(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (!createRequestId) return;
    setCreateModalOpen(true);
  }, [createRequestId]);

  return (
    <div className="flex flex-1 min-h-0 bg-white dark:bg-navy-950">
      <CalendarSidebar
        filter={filter}
        onFilterChange={setFilter}
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        externalSourceAvailability={externalSourceAvailability}
      />
      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-navy-950/50 z-10 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-primary-400" />
          </div>
        )}
        {error && !loading && (
          <div className="px-4 pt-4">
            <EmptyStateInline
              icon={AlertTriangle}
              dashed={false}
              message={
                isPolish
                  ? 'Widok kalendarza jest chwilowo niedostępny.'
                  : 'Calendar view is temporarily unavailable.'
              }
              hint={
                isPolish
                  ? 'To nie oznacza, że dzień jest pusty. Spróbuj odświeżyć dane i sprawdź ponownie.'
                  : 'This does not mean the day is empty. Refresh the data and try again.'
              }
              action={{
                label: isPolish ? 'Ponów' : 'Retry',
                onClick: refetch,
              }}
              className="mb-4"
            />
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
      <CalendarCreateEventModal
        open={createModalOpen}
        defaultDate={currentDate}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
};
