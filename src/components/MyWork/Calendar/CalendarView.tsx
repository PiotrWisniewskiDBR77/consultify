import { AlertTriangle, Loader2, SlidersHorizontal } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { EmptyStateInline } from '@/components/shared/NModeBlocks/EmptyStateInline';
import { Button } from '@/components/ui/primitives/Button';
import { Drawer, DrawerContent, DrawerHeader } from '@/components/ui/primitives/Drawer';
import { useIsMobile } from '@/hooks/useDeviceType';
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
  statusKey: ExternalCalendarStatusKey;
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
  expectedVersion?: string;
}

interface CalendarViewProps {
  refreshTrigger?: number;
  createRequestId?: number;
  onTaskClick?: (id: string) => void;
  onDecisionClick?: (id: string) => void;
  onInitiativeClick?: (id: string) => void;
  /** Calendar V2 wrapper opts into week-first without changing legacy default. */
  initialViewMode?: CalendarViewMode;
  includeOwnEvents?: boolean;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  refreshTrigger,
  createRequestId,
  onTaskClick,
  onDecisionClick,
  onInitiativeClick,
  initialViewMode = 'month',
  includeOwnEvents = false,
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>(initialViewMode);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | undefined>();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [externalSourceStatus, setExternalSourceStatus] = useState<
    Record<'google' | 'outlook', ExternalCalendarSourceState>
  >({
    // SET-INT-REC-001: "not connected yet" must read as an invitation to
    // connect, never as a "coming soon" dead end — see buildExternalSourceState's
    // `default` branch below for the post-fetch equivalent of this same copy.
    google: {
      available: false,
      statusKey: 'disconnected',
      statusLabel: t('myWork.calendarView.statusLabel', 'Not connected'),
      helper: t(
        'myWork.calendarView.helper',
        'Google Calendar is not connected yet — connect it to bring events here.'
      ),
      nextStep: t('myWork.calendarView.nextStep', 'Connect Google Calendar in Integrations.'),
    },
    outlook: {
      available: false,
      statusKey: 'disconnected',
      statusLabel: t('myWork.calendarView.statusLabel2', 'Not connected'),
      helper: t(
        'myWork.calendarView.helper2',
        'Outlook is not connected yet — connect it to bring events here.'
      ),
      nextStep: t('myWork.calendarView.nextStep2', 'Connect Outlook in Integrations.'),
    },
  });
  const [dayLoad, setDayLoad] = useState<CalendarConflictResponse | null>(null);
  const [dayLoadLoading, setDayLoadLoading] = useState(false);
  const [dayLoadError, setDayLoadError] = useState<string | null>(null);
  // Bumped after any calendar write settles, so the day-load/capacity read
  // model is re-read from the server. Without it, `refetch()` refreshed only
  // the events feed while the "Day load" summary kept the counts it fetched
  // when the date was last selected — i.e. moving a task onto or off the
  // selected day left the capacity hint stale until the user changed date.
  const [dayLoadRefreshKey, setDayLoadRefreshKey] = useState(0);

