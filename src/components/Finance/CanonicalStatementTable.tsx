import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
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

function formatValue(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(value);
}

function computeDelta(
  current: number,
  previous: number
): { pct: number; direction: 'up' | 'down' | 'flat' } | null {
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
  currency,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const visiblePeriods = periods.slice(0, 2);
  const hasTwoPeriods = visiblePeriods.length >= 2;

  const olderPeriod = hasTwoPeriods ? visiblePeriods[1] : visiblePeriods[0] || null;
  const newerPeriod = hasTwoPeriods ? visiblePeriods[0] : null;

  const processedRows = useMemo(() => {
    return rows.map((row) => {
      const periodValues = Array.isArray(row.periodValues) ? row.periodValues : [];

      let olderValue: number | null = null;
      let newerValue: number | null = null;

      if (hasTwoPeriods) {
        newerValue = periodValues[0]?.value ?? row.value ?? 0;
        olderValue = periodValues[1]?.value ?? null;
      } else {
        olderValue = periodValues[0]?.value ?? row.value ?? 0;
      }

      const delta =
        hasTwoPeriods && olderValue != null && newerValue != null
          ? computeDelta(newerValue, olderValue)
          : null;

      const label = isPl
        ? row.lineNamePl ||
          row.lineName ||
          row.lineNameEn ||
          row.originalLabel ||
          row.lineCode ||
          '—'
        : row.lineNameEn ||
          row.lineName ||
          row.lineNamePl ||
          row.originalLabel ||
          row.lineCode ||
          '—';

      return { ...row, olderValue, newerValue, delta, label };
    });
  }, [rows, hasTwoPeriods, isPl]);

  const currencyDisplay = currency || 'PLN';

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface"
      role="grid"
      aria-label={t('finance.canonicalTable.ariaLabel', 'Financial statement table')}
    >
      {/* Header */}
      <div
        className={`sticky top-0 z-10 grid ${
          hasTwoPeriods
            ? 'grid-cols-[minmax(200px,3fr)_minmax(100px,1fr)_minmax(100px,1fr)_minmax(60px,0.5fr)]'
            : 'grid-cols-[minmax(220px,3fr)_minmax(120px,1fr)]'
        } border-b border-c-border-subtle bg-c-surface-raised px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted`}
        role="row"
      >
        <div role="columnheader">{lineLabel}</div>
        {hasTwoPeriods ? (
          <>
            <div role="columnheader" className="text-right">
              {olderPeriod?.label || t('finance.canonicalTable.priorPeriod', 'Prior')}
            </div>
            <div role="columnheader" className="text-right">
              {newerPeriod?.label || t('finance.canonicalTable.currentPeriod', 'Current')}
            </div>
            <div role="columnheader" className="text-right">
              %
            </div>
          </>
        ) : (
          <div role="columnheader" className="text-right">
            {olderPeriod?.label || t('finance.canonicalTable.valueColumn', 'Value')}
          </div>
        )}
      </div>

      {/* Currency bar */}
      <div className="border-b border-c-border-subtle bg-c-surface-raised px-4 py-1 text-[10px] text-c-text-muted">
        {t('finance.canonicalTable.currency', 'Currency')}:{' '}
        <span className="font-semibold">{currencyDisplay}</span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {processedRows.map((row, idx) => {
          const isSelected = selectedValueId === row.id;
          const isTotal = !!row.isTotal;
          const isSubtotal = !!row.isSubtotal;
          const emphasized = isTotal || isSubtotal;
          const level = Number(row.aggregationLevel || 1);
          const isEvenRow = idx % 2 === 0;

          const rowBg = isSelected
            ? 'bg-blue-50/90 dark:bg-blue-500/[0.12]'
            : isTotal
              ? 'bg-black/[0.04] dark:bg-white/[0.06]'
              : isSubtotal
                ? 'bg-black/[0.02] dark:bg-white/[0.03]'
                : isEvenRow
                  ? 'bg-transparent'
                  : 'bg-black/[0.015] dark:bg-white/[0.012]';

          const borderStyle = isTotal
            ? 'border-t-2 border-b-2 border-c-border'
            : isSubtotal
              ? 'border-t border-b border-c-border-subtle'
              : 'border-b border-c-border-subtle';

          const fontWeight = isTotal ? 'font-bold' : isSubtotal ? 'font-semibold' : 'font-normal';

          const textColor = isTotal
            ? 'text-c-text'
            : isSubtotal
              ? 'text-c-text'
              : 'text-c-text-secondary';

          const nameWeight = isTotal ? 'font-bold' : isSubtotal ? 'font-semibold' : 'font-medium';

          return (
            <button
              key={row.id}
              type="button"
              role="row"
              aria-selected={isSelected}
              onClick={() => onSelectRow(row)}
              className={`group grid w-full ${
                hasTwoPeriods
                  ? 'grid-cols-[minmax(200px,3fr)_minmax(100px,1fr)_minmax(100px,1fr)_minmax(60px,0.5fr)]'
                  : 'grid-cols-[minmax(220px,3fr)_minmax(120px,1fr)]'
              } ${borderStyle} px-4 py-[5px] text-left text-[12.5px] transition-colors duration-75 last:border-b-0 hover:bg-blue-50/40 dark:hover:bg-blue-500/[0.05] ${rowBg}`}
            >
              {/* Line item */}
              <div
                role="gridcell"
                className={`flex items-center ${
                  level >= 3 ? 'pl-10' : level === 2 ? 'pl-5' : 'pl-0'
                }`}
              >
                {level >= 2 && !emphasized && (
                  <span className="mr-1.5 inline-block h-3.5 w-px bg-c-border-subtle" />
                )}
                <span className={`truncate ${nameWeight} ${textColor}`} title={row.label}>
                  {row.label}
                </span>
              </div>

              {hasTwoPeriods ? (
                <>
                  {/* Older period (left) */}
                  <div
                    role="gridcell"
                    className={`text-right font-mono tabular-nums ${fontWeight} text-c-text-muted`}
                  >
                    {row.olderValue != null ? formatValue(row.olderValue, isPl ? 'pl-PL' : 'en-US') : '—'}
                  </div>

                  {/* Newer period (right, bolder) */}
                  <div
                    role="gridcell"
                    className={`text-right font-mono tabular-nums ${fontWeight} ${textColor}`}
                  >
                    {row.newerValue != null ? formatValue(row.newerValue, isPl ? 'pl-PL' : 'en-US') : '—'}
                  </div>

                  {/* Delta % */}
                  <div role="gridcell" className="flex items-center justify-end">
                    {row.delta ? (
                      <span
                        className={`inline-flex items-center gap-0.5 text-[10px] font-medium tabular-nums ${
                          row.delta.direction === 'up'
                            ? 'text-c-success'
                            : row.delta.direction === 'down'
                              ? 'text-c-danger'
                              : 'text-c-text-muted'
                        }`}
                      >
                        {row.delta.direction === 'up' ? (
                          <ArrowUpRight size={10} />
                        ) : row.delta.direction === 'down' ? (
                          <ArrowDownRight size={10} />
                        ) : null}
                        {row.delta.pct === 0
                          ? '—'
                          : `${row.delta.pct > 0 ? '+' : ''}${row.delta.pct.toFixed(1)}%`}
                      </span>
                    ) : (
                      <span className="text-[10px] text-c-text-muted">—</span>
                    )}
                  </div>
                </>
              ) : (
                /* Single period */
                <div
                  role="gridcell"
                  className={`text-right font-mono tabular-nums ${fontWeight} ${textColor}`}
                >
                  {row.olderValue != null ? formatValue(row.olderValue, isPl ? 'pl-PL' : 'en-US') : '—'}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
