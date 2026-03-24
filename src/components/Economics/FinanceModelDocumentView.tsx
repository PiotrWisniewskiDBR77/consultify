import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type FinanceModelPreviewDetail, type FinanceModelRow } from './financeTypes';

type Props = {
  row: FinanceModelRow;
  detail: FinanceModelPreviewDetail | null;
};

export const FinanceModelDocumentView: React.FC<Props> = ({ row, detail }) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [selectedVariant, setSelectedVariant] = useState<'base' | 'optimistic' | 'conservative'>(
    'base'
  );
  const [selectedStatement, setSelectedStatement] = useState<'P&L' | 'BS' | 'CF'>('P&L');

  const activeVariant = useMemo(() => {
    if (!detail) return 'base';
    return detail.variants.includes(selectedVariant) ? selectedVariant : detail.variants[0] || 'base';
  }, [detail, selectedVariant]);

  const rows = detail?.scenarioTables[activeVariant]?.[selectedStatement] || [];
  const forecastYears = detail?.forecastYears || [];

  const variantLabels = {
    base: 'Base',
    optimistic: isPl ? 'Optymistyczny' : 'Optimistic',
    conservative: isPl ? 'Konserwatywny' : 'Conservative',
  };

  const statementLabels = {
    'P&L': 'P&L',
    BS: isPl ? 'Bilans' : 'Balance Sheet',
    CF: 'Cash Flow',
  };

  const formatValue = (value: number) =>
    new Intl.NumberFormat(isPl ? 'pl-PL' : 'en-US', {
      maximumFractionDigits: 0,
    }).format(value);

  if (!detail) {
    return (
      <div className="flex h-full min-h-[520px] items-center justify-center bg-slate-950 text-slate-400">
        <div className="text-center">
          <div className="text-sm font-medium text-slate-200">{row.title}</div>
          <div className="mt-2 text-xs text-slate-400">
            {isPl ? 'Ładowanie układu modelu 3-letniej prognozy...' : 'Loading 3-year forecast model layout...'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      <div className="border-b border-white/[0.06] px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
              {isPl ? 'Model finansowy' : 'Financial model'}
            </div>
            <h2 className="mt-2 text-xl font-semibold text-slate-100">{row.title}</h2>
            <p className="mt-2 text-sm text-slate-400">
              {isPl
                ? `Prognoza 3-letnia w układzie P&L / Bilans / Cash Flow. Dokument bazowy: ${detail.sourceDocumentTitle}.`
                : `3-year forecast in P&L / Balance Sheet / Cash Flow layout. Source document: ${detail.sourceDocumentTitle}.`}
            </p>
          </div>
          <div className="grid min-w-[280px] grid-cols-2 gap-3 text-xs text-slate-300">
            <div className="rounded-xl bg-white/[0.03] px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                {isPl ? 'Dokument' : 'Document'}
              </div>
              <div className="mt-1 text-sm text-slate-100">{detail.sourceDocumentTitle}</div>
            </div>
            <div className="rounded-xl bg-white/[0.03] px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                {isPl ? 'Okno prognozy' : 'Forecast window'}
              </div>
              <div className="mt-1 text-sm text-slate-100">{row.forecastWindowLabel || '3Y'}</div>
            </div>
            <div className="rounded-xl bg-white/[0.03] px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                {isPl ? 'Warianty' : 'Variants'}
              </div>
              <div className="mt-1 text-sm text-slate-100">{row.variantLabel || 'base / optimistic / conservative'}</div>
            </div>
            <div className="rounded-xl bg-white/[0.03] px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                {isPl ? 'Poziomy' : 'Levels'}
              </div>
              <div className="mt-1 text-sm text-slate-100">{detail.analyticalDepthLabel || row.analyticalDepthLabel || 'L1-L3'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-6 py-4">
        <div className="flex flex-wrap gap-2">
          {detail.variants.map((variant) => (
            <button
              key={variant}
              onClick={() => setSelectedVariant(variant)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                activeVariant === variant
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
              }`}
            >
              {variantLabels[variant]}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-white/[0.08]" />

        <div className="flex flex-wrap gap-2">
          {(['P&L', 'BS', 'CF'] as const).map((statement) => (
            <button
              key={statement}
              onClick={() => setSelectedStatement(statement)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedStatement === statement
                  ? 'bg-white text-slate-950'
                  : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
              }`}
            >
              {statementLabels[statement]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="overflow-x-auto rounded-2xl bg-white/[0.02]">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">{isPl ? 'Linia' : 'Line'}</th>
                {forecastYears.map((year) => (
                  <th key={year} className="px-4 py-3 text-right">
                    {year}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((line) => (
                <tr
                  key={`${activeVariant}-${selectedStatement}-${line.lineCode}`}
                  className={
                    line.isTotal
                      ? 'bg-white/[0.06]'
                      : line.isSubtotal
                        ? 'bg-white/[0.03]'
                        : 'border-t border-white/[0.04]'
                  }
                >
                  <td className="px-4 py-3 text-slate-200" style={{ paddingLeft: `${16 + line.level * 18}px` }}>
                    <span className={line.isTotal || line.isSubtotal ? 'font-semibold text-slate-100' : ''}>
                      {line.lineName}
                    </span>
                  </td>
                  {forecastYears.map((year) => {
                    const value = line.values[year] ?? 0;
                    return (
                      <td
                        key={`${line.lineCode}-${year}`}
                        className={`px-4 py-3 text-right font-mono ${
                          value < 0 ? 'text-rose-300' : 'text-slate-100'
                        }`}
                      >
                        {formatValue(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FinanceModelDocumentView;
