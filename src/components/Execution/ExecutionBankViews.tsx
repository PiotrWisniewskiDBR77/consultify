import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  StandardKanban,
  type StandardKanbanCard,
  type StandardKanbanColumn,
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
} from '@/components/standard';
import { EntityStatusChip, statusChipTone } from '@/components/ui/primitives/chips';

import type {
  ExecutionBankEvidence,
  ExecutionBankHorizonMonths,
  ExecutionBankRow,
  ExecutionCalendarBucket,
  ExecutionCalendarWindow,
} from './executionBankModel';

export type ExecutionBankViewMode = 'table' | 'kanban' | 'calendar' | 'gantt';

export interface ExecutionBankIdentity {
  id: string;
  initiativeId: string;
}

export interface ExecutionBankViewsProps {
  rows: readonly ExecutionBankRow[];
  view: ExecutionBankViewMode;
  enhanced?: boolean;
  selected: ExecutionBankIdentity | null;
  calendarWindow: ExecutionCalendarWindow;
  onSelect: (row: ExecutionBankRow) => void;
  onOpen: (row: ExecutionBankRow) => void;
  onHorizonChange: (months: ExecutionBankHorizonMonths) => void;
  onDrilldownMonth: (month: string | null) => void;
}

const UNKNOWN_LABELS: Record<string, string> = {
  INITIATIVE_MISSING: 'Initiative details unavailable',
  PROGRESS_MISSING: 'Progress not reported',
  PROGRESS_INVALID: 'Progress value is invalid',
  BASELINE_MISSING: 'Baseline not set',
  BASELINE_INVALID: 'Baseline date is invalid',
  CURRENT_PLAN_MISSING: 'Current plan not set',
  CURRENT_PLAN_INVALID: 'Current plan date is invalid',
  FORECAST_MISSING: 'Forecast not available',
  FORECAST_INVALID: 'Forecast date is invalid',
  FORECAST_OBSERVATION_MISSING: 'Forecast observation date missing',
  FORECAST_OBSERVATION_INVALID: 'Forecast observation date is invalid',
  FORECAST_AFTER_AS_OF: 'Forecast is newer than the reporting date',
  VALUE_CLEARED: 'Not scheduled',
  ACTUAL_MISSING: 'Actual date not reported',
  ACTUAL_INVALID: 'Actual date is invalid',
  CONFIDENCE_MISSING: 'Confidence not reported',
  HEALTH_MISSING: 'Health not reported',
  UPDATED_AT_MISSING: 'Update time unavailable',
  UPDATED_AT_INVALID: 'Update time is invalid',
};

const unknownLabel = (reason: string) => UNKNOWN_LABELS[reason] ?? 'Data unavailable';
const readableDate = (value: string) => {
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  if (!Number.isFinite(parsed.getTime())) return 'Invalid date';
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
};
const evidenceLabel = <T,>(evidence: ExecutionBankEvidence<T>, suffix = '') =>
  evidence.status === 'KNOWN'
    ? `${String(evidence.value)}${suffix}`
    : unknownLabel(evidence.reason);
const dateEvidenceLabel = (evidence: ExecutionBankEvidence<string>) =>
  evidence.status === 'KNOWN' ? readableDate(evidence.value) : unknownLabel(evidence.reason);
export const describeExecutionBankUnknown = unknownLabel;
export const formatExecutionBankDate = readableDate;
const caseAvailabilityLabel = (row: ExecutionBankRow) =>
  row.executionCaseId ? 'Execution Case linked' : 'No Execution Case';
const temporalClass = 'text-xs tabular-nums text-c-text-secondary';

