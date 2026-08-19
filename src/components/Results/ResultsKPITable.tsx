import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Link2,
  Maximize2,
  MoreVertical,
  Pencil,
  Plus,
  Target,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FilterableTable, type FilterChip, type TableColumn } from '../shared/ModuleHub';
import type { RowAction } from '../shared/RowActionsMenu';
import type { KPIStatus, KPITrend, ResultsKPI } from './kpiDomain';

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<KPIStatus, { bg: string; text: string; dot: string }> = {
  'on-target': { bg: 'bg-emerald-500/10', text: 'text-c-success', dot: 'bg-c-success' },
  below: { bg: 'bg-danger-500/10', text: 'text-c-danger', dot: 'bg-c-danger' },
  'no-data': { bg: 'bg-c-surface-raised', text: 'text-c-text-secondary', dot: 'bg-c-text-muted' },
};

const STATUS_LABELS: Record<KPIStatus, string> = {
  'on-target': 'On Target',
  below: 'Below Target',
  'no-data': 'No Data',
};

const StatusBadge: React.FC<{ status: KPIStatus }> = ({ status }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES['no-data'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${s.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      <span className={`text-xs font-medium ${s.text}`}>{STATUS_LABELS[status]}</span>
    </span>
  );
};

const NeedsEntryBadge: React.FC = () => {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/10 text-c-warning">
      <span className="text-xs font-medium">Needs entry</span>
    </span>
  );
};

// ---------------------------------------------------------------------------
// Trend Arrow
// ---------------------------------------------------------------------------

const TREND_ICON: Record<KPITrend, { Icon: typeof ArrowUp; color: string }> = {
  up: { Icon: ArrowUp, color: 'text-c-success' },
  down: { Icon: ArrowDown, color: 'text-c-danger' },
  stable: { Icon: ArrowRight, color: 'text-c-text-secondary' },
};

const TrendArrow: React.FC<{ trend: KPITrend }> = ({ trend }) => {
  const { Icon, color } = TREND_ICON[trend] || TREND_ICON.stable;
  return <Icon size={14} className={color} />;
};

// ---------------------------------------------------------------------------
// Frequency badge
// ---------------------------------------------------------------------------

