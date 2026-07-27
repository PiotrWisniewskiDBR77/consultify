/**
 * ViewSetupEmptyState — empty state for the table VIEWS THAT NEED A SPECIFIC
 * KIND OF COLUMN to work at all (Timeline/Gantt, Calendar).
 *
 * Why this exists (incydent właściciela 2026-07-27):
 * the Timeline tab used to render a dead-end message — "No dates to display ·
 * Add »date« type columns to see the timeline". The owner added a column, it
 * was not a `date` column, nothing changed, and nothing on screen told him
 * why. His words: „nie wiem jak zbudować tabelę". The view tabs (Table ·
 * Default · Triage · Scoring · Decision log · Timeline) LOOK like peers but
 * behave completely differently, so a view that silently needs a prerequisite
 * must (a) name the exact prerequisite and (b) hand over a working way out —
 * never a description of the problem alone.
 *
 * Follows `EmptyFilterStateView` (Fala 8) 1:1 in shape and tokens: c-* only,
 * automatic light/dark, zero crimson (crimson is reserved for critical
 * semantics — CLAUDE.md UI pkt 3/6).
 */
import { CalendarPlus, CalendarRange, Eye, Plus, Table2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

/** Which view is asking. Only affects the headline/description wording. */
export type DateDrivenView = 'timeline' | 'calendar';

export type DateViewSetupReason =
  /** The table has no column of type `date` at all. */
  | 'no-date-column'
  /** A `date` column exists but is hidden in the current view. */
  | 'hidden-date-column'
  /** Visible `date` column(s) exist, rows exist, but no row carries a value. */
  | 'no-date-values'
  /** The table itself has no rows yet. */
  | 'no-rows';

export interface DateViewSetupState {
  reason: DateViewSetupReason;
  /** Human header of the date column the message talks about (if any). */
  columnName?: string;
  /** Key of that column — needed to unhide it. */
  columnKey?: string;
}

interface MinimalColumn {
  key: string;
  header?: string;
  type?: string;
  visible?: boolean;
}

interface MinimalRow {
  data?: Record<string, unknown> | null;
}

function hasParsableDate(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  const d = new Date(value as string);
  return !isNaN(d.getTime());
}

/**
 * Decides WHY a date-driven view cannot render anything.
 * Returns `null` when the view has everything it needs (caller renders normally).
 *
 * `allowHiddenColumns` — CalendarView deliberately falls back to a hidden date
 * column, so for it a hidden column is not a blocker.
 */
export function resolveDateViewSetup(opts: {
  columns: MinimalColumn[];
  rows: MinimalRow[];
  allowHiddenColumns?: boolean;
  isDateValue?: (value: unknown) => boolean;
}): DateViewSetupState | null {
  const { columns, rows, allowHiddenColumns = false, isDateValue = hasParsableDate } = opts;

  const allDateCols = columns.filter((c) => c.type === 'date');
  if (allDateCols.length === 0) return { reason: 'no-date-column' };

  const visibleDateCols = allDateCols.filter((c) => c.visible !== false);
  if (!allowHiddenColumns && visibleDateCols.length === 0) {
    const col = allDateCols[0];
    return {
      reason: 'hidden-date-column',
      columnName: col.header || col.key,
      columnKey: col.key,
    };
  }

  const usableCols = visibleDateCols.length > 0 ? visibleDateCols : allDateCols;

  if (rows.length === 0) return { reason: 'no-rows' };

  const anyValue = rows.some((r) => usableCols.some((c) => isDateValue(r.data?.[c.key])));
  if (!anyValue) {
    const col = usableCols[0];
    return {
      reason: 'no-date-values',
      columnName: col.header || col.key,
      columnKey: col.key,
    };
  }

  return null;
}

export interface DateColumnSeedPlan {
  columns: {
    key: string;
    header: string;
    type: 'date';
    visible: true;
    width: number;
  }[];
  /** Pre-filled schedule so the view actually SHOWS something after the fix. */
  values: { rowId: string; key: string; value: string }[];
}

function uniqueKey(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Builds the "Add date column" fix: a start + end `date` column pair PLUS a
 * starting schedule for the rows that already exist (row N starts N weeks from
 * today, runs 5 days). Two columns, not one — the Gantt reads the first date
 * column as start and the second as end; with a single column every bar
 * collapses to a 16px dot, which would land the user in a second dead end.
 * The dates are a draft the user drags around; that is what a Gantt is for.
 */
export function buildDateColumnSeedPlan(opts: {
  existingKeys: string[];
  rowIds: string[];
  t: (key: string, fallback?: string) => string;
  today?: Date;
}): DateColumnSeedPlan {
  const { existingKeys, rowIds, t, today = new Date() } = opts;
  const taken = new Set(existingKeys);

  const startKey = uniqueKey('timeline_start', taken);
  taken.add(startKey);
  const endKey = uniqueKey('timeline_end', taken);
  taken.add(endKey);

  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const values: DateColumnSeedPlan['values'] = [];
  rowIds.forEach((rowId, idx) => {
    const start = new Date(base);
    start.setDate(start.getDate() + idx * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 5);
    values.push({ rowId, key: startKey, value: isoDay(start) });
    values.push({ rowId, key: endKey, value: isoDay(end) });
  });

  return {
    columns: [
      {
        key: startKey,
        header: t('ideas.table.viewSetup.columnHeader.start', 'Start date'),
        type: 'date',
        visible: true,
        width: 140,
      },
      {
        key: endKey,
        header: t('ideas.table.viewSetup.columnHeader.end', 'End date'),
        type: 'date',
        visible: true,
        width: 140,
      },
    ],
    values,
  };
}

export interface ViewSetupEmptyStateProps {
  view: DateDrivenView;
  state: DateViewSetupState;
  /** Read-only table — mutating actions are hidden, the way back stays. */
  locked?: boolean;
  /** Creates real `date` column(s) AND schedules existing rows, so the view fills up. */
  onAddDateColumn?: () => void;
  /** Makes an existing but hidden date column visible again. */
  onShowDateColumn?: (columnKey: string) => void;
  /** One click back to the view that always shows the data. */
  onBackToTable?: () => void;
  /** Adds the first row (only offered for `no-rows`). */
  onAddRow?: () => void;
}

export const ViewSetupEmptyState: React.FC<ViewSetupEmptyStateProps> = ({
  view,
  state,
  locked = false,
  onAddDateColumn,
  onShowDateColumn,
  onBackToTable,
  onAddRow,
}) => {
  const { t } = useTranslation();
  const { reason, columnName, columnKey } = state;

  const Icon = view === 'calendar' ? CalendarRange : CalendarPlus;

  const headline =
    reason === 'no-date-column'
      ? t(
          `ideas.table.viewSetup.${view}.noDateColumn.headline`,
          view === 'calendar' ? 'Calendar needs a date column' : 'Timeline needs a date column'
        )
      : reason === 'hidden-date-column'
        ? t('ideas.table.viewSetup.hiddenDateColumn.headline', 'Date column "{{column}}" is hidden', {
            column: columnName,
          })
        : reason === 'no-date-values'
          ? t(
              'ideas.table.viewSetup.noDateValues.headline',
              'Column "{{column}}" has no dates filled in',
              { column: columnName }
            )
          : t('ideas.table.viewSetup.noRows.headline', 'This table has no rows yet');

  const description =
    reason === 'no-date-column'
      ? t(
          `ideas.table.viewSetup.${view}.noDateColumn.description`,
          view === 'calendar'
            ? 'This table has no column of type "date", so no record can land on a day. Add one — we will schedule the existing rows starting today.'
            : 'This table has no column of type "date", so there is nothing to put on the time axis. Add one — we will schedule the existing rows starting today, and you can drag the bars afterwards.'
        )
      : reason === 'hidden-date-column'
        ? t(
            'ideas.table.viewSetup.hiddenDateColumn.description',
            'This view hides it, so there is nothing left to place on the axis. Show the column to bring the records back.'
          )
        : reason === 'no-date-values'
          ? t(
              'ideas.table.viewSetup.noDateValues.description',
              'The date column exists, but no row has a value in it — that is why this view is empty. Go back to the table and fill in the dates.'
            )
          : t(
              'ideas.table.viewSetup.noRows.description',
              'Add the first row in the Table view and come back here.'
            );

  const primaryClass =
    'inline-flex items-center justify-center gap-2 rounded-xl bg-c-text px-4 py-2.5 text-xs font-semibold text-c-surface shadow-sm transition-[filter,box-shadow] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';
  const secondaryClass =
    'inline-flex items-center justify-center gap-2 rounded-xl border border-c-border-subtle bg-c-surface-raised px-4 py-2.5 text-xs font-semibold text-c-text transition-colors hover:bg-c-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';

  return (
    <div
      data-testid="view-setup-empty-state"
      data-reason={reason}
      className="flex flex-1 flex-col items-center justify-center text-center px-6 py-14 max-w-md mx-auto"
    >
      <div
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-c-surface-raised ring-1 ring-c-border-subtle shadow-inner"
        aria-hidden
      >
        <Icon className="h-9 w-9 text-c-text-secondary" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-semibold text-c-text tracking-tight">{headline}</h3>
      <p className="mt-2 text-sm text-c-text-muted leading-relaxed">{description}</p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        {reason === 'no-date-column' && !locked && onAddDateColumn && (
          <button
            type="button"
            onClick={onAddDateColumn}
            data-testid="view-setup-add-date-column"
            className={primaryClass}
          >
            <CalendarPlus className="h-3.5 w-3.5 shrink-0" />
            {t('ideas.table.viewSetup.action.addDateColumn', 'Add date column')}
          </button>
        )}

        {reason === 'hidden-date-column' && columnKey && onShowDateColumn && (
          <button
            type="button"
            onClick={() => onShowDateColumn(columnKey)}
            data-testid="view-setup-show-date-column"
            className={primaryClass}
          >
            <Eye className="h-3.5 w-3.5 shrink-0" />
            {t('ideas.table.viewSetup.action.showColumn', 'Show column "{{column}}"', {
              column: columnName,
            })}
          </button>
        )}

        {reason === 'no-rows' && !locked && onAddRow && (
          <button
            type="button"
            onClick={onAddRow}
            data-testid="view-setup-add-row"
            className={primaryClass}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            {t('ideas.table.viewSetup.action.addRow', 'Add row')}
          </button>
        )}

        {onBackToTable && (
          <button
            type="button"
            onClick={onBackToTable}
            data-testid="view-setup-back-to-table"
            className={reason === 'no-date-values' ? primaryClass : secondaryClass}
          >
            <Table2 className="h-3.5 w-3.5 shrink-0" />
            {t('ideas.table.viewSetup.action.backToTable', 'Back to Table view')}
          </button>
        )}
      </div>
    </div>
  );
};

export default ViewSetupEmptyState;