const BankTable = ({
  rows,
  selected,
  calendarWindow,
  enhanced = false,
  onSelect,
  onOpen,
}: Pick<
  ExecutionBankViewsProps,
  'rows' | 'selected' | 'calendarWindow' | 'enhanced' | 'onSelect' | 'onOpen'
>) => {
  const columns = useMemo<TableColumn[]>(
    () => [
      {
        id: enhanced ? 'initiative' : 'initiativeCase',
        label: enhanced ? 'Initiative' : 'Initiative / Case',
        width: '250px',
        render: (source) => {
          const row = source as unknown as ExecutionBankRow;
          return (
            <div
              data-testid={`execution-bank-table-item-${row.id}`}
              data-initiative-id={row.initiativeId}
              data-execution-case-id={enhanced ? undefined : (row.executionCaseId ?? undefined)}
            >
              <div className="text-sm font-semibold text-c-text">{row.name}</div>
              <div className="text-[11px] text-c-text-muted">
                {enhanced ? (row.projectId ?? 'No project assigned') : caseAvailabilityLabel(row)}
              </div>
            </div>
          );
        },
      },
      {
        id: 'lifecycleStatus',
        label: 'Lifecycle',
        width: '140px',
        render: (source) => {
          const row = source as unknown as ExecutionBankRow;
          return (
            <EntityStatusChip
              status={row.lifecycleStatus}
              label={row.lifecycleStatus}
              tone={statusChipTone(row.lifecycleStatus)}
            />
          );
        },
      },
      {
        id: 'executionState',
        label: 'Execution phase',
        width: '150px',
        render: (source) => {
          const row = source as unknown as ExecutionBankRow;
          return (
            <div>
              <EntityStatusChip
                status={row.executionState}
                label={row.executionState}
                tone={statusChipTone(row.executionState)}
              />
              <div className="mt-1 text-[11px] text-c-text-muted">{row.executionPhase ?? '—'}</div>
            </div>
          );
        },
      },
      {
        id: 'ownerName',
        label: 'Owner',
        width: '150px',
        render: (source) => {
          const row = source as unknown as ExecutionBankRow;
          return <span>{row.ownerName ?? row.ownerId ?? '—'}</span>;
        },
      },
      {
        id: 'deliveryProfile',
        label: 'Delivery profile',
        width: '130px',
        render: (source) => {
          const row = source as unknown as ExecutionBankRow;
          return <span>{row.deliveryProfile ?? '—'}</span>;
        },
      },
      {
        id: 'progress',
        label: 'Progress / confidence',
        width: '190px',
        render: (source) => {
          const row = source as unknown as ExecutionBankRow;
          return (
            <div>
              <div
                data-testid={`execution-bank-progress-${enhanced ? row.id : row.executionCaseId}`}
              >
                {evidenceLabel(row.progress, '%')}
              </div>
              <div className="text-[11px] text-c-text-muted">{evidenceLabel(row.confidence)}</div>
            </div>
          );
        },
      },
      {
        id: 'baselineFinish',
        label: 'Baseline finish',
        width: '160px',
        render: (source) => (
          <span className={temporalClass}>
            {dateEvidenceLabel((source as unknown as ExecutionBankRow).baselineFinish)}
          </span>
        ),
      },
      {
        id: 'forecastFinish',
        label: 'Forecast finish',
        width: '170px',
        render: (source) => (
          <span className={temporalClass}>
            {dateEvidenceLabel((source as unknown as ExecutionBankRow).forecastFinish)}
          </span>
        ),
      },
      {
        id: 'varianceDays',
        label: enhanced ? 'Timeline position' : 'Variance',
        width: enhanced ? '210px' : '150px',
        render: (source) => {
          const row = source as unknown as ExecutionBankRow;
          return (
            <span
              data-testid={`execution-bank-variance-${enhanced ? row.id : row.executionCaseId}`}
              className={temporalClass}
            >
              {row.varianceDays.status === 'KNOWN'
                ? enhanced
                  ? `${row.varianceDays.reference?.toLowerCase()} ${row.varianceDays.value >= 0 ? '+' : ''}${row.varianceDays.value} ${Math.abs(row.varianceDays.value) === 1 ? 'day' : 'days'} · as of ${readableDate(calendarWindow.asOf)}`
                  : `${row.varianceDays.value} ${Math.abs(row.varianceDays.value) === 1 ? 'day' : 'days'} · ${row.varianceDays.reference?.toLowerCase()}`
                : unknownLabel(row.varianceDays.reason)}
            </span>
          );
        },
      },
      {
        id: 'health',
        label: 'Health',
        width: '160px',
        render: (source) => {
          const row = source as unknown as ExecutionBankRow;
          return row.health.status === 'KNOWN' ? (
            <EntityStatusChip
              status={row.health.value}
              label={row.health.value}
              tone={statusChipTone(row.health.value)}
            />
          ) : (
            <span>{unknownLabel(row.health.reason)}</span>
          );
        },
      },
      {
        id: 'blockerCount',
        label: 'Blockers',
        width: '100px',
        render: (source) => {
          const value = (source as unknown as ExecutionBankRow).blockerCount;
          return <span className="block text-right tabular-nums">{value ?? '—'}</span>;
        },
      },
      {
        id: 'pendingDecisionCount',
        label: 'Pending decisions',
        width: '140px',
        render: (source) => {
          const value = (source as unknown as ExecutionBankRow).pendingDecisionCount;
          return <span className="block text-right tabular-nums">{value ?? '—'}</span>;
        },
      },
      {
        id: 'resourceConstraint',
        label: 'Constraint',
        width: '160px',
        render: (source) => (
          <span>{(source as unknown as ExecutionBankRow).resourceConstraint ?? '—'}</span>
        ),
      },
      {
        id: 'nextAction',
        label: 'Next action',
        width: '180px',
        render: (source) => (
          <span>{(source as unknown as ExecutionBankRow).nextAction ?? '—'}</span>
        ),
      },
      {
        id: 'updatedAt',
        label: 'Updated / actions',
        width: '190px',
        render: (source) => (
          <span className={temporalClass}>
            {dateEvidenceLabel((source as unknown as ExecutionBankRow).updatedAt)}
          </span>
        ),
      },
    ],
    [calendarWindow.asOf, enhanced]
  );
  const rowMenu = (source: Record<string, unknown>): StandardRowMenu => {
    const row = source as unknown as ExecutionBankRow;
    return {
      primary: [{ id: 'open', label: 'Open', onClick: () => onOpen(row) }],
      universalHandlers: { preview: () => onSelect(row) },
    };
  };
  return (
    <StandardTable
      columns={columns}
      data={rows as Array<ExecutionBankRow & Record<string, unknown>>}
      selectedRowId={selected?.id ?? null}
      onRowClick={(row) => onSelect(row as unknown as ExecutionBankRow)}
      onRowDoubleClick={(row) => onOpen(row as unknown as ExecutionBankRow)}
      rowDescription={(row) => (row as unknown as ExecutionBankRow).description}
      rowMenu={rowMenu}
      persistKey="execution-bank-e1b"
      density="compact"
      empty={{
        title: 'No initiatives',
        description: 'Initiatives in this scope will appear here.',
      }}
    />
  );
};

