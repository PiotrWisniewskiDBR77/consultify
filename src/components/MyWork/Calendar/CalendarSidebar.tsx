import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Callout } from '@/components/shared/NModeBlocks';

import type { CalendarEventSource, CalendarFilter, SourceLifecycleState } from './calendarTypes';
import {
  LIFECYCLE_LABELS,
  LIFECYCLE_RECOVERY,
  SOURCE_COLORS,
  SOURCE_LABELS,
} from './calendarTypes';

interface ExternalCalendarSourceState {
  available: boolean;
  statusLabel: string;
  helper: string;
  nextStep?: string | null;
  lifecycleState?: SourceLifecycleState;
  /**
   * Raw connection status ('connected'|'pending'|'reauth'|'error'|'disconnected'),
   * threaded through from CalendarView.buildExternalSourceState. lifecycleState
   * above is never actually populated by CalendarView, so this is the only
   * reliable signal for "this source has never been connected" (SET-INT-REC-001).
   */
  statusKey?: 'connected' | 'pending' | 'reauth' | 'error' | 'disconnected';
}

interface CalendarWorkloadSummary {
  variant: 'info' | 'warning' | 'success';
  title: string;
  body: string;
}

interface CalendarSidebarProps {
  filter: CalendarFilter;
  onFilterChange: (filter: CalendarFilter) => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  externalSourceStatus?: Partial<Record<'google' | 'outlook', ExternalCalendarSourceState>>;
  workloadSummary?: CalendarWorkloadSummary | null;
}

type OwnershipFilter = 'any' | 'assignee' | 'owner';

const ALL_SOURCES: CalendarEventSource[] = [
  'task',
  'initiative',
  'decision',
  'consultify',
  'google',
  'outlook',
];

