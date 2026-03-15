import { ArrowDownRight, ArrowUpRight, Link2, Minus, PenLine, Sparkles, Zap } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { type FinanceStatementTableRow } from '../Economics/financeTypes';

interface Props {
  rows: FinanceStatementTableRow[];
  periods?: Array<{ label: string; index: number }>;
  selectedValueId: string | null;
  onSelectRow: (row: FinanceStatementTableRow) => void;
  lineLabel: string;
  valueLabel: string;
  mappingLabel: string;
  originLabel: string;
  currency?: string;
}

const MAPPING_CONFIG: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  auto: {
    bg: 'bg-slate-100 dark:bg-white/[0.07]',
    text: 'text-slate-600 dark:text-slate-300',
    icon: <Zap size={10} className="opacity-60" />,
  },
  manual: {
    bg: 'bg-cyan-50 dark:bg-cyan-500/10',
    text: 'text-cyan-700 dark:text-cyan-300',
    icon: <PenLine size={10} />,
  },
  computed: {
    bg: 'bg-violet-50 dark:bg-violet-500/10',
    text: 'text-violet-700 dark:text-violet-300',
    icon: <Sparkles size={10} />,
  },
  unmapped: {
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-300',
    icon: <Minus size={10} />,
  },
  mapped: {
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: <Link2 size={10} />,
  },
};

const ORIGIN_CONFIG: Record<string, { bg: string; text: string }> = {
  source: {
    bg: 'bg-slate-100 dark:bg-white/[0.07]',
    text: 'text-slate-600 dark:text-slate-300',
  },
  computed: {
    bg: 'bg-violet-50 dark:bg-violet-500/10',
    text: 'text-violet-700 dark:text-violet-300',
  },
  derived: {
    bg: 'bg-indigo-50 dark:bg-indigo-500/10',
    text: 'text-indigo-700 dark:text-indigo-300',
  },
  manual: {
    bg: 'bg-cyan-50 dark:bg-cyan-500/10',
    text: 'text-cyan-700 dark:text-cyan-300',
  },
};

function formatValue(value: number, currency?: string): string {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(Math.abs(value));

  const sign = value < 0 ? '-' : '';
  const prefix = currency ? `${currency} ` : '';
  return `${sign}${prefix}${formatted}`;
}

function computeDelta(current: number, previous: number): { pct: number; direction: 'up' | 'down' | 'flat' } | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return { pct: 100, direction: current > 0 ? 'up' : 'down' };
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(pct) < 0.05) return { pct: 0, direction: 'flat' };
  return { pct, direction: pct > 0 ? 'up' : 'down' };
}

