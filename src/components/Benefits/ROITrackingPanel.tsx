/**
 * ROI Tracking Panel (T046)
 * Projected vs realized ROI with assumptions and variance signals.
 */

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  DollarSign,
  Edit3,
  Loader2,
  Minus,
  Save,
  TrendingUp,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

interface ROIAssumptions {
  capex: number;
  opex_annual: number;
  expected_roi_percent: number | null;
  expected_npv: number | null;
  expected_payback_months: number | null;
  horizon_months: number;
  baseline_revenue: number | null;
  baseline_cost: number | null;
  expected_revenue_delta: number | null;
  expected_cost_delta: number | null;
  effect_start_date: string | null;
  assumptions_text: string | null;
  assumptions_owner: string | null;
  confidence: string;
}

interface VarianceData {
  hasAssumptions: boolean;
  projected: {
    revenueDelta: number;
    costDelta: number;
    totalBenefit: number;
    capex: number;
    opexAnnual: number;
    roiPercent: number | null;
    npv: number | null;
    paybackMonths: number | null;
    horizonMonths: number;
    confidence: string;
  };
  realized: {
    revenueDelta: number;
    costDelta: number;
    savings: number;
    totalBenefit: number;
    dataPoints: number;
  };
  variance: {
    absolute: number;
    percent: number;
    status: 'above_plan' | 'on_track' | 'below_plan';
  };
}

interface PortfolioItem {
  initiativeId: string;
  initiativeName: string;
  status: string;
  priority: string;
  capex: number;
  opexAnnual: number;
  projectedBenefit: number;
  realizedBenefit: number;
  variance: number;
  confidence: string;
  hasRealized: boolean;
}

interface PortfolioSummary {
  items: PortfolioItem[];
  summary: {
    totalProjected: number;
    totalRealized: number;
    totalCapex: number;
    totalVariance: number;
    initiativeCount: number;
    coveragePercent: number;
  };
}

