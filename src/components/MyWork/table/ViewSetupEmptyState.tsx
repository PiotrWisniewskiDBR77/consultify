/**
 * ViewSetupEmptyState — empty state for the table VIEWS THAT NEED A SPECIFIC
 * COLUMN to work at all (Timeline/Gantt, Calendar, Scoring, Decision log).
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
 * 2026-07-27, druga fala — the SAME defect, one notch worse, in two more tabs:
 * `Scoring` sorts by column `score` and `Decision log` groups by column
 * `decision`, and NEITHER key exists in `DEFAULT_COLUMNS`. So those two tabs
 * did not even print a dead-end message: Scoring reshuffled the rows by
 * comparing `undefined` to `undefined` (looks like work, means nothing) and
 * Decision log produced one nonsense group „IDEA (5)". A silent no-op is worse
 * than an error — it gives the user no signal at all. Both now route through
 * this component.
 *
 * Follows `EmptyFilterStateView` (Fala 8) 1:1 in shape and tokens: c-* only,
 * automatic light/dark, zero crimson (crimson is reserved for critical
 * semantics — CLAUDE.md UI pkt 3/6).
 */
import { CalendarPlus, CalendarRange, Eye, Gauge, Plus, Scale, Table2, Trophy } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Which view is asking. Only affects the icon and the headline/description
 * wording — the decision tree (`resolveColumnViewSetup`) is shared.
 */
export type SetupDrivenView = 'timeline' | 'calendar' | 'scoring' | 'decisionLog';

/** Subset that is driven by `date` columns (keeps the date helpers honest). */
export type DateDrivenView = Extract<SetupDrivenView, 'timeline' | 'calendar'>;

export type ViewSetupReason =
  /** The table has no column the view could read at all. */
  | 'no-column'
  /** A usable column exists but is hidden in the current view. */
  | 'hidden-column'
  /** Visible usable column(s) exist, rows exist, but no row carries a value. */
  | 'no-values'
  /** The table itself has no rows yet. */
  | 'no-rows';

export interface ViewSetupState {
  reason: ViewSetupReason;
  /** Human header of the column the message talks about (if any). */
  columnName?: string;
  /** Key of that column — needed to unhide it. */
  columnKey?: string;
}

/** @deprecated legacy aliases kept so date call-sites read naturally. */
export type DateViewSetupReason = ViewSetupReason;
/** @deprecated */
export type DateViewSetupState = ViewSetupState;

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

function hasAnyValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}

/**
 * The shared decision tree: WHY can this view not render anything?
 * Returns `null` when the view has everything it needs (caller renders normally).
 *
 * `matches` decides which columns can drive the view — by TYPE for the
 * date-driven views (any `date` column will do), by KEY for Scoring/Decision
 * log (their presets sort/group by one hardcoded key, so only that exact key
 * can ever satisfy them — anything else would promise a fix that does nothing).
 *
 * `allowHiddenColumns` — CalendarView deliberately falls back to a hidden date
 * column, so for it a hidden column is not a blocker.
 */
export function resolveColumnViewSetup(opts: {
  columns: MinimalColumn[];
  rows: MinimalRow[];
  matches: (column: MinimalColumn) => boolean;
  hasValue?: (value: unknown) => boolean;
  allowHiddenColumns?: boolean;
}): ViewSetupState | null {
  const { columns, rows, matches, hasValue = hasAnyValue, allowHiddenColumns = false } = opts;

  const allCols = columns.filter(matches);
  if (allCols.length === 0) return { reason: 'no-column' };

  const visibleCols = allCols.filter((c) => c.visible !== false);
  if (!allowHiddenColumns && visibleCols.length === 0) {
    const col = allCols[0];
    return {
      reason: 'hidden-column',
      columnName: col.header || col.key,
      columnKey: col.key,
    };
  }

  const usableCols = visibleCols.length > 0 ? visibleCols : allCols;

  if (rows.length === 0) return { reason: 'no-rows' };

  const anyValue = rows.some((r) => usableCols.some((c) => hasValue(r.data?.[c.key])));
  if (!anyValue) {
    const col = usableCols[0];
    return {
      reason: 'no-values',
      columnName: col.header || col.key,
      columnKey: col.key,
    };
  }

  return null;
}

