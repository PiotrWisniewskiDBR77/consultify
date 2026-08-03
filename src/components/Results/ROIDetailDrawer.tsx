/**
 * ROIDetailDrawer — V3-H02
 * Side drawer for a single initiative's ROI tracking
 * Plan vs Realized chart, assumptions panel, realized entry form, history table
 */

import { BarChart3, Calendar, DollarSign, Lock, Plus, TrendingUp, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isFinanceFlagEnabled } from '@/components/Economics/financeFeatureFlags';
import { Api } from '@/services/api';
import {
  shouldFallbackToLegacyResults,
  V8ResultsApi,
  type V8ResultsRoiInitiativeDetail,
} from '@/services/api/v8/results';

import { PostInvestmentActualForm } from './PostInvestmentActualForm';
import { PostInvestmentReviewPanel } from './PostInvestmentReviewPanel';
import type { ROILockState } from './ROIAnalysisView';
import { ROIAssumptionEditor, ROIAssumptionsData } from './ROIAssumptionEditor';

interface ROIDetailDrawerProps {
  initiativeId: string;
  initiativeName: string;
  onClose: () => void;
  onSaved?: () => void;
  /** When `locked` or `approved`, assumptions and realized entries are read-only. */
  lockState?: ROILockState;
}

interface VarianceData {
  hasAssumptions: boolean;
  projected?: { totalBenefit: number; revenueDelta?: number; costDelta?: number };
  realized?: { totalBenefit: number; dataPoints: number };
  variance?: {
    absolute: number;
    percent: number;
    status: 'on_track' | 'below_plan' | 'above_plan';
  };
}

interface RealizedEntry {
  id: string;
  period_month: string;
  realized_revenue_delta?: number;
  realized_cost_delta?: number;
  realized_savings?: number;
  variance_notes?: string;
  recorded_by?: string;
  created_at?: string;
}

function normalizeVarianceData(
  variance: V8ResultsRoiInitiativeDetail['variance'] | VarianceData | null | undefined
): VarianceData | null {
  if (!variance) return null;

  return {
    hasAssumptions: variance.hasAssumptions,
    projected: variance.projected
      ? {
          totalBenefit: variance.projected.totalBenefit,
          revenueDelta: variance.projected.revenueDelta ?? undefined,
          costDelta: variance.projected.costDelta ?? undefined,
        }
      : undefined,
    realized: variance.realized
      ? {
          totalBenefit: variance.realized.totalBenefit,
          dataPoints: variance.realized.dataPoints,
        }
      : undefined,
    variance: variance.variance ?? undefined,
  };
}