export const ROITrackingPanel: React.FC = () => {
  const { t } = useTranslation();
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trackFunnelEvent('roi_variance_viewed', {});
    loadPortfolio();
  }, []);

  const loadPortfolio = async () => {
    setLoading(true);
    try {
      const res = await Api.get('/benefits/roi/portfolio/summary');
      setPortfolio(res.data);
    } catch (err) {
      console.error('[ROITrackingPanel] Failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const fmtCurrency = (val: number) => {
    if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
    return val.toFixed(0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!portfolio || portfolio.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-6">
        <DollarSign className="w-12 h-12 text-emerald-400/50 mb-3" />
        <p className="text-lg text-slate-900 dark:text-white">
          {t('benefits.roi.noData', 'No ROI Assumptions Yet')}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t(
            'benefits.roi.noDataHint',
            'Set ROI assumptions on initiatives to track projected vs realized returns.'
          )}
        </p>
      </div>
    );
  }

  const { summary, items } = portfolio;
  const varianceColor =
    summary.totalVariance > 0
      ? 'text-green-500'
      : summary.totalVariance < 0
        ? 'text-danger-500'
        : 'text-slate-600';

  return (
    <div className="p-6 space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<TrendingUp className="w-5 h-5 text-blue-400" />}
          label={t('benefits.roi.projected', 'Projected Benefit')}
          value={fmtCurrency(summary.totalProjected)}
          bg="bg-blue-500/10"
        />
        <SummaryCard
          icon={<CheckCircle2 className="w-5 h-5 text-green-400" />}
          label={t('benefits.roi.realized', 'Realized Benefit')}
          value={fmtCurrency(summary.totalRealized)}
          bg="bg-green-500/10"
        />
        <SummaryCard
          icon={<DollarSign className="w-5 h-5 text-amber-400" />}
          label={t('benefits.roi.totalCapex', 'Total CAPEX')}
          value={fmtCurrency(summary.totalCapex)}
          bg="bg-amber-500/10"
        />
        <div className="bg-slate-50 dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-500/10 rounded-lg">
              <BarChart3 className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('benefits.roi.coverage', 'Data Coverage')}
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {summary.coveragePercent}%
              </p>
              <p className="text-xs text-slate-600">
                {summary.initiativeCount} {t('benefits.roi.initiatives', 'initiatives')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Variance Signal */}
      {summary.totalRealized !== 0 && (
        <div
          className={`rounded-xl p-4 border ${summary.totalVariance >= 0 ? 'bg-green-500/5 border-green-500/20' : 'bg-danger-500/5 border-danger-500/20'}`}
        >
          <div className="flex items-center gap-3">
            {summary.totalVariance >= 0 ? (
              <ArrowUp className="w-5 h-5 text-green-500" />
            ) : (
              <ArrowDown className="w-5 h-5 text-danger-500" />
            )}
            <div>
              <p className={`font-semibold ${varianceColor}`}>
                {t('benefits.roi.variance', 'Portfolio Variance')}:{' '}
                {summary.totalVariance >= 0 ? '+' : ''}
                {fmtCurrency(summary.totalVariance)}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {summary.totalVariance >= 0
                  ? t('benefits.roi.abovePlan', 'Realized benefits exceed projections')
                  : t(
                      'benefits.roi.belowPlan',
                      'Realized benefits below projections — review assumptions'
                    )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Initiative ROI Table */}
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {t('benefits.roi.byInitiative', 'ROI by Initiative')}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table
            /* §27-exempt: layout specjalizowany/read-only/data-viz, nie kanoniczna lista przegladana */ className="w-full text-sm"
          >
            <thead className="bg-slate-50 dark:bg-navy-800 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2 text-left font-medium">
                  {t('benefits.roi.initiative', 'Initiative')}
                </th>
                <th className="px-4 py-2 text-right font-medium">CAPEX</th>
                <th className="px-4 py-2 text-right font-medium">
                  {t('benefits.roi.projected', 'Projected')}
                </th>
                <th className="px-4 py-2 text-right font-medium">
                  {t('benefits.roi.realized', 'Realized')}
                </th>
                <th className="px-4 py-2 text-right font-medium">
                  {t('benefits.roi.variance', 'Variance')}
                </th>
                <th className="px-4 py-2 text-center font-medium">
                  {t('benefits.roi.confidence', 'Conf.')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-navy-700">
              {items.map((item) => (
                <tr key={item.initiativeId} className="hover:bg-slate-50 dark:hover:bg-navy-800/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-white">
                      {item.initiativeName}
                    </div>
                    <div className="text-xs text-slate-600">
                      {item.status} · {item.priority}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                    {fmtCurrency(item.capex || 0)}
                  </td>
                  <td className="px-4 py-3 text-right text-blue-500">
                    {fmtCurrency(item.projectedBenefit)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {item.hasRealized ? (
                      <span className="text-green-500">{fmtCurrency(item.realizedBenefit)}</span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {item.hasRealized ? (
                      <span className={item.variance >= 0 ? 'text-green-500' : 'text-danger-500'}>
                        {item.variance >= 0 ? '+' : ''}
                        {fmtCurrency(item.variance)}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ConfidenceBadge level={item.confidence} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-slate-600 text-center italic">
        {t(
          'benefits.roi.disclaimer',
          'ROI figures are based on stated assumptions. Realized values may differ from projections due to external factors.'
        )}
      </p>
    </div>
  );
};

const SummaryCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  bg: string;
}> = ({ icon, label, value, bg }) => (
  <div className="bg-slate-50 dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
    <div className="flex items-center gap-3">
      <div className={`p-2 ${bg} rounded-lg`}>{icon}</div>
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      </div>
    </div>
  </div>
);

const ConfidenceBadge: React.FC<{ level: string }> = ({ level }) => {
  const colors: Record<string, string> = {
    high: 'bg-green-500/20 text-green-500',
    medium: 'bg-yellow-500/20 text-yellow-500',
    low: 'bg-danger-500/20 text-danger-500',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[level] || colors.low}`}>
      {level}
    </span>
  );
};

export default ROITrackingPanel;
