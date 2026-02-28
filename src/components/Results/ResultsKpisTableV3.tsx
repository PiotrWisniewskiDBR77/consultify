import { ExternalLink, Pencil, Target } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import { FilterableTable, type TableColumn, type TableRow } from '../shared/ModuleHub/FilterableTable';
import { TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import type { KPIStatus, KPITrend, ResultsKPI } from './ResultsHub';

const STATUS_STYLES: Record<KPIStatus, { bg: string; text: string; dot: string }> = {
  'on-target': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  below: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-500' },
  'no-data': { bg: 'bg-slate-500/10', text: 'text-slate-400', dot: 'bg-slate-400' },
};

const TREND_LABELS: Record<KPITrend, string> = {
  up: 'Up',
  down: 'Down',
  stable: 'Stable',
};

const StatusPill: React.FC<{ status: KPIStatus; label: string }> = ({ status, label }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES['no-data'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${s.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      <span className={`text-xs font-medium ${s.text}`}>{label}</span>
    </span>
  );
};

const ValueCell: React.FC<{ value?: number | null; unit?: string; status?: KPIStatus }> = ({
  value,
  unit,
  status,
}) => {
  if (value == null) return <span className="text-sm text-slate-500">—</span>;
  const color =
    status === 'on-target'
      ? 'text-emerald-400'
      : status === 'below'
        ? 'text-red-400'
        : 'text-slate-300';
  return (
    <span className={`text-sm font-medium ${color}`}>
      {value.toLocaleString()}
      {unit ? <span className="ml-0.5 text-xs text-slate-500">{unit}</span> : null}
    </span>
  );
};

export interface ResultsKpisTableV3Props {
  kpis: ResultsKPI[];
  activeFilters: FilterChip[];
  onFilterChange: (filters: FilterChip[]) => void;
  onOpenKpi: (kpiId: string) => void;
}

type PreviewKpi = ResultsKPI & { title: string };

export const ResultsKpisTableV3: React.FC<ResultsKpisTableV3Props> = ({
  kpis,
  activeFilters,
  onFilterChange,
  onOpenKpi,
}) => {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list: PreviewKpi[] = useMemo(() => {
    // Keep it stable and “clean” by default.
    return [...kpis]
      .map((k) => ({ ...k, title: k.name }))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }));
  }, [kpis]);

  const selectedItem = useMemo(
    () => (selectedId ? list.find((k) => k.id === selectedId) ?? null : null),
    [list, selectedId]
  );

  const itemIds = useMemo(() => list.map((k) => k.id), [list]);

  const rows: TableRow[] = useMemo(() => {
    return list.map((k) => ({
      id: k.id,
      type: 'KPI',
      name: k.name,
      initiativeName: k.initiativeName || '—',
      current: k.latestValue,
      target: k.targetValue,
      status: k.status,
      measurementFrequency: k.measurementFrequency,
      updatedAt: k.latestMeasurementDate || k.createdAt,
      _raw: k,
    }));
  }, [list]);

  const statusFilterOptions = useMemo(
    () => [
      { value: 'on-target', label: t('results.status.onTarget', 'On target'), color: 'bg-emerald-500' },
      { value: 'below', label: t('results.status.below', 'Below target'), color: 'bg-red-500' },
      { value: 'no-data', label: t('results.status.noData', 'No data'), color: 'bg-slate-400' },
    ],
    [t]
  );

  const freqFilterOptions = useMemo(
    () => [
      { value: 'DAILY', label: t('common.daily', 'Daily') },
      { value: 'WEEKLY', label: t('common.weekly', 'Weekly') },
      { value: 'MONTHLY', label: t('common.monthly', 'Monthly') },
      { value: 'QUARTERLY', label: t('common.quarterly', 'Quarterly') },
    ],
    [t]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'type',
        label: t('common.type', 'Type'),
        width: '8%',
        render: () => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400">
            KPI
          </span>
        ),
      },
      {
        id: 'name',
        label: t('results.columns.name', 'Name'),
        width: '24%',
        render: (row: TableRow) => (
          <span className="text-sm font-medium text-slate-900 dark:text-white truncate block max-w-[520px]">
            {row.name || '—'}
          </span>
        ),
      },
      {
        id: 'initiativeName',
        label: t('results.columns.initiative', 'Initiative'),
        width: '18%',
        filterable: true,
        filterOptions: [
          ...new Set(list.map((k) => k.initiativeName).filter(Boolean) as string[]),
        ].map((n) => ({ value: n, label: n })),
        render: (row: TableRow) => (
          <span className="text-sm text-primary-400 truncate block max-w-[260px]">
            {row.initiativeName || '—'}
          </span>
        ),
      },
      {
        id: 'current',
        label: t('results.columns.current', 'Current'),
        width: '12%',
        render: (row: TableRow) => {
          const k = row._raw as ResultsKPI;
          return <ValueCell value={k.latestValue} unit={k.unit} status={k.status} />;
        },
      },
      {
        id: 'target',
        label: t('results.columns.target', 'Target'),
        width: '12%',
        render: (row: TableRow) => {
          const k = row._raw as ResultsKPI;
          return <ValueCell value={k.targetValue} unit={k.unit} status="no-data" />;
        },
      },
      {
        id: 'status',
        label: t('results.columns.status', 'Status'),
        width: '12%',
        filterable: true,
        filterOptions: statusFilterOptions,
        render: (row: TableRow) => {
          const k = row._raw as ResultsKPI;
          const label =
            k.status === 'on-target'
              ? t('results.status.onTarget', 'On target')
              : k.status === 'below'
                ? t('results.status.below', 'Below target')
                : t('results.status.noData', 'No data');
          return <StatusPill status={k.status} label={label} />;
        },
      },
      {
        id: 'measurementFrequency',
        label: t('results.columns.frequency', 'Frequency'),
        width: '12%',
        filterable: true,
        filterOptions: freqFilterOptions,
        render: (row: TableRow) => (
          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-slate-500/10 text-slate-400">
            {String(row.measurementFrequency || '—')
              .toLowerCase()
              .replace(/^\w/, (c) => c.toUpperCase())}
          </span>
        ),
      },
      {
        id: 'updatedAt',
        label: t('common.updated', 'Updated'),
        width: '14%',
      },
    ],
    [t, list, statusFilterOptions, freqFilterOptions]
  );

  return (
    <TableWithPreviewLayout<PreviewKpi>
      selectedId={selectedId}
      selectedItem={selectedItem}
      onSelect={setSelectedId}
      onOpenFull={(id) => onOpenKpi(id)}
      itemIds={itemIds}
      renderKicker={() => t('results.kpi.preview.kicker', 'KPI detail')}
      renderPreview={(kpi) => (
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusPill
                status={kpi.status}
                label={
                  kpi.status === 'on-target'
                    ? t('results.status.onTarget', 'On target')
                    : kpi.status === 'below'
                      ? t('results.status.below', 'Below target')
                      : t('results.status.noData', 'No data')
                }
              />
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400">
                {t('results.columns.trend', 'Trend')}: {TREND_LABELS[kpi.trend] || '—'}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400">
                {t('results.columns.frequency', 'Frequency')}: {kpi.measurementFrequency || '—'}
              </span>
            </div>
            {kpi.initiativeName ? (
              <p className="text-slate-500 dark:text-slate-400">
                {t('results.columns.initiative', 'Initiative')}:&nbsp;
                <span className="text-primary-400">{kpi.initiativeName}</span>
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <span className="text-slate-500 dark:text-slate-400">{t('results.columns.current', 'Current')}</span>
            <span className="text-slate-900 dark:text-white">
              {kpi.latestValue != null ? `${kpi.latestValue.toLocaleString()}${kpi.unit ? ` ${kpi.unit}` : ''}` : '—'}
            </span>

            <span className="text-slate-500 dark:text-slate-400">{t('results.columns.target', 'Target')}</span>
            <span className="text-slate-700 dark:text-slate-200">
              {kpi.targetValue != null ? `${kpi.targetValue.toLocaleString()}${kpi.unit ? ` ${kpi.unit}` : ''}` : '—'}
            </span>

            <span className="text-slate-500 dark:text-slate-400">{t('results.columns.baseline', 'Baseline')}</span>
            <span className="text-slate-700 dark:text-slate-200">
              {kpi.baselineValue != null ? `${kpi.baselineValue.toLocaleString()}${kpi.unit ? ` ${kpi.unit}` : ''}` : '—'}
            </span>

            <span className="text-slate-500 dark:text-slate-400">{t('results.columns.owner', 'Owner')}</span>
            <span className="text-slate-700 dark:text-slate-200">{kpi.ownerName || '—'}</span>
          </div>

          {kpi.description ? (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t('common.details', 'Details')}
                </span>
                <button className="p-1.5 rounded-lg hover:bg-slate-100/70 dark:hover:bg-white/[0.05] text-slate-500 dark:text-slate-400 transition-colors">
                  <Pencil size={14} />
                </button>
              </div>
              <p className="mt-2 text-slate-700 dark:text-slate-200 line-clamp-6">{kpi.description}</p>
            </div>
          ) : null}
        </div>
      )}
      renderPreviewFooter={(kpi) => (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onOpenKpi(kpi.id)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-primary-500/15 text-primary-600 dark:text-primary-400 hover:bg-primary-500/25 transition-colors"
          >
            <ExternalLink size={14} />
            {t('common.open', 'Open')}
          </button>
          <button
            onClick={() => onOpenKpi(kpi.id)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
          >
            <Target size={14} />
            {t('results.actions.recordValue', 'Record value')}
          </button>
        </div>
      )}
    >
      <FilterableTable
        columns={columns}
        data={rows}
        activeFilters={activeFilters}
        onFilterChange={onFilterChange}
        density="compact"
        canvasClassName="pl-4 pr-1.5 pt-3 pb-4"
        emptyMessage={t('results.emptyState', 'No KPIs found')}
        onRowClick={(row) => setSelectedId(row.id)}
        onRowDoubleClick={(row) => onOpenKpi(row.id)}
        getRowActions={(row) => [
          {
            id: 'open',
            label: t('common.open', 'Open'),
            icon: ExternalLink,
            variant: 'primary',
            onClick: () => onOpenKpi(row.id),
          },
          {
            id: 'record',
            label: t('results.actions.recordValue', 'Record value'),
            icon: Target,
            onClick: () => onOpenKpi(row.id),
          },
        ]}
      />
    </TableWithPreviewLayout>
  );
};

export default ResultsKpisTableV3;

