import { Clock, MoreVertical, Sparkles } from 'lucide-react';
import React, { useCallback } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import {
  type FinanceAnalysisRow,
  type FinanceModelRow,
  type FinanceRow,
  type FinanceValuationRow,
  formatAge,
  getTypeCode,
  KIND_ICONS,
  type PreviewDataState,
} from './financeTypes';

interface FinancePreviewPanelProps {
  predictionValidations: PreviewDataState['predictionValidations'];
  analysisPreviewRatios: PreviewDataState['analysisPreviewRatios'];
  budgetPreviewScenarios: PreviewDataState['budgetPreviewScenarios'];
  valuationPreviewResults: PreviewDataState['valuationPreviewResults'];
  valuationPreviewDetail: PreviewDataState['valuationPreviewDetail'];
  handleOpenFull: (row: FinanceRow) => void;
  handleExport: (row: FinanceRow) => void;
  loadModels: () => Promise<void>;
  loadAnalyses: () => Promise<void>;
  loadAnalysisPreviewRatios: (id: string) => Promise<void>;
  loadBudgets: () => Promise<void>;
  loadBudgetPreviewScenarios: (id: string) => Promise<void>;
  loadPredictionPreview: (id: string) => Promise<void>;
  loadValuations: () => Promise<void>;
  loadValuationPreviewResults: (id: string) => Promise<void>;
  getBudgetRawId: (id: string) => string;
}