export const CanonicalStatementTable: React.FC<Props> = ({
  rows,
  periods = [],
  selectedValueId,
  onSelectRow,
  lineLabel,
  valueLabel,
  mappingLabel,
  originLabel,
  currency,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const visiblePeriods = periods.slice(0, 2);
  const hasComparison = visiblePeriods.length > 1;

  const gridClass = hasComparison
    ? 'grid-cols-[minmax(200px,2.5fr)_minmax(100px,1fr)_minmax(100px,1fr)_minmax(70px,0.6fr)_minmax(90px,0.8fr)_minmax(90px,0.8fr)]'
    : 'grid-cols-[minmax(220px,2.5fr)_minmax(120px,1fr)_minmax(100px,0.8fr)_minmax(100px,0.8fr)]';

  const processedRows = useMemo(() => {
    return rows.map((row) => {
      const periodValues = Array.isArray(row.periodValues) ? row.periodValues : [];
      const primaryValue = periodValues[0]?.value ?? row.value ?? 0;
      const secondaryValue = hasComparison ? (periodValues[1]?.value ?? null) : null;
      const delta = hasComparison && secondaryValue != null ? computeDelta(primaryValue, secondaryValue) : null;

      const label = isPl
        ? row.lineNamePl || row.lineName || row.lineNameEn || row.originalLabel || row.lineCode || '—'
        : row.lineNameEn || row.lineName || row.lineNamePl || row.originalLabel || row.lineCode || '—';

      return { ...row, primaryValue, secondaryValue, delta, label };
    });
  }, [rows, hasComparison, isPl]);

  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200/70 dark:border-white/[0.08]"
      role="grid"
      aria-label={isPl ? 'Tabela sprawozdania finansowego' : 'Financial statement table'}
    >
      {/* Sticky header */}
      <div
        className={`sticky top-0 z-10 grid ${gridClass} border-b border-slate-200/70 bg-slate-50/95 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 backdrop-blur-sm dark:border-white/[0.08] dark:bg-navy-900/95 dark:text-slate-400`}
        role="row"
      >
        <div role="columnheader">{lineLabel}</div>
        <div role="columnheader" className="text-right">{visiblePeriods[0]?.label || valueLabel}</div>
        {hasComparison && (
          <>
            <div role="columnheader" className="text-right">
              {visiblePeriods[1]?.label || (isPl ? 'Poprzedni rok' : 'Prior year')}
            </div>
            <div role="columnheader" className="text-right">
              {isPl ? 'Zmiana' : 'Change'}
            </div>
          </>
        )}
        <div role="columnheader">{mappingLabel}</div>
        <div role="columnheader">{originLabel}</div>
      </div>

      {/* Scrollable body */}
      <div className="max-h-[560px] overflow-auto">
        {processedRows.map((row, idx) => {
          const isSelected = selectedValueId === row.id;
          const isTotal = !!row.isTotal;
          const isSubtotal = !!row.isSubtotal;
          const emphasized = isTotal || isSubtotal;
          const level = Number(row.aggregationLevel || 1);
          const isEvenRow = idx % 2 === 0;

          const mappingKey = String(row.mappingStatus || 'auto').toLowerCase();
          const mappingCfg = MAPPING_CONFIG[mappingKey] || MAPPING_CONFIG.auto;
          const originKey = String(row.valueOrigin || 'source').toLowerCase();
          const originCfg = ORIGIN_CONFIG[originKey] || ORIGIN_CONFIG.source;

          const rowBg = isSelected
            ? 'bg-cyan-50/90 dark:bg-cyan-500/[0.12]'
            : isTotal
              ? 'bg-slate-100/80 dark:bg-white/[0.06]'
              : isSubtotal
                ? 'bg-slate-50/70 dark:bg-white/[0.03]'
                : isEvenRow
                  ? 'bg-white dark:bg-transparent'
                  : 'bg-slate-50/40 dark:bg-white/[0.015]';

          const borderStyle = isTotal
            ? 'border-t-2 border-b-2 border-slate-300/70 dark:border-white/[0.12]'
            : isSubtotal
              ? 'border-t border-b border-slate-200/80 dark:border-white/[0.08]'
              : 'border-b border-slate-200/50 dark:border-white/[0.04]';

          return (
            <button
              key={row.id}
              type="button"
              role="row"
              aria-selected={isSelected}
              onClick={() => onSelectRow(row)}
              className={`group grid w-full ${gridClass} ${borderStyle} px-3 py-1.5 text-left text-[12px] transition-colors duration-100 last:border-b-0 hover:bg-cyan-50/50 dark:hover:bg-cyan-500/[0.06] ${rowBg}`}
            >
              {/* Line item name with indentation */}
              <div
                role="gridcell"
                className={`flex items-center gap-1 ${
                  level >= 3 ? 'pl-8' : level === 2 ? 'pl-4' : 'pl-0'
                }`}
              >
                {level >= 2 && !emphasized && (
                  <span className="mr-1 inline-block h-3 w-px bg-slate-300/60 dark:bg-white/[0.1]" />
                )}
                <span
                  className={`truncate ${
                    isTotal
                      ? 'font-bold text-slate-900 dark:text-white'
                      : isSubtotal
                        ? 'font-semibold text-slate-800 dark:text-slate-100'
                        : 'font-medium text-slate-700 dark:text-slate-200'
                  }`}
                  title={row.label}
                >
                  {row.label}
                </span>
              </div>

              {/* Primary value */}
              <div
                role="gridcell"
                className={`text-right font-mono tabular-nums ${
                  isTotal
                    ? 'font-bold text-slate-900 dark:text-white'
                    : isSubtotal
                      ? 'font-semibold text-slate-800 dark:text-slate-100'
                      : 'text-slate-700 dark:text-slate-200'
                }`}
                title={String(row.primaryValue)}
              >
                {formatValue(row.primaryValue, currency)}
              </div>

              {/* Secondary value (comparison period) */}
              {hasComparison && (
                <>
                  <div
                    role="gridcell"
                    className={`text-right font-mono tabular-nums ${
                      isTotal
                        ? 'font-bold text-slate-900 dark:text-white'
                        : isSubtotal
                          ? 'font-semibold text-slate-800 dark:text-slate-100'
                          : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {row.secondaryValue != null ? formatValue(row.secondaryValue, currency) : '—'}
                  </div>

                  {/* Delta column */}
                  <div role="gridcell" className="flex items-center justify-end">
                    {row.delta ? (
                      <span
                        className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${
                          row.delta.direction === 'up'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : row.delta.direction === 'down'
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                              : 'bg-slate-50 text-slate-500 dark:bg-white/[0.04] dark:text-slate-400'
                        }`}
                      >
                        {row.delta.direction === 'up' ? (
                          <ArrowUpRight size={10} />
                        ) : row.delta.direction === 'down' ? (
                          <ArrowDownRight size={10} />
                        ) : null}
                        {row.delta.pct === 0 ? '—' : `${row.delta.pct > 0 ? '+' : ''}${row.delta.pct.toFixed(1)}%`}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">—</span>
                    )}
                  </div>
                </>
              )}

              {/* Mapping badge */}
              <div role="gridcell" className="flex items-center">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium leading-tight ${mappingCfg.bg} ${mappingCfg.text}`}
                >
                  {mappingCfg.icon}
                  {row.mappingStatus || 'auto'}
                </span>
              </div>

              {/* Origin badge */}
              <div role="gridcell" className="flex items-center">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium leading-tight ${originCfg.bg} ${originCfg.text}`}
                >
                  {row.valueOrigin || 'source'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