const BankKanban = ({
  rows,
  enhanced = false,
  onSelect,
}: Pick<ExecutionBankViewsProps, 'rows' | 'enhanced' | 'onSelect'>) => {
  const stateIds = ['ACTIVE', 'PAUSED', 'CLOSING', 'CLOSED', 'UNKNOWN'];
  const extra = rows.map((row) => row.executionState).filter((state) => !stateIds.includes(state));
  const columns: StandardKanbanColumn[] = [...stateIds, ...new Set(extra)].map((id) => ({
    id,
    label: id,
    tone:
      id === 'CLOSED'
        ? 'success'
        : id === 'PAUSED' || id === 'CLOSING'
          ? 'warning'
          : id === 'UNKNOWN'
            ? 'neutral'
            : 'info',
  }));
  const cards = (columnId: string): StandardKanbanCard[] =>
    rows
      .filter((row) => row.executionState === columnId)
      .map((row) => ({
        id: row.id,
        columnId,
        title: row.name,
        description: row.description ?? undefined,
        chips: [
          { id: 'lifecycle', label: row.lifecycleStatus, tone: 'neutral' },
          {
            id: 'health',
            label: row.health.status === 'KNOWN' ? row.health.value : 'Unknown',
            tone:
              row.health.status === 'KNOWN' && row.health.value === 'CRITICAL'
                ? 'danger'
                : 'neutral',
          },
        ],
        projectLabel: enhanced
          ? (row.projectId ?? 'No project assigned')
          : caseAvailabilityLabel(row),
        dueLabel: dateEvidenceLabel(row.displayFinish),
        ownerName: row.ownerName ?? row.ownerId ?? undefined,
        ownerInitials: (row.ownerName ?? row.ownerId ?? '?').slice(0, 2).toUpperCase(),
        urgency:
          row.health.status === 'KNOWN' && row.health.value === 'CRITICAL'
            ? 'critical'
            : row.health.status === 'KNOWN' && row.health.value === 'AT_RISK'
              ? 'pending'
              : 'none',
        footer: (
          <span
            data-testid={`execution-bank-kanban-item-${row.id}`}
            data-initiative-id={row.initiativeId}
            data-execution-case-id={enhanced ? undefined : (row.executionCaseId ?? undefined)}
            className="text-[10px] text-c-text-muted"
          >
            {enhanced
              ? `Initiative history retained · data as of ${readableDate(row.updatedAt.meta.asOf)}`
              : row.executionCaseId
                ? 'Native case identity retained'
                : 'Initiative awaiting a case'}
          </span>
        ),
      }));
  return (
    <StandardKanban
      columns={columns}
      cards={cards}
      onCardClick={(card) => {
        const row = rows.find((item) => item.id === card.id);
        if (row) onSelect(row);
      }}
    />
  );
};