export const ROIDetailDrawer: React.FC<ROIDetailDrawerProps> = ({
  initiativeId,
  initiativeName,
  onClose,
  onSaved,
  lockState = 'open',
}) => {
  const { t } = useTranslation();
  const readOnly = lockState !== 'open';
  const [varianceData, setVarianceData] = useState<VarianceData | null>(null);
  const [assumptions, setAssumptions] = useState<ROIAssumptionsData | null>(null);
  const [realized, setRealized] = useState<RealizedEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [newPeriod, setNewPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [newAmount, setNewAmount] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // FIN-007: bumped after a post-investment review is created so the
  // read-only panel below refetches — it has no other way to learn a new
  // review exists (no shared cache, no websocket push).
  const [postInvestmentRefreshNonce, setPostInvestmentRefreshNonce] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      try {
        const detail = await V8ResultsApi.getRoiInitiativeDetail(initiativeId);
        setVarianceData(normalizeVarianceData(detail.variance));
        setAssumptions(
          detail.assumptions
            ? {
                expectedRevenueDelta: detail.assumptions.expectedRevenueDelta ?? undefined,
                expectedCostDelta: detail.assumptions.expectedCostDelta ?? undefined,
                capex: detail.assumptions.capex ?? undefined,
                opexAnnual: detail.assumptions.opexAnnual ?? undefined,
                horizonMonths: detail.assumptions.horizonMonths ?? undefined,
                effectStartDate: detail.assumptions.effectStartDate ?? undefined,
                confidence:
                  (detail.assumptions.confidence as ROIAssumptionsData['confidence']) ?? undefined,
                assumptionsOwner: detail.assumptions.assumptionsOwner ?? undefined,
                assumptionsText: detail.assumptions.assumptionsText ?? undefined,
              }
            : null
        );
        setRealized(
          (detail.realized || []).map((entry) => ({
            id: entry.id,
            period_month: entry.periodMonth,
            realized_revenue_delta: entry.realizedRevenueDelta ?? undefined,
            realized_cost_delta: entry.realizedCostDelta ?? undefined,
            realized_savings: entry.realizedSavings ?? undefined,
            variance_notes: entry.varianceNotes ?? undefined,
            recorded_by: entry.recordedBy ?? undefined,
            created_at: entry.createdAt ?? undefined,
          }))
        );
      } catch (error) {
        if (!shouldFallbackToLegacyResults(error)) {
          throw error;
        }
        const [varRes, assRes, realRes] = await Promise.all([
          Api.get(`/benefits/roi/${initiativeId}/variance`),
          Api.get(`/benefits/roi/${initiativeId}/assumptions`),
          Api.get(`/benefits/roi/${initiativeId}/realized`),
        ]);

        const varPayload = (varRes as any)?.data ?? varRes;
        setVarianceData(normalizeVarianceData(varPayload));

        const assPayload = (assRes as any)?.data ?? assRes;
        if (assPayload) {
          setAssumptions({
            expectedRevenueDelta: assPayload.expected_revenue_delta,
            expectedCostDelta: assPayload.expected_cost_delta,
            capex: assPayload.capex,
            opexAnnual: assPayload.opex_annual,
            horizonMonths: assPayload.horizon_months,
            effectStartDate: assPayload.effect_start_date,
            confidence: assPayload.confidence,
            assumptionsOwner: assPayload.assumptions_owner,
          });
        } else {
          setAssumptions(null);
        }

        const realPayload = (realRes as any)?.data ?? realRes;
        setRealized(Array.isArray(realPayload) ? realPayload : []);
      }
    } catch {
      setVarianceData(null);
      setAssumptions(null);
      setRealized([]);
    } finally {
      setLoading(false);
    }
  }, [initiativeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveAssumptions = useCallback(async () => {
    try {
      const payload = {
        expectedRevenueDelta: assumptions?.expectedRevenueDelta,
        expectedCostDelta: assumptions?.expectedCostDelta,
        capex: assumptions?.capex,
        opexAnnual: assumptions?.opexAnnual,
        horizonMonths: assumptions?.horizonMonths ?? 36,
        effectStartDate: assumptions?.effectStartDate,
        confidence: assumptions?.confidence ?? 'medium',
        assumptionsOwner: assumptions?.assumptionsOwner,
        assumptionsText: assumptions?.assumptionsText,
      };
      try {
        await V8ResultsApi.updateRoiInitiativeAssumptions(initiativeId, payload);
      } catch (error) {
        if (!shouldFallbackToLegacyResults(error)) {
          throw error;
        }
        await Api.put(`/benefits/roi/${initiativeId}/assumptions`, payload);
      }
      fetchData();
      onSaved?.();
    } catch {
      // silent
    }
  }, [initiativeId, assumptions, fetchData, onSaved]);

  const handleRecordRealized = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const amount = parseFloat(newAmount);
      if (isNaN(amount)) return;
      setSubmitting(true);
      try {
        const payload = {
          periodMonth: `${newPeriod}-01`,
          realizedSavings: amount,
          varianceNotes: newNotes.trim() || undefined,
          source: 'manual',
        };
        try {
          await V8ResultsApi.createRoiInitiativeRealizedEntry(initiativeId, payload);
        } catch (error) {
          if (!shouldFallbackToLegacyResults(error)) {
            throw error;
          }
          await Api.post(`/benefits/roi/${initiativeId}/realized`, payload);
        }
        setNewAmount('');
        setNewNotes('');
        fetchData();
        onSaved?.();
      } catch {
        // silent
      } finally {
        setSubmitting(false);
      }
    },
    [initiativeId, newPeriod, newAmount, newNotes, fetchData, onSaved]
  );

  const chartData = useMemo(() => {
    const plannedTotal = varianceData?.projected?.totalBenefit ?? 0;
    const monthlyPlan = plannedTotal / 12;
    const entries = [...realized].sort(
      (a, b) => new Date(a.period_month).getTime() - new Date(b.period_month).getTime()
    );
    return entries.slice(-12).map((e) => {
      const realizedVal =
        (e.realized_revenue_delta || 0) + (e.realized_cost_delta || 0) + (e.realized_savings || 0);
      return {
        period: e.period_month,
        plan: monthlyPlan,
        realized: realizedVal,
        isAbove: realizedVal >= monthlyPlan,
      };
    });
  }, [varianceData, realized]);

  const maxVal = useMemo(() => {
    if (chartData.length === 0) return 100;
    const max = Math.max(
      ...chartData.flatMap((d) => [d.plan, d.realized]),
      varianceData?.projected?.totalBenefit || 0
    );
    return max * 1.2 || 100;
  }, [chartData, varianceData]);

  const statusInfo = varianceData?.variance?.status ?? 'on_track';
  const statusCls =
    statusInfo === 'above_plan'
      ? 'bg-emerald-500/10 text-emerald-400'
      : statusInfo === 'below_plan'
        ? 'bg-danger-500/10 text-danger-400'
        : 'bg-slate-500/10 text-slate-600';

  const inputCls =
    'h-9 px-3 text-sm rounded-lg border border-navy-600 bg-navy-800 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid transition-colors w-full';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-navy-950/40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-navy-900 border-l border-navy-700 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-navy-700 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-primary-500/10">
              <DollarSign size={18} className="text-primary-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white truncate">
                {initiativeName || t('common.loading', 'Loading...')}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusCls}`}
                >
                  {statusInfo === 'above_plan'
                    ? t('results.roi.statusAbove', 'Above plan')
                    : statusInfo === 'below_plan'
                      ? t('results.roi.statusBelow', 'Below plan')
                      : t('results.roi.statusOnTrack', 'On track')}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-navy-700 text-slate-500 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-600">
              <BarChart3 size={20} className="animate-pulse mr-2" />
              {t('common.loading', 'Loading...')}
            </div>
          ) : (
            <div className="p-5 space-y-6">
              {readOnly && (
                <div className="rounded-lg border border-navy-700 bg-navy-800 px-3 py-2 flex items-center gap-2 text-xs text-slate-600">
                  <Lock size={14} className="text-slate-600 shrink-0" />
                  <span>
                    {lockState === 'approved'
                      ? t(
                          'results.roiAnalysis.approvedHint',
                          'Assumptions approved — editing is restricted'
                        )
                      : t(
                          'results.roiAnalysis.lockedHint',
                          'Assumptions are finalized and locked for editing'
                        )}
                  </span>
                </div>
              )}
              {/* Comparison chart */}
              <div>
                <h3 className="text-xs font-medium text-slate-500 uppercase mb-3 flex items-center gap-2">
                  <BarChart3 size={14} />
                  {t('results.roi.chartTitle', 'Plan vs Realized per Period')}
                </h3>
                {chartData.length > 0 ? (
                  <>
                    {/* Grouped bars: plan and realized sit side-by-side per period
                        (previously stacked in a flex-col, which collapsed the chart).
                        Heights are % of the shared maxVal so both series are
                        comparable; series colors use c-tag tokens (H2.6). */}
                    <div className="relative h-40 flex items-end gap-1.5">
                      {chartData.map((d) => {
                        const planPct = (d.plan / maxVal) * 100;
                        const realPct = (d.realized / maxVal) * 100;
                        return (
                          <div
                            key={d.period}
                            className="flex-1 min-w-[20px] h-full flex flex-col items-center justify-end gap-0.5"
                            title={`${d.period}: Plan ${d.plan.toFixed(0)} / Realized ${d.realized.toFixed(0)}`}
                          >
                            <div className="w-full h-full flex items-end justify-center gap-0.5">
                              <div
                                className="w-1/2 rounded-t transition-all"
                                style={{
                                  height: `${Math.max(planPct, 2)}%`,
                                  backgroundColor: 'var(--c-tag-1)',
                                }}
                              />
                              <div
                                className="w-1/2 rounded-t transition-all"
                                style={{
                                  height: `${Math.max(realPct, 2)}%`,
                                  backgroundColor: d.isAbove ? 'var(--c-tag-12)' : 'var(--c-tag-4)',
                                }}
                              />
                            </div>
                            <span className="text-[9px] text-slate-500 dark:text-c-text-muted truncate max-w-full">
                              {d.period.slice(0, 7)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {/* Legend */}
                    <div className="mt-2 flex items-center gap-4 text-[10px] text-slate-500 dark:text-c-text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-sm"
                          style={{ backgroundColor: 'var(--c-tag-1)' }}
                        />
                        {t('results.roi.legendPlan', 'Plan')}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-sm"
                          style={{ backgroundColor: 'var(--c-tag-12)' }}
                        />
                        {t('results.roi.legendRealized', 'Realized')}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="h-40 flex items-center justify-center text-sm text-slate-500 dark:text-c-text-muted bg-slate-50 dark:bg-c-surface-raised rounded-lg border border-slate-200 dark:border-c-border">
                    {t('results.roi.noRealizedData', 'No realized data yet')}
                  </div>
                )}
              </div>

              {/* Assumptions panel */}
              <div>
                <ROIAssumptionEditor
                  data={assumptions}
                  onChange={readOnly ? () => {} : setAssumptions}
                  onSave={readOnly ? async () => {} : handleSaveAssumptions}
                />
              </div>

              {/* Realized entry form */}
              {!readOnly && (
                <div>
                  <h3 className="text-xs font-medium text-slate-500 uppercase mb-3 flex items-center gap-2">
                    <Plus size={14} />
                    {t('results.roi.recordActual', 'Record Actual')}
                  </h3>
                  <form onSubmit={handleRecordRealized} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">
                          {t('results.roi.period', 'Period')}
                        </label>
                        <input
                          className={inputCls}
                          type="month"
                          value={newPeriod}
                          onChange={(e) => setNewPeriod(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">
                          {t('results.roi.amount', 'Amount')}
                        </label>
                        <input
                          className={inputCls}
                          type="number"
                          step="any"
                          value={newAmount}
                          onChange={(e) => setNewAmount(e.target.value)}
                          placeholder="0"
                          required
                        />
                      </div>
                    </div>
                    <input
                      className={inputCls}
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      placeholder={t('results.roi.notesPlaceholder', 'Notes (optional)')}
                    />
                    <button
                      type="submit"
                      disabled={!newAmount || submitting}
                      className="w-full h-9 text-sm font-medium rounded-full bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {submitting
                        ? t('common.saving', 'Saving...')
                        : t('results.roi.submit', 'Submit')}
                    </button>
                  </form>
                </div>
              )}

              {/* History table */}
              <div>
                <h3 className="text-xs font-medium text-slate-500 uppercase mb-3 flex items-center gap-2">
                  <Calendar size={14} />
                  {t('results.roi.history', 'History')}
                  {realized.length > 0 && (
                    <span className="text-slate-600">({realized.length})</span>
                  )}
                </h3>
                {realized.length > 0 ? (
                  <div className="border border-navy-700 rounded-lg overflow-hidden">
                    {/* §27-exempt: financial-calculation — per-row planned/variance computed from projectedBenefit/12; rendered inside a narrow side-drawer at fixed width */}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-navy-800">
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                            {t('results.roi.historyPeriod', 'Period')}
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                            {t('results.roi.historyPlanned', 'Planned')}
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                            {t('results.roi.historyRealized', 'Realized')}
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                            {t('results.roi.historyVariance', 'Variance')}
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                            {t('results.roi.historyNotes', 'Notes')}
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                            {t('results.roi.historyBy', 'By')}
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                            {t('results.roi.historyDate', 'Date')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-navy-700/50">
                        {[...realized]
                          .sort(
                            (a, b) =>
                              new Date(b.period_month).getTime() -
                              new Date(a.period_month).getTime()
                          )
                          .map((r) => {
                            const realizedVal =
                              (r.realized_revenue_delta || 0) +
                              (r.realized_cost_delta || 0) +
                              (r.realized_savings || 0);
                            const planned = (varianceData?.projected?.totalBenefit || 0) / 12;
                            const varAmt = realizedVal - planned;
                            const varColor =
                              varAmt > 0
                                ? 'text-emerald-400'
                                : varAmt < 0
                                  ? 'text-danger-400'
                                  : 'text-slate-600';
                            return (
                              <tr key={r.id} className="hover:bg-navy-800/30">
                                <td className="px-3 py-2 text-slate-600">
                                  {r.period_month?.slice(0, 7) || '—'}
                                </td>
                                <td className="px-3 py-2 text-right text-slate-600">
                                  {planned.toLocaleString(undefined, {
                                    style: 'currency',
                                    currency: 'EUR',
                                    maximumFractionDigits: 0,
                                  })}
                                </td>
                                <td className="px-3 py-2 text-right font-medium text-slate-600">
                                  {realizedVal.toLocaleString(undefined, {
                                    style: 'currency',
                                    currency: 'EUR',
                                    maximumFractionDigits: 0,
                                  })}
                                </td>
                                <td className={`px-3 py-2 text-right font-medium ${varColor}`}>
                                  {varAmt >= 0 ? '+' : ''}
                                  {varAmt.toLocaleString(undefined, {
                                    style: 'currency',
                                    currency: 'EUR',
                                    maximumFractionDigits: 0,
                                  })}
                                </td>
                                <td className="px-3 py-2 text-slate-500 truncate max-w-[80px]">
                                  {r.variance_notes || '—'}
                                </td>
                                <td className="px-3 py-2 text-slate-500 text-xs">
                                  {r.recorded_by || '—'}
                                </td>
                                <td className="px-3 py-2 text-slate-500 text-xs">
                                  {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-6">
                    {t('results.roi.noHistory', 'No history yet')}
                  </p>
                )}
              </div>

              {/* FIN-007: record a baseline-bound actual + create/read the
                  durable post-investment review — approved Finance baseline
                  vs. Execution-recorded actual(s), reconciled and persisted.
                  Behind `fin007PostInvestmentReview` (default OFF, CLAUDE.md
                  §7) until Piotr accepts a clean dev-render screenshot. */}
              {isFinanceFlagEnabled('fin007PostInvestmentReview') && (
                <div className="mt-4 space-y-4">
                  <PostInvestmentActualForm
                    initiativeId={initiativeId}
                    onReviewCreated={() => setPostInvestmentRefreshNonce((n) => n + 1)}
                  />
                  <PostInvestmentReviewPanel
                    initiativeId={initiativeId}
                    refreshNonce={postInvestmentRefreshNonce}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ROIDetailDrawer;
