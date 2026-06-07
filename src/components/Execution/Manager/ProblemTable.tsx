/**
 * ProblemTable — standard table of problems for Manager module lanes.
 *
 * Follows TABLE_AND_PREVIEW_CANON.md: full-width monochrome rows (severity lives
 * in a leading signal dot + severity chip, NOT the row background/border),
 * portal kebab actions, click-to-preview, double-click-to-open.
 */

import { AlertTriangle, ChevronRight, Search, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type RowActionSection, RowActionsMenu } from '@/components/shared/RowActionsMenu';
import { EmptyState } from '@/components/ui/composed/EmptyState';
import { EntityStatusChip, LoadingState } from '@/components/ui/primitives';

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
    critical_risk: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
    high_risk: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    overdue_task: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
    blocked_task: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
    blocked_initiative: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
    overdue_decision: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    pending_decision: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    unassigned_task: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400',
    no_owner: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400',
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
 * Build the kebab sections (§17): triage actions on top (context), then the
 * canonical fixed manifest with "Otwórz podgląd". `danger`-variant triage
 * actions land in their own danger section.
 */
function buildSections(
  row: ManagerProblemRow,
  t: TFn,
  onSelect: (row: ManagerProblemRow) => void,
  onAction: (row: ManagerProblemRow, action: ProblemAction) => void
): RowActionSection[] {
  const contextActions = row.actions
    .filter((a) => a.variant !== 'danger')
    .map((a) => ({
      id: a.id,
      label: a.label,
      variant: a.variant,
      onClick: () => onAction(row, a),
    }));

  const dangerActions = row.actions
    .filter((a) => a.variant === 'danger')
    .map((a) => ({
      id: a.id,
      label: a.label,
      variant: 'danger' as const,
      onClick: () => onAction(row, a),
    }));

  return [
    { id: 'context', kind: 'context' as const, actions: contextActions },
    {
      id: 'fixed',
      kind: 'manage' as const,
      actions: [
        {
          id: 'open-preview',
          label: t('common.openPreview', 'Otwórz podgląd'),
          icon: ChevronRight,
          onClick: () => onSelect(row),
        },
      ],
    },
    { id: 'danger', kind: 'danger' as const, actions: dangerActions },
  ];
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<ProblemSeverity | 'all'>('all');

  const filtered = useMemo(() => {
    let result = rows;
    if (severityFilter !== 'all') {
      result = result.filter((r) => r.severity === severityFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.sourceEntityName.toLowerCase().includes(q) ||
          r.rootCause.toLowerCase().includes(q) ||
          (r.ownerName || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [rows, severityFilter, searchQuery]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      critical: rows.filter((r) => r.severity === 'critical').length,
      warning: rows.filter((r) => r.severity === 'warning').length,
      info: rows.filter((r) => r.severity === 'info').length,
    }),
    [rows]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!selectedId || filtered.length === 0) return;
      const idx = filtered.findIndex((r) => r.id === selectedId);
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = filtered[Math.min(idx + 1, filtered.length - 1)];
        if (next) onSelect(next);
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = filtered[Math.max(idx - 1, 0)];
        if (prev) onSelect(prev);
      }
      if (e.key === 'Enter' && onDoubleClick) {
        const current = filtered[idx];
        if (current) onDoubleClick(current);
      }
    },
    [selectedId, filtered, onSelect, onDoubleClick]
  );

  return (
    <div className="flex flex-col h-full" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Topbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
        {/* Severity tabs */}
        {(['all', 'critical', 'warning', 'info'] as const).map((sev) => {
          const active = severityFilter === sev;
          const count = counts[sev];
          return (
            <button
              key={sev}
              type="button"
              onClick={() => setSeverityFilter(sev)}
              className={`h-9 px-3 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                active
                  ? 'bg-slate-100 dark:bg-navy-800 text-slate-900 dark:text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800/50'
              }`}
            >
              {sev !== 'all' && <span className={`w-2 h-2 rounded-full ${SEVERITY_DOT[sev]}`} />}
              <span>
                {sev === 'all'
                  ? t('common.all', 'All')
                  : t(`manager.severity.${sev}`, severityLabel(sev))}
              </span>
              <span className="text-[10px] tabular-nums opacity-60">{count}</span>
            </button>
          );
        })}

        <div className="flex-1" />

        {/* Search toggle */}
        {searchOpen ? (
          <div className="flex items-center gap-1 h-9 px-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800">
            <Search size={14} className="text-slate-600 shrink-0" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('common.search', 'Search...')}
              className="w-40 text-xs bg-transparent outline-none text-slate-900 dark:text-white placeholder-slate-400"
            />
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSearchOpen(false);
              }}
            >
              <X size={14} className="text-slate-600 hover:text-slate-600" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800"
          >
            <Search size={14} className="text-slate-600" />
          </button>
        )}
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[auto_2fr_1fr_1fr_80px_80px_1fr_40px] gap-0 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
        <div className="px-2">{t('manager.col.severity', 'Severity')}</div>
        <div className="px-2">{t('manager.col.problem', 'Problem')}</div>
        <div className="px-2">{t('manager.col.type', 'Type')}</div>
        <div className="px-2">{t('manager.col.source', 'Source')}</div>
        <div className="px-2">{t('manager.col.overdue', 'Overdue')}</div>
        <div className="px-2">{t('manager.col.impact', 'Impact')}</div>
        <div className="px-2">{t('manager.col.owner', 'Owner')}</div>
        <div />
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {loading && <LoadingState variant="spinner" />}

        {!loading && filtered.length === 0 && (
          <EmptyState
            compact
            icon={<AlertTriangle />}
            title={emptyMessage || t('manager.noProblems', 'No problems detected — on track.')}
            description=""
          />
        )}

        {!loading &&
          filtered.map((row) => {
            const isSelected = row.id === selectedId;
            return (
              <div
                key={row.id}
                role="row"
                tabIndex={-1}
                onClick={() => onSelect(row)}
                onDoubleClick={() => onDoubleClick?.(row)}
                className={`group grid grid-cols-[auto_2fr_1fr_1fr_80px_80px_1fr_40px] gap-0 px-4 items-center cursor-pointer border-b border-slate-200 dark:border-navy-800 transition-colors ${
                  isSelected
                    ? 'bg-primary-500/8 dark:bg-primary-500/10 shadow-[inset_4px_0_0_0_var(--c-accent,theme(colors.primary.500))]'
                    : 'bg-white dark:bg-navy-900 hover:bg-slate-50/70 dark:hover:bg-white/[0.03]'
                }`}
                style={{ minHeight: '44px' }}
              >
                {/* Severity — signal dot + canonical tone chip (§3.5/§4.1) */}
                <div className="px-2 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${SEVERITY_DOT[row.severity]}`} />
                  <EntityStatusChip
                    status={SEVERITY_STATUS[row.severity]}
                    label={t(`manager.severity.${row.severity}`, severityLabel(row.severity))}
                  />
                </div>

                {/* Problem title */}
                <div className="px-2 py-2 min-w-0">
                  <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                    {row.title}
                  </p>
                  <p className="text-[10px] text-slate-600 dark:text-slate-500 truncate mt-0.5">
                    {row.rootCause}
                  </p>
                </div>

                {/* Type */}
                <div className="px-2">
                  <TypeBadge type={row.problemType} />
                </div>

                {/* Source entity */}
                <div className="px-2">
                  <SourceChip type={row.sourceEntityType} name={row.sourceEntityName} />
                </div>

                {/* Days overdue */}
                <div className="px-2">
                  {row.daysOverdue !== null && row.daysOverdue > 0 ? (
                    <span className="text-xs tabular-nums font-medium text-rose-600 dark:text-rose-400">
                      {row.daysOverdue}d
                    </span>
                  ) : row.daysOverdue !== null && row.daysOverdue < 0 ? (
                    <span className="text-xs tabular-nums text-slate-600">
                      {t('manager.dueIn', 'in')} {Math.abs(row.daysOverdue)}d
                    </span>
                  ) : (
                    <span className="text-xs text-slate-600 dark:text-slate-400">—</span>
                  )}
                </div>

                {/* Impact count */}
                <div className="px-2">
                  {row.impactCount > 0 ? (
                    <span className="text-xs tabular-nums text-amber-600 dark:text-amber-400">
                      {row.impactCount} ↓
                    </span>
                  ) : (
                    <span className="text-xs text-slate-600 dark:text-slate-400">—</span>
                  )}
                </div>

                {/* Owner */}
                <div className="px-2">
                  <span className="text-xs text-slate-600 dark:text-slate-400 truncate block">
                    {row.ownerName || '—'}
                  </span>
                </div>

                {/* Actions kebab — portal-based RowActionsMenu (§17) */}
                <div
                  className="flex items-center justify-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <RowActionsMenu
                    iconVariant="vertical"
                    className="opacity-40 transition-opacity group-hover:opacity-100"
                    sections={buildSections(row, t, onSelect, onAction)}
                  />
                </div>
              </div>
            );
          })}
      </div>

      {/* Footer counter */}
      <div className="flex items-center justify-between px-3 py-1.5 text-[10px] text-slate-600 dark:text-slate-500 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
        <span>
          {filtered.length} / {rows.length} {t('manager.problems', 'problems')}
        </span>
        <span className="tabular-nums">
          {counts.critical} {t('manager.severity.critical', 'Critical')} · {counts.warning}{' '}
          {t('manager.severity.warning', 'Warning')} · {counts.info}{' '}
          {t('manager.severity.info', 'Info')}
        </span>
      </div>
    </div>
  );
}