const rowBucket = (row: ExecutionBankRow, buckets: readonly ExecutionCalendarBucket[]) => {
  if (row.displayFinish.status !== 'KNOWN') return null;
  const finish = row.displayFinish.value;
  return buckets.find((bucket) => finish >= bucket.start && finish < bucket.endExclusive) ?? null;
};

const HorizonControls = ({
  calendarWindow,
  onHorizonChange,
}: Pick<ExecutionBankViewsProps, 'calendarWindow' | 'onHorizonChange'>) => (
  <div className="flex items-center gap-1 px-4 py-2" aria-label="Execution Bank horizon">
    {([1, 3, 6, 12] as const).map((months) => (
      <button
        key={months}
        type="button"
        aria-pressed={calendarWindow.horizonMonths === months}
        onClick={() => onHorizonChange(months)}
        className="h-7 rounded-full border border-c-border-subtle px-2.5 text-[11px] focus-visible:ring-2 focus-visible:ring-c-focus"
      >
        {months}m
      </button>
    ))}
    <span className="ml-2 text-[11px] text-c-text-muted">
      Reporting date {readableDate(calendarWindow.asOf)} ·{' '}
      {calendarWindow.resolution === 'WEEK' ? 'weekly scale' : 'monthly scale'}
    </span>
  </div>
);

