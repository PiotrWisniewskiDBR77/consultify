/**
 * AuditCriteriaBrowser — full-screen criteria browser, drill-down from
 * `AuditProcessesTab`'s selected-session preview (gap pack 2026-08-26,
 * item 2/audits fixes).
 *
 * Before this: the ONLY entry point into the per-criterion workshop was an
 * `max-h-52` (208px) mock list inside the 380px preview pane, `text-xs
 * truncate`, no search, no status filter, no pagination — unusable once a
 * real audit has 100-300 criteria (the realistic figure for a full audit
 * program). This replaces the Processes tab's programs table+preview with a
 * `StandardTable` over the SAME already-loaded `listProgramCriteria` data
 * (no new API call) when a session's "Zobacz wszystkie kryteria" action is
 * used — client-side text search + a `workStatus` column filter (native
 * `StandardTable` `filterable`/`filterOptions`, not a bespoke widget) + a
 * simple client-side pager (StandardTable itself has no pagination/
 * virtualization primitive — every other large StandardTable consumer in
 * this codebase pre-slices `data` the same way).
 *
 * Canon: StandardTable only (CLAUDE.md #9 — no bespoke table). Not a new
 * Menu 2 tab — the parallel worker on codex/audits-gaps-20260826 owns the
 * "Ustalenia" tab addition; this is a drill-down WITHIN the existing
 * Processes/Sessions tab, per the coordination note in the task brief.
 *
 * Behind `ff_auditsScaleAndPolish` (default OFF) — gated by the caller
 * (`AuditProcessesTab`), not duplicated here.
 *
 * R2(b) (panel powtórny DEC-117): the `workStatus` column's `filterable`
 * chip was passed straight through to `StandardTable`, which is
 * UNCONTROLLED by default — its filter (and, were a column `sortable`, its
 * sort too) operates on whatever `data` it is handed, and `data` here was
 * `paged` (the ALREADY-SLICED 25-row page). Picking a status filtered only
 * the 25 rows on screen, not the criteria that scrolled past on earlier
 * pages — so e.g. filtering "Zakończone wnioskiem" on page 1 of a 300-row
 * program silently hid every concluded criterion sitting on pages 2-12.
 * Fixed by lifting `activeFilters` to CONTROLLED state here (`StandardTable`
 * accepts `activeFilters`/`onFilterChange` for exactly this) and applying
 * the same column-filter semantics `FilterableTable` itself uses (OR within
 * a column, AND across columns — see `applyColumnFilters` below, a 1:1
 * mirror of `FilterableTable.tsx`'s `filteredData` memo) to the FULL
 * search-matched set BEFORE pagination — `paged` now slices the filtered
 * result, not the other way around. No column here is `sortable`, so there
 * is no equivalent sort-scope bug to fix in this file.
 */
import { ArrowLeft, ListChecks, Search } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { type StandardRowMenu, StandardTable, type TableColumn, type TableRow } from '@/components/standard';
import type { FilterChip } from '@/components/shared/ModuleHub/ActiveFilters';
import { StatusChip } from '@/components/ui/primitives/chips';

import { criterionWorkStatusLabel, criterionWorkStatusTone } from '../auditStatusTones';
import type { AuditCriterionSummary } from '../auditsMethodApi';

/**
 * Mirrors `FilterableTable.tsx`'s `filteredData` memo exactly (same grouping
 * — OR within a column's selected values, AND across columns — same
 * array-valued-column handling), so lifting the filter here changes WHERE
 * it runs, never WHAT it matches.
 */
function applyColumnFilters<T extends Record<string, unknown>>(rows: T[], activeFilters: FilterChip[]): T[] {
  if (activeFilters.length === 0) return rows;
  const byColumn = new Map<string, string[]>();
  for (const f of activeFilters) {
    const values = byColumn.get(f.column) ?? [];
    values.push(f.value);
    byColumn.set(f.column, values);
  }
  return rows.filter((row) =>
    Array.from(byColumn.entries()).every(([column, values]) => {
      const rowValue = row[column];
      if (Array.isArray(rowValue)) return rowValue.some((entry) => values.includes(String(entry)));
      return values.includes(rowValue as string);
    })
  );
}

const PAGE_SIZE = 25;

const CRITERION_WORK_STATUS_ORDER = ['open', 'evidence_requested', 'evidence_received', 'tested', 'concluded'];

export interface AuditCriteriaBrowserProps {
  programId: string;
  programName: string;
  criteria: AuditCriterionSummary[];
  loading: boolean;
  error: string | null;
  isPolish: boolean;
  onBack: () => void;
}

