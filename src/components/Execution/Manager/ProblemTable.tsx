/**
 * ProblemTable — standard table of problems for Manager module lanes.
 *
 * Canon §27 (M14/L-06): a genuine LIST table — flat problem rows with a severity
 * filter, click-to-preview, double-click-to-open, and a portal kebab. Rendered via
 * the shared canonical `FilterableTable` (read-only cells + filterable headers +
 * RowActionsMenu) instead of a hand-rolled raw <table>/grid.
 *
 * Follows TABLE_AND_PREVIEW_CANON.md: full-width monochrome rows (severity lives
 * in a leading signal dot + severity chip, NOT the row background/border),
 * portal kebab actions, click-to-preview, double-click-to-open.
 */

import { ChevronRight, Search, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  FilterableTable,
  type FilterChip,
  type TableColumn,
} from '@/components/shared/ModuleHub';
import type { RowAction } from '@/components/shared/RowActionsMenu';
import { EntityStatusChip } from '@/components/ui/primitives';

import type { ManagerProblemRow, ProblemAction, ProblemSeverity } from './types';

/** Severity → canonical chip tone (§4.1). critical = danger alarm. */
const SEVERITY_STATUS: Record<ProblemSeverity, string> = {
  critical: 'blocked',
  warning: 'escalated',
  info: 'open',
};

/** Severity dot color, driven by canonical tone (§3.5 — signal dot, c.* family). */
const SEVERITY_DOT: Record<ProblemSeverity, string> = {
  critical: 'bg-c-danger',
  warning: 'bg-c-warning',
  info: 'bg-c-info',
};

interface ProblemTableProps {
  rows: ManagerProblemRow[];
  selectedId: string | null;
  onSelect: (row: ManagerProblemRow) => void;
  onDoubleClick?: (row: ManagerProblemRow) => void;
  onAction: (row: ManagerProblemRow, action: ProblemAction) => void;
  loading?: boolean;
  emptyMessage?: string;
}

