/**
 * ROIAnalysisView
 * 
 * Return on Investment analysis for completed initiatives.
 * Shows ROI calculations, charts, and variance analysis.
 * 
 * Features:
 * - Portfolio ROI summary
 * - ROI by initiative table
 * - Payback period visualization
 * - Benefits realization curve
 * - Projected vs Actual comparison
 */

import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Calculator,
  ChevronRight,
  DollarSign,
  Loader2,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { InitiativeStatus } from '../../types';

// ============================================
// TYPES
// ============================================

interface BenefitsInitiative {
  id: string;
  name: string;
  axis: string;
  status: InitiativeStatus;
  costCapex?: number;
  costOpex?: number;
  expectedRoi?: number;
  annualBenefit?: number;
  actualBenefit?: number;
  completedAt?: string;
}

interface ROIAnalysisViewProps {
  initiatives: BenefitsInitiative[];
  onInitiativeClick?: (initiative: BenefitsInitiative) => void;
}

interface ROIMetrics {
  initiativeId: string;
  initiativeName: string;
  totalInvestment: number;
  realizedBenefits: number;
  projectedBenefits: number;
  roi: number;
  paybackMonths: number;
  variance: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatCurrency = (value: number): string => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return value.toString();
};

const calculateROI = (benefit: number, investment: number): number => {
  if (investment === 0) return 0;
  return Math.round(((benefit - investment) / investment) * 100);
};

const calculatePaybackMonths = (investment: number, monthlyBenefit: number): number => {
  if (monthlyBenefit === 0) return 0;
  return Math.round(investment / monthlyBenefit);
};

