/**
 * ROIAnalysisView
 *
 * ROI Analysis view for the Benefits module.
 * Shows return on investment calculations, charts, and variance analysis.
 */

import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Calculator,
  DollarSign,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { FullInitiative, InitiativeStatus } from '../../types';

interface ROIAnalysisViewProps {
  initiatives: FullInitiative[];
  onInitiativeClick: (initiative: FullInitiative) => void;
}

// ============================================
// TYPES
// ============================================

interface ROIMetrics {
  initiativeId: string;
  initiativeName: string;
  status: InitiativeStatus;
  totalInvestment: number;
  realizedBenefits: number;
  projectedBenefits: number;
  roi: number;
  paybackPeriodMonths: number;
  variance: number;
  isPositive: boolean;
}

interface PortfolioSummary {
  totalInvestment: number;
  totalRealizedBenefits: number;
  totalProjectedBenefits: number;
  overallROI: number;
  averagePaybackMonths: number;
  initiativesOnTrack: number;
  initiativesBelowTarget: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}k`;
  }
  return value.toFixed(0);
};

const calculateROI = (benefits: number, investment: number): number => {
  if (investment <= 0) return 0;
  return ((benefits - investment) / investment) * 100;
};

const calculatePaybackPeriod = (investment: number, annualBenefit: number): number => {
  if (annualBenefit <= 0) return 0;
  return Math.ceil((investment / annualBenefit) * 12);
};

// ============================================
// SUMMARY CARD COMPONENT
// ============================================

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color: 'cyan' | 'green' | 'purple' | 'amber' | 'red';
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  color,
}) => {
  const colorClasses = {
    cyan: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
    purple: 'bg-primary-500/20 text-primary-400',
    amber: 'bg-amber-500/20 text-amber-400',
    red: 'bg-danger-500/20 text-danger-400',
  };

  return (
    <div className="bg-navy-800 rounded-xl p-5 border border-navy-700">
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-lg ${colorClasses[color]}`}>{icon}</div>
        {trend && trendValue && (
          <div
            className={`flex items-center gap-1 text-sm ${
              trend === 'up'
                ? 'text-green-400'
                : trend === 'down'
                  ? 'text-danger-400'
                  : 'text-slate-600'
            }`}
          >
            {trend === 'up' ? (
              <ArrowUp size={14} />
            ) : trend === 'down' ? (
              <ArrowDown size={14} />
            ) : null}
            {trendValue}
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-sm text-slate-600 mt-1">{title}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
};

// ============================================
// ROI BAR CHART COMPONENT
// ============================================

interface ROIBarChartProps {
  metrics: ROIMetrics[];
  onBarClick: (id: string) => void;
}

const ROIBarChart: React.FC<ROIBarChartProps> = ({ metrics, onBarClick }) => {
  const maxROI = Math.max(...metrics.map((m) => Math.abs(m.roi)), 100);

  return (
    <div className="space-y-3">
      {metrics.map((metric) => {
        const barWidth = (Math.abs(metric.roi) / maxROI) * 100;
        const isPositive = metric.roi >= 0;

        return (
          <button
            key={metric.initiativeId}
            onClick={() => onBarClick(metric.initiativeId)}
            className="w-full text-left group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-white truncate max-w-[60%] group-hover:text-blue-400 transition-colors">
                {metric.initiativeName}
              </span>
              <span
                className={`text-sm font-bold ${isPositive ? 'text-green-400' : 'text-danger-400'}`}
              >
                {isPositive ? '+' : ''}
                {metric.roi.toFixed(0)}%
              </span>
            </div>
            <div className="h-6 bg-navy-700 rounded-lg overflow-hidden relative">
              <div
                className={`h-full rounded-lg transition-all ${
                  isPositive ? 'bg-green-500/50' : 'bg-danger-500/50'
                } group-hover:opacity-80`}
                style={{ width: `${barWidth}%` }}
              />
              <div className="absolute inset-y-0 left-2 flex items-center">
                <span
                  className={`text-xs ${
                    metric.status === InitiativeStatus.CLOSED
                      ? 'text-green-400'
                      : metric.status === InitiativeStatus.IN_EXECUTION
                        ? 'text-danger-400'
                        : 'text-slate-600'
                  }`}
                >
                  {metric.status}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

// ============================================
// VARIANCE TABLE
// ============================================

interface VarianceTableProps {
  metrics: ROIMetrics[];
  onRowClick: (id: string) => void;
}

const VarianceTable: React.FC<VarianceTableProps> = ({ metrics, onRowClick }) => {
  const [sortBy, setSortBy] = useState<'variance' | 'investment' | 'roi'>('variance');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sortedMetrics = useMemo(() => {
    return [...metrics].sort((a, b) => {
      const getValue = (m: ROIMetrics): number => {
        if (sortBy === 'variance') return m.variance;
        if (sortBy === 'investment') return m.totalInvestment;
        return m.roi;
      };
      const aVal = getValue(a);
      const bVal = getValue(b);
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [metrics, sortBy, sortDir]);

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
  };

  return (
    <div className="overflow-x-auto">
      <table
        /* §27-exempt: layout specjalizowany/read-only/data-viz, nie kanoniczna lista przegladana */ className="w-full"
      >
        <thead>
          <tr className="text-left text-xs text-slate-600 border-b border-navy-700">
            <th className="pb-3 font-medium">Initiative</th>
            <th
              className="pb-3 font-medium cursor-pointer hover:text-white"
              onClick={() => handleSort('investment')}
            >
              Investment {sortBy === 'investment' && (sortDir === 'asc' ? '↑' : '↓')}
            </th>
            <th className="pb-3 font-medium">Realized</th>
            <th className="pb-3 font-medium">Projected</th>
            <th
              className="pb-3 font-medium cursor-pointer hover:text-white"
              onClick={() => handleSort('variance')}
            >
              Variance {sortBy === 'variance' && (sortDir === 'asc' ? '↑' : '↓')}
            </th>
            <th
              className="pb-3 font-medium cursor-pointer hover:text-white"
              onClick={() => handleSort('roi')}
            >
              ROI {sortBy === 'roi' && (sortDir === 'asc' ? '↑' : '↓')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedMetrics.map((metric) => (
            <tr
              key={metric.initiativeId}
              onClick={() => onRowClick(metric.initiativeId)}
              className="border-b border-navy-800 hover:bg-navy-800/50 cursor-pointer"
            >
              <td className="py-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      metric.status === InitiativeStatus.CLOSED
                        ? 'bg-green-400'
                        : metric.status === InitiativeStatus.IN_EXECUTION
                          ? 'bg-danger-400'
                          : 'bg-slate-400'
                    }`}
                  />
                  <span className="text-sm text-white truncate max-w-[200px]">
                    {metric.initiativeName}
                  </span>
                </div>
              </td>
              <td className="py-3 text-sm text-slate-600">
                {formatCurrency(metric.totalInvestment)} PLN
              </td>
              <td className="py-3 text-sm text-slate-600">
                {formatCurrency(metric.realizedBenefits)} PLN
              </td>
              <td className="py-3 text-sm text-slate-600">
                {formatCurrency(metric.projectedBenefits)} PLN
              </td>
              <td className="py-3">
                <div
                  className={`flex items-center gap-1 text-sm font-medium ${
                    metric.variance >= 0 ? 'text-green-400' : 'text-danger-400'
                  }`}
                >
                  {metric.variance >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {metric.variance >= 0 ? '+' : ''}
                  {metric.variance.toFixed(0)}%
                </div>
              </td>
              <td className="py-3">
                <span
                  className={`text-sm font-bold ${
                    metric.roi >= 0 ? 'text-green-400' : 'text-danger-400'
                  }`}
                >
                  {metric.roi >= 0 ? '+' : ''}
                  {metric.roi.toFixed(0)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ============================================
// MAIN ROI ANALYSIS VIEW
// ============================================

export const ROIAnalysisView: React.FC<ROIAnalysisViewProps> = ({
  initiatives,
  onInitiativeClick,
}) => {
  // Calculate ROI metrics for each initiative
  const roiMetrics = useMemo((): ROIMetrics[] => {
    return initiatives
      .filter((i) => i.status === InitiativeStatus.CLOSED || i.status === InitiativeStatus.IN_EXECUTION)
      .map((initiative) => {
        const totalInvestment = (initiative.costCapex || 0) + (initiative.costOpex || 0);
        const projectedBenefits =
          initiative.annualBenefit || initiative.estimatedAnnualBenefit || 0;

        const realizationRate = initiative.status === InitiativeStatus.CLOSED ? 0.85 : 0.4;
        const realizedBenefits = projectedBenefits * realizationRate;

        const roi = calculateROI(realizedBenefits, totalInvestment);
        const paybackPeriodMonths = calculatePaybackPeriod(totalInvestment, projectedBenefits);
        const variance =
          projectedBenefits > 0
            ? ((realizedBenefits - projectedBenefits) / projectedBenefits) * 100
            : 0;

        return {
          initiativeId: initiative.id,
          initiativeName: initiative.name,
          status: initiative.status,
          totalInvestment,
          realizedBenefits,
          projectedBenefits,
          roi,
          paybackPeriodMonths,
          variance,
          isPositive: roi >= 0,
        };
      })
      .sort((a, b) => b.roi - a.roi);
  }, [initiatives]);

  // Calculate portfolio summary
  const summary = useMemo((): PortfolioSummary => {
    const totalInvestment = roiMetrics.reduce((sum, m) => sum + m.totalInvestment, 0);
    const totalRealizedBenefits = roiMetrics.reduce((sum, m) => sum + m.realizedBenefits, 0);
    const totalProjectedBenefits = roiMetrics.reduce((sum, m) => sum + m.projectedBenefits, 0);
    const overallROI = calculateROI(totalRealizedBenefits, totalInvestment);

    const paybackPeriods = roiMetrics
      .filter((m) => m.paybackPeriodMonths > 0)
      .map((m) => m.paybackPeriodMonths);
    const averagePaybackMonths =
      paybackPeriods.length > 0
        ? paybackPeriods.reduce((a, b) => a + b, 0) / paybackPeriods.length
        : 0;

    const initiativesOnTrack = roiMetrics.filter((m) => m.variance >= -10).length;
    const initiativesBelowTarget = roiMetrics.filter((m) => m.variance < -10).length;

    return {
      totalInvestment,
      totalRealizedBenefits,
      totalProjectedBenefits,
      overallROI,
      averagePaybackMonths,
      initiativesOnTrack,
      initiativesBelowTarget,
    };
  }, [roiMetrics]);

  const handleInitiativeClick = (initiativeId: string) => {
    const initiative = initiatives.find((i) => i.id === initiativeId);
    if (initiative) {
      onInitiativeClick(initiative);
    }
  };

  if (roiMetrics.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-600">
        <div className="text-center">
          <Calculator className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No completed initiatives for ROI analysis</p>
          <p className="text-xs text-slate-500 mt-1">
            Complete initiatives to see ROI calculations
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Investment"
          value={`${formatCurrency(summary.totalInvestment)} PLN`}
          icon={<DollarSign size={20} />}
          color="cyan"
        />
        <SummaryCard
          title="Realized Benefits"
          value={`${formatCurrency(summary.totalRealizedBenefits)} PLN`}
          subtitle={`of ${formatCurrency(summary.totalProjectedBenefits)} projected`}
          icon={<TrendingUp size={20} />}
          trend={
            summary.totalRealizedBenefits >= summary.totalProjectedBenefits * 0.8 ? 'up' : 'down'
          }
          trendValue={`${((summary.totalRealizedBenefits / summary.totalProjectedBenefits) * 100).toFixed(0)}%`}
          color="green"
        />
        <SummaryCard
          title="Portfolio ROI"
          value={`${summary.overallROI >= 0 ? '+' : ''}${summary.overallROI.toFixed(0)}%`}
          icon={<BarChart3 size={20} />}
          trend={summary.overallROI >= 0 ? 'up' : 'down'}
          color={summary.overallROI >= 0 ? 'green' : 'red'}
        />
        <SummaryCard
          title="Avg. Payback Period"
          value={`${summary.averagePaybackMonths.toFixed(0)} months`}
          icon={<Calculator size={20} />}
          color="purple"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-navy-900 rounded-xl p-5 border border-navy-700">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-blue-400" />
            ROI by Initiative
          </h3>
          <ROIBarChart metrics={roiMetrics.slice(0, 8)} onBarClick={handleInitiativeClick} />
        </div>

        <div className="bg-navy-900 rounded-xl p-5 border border-navy-700">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Calculator size={16} className="text-primary-400" />
            Initiative Status
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-navy-800 rounded-xl p-4 border border-navy-700">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm text-slate-600">On Track</span>
              </div>
              <span className="text-3xl font-bold text-green-400">
                {summary.initiativesOnTrack}
              </span>
            </div>
            <div className="bg-navy-800 rounded-xl p-4 border border-navy-700">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-danger-500" />
                <span className="text-sm text-slate-600">Below Target</span>
              </div>
              <span className="text-3xl font-bold text-danger-400">
                {summary.initiativesBelowTarget}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Variance Analysis Table */}
      <div className="bg-navy-900 rounded-xl p-5 border border-navy-700">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-green-400" />
          Variance Analysis
        </h3>
        <VarianceTable metrics={roiMetrics} onRowClick={handleInitiativeClick} />
      </div>
    </div>
  );
};

export default ROIAnalysisView;