function TypeBadge({ type }: { type: string }) {
  const label = type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const colors: Record<string, string> = {
    critical_risk: 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-400',
    high_risk: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    overdue_task: 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-400',
    blocked_task: 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-400',
    blocked_initiative: 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-400',
    overdue_decision: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    pending_decision: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    unassigned_task: 'bg-blue-50/70 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    no_owner: 'bg-blue-50/70 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    stale_item: 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400',
  };
  const cls = colors[type] || 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400';
  return (
    <span
      className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${cls}`}
    >
      {label}
    </span>
  );
}

function SourceChip({ type, name }: { type: string; name: string }) {
  const icons: Record<string, string> = {
    INITIATIVE: '🎯',
    TASK: '📋',
    DECISION: '⚖️',
    RAID_ITEM: '🛡️',
    PERSON: '👤',
  };
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-navy-800 text-[10px] text-slate-600 dark:text-slate-400 max-w-[140px] truncate">
      <span>{icons[type] || '📄'}</span>
      <span className="truncate">{name}</span>
    </span>
  );
}

/** English fallback label for a severity (i18n key drives the live label). */
function severityLabel(severity: ProblemSeverity): string {
  switch (severity) {
    case 'critical':
      return 'Critical';
    case 'warning':
      return 'Warning';
    default:
      return 'Info';
  }
}

type TFn = (key: string, fallback: string) => string;

/**
 * Build the canon §27 kebab actions for a problem row: the row's contextual
 * triage actions first, then the fixed "Otwórz podgląd" manage action, then any
 * danger-variant triage actions (RowActionsMenu renders dividers between groups).
 */
function buildRowActions(
  row: ManagerProblemRow,
  t: TFn,
  onSelect: (row: ManagerProblemRow) => void,
  onAction: (row: ManagerProblemRow, action: ProblemAction) => void
): RowAction[] {
  const contextActions: RowAction[] = row.actions
    .filter((a) => a.variant !== 'danger')
    .map((a) => ({
      id: a.id,
      label: a.label,
      variant: a.variant,
      onClick: () => onAction(row, a),
    }));

  const openPreview: RowAction = {
    id: 'open-preview',
    label: t('common.openPreview', 'Otwórz podgląd'),
    icon: ChevronRight,
    divider: contextActions.length > 0,
    onClick: () => onSelect(row),
  };

  const dangerActions: RowAction[] = row.actions
    .filter((a) => a.variant === 'danger')
    .map((a, idx) => ({
      id: a.id,
      label: a.label,
      variant: 'danger' as const,
      divider: idx === 0,
      onClick: () => onAction(row, a),
    }));

  return [...contextActions, openPreview, ...dangerActions];
}

export function ProblemTable({
  rows,
  selectedId,
  onSelect,
  onDoubleClick,
  onAction,
  loading,
  emptyMessage,
}: ProblemTableProps) {
  const { t } = useTranslation();
  // Canon §27 — column-header filter state (the severity filter lives here now).
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  // Free-text search (restored): managed in-component because FilterableTable renders
  // whatever `data` it's given — so we pre-filter the rows array before passing it down.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Per-severity tallies, computed over the FULL (unfiltered) rows for a stable header.
  const counts = useMemo(
    () => ({
      all: rows.length,
      critical: rows.filter((r) => r.severity === 'critical').length,
      warning: rows.filter((r) => r.severity === 'warning').length,
      info: rows.filter((r) => r.severity === 'info').length,
    }),
    [rows]
  );

  // Free-text pre-filter over the same searchable fields the original searched.
  const searchedRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.sourceEntityName.toLowerCase().includes(q) ||
        r.rootCause.toLowerCase().includes(q) ||
        (r.ownerName || '').toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  // Map domain rows → canonical TableRow shape. `severity` is a plain string so the
  // FilterableTable header filter can match on it; the column `render` rebuilds the
  // signal-dot + canonical chip presentation (§3.5/§4.1).
  const data = useMemo(
    () =>
      searchedRows.map((row) => ({
        id: row.id,
        severity: row.severity,
        title: row.title,
        rootCause: row.rootCause,
        problemType: row.problemType,
        sourceEntityType: row.sourceEntityType,
        sourceEntityName: row.sourceEntityName,
        daysOverdue: row.daysOverdue,
        impactCount: row.impactCount,
        ownerName: row.ownerName,
        __row: row,
      })),
    [searchedRows]
  );

  const columns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'severity',
        label: t('manager.col.severity', 'Severity'),
        width: '150px',
        filterable: true,
        filterOptions: (['critical', 'warning', 'info'] as const).map((sev) => ({
          value: sev,
          label: t(`manager.severity.${sev}`, severityLabel(sev)),
        })),
        render: (r: any) => {
          const sev = r.severity as ProblemSeverity;
          return (
            <span className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${SEVERITY_DOT[sev]}`} />
              <EntityStatusChip
                status={SEVERITY_STATUS[sev]}
                label={t(`manager.severity.${sev}`, severityLabel(sev))}
              />
            </span>
          );
        },
      },
      {
        id: 'title',
        label: t('manager.col.problem', 'Problem'),
        render: (r: any) => (
          <div className="min-w-0">
            <p className="text-xs font-medium text-c-text truncate">{r.title}</p>
            <p className="text-[10px] text-c-text-muted truncate mt-0.5">
              {r.rootCause}
            </p>
          </div>
        ),
      },
      {
        id: 'problemType',
        label: t('manager.col.type', 'Type'),
        width: '150px',
        render: (r: any) => <TypeBadge type={r.problemType} />,
      },
      {
        id: 'sourceEntityName',
        label: t('manager.col.source', 'Source'),
        width: '160px',
        render: (r: any) => <SourceChip type={r.sourceEntityType} name={r.sourceEntityName} />,
      },
      {
        id: 'daysOverdue',
        label: t('manager.col.overdue', 'Overdue'),
        width: '100px',
        align: 'right',
        render: (r: any) => {
          if (r.daysOverdue !== null && r.daysOverdue > 0) {
            return (
              <span className="text-xs tabular-nums font-medium text-danger-600 dark:text-danger-400">
                {r.daysOverdue}d
              </span>
            );
          }
          if (r.daysOverdue !== null && r.daysOverdue < 0) {
            return (
              <span className="text-xs tabular-nums text-c-text-secondary">
                {t('manager.dueIn', 'in')} {Math.abs(r.daysOverdue)}d
              </span>
            );
          }
          return <span className="text-xs text-c-text-muted">—</span>;
        },
      },
      {
        id: 'impactCount',
        label: t('manager.col.impact', 'Impact'),
        width: '100px',
        align: 'right',
        render: (r: any) =>
          r.impactCount > 0 ? (
            <span className="text-xs tabular-nums text-amber-600 dark:text-amber-400">
              {r.impactCount} ↓
            </span>
          ) : (
            <span className="text-xs text-c-text-muted">—</span>
          ),
      },
      {
        id: 'ownerName',
        label: t('manager.col.owner', 'Owner'),
        width: '140px',
        render: (r: any) => (
          <span className="text-xs text-c-text-secondary truncate block">
            {r.ownerName || '—'}
          </span>
        ),
      },
    ],
    [t]
  );

  const getRowActions = useCallback(
    (r: any): RowAction[] => buildRowActions(r.__row as ManagerProblemRow, t, onSelect, onAction),
    [t, onSelect, onAction]
  );

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <FilterableTable
          columns={columns}
          data={[]}
          activeFilters={activeFilters}
          onFilterChange={setActiveFilters}
          emptyMessage={t('common.loading', 'Loading…')}
          density="compact"
          canvasClassName="p-0"
          enableColumnSettings={false}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header: per-severity count badges (restored) + free-text search toggle. */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-c-border-subtle bg-c-surface">
        {/* Per-severity count badges */}
        <div className="flex items-center gap-1.5" data-testid="severity-counts">
          {(['critical', 'warning', 'info'] as const).map((sev) => (
            <span
              key={sev}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-c-border bg-c-surface text-[11px] font-medium text-c-text-muted whitespace-nowrap"
              data-testid={`severity-count-${sev}`}
            >
              <span className={`w-2 h-2 rounded-full ${SEVERITY_DOT[sev]}`} />
              <span>{t(`manager.severity.${sev}`, severityLabel(sev))}</span>
              <span className="tabular-nums opacity-70">{counts[sev]}</span>
            </span>
          ))}
        </div>

        <div className="flex-1" />

        {/* Search toggle */}
        {searchOpen ? (
          <div className="flex items-center gap-1 h-9 px-2 rounded-lg border border-c-border bg-c-surface-raised">
            <Search size={14} className="text-c-text-muted shrink-0" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('common.search', 'Search...')}
              aria-label={t('common.search', 'Search...')}
              className="w-40 text-xs bg-transparent outline-none focus:ring-2 focus:ring-c-focus text-c-text placeholder:text-c-text-muted"
            />
            <button
              type="button"
              aria-label={t('common.clear', 'Clear search')}
              onClick={() => {
                setSearchQuery('');
                setSearchOpen(false);
              }}
            >
              <X size={14} className="text-c-text-muted hover:text-c-text-secondary" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            aria-label={t('common.search', 'Search...')}
            onClick={() => setSearchOpen(true)}
            className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-c-surface-raised"
          >
            <Search size={14} className="text-c-text-muted" />
          </button>
        )}
      </div>

      <FilterableTable
        columns={columns}
        data={data}
        selectedRowId={selectedId}
        activeFilters={activeFilters}
        onFilterChange={setActiveFilters}
        onRowClick={(r: any) => onSelect(r.__row as ManagerProblemRow)}
        onRowDoubleClick={(r: any) => onDoubleClick?.(r.__row as ManagerProblemRow)}
        getRowActions={getRowActions}
        emptyMessage={
          emptyMessage || t('manager.noProblems', 'No problems detected — on track.')
        }
        density="compact"
        canvasClassName="p-0"
        enableColumnSettings={false}
      />
    </div>
  );
}
