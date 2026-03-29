import React from 'react';
import { useTranslation } from 'react-i18next';

import { Callout } from '@/components/shared/NModeBlocks';

import type { CalendarEventSource, CalendarFilter } from './calendarTypes';
import { SOURCE_COLORS, SOURCE_LABELS } from './calendarTypes';

interface ExternalCalendarSourceState {
  available: boolean;
  statusLabel: string;
  helper: string;
  nextStep?: string | null;
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
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const toggleSource = (source: CalendarEventSource) => {
    const isExternalSource = source === 'google' || source === 'outlook';
    if (isExternalSource && !externalSourceStatus?.[source]?.available) {
      return;
    }
    const current = filter.sources;
    const next = current.includes(source)
      ? current.filter((s) => s !== source)
      : [...current, source];
    onFilterChange({ ...filter, sources: next.length > 0 ? next : ALL_SOURCES });
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();
  const today = new Date();

  const monthLabel = currentDate.toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-navy-700 p-4 space-y-6">
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
          {(isPolish
            ? ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd']
            : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
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
                    ? 'bg-primary-500 text-white'
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
          {isPolish ? 'Źródła' : 'Sources'}
        </h4>
        <div className="space-y-1.5">
          {ALL_SOURCES.map((source) => {
            const isExternalSource = source === 'google' || source === 'outlook';
            const isAvailable = isExternalSource ? Boolean(externalSourceStatus?.[source]?.available) : true;
            const active = isAvailable && filter.sources.includes(source);
            return (
              <button
                key={source}
                onClick={() => toggleSource(source)}
                disabled={!isAvailable}
                className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                  !isAvailable
                    ? 'cursor-not-allowed text-slate-400 dark:text-slate-600 opacity-70'
                    : active
                    ? 'text-slate-800 dark:text-white'
                    : 'text-slate-400 dark:text-slate-600 line-through'
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
                    <span className="block text-[10px] font-normal normal-case text-slate-400 dark:text-slate-500">
                      {isPolish ? 'Podłącz w Integracjach' : 'Connect in Integrations'}
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
              if (!state || state.available) return null;
              return (
                <Callout
                  key={source}
                  variant="info"
                  compact
                  title={`${isPolish ? SOURCE_LABELS[source].pl : SOURCE_LABELS[source].en}: ${state.statusLabel}`}
                >
                  <div>{state.helper}</div>
                  {state.nextStep ? <div className="mt-1">{state.nextStep}</div> : null}
                </Callout>
              );
            })}
          </div>
        )}
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
        {isPolish ? 'Dzisiaj' : 'Today'}
      </button>
    </div>
  );
};
