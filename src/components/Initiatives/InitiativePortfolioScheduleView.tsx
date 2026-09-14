import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { PortfolioInitiative } from '@/types';

import {
  getInitiativesHorizonGranularity,
  type InitiativesHorizon,
  InitiativesHorizonControl,
} from './InitiativesHorizonControl';

type ScheduleMode = 'calendar' | 'gantt';

const DAY = 86_400_000;
const validDay = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? parsed
    : null;
};
const addMonths = (date: Date, months: number) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
const iso = (date: Date) => date.toISOString().slice(0, 10);

export function buildInitiativeScheduleAxis(
  anchor: Date,
  horizon: InitiativesHorizon,
  mode: ScheduleMode = 'calendar'
) {
  const start = new Date(Date.UTC(anchor.getFullYear(), anchor.getMonth(), 1));
  const end = addMonths(start, horizon);
  const granularity = mode === 'gantt' ? 'week' : getInitiativesHorizonGranularity(horizon);
  const stepMonths = granularity === 'month' ? 1 : 0;
  const ticks: Date[] = [];
  if (stepMonths) {
    for (let cursor = start; cursor < end; cursor = addMonths(cursor, 1)) ticks.push(cursor);
  } else {
    for (let cursor = start; cursor < end; cursor = new Date(cursor.getTime() + 7 * DAY))
      ticks.push(cursor);
  }
  return { start, end, granularity, ticks };
}