export function useFinancePreview({
  predictionValidations,
  analysisPreviewRatios,
  budgetPreviewScenarios,
  valuationPreviewResults,
  valuationPreviewDetail,
  handleOpenFull,
  handleExport,
  loadModels,
  loadAnalyses,
  loadAnalysisPreviewRatios,
  loadBudgets,
  loadBudgetPreviewScenarios,
  loadPredictionPreview,
  loadValuations,
  loadValuationPreviewResults,
  getBudgetRawId,
}: FinancePreviewPanelProps) {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const renderPreviewBody = useCallback(
    (row: FinanceRow) => {
      const metaPills: { label: string; value: string }[] = [];

      if (row.kind === 'models') {
        metaPills.push(
          { label: t('finance.columns.scenario', 'Scenario'), value: row.scenario },
          { label: t('common.currency', 'Currency'), value: row.currency },
          {
            label: t('finance.columns.horizon', 'Horizon'),
            value: `${row.horizonMonths} ${t('finance.units.mo', 'mo')}`,
          }
        );
        if (row.startDate)
          metaPills.push({
            label: t('finance.columns.start', 'Start'),
            value: new Date(row.startDate).toLocaleDateString(),
          });
      } else if (row.kind === 'prediction') {
        const pRow = row as FinanceModelRow;
        if (pRow.predictionType === 'budget') {
          metaPills.push(
            { label: t('finance.prediction.subtype', 'Type'), value: isPl ? 'Budżet' : 'Budget' },
            { label: t('common.currency', 'Currency'), value: pRow.currency }
          );
          if (pRow.periodStart && pRow.periodEnd)
            metaPills.push({
              label: t('finance.columns.period', 'Period'),
              value: `${pRow.periodStart} → ${pRow.periodEnd}`,
            });
        } else {
          metaPills.push(
            { label: t('finance.prediction.subtype', 'Type'), value: 'Model' },
            { label: t('finance.columns.scenario', 'Scenario'), value: pRow.scenario },
            { label: t('common.currency', 'Currency'), value: pRow.currency },
            {
              label: t('finance.columns.horizon', 'Horizon'),
              value: `${pRow.horizonMonths} ${t('finance.units.mo', 'mo')}`,
            }
          );
        }
      } else if (row.kind === 'analysis' || row.kind === 'investment') {
        metaPills.push(
          { label: t('finance.columns.analysisType', 'Type'), value: row.analysisType },
          { label: t('common.currency', 'Currency'), value: row.currency },
          { label: t('finance.columns.periods', 'Periods'), value: String(row.periodCount) }
        );
      } else {
        const vRow = row as FinanceValuationRow;
        metaPills.push(
          { label: t('finance.columns.source', 'Source'), value: vRow.sourceType },
          { label: t('finance.columns.method', 'Method'), value: vRow.method },
          { label: t('common.currency', 'Currency'), value: vRow.currency },
          {
            label: t('finance.columns.horizonYears', 'Horizon'),
            value: `${vRow.horizonYears} ${t('finance.units.yr', 'yr')}`,
          }
        );
      }

      return (
        <div className="space-y-4">
          {/* Entity Meta Bar */}
          <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-700 dark:text-slate-200">
                  {KIND_ICONS[row.kind]}
                  {getTypeCode(row.kind)}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    row.status === 'APPROVED'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : row.status === 'REVIEW'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${row.status === 'APPROVED' ? 'bg-emerald-500' : row.status === 'REVIEW' ? 'bg-amber-500' : 'bg-slate-400'}`}
                  />
                  {row.status}
                </span>
                {metaPills.map((mp) => (
                  <span
                    key={mp.label}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300"
                  >
                    {mp.value}
                  </span>
                ))}
              </div>
              <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 shrink-0 inline-flex items-center gap-1.5">
                <Clock size={14} className="text-slate-400" />
                <span>{formatAge(row.updatedAt, isPl)}</span>
              </div>
            </div>
          </div>

          {/* Details section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                {t('common.details', 'Details')}
              </div>
              <button
                className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
                title={t('common.more', 'More')}
                onClick={() => handleOpenFull(row)}
              >
                <MoreVertical size={14} />
              </button>
            </div>
            <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
              {row.kind === 'models' &&
                (isPl
                  ? `Model finansowy P&L / Bilans / CF.\nScenariusz: ${row.scenario}\nWaluta: ${row.currency}\nHoryzont: ${row.horizonMonths} miesięcy\nStart: ${row.startDate || '—'}`
                  : `Financial model P&L / BS / CF.\nScenario: ${row.scenario}\nCurrency: ${row.currency}\nHorizon: ${row.horizonMonths} months\nStart: ${row.startDate || '—'}`)}
              {(row.kind === 'analysis' || row.kind === 'investment') &&
                (isPl
                  ? `${row.kind === 'investment' ? 'Case inwestycyjny' : 'Analiza finansowa'}: ${row.analysisType}\nWaluta: ${row.currency}\nLiczba okresów: ${row.periodCount}`
                  : `${row.kind === 'investment' ? 'Investment case' : 'Financial analysis'}: ${row.analysisType}\nCurrency: ${row.currency}\nPeriods: ${row.periodCount}`)}
              {row.kind === 'prediction' &&
                (() => {
                  const pRow = row as FinanceModelRow;
                  if (pRow.predictionType === 'budget')
                    return isPl
                      ? `Budżet / Prognoza\nOkres: ${pRow.periodStart || '—'} → ${pRow.periodEnd || '—'}\nWaluta: ${pRow.currency}\nScenarze: base / optimistic / conservative`
                      : `Budget / Forecast\nPeriod: ${pRow.periodStart || '—'} → ${pRow.periodEnd || '—'}\nCurrency: ${pRow.currency}\nScenarios: base / optimistic / conservative`;
                  return isPl
                    ? `Predykcja / scenariusz: ${pRow.scenario}\nWaluta: ${pRow.currency}\nHoryzont: ${pRow.horizonMonths} miesięcy`
                    : `Forecast / scenario: ${pRow.scenario}\nCurrency: ${pRow.currency}\nHorizon: ${pRow.horizonMonths} months`;
                })()}
              {row.kind === 'valuation' &&
                (isPl
                  ? `Wycena przedsiębiorstwa\nMetoda: ${(row as FinanceValuationRow).method}\nŹródło: ${(row as FinanceValuationRow).sourceType}\nWaluta: ${row.currency}\nHoryzont: ${(row as FinanceValuationRow).horizonYears} lat`
                  : `Enterprise valuation\nMethod: ${(row as FinanceValuationRow).method}\nSource: ${(row as FinanceValuationRow).sourceType}\nCurrency: ${row.currency}\nHorizon: ${(row as FinanceValuationRow).horizonYears} years`)}
            </div>
          </div>

          {/* Prediction: validation summary */}
          {row.kind === 'prediction' &&
            (row as FinanceModelRow).predictionType === 'model' &&
            predictionValidations && (
              <div className="rounded-lg border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] p-3 space-y-1">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                  {t('finance.prediction.validations', 'Validations')}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-600 dark:text-emerald-400">
                    ✓ {predictionValidations.pass} {t('finance.prediction.pass', 'pass')}
                  </span>
                  <span className="text-amber-600 dark:text-amber-400">
                    ⚠ {predictionValidations.warning} {t('finance.prediction.warn', 'warn')}
                  </span>
                  <span className="text-red-600 dark:text-red-400">
                    ✗ {predictionValidations.fail} {t('finance.prediction.fail', 'fail')}
                  </span>
                </div>
              </div>
            )}

          {/* Prediction: budget scenario cards */}
          {row.kind === 'prediction' &&
            (row as FinanceModelRow).predictionType === 'budget' &&
            budgetPreviewScenarios &&
            budgetPreviewScenarios.length > 0 && (
              <div className="rounded-lg border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] p-3 space-y-2">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                  {t('finance.prediction.scenarios', 'Scenarios')}
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {budgetPreviewScenarios.map((sc) => {
                    const colorMap: Record<string, string> = {
                      base: 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/10',
                      optimistic: 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10',
                      conservative: 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-900/10',
                    };
                    return (
                      <div
                        key={sc.scenarioType}
                        className={`border-l-2 rounded-r-md p-2 ${colorMap[sc.scenarioType] || 'border-l-slate-400 bg-slate-50/50 dark:bg-slate-900/10'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 capitalize">
                            {sc.name || sc.scenarioType}
                          </span>
                          {sc.isActive && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                              {isPl ? 'aktywny' : 'active'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          {/* Analysis: ratio summary */}
          {(row.kind === 'analysis' || row.kind === 'investment') &&
            analysisPreviewRatios &&
            analysisPreviewRatios.length > 0 &&
            (() => {
              const categoryLabels: Record<string, { en: string; pl: string; color: string }> = {
                liquidity: {
                  en: 'Liquidity',
                  pl: 'Płynność',
                  color: 'text-blue-600 dark:text-blue-400',
                },
                profitability: {
                  en: 'Profitability',
                  pl: 'Rentowność',
                  color: 'text-emerald-600 dark:text-emerald-400',
                },
                leverage: {
                  en: 'Leverage',
                  pl: 'Zadłużenie',
                  color: 'text-amber-600 dark:text-amber-400',
                },
                efficiency: {
                  en: 'Efficiency',
                  pl: 'Efektywność',
                  color: 'text-purple-600 dark:text-purple-400',
                },
                investment: {
                  en: 'Investment',
                  pl: 'Inwestycja',
                  color: 'text-fuchsia-600 dark:text-fuchsia-400',
                },
                growth: { en: 'Growth', pl: 'Wzrost', color: 'text-cyan-600 dark:text-cyan-400' },
              };
              const grouped: Record<string, typeof analysisPreviewRatios> = {};
              for (const r of analysisPreviewRatios) {
                if (!grouped[r.category]) grouped[r.category] = [];
                grouped[r.category]!.push(r);
              }
              return (
                <div className="rounded-lg border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] p-3 space-y-2">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                    {t('finance.analysis.ratioSummary', 'Financial Ratios')}
                  </div>
                  {Object.entries(grouped).map(([cat, items]) => {
                    const meta = categoryLabels[cat] || {
                      en: cat,
                      pl: cat,
                      color: 'text-slate-600',
                    };
                    const topRatio = items?.find((r) => r.value != null);
                    return (
                      <div key={cat} className="flex items-center justify-between text-xs">
                        <span className={`font-medium ${meta.color}`}>
                          {isPl ? meta.pl : meta.en}
                        </span>
                        <span className="text-slate-600 dark:text-slate-300 font-mono">
                          {topRatio
                            ? `${topRatio.ratio_name}: ${topRatio.value?.toFixed(2)}`
                            : `${items?.length || 0} ${isPl ? 'wsk.' : 'ratios'}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

          {/* Valuation: DCF results + sensitivity + advisory */}
          {row.kind === 'valuation' && (
            <>
              <div className="rounded-lg border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] p-3 space-y-2">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                  {t('finance.valuation.dcfResults', 'DCF Results')}
                </div>
                {valuationPreviewResults ? (
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        label: 'EV',
                        value: valuationPreviewResults.enterpriseValue,
                        color: 'text-amber-600 dark:text-amber-400',
                      },
                      {
                        label: 'Equity',
                        value: valuationPreviewResults.equityValue,
                        color: 'text-emerald-600 dark:text-emerald-400',
                      },
                      {
                        label: 'EV/EBITDA',
                        value: valuationPreviewResults.evEbitda,
                        color: 'text-blue-600 dark:text-blue-400',
                      },
                    ].map((item) => (
                      <div key={item.label} className="text-center">
                        <div className={`text-[10px] font-medium ${item.color}`}>{item.label}</div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                          {item.value != null
                            ? item.label === 'EV/EBITDA'
                              ? `${item.value.toFixed(1)}x`
                              : `${(item.value / 1_000_000).toFixed(1)}M`
                            : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {isPl
                      ? 'Nie obliczono jeszcze — kliknij "Oblicz DCF"'
                      : 'Not computed yet — click "Compute DCF"'}
                  </div>
                )}
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                      (row as FinanceValuationRow).sourceType === 'financial_model'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : (row as FinanceValuationRow).sourceType === 'budget'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300'
                    }`}
                  >
                    {(row as FinanceValuationRow).sourceType === 'financial_model'
                      ? isPl
                        ? 'Model'
                        : 'Model'
                      : (row as FinanceValuationRow).sourceType === 'budget'
                        ? isPl
                          ? 'Budżet'
                          : 'Budget'
                        : isPl
                          ? 'Ręczne'
                          : 'Manual'}
                  </span>
                </div>
              </div>

              {/* Sensitivity heatmap */}
              {valuationPreviewDetail?.sensitivity &&
                (() => {
                  const sens = valuationPreviewDetail.sensitivity;
                  const matrix = sens?.matrix || sens?.grid;
                  if (!Array.isArray(matrix) || matrix.length === 0) return null;
                  return (
                    <div className="rounded-lg border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] p-3 space-y-2">
                      <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                        {t('finance.valuation.sensitivity', 'Sensitivity Analysis')}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px]">
                          <thead>
                            <tr>
                              <th className="text-left text-slate-500 py-0.5 pr-1">WACC \ g</th>
                              {(matrix[0] || []).map((_: any, ci: number) => (
                                <th key={ci} className="text-center text-slate-500 py-0.5 px-1">
                                  {sens?.colHeaders?.[ci] ?? `${ci + 1}`}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {matrix.map((matRow: number[], ri: number) => (
                              <tr key={ri}>
                                <td className="text-slate-500 py-0.5 pr-1 font-medium">
                                  {sens?.rowHeaders?.[ri] ?? `${ri + 1}`}
                                </td>
                                {matRow.map((val: number, ci: number) => {
                                  const maxVal = Math.max(...matrix.flat());
                                  const minVal = Math.min(...matrix.flat());
                                  const norm =
                                    maxVal === minVal ? 0.5 : (val - minVal) / (maxVal - minVal);
                                  const bg =
                                    norm > 0.66
                                      ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                                      : norm > 0.33
                                        ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                                        : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300';
                                  return (
                                    <td
                                      key={ci}
                                      className={`text-center py-0.5 px-1 rounded ${bg} font-mono`}
                                    >
                                      {(val / 1_000_000).toFixed(1)}M
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

              {/* Advisory summary */}
              {valuationPreviewDetail?.advisory &&
                (() => {
                  const recs = Array.isArray(valuationPreviewDetail.advisory?.recommendations)
                    ? valuationPreviewDetail.advisory.recommendations
                    : Array.isArray(valuationPreviewDetail.advisory)
                      ? valuationPreviewDetail.advisory
                      : [];
                  if (recs.length === 0) return null;
                  const topTwo = recs.slice(0, 2);
                  return (
                    <div className="rounded-lg border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                          {t('finance.valuation.advisory', 'Advisory')}
                          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            {recs.length}
                          </span>
                        </div>
                        <button
                          className="text-[10px] text-primary-600 dark:text-primary-400 hover:underline"
                          onClick={() => handleOpenFull(row)}
                        >
                          {isPl ? 'Zobacz wszystkie' : 'View all'}
                        </button>
                      </div>
                      {topTwo.map((rec: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span
                            className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              rec.priority === 'high'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                : rec.priority === 'medium'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {(rec.priority || 'low').toUpperCase()}
                          </span>
                          <span className="text-slate-700 dark:text-slate-200 line-clamp-1">
                            {rec.title || rec.description || rec.text || ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

              {/* Negotiation pack badge */}
              {valuationPreviewDetail?.negotiationPack && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-700/30">
                    ✓ {isPl ? 'Negotiation Pack gotowy' : 'Negotiation Pack ready'}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      );
    },
    [
      t,
      isPl,
      predictionValidations,
      analysisPreviewRatios,
      budgetPreviewScenarios,
      valuationPreviewResults,
      valuationPreviewDetail,
      handleOpenFull,
    ]
  );

  const renderPreviewFooter = useCallback(
    (row: FinanceRow) => {
      const divider = <div className="h-px bg-slate-200/70 dark:bg-white/[0.06]" />;

      const hintChip = (label: string) => (
        <button
          className="h-7 px-2.5 rounded-full border border-slate-200/70 dark:border-white/[0.08] text-[11px] font-medium text-slate-500 dark:text-slate-300 bg-transparent hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors active:scale-[0.98]"
          onClick={() =>
            window.location.assign(`/chat?context=finance&prompt=${encodeURIComponent(label)}`)
          }
        >
          {label}
        </button>
      );

      const primaryPill = (label: string, onClick: () => void) => (
        <button
          onClick={onClick}
          className="inline-flex items-center justify-center h-9 px-4 rounded-full text-xs font-medium border border-primary-500/30 bg-primary-500/10 text-primary-700 dark:text-primary-300 hover:bg-primary-500/15 transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
        >
          {label}
        </button>
      );

      const secondaryPill = (label: string, onClick: () => void) => (
        <button
          onClick={onClick}
          className="inline-flex items-center justify-center h-9 px-4 rounded-full text-xs font-medium border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
        >
          {label}
        </button>
      );

      const aiHints: string[] = (() => {
        switch (row.kind) {
          case 'models':
            return [
              isPl ? 'Sprawdź spójność' : 'Check consistency',
              isPl ? 'Zaproponuj scenariusz' : 'Suggest scenario',
              isPl ? 'Porównaj z baseline' : 'Compare to baseline',
            ];
          case 'analysis':
            return [
              isPl ? 'Podsumuj wyniki' : 'Summarize results',
              isPl ? 'Znajdź anomalie' : 'Find anomalies',
              isPl ? 'Zaproponuj działania' : 'Suggest actions',
            ];
          case 'investment':
            return [
              isPl ? 'Oceń NPV i IRR' : 'Evaluate NPV and IRR',
              isPl ? 'Sprawdź payback' : 'Check payback',
              isPl ? 'Rekomendacja go/no-go' : 'Go/no-go recommendation',
            ];
          case 'prediction':
            return [
              isPl ? 'Oceń założenia' : 'Evaluate assumptions',
              isPl ? 'Analiza wrażliwości' : 'Sensitivity analysis',
              isPl ? 'Porównaj scenariusze' : 'Compare scenarios',
            ];
          case 'valuation':
            return [
              isPl ? 'Zweryfikuj WACC' : 'Verify WACC',
              isPl ? 'Porównaj z rynkiem' : 'Compare to market',
              isPl ? 'Jak poprawić wycenę?' : 'How to improve?',
            ];
        }
      })();

      return (
        <div className="space-y-0">
          <div className="py-1.5">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                <Sparkles size={12} />
                <span className="text-[10px] font-medium uppercase tracking-wider">AI</span>
              </div>
              <button
                className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
                title={t('common.more', 'More')}
                onClick={() => window.location.assign('/chat?context=finance')}
              >
                <MoreVertical size={14} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {aiHints.map((hint) => (
                <React.Fragment key={hint}>{hintChip(hint)}</React.Fragment>
              ))}
            </div>
          </div>
          {divider}
          <div className="min-h-[4.5rem] flex flex-wrap items-start content-start gap-2 py-1.5">
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {t('common.noRelations', 'No relations')}
            </span>
          </div>
          {divider}
          <div className="space-y-2.5 py-1.5">
            <div className="flex flex-wrap gap-2">
              {row.kind === 'models' &&
                row.status !== 'APPROVED' &&
                primaryPill(t('finance.actions.approve', 'Zatwierdź'), async () => {
                  try {
                    await Api.post(`/api/financial-modeling/models/${row.id}/approve`, {});
                    await loadModels();
                    toast.success(t('finance.toast.modelApproved', 'Model zatwierdzony'));
                  } catch (e: any) {
                    toast.error(
                      e?.response?.data?.error ||
                        t('finance.toast.approveFailed', 'Nie udało się zatwierdzić')
                    );
                  }
                })}
              {(row.kind === 'analysis' || row.kind === 'investment') && (
                <>
                  {primaryPill(t('finance.actions.reanalyze', 'Przelicz ponownie'), async () => {
                    try {
                      await Api.post(`/api/economics/financial-analyses/${row.id}/run`, {});
                      await loadAnalyses();
                      await loadAnalysisPreviewRatios(row.id);
                      toast.success(t('finance.toast.reanalyzed', 'Analiza przeliczona'));
                    } catch (e: any) {
                      toast.error(
                        e?.response?.data?.error ||
                          t('finance.toast.reanalyzeFailed', 'Nie udało się przeliczyć')
                      );
                    }
                  })}
                  {row.status !== 'APPROVED' &&
                    primaryPill(t('finance.actions.approve', 'Zatwierdź'), async () => {
                      try {
                        await Api.post(`/api/economics/financial-analyses/${row.id}/approve`, {});
                        await loadAnalyses();
                        toast.success(t('finance.toast.analysisApproved', 'Analiza zatwierdzona'));
                      } catch (e: any) {
                        toast.error(
                          e?.response?.data?.error ||
                            t('finance.toast.approveFailed', 'Nie udało się zatwierdzić')
                        );
                      }
                    })}
                </>
              )}
              {row.kind === 'prediction' &&
                (() => {
                  const pRow = row as FinanceModelRow;
                  if (pRow.predictionType === 'budget') {
                    const rawId = getBudgetRawId(row.id);
                    return (
                      <>
                        {primaryPill(
                          t('finance.actions.generateProjections', 'Generuj prognozy'),
                          async () => {
                            try {
                              const detail = await Api.get(`/api/economics/budgets/${rawId}`);
                              const scens = (detail as any)?.scenarios || [];
                              for (const sc of scens)
                                await Api.post(
                                  `/api/economics/budgets/${rawId}/scenarios/${sc.id}/project`,
                                  {}
                                );
                              await loadBudgetPreviewScenarios(rawId);
                              toast.success(t('finance.toast.projected', 'Prognozy wygenerowane'));
                            } catch (e: any) {
                              toast.error(
                                e?.response?.data?.error ||
                                  t('finance.toast.projectionFailed', 'Nie udało się wygenerować')
                              );
                            }
                          }
                        )}
                        {pRow.status !== 'APPROVED' &&
                          primaryPill(t('finance.actions.approve', 'Zatwierdź'), async () => {
                            try {
                              await Api.post(`/api/economics/budgets/${rawId}/approve`, {});
                              await loadBudgets();
                              toast.success(
                                t('finance.toast.budgetApproved', 'Budżet zatwierdzony')
                              );
                            } catch (e: any) {
                              toast.error(
                                e?.response?.data?.error ||
                                  t('finance.toast.approveFailed', 'Nie udało się zatwierdzić')
                              );
                            }
                          })}
                      </>
                    );
                  }
                  return primaryPill(t('finance.actions.compute', 'Przelicz'), async () => {
                    try {
                      await Api.post(`/api/financial-modeling/models/${row.id}/compute`, {});
                      await loadPredictionPreview(row.id);
                      toast.success(t('finance.toast.computed', 'Prognoza przeliczona'));
                    } catch (e: any) {
                      toast.error(
                        e?.response?.data?.error ||
                          t('finance.toast.computeFailed', 'Nie udało się przeliczyć')
                      );
                    }
                  });
                })()}
              {row.kind === 'valuation' && (
                <>
                  {primaryPill(t('finance.actions.computeDcf', 'Oblicz DCF'), async () => {
                    try {
                      await Api.post(`/api/economics/valuations/${row.id}/compute`, {});
                      await loadValuations();
                      await loadValuationPreviewResults(row.id);
                      toast.success(t('finance.toast.valuationComputed', 'Wycena obliczona'));
                    } catch (e: any) {
                      toast.error(
                        e?.response?.data?.error ||
                          t('finance.toast.computeFailed', 'Nie udało się obliczyć')
                      );
                    }
                  })}
                  {row.status !== 'APPROVED' &&
                    primaryPill(t('finance.actions.approve', 'Zatwierdź'), async () => {
                      try {
                        await Api.post(`/api/economics/valuations/${row.id}/approve`, {});
                        await loadValuations();
                        toast.success(t('finance.toast.valuationApproved', 'Wycena zatwierdzona'));
                      } catch (e: any) {
                        toast.error(
                          e?.response?.data?.error ||
                            t('finance.toast.approveFailed', 'Nie udało się zatwierdzić')
                        );
                      }
                    })}
                  {secondaryPill(t('finance.actions.exportPptx', 'Eksportuj PPTX'), async () => {
                    try {
                      const result = await Api.post(
                        `/api/economics/valuations/${row.id}/export/pptx`,
                        {
                          language: isPl ? 'pl' : 'en',
                          theme: 'corporate',
                          confidentiality: 'confidential',
                        }
                      );
                      toast.success(t('finance.toast.pptxExported', 'PPTX wygenerowany'));
                      const downloadUrl = (result as any)?.downloadUrl;
                      if (downloadUrl) window.open(downloadUrl, '_blank');
                    } catch (e: any) {
                      toast.error(
                        e?.response?.data?.error ||
                          t('finance.toast.exportFailed', 'Nie udało się wyeksportować')
                      );
                    }
                  })}
                </>
              )}
              {row.kind !== 'prediction' || (row as FinanceModelRow).predictionType === 'model'
                ? secondaryPill(t('finance.actions.export', 'Eksportuj'), () => handleExport(row))
                : null}
              {secondaryPill(t('common.open', 'Otwórz'), () => handleOpenFull(row))}
            </div>
          </div>
        </div>
      );
    },
    [
      t,
      isPl,
      handleOpenFull,
      handleExport,
      loadModels,
      loadPredictionPreview,
      loadAnalyses,
      loadAnalysisPreviewRatios,
      loadBudgetPreviewScenarios,
      loadBudgets,
      getBudgetRawId,
      loadValuations,
      loadValuationPreviewResults,
    ]
  );

  return { renderPreviewBody, renderPreviewFooter };
}
