import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Edit,
  Link2,
  Maximize2,
  MoreVertical,
  Plus,
  Target,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import type { KPIStatus, KPITrend, ResultsKPI } from './ResultsHub';

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<KPIStatus, { bg: string; text: string; dot: string }> = {
  'on-target': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  below: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-500' },
  'no-data': { bg: 'bg-slate-500/10', text: 'text-slate-400', dot: 'bg-slate-400' },
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

// ---------------------------------------------------------------------------
// Trend Arrow
// ---------------------------------------------------------------------------

const TREND_ICON: Record<KPITrend, { Icon: typeof ArrowUp; color: string }> = {
  up: { Icon: ArrowUp, color: 'text-emerald-400' },
  down: { Icon: ArrowDown, color: 'text-red-400' },
  stable: { Icon: ArrowRight, color: 'text-slate-400' },
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
    <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-slate-500/10 text-slate-400">
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
  if (value == null) return <span className="text-sm text-slate-500">—</span>;
  const color = colored
    ? status === 'on-target'
      ? 'text-emerald-400'
      : status === 'below'
        ? 'text-red-400'
        : 'text-slate-300'
    : 'text-slate-300';
  return (
    <span className={`text-sm font-medium ${color}`}>
      {value.toLocaleString()}
      {unit && <span className="ml-0.5 text-xs text-slate-500">{unit}</span>}
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
// Column filter dropdown (reused pattern from FilterableTable)
// ---------------------------------------------------------------------------

interface FilterOption {
  value: string;
  label: string;
  color?: string;
}

const ColumnFilterDropdown: React.FC<{
  options: FilterOption[];
  activeValues: string[];
  onApply: (values: string[]) => void;
}> = ({ options, activeValues, onApply }) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(activeValues);

  const toggle = (v: string) =>
    setSelected((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-600 transition-colors ${
          activeValues.length > 0 ? 'text-primary-400' : 'text-slate-500'
        }`}
      >
        <ChevronDown size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 min-w-[180px] bg-slate-50 dark:bg-navy-800 border border-slate-300 dark:border-navy-600 rounded-lg shadow-xl overflow-hidden">
            <div className="max-h-[200px] overflow-y-auto p-2">
              {options.map((o) => (
                <label
                  key={o.value}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(o.value)}
                    onChange={() => toggle(o.value)}
                    className="rounded border-navy-600 bg-slate-200 dark:bg-navy-700 text-primary-500 focus:ring-primary-500"
                  />
                  {o.color && <span className={`w-2 h-2 rounded-full ${o.color}`} />}
                  <span className="text-sm text-slate-700 dark:text-slate-300">{o.label}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between p-2 border-t border-slate-300 dark:border-navy-600">
              <button
                onClick={() => {
                  setSelected([]);
                  onApply([]);
                  setOpen(false);
                }}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Clear
              </button>
              <button
                onClick={() => {
                  onApply(selected);
                  setOpen(false);
                }}
                className="px-3 py-1 text-xs font-medium bg-primary-500 text-white rounded hover:bg-primary-400 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Table columns definition
// ---------------------------------------------------------------------------

interface Column {
  id: string;
  label: string;
  width?: string;
  sortable?: boolean;
  filterOptions?: FilterOption[];
}

// ---------------------------------------------------------------------------
// ResultsKPITable
// ---------------------------------------------------------------------------

interface ResultsKPITableProps {
  kpis: ResultsKPI[];
  activeFilters: FilterChip[];
  onFilterChange: (filters: FilterChip[]) => void;
  onRowClick?: (kpi: ResultsKPI) => void;
  onRowAction?: (action: string, kpi: ResultsKPI) => void;
}

export const ResultsKPITable: React.FC<ResultsKPITableProps> = ({
  kpis,
  activeFilters,
  onFilterChange,
  onRowClick,
  onRowAction,
}) => {
  const { t } = useTranslation();
  const [menuRowId, setMenuRowId] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const columns: Column[] = useMemo(
    () => [
      { id: 'name', label: t('results.columns.name', 'Name'), width: '20%', sortable: true },
      {
        id: 'initiative',
        label: t('results.columns.initiative', 'Initiative'),
        width: '14%',
        sortable: true,
        filterOptions: [
          ...new Set(kpis.filter((k) => k.initiativeName).map((k) => k.initiativeName!)),
        ].map((n) => ({ value: n, label: n })),
      },
      { id: 'baseline', label: t('results.columns.baseline', 'Baseline'), width: '8%' },
      { id: 'target', label: t('results.columns.target', 'Target'), width: '8%' },
      { id: 'current', label: t('results.columns.current', 'Current'), width: '8%' },
      {
        id: 'status',
        label: t('results.columns.status', 'Status'),
        width: '10%',
        filterOptions: [
          { value: 'on-target', label: 'On Target', color: 'bg-emerald-500' },
          { value: 'below', label: 'Below Target', color: 'bg-red-500' },
          { value: 'no-data', label: 'No Data', color: 'bg-slate-400' },
        ],
      },
      { id: 'trend', label: t('results.columns.trend', 'Trend'), width: '6%' },
      {
        id: 'measurementFrequency',
        label: t('results.columns.frequency', 'Frequency'),
        width: '8%',
        filterOptions: [
          { value: 'DAILY', label: 'Daily' },
          { value: 'WEEKLY', label: 'Weekly' },
          { value: 'MONTHLY', label: 'Monthly' },
          { value: 'QUARTERLY', label: 'Quarterly' },
        ],
      },
      { id: 'owner', label: t('results.columns.owner', 'Owner'), width: '10%' },
      {
        id: 'lastUpdated',
        label: t('results.columns.lastUpdated', 'Updated'),
        width: '8%',
        sortable: true,
      },
    ],
    [t, kpis]
  );

  const getFilterValues = useCallback(
    (col: string) => activeFilters.filter((f) => f.column === col).map((f) => f.value),
    [activeFilters]
  );

  const applyColumnFilter = useCallback(
    (col: Column, values: string[]) => {
      const other = activeFilters.filter((f) => f.column !== col.id);
      const added = values.map((v) => ({
        id: `${col.id}-${v}`,
        column: col.id,
        value: v,
        label: col.filterOptions?.find((o) => o.value === v)?.label || v,
        color: col.filterOptions?.find((o) => o.value === v)?.color,
      }));
      onFilterChange([...other, ...added]);
    },
    [activeFilters, onFilterChange]
  );

  const handleSort = useCallback(
    (colId: string) => {
      if (sortCol === colId) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortCol(colId);
        setSortDir('asc');
      }
    },
    [sortCol]
  );

  const sorted = useMemo(() => {
    if (!sortCol) return kpis;
    const arr = [...kpis];
    arr.sort((a, b) => {
      let va: any, vb: any;
      if (sortCol === 'name') {
        va = a.name;
        vb = b.name;
      } else if (sortCol === 'initiative') {
        va = a.initiativeName || '';
        vb = b.initiativeName || '';
      } else if (sortCol === 'lastUpdated') {
        va = a.latestMeasurementDate || a.createdAt;
        vb = b.latestMeasurementDate || b.createdAt;
      } else {
        va = (a as any)[sortCol];
        vb = (b as any)[sortCol];
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [kpis, sortCol, sortDir]);

  return (
    <div className="p-4">
      <div className="bg-white/70 dark:bg-navy-900/70 backdrop-blur border border-slate-200/70 dark:border-white/[0.06] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-white/60 dark:bg-navy-900/60 border-b border-slate-200/70 dark:border-white/[0.06]">
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                    style={{ width: col.width }}
                  >
                    <div className="flex items-center gap-1">
                      {col.sortable ? (
                        <button
                          onClick={() => handleSort(col.id)}
                          className="hover:text-slate-700 dark:hover:text-white transition-colors"
                        >
                          {col.label}
                          {sortCol === col.id && (
                            <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </button>
                      ) : (
                        <span>{col.label}</span>
                      )}
                      {col.filterOptions && (
                        <ColumnFilterDropdown
                          options={col.filterOptions}
                          activeValues={getFilterValues(col.id)}
                          onApply={(vals) => applyColumnFilter(col, vals)}
                        />
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/[0.06]">
              {sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="px-4 py-16 text-center text-slate-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Target size={24} className="text-slate-400" />
                      <span>{t('results.emptyState', 'No KPIs found')}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                sorted.map((kpi) => (
                  <tr
                    key={kpi.id}
                    onClick={() => onRowClick?.(kpi)}
                    onDoubleClick={() => onRowAction?.('open', kpi)}
                    className="group hover:bg-slate-50/70 dark:hover:bg-white/[0.03] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-slate-900 dark:text-white">
                        {kpi.name}
                      </span>
                      {kpi.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {kpi.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {kpi.initiativeName ? (
                        <span className="text-sm text-primary-400 hover:underline">
                          {kpi.initiativeName}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ValueCell value={kpi.baselineValue} unit={kpi.unit} />
                    </td>
                    <td className="px-4 py-3">
                      <ValueCell value={kpi.targetValue} unit={kpi.unit} />
                    </td>
                    <td className="px-4 py-3">
                      <ValueCell
                        value={kpi.latestValue}
                        unit={kpi.unit}
                        colored
                        status={kpi.status}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={kpi.status} />
                    </td>
                    <td className="px-4 py-3">
                      <TrendArrow trend={kpi.trend} />
                    </td>
                    <td className="px-4 py-3">
                      <FrequencyBadge freq={kpi.measurementFrequency} />
                    </td>
                    <td className="px-4 py-3">
                      {kpi.ownerName ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-[10px] font-bold">
                            {kpi.ownerName
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)}
                          </div>
                          <span className="text-sm text-slate-300 truncate max-w-[80px]">
                            {kpi.ownerName}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500">
                        {formatRelativeTime(kpi.latestMeasurementDate || kpi.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuRowId(menuRowId === kpi.id ? null : kpi.id);
                          }}
                          className="p-1.5 rounded hover:bg-navy-700 text-slate-500 dark:text-slate-400 hover:text-white transition-colors"
                        >
                          <MoreVertical size={14} />
                        </button>
                        {menuRowId === kpi.id && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setMenuRowId(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-slate-50 dark:bg-navy-800 border border-slate-300 dark:border-navy-600 rounded-lg shadow-xl overflow-hidden">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRowAction?.('open', kpi);
                                  setMenuRowId(null);
                                }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700"
                              >
                                <Maximize2 size={14} />
                                {t('results.actions.openDetail', 'Open detail')}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRowAction?.('record', kpi);
                                  setMenuRowId(null);
                                }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700"
                              >
                                <Target size={14} />
                                {t('results.actions.recordValue', 'Record value')}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRowAction?.('edit', kpi);
                                  setMenuRowId(null);
                                }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700"
                              >
                                <Edit size={14} />
                                {t('common.edit', 'Edit')}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRowAction?.('map', kpi);
                                  setMenuRowId(null);
                                }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700"
                              >
                                <Link2 size={14} />
                                {t('results.actions.mapInitiative', 'Map to initiative')}
                              </button>
                              <div className="border-t border-slate-300 dark:border-navy-600" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRowAction?.('delete', kpi);
                                  setMenuRowId(null);
                                }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-rose-400 hover:bg-slate-100 dark:hover:bg-navy-700"
                              >
                                <Trash2 size={14} />
                                {t('common.delete', 'Delete')}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
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

  if (kpis.length === 0 && !onNewItem) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
        <Target size={32} className="text-slate-400" />
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
            ? 'border-l-emerald-500 dark:border-l-emerald-400'
            : kpi.status === 'below'
              ? 'border-l-red-500 dark:border-l-red-400'
              : 'border-l-slate-400 dark:border-l-slate-500';

        return (
          <div
            key={kpi.id}
            onClick={() => onItemClick?.(kpi)}
            onDoubleClick={() => onItemAction?.('open', kpi)}
            className={[
              'group relative cursor-pointer rounded-xl overflow-hidden',
              'border-l-[3px] border border-slate-200/60 dark:border-white/[0.06]',
              statusAccent,
              'bg-slate-50/80 dark:bg-navy-800/60',
              'hover:bg-white dark:hover:bg-navy-800/80 hover:shadow-sm transition-all duration-150',
            ].join(' ')}
          >
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <StatusBadge status={kpi.status} />
                <TIcon size={16} className={tColor} />
              </div>
              <h3 className="text-sm font-medium text-slate-900 dark:text-white line-clamp-2 mb-1">
                {kpi.name}
              </h3>
              {kpi.initiativeName && (
                <p className="text-xs text-primary-400 mb-3 truncate">{kpi.initiativeName}</p>
              )}
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-200/70 dark:border-white/[0.06]">
                <div>
                  <p className="text-[10px] uppercase text-slate-500 mb-0.5">
                    {t('results.columns.baseline', 'Baseline')}
                  </p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                    {kpi.baselineValue != null ? kpi.baselineValue.toLocaleString() : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-slate-500 mb-0.5">
                    {t('results.columns.target', 'Target')}
                  </p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                    {kpi.targetValue != null ? kpi.targetValue.toLocaleString() : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-slate-500 mb-0.5">
                    {t('results.columns.current', 'Current')}
                  </p>
                  <p
                    className={`text-xs font-medium ${
                      kpi.status === 'on-target'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : kpi.status === 'below'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {kpi.latestValue != null ? kpi.latestValue.toLocaleString() : '—'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200/70 dark:border-white/[0.06] bg-white/50 dark:bg-white/[0.02]">
              <FrequencyBadge freq={kpi.measurementFrequency} />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {formatRelativeTime(kpi.latestMeasurementDate || kpi.createdAt)}
              </span>
            </div>
          </div>
        );
      })}

      {onNewItem && (
        <button
          onClick={onNewItem}
          className="flex flex-col items-center justify-center gap-2 min-h-[180px] rounded-xl border-2 border-dashed border-slate-300 dark:border-navy-600 text-slate-500 hover:text-primary-400 hover:border-primary-500/50 transition-all"
        >
          <Plus size={24} />
          <span className="text-sm font-medium">{t('results.addKpi', '+ Add KPI')}</span>
        </button>
      )}
    </div>
  );
};

export default ResultsKPITable;
