/**
 * Financial Metrics Panel
 *
 * Displays calculated financial metrics (NPV, IRR, Payback Period, ROI)
 * with visual indicators and explanations.
 */

import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle,
  Clock,
  DollarSign,
  Info,
  Minus,
  Percent,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import React from 'react';

interface FinancialMetrics {
  npv: number | null;
  irr: number | null;
  paybackPeriod: number | null;
  roi: number | null;
  totalCosts: number;
  totalBenefits: number;
  netBenefit: number;
}

interface FinancialMetricsPanelProps {
  metrics: FinancialMetrics;
  currency?: string;
  discountRate?: number;
  horizon?: number;
  isLoading?: boolean;
}

export const FinancialMetricsPanel: React.FC<FinancialMetricsPanelProps> = ({
  metrics,
  currency = 'PLN',
  discountRate = 10,
  horizon = 5,
  isLoading = false,
}) => {
  const formatCurrency = (value: number | null) => {
    if (value === null) return '—';
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number | null) => {
    if (value === null) return '—';
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatYears = (value: number | null) => {
    if (value === null) return '—';
    const years = Math.floor(value);
    const months = Math.round((value - years) * 12);
    if (years === 0) return `${months} mies.`;
    if (months === 0) return `${years} ${years === 1 ? 'rok' : years < 5 ? 'lata' : 'lat'}`;
    return `${years} ${years === 1 ? 'rok' : years < 5 ? 'lata' : 'lat'} ${months} mies.`;
  };

  const getMetricStatus = (
    metricType: string,
    value: number | null
  ): 'positive' | 'negative' | 'neutral' => {
    if (value === null) return 'neutral';

    switch (metricType) {
      case 'npv':
        return value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral';
      case 'irr':
        return value > discountRate / 100
          ? 'positive'
          : value < discountRate / 100
            ? 'negative'
            : 'neutral';
      case 'payback':
        return value <= horizon * 0.5 ? 'positive' : value > horizon ? 'negative' : 'neutral';
      case 'roi':
        return value > 0.2 ? 'positive' : value < 0 ? 'negative' : 'neutral';
      default:
        return 'neutral';
    }
  };

  const statusColors = {
    positive: {
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      border: 'border-emerald-200 dark:border-emerald-500/30',
      text: 'text-emerald-600 dark:text-emerald-400',
      icon: CheckCircle,
    },
    negative: {
      bg: 'bg-red-50 dark:bg-red-500/10',
      border: 'border-red-200 dark:border-red-500/30',
      text: 'text-red-600 dark:text-red-400',
      icon: AlertCircle,
    },
    neutral: {
      bg: 'bg-slate-50 dark:bg-slate-500/10',
      border: 'border-slate-200 dark:border-navy-700',
      text: 'text-slate-600 dark:text-slate-400',
      icon: Info,
    },
  };

  const MetricCard: React.FC<{
    title: string;
    value: string;
    subtitle: string;
    status: 'positive' | 'negative' | 'neutral';
    icon: React.ReactNode;
    tooltip?: string;
  }> = ({ title, value, subtitle, status, icon, tooltip }) => {
    const colors = statusColors[status];
    const StatusIcon = colors.icon;

    return (
      <div
        className={`relative p-4 rounded-xl border ${colors.bg} ${colors.border} transition-all hover:shadow-md group`}
        title={tooltip}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${status === 'positive' ? 'bg-emerald-500/20' : status === 'negative' ? 'bg-red-500/20' : 'bg-slate-50 dark:bg-navy-800/300/20'}`}
          >
            {icon}
          </div>
          <StatusIcon size={20} className={colors.text} />
        </div>

        {/* Value */}
        <div className="mb-1">
          <span
            className={`text-2xl font-bold ${status === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : status === 'negative' ? 'text-red-600 dark:text-red-400' : 'text-navy-900 dark:text-white'}`}
          >
            {isLoading ? (
              <span className="inline-block w-20 h-8 bg-slate-200 dark:bg-white/10 animate-pulse rounded" />
            ) : (
              value
            )}
          </span>
        </div>

        {/* Title & Subtitle */}
        <h4 className="text-sm font-semibold text-navy-900 dark:text-white">{title}</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
      </div>
    );
  };

  const npvStatus = getMetricStatus('npv', metrics.npv);
  const irrStatus = getMetricStatus('irr', metrics.irr);
  const paybackStatus = getMetricStatus('payback', metrics.paybackPeriod);
  const roiStatus = getMetricStatus('roi', metrics.roi);

  return (
    <div className="space-y-6">
      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="NPV (Wartość obecna netto)"
          value={formatCurrency(metrics.npv)}
          subtitle={`przy stopie ${discountRate}%`}
          status={npvStatus}
          icon={<DollarSign size={20} className={statusColors[npvStatus].text} />}
          tooltip="Net Present Value - suma zdyskontowanych przepływów pieniężnych"
        />

        <MetricCard
          title="IRR (Wewn. stopa zwrotu)"
          value={formatPercent(metrics.irr)}
          subtitle={
            metrics.irr && metrics.irr > discountRate / 100
              ? 'powyżej progu rentowności'
              : 'poniżej progu rentowności'
          }
          status={irrStatus}
          icon={<Percent size={20} className={statusColors[irrStatus].text} />}
          tooltip="Internal Rate of Return - stopa dyskontowa przy której NPV = 0"
        />

        <MetricCard
          title="Okres zwrotu"
          value={formatYears(metrics.paybackPeriod)}
          subtitle={
            metrics.paybackPeriod && metrics.paybackPeriod <= horizon
              ? 'w horyzoncie inwestycji'
              : 'poza horyzontem'
          }
          status={paybackStatus}
          icon={<Clock size={20} className={statusColors[paybackStatus].text} />}
          tooltip="Czas potrzebny do odzyskania początkowej inwestycji"
        />

        <MetricCard
          title="ROI (Zwrot z inwestycji)"
          value={formatPercent(metrics.roi)}
          subtitle={metrics.roi && metrics.roi > 0 ? 'zysk na inwestycji' : 'strata na inwestycji'}
          status={roiStatus}
          icon={<TrendingUp size={20} className={statusColors[roiStatus].text} />}
          tooltip="Return on Investment - stosunek zysku do kosztów inwestycji"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          title="Łączne koszty"
          value={formatCurrency(metrics.totalCosts)}
          icon={<ArrowDownRight size={18} className="text-red-500" />}
          color="red"
          isLoading={isLoading}
        />
        <SummaryCard
          title="Łączne korzyści"
          value={formatCurrency(metrics.totalBenefits)}
          icon={<ArrowUpRight size={18} className="text-emerald-500" />}
          color="green"
          isLoading={isLoading}
        />
        <SummaryCard
          title="Korzyść netto"
          value={formatCurrency(metrics.netBenefit)}
          icon={
            metrics.netBenefit >= 0 ? (
              <TrendingUp size={18} className="text-blue-500" />
            ) : (
              <TrendingDown size={18} className="text-orange-500" />
            )
          }
          color={metrics.netBenefit >= 0 ? 'blue' : 'orange'}
          isLoading={isLoading}
        />
      </div>

      {/* Investment Decision Indicator */}
      <InvestmentDecisionCard
        npv={metrics.npv}
        irr={metrics.irr}
        roi={metrics.roi}
        payback={metrics.paybackPeriod}
        discountRate={discountRate}
        horizon={horizon}
      />
    </div>
  );
};

const SummaryCard: React.FC<{
  title: string;
  value: string;
  icon: React.ReactNode;
  color: 'red' | 'green' | 'blue' | 'orange';
  isLoading?: boolean;
}> = ({ title, value, icon, color, isLoading }) => {
  const colorMap = {
    red: 'bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20',
    green: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20',
    blue: 'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20',
    orange: 'bg-orange-50 dark:bg-orange-500/10 border-orange-100 dark:border-orange-500/20',
  };

  return (
    <div className={`p-4 rounded-xl border ${colorMap[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{title}</p>
          {isLoading ? (
            <div className="w-24 h-6 bg-slate-200 dark:bg-white/10 animate-pulse rounded" />
          ) : (
            <p className="text-lg font-bold text-navy-900 dark:text-white">{value}</p>
          )}
        </div>
        {icon}
      </div>
    </div>
  );
};

const InvestmentDecisionCard: React.FC<{
  npv: number | null;
  irr: number | null;
  roi: number | null;
  payback: number | null;
  discountRate: number;
  horizon: number;
}> = ({ npv, irr, roi, payback, discountRate, horizon }) => {
  // Calculate investment recommendation score
  let score = 0;
  let maxScore = 0;
  const criteria: Array<{ met: boolean | null; label: string }> = [];

  // NPV > 0
  if (npv !== null) {
    maxScore++;
    if (npv > 0) score++;
    criteria.push({ met: npv > 0, label: 'NPV dodatni' });
  }

  // IRR > discount rate
  if (irr !== null) {
    maxScore++;
    if (irr > discountRate / 100) score++;
    criteria.push({ met: irr > discountRate / 100, label: 'IRR > stopy dyskontowej' });
  }

  // ROI > 20%
  if (roi !== null) {
    maxScore++;
    if (roi > 0.2) score++;
    criteria.push({ met: roi > 0.2, label: 'ROI > 20%' });
  }

  // Payback within horizon
  if (payback !== null) {
    maxScore++;
    if (payback <= horizon) score++;
    criteria.push({ met: payback <= horizon, label: 'Zwrot w horyzoncie' });
  }

  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;

  let recommendation: 'strong' | 'moderate' | 'weak' | 'negative';
  let recommendationText: string;
  let recommendationColor: string;

  if (percentage >= 75) {
    recommendation = 'strong';
    recommendationText = 'Silna rekomendacja inwestycyjna';
    recommendationColor = 'bg-gradient-to-r from-emerald-500 to-teal-500';
  } else if (percentage >= 50) {
    recommendation = 'moderate';
    recommendationText = 'Umiarkowana rekomendacja';
    recommendationColor = 'bg-gradient-to-r from-blue-500 to-cyan-500';
  } else if (percentage >= 25) {
    recommendation = 'weak';
    recommendationText = 'Słaba rekomendacja - wymaga analizy ryzyka';
    recommendationColor = 'bg-gradient-to-r from-yellow-500 to-orange-500';
  } else {
    recommendation = 'negative';
    recommendationText = 'Nie rekomendowane - negatywne wskaźniki';
    recommendationColor = 'bg-gradient-to-r from-red-500 to-rose-500';
  }

  if (maxScore === 0) {
    return (
      <div className="p-6 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl">
        <div className="text-center text-slate-500 dark:text-slate-400">
          <Info size={24} className="mx-auto mb-2" />
          <p>Wprowadź dane finansowe, aby zobaczyć rekomendację inwestycyjną</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className={`${recommendationColor} p-6 text-white`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold mb-1">Decyzja inwestycyjna</h3>
            <p className="text-white/80 text-sm">{recommendationText}</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold">{Math.round(percentage)}%</div>
            <div className="text-sm text-white/80">zgodności kryteriów</div>
          </div>
        </div>
      </div>

      {/* Criteria */}
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {criteria.map((criterion, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg ${
                criterion.met
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30'
                  : 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30'
              }`}
            >
              <div className="flex items-center gap-2">
                {criterion.met ? (
                  <CheckCircle size={16} className="text-emerald-500" />
                ) : (
                  <AlertCircle size={16} className="text-red-500" />
                )}
                <span
                  className={`text-xs font-medium ${criterion.met ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}
                >
                  {criterion.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FinancialMetricsPanel;
