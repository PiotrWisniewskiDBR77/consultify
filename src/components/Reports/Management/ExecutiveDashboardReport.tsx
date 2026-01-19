/**
 * Executive Dashboard Report
 * 
 * High-level portfolio overview for executive stakeholders.
 * PRINCE2: Highlight Report / PMI: Portfolio Status Report
 * 
 * Sections:
 * 1. Portfolio Health Summary (RAG status)
 * 2. Key Metrics
 * 3. Benefits Realization Progress
 * 4. Top Risks
 * 5. Budget Utilization
 * 6. Strategic Alignment
 */

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Flag,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import React from 'react';

import { ManagementReport } from '../../../types';
import { MetricCardsGrid } from './shared/MetricCard';
import { RAGIndicator } from './shared/RAGIndicator';
import { ReportFooter } from './shared/ReportFooter';
import { ReportHeader } from './shared/ReportHeader';

// ============================================
// TYPES
// ============================================

interface ExecutiveDashboardReportContent {
  portfolioHealth: {
    overall: 'GREEN' | 'AMBER' | 'RED';
    schedule: 'GREEN' | 'AMBER' | 'RED';
    budget: 'GREEN' | 'AMBER' | 'RED';
    scope: 'GREEN' | 'AMBER' | 'RED';
    resources: 'GREEN' | 'AMBER' | 'RED';
  };
  keyMetrics: {
    totalInitiatives: number;
    onTrack: number;
    atRisk: number;
    blocked: number;
    completed: number;
  };
  benefitsRealization: {
    projected: number;
    realized: number;
    variance: number;
    kpisOnTarget: number;
    kpisTotal: number;
  };
  topRisks: {
    id: string;
    description: string;
    severity: 'HIGH' | 'CRITICAL';
    initiative: string;
    mitigation?: string;
  }[];
  budgetUtilization: {
    allocated: number;
    spent: number;
    forecast: number;
    variancePercent: number;
  };
  strategicAlignment: {
    score: number;
    byObjective: {
      objective: string;
      initiativeCount: number;
      progress: number;
    }[];
  };
  decisions: {
    id: string;
    description: string;
    requiredBy?: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }[];
}

interface ExecutiveDashboardReportProps {
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

// ============================================
// HEALTH INDICATOR COMPONENT
// ============================================

interface HealthIndicatorProps {
  label: string;
  status: 'GREEN' | 'AMBER' | 'RED';
}

const HealthIndicator: React.FC<HealthIndicatorProps> = ({ label, status }) => {
  const colors = {
    GREEN: 'bg-green-500',
    AMBER: 'bg-amber-500',
    RED: 'bg-red-500',
  };

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
      <div className={`w-4 h-4 rounded-full ${colors[status]}`} />
    </div>
  );
};

// ============================================
// RISK CARD COMPONENT
// ============================================

interface RiskCardProps {
  risk: ExecutiveDashboardReportContent['topRisks'][0];
}