export const CalendarSidebar: React.FC<CalendarSidebarProps> = ({
  filter,
  onFilterChange,
  currentDate,
  onDateChange,
  externalSourceStatus,
  workloadSummary,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const activeOwnership: OwnershipFilter = (filter.ownership as OwnershipFilter) || 'any';
  const navigate = useNavigate();

  const toggleSource = (source: CalendarEventSource) => {
    const isExternalSource = source === 'google' || source === 'outlook';
    if (isExternalSource && !externalSourceStatus?.[source]?.available) {
      navigate('/settings/integrations');
      return;
    }
    const current = filter.sources;
    const next = current.includes(source)
      ? current.filter((s) => s !== source)
      : [...current, source];
    onFilterChange({ ...filter, sources: next.length > 0 ? next : ALL_SOURCES });
  };

  const setOwnership = (ownership: OwnershipFilter) => {
    onFilterChange({ ...filter, ownership });
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();
  const today = new Date();

  const monthLabel = currentDate.toLocaleDateString(
    t('myWork.calendarSidebar.currentDateToLocaleDateString', 'en-US'),
    {
      month: 'long',
      year: 'numeric',
    }
  );

  return (
    <div className="w-64 flex-shrink-0 md:border-r md:border-slate-200 md:dark:border-navy-700 p-4 space-y-6">
      {/* Mini calendar */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => onDateChange(new Date(year, month - 1, 1))}
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            &lsaquo;
          </button>
          <span className="text-sm font-semibold text-slate-800 dark:text-white capitalize">
            {monthLabel}
          </span>
          <button
            onClick={() => onDateChange(new Date(year, month + 1, 1))}
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            &rsaquo;
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 text-center">
          {(
            t('myWork.calendarSidebar.weekdaysShort', {
              returnObjects: true,
            }) as string[]
          ).map((d) => (
            <div
              key={d}
              className="text-[10px] font-medium text-slate-500 dark:text-slate-500 py-1"
            >
              {d}
            </div>
          ))}
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const isToday =
              today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
            const isSelected = currentDate.getDate() === day;

            return (
              <button
                key={day}
                onClick={() => onDateChange(new Date(year, month, day))}
                className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-navy-900 text-white dark:bg-white dark:text-navy-950'
                    : isToday
                      ? 'bg-primary-500/10 text-primary-500 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Source filters */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-500 mb-3">
          {t('myWork.calendarSidebar.sources', 'Sources')}
        </h4>
        <div className="space-y-1.5">
          {ALL_SOURCES.map((source) => {
            const isExternalSource = source === 'google' || source === 'outlook';
            const isAvailable = isExternalSource
              ? Boolean(externalSourceStatus?.[source]?.available)
              : true;
            const active = isAvailable && filter.sources.includes(source);
            return (
              <button
                key={source}
                onClick={() => toggleSource(source)}
                className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                  !isAvailable && isExternalSource
                    ? 'cursor-pointer text-slate-500 dark:text-slate-400 opacity-70'
                    : active
                      ? 'text-slate-800 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400 line-through'
                } hover:bg-slate-100 dark:hover:bg-navy-800`}
              >
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{
                    backgroundColor: active ? SOURCE_COLORS[source] : 'transparent',
                    border: active ? 'none' : `2px solid ${SOURCE_COLORS[source]}`,
                    opacity: active ? 1 : 0.4,
                  }}
                />
                <span className="min-w-0 text-left">
                  <span className="block">
                    {isPolish ? SOURCE_LABELS[source].pl : SOURCE_LABELS[source].en}
                  </span>
                  {!isAvailable && isExternalSource && (
                    <span className="block text-[10px] font-normal normal-case text-primary-500 dark:text-primary-400">
                      {t(
                        'myWork.calendarSidebar.connectInIntegrations',
                        'Connect in Integrations →'
                      )}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        {(externalSourceStatus?.google || externalSourceStatus?.outlook) && (
          <div className="mt-3 space-y-2">
            {(['google', 'outlook'] as const).map((source) => {
              const state = externalSourceStatus?.[source];
              if (!state) return null;

              const lifecycle = state.lifecycleState;
              const lifecycleInfo = lifecycle ? LIFECYCLE_LABELS[lifecycle] : null;
              const recoveryHint = lifecycle ? LIFECYCLE_RECOVERY[lifecycle] : null;

              if (state.available && lifecycle === 'connected') return null;

              const variant = lifecycleInfo
                ? lifecycleInfo.variant === 'success'
                  ? 'info'
                  : lifecycleInfo.variant === 'error'
                    ? 'critical'
                    : lifecycleInfo.variant
                : 'info';

              // SET-INT-REC-001: the disconnected/not-yet-connected state must
              // offer a real "Connect" action, not just copy suggesting one.
              // Pending/reauth/error already went through a connection attempt
              // and need a different next step, so only 'disconnected' (or an
              // unrecognized/missing status, defensively) gets the CTA.
              const isDisconnected = !state.statusKey || state.statusKey === 'disconnected';

              return (
                <Callout
                  key={source}
                  variant={variant as 'info' | 'warning' | 'critical' | 'success'}
                  compact
                  title={`${isPolish ? SOURCE_LABELS[source].pl : SOURCE_LABELS[source].en}: ${lifecycleInfo ? lifecycleInfo.label : state.statusLabel}`}
                  action={
                    isDisconnected
                      ? {
                          label: t('myWork.calendarView.connectCta', 'Connect'),
                          onClick: () => navigate('/settings/integrations'),
                        }
                      : undefined
                  }
                >
                  <div>{state.helper}</div>
                  {recoveryHint ? <div className="mt-1 text-[10px]">{recoveryHint}</div> : null}
                  {!isDisconnected && state.nextStep ? (
                    <div className="mt-1">{state.nextStep}</div>
                  ) : null}
                </Callout>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-500 mb-3">
          {t('myWork.calendarSidebar.ownership', 'Ownership')}
        </h4>
        <div className="space-y-1.5">
          {[
            {
              id: 'any' as const,
              label: t('myWork.calendarSidebar.label', 'Any'),
            },
            {
              id: 'assignee' as const,
              label: t('myWork.calendarSidebar.label2', 'Assigned to me'),
            },
            {
              id: 'owner' as const,
              label: t('myWork.calendarSidebar.label3', 'Owned by me'),
            },
          ].map((entry) => {
            const active = activeOwnership === entry.id;
            return (
              <button
                key={entry.id}
                onClick={() => setOwnership(entry.id)}
                className={`w-full px-2.5 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                  active
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
                }`}
              >
                {entry.label}
              </button>
            );
          })}
        </div>
      </div>

      {workloadSummary && (
        <Callout variant={workloadSummary.variant} title={workloadSummary.title} compact>
          {workloadSummary.body}
        </Callout>
      )}

      {/* Today button */}
      <button
        onClick={() => onDateChange(new Date())}
        className="w-full py-2 rounded-lg border border-slate-200 dark:border-navy-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
      >
        {t('myWork.calendarSidebar.today', 'Today')}
      </button>
    </div>
  );
};
