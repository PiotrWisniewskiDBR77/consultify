/**
 * Benefits Realization Report
 * 
 * Comprehensive benefits tracking and ROI analysis report.
 * PRINCE2: Benefits Review Plan / PMI: Benefits Realization Report
 * 
 * Sections:
 * 1. Realized vs Projected Benefits Summary
 * 2. KPI Performance Dashboard
 * 3. ROI by Initiative
 * 4. Benefits by Category
 * 5. Variance Analysis
 * 6. Forecast
 */

import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Calendar,
  CheckCircle2,
  DollarSign,
  Minus,
  PieChart,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import React from 'react';

import { ManagementReport } from '../../../types';
import { RAGIndicator } from './shared/RAGIndicator';
import { ReportFooter } from './shared/ReportFooter';
import { ReportHeader } from './shared/ReportHeader';

// ============================================
// TYPES
// ============================================

interface BenefitsRealizationReportContent {
  summary: {
    totalProjected: number;
    totalRealized: number;
    variance: number;
    variancePercent: number;
    healthStatus: 'GREEN' | 'AMBER' | 'RED';
  };
  kpiPerformance: {
    total: number;
    onTarget: number;
    belowTarget: number;
    exceeding: number;
    kpis: {
      id: string;
      name: string;
      category: string;
      baseline: number;
      target: number;
      current: number;
      unit: string;
      trend: 'UP' | 'DOWN' | 'STABLE';
      isOnTarget: boolean;
    }[];
  };
  roiByInitiative: {
    id: string;
    name: string;
    investment: number;
    realizedBenefits: number;
    projectedBenefits: number;
    roi: number;
    paybackMonths: number;
    status: 'EXCEEDING' | 'ON_TRACK' | 'BELOW' | 'AT_RISK';
  }[];
  benefitsByCategory: {
    category: string;
    projected: number;
    realized: number;
    percentage: number;
  }[];
  varianceAnalysis: {
    id: string;
    initiative: string;
    projectedBenefit: number;
    actualBenefit: number;
    variance: number;
    explanation: string;
    corrective?: string;
  }[];
  forecast: {
    nextQuarter: number;
    nextYear: number;
    assumptions: string[];
    risks: string[];
  };
}

interface BenefitsRealizationReportProps {
  report: ManagementReport;
  className?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatCurrency = (value: number): string => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M PLN`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k PLN`;
  return `${value} PLN`;
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'EXCEEDING': return 'text-green-600 dark:text-green-400';
    case 'ON_TRACK': return 'text-blue-600 dark:text-blue-400';
    case 'BELOW': return 'text-amber-600 dark:text-amber-400';
    case 'AT_RISK': return 'text-red-600 dark:text-red-400';
    default: return 'text-slate-600 dark:text-slate-400';
  }
};

const getStatusBadgeClasses = (status: string): string => {
  switch (status) {
    case 'EXCEEDING': return 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400';
    case 'ON_TRACK': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400';
    case 'BELOW': return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400';
    case 'AT_RISK': return 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400';
    default: return 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400';
  }
};

// ============================================
// KPI ROW COMPONENT
// ============================================

interface KPIRowProps {
  kpi: BenefitsRealizationReportContent['kpiPerformance']['kpis'][0];
}