// ============================================
// METRIC CARD COMPONENT
// ============================================

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'cyan' | 'green' | 'amber' | 'red' | 'purple';
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  color = 'cyan',
}) => {
  const colorClasses = {
    cyan: 'bg-cyan-500/20 text-cyan-400',
    green: 'bg-green-500/20 text-green-400',
    amber: 'bg-amber-500/20 text-amber-400',
    red: 'bg-red-500/20 text-red-400',
    purple: 'bg-purple-500/20 text-purple-400',
  };

  return (
    <div className="bg-navy-800 rounded-xl p-4 border border-navy-700">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
        <span className="text-sm text-slate-400">{title}</span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-2xl font-bold text-white">{value}</div>
          {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
        </div>
        {trend && trendValue && (
          <div className={`flex items-center gap-1 text-sm ${
            trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400'
          }`}>
            {trend === 'up' ? <ArrowUp size={14} /> : trend === 'down' ? <ArrowDown size={14} /> : null}
            {trendValue}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// ROI BAR COMPONENT
// ============================================

interface ROIBarProps {
  initiative: ROIMetrics;
  maxROI: number;
  onClick?: () => void;
}

const ROIBar: React.FC<ROIBarProps> = ({ initiative, maxROI, onClick }) => {
  const barWidth = Math.min(100, Math.max(0, (initiative.roi / maxROI) * 100));
  const isPositive = initiative.roi > 0;
  
  return (
    <div
      onClick={onClick}
      className="p-3 bg-navy-800 rounded-lg border border-navy-700 hover:border-cyan-500/50 cursor-pointer transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-white font-medium truncate flex-1 mr-4">
          {initiative.initiativeName}
        </span>
        <span className={`text-sm font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {initiative.roi > 0 ? '+' : ''}{initiative.roi}%
        </span>
      </div>
      <div className="h-2 bg-navy-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
        <span>Investment: {formatCurrency(initiative.totalInvestment)} PLN</span>
        <span>Benefits: {formatCurrency(initiative.realizedBenefits)} PLN</span>
      </div>
    </div>
  );
};

// ============================================
// PAYBACK CHART COMPONENT
// ============================================

interface PaybackChartProps {
  data: ROIMetrics[];
}

const PaybackChart: React.FC<PaybackChartProps> = ({ data }) => {
  const maxMonths = Math.max(...data.map((d) => d.paybackMonths), 24);
  
  return (
    <div className="space-y-3">
      {data.slice(0, 5).map((item) => {
        const width = Math.min(100, (item.paybackMonths / maxMonths) * 100);
        const color = item.paybackMonths <= 12 ? 'bg-green-500' : item.paybackMonths <= 18 ? 'bg-amber-500' : 'bg-red-500';
        
        return (
          <div key={item.initiativeId} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 truncate max-w-[200px]">{item.initiativeName}</span>
              <span className="text-white font-medium">{item.paybackMonths} months</span>
            </div>
            <div className="h-3 bg-navy-700 rounded-full overflow-hidden">
              <div className={`h-full ${color} rounded-full`} style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ============================================
// VARIANCE TABLE COMPONENT
// ============================================

interface VarianceTableProps {
  data: ROIMetrics[];
  onRowClick?: (item: ROIMetrics) => void;
}

const VarianceTable: React.FC<VarianceTableProps> = ({ data, onRowClick }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-navy-700">
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400">Initiative</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400">Projected</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400">Actual</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400">Variance</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400">ROI</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={item.initiativeId}
              onClick={() => onRowClick?.(item)}
              className="border-b border-navy-800 hover:bg-navy-800 cursor-pointer"
            >
              <td className="py-3 px-4">
                <span className="text-sm text-white">{item.initiativeName}</span>
              </td>
              <td className="py-3 px-4 text-right">
                <span className="text-sm text-slate-300">{formatCurrency(item.projectedBenefits)} PLN</span>
              </td>
              <td className="py-3 px-4 text-right">
                <span className="text-sm text-white">{formatCurrency(item.realizedBenefits)} PLN</span>
              </td>
              <td className="py-3 px-4 text-right">
                <span className={`text-sm font-medium flex items-center justify-end gap-1 ${
                  item.variance >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {item.variance >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {item.variance > 0 ? '+' : ''}{item.variance}%
                </span>
              </td>
              <td className="py-3 px-4 text-right">
                <span className={`text-sm font-bold ${item.roi > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {item.roi > 0 ? '+' : ''}{item.roi}%
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
// MAIN COMPONENT
// ============================================

export const ROIAnalysisView: React.FC<ROIAnalysisViewProps> = ({
  initiatives,
  onInitiativeClick,
}) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'summary' | 'table'>('summary');

  // Calculate ROI metrics for each initiative
  const roiData = useMemo((): ROIMetrics[] => {
    return initiatives
      .filter((i) => i.status === InitiativeStatus.DONE)
      .map((initiative) => {
        const totalInvestment = (initiative.costCapex || 0) + (initiative.costOpex || 0);
        const projectedBenefits = initiative.annualBenefit || 0;
        const realizedBenefits = initiative.actualBenefit || projectedBenefits * 0.85; // Mock: 85% realization
        const monthlyBenefit = realizedBenefits / 12;
        
        return {
          initiativeId: initiative.id,
          initiativeName: initiative.name,
          totalInvestment,
          realizedBenefits,
          projectedBenefits,
          roi: calculateROI(realizedBenefits, totalInvestment),
          paybackMonths: calculatePaybackMonths(totalInvestment, monthlyBenefit),
          variance: projectedBenefits > 0 
            ? Math.round(((realizedBenefits - projectedBenefits) / projectedBenefits) * 100)
            : 0,
        };
      })
      .sort((a, b) => b.roi - a.roi);
  }, [initiatives]);

  // Calculate portfolio-level stats
  const portfolioStats = useMemo(() => {
    const totalInvestment = roiData.reduce((sum, i) => sum + i.totalInvestment, 0);
    const totalRealized = roiData.reduce((sum, i) => sum + i.realizedBenefits, 0);
    const totalProjected = roiData.reduce((sum, i) => sum + i.projectedBenefits, 0);
    const avgROI = roiData.length > 0 
      ? Math.round(roiData.reduce((sum, i) => sum + i.roi, 0) / roiData.length)
      : 0;
    const onTargetCount = roiData.filter((i) => i.variance >= 0).length;
    
    return {
      totalInvestment,
      totalRealized,
      totalProjected,
      portfolioROI: calculateROI(totalRealized, totalInvestment),
      avgROI,
      onTargetCount,
      totalCount: roiData.length,
      variance: totalProjected > 0 
        ? Math.round(((totalRealized - totalProjected) / totalProjected) * 100)
        : 0,
    };
  }, [roiData]);

  const maxROI = Math.max(...roiData.map((d) => Math.abs(d.roi)), 100);

  if (initiatives.filter((i) => i.status === InitiativeStatus.DONE).length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <div className="text-center">
          <Calculator className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg text-white">No completed initiatives</p>
          <p className="text-sm text-slate-400 mt-1">ROI analysis requires completed initiatives</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Portfolio Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title="Portfolio ROI"
          value={`${portfolioStats.portfolioROI > 0 ? '+' : ''}${portfolioStats.portfolioROI}%`}
          subtitle="Overall return"
          icon={<TrendingUp size={20} />}
          color={portfolioStats.portfolioROI > 0 ? 'green' : 'red'}
          trend={portfolioStats.portfolioROI > 0 ? 'up' : 'down'}
        />
        <MetricCard
          title="Total Investment"
          value={`${formatCurrency(portfolioStats.totalInvestment)} PLN`}
          subtitle={`${roiData.length} initiatives`}
          icon={<DollarSign size={20} />}
          color="purple"
        />
        <MetricCard
          title="Benefits Realized"
          value={`${formatCurrency(portfolioStats.totalRealized)} PLN`}
          subtitle={`${portfolioStats.variance >= 0 ? '+' : ''}${portfolioStats.variance}% vs plan`}
          icon={<Target size={20} />}
          color={portfolioStats.variance >= 0 ? 'green' : 'amber'}
          trend={portfolioStats.variance >= 0 ? 'up' : 'down'}
          trendValue={`${Math.abs(portfolioStats.variance)}%`}
        />
        <MetricCard
          title="On Target"
          value={`${portfolioStats.onTargetCount}/${portfolioStats.totalCount}`}
          subtitle="Meeting projections"
          icon={<BarChart3 size={20} />}
          color={portfolioStats.onTargetCount >= portfolioStats.totalCount / 2 ? 'green' : 'amber'}
        />
      </div>

      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Initiative Analysis</h2>
        <div className="flex items-center gap-1 bg-navy-800 rounded-lg p-1 border border-navy-700">
          <button
            onClick={() => setViewMode('summary')}
            className={`px-3 py-1 text-xs font-medium rounded ${
              viewMode === 'summary' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            Summary
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1 text-xs font-medium rounded ${
              viewMode === 'table' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            Table
          </button>
        </div>
      </div>

      {viewMode === 'summary' ? (
        <div className="grid grid-cols-2 gap-6">
          {/* ROI Ranking */}
          <div className="bg-navy-800/50 rounded-xl p-4 border border-navy-700">
            <h3 className="text-sm font-semibold text-white mb-4">ROI Ranking</h3>
            <div className="space-y-3">
              {roiData.slice(0, 5).map((item) => (
                <ROIBar
                  key={item.initiativeId}
                  initiative={item}
                  maxROI={maxROI}
                  onClick={() => {
                    const init = initiatives.find((i) => i.id === item.initiativeId);
                    if (init) onInitiativeClick?.(init);
                  }}
                />
              ))}
            </div>
          </div>

          {/* Payback Period */}
          <div className="bg-navy-800/50 rounded-xl p-4 border border-navy-700">
            <h3 className="text-sm font-semibold text-white mb-4">Payback Period</h3>
            <PaybackChart data={roiData} />
            <div className="mt-4 pt-4 border-t border-navy-700 flex items-center justify-between text-xs">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-green-500" />
                  <span className="text-slate-400">&lt;12 months</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-amber-500" />
                  <span className="text-slate-400">12-18 months</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-red-500" />
                  <span className="text-slate-400">&gt;18 months</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-navy-800/50 rounded-xl border border-navy-700 overflow-hidden">
          <VarianceTable
            data={roiData}
            onRowClick={(item) => {
              const init = initiatives.find((i) => i.id === item.initiativeId);
              if (init) onInitiativeClick?.(init);
            }}
          />
        </div>
      )}

      {/* Variance Analysis Summary */}
      <div className="bg-navy-800/50 rounded-xl p-4 border border-navy-700">
        <h3 className="text-sm font-semibold text-white mb-4">Variance Analysis</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-navy-800 rounded-lg">
            <div className="text-2xl font-bold text-green-400">
              {roiData.filter((i) => i.variance >= 10).length}
            </div>
            <div className="text-xs text-slate-400 mt-1">Exceeding Plan (&gt;10%)</div>
          </div>
          <div className="text-center p-4 bg-navy-800 rounded-lg">
            <div className="text-2xl font-bold text-white">
              {roiData.filter((i) => i.variance >= -10 && i.variance < 10).length}
            </div>
            <div className="text-xs text-slate-400 mt-1">On Track (±10%)</div>
          </div>
          <div className="text-center p-4 bg-navy-800 rounded-lg">
            <div className="text-2xl font-bold text-red-400">
              {roiData.filter((i) => i.variance < -10).length}
            </div>
            <div className="text-xs text-slate-400 mt-1">Below Plan (&lt;-10%)</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ROIAnalysisView;