export const AuditCriteriaBrowser: React.FC<AuditCriteriaBrowserProps> = ({
  programId,
  programName,
  criteria,
  loading,
  error,
  isPolish,
  onBack,
}) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  /** R2(b): controlled column filters — lifted here so they apply BEFORE pagination, not after. */
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return criteria;
    return criteria.filter(
      (c) => c.title.toLowerCase().includes(q) || (c.refCode ?? '').toLowerCase().includes(q)
    );
  }, [criteria, search]);

  // Filter the FULL search-matched set — `paged` below slices the result of
  // this, never the other way around (R2(b) fix).
  const filtered = useMemo(
    () => applyColumnFilters(searched as unknown as Array<Record<string, unknown>>, activeFilters) as unknown as AuditCriterionSummary[],
    [searched, activeFilters]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage]
  );

  const openCriterion = (row: AuditCriterionSummary) => {
    navigate(`/audit-programs/${programId}/criteria/${row.id}`);
  };

  const columns: TableColumn[] = [
    {
      id: 'refCode',
      label: isPolish ? 'Nr ref.' : 'Ref.',
      width: '110px',
      render: (row: AuditCriterionSummary) => (
        <span className="text-xs font-medium text-c-text-muted tabular-nums">{row.refCode || '—'}</span>
      ),
    },
    {
      id: 'title',
      label: isPolish ? 'Kryterium' : 'Criterion',
      render: (row: AuditCriterionSummary) => (
        <span className="text-sm font-medium text-c-text">{row.title}</span>
      ),
    },
    {
      id: 'workStatus',
      label: 'Status',
      width: '170px',
      filterable: true,
      filterOptions: CRITERION_WORK_STATUS_ORDER.map((value) => ({
        value,
        label: criterionWorkStatusLabel(value, isPolish),
      })),
      render: (row: AuditCriterionSummary) => (
        <StatusChip
          label={criterionWorkStatusLabel(row.workStatus, isPolish)}
          tone={criterionWorkStatusTone(row.workStatus)}
        />
      ),
    },
    {
      id: 'applicable',
      label: isPolish ? 'Dotyczy' : 'Applicable',
      width: '90px',
      render: (row: AuditCriterionSummary) => (
        <span className="text-xs text-c-text-secondary">
          {row.applicable ? (isPolish ? 'Tak' : 'Yes') : (isPolish ? 'Nie' : 'No')}
        </span>
      ),
    },
    {
      id: 'evidence',
      label: isPolish ? 'Dowody' : 'Evidence',
      width: '90px',
      align: 'right',
      render: (row: AuditCriterionSummary) => (
        <span className="text-xs text-c-text-secondary tabular-nums">{row.evidenceCount}</span>
      ),
    },
    {
      id: 'findings',
      label: isPolish ? 'Ustalenia' : 'Findings',
      width: '90px',
      align: 'right',
      render: (row: AuditCriterionSummary) => (
        <span className="text-xs text-c-text-secondary tabular-nums">{row.findingCount}</span>
      ),
    },
  ];

  const rowMenu = (rawRow: TableRow): StandardRowMenu => {
    const row = criteria.find((c) => c.id === rawRow.id);
    return {
      universalHandlers: {
        preview: () => row && openCriterion(row),
      },
    };
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-c-border-subtle px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            data-testid="criteria-browser-back"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-c-border-subtle bg-c-surface px-3 text-xs font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <ArrowLeft size={12} />
            {isPolish ? 'Powrót do sesji' : 'Back to sessions'}
          </button>
          <span className="min-w-0 truncate text-sm font-semibold text-c-text">{programName}</span>
          <span className="shrink-0 text-xs text-c-text-muted">
            · {filtered.length} {isPolish ? 'kryteriów' : 'criteria'}
          </span>
        </div>
        <label className="relative flex h-9 w-64 shrink-0 items-center">
          <Search size={14} className="pointer-events-none absolute left-2.5 text-c-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={isPolish ? 'Szukaj po tytule lub ref.' : 'Search title or ref.'}
            data-testid="criteria-browser-search"
            className="h-9 w-full rounded-lg border border-c-border-subtle bg-c-surface pl-8 pr-3 text-sm text-c-text-primary focus:outline-none focus:ring-2 focus:ring-c-focus"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <StandardTable
          columns={columns}
          data={paged}
          loading={loading}
          error={error}
          rowMenu={rowMenu}
          activeFilters={activeFilters}
          onFilterChange={(next) => {
            setActiveFilters(next);
            setPage(1);
          }}
          onRowClick={(row) => {
            const match = criteria.find((c) => c.id === row.id);
            if (match) openCriterion(match);
          }}
          persistKey="audits.method.criteriaBrowser"
          empty={{
            icon: ListChecks,
            title: isPolish ? 'Brak kryteriów' : 'No criteria',
            description: isPolish
              ? search || activeFilters.length > 0
                ? 'Żadne kryterium nie pasuje do wyszukiwania/filtra.'
                : 'Ten program nie ma jeszcze kryteriów.'
              : search || activeFilters.length > 0
                ? 'No criterion matches this search/filter.'
                : 'This program has no criteria yet.',
          }}
        />
      </div>
      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2 border-t border-c-border-subtle px-4 py-2.5">
          <span className="text-xs text-c-text-muted">
            {isPolish ? 'Strona' : 'Page'} {safePage} {isPolish ? 'z' : 'of'} {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              data-testid="criteria-browser-prev-page"
              className="inline-flex h-8 items-center rounded-full border border-c-border-subtle bg-c-surface px-3 text-xs font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {isPolish ? 'Poprzednia' : 'Previous'}
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              data-testid="criteria-browser-next-page"
              className="inline-flex h-8 items-center rounded-full border border-c-border-subtle bg-c-surface px-3 text-xs font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {isPolish ? 'Następna' : 'Next'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AuditCriteriaBrowser;