const BankCalendar = ({
  rows,
  calendarWindow,
  enhanced = false,
  onSelect,
  onHorizonChange,
  onDrilldownMonth,
}: Pick<
  ExecutionBankViewsProps,
  'rows' | 'calendarWindow' | 'enhanced' | 'onSelect' | 'onHorizonChange' | 'onDrilldownMonth'
>) => {
  const { t } = useTranslation();
  const buckets = calendarWindow.drilldown?.buckets ?? calendarWindow.buckets;
  const unscheduled = rows.filter((row) => !rowBucket(row, buckets));
  return (
    <div className="h-full overflow-auto" data-testid="execution-bank-calendar">
      <HorizonControls calendarWindow={calendarWindow} onHorizonChange={onHorizonChange} />
      <div className="flex min-w-[900px] gap-2 px-4 pb-4">
        {buckets.map((bucket) => (
          <section
            key={bucket.id}
            className="min-h-48 min-w-[150px] flex-1 border-l border-c-border-subtle pl-2"
          >
            <button
              type="button"
              disabled={calendarWindow.resolution !== 'MONTH'}
              onClick={() => onDrilldownMonth(bucket.start.slice(0, 7))}
              className="text-[11px] font-semibold uppercase text-c-text-secondary"
            >
              {bucket.label}
            </button>
            {rows
              .filter((row) => rowBucket(row, [bucket]))
              .map((row) => (
                <button
                  type="button"
                  key={row.id}
                  data-testid={`execution-bank-calendar-item-${row.id}`}
                  data-initiative-id={row.initiativeId}
                  data-execution-case-id={enhanced ? undefined : (row.executionCaseId ?? undefined)}
                  onClick={() => onSelect(row)}
                  className="mt-2 block w-full rounded-lg border border-c-border-subtle bg-c-surface p-2 text-left focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  <span className="block text-sm font-semibold">{row.name}</span>
                  <span className="text-[10px] text-c-text-muted">
                    {row.displayFinish.status === 'KNOWN'
                      ? `${readableDate(row.displayFinish.value)} · ${row.displayFinish.reference?.toLowerCase()}`
                      : ''}
                  </span>
                </button>
              ))}
          </section>
        ))}
      </div>
      <section
        data-testid="execution-bank-unscheduled"
        className="mx-4 mb-4 rounded-lg border border-c-border-subtle p-3"
      >
        <h3 className="text-xs font-semibold uppercase text-c-text-secondary">
          {t('execution.rollout.plan.unscheduled')}
        </h3>
        {unscheduled.length ? (
          unscheduled.map((row) => (
            <button
              type="button"
              key={row.id}
              data-testid={`execution-bank-calendar-item-${row.id}`}
              data-initiative-id={row.initiativeId}
              data-execution-case-id={enhanced ? undefined : (row.executionCaseId ?? undefined)}
              onClick={() => onSelect(row)}
              className="mr-2 mt-2 rounded-full border border-c-border-subtle px-3 py-1 text-xs"
            >
              {row.name} ·{' '}
              {row.displayFinish.status === 'UNKNOWN'
                ? unknownLabel(row.displayFinish.reason)
                : 'Outside visible range'}
            </button>
          ))
        ) : (
          <span className="ml-2 text-xs text-c-text-muted">—</span>
        )}
      </section>
    </div>
  );
};

const GANTT_WIDTH = 1000;
const ganttDay = (value: string) => Date.parse(`${value.slice(0, 10)}T00:00:00.000Z`);
const ganttPosition = (value: string, window: ExecutionCalendarWindow) => {
  const start = ganttDay(window.start);
  const end = ganttDay(window.endExclusive);
  const point = ganttDay(value);
  if (![start, end, point].every(Number.isFinite) || end <= start) return null;
  return ((point - start) / (end - start)) * GANTT_WIDTH;
};

type GanttTrackKind = 'baseline' | 'current-plan' | 'forecast' | 'actual';

const GANTT_TRACKS: Array<{
  kind: GanttTrackKind;
  label: string;
  tone: string;
  start: keyof Pick<
    ExecutionBankRow,
    'baselineStart' | 'currentPlanStart' | 'forecastStart' | 'actualStart'
  >;
  finish: keyof Pick<
    ExecutionBankRow,
    'baselineFinish' | 'currentPlanFinish' | 'forecastFinish' | 'actualFinish'
  >;
}> = [
  {
    kind: 'baseline',
    label: 'Baseline',
    tone: 'fill-slate-400 stroke-slate-500',
    start: 'baselineStart',
    finish: 'baselineFinish',
  },
  {
    kind: 'current-plan',
    label: 'Current plan',
    tone: 'fill-blue-400 stroke-blue-500',
    start: 'currentPlanStart',
    finish: 'currentPlanFinish',
  },
  {
    kind: 'forecast',
    label: 'Forecast',
    tone: 'fill-amber-400 stroke-amber-500',
    start: 'forecastStart',
    finish: 'forecastFinish',
  },
  {
    kind: 'actual',
    label: 'Actual',
    tone: 'fill-emerald-500 stroke-emerald-600',
    start: 'actualStart',
    finish: 'actualFinish',
  },
];

