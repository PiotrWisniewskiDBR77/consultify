import React from 'react';
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
}

function badgeClass(value: string | undefined): string {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'manual') return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300';
  if (normalized === 'computed') return 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300';
  if (normalized === 'unmapped') return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
  return 'bg-slate-100 text-slate-700 dark:bg-white/[0.08] dark:text-slate-300';
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
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const visiblePeriods = periods.slice(0, 2);
  const hasComparison = visiblePeriods.length > 1;
  const gridClass = hasComparison
    ? 'grid-cols-[minmax(220px,2fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)]'
    : 'grid-cols-[minmax(220px,2fr)_minmax(140px,1fr)_minmax(140px,1fr)_minmax(130px,1fr)]';

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 dark:border-white/[0.08]">
      <div className={`grid ${gridClass} border-b border-slate-200/70 bg-slate-50/80 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-slate-400`}>
        <div>{lineLabel}</div>
        <div>{visiblePeriods[0]?.label || valueLabel}</div>
        {hasComparison && <div>{visiblePeriods[1]?.label || (isPl ? 'Poprzedni rok' : 'Prior year')}</div>}
        <div>{mappingLabel}</div>
        <div>{originLabel}</div>
      </div>
      <div className="max-h-[560px] overflow-auto">
        {rows.map((row) => {
          const emphasized = !!row.isTotal || !!row.isSubtotal;
          const primaryLabel = isPl
            ? row.lineNamePl || row.lineName || row.lineNameEn || row.originalLabel || row.lineCode || '—'
            : row.lineNameEn || row.lineName || row.lineNamePl || row.originalLabel || row.lineCode || '—';
          const indentClass =
            Number(row.aggregationLevel || 1) >= 3
              ? 'pl-8'
              : Number(row.aggregationLevel || 1) === 2
                ? 'pl-4'
                : 'pl-0';

          const periodValues = Array.isArray(row.periodValues) ? row.periodValues : [];
          const primaryValue = periodValues[0]?.value ?? row.value ?? 0;
          const secondaryValue = hasComparison ? periodValues[1]?.value ?? null : null;

          return (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelectRow(row)}
              className={`grid w-full ${gridClass} border-b border-slate-200/60 px-3 py-1.5 text-left text-[12px] last:border-b-0 dark:border-white/[0.06] ${
                selectedValueId === row.id
                  ? 'bg-cyan-50/80 dark:bg-cyan-500/10'
                  : emphasized
                    ? 'bg-slate-50/60 dark:bg-white/[0.03]'
                    : 'bg-white/80 dark:bg-transparent'
              }`}
            >
              <div className={indentClass}>
                <div
                  className={`${row.isTotal ? 'font-bold' : emphasized ? 'font-semibold' : 'font-medium'} text-slate-900 dark:text-white`}
                >
                  {primaryLabel}
                </div>
              </div>
              <div
                className={`font-mono ${row.isTotal ? 'font-bold' : emphasized ? 'font-semibold' : 'font-normal'} text-slate-700 dark:text-slate-200`}
              >
                {Number(primaryValue || 0).toLocaleString()}
              </div>
              {hasComparison && (
                <div
                  className={`font-mono ${row.isTotal ? 'font-bold' : emphasized ? 'font-semibold' : 'font-normal'} text-slate-700 dark:text-slate-200`}
                >
                  {secondaryValue != null ? Number(secondaryValue || 0).toLocaleString() : '—'}
                </div>
              )}
              <div>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeClass(row.mappingStatus)}`}>
                  {row.mappingStatus || 'auto'}
                </span>
              </div>
              <div>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeClass(row.valueOrigin)}`}>
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