const FrequencyBadge: React.FC<{ freq: string }> = ({ freq }) => {
  const label = freq?.charAt(0) + freq?.slice(1).toLowerCase();
  return (
    <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-c-surface-raised text-c-text-secondary">
      {label}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Value cell
// ---------------------------------------------------------------------------

const ValueCell: React.FC<{
  value?: number | null;
  unit?: string;
  colored?: boolean;
  status?: KPIStatus;
}> = ({ value, unit, colored, status }) => {
  if (value == null) return <span className="text-sm text-c-text-muted">—</span>;
  const color = colored
    ? status === 'on-target'
      ? 'text-c-success'
      : status === 'below'
        ? 'text-c-danger'
        : 'text-c-text-secondary'
    : 'text-c-text-secondary';
  return (
    <span className={`text-sm font-medium ${color}`}>
      {value.toLocaleString()}
      {unit && <span className="ml-0.5 text-xs text-c-text-muted">{unit}</span>}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Relative time
// ---------------------------------------------------------------------------

function formatRelativeTime(date: string | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Owner cell (avatar initials + name)
// ---------------------------------------------------------------------------

const OwnerCell: React.FC<{ name?: string }> = ({ name }) => {
  if (!name) return <span className="text-sm text-c-text-muted">—</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded-full bg-c-surface-raised text-c-text-secondary flex items-center justify-center text-[10px] font-bold">
        {name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .slice(0, 2)}
      </div>
      <span className="text-sm text-c-text-secondary truncate max-w-[80px]">{name}</span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ResultsKPITable — canon §27: shared FilterableTable, no hand-rolled <table>.
// ---------------------------------------------------------------------------

interface ResultsKPITableProps {
  kpis: ResultsKPI[];
  activeFilters: FilterChip[];
  onFilterChange: (filters: FilterChip[]) => void;
  onRowClick?: (kpi: ResultsKPI) => void;
  onRowAction?: (action: string, kpi: ResultsKPI) => void;
}

// ---------------------------------------------------------------------------
// Sort (managed in-component) — canon §27 FilterableTable has no row-sort, so we
// sort the `data` array here BEFORE handing it to FilterableTable (which renders
// rows in the given order). The shared component is left untouched.
//
// Each sortable column maps to a key on the flattened TableRow. The numeric
// value columns live under underscore-prefixed keys (render-only payload), so
// the sort accessors target those.
// ---------------------------------------------------------------------------

type SortDir = 'asc' | 'desc';

interface SortableCol {
  id: string;
  labelKey: string;
  labelDefault: string;
  accessor: (row: any) => string | number | null | undefined;
  numeric?: boolean;
}

const SORTABLE_COLS: SortableCol[] = [
  { id: 'name', labelKey: 'results.columns.name', labelDefault: 'Name', accessor: (r) => r.name },
  {
    id: 'initiative',
    labelKey: 'results.columns.initiative',
    labelDefault: 'Initiative',
    accessor: (r) => r.initiative,
  },
  {
    id: 'baseline',
    labelKey: 'results.columns.baseline',
    labelDefault: 'Baseline',
    accessor: (r) => r._baseline,
    numeric: true,
  },
  {
    id: 'target',
    labelKey: 'results.columns.target',
    labelDefault: 'Target',
    accessor: (r) => r._target,
    numeric: true,
  },
  {
    id: 'current',
    labelKey: 'results.columns.current',
    labelDefault: 'Current',
    accessor: (r) => r._current,
    numeric: true,
  },
  {
    id: 'lastUpdated',
    labelKey: 'results.columns.lastUpdated',
    labelDefault: 'Updated',
    accessor: (r) => r.lastUpdated,
  },
];

// Initiative display label (primary name or "first +N" for multi-linked KPIs).
function initiativeLabel(kpi: ResultsKPI): string | null {
  return (
    kpi.initiativeName ||
    (kpi.linkedInitiativesCount && kpi.linkedInitiatives?.length
      ? kpi.linkedInitiativesCount === 1
        ? kpi.linkedInitiatives[0]?.name || null
        : `${kpi.linkedInitiatives[0]?.name} +${kpi.linkedInitiativesCount - 1}`
      : null)
  );
}

export const ResultsKPITable: React.FC<ResultsKPITableProps> = ({
  kpis,
  activeFilters,
  onFilterChange,
  onRowClick,
  onRowAction,
}) => {
  const { t } = useTranslation();

  // Index KPIs by id so row callbacks (click / actions) can recover the full
  // domain object from the canonical TableRow (which is a flattened projection).
  const byId = useMemo(() => new Map(kpis.map((k) => [k.id, k])), [kpis]);

  // In-component sort state (FilterableTable does not implement row-sort).
  // null = original order (matches the pre-conversion default).
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = useCallback((colId: string) => {
    setSortCol((prev) => {
      if (prev === colId) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      return colId;
    });
  }, []);

  // Canon §27 — column contract. Filterable columns carry `filterable` +
  // `filterOptions`; FilterableTable owns the dropdown UI and the filtering
  // (exact match on `row[column.id]`), replacing the hand-rolled dropdown.
  const columns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'name',
        label: t('results.columns.name', 'Name'),
        render: (row: any) => {
          const kpi = byId.get(row.id);
          return (
            <div className="min-w-0">
              <span className="text-sm font-medium text-c-text block truncate">{row.name}</span>
              {kpi?.description && (
                <p className="text-xs text-c-text-muted mt-0.5 line-clamp-1">{kpi.description}</p>
              )}
            </div>
          );
        },
      },
      {
        id: 'initiative',
        label: t('results.columns.initiative', 'Initiative'),
        width: '160px',
        filterable: true,
        filterOptions: [
          ...new Set(
            kpis
              .flatMap((k) => [k.initiativeName, ...(k.linkedInitiatives || []).map((i) => i.name)])
              .filter(Boolean) as string[]
          ),
        ].map((n) => ({ value: n, label: n })),
        render: (row: any) =>
          row.initiative ? (
            <span className="text-sm text-c-info hover:underline">{row.initiative}</span>
          ) : (
            <span className="text-sm text-c-text-muted">—</span>
          ),
      },
      {
        id: 'baseline',
        label: t('results.columns.baseline', 'Baseline'),
        width: '110px',
        align: 'right',
        render: (row: any) => <ValueCell value={row._baseline} unit={row._unit} />,
      },
      {
        id: 'target',
        label: t('results.columns.target', 'Target'),
        width: '110px',
        align: 'right',
        render: (row: any) => <ValueCell value={row._target} unit={row._unit} />,
      },
      {
        id: 'current',
        label: t('results.columns.current', 'Current'),
        width: '110px',
        align: 'right',
        render: (row: any) => (
          <ValueCell value={row._current} unit={row._unit} colored status={row.status} />
        ),
      },
      {
        id: 'status',
        label: t('results.columns.status', 'Status'),
        width: '150px',
        filterable: true,
        filterOptions: [
          { value: 'on-target', label: 'On Target', color: 'bg-c-success' },
          { value: 'below', label: 'Below Target', color: 'bg-c-danger' },
          { value: 'no-data', label: 'No Data', color: 'bg-c-text-muted' },
        ],
        render: (row: any) => (
          <div className="flex flex-col gap-1">
            <StatusBadge status={row.status} />
            {row._needsEntry ? <NeedsEntryBadge /> : null}
          </div>
        ),
      },
      {
        id: 'trend',
        label: t('results.columns.trend', 'Trend'),
        width: '90px',
        render: (row: any) => <TrendArrow trend={row._trend} />,
      },
      {
        id: 'measurementFrequency',
        label: t('results.columns.frequency', 'Frequency'),
        width: '120px',
        filterable: true,
        filterOptions: [
          { value: 'DAILY', label: 'Daily' },
          { value: 'WEEKLY', label: 'Weekly' },
          { value: 'MONTHLY', label: 'Monthly' },
          { value: 'QUARTERLY', label: 'Quarterly' },
        ],
        render: (row: any) => <FrequencyBadge freq={row.measurementFrequency} />,
      },
      {
        id: 'owner',
        label: t('results.columns.owner', 'Owner'),
        width: '140px',
        render: (row: any) => <OwnerCell name={row.owner} />,
      },
      {
        id: 'lastUpdated',
        label: t('results.columns.lastUpdated', 'Updated'),
        width: '110px',
        render: (row: any) => (
          <span className="text-xs text-c-text-muted">{formatRelativeTime(row.lastUpdated)}</span>
        ),
      },
    ],
    [t, kpis, byId]
  );

  // Flatten each KPI into a canonical TableRow. Keys used by column filters
  // (`initiative`, `status`, `measurementFrequency`) hold the raw filterable
  // value; underscore-prefixed keys carry render-only payload.
  const rows = useMemo(
    () =>
      kpis.map((kpi) => ({
        id: kpi.id,
        name: kpi.name,
        initiative: initiativeLabel(kpi) ?? '',
        status: kpi.status,
        measurementFrequency: kpi.measurementFrequency,
        owner: kpi.ownerName ?? '',
        lastUpdated: kpi.latestMeasurementDate || kpi.createdAt,
        _baseline: kpi.baselineValue,
        _target: kpi.targetValue,
        _current: kpi.latestValue,
        _unit: kpi.unit,
        _trend: kpi.trend,
        _needsEntry: kpi.needsEntry,
      })),
    [kpis]
  );

  // Sort the flattened rows in-component BEFORE handing them to FilterableTable
  // (which renders `data` in the given order). null sortCol = original order.
  const sortedRows = useMemo(() => {
    if (!sortCol) return rows;
    const col = SORTABLE_COLS.find((c) => c.id === sortCol);
    if (!col) return rows;
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = col.accessor(a);
      const vb = col.accessor(b);
      // Nulls sort last regardless of direction.
      const aNull = va == null || va === '';
      const bNull = vb == null || vb === '';
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      let cmp: number;
      if (col.numeric) {
        cmp = Number(va) - Number(vb);
      } else {
        cmp = String(va).localeCompare(String(vb));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortCol, sortDir]);

  const activeSortLabel = useMemo(() => {
    const col = SORTABLE_COLS.find((c) => c.id === sortCol);
    return col ? t(col.labelKey, col.labelDefault) : null;
  }, [sortCol, t]);

  // Canon §27 — row actions live in the shared kebab menu (no hand-rolled menu).
  const buildRowActions = useMemo(
    () =>
      (row: any): RowAction[] => {
        const kpi = byId.get(row.id);
        if (!kpi) return [];
        return [
          {
            id: 'open',
            label: t('results.actions.openDetail', 'Open detail'),
            icon: Maximize2,
            variant: 'primary',
            onClick: () => onRowAction?.('open', kpi),
          },
          {
            id: 'record',
            label: t('results.actions.recordValue', 'Record value'),
            icon: Target,
            onClick: () => onRowAction?.('record', kpi),
          },
          {
            id: 'edit',
            label: t('results.drawer.definitionTitle', 'Definition'),
            icon: Pencil,
            onClick: () => onRowAction?.('edit', kpi),
          },
          {
            id: 'links',
            label: t('results.drawer.lineageTitle', 'Lineage'),
            icon: Link2,
            onClick: () => onRowAction?.('links', kpi),
          },
          {
            id: 'manage-canonical',
            label: t('results.actions.manageInRegistry', 'Manage in KPI registry'),
            icon: Target,
            divider: true,
            variant: 'default',
            onClick: () => onRowAction?.('manage-canonical', kpi),
          },
        ];
      },
    [byId, t, onRowAction]
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Sort control — FilterableTable headers don't trigger row-sort, so sort
          is exposed here as a compact segmented control above the table. */}
      <div
        className="flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label={t('results.sort.label', 'Sort by')}
      >
        <span className="inline-flex items-center gap-1 pr-1 text-xs font-medium text-c-text-muted">
          <ArrowUpDown size={13} aria-hidden="true" />
          {t('results.sort.label', 'Sort by')}
        </span>
        {SORTABLE_COLS.map((col) => {
          const active = sortCol === col.id;
          return (
            <button
              key={col.id}
              type="button"
              onClick={() => handleSort(col.id)}
              aria-pressed={active}
              aria-label={
                active
                  ? t('results.sort.activeAria', {
                      defaultValue: 'Sorted by {{col}} {{dir}}',
                      col: t(col.labelKey, col.labelDefault),
                      dir:
                        sortDir === 'asc'
                          ? t('results.sort.asc', 'ascending')
                          : t('results.sort.desc', 'descending'),
                    })
                  : t('results.sort.byAria', {
                      defaultValue: 'Sort by {{col}}',
                      col: t(col.labelKey, col.labelDefault),
                    })
              }
              className={[
                'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus',
                active
                  ? 'bg-c-surface-raised text-c-text border border-c-border-strong'
                  : 'text-c-text-secondary border border-c-border hover:bg-c-surface-raised',
              ].join(' ')}
            >
              {t(col.labelKey, col.labelDefault)}
              {active &&
                (sortDir === 'asc' ? (
                  <ArrowUp size={12} aria-hidden="true" />
                ) : (
                  <ArrowDown size={12} aria-hidden="true" />
                ))}
            </button>
          );
        })}
        {sortCol && (
          <button
            type="button"
            onClick={() => setSortCol(null)}
            className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium text-c-text-muted hover:text-c-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            aria-label={t('results.sort.clear', 'Clear sort')}
          >
            {t('results.sort.clear', 'Clear sort')}
          </button>
        )}
        {activeSortLabel && (
          <span className="sr-only" aria-live="polite">
            {t('results.sort.activeAria', {
              defaultValue: 'Sorted by {{col}} {{dir}}',
              col: activeSortLabel,
              dir:
                sortDir === 'asc'
                  ? t('results.sort.asc', 'ascending')
                  : t('results.sort.desc', 'descending'),
            })}
          </span>
        )}
      </div>

      <FilterableTable
        columns={columns}
        data={sortedRows}
        activeFilters={activeFilters}
        onFilterChange={onFilterChange}
        onRowClick={(row) => {
          const kpi = byId.get(row.id);
          if (kpi) onRowClick?.(kpi);
        }}
        onRowDoubleClick={(row) => {
          const kpi = byId.get(row.id);
          if (kpi) onRowAction?.('open', kpi);
        }}
        getRowActions={onRowAction ? buildRowActions : undefined}
        hideRowActions={!onRowAction}
        emptyMessage={t('results.emptyState', 'No KPIs found')}
        density="compact"
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Grid View for Results KPIs
// ---------------------------------------------------------------------------

interface ResultsGridViewProps {
  kpis: ResultsKPI[];
  onItemClick?: (kpi: ResultsKPI) => void;
  onItemAction?: (action: string, kpi: ResultsKPI) => void;
  onNewItem?: () => void;
}

export const ResultsGridView: React.FC<ResultsGridViewProps> = ({
  kpis,
  onItemClick,
  onItemAction,
  onNewItem,
}) => {
  const { t } = useTranslation();
  const [menuCardId, setMenuCardId] = useState<string | null>(null);

  if (kpis.length === 0 && !onNewItem) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-c-text-muted gap-2">
        <Target size={32} className="text-c-text-secondary" />
        <span>{t('results.emptyState', 'No KPIs found')}</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
      {kpis.map((kpi) => {
        const s = STATUS_STYLES[kpi.status] || STATUS_STYLES['no-data'];
        const { Icon: TIcon, color: tColor } = TREND_ICON[kpi.trend] || TREND_ICON.stable;
        const statusAccent =
          kpi.status === 'on-target'
            ? 'border-l-c-success'
            : kpi.status === 'below'
              ? 'border-l-c-danger'
              : 'border-l-c-border-strong';

        return (
          <div
            key={kpi.id}
            onClick={() => onItemClick?.(kpi)}
            onDoubleClick={() => onItemAction?.('open', kpi)}
            className={[
              'group relative cursor-pointer rounded-xl overflow-hidden',
              'border-l-[3px] border border-c-border-subtle',
              statusAccent,
              'bg-c-surface',
              'hover:bg-c-surface-raised hover:shadow-sm transition-all duration-150',
            ].join(' ')}
          >
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <StatusBadge status={kpi.status} />
                <div className="flex items-center gap-2">
                  <TIcon size={16} className={tColor} />
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuCardId((prev) => (prev === kpi.id ? null : kpi.id));
                      }}
                      className="p-1.5 rounded hover:bg-c-surface-raised text-c-text-muted hover:text-c-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                      aria-label={t('common.more', 'More')}
                    >
                      <MoreVertical size={14} />
                    </button>
                    {menuCardId === kpi.id && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuCardId(null);
                          }}
                        />
                        <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-c-surface-raised border border-c-border rounded-lg shadow-xl overflow-hidden">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onItemAction?.('open', kpi);
                              setMenuCardId(null);
                            }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-c-text-secondary hover:bg-black/5 dark:hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                          >
                            <Maximize2 size={14} />
                            {t('results.actions.openDetail', 'Open detail')}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onItemAction?.('record', kpi);
                              setMenuCardId(null);
                            }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-c-text-secondary hover:bg-black/5 dark:hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                          >
                            <Target size={14} />
                            {t('results.actions.recordValue', 'Record value')}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onItemAction?.('edit', kpi);
                              setMenuCardId(null);
                            }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-c-text-secondary hover:bg-black/5 dark:hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                          >
                            <Pencil size={14} />
                            {t('results.drawer.definitionTitle', 'Definition')}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onItemAction?.('links', kpi);
                              setMenuCardId(null);
                            }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-c-text-secondary hover:bg-black/5 dark:hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                          >
                            <Link2 size={14} />
                            {t('results.drawer.lineageTitle', 'Lineage')}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onItemAction?.('manage-canonical', kpi);
                              setMenuCardId(null);
                            }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-c-text-secondary hover:bg-black/5 dark:hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                          >
                            <Target size={14} />
                            {t('results.actions.manageInRegistry', 'Manage in KPI registry')}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <h3 className="text-sm font-medium text-c-text line-clamp-2 mb-1">{kpi.name}</h3>
              {kpi.initiativeName && (
                <p className="text-xs text-c-info mb-3 truncate">{kpi.initiativeName}</p>
              )}
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-c-border-subtle">
                <div>
                  <p className="text-[10px] uppercase text-c-text-muted mb-0.5">
                    {t('results.columns.baseline', 'Baseline')}
                  </p>
                  <p className="text-xs font-medium text-c-text-secondary">
                    {kpi.baselineValue != null ? kpi.baselineValue.toLocaleString() : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-c-text-muted mb-0.5">
                    {t('results.columns.target', 'Target')}
                  </p>
                  <p className="text-xs font-medium text-c-text-secondary">
                    {kpi.targetValue != null ? kpi.targetValue.toLocaleString() : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-c-text-muted mb-0.5">
                    {t('results.columns.current', 'Current')}
                  </p>
                  <p
                    className={`text-xs font-medium ${
                      kpi.status === 'on-target'
                        ? 'text-c-success'
                        : kpi.status === 'below'
                          ? 'text-c-danger'
                          : 'text-c-text-secondary'
                    }`}
                  >
                    {kpi.latestValue != null ? kpi.latestValue.toLocaleString() : '—'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-c-border-subtle bg-black/[0.02] dark:bg-white/[0.02]">
              <FrequencyBadge freq={kpi.measurementFrequency} />
              <span className="text-xs text-c-text-muted">
                {formatRelativeTime(kpi.latestMeasurementDate || kpi.createdAt)}
              </span>
            </div>
          </div>
        );
      })}

      {onNewItem && (
        <button
          onClick={onNewItem}
          className="flex flex-col items-center justify-center gap-2 min-h-[180px] rounded-xl border-2 border-dashed border-c-border text-c-text-muted hover:text-c-text hover:border-c-border-strong transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <Plus size={24} />
          <span className="text-sm font-medium">{t('results.addKpi', '+ Add KPI')}</span>
        </button>
      )}
    </div>
  );
};

export default ResultsKPITable;