const RiskCard: React.FC<RiskCardProps> = ({ risk }) => {
  return (
    <div className={`p-3 rounded-lg border ${
      risk.severity === 'CRITICAL' 
        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-500/30'
        : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-500/30'
    }`}>
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className={
          risk.severity === 'CRITICAL' ? 'text-red-500' : 'text-amber-500'
        } />
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
            {risk.description}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Initiative: {risk.initiative}
          </p>
          {risk.mitigation && (
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
              <span className="font-medium">Mitigation:</span> {risk.mitigation}
            </p>
          )}
        </div>
        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
          risk.severity === 'CRITICAL'
            ? 'bg-red-500 text-white'
            : 'bg-amber-500 text-white'
        }`}>
          {risk.severity}
        </span>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const ExecutiveDashboardReport: React.FC<ExecutiveDashboardReportProps> = ({
  report,
  className = '',
}) => {
  const content = report.content as ExecutiveDashboardReportContent;

  // Prepare metrics for grid
  const metrics = [
    {
      label: 'Total Initiatives',
      value: content.keyMetrics.totalInitiatives,
      status: 'GREEN' as const,
    },
    {
      label: 'On Track',
      value: content.keyMetrics.onTrack,
      status: content.keyMetrics.onTrack > content.keyMetrics.totalInitiatives * 0.7 
        ? 'GREEN' as const 
        : 'AMBER' as const,
    },
    {
      label: 'At Risk',
      value: content.keyMetrics.atRisk,
      status: content.keyMetrics.atRisk === 0 
        ? 'GREEN' as const 
        : content.keyMetrics.atRisk > 3 
          ? 'RED' as const 
          : 'AMBER' as const,
    },
    {
      label: 'Blocked',
      value: content.keyMetrics.blocked,
      status: content.keyMetrics.blocked === 0 
        ? 'GREEN' as const 
        : 'RED' as const,
    },
  ];

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
        overallHealth={content.portfolioHealth.overall}
      />

      {/* AI Narrative */}
      {report.aiNarrative && (
        <div className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 rounded-xl border border-violet-200 dark:border-violet-500/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} className="text-violet-500" />
            <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">
              Executive Summary
            </span>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {report.aiNarrative}
          </p>
        </div>
      )}

      {/* Portfolio Health Dashboard */}
      <div className="grid grid-cols-2 gap-6">
        {/* Overall Health */}
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <Target size={16} className="text-purple-500" />
            Portfolio Health
          </h3>
          <div className="flex items-center justify-center mb-4">
            <RAGIndicator status={content.portfolioHealth.overall} size="lg" showLabel />
          </div>
          <div className="divide-y divide-slate-100 dark:divide-navy-700">
            <HealthIndicator label="Schedule" status={content.portfolioHealth.schedule} />
            <HealthIndicator label="Budget" status={content.portfolioHealth.budget} />
            <HealthIndicator label="Scope" status={content.portfolioHealth.scope} />
            <HealthIndicator label="Resources" status={content.portfolioHealth.resources} />
          </div>
        </div>

        {/* Key Metrics */}
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-cyan-500" />
            Key Metrics
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {metrics.map((metric, idx) => (
              <div key={idx} className="text-center p-3 bg-slate-50 dark:bg-navy-800 rounded-lg">
                <div className="text-2xl font-bold text-slate-800 dark:text-white">
                  {metric.value}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {metric.label}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Completed: <span className="font-bold text-green-600 dark:text-green-400">{content.keyMetrics.completed}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Benefits & Budget Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Benefits Realization */}
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-green-500" />
            Benefits Realization
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">Projected</span>
              <span className="text-sm font-medium text-slate-800 dark:text-white">
                {formatCurrency(content.benefitsRealization.projected)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">Realized</span>
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                {formatCurrency(content.benefitsRealization.realized)}
              </span>
            </div>
            <div className="h-3 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full"
                style={{ 
                  width: `${Math.min(100, (content.benefitsRealization.realized / content.benefitsRealization.projected) * 100)}%` 
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className={`flex items-center gap-1 ${
                content.benefitsRealization.variance >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {content.benefitsRealization.variance >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                {Math.abs(content.benefitsRealization.variance)}% vs plan
              </span>
              <span className="text-slate-500">
                {content.benefitsRealization.kpisOnTarget}/{content.benefitsRealization.kpisTotal} KPIs on target
              </span>
            </div>
          </div>
        </div>

        {/* Budget Utilization */}
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <DollarSign size={16} className="text-amber-500" />
            Budget Utilization
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">Allocated</span>
              <span className="text-sm font-medium text-slate-800 dark:text-white">
                {formatCurrency(content.budgetUtilization.allocated)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">Spent</span>
              <span className="text-sm font-medium text-slate-800 dark:text-white">
                {formatCurrency(content.budgetUtilization.spent)}
              </span>
            </div>
            <div className="h-3 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  content.budgetUtilization.variancePercent <= 0 ? 'bg-green-500' : 
                  content.budgetUtilization.variancePercent <= 10 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ 
                  width: `${Math.min(100, (content.budgetUtilization.spent / content.budgetUtilization.allocated) * 100)}%` 
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className={`flex items-center gap-1 ${
                content.budgetUtilization.variancePercent <= 0 ? 'text-green-600' : 
                content.budgetUtilization.variancePercent <= 10 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {content.budgetUtilization.variancePercent > 0 ? '+' : ''}{content.budgetUtilization.variancePercent}% variance
              </span>
              <span className="text-slate-500">
                Forecast: {formatCurrency(content.budgetUtilization.forecast)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Risks */}
      {content.topRisks.length > 0 && (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            Top Risks
          </h3>
          <div className="space-y-3">
            {content.topRisks.slice(0, 5).map((risk) => (
              <RiskCard key={risk.id} risk={risk} />
            ))}
          </div>
        </div>
      )}

      {/* Strategic Alignment */}
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <Flag size={16} className="text-purple-500" />
          Strategic Alignment
        </h3>
        <div className="flex items-center gap-4 mb-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {content.strategicAlignment.score}%
            </div>
            <div className="text-xs text-slate-500">Overall Score</div>
          </div>
          <div className="flex-1 h-16 flex items-end gap-1">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className={`flex-1 rounded-t ${
                  i < Math.floor(content.strategicAlignment.score / 10)
                    ? 'bg-purple-500'
                    : 'bg-slate-200 dark:bg-navy-700'
                }`}
                style={{ height: `${40 + i * 6}px` }}
              />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {content.strategicAlignment.byObjective.map((obj, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <span className="text-sm text-slate-600 dark:text-slate-400 flex-1">
                {obj.objective}
              </span>
              <span className="text-xs text-slate-500 w-20 text-right">
                {obj.initiativeCount} initiatives
              </span>
              <div className="w-24 h-2 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{ width: `${obj.progress}%` }}
                />
              </div>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-10 text-right">
                {obj.progress}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Decisions Required */}
      {content.decisions.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-500/30 p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <Clock size={16} className="text-amber-500" />
            Decisions Required
          </h3>
          <div className="space-y-3">
            {content.decisions.map((decision) => (
              <div key={decision.id} className="flex items-start gap-3 p-3 bg-white dark:bg-navy-800 rounded-lg">
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                  decision.priority === 'HIGH' ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' :
                  decision.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' :
                  'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400'
                }`}>
                  {decision.priority}
                </span>
                <div className="flex-1">
                  <p className="text-sm text-slate-800 dark:text-slate-200">{decision.description}</p>
                  {decision.requiredBy && (
                    <p className="text-xs text-slate-500 mt-1">
                      Required by: {new Date(decision.requiredBy).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <ReportFooter
        reportId={report.id}
        version={report.version}
        status={report.status}
      />
    </div>
  );
};

export default ExecutiveDashboardReport;