/** Timeline/Calendar: any column of type `date` will do. */
export function resolveDateViewSetup(opts: {
  columns: MinimalColumn[];
  rows: MinimalRow[];
  allowHiddenColumns?: boolean;
  isDateValue?: (value: unknown) => boolean;
}): ViewSetupState | null {
  return resolveColumnViewSetup({
    columns: opts.columns,
    rows: opts.rows,
    matches: (c) => c.type === 'date',
    hasValue: opts.isDateValue ?? hasParsableDate,
    allowHiddenColumns: opts.allowHiddenColumns,
  });
}

/** The key the `scoring` preset sorts by (useTableViews.ts) — and the key
 *  `IdeaScoringModel` already writes its computed 0-100 score into. */
export const SCORE_COLUMN_KEY = 'score';
/** The key the `decision_log` preset groups by (useTableViews.ts). */
export const DECISION_COLUMN_KEY = 'decision';

/** Scoring: only the exact `score` key can satisfy the preset's sort. */
export function resolveScoringViewSetup(opts: {
  columns: MinimalColumn[];
  rows: MinimalRow[];
}): ViewSetupState | null {
  return resolveColumnViewSetup({
    ...opts,
    matches: (c) => c.key === SCORE_COLUMN_KEY,
  });
}

/** Decision log: only the exact `decision` key can satisfy the preset's groupBy. */
export function resolveDecisionViewSetup(opts: {
  columns: MinimalColumn[];
  rows: MinimalRow[];
}): ViewSetupState | null {
  return resolveColumnViewSetup({
    ...opts,
    matches: (c) => c.key === DECISION_COLUMN_KEY,
  });
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
  /**
   * The same schedule keyed by row — for callers whose `handleFieldChange`
   * closes over a STALE `nodes` array (the legacy IdeaTableTool one does), so
   * a loop of per-field calls would keep only the last write. Those callers
   * must apply this patch map in a single state update.
   */
  patchByRow: Record<string, Record<string, string>>;
}