  const toLocalDateKey = useCallback((value: Date) => {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const { events, loading, error, filter, setFilter, refetch } = useCalendarData(
    dateRange,
    refreshTrigger,
    includeOwnEvents ? ['event'] : []
  );

  const buildExternalSourceState = useCallback(
    (status: ExternalCalendarStatusKey, providerLabel: string): ExternalCalendarSourceState => {
      switch (status) {
        case 'connected':
          return {
            available: true,
            statusKey: 'connected',
            statusLabel: t('myWork.calendarView.statusLabel3', 'Active'),
            helper: t('myWork.calendarView.helperConnected', { providerLabel }),
            nextStep: null,
          };
        case 'pending':
          return {
            available: false,
            statusKey: 'pending',
            statusLabel: t('myWork.calendarView.statusLabel4', 'Setup in progress'),
            helper: t('myWork.calendarView.helperPending', { providerLabel }),
            nextStep: t(
              'myWork.calendarView.nextStep3',
              'Finish configuration or authorization in Integrations.'
            ),
          };
        case 'reauth':
          return {
            available: false,
            statusKey: 'reauth',
            statusLabel: t('myWork.calendarView.statusLabel5', 'Reauth required'),
            helper: t('myWork.calendarView.helperReauth', { providerLabel }),
            nextStep: t('myWork.calendarView.nextStep4', 'Start reauthorization in Integrations.'),
          };
        case 'error':
          return {
            available: false,
            statusKey: 'error',
            statusLabel: t('myWork.calendarView.statusLabel6', 'Sync error'),
            helper: t('myWork.calendarView.helperError', { providerLabel }),
            nextStep: t(
              'myWork.calendarView.nextStep5',
              'Review the status and logs in Integrations.'
            ),
          };
        default:
          // SET-INT-REC-001: owner explicitly rejected "coming soon" here —
          // this is the disconnected state, which should read as an
          // invitation to connect, not a feature that does not exist yet.
          return {
            available: false,
            statusKey: 'disconnected',
            statusLabel: t('myWork.calendarView.statusLabel7', 'Not connected'),
            helper: t('myWork.calendarView.helperComingSoon', {
              providerLabel,
              defaultValue:
                '{{providerLabel}} is not connected yet — connect it to bring events here.',
            }),
            nextStep: t(
              'myWork.calendarView.nextStep6',
              'Connect {{providerLabel}} in Integrations.',
              {
                providerLabel,
              }
            ),
          };
      }
    },
    [t]
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
          t('myWork.calendarView.heavyLoadSuggestion', { totalItems, taskCount, decisionCount }),
      };
    }

    return {
      variant: 'info' as const,
      title: t('myWork.calendarView.title5', 'Day is partially loaded'),
      body: dayLoad?.suggestion || t('myWork.calendarView.partialLoadSuggestion', { totalItems }),
    };
  }, [dayLoad, dayLoadError, dayLoadLoading, t]);

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
  }, [currentDate, t, toLocalDateKey, dayLoadRefreshKey]);

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

  // Every path that re-pulls the events feed must also re-pull the day-load
  // read model — they are two independent server reads of the same underlying
  // schedule, and refreshing only one leaves the capacity summary contradicting
  // the grid next to it.
  const refreshAfterWrite = useCallback(() => {
    refetch();
    setDayLoadRefreshKey((key) => key + 1);
  }, [refetch]);

  const handleEventMove = useCallback(
    async (payload: CalendarEventMovePayload) => {
      if (!payload.source || !payload.sourceId || !payload.start) return false;
      if (payload.source === 'task' && !payload.expectedVersion) {
        // No version read back yet (e.g. stale extendedProps) — refuse rather
        // than write blind and risk a silent overwrite.
        toast.error(
          t('myWork.calendarView.toastRescheduleFailed', 'Failed to reschedule the task.')
        );
        refreshAfterWrite();
        return false;
      }

      try {
        await Api.updateMyWorkCalendarEvent(payload);
        refreshAfterWrite();
        return true;
      } catch (error: any) {
        const status = Number(error?.status);
        if (status === 409) {
          toast.error(
            t(
              'myWork.calendarView.toastVersionConflict',
              'This task was changed by someone else — restoring the current state.'
            )
          );
        } else if (status === 403) {
          toast.error(t('myWork.calendarView.toastForbidden', "You can't reschedule this task."));
        } else if (status === 404) {
          toast.error(
            t(
              'myWork.calendarView.toastNotFound',
              'This task no longer exists — refreshing the calendar.'
            )
          );
        } else {
          toast.error(
            t('myWork.calendarView.toastRescheduleFailed', 'Failed to reschedule the task.')
          );
        }
        console.error('Failed to reschedule calendar event', error);
        // Any failure re-pulls the canonical state from the backend so the grid
        // never keeps showing a position the server rejected.
        refreshAfterWrite();
        return false;
      }
    },
    [refreshAfterWrite, t]
  );

  useEffect(() => {
    if (!createRequestId) return;
    setCreateModalOpen(true);
  }, [createRequestId]);

  return (
    <div className="flex flex-1 min-h-0 min-w-0 bg-white dark:bg-navy-950">
      {/* Desktop: sidebar stays inline, unchanged. Below the useIsMobile
          breakpoint (max-width: 767px, same as tailwind.config's `mobile`
          alias) it would overlay the grid at fixed width (Codex
          narrow-viewport finding) — driven by useIsMobile (JS, testable),
          not a CSS-only hidden/md:block split, so mobile never even mounts
          the inline sidebar's interactive elements into the tab order. */}
      {!isMobile && (
        <CalendarSidebar
          filter={filter}
          onFilterChange={setFilter}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          externalSourceStatus={externalSourceStatus}
          workloadSummary={buildWorkloadSummary()}
        />
      )}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
        {isMobile && (
          <div className="shrink-0 flex items-center justify-end px-3 py-2 border-b border-slate-200 dark:border-navy-700">
            <Button
              variant="secondary"
              size="sm"
              icon={<SlidersHorizontal size={14} />}
              onClick={() => setMobileFiltersOpen(true)}
              aria-label={t('myWork.calendarSidebar.mobileFiltersButton', 'Sources & filters')}
            >
              {t('myWork.calendarSidebar.mobileFiltersButton', 'Sources & filters')}
            </Button>
          </div>
        )}
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
      {isMobile && (
        <Drawer
          open={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          position="left"
          size="sm"
        >
          <DrawerHeader
            title={t('myWork.calendarSidebar.mobileFiltersTitle', 'Sources & filters')}
          />
          <DrawerContent className="p-0">
            <CalendarSidebar
              filter={filter}
              onFilterChange={setFilter}
              currentDate={currentDate}
              onDateChange={setCurrentDate}
              externalSourceStatus={externalSourceStatus}
              workloadSummary={buildWorkloadSummary()}
            />
          </DrawerContent>
        </Drawer>
      )}
      <CalendarCreateEventModal
        open={createModalOpen}
        defaultDate={currentDate}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
};