const KPIRow: React.FC<KPIRowProps> = ({ kpi }) => {
  const progress = Math.min(100, Math.max(0, ((kpi.current - kpi.baseline) / (kpi.target - kpi.baseline)) * 100));
  
  return (
    <tr className="border-b border-slate-100 dark:border-navy-700">
      <td className="py-3 px-4">
        <div>
          <span className="text-sm font-medium text-slate-800 dark:text-white">{kpi.name}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">({kpi.category})</span>
        </div>
      </td>
      <td className="py-3 px-4 text-right text-sm text-slate-600 dark:text-slate-400">
        {kpi.baseline} {kpi.unit}
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <div className="w-24 h-2 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${kpi.isOnTarget ? 'bg-green-500' : 'bg-amber-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className={`text-sm font-medium ${kpi.isOnTarget ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {kpi.current} {kpi.unit}
          </span>
        </div>
      </td>
      <td className="py-3 px-4 text-right text-sm font-medium text-slate-800 dark:text-white">
        {kpi.target} {kpi.unit}
      </td>
      <td className="py-3 px-4 text-center">
        {kpi.trend === 'UP' && <TrendingUp size={16} className="text-green-500 mx-auto" />}
        {kpi.trend === 'DOWN' && <TrendingDown size={16} className="text-red-500 mx-auto" />}
        {kpi.trend === 'STABLE' && <Minus size={16} className="text-slate-400 mx-auto" />}
      </td>
      <td className="py-3 px-4 text-center">
        {kpi.isOnTarget ? (
          <CheckCircle2 size={16} className="text-green-500 mx-auto" />
        ) : (
          <AlertTriangle size={16} className="text-amber-500 mx-auto" />
        )}
      </td>
    </tr>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const BenefitsRealizationReport: React.FC<BenefitsRealizationReportProps> = ({
  report,
  className = '',
}) => {
  const content = report.content as BenefitsRealizationReportContent;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <ReportHeader
        title={report.title}
        reportType={report.reportType}
        scope={report.scope}
        periodStart={report.periodStart}
        periodEnd={report.periodEnd}
        generatedAt={report.createdAt}
        generatedBy={report.generatedByName}
        overallHealth={content.summary.healthStatus}
      />

      {/* AI Narrative */}
      {report.aiNarrative && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border border-emerald-200 dark:border-emerald-500/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} className="text-emerald-500" />
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              Benefits Summary
            </span>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {report.aiNarrative}
          </p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target size={16} className="text-purple-500" />
            <span className="text-xs text-slate-500">Projected Benefits</span>
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-white">
            {formatCurrency(content.summary.totalProjected)}
          </div>
        </div>
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={16} className="text-green-500" />
            <span className="text-xs text-slate-500">Realized Benefits</span>
          </div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(content.summary.totalRealized)}
          </div>
        </div>
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            {content.summary.variancePercent >= 0 ? (
              <TrendingUp size={16} className="text-green-500" />
            ) : (
              <TrendingDown size={16} className="text-red-500" />
            )}
            <span className="text-xs text-slate-500">Variance</span>
          </div>
          <div className={`text-2xl font-bold ${
            content.summary.variancePercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {content.summary.variancePercent > 0 ? '+' : ''}{content.summary.variancePercent}%
          </div>
        </div>
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={16} className="text-cyan-500" />
            <span className="text-xs text-slate-500">KPIs On Target</span>
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-white">
            {content.kpiPerformance.onTarget}/{content.kpiPerformance.total}
          </div>
        </div>
      </div>

      {/* Realization Progress */}
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-green-500" />
          Benefits Realization Progress
        </h3>
        <div className="relative h-8 bg-slate-100 dark:bg-navy-700 rounded-lg overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-green-500 rounded-lg"
            style={{ width: `${Math.min(100, (content.summary.totalRealized / content.summary.totalProjected) * 100)}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-sm font-medium text-slate-700 dark:text-white">
            {Math.round((content.summary.totalRealized / content.summary.totalProjected) * 100)}% realized
          </div>
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <span>0</span>
          <span>{formatCurrency(content.summary.totalProjected)}</span>
        </div>
      </div>

      {/* KPI Performance Table */}
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-navy-700">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <Target size={16} className="text-cyan-500" />
            KPI Performance Dashboard
          </h3>
          <div className="flex gap-4 mt-2 text-xs">
            <span className="text-green-600 dark:text-green-400">
              {content.kpiPerformance.onTarget} On Target
            </span>
            <span className="text-amber-600 dark:text-amber-400">
              {content.kpiPerformance.belowTarget} Below
            </span>
            <span className="text-blue-600 dark:text-blue-400">
              {content.kpiPerformance.exceeding} Exceeding
            </span>
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800">
              <th className="py-2 px-4 text-left text-xs font-semibold text-slate-500">KPI</th>
              <th className="py-2 px-4 text-right text-xs font-semibold text-slate-500">Baseline</th>
              <th className="py-2 px-4 text-left text-xs font-semibold text-slate-500">Progress</th>
              <th className="py-2 px-4 text-right text-xs font-semibold text-slate-500">Target</th>
              <th className="py-2 px-4 text-center text-xs font-semibold text-slate-500">Trend</th>
              <th className="py-2 px-4 text-center text-xs font-semibold text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {content.kpiPerformance.kpis.slice(0, 8).map((kpi) => (
              <KPIRow key={kpi.id} kpi={kpi} />
            ))}
          </tbody>
        </table>
      </div>

      {/* ROI by Initiative */}
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <DollarSign size={16} className="text-amber-500" />
          ROI by Initiative
        </h3>
        <div className="space-y-3">
          {content.roiByInitiative.slice(0, 5).map((item) => (
            <div key={item.id} className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-navy-800 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800 dark:text-white">
                    {item.name}
                  </span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusBadgeClasses(item.status)}`}>
                    {item.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                  <span>Investment: {formatCurrency(item.investment)}</span>
                  <span>Benefits: {formatCurrency(item.realizedBenefits)}</span>
                  <span>Payback: {item.paybackMonths} months</span>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-bold ${item.roi > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {item.roi > 0 ? '+' : ''}{item.roi}%
                </div>
                <div className="text-xs text-slate-500">ROI</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Benefits by Category */}
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <PieChart size={16} className="text-purple-500" />
          Benefits by Category
        </h3>
        <div className="space-y-3">
          {content.benefitsByCategory.map((cat, idx) => (
            <div key={idx}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-slate-600 dark:text-slate-400">{cat.category}</span>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-slate-500">
                    {formatCurrency(cat.realized)} / {formatCurrency(cat.projected)}
                  </span>
                  <span className={`font-medium ${cat.percentage >= 80 ? 'text-green-600' : cat.percentage >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                    {cat.percentage}%
                  </span>
                </div>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    cat.percentage >= 80 ? 'bg-green-500' : cat.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${cat.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Variance Analysis */}
      {content.varianceAnalysis.length > 0 && (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            Variance Analysis
          </h3>
          <div className="space-y-3">
            {content.varianceAnalysis.map((item) => (
              <div key={item.id} className={`p-3 rounded-lg border ${
                item.variance >= 0 
                  ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-500/30'
                  : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-500/30'
              }`}>
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm font-medium text-slate-800 dark:text-white">
                    {item.initiative}
                  </span>
                  <span className={`text-sm font-bold ${
                    item.variance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {item.variance > 0 ? '+' : ''}{item.variance}%
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
                  <span>Projected: {formatCurrency(item.projectedBenefit)}</span>
                  <ArrowRight size={12} />
                  <span>Actual: {formatCurrency(item.actualBenefit)}</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">{item.explanation}</p>
                {item.corrective && (
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-2">
                    <span className="font-medium">Corrective Action:</span> {item.corrective}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Forecast */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-navy-800 dark:to-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <Calendar size={16} className="text-blue-500" />
          Benefits Forecast
        </h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs text-slate-500 mb-1">Next Quarter</div>
            <div className="text-2xl font-bold text-slate-800 dark:text-white">
              {formatCurrency(content.forecast.nextQuarter)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Next Year</div>
            <div className="text-2xl font-bold text-slate-800 dark:text-white">
              {formatCurrency(content.forecast.nextYear)}
            </div>
          </div>
        </div>
        {content.forecast.assumptions.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Key Assumptions</div>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              {content.forecast.assumptions.map((assumption, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-slate-400">•</span>
                  {assumption}
                </li>
              ))}
            </ul>
          </div>
        )}
        {content.forecast.risks.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-2">Forecast Risks</div>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              {content.forecast.risks.map((risk, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <AlertTriangle size={12} className="text-amber-500 mt-0.5 shrink-0" />
                  {risk}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer */}
      <ReportFooter
        reportId={report.id}
        version={report.version}
        status={report.status}
      />
    </div>
  );
};

export default BenefitsRealizationReport;