const GanttTrack = ({
  row,
  calendarWindow,
  kind,
  label,
  tone,
  start,
  finish,
}: {
  row: ExecutionBankRow;
  calendarWindow: ExecutionCalendarWindow;
  kind: GanttTrackKind;
  label: string;
  tone: string;
  start: (typeof GANTT_TRACKS)[number]['start'];
  finish: (typeof GANTT_TRACKS)[number]['finish'];
}) => {
  const startEvidence = row[start];
  const finishEvidence = row[finish];
  const startValue = startEvidence.status === 'KNOWN' ? startEvidence.value : null;
  const finishValue = finishEvidence.status === 'KNOWN' ? finishEvidence.value : null;
  const startPosition = startValue ? ganttPosition(startValue, calendarWindow) : null;
  const finishPosition = finishValue ? ganttPosition(finishValue, calendarWindow) : null;
  const invalidRange = Boolean(
    startValue && finishValue && ganttDay(startValue) > ganttDay(finishValue)
  );
  const overlapsWindow = Boolean(
    startValue &&
    finishValue &&
    ganttDay(finishValue) >= ganttDay(calendarWindow.start) &&
    ganttDay(startValue) < ganttDay(calendarWindow.endExclusive)
  );
  const markerPosition = startPosition ?? finishPosition;
  const markerX =
    markerPosition !== null && markerPosition >= 0 && markerPosition < GANTT_WIDTH
      ? markerPosition
      : null;
  const intervalStartX = Math.max(0, startPosition ?? 0);
  const intervalFinishX = Math.min(GANTT_WIDTH, finishPosition ?? GANTT_WIDTH);
  const geometry = invalidRange
    ? 'invalid'
    : startValue && finishValue && overlapsWindow
      ? 'interval'
      : markerX !== null
        ? 'marker'
        : startValue || finishValue
          ? 'outside'
          : 'unknown';
  const unknownText =
    [
      ...new Set(
        [startEvidence, finishEvidence].flatMap((evidence) =>
          evidence.status === 'UNKNOWN' ? [unknownLabel(evidence.reason)] : []
        )
      ),
    ].join('; ') || null;

  return (
    <div
      className="grid grid-cols-[110px_minmax(620px,1fr)] items-center gap-2"
      data-testid={`execution-bank-gantt-track-${kind}-${row.id}`}
      data-geometry={geometry}
    >
      <span
        className="truncate text-[10px] font-medium text-c-text-secondary"
        title={unknownText ?? ''}
      >
        {label}
      </span>
      <div className="relative min-w-0">
        <svg
          viewBox={`0 0 ${GANTT_WIDTH} 20`}
          className="h-5 w-full overflow-visible"
          aria-label={`${label} timeline for ${row.name}`}
        >
          <line x1="0" y1="10" x2={GANTT_WIDTH} y2="10" className="stroke-c-border-subtle" />
          {geometry === 'interval' ? (
            <rect
              data-testid={`execution-bank-gantt-bar-${kind}-${row.id}`}
              data-start={startValue ?? undefined}
              data-end={finishValue ?? undefined}
              x={intervalStartX}
              y="5"
              width={Math.max(3, intervalFinishX - intervalStartX)}
              height="10"
              rx="5"
              className={tone}
            />
          ) : null}
          {geometry === 'marker' && markerX !== null ? (
            <circle
              data-testid={`execution-bank-gantt-marker-${kind}-${row.id}`}
              data-date={startValue ?? finishValue ?? undefined}
              cx={markerX}
              cy="10"
              r="6"
              className={tone}
            />
          ) : null}
        </svg>
        {geometry === 'unknown' || geometry === 'outside' || geometry === 'invalid' ? (
          <span className="absolute inset-y-0 left-1 flex items-center bg-c-surface px-1 text-[11px] text-c-text-muted">
            {geometry === 'outside'
              ? 'Outside visible range'
              : geometry === 'invalid'
                ? 'Invalid date range'
                : unknownText}
          </span>
        ) : null}
      </div>
    </div>
  );
};

