import { AlertTriangle, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyStateInline } from '@/components/shared/NModeBlocks/EmptyStateInline';
import Api from '@/services/api';

import { CalendarCreateEventModal } from './CalendarCreateEventModal';
import { CalendarGrid } from './CalendarGrid';
import { CalendarSidebar } from './CalendarSidebar';
import type { CalendarViewMode } from './calendarTypes';
import { useCalendarData } from './useCalendarData';

type ExternalCalendarStatusKey = 'connected' | 'pending' | 'reauth' | 'error' | 'disconnected';

interface ExternalCalendarSourceState {
  available: boolean;
  statusLabel: string;
  helper: string;
  nextStep?: string | null;
}

interface CalendarConflictItem {
  id: string;
  title: string;
}

interface CalendarConflictResponse {
  tasks?: CalendarConflictItem[];
  decisions?: CalendarConflictItem[];
  totalItems?: number;
  hasConflicts?: boolean;
  suggestion?: string | null;
}

interface CalendarEventMovePayload {
  source: string;
  sourceId: string;
  start: string;
  end?: string;
  allDay?: boolean;
  etag?: string;
}

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
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | undefined>();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [externalSourceStatus, setExternalSourceStatus] = useState<
    Record<'google' | 'outlook', ExternalCalendarSourceState>
  >({
    google: {
      available: false,
      statusLabel: t('myWork.calendarView.statusLabel', 'Coming soon'),
      helper: t(
        'myWork.calendarView.helper',
        'Google Calendar integration is in preparation — two-way connection is not available yet.'
      ),
      nextStep: t(
        'myWork.calendarView.nextStep',
        'In the meantime, subscribe to the Consultify ICS feed in your calendar.'
      ),
    },
    outlook: {
      available: false,
      statusLabel: t('myWork.calendarView.statusLabel2', 'Coming soon'),
      helper: t(
        'myWork.calendarView.helper2',
        'Outlook integration is in preparation — two-way connection is not available yet.'
      ),
      nextStep: t(
        'myWork.calendarView.nextStep2',
        'In the meantime, subscribe to the Consultify ICS feed in your calendar.'
      ),
    },
  });
  const [dayLoad, setDayLoad] = useState<CalendarConflictResponse | null>(null);
  const [dayLoadLoading, setDayLoadLoading] = useState(false);
  const [dayLoadError, setDayLoadError] = useState<string | null>(null);

  const toLocalDateKey = useCallback((value: Date) => {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const { events, loading, error, filter, setFilter, refetch } = useCalendarData(
    dateRange,
    refreshTrigger
  );

  const buildExternalSourceState = useCallback(
    (status: ExternalCalendarStatusKey, providerLabel: string): ExternalCalendarSourceState => {
      switch (status) {
        case 'connected':
          return {
            available: true,
            statusLabel: t('myWork.calendarView.statusLabel3', 'Active'),
            helper: isPolish
              ? `${providerLabel} jest gotowe do filtrowania w kalendarzu.`
              : `${providerLabel} is ready for calendar filtering.`,
            nextStep: null,
          };
        case 'pending':
          return {
            available: false,
            statusLabel: t('myWork.calendarView.statusLabel4', 'Setup in progress'),
            helper: isPolish
              ? `${providerLabel} jest już na ścieżce governed, ale konfiguracja lub autoryzacja nie jest jeszcze domknięta.`
              : `${providerLabel} is on the governed path, but configuration or authorization is not complete yet.`,
            nextStep: t(
              'myWork.calendarView.nextStep3',
              'Finish configuration or authorization in Integrations.'
            ),
          };
        case 'reauth':
          return {
            available: false,
            statusLabel: t('myWork.calendarView.statusLabel5', 'Reauth required'),
            helper: isPolish
              ? `${providerLabel} wymaga ponownej autoryzacji zanim wróci do wiarygodnego syncu.`
              : `${providerLabel} needs reauthorization before it returns to a trustworthy sync state.`,
            nextStep: t('myWork.calendarView.nextStep4', 'Start reauthorization in Integrations.'),
          };
        case 'error':
          return {
            available: false,
            statusLabel: t('myWork.calendarView.statusLabel6', 'Sync error'),
            helper: isPolish
              ? `${providerLabel} ma aktywny błąd i nie powinno być traktowane jak gotowe źródło kalendarza.`
              : `${providerLabel} has an active error and should not be treated as a ready calendar source.`,
            nextStep: t(
              'myWork.calendarView.nextStep5',
              'Review the status and logs in Integrations.'
            ),
          };
        default:
          return {
            available: false,
            statusLabel: t('myWork.calendarView.statusLabel7', 'Coming soon'),
            helper: isPolish
              ? `Integracja ${providerLabel} jest w przygotowaniu — dwukierunkowe łączenie nie jest jeszcze dostępne.`
              : `${providerLabel} integration is in preparation — two-way connection is not available yet.`,
            nextStep: t(
              'myWork.calendarView.nextStep6',
              'In the meantime, subscribe to the Consultify ICS feed in your calendar.'
            ),
          };
      }
    },
    [isPolish]
  );

  const buildWorkloadSummary = useCallback(() => {
    if (dayLoadLoading) {
      return {
        variant: 'info' as const,
        title: t('myWork.calendarView.title', 'Day load'),
        body: t('myWork.calendarView.body', 'Checking the selected day load...'),
      };
    }

    if (dayLoadError) {
      return {
        variant: 'warning' as const,
        title: t('myWork.calendarView.title2', 'Day-load preview limited'),
        body: dayLoadError,
      };
    }

    const totalItems = Number(dayLoad?.totalItems ?? 0);
    const hasConflicts = Boolean(dayLoad?.hasConflicts);
    const taskCount = Number(dayLoad?.tasks?.length ?? 0);
    const decisionCount = Number(dayLoad?.decisions?.length ?? 0);

    if (totalItems === 0) {
      return {
        variant: 'success' as const,
        title: t('myWork.calendarView.title3', 'Day looks clear'),
        body: t(
          'myWork.calendarView.body2',
          'The selected date does not yet show tasks or decisions demanding attention.'
        ),
      };
    }

    if (hasConflicts || totalItems >= 4) {
      return {
        variant: 'warning' as const,
        title: t('myWork.calendarView.title4', 'Day is already heavily loaded'),
        body:
          dayLoad?.suggestion ||
          (isPolish
            ? `Masz tu ${totalItems} pozycji, w tym ${taskCount} zadań i ${decisionCount} decyzji. Warto rozważyć przesunięcie lub korektę planu.`
            : `You already have ${totalItems} items here, including ${taskCount} tasks and ${decisionCount} decisions. Consider a reschedule or a planning adjustment.`),
      };
    }

    return {
      variant: 'info' as const,
      title: t('myWork.calendarView.title5', 'Day is partially loaded'),
      body:
        dayLoad?.suggestion ||
        (isPolish
          ? `Wybrany dzień ma ${totalItems} pozycji. To dobry moment na świadome dopasowanie kolejnych zadań.`
          : `The selected day already has ${totalItems} items. This is a good moment to place new work deliberately.`),
    };
  }, [dayLoad, dayLoadError, dayLoadLoading, isPolish]);

  useEffect(() => {
    let cancelled = false;

    const fetchAvailability = async () => {
      try {
        const response = await Api.getIntegrations();
        const rows = Array.isArray(response) ? response : response?.integrations || [];
        const nextStatus = rows.reduce(
          (acc: Record<'google' | 'outlook', ExternalCalendarStatusKey>, item: any) => {
            const provider = String(item?.provider || '').toLowerCase();
            const status = String(item?.status || '').toLowerCase();
            const hasPendingOnboarding = Boolean(item?.onboarding_status);
            const normalizedStatus: ExternalCalendarStatusKey =
              status === 'active' || status === 'connected'
                ? hasPendingOnboarding
                  ? 'pending'
                  : 'connected'
                : status === 'pending'
                  ? 'pending'
                  : status === 'requires_reauth'
                    ? 'reauth'
                    : status === 'error'
                      ? 'error'
                      : 'disconnected';

            if (provider === 'google' || provider === 'google_calendar') {
              acc.google =
                normalizedStatus === 'connected' || acc.google !== 'connected'
                  ? normalizedStatus
                  : acc.google;
            }

            if (
              provider === 'outlook' ||
              provider === 'microsoft' ||
              provider === 'microsoft_365' ||
              provider === 'outlook_calendar'
            ) {
              acc.outlook =
                normalizedStatus === 'connected' || acc.outlook !== 'connected'
                  ? normalizedStatus
                  : acc.outlook;
            }

            return acc;
          },
          { google: 'disconnected', outlook: 'disconnected' }
        );

        if (!cancelled) {
          setExternalSourceStatus({
            google: buildExternalSourceState(nextStatus.google, 'Google Calendar'),
            outlook: buildExternalSourceState(nextStatus.outlook, 'Outlook'),
          });
        }
      } catch {
        if (!cancelled) {
          setExternalSourceStatus({
            google: buildExternalSourceState('disconnected', 'Google Calendar'),
            outlook: buildExternalSourceState('disconnected', 'Outlook'),
          });
        }
      }
    };

    fetchAvailability();

    return () => {
      cancelled = true;
    };
  }, [buildExternalSourceState]);

  useEffect(() => {
    let cancelled = false;
    const dateKey = toLocalDateKey(currentDate);

    const loadDayLoad = async () => {
      try {
        setDayLoadLoading(true);
        setDayLoadError(null);
        const response = await Api.getMyWorkCalendarConflicts(dateKey);
        if (!cancelled) {
          setDayLoad(response?.data ?? response ?? null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setDayLoad(null);
          setDayLoadError(
            err?.status === 503
              ? t(
                  'myWork.calendarView.dayLoadPreviewIs',
                  'Day-load preview is temporarily unavailable, but the calendar still shows current items.'
                )
              : t('myWork.calendarView.failedToReadThe', 'Failed to read the selected day load.')
          );
        }
      } finally {
        if (!cancelled) {
          setDayLoadLoading(false);
        }
      }
    };

    loadDayLoad();

    return () => {
      cancelled = true;
    };
  }, [currentDate, isPolish, toLocalDateKey]);

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

  const handleEventMove = useCallback(
    async (payload: CalendarEventMovePayload) => {
      if (!payload.source || !payload.sourceId || !payload.start) return false;

      try {
        await Api.updateMyWorkCalendarEvent(payload);
        refetch();
        return true;
      } catch (error) {
        console.error('Failed to reschedule calendar event', error);
        return false;
      }
    },
    [refetch]
  );

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
        externalSourceStatus={externalSourceStatus}
        workloadSummary={buildWorkloadSummary()}
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
              message={t(
                'myWork.calendarView.calendarViewIsTemporarily',
                'Calendar view is temporarily unavailable.'
              )}
              hint={t(
                'myWork.calendarView.thisDoesNotMean',
                'This does not mean the day is empty. Refresh the data and try again.'
              )}
              action={{
                label: t('myWork.calendarView.label', 'Retry'),
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
          onEventMove={handleEventMove}
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