export function InitiativePortfolioScheduleView({
  initiatives,
  onOpen,
  mode = 'calendar',
  anchorDate = new Date(),
}: {
  initiatives: PortfolioInitiative[];
  onOpen: (initiative: PortfolioInitiative) => void;
  mode?: ScheduleMode;
  anchorDate?: Date;
}) {
  const { t, i18n } = useTranslation();
  const [horizon, setHorizon] = useState<InitiativesHorizon>(3);
  const axis = useMemo(
    () => buildInitiativeScheduleAxis(anchorDate, horizon, mode),
    [anchorDate, horizon, mode]
  );
  const total = Math.max(1, axis.end.getTime() - axis.start.getTime());
  const timelineWidth = Math.max(540, axis.ticks.length * 72);
  const tickWidths = axis.ticks.map((tick, index) => {
    const next = axis.ticks[index + 1] ?? axis.end;
    return ((next.getTime() - tick.getTime()) / total) * timelineWidth;
  });
  const known = initiatives.flatMap((initiative) => {
    const start = validDay(initiative.plannedStartDate);
    const end = validDay(initiative.plannedEndDate);
    return start && end && end >= start ? [{ initiative, start, end }] : [];
  });
  const unknown = initiatives.filter(
    (initiative) => !known.some((item) => item.initiative.id === initiative.id)
  );
  const visible = known.filter(({ start, end }) => start < axis.end && end >= axis.start);
  const outside = known.filter(({ start, end }) => end < axis.start || start >= axis.end);
  const locale = i18n.language.startsWith('pl') ? 'pl-PL' : 'en-US';

  return (
    <section className="flex h-full min-h-0 flex-col" data-testid="initiative-portfolio-schedule">
      <div className="flex shrink-0 justify-end border-b border-c-border-subtle px-4 py-2">
        <InitiativesHorizonControl value={horizon} onChange={setHorizon} />
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div
          className="grid border-b border-c-border-subtle"
          style={{ gridTemplateColumns: `220px ${timelineWidth}px` }}
          data-granularity={axis.granularity}
          data-timeline-width={timelineWidth}
        >
          <div className="w-[220px] shrink-0 px-2 py-2 text-xs font-semibold text-c-text-secondary">
            {t('initiatives.columns.initiative', 'Initiative')}
          </div>
          <div className="flex" style={{ width: timelineWidth }} data-schedule-header-track>
            {axis.ticks.map((tick, index) => (
              <div
                key={tick.toISOString()}
                className="shrink-0 border-l border-c-border-subtle px-2 py-2 text-xs text-c-text-muted"
                style={{ width: tickWidths[index] }}
                data-schedule-tick
                data-axis-x={((tick.getTime() - axis.start.getTime()) / total) * timelineWidth}
              >
                {axis.granularity === 'week'
                  ? t('initiatives.schedule.weekOf', 'Week of {{date}}', {
                      date: tick.toLocaleDateString(locale, {
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'UTC',
                      }),
                    })
                  : tick.toLocaleDateString(locale, {
                      month: 'short',
                      year: 'numeric',
                      timeZone: 'UTC',
                    })}
              </div>
            ))}
          </div>
        </div>

        {visible.map(({ initiative, start, end }) => {
          const left = Math.max(0, Math.min(1, (start.getTime() - axis.start.getTime()) / total));
          const right = Math.max(left, Math.min(1, (end.getTime() - axis.start.getTime()) / total));
          return (
            <button
              key={initiative.id}
              type="button"
              onClick={() => onOpen(initiative)}
              className="grid min-h-12 border-b border-c-border-subtle text-left hover:bg-c-surface-hover"
              style={{ gridTemplateColumns: `220px ${timelineWidth}px` }}
              data-timeline-width={timelineWidth}
              data-testid={`initiative-schedule-row-${initiative.id}`}
            >
              <span className="w-[220px] shrink-0 truncate px-2 py-3 text-sm font-medium text-c-text">
                {initiative.name}
              </span>
              {mode === 'gantt' ? (
                <svg
                  className="my-3 block h-6 min-w-0 flex-1 border-l border-c-border-subtle bg-c-surface-raised/40"
                  viewBox={`0 0 ${timelineWidth} 24`}
                  preserveAspectRatio="none"
                  aria-label={`${iso(start)} – ${iso(end)}`}
                >
                  <rect
                    x={left * timelineWidth}
                    y="4"
                    width={Math.max(8, (right - left) * timelineWidth)}
                    height="16"
                    rx="4"
                    className="fill-slate-500 dark:fill-slate-400"
                  />
                </svg>
              ) : (
                <span
                  className="flex min-w-0"
                  style={{ width: timelineWidth }}
                  data-schedule-row-track
                >
                  {axis.ticks.map((tick, index) => {
                    const next =
                      axis.granularity === 'week'
                        ? new Date(tick.getTime() + 7 * DAY)
                        : addMonths(tick, 1);
                    const intersects = start < next && end >= tick;
                    return (
                      <span
                        key={tick.toISOString()}
                        className={`shrink-0 border-l border-c-border-subtle ${intersects ? 'bg-slate-200/70 dark:bg-slate-700/70' : ''}`}
                        style={{ width: tickWidths[index] }}
                        data-schedule-cell
                      />
                    );
                  })}
                </span>
              )}
            </button>
          );
        })}

        {unknown.length > 0 && (
          <div
            className="mt-4 rounded-lg border border-c-border-subtle bg-c-surface-raised p-3"
            data-testid="initiative-schedule-unknown"
          >
            <p className="text-xs font-semibold text-c-text-secondary">
              {t('initiatives.schedule.unknown', 'Schedule unavailable')}
            </p>
            <div className="mt-2 space-y-1">
              {unknown.map((initiative) => (
                <div key={initiative.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(initiative)}
                    className="text-sm text-c-text underline"
                  >
                    {initiative.name}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {outside.length > 0 && (
          <div
            className="mt-4 rounded-lg border border-c-border-subtle p-3 text-xs text-c-text-muted"
            data-testid="initiative-schedule-outside-horizon"
          >
            {t(
              'initiatives.schedule.outsideHorizon',
              '{{count}} scheduled initiative(s) are outside this horizon.',
              { count: outside.length }
            )}
          </div>
        )}
      </div>
    </section>
  );
}