const BankGantt = ({
  rows,
  calendarWindow,
  enhanced = false,
  onSelect,
  onHorizonChange,
}: Pick<
  ExecutionBankViewsProps,
  'rows' | 'calendarWindow' | 'enhanced' | 'onSelect' | 'onHorizonChange'
>) => (
  <div className="h-full overflow-auto" data-testid="execution-bank-gantt">
    <HorizonControls calendarWindow={calendarWindow} onHorizonChange={onHorizonChange} />
    <div className="min-w-[980px] px-4 pb-4">
      <div className="grid grid-cols-[220px_minmax(730px,1fr)] gap-3 items-end border-b border-c-border-subtle pb-2">
        <span className="text-[11px] font-semibold uppercase text-c-text-muted">
          Initiative schedule
        </span>
        <div
          className="grid grid-cols-[110px_minmax(620px,1fr)] items-center gap-2"
          data-testid="execution-bank-gantt-axis-layout"
        >
          <span className="text-[10px] font-medium text-c-text-secondary">Track</span>
          <div className="relative min-w-0">
            <svg
              viewBox={`0 0 ${GANTT_WIDTH} 36`}
              className="h-9 w-full overflow-visible"
              data-testid="execution-bank-gantt-axis"
              data-window-start={calendarWindow.start}
              data-window-end={calendarWindow.endExclusive}
              aria-label={`Timeline from ${readableDate(calendarWindow.start)} to ${readableDate(calendarWindow.endExclusive)}`}
            >
              {calendarWindow.buckets.map((bucket) => {
                const x = ganttPosition(bucket.start, calendarWindow) ?? 0;
                return (
                  <g key={bucket.id} data-testid={`execution-bank-gantt-tick-${bucket.id}`}>
                    <line x1={x} y1="18" x2={x} y2="36" className="stroke-c-border-subtle" />
                  </g>
                );
              })}
            </svg>
            {calendarWindow.buckets.map((bucket) => {
              const x = ganttPosition(bucket.start, calendarWindow) ?? 0;
              const label = new Intl.DateTimeFormat('en', {
                month: 'short',
                ...(calendarWindow.resolution === 'WEEK' ? { day: 'numeric' as const } : {}),
                timeZone: 'UTC',
              }).format(new Date(`${bucket.start}T00:00:00.000Z`));
              return (
                <span
                  key={bucket.id}
                  className="absolute top-0 ml-1 whitespace-nowrap text-[11px] leading-4 text-c-text-secondary"
                  style={{ left: `${(x / GANTT_WIDTH) * 100}%` }}
                  title={readableDate(bucket.start)}
                  aria-hidden="true"
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      {rows.map((row) => (
        <button
          type="button"
          key={row.id}
          data-testid={`execution-bank-gantt-item-${row.id}`}
          data-initiative-id={row.initiativeId}
          data-execution-case-id={enhanced ? undefined : (row.executionCaseId ?? undefined)}
          onClick={() => onSelect(row)}
          className="grid w-full grid-cols-[220px_minmax(730px,1fr)] gap-3 border-b border-c-border-subtle py-3 text-left focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <span>
            <strong className="block text-sm">{row.name}</strong>
            <small className="text-c-text-muted">
              {enhanced ? (row.projectId ?? 'No project assigned') : caseAvailabilityLabel(row)}
            </small>
            <small
              className="mt-1 block text-c-text-secondary"
              data-testid={`execution-bank-variance-${enhanced ? row.id : (row.executionCaseId ?? row.id)}`}
            >
              {row.varianceDays.status === 'KNOWN'
                ? `${row.varianceDays.value} ${Math.abs(row.varianceDays.value) === 1 ? 'day' : 'days'} · ${row.varianceDays.reference?.toLowerCase()}`
                : unknownLabel(row.varianceDays.reason)}
            </small>
          </span>
          <span className="space-y-1">
            {GANTT_TRACKS.map((track) => (
              <GanttTrack key={track.kind} row={row} calendarWindow={calendarWindow} {...track} />
            ))}
          </span>
        </button>
      ))}
    </div>
  </div>
);

export const ExecutionBankViews: React.FC<ExecutionBankViewsProps> = (props) => (
  <div
    className="h-full"
    data-testid={`execution-bank-view-${props.view}`}
    data-as-of={props.calendarWindow.asOf}
  >
    {props.view === 'table' ? <BankTable {...props} /> : null}
    {props.view === 'kanban' ? <BankKanban {...props} /> : null}
    {props.view === 'calendar' ? <BankCalendar {...props} /> : null}
    {props.view === 'gantt' ? <BankGantt {...props} /> : null}
  </div>
);

export default ExecutionBankViews;