/** Guard: the platform path writes one request per seeded field. */
const MAX_SEEDED_ROWS = 100;

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
  const patchByRow: DateColumnSeedPlan['patchByRow'] = {};
  rowIds.slice(0, MAX_SEEDED_ROWS).forEach((rowId, idx) => {
    const start = new Date(base);
    start.setDate(start.getDate() + idx * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 5);
    values.push({ rowId, key: startKey, value: isoDay(start) });
    values.push({ rowId, key: endKey, value: isoDay(end) });
    patchByRow[rowId] = { [startKey]: isoDay(start), [endKey]: isoDay(end) };
  });

  return {
    patchByRow,
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

/**
 * Builds the "Add score column" fix for the Scoring tab: ONE `number` column
 * under the exact key the preset sorts by.
 *
 * Type is `number`, not `rating`: `IdeaScoringModel` ("Model scoringowy" in the
 * toolbar) already writes `data.score` as a composite 0-100 integer — into a
 * column that did not exist, so the result was invisible too. A 1-5 `rating`
 * column would silently truncate that. Making the column a `number` under the
 * same key repairs BOTH silent no-ops with one artefact.
 *
 * No fabricated values: a made-up "score" is a lie about a judgement the user
 * has not made (unlike the Gantt's draft dates, which are visibly a draft).
 * Rows already scored by the model light up instantly; otherwise the view lands
 * on the `no-values` state, whose action opens the scoring model.
 */
export function buildScoreColumnSeedPlan(opts: { t: (key: string, fallback?: string) => string }): {
  columns: { key: string; header: string; type: 'number'; visible: true; width: number }[];
} {
  return {
    columns: [
      {
        key: SCORE_COLUMN_KEY,
        header: opts.t('ideas.table.viewSetup.columnHeader.score', 'Score'),
        type: 'number',
        visible: true,
        width: 110,
      },
    ],
  };
}

/** The neutral starting value every row of a fresh decision log truthfully has. */
export const DECISION_DEFAULT_VALUE = 'open';

/**
 * Builds the "Add decision column" fix for the Decision log tab: one `select`
 * column under the exact key the preset groups by, seeded with `open` on every
 * existing row.
 *
 * `select`, not `status`: a decision is a categorical OUTCOME, not a workflow
 * state — same shape as the existing `priority` column.
 *
 * Seeding `open` everywhere is not a fabrication (unlike inventing a decision
 * that was never taken) — it is the truthful initial state of every row in a
 * log nobody has ruled on yet, and it is what makes the view work on click:
 * one group now, and each chip the user flips splits a new one off.
 *
 * Colours: deliberately NO red for `rejected`. Crimson/red is reserved for
 * critical semantics (CLAUDE.md UI pkt 3); a rejected item is an outcome, not
 * an error.
 */
export function buildDecisionColumnSeedPlan(opts: {
  rowIds: string[];
  t: (key: string, fallback?: string) => string;
}): {
  columns: {
    key: string;
    header: string;
    type: 'select';
    visible: true;
    width: number;
    options: string[];
    optionColors: Record<string, string>;
  }[];
  values: { rowId: string; key: string; value: string }[];
  /**
   * The same seed keyed by row — for callers whose `handleFieldChange` closes
   * over a STALE `nodes` array (the legacy IdeaTableTool one does), so a loop
   * of per-field calls would keep only the last write.
   */
  patchByRow: Record<string, Record<string, string>>;
} {
  const values: { rowId: string; key: string; value: string }[] = [];
  const patchByRow: Record<string, Record<string, string>> = {};
  opts.rowIds.slice(0, MAX_SEEDED_ROWS).forEach((rowId) => {
    values.push({ rowId, key: DECISION_COLUMN_KEY, value: DECISION_DEFAULT_VALUE });
    patchByRow[rowId] = { [DECISION_COLUMN_KEY]: DECISION_DEFAULT_VALUE };
  });

  return {
    columns: [
      {
        key: DECISION_COLUMN_KEY,
        header: opts.t('ideas.table.viewSetup.columnHeader.decision', 'Decision'),
        type: 'select',
        visible: true,
        width: 140,
        options: [DECISION_DEFAULT_VALUE, 'made', 'deferred', 'rejected'],
        optionColors: {
          open: '#e0e7ff',
          made: '#d1fae5',
          deferred: '#fef3c7',
          rejected: '#e5e7eb',
        },
      },
    ],
    values,
    patchByRow,
  };
}

const VIEW_ICON: Record<SetupDrivenView, typeof CalendarPlus> = {
  timeline: CalendarPlus,
  calendar: CalendarRange,
  scoring: Gauge,
  decisionLog: Scale,
};

/** Fallback copy (EN) per view × reason. i18n owns the real strings. */
const FALLBACK: Record<SetupDrivenView, Record<ViewSetupReason, [string, string]>> = {
  timeline: {
    'no-column': [
      'Timeline needs a date column',
      'This table has no column of type "date", so there is nothing to put on the time axis. Add one — we will schedule the existing rows starting today, and you can drag the bars afterwards.',
    ],
    'hidden-column': [
      'Date column "{{column}}" is hidden',
      'This view hides it, so there is nothing left to place on the axis. Show the column to bring the records back.',
    ],
    'no-values': [
      'Column "{{column}}" has no dates filled in',
      'The date column exists, but no row has a value in it — that is why this view is empty. Go back to the table and fill in the dates.',
    ],
    'no-rows': [
      'This table has no rows yet',
      'Add the first row in the Table view and come back here.',
    ],
  },
  calendar: {
    'no-column': [
      'Calendar needs a date column',
      'This table has no column of type "date", so no record can land on a day. Add one — we will schedule the existing rows starting today.',
    ],
    'hidden-column': [
      'Date column "{{column}}" is hidden',
      'This view hides it, so no record can land on a day. Show the column to bring the records back.',
    ],
    'no-values': [
      'Column "{{column}}" has no dates filled in',
      'The date column exists, but no row has a value in it — that is why this view is empty. Go back to the table and fill in the dates.',
    ],
    'no-rows': [
      'This table has no rows yet',
      'Add the first row in the Table view and come back here.',
    ],
  },
  scoring: {
    'no-column': [
      'Scoring needs a score column',
      'This view ranks rows by the "Score" column — and this table does not have one, so switching to it changed nothing. Add the column and the ranking starts working; the scoring model writes into the same column.',
    ],
    'hidden-column': [
      'Score column "{{column}}" is hidden',
      'This view hides it, so the ranking has nothing to show. Show the column to see the scores.',
    ],
    'no-values': [
      'Column "{{column}}" has no scores yet',
      'The column exists, but no row has been scored — so there is nothing to rank. Run the scoring model, or type the scores in the Table view.',
    ],
    'no-rows': [
      'This table has no rows yet',
      'Add the first row in the Table view and come back here.',
    ],
  },
  decisionLog: {
    'no-column': [
      'The decision log needs a decision column',
      'This view groups rows by the "Decision" column — and this table does not have one, so it lumped everything into one meaningless group. Add the column: every row starts as "open" and moves to its own group as you rule on it.',
    ],
    'hidden-column': [
      'Decision column "{{column}}" is hidden',
      'This view hides it, so there is nothing to group by. Show the column to get the log back.',
    ],
    'no-values': [
      'Column "{{column}}" has no decisions filled in',
      'The column exists, but no row has a decision recorded — so the log has nothing to group. Go back to the table and set the decisions.',
    ],
    'no-rows': [
      'This table has no rows yet',
      'Add the first row in the Table view and come back here.',
    ],
  },
};

const REASON_I18N: Record<ViewSetupReason, string> = {
  'no-column': 'noColumn',
  'hidden-column': 'hiddenColumn',
  'no-values': 'noValues',
  'no-rows': 'noRows',
};

const ADD_COLUMN_FALLBACK: Record<SetupDrivenView, string> = {
  timeline: 'Add date column',
  calendar: 'Add date column',
  scoring: 'Add score column',
  decisionLog: 'Add decision column',
};

export interface ViewSetupEmptyStateProps {
  view: SetupDrivenView;
  state: ViewSetupState;
  /** Read-only table — mutating actions are hidden, the way back stays. */
  locked?: boolean;
  /** Creates the real column(s) the view needs (and seeds them where honest). */
  onAddColumn?: () => void;
  /** Makes an existing but hidden column visible again. */
  onShowColumn?: (columnKey: string) => void;
  /** One click back to the view that always shows the data. */
  onBackToTable?: () => void;
  /** Adds the first row (only offered for `no-rows`). */
  onAddRow?: () => void;
  /**
   * Extra way out offered on `no-values` — the tool that FILLS the column
   * (Scoring: „Model scoringowy"). Without it the column-exists-but-empty
   * state would be the next dead end.
   */
  onFillValues?: () => void;
}

export const ViewSetupEmptyState: React.FC<ViewSetupEmptyStateProps> = ({
  view,
  state,
  locked = false,
  onAddColumn,
  onShowColumn,
  onBackToTable,
  onAddRow,
  onFillValues,
}) => {
  const { t } = useTranslation();
  const { reason, columnName, columnKey } = state;

  const Icon = VIEW_ICON[view];
  const slug = REASON_I18N[reason];
  const [headlineFallback, descriptionFallback] = FALLBACK[view][reason];

  const headline = t(`ideas.table.viewSetup.${view}.${slug}.headline`, {
    defaultValue: headlineFallback,
    column: columnName,
  });
  const description = t(`ideas.table.viewSetup.${view}.${slug}.description`, {
    defaultValue: descriptionFallback,
    column: columnName,
  });

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
        {reason === 'no-column' && !locked && onAddColumn && (
          <button
            type="button"
            onClick={onAddColumn}
            data-testid="view-setup-add-column"
            className={primaryClass}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            {t(`ideas.table.viewSetup.action.addColumn.${view}`, ADD_COLUMN_FALLBACK[view])}
          </button>
        )}

        {reason === 'hidden-column' && columnKey && onShowColumn && (
          <button
            type="button"
            onClick={() => onShowColumn(columnKey)}
            data-testid="view-setup-show-column"
            className={primaryClass}
          >
            <Eye className="h-3.5 w-3.5 shrink-0" />
            {t('ideas.table.viewSetup.action.showColumn', 'Show column "{{column}}"', {
              column: columnName,
            })}
          </button>
        )}

        {reason === 'no-values' && !locked && onFillValues && (
          <button
            type="button"
            onClick={onFillValues}
            data-testid="view-setup-fill-values"
            className={primaryClass}
          >
            <Trophy className="h-3.5 w-3.5 shrink-0" />
            {t('ideas.table.viewSetup.action.runScoringModel', 'Run the scoring model')}
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
            className={reason === 'no-values' && !onFillValues ? primaryClass : secondaryClass}
          >
            <Table2 className="h-3.5 w-3.5 shrink-0" />
            {/* Timeline/Kalendarz wracają do UKŁADU „Tabela"; Scoring i Log
                decyzji już są w układzie tabeli — ich wyjściem jest ZAKŁADKA
                „Domyślny". Jeden przycisk, dwa różne cele, więc i dwie różne
                etykiety: napis musi mówić, gdzie klik naprawdę zaprowadzi. */}
            {view === 'scoring' || view === 'decisionLog'
              ? t('ideas.table.viewSetup.action.backToDefaultView', 'Back to the Default view')
              : t('ideas.table.viewSetup.action.backToTable', 'Back to Table view')}
          </button>
        )}
      </div>
    </div>
  );
};

export default ViewSetupEmptyState;
