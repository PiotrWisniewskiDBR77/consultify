/**
 * Steering Committee Report Component
 * Executive summary for decision makers and board
 * PRINCE2: Highlight Report
 */

import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  HelpCircle,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import React from 'react';

import { ManagementReport, RAGStatus, SteeringCommitteeReportContent } from '../../../types';
import { MetricCard } from './shared/MetricCard';
import { RAGIndicator, RAGStatusGrid } from './shared/RAGIndicator';
import { ReportFooter } from './shared/ReportFooter';
import { ReportHeader } from './shared/ReportHeader';

interface SteeringCommitteeReportProps {
  report: ManagementReport;
  className?: string;
}

export const SteeringCommitteeReport: React.FC<SteeringCommitteeReportProps> = ({
  report,
  className = '',
}) => {
  const content = report.content as SteeringCommitteeReportContent;
  const overallStatus = content.overallStatus;

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
        overallHealth={overallStatus.overallHealth}
      />

      {/* Executive Summary */}
      <div className="bg-gradient-to-r from-primary-50 to-crimson-50 dark:from-primary-900/20 dark:to-crimson-900/20 rounded-xl border border-primary-200 dark:border-primary-500/20 p-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={18} className="text-primary-500" />
          <h2 className="text-lg font-semibold text-primary-900 dark:text-primary-100">
            Executive Summary
          </h2>
        </div>
        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
          {content.executiveSummary || 'No executive summary available.'}
        </p>
      </div>

      {/* Overall RAG Status */}
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
        <h2 className="text-lg font-semibold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
          🚦 Overall Status
        </h2>
        <RAGStatusGrid
          schedule={(overallStatus.schedule?.status as RAGStatus) || 'GREY'}
          budget={(overallStatus.budget?.status as RAGStatus) || 'GREY'}
          scope={(overallStatus.scope?.status as RAGStatus) || 'GREY'}
          risk={(overallStatus.risk?.status as RAGStatus) || 'GREY'}
        />

        {/* Status summaries */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {['schedule', 'budget', 'scope', 'risk'].map((key) => {
            const status = overallStatus[key as keyof typeof overallStatus];
            if (typeof status === 'object' && status && 'summary' in status) {
              return (
                <div key={key} className="text-slate-500 dark:text-slate-400">
                  <span className="font-medium capitalize">{key}:</span> {status.summary}
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>

      {/* Warnings Section - AI Transparency */}
      {content.warnings && content.warnings.length > 0 && (
        <div className="bg-danger-50 dark:bg-danger-900/10 rounded-xl border-2 border-danger-200 dark:border-danger-500/30 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={20} className="text-danger-500" />
            <h2 className="text-lg font-bold text-danger-700 dark:text-danger-400">
              ⚠️ Attention Required
            </h2>
          </div>
          <ul className="space-y-2">
            {content.warnings.map((warning, idx: number) => (
              <li key={idx} className="flex items-start gap-2 text-danger-800 dark:text-danger-300">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-danger-600 dark:text-danger-400 italic">
            AI Transparency: These warnings are automatically generated. AI never hides bad news.
          </p>
        </div>
      )}

      {/* KPIs */}
      {content.kpis && content.kpis.length > 0 && (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          <h2 className="text-lg font-semibold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-primary-500" />
            Key Performance Indicators
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {content.kpis.map((kpi) => (
              <MetricCard
                key={kpi.id}
                label={kpi.name}
                value={kpi.currentValue}
                unit={kpi.unit}
                target={kpi.targetValue}
                status={kpi.status}
                trend={kpi.trend}
              />
            ))}
          </div>
        </div>
      )}

      {/* Risks & Issues */}
      {content.risksAndIssues && content.risksAndIssues.length > 0 && (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700">
            <h2 className="text-lg font-semibold text-navy-900 dark:text-white flex items-center gap-2">
              <AlertTriangle size={20} className="text-amber-500" />
              Risks & Issues
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table
              /* §27-exempt: tabela dokumentowa/raportowa read-only, do druku/eksportu */ className="w-full"
            >
              <thead>
                <tr className="bg-slate-50 dark:bg-navy-800/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Owner
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Days Open
                  </th>
                  {report.scope === 'PORTFOLIO' && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Project
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                {content.risksAndIssues.slice(0, 10).map((item: any) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          item.type === 'RISK'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400'
                        }`}
                      >
                        {item.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-navy-900 dark:text-white">
                      {item.title}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-1 text-xs font-bold rounded ${
                          item.severity === 'CRITICAL'
                            ? 'bg-danger-500 text-white'
                            : item.severity === 'HIGH'
                              ? 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400'
                              : item.severity === 'MEDIUM'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {item.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {item.ownerName}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600 dark:text-slate-300">
                      {item.daysOpen}
                    </td>
                    {report.scope === 'PORTFOLIO' && (
                      <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                        {item.projectName}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Decisions Required */}
      {content.decisionsRequired && content.decisionsRequired.length > 0 && (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          <h2 className="text-lg font-semibold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
            <HelpCircle size={20} className="text-primary-500" />
            Decisions Required from Board
          </h2>
          <div className="space-y-4">
            {content.decisionsRequired.map((decision) => {
              const isOverdue = decision.daysUntilDeadline < 0;
              return (
                <div
                  key={decision.id}
                  className={`p-4 rounded-lg border-2 ${
                    isOverdue
                      ? 'border-danger-300 bg-danger-50 dark:border-danger-500/30 dark:bg-danger-900/10'
                      : 'border-primary-200 bg-primary-50/50 dark:border-primary-500/20 dark:bg-primary-900/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          isOverdue ? 'bg-danger-500 text-white' : 'bg-navy-900 text-white'
                        }`}
                      >
                        {decision.decisionType}
                      </span>
                      {isOverdue && (
                        <span className="px-2 py-1 text-xs font-bold bg-danger-500 text-white rounded">
                          OVERDUE
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-sm ${isOverdue ? 'text-danger-600 font-bold' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                      {isOverdue
                        ? `${Math.abs(decision.daysUntilDeadline)} days overdue`
                        : `Due: ${decision.deadline}`}
                    </span>
                  </div>
                  <h3 className="font-semibold text-navy-900 dark:text-white mb-1">
                    {decision.title}
                  </h3>
                  {decision.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                      {decision.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                    <span>Requested by: {decision.requestedByName}</span>
                    {decision.projectName && <span>Project: {decision.projectName}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Forecast & Milestones */}
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
        <h2 className="text-lg font-semibold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
          <Target size={20} className="text-primary-500" />
          Forecast & Next Milestones
        </h2>

        {content.forecast?.forecastNarrative && (
          <p className="text-slate-600 dark:text-slate-300 mb-4">
            {content.forecast.forecastNarrative}
          </p>
        )}

        {content.forecast?.nextMilestones && content.forecast.nextMilestones.length > 0 && (
          <div className="space-y-3">
            {content.forecast.nextMilestones.map((milestone) => (
              <div
                key={milestone.id}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-800/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <RAGIndicator status={milestone.status} size="sm" />
                  <span className="font-medium text-navy-900 dark:text-white">
                    {milestone.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <Calendar size={14} />
                  {milestone.plannedDate}
                </div>
              </div>
            ))}
          </div>
        )}

        {content.forecast?.nextGates && content.forecast.nextGates.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-navy-700">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Upcoming Stage Gates
            </h3>
            <div className="space-y-2">
              {content.forecast.nextGates.map((gate) => (
                <div
                  key={gate.id}
                  className="flex items-center justify-between p-2 bg-primary-50 dark:bg-primary-900/10 rounded"
                >
                  <div className="flex items-center gap-2">
                    <RAGIndicator status={gate.readiness} size="sm" />
                    <span className="text-sm font-medium text-primary-900 dark:text-primary-100">
                      {gate.name}
                    </span>
                  </div>
                  <span className="text-xs text-primary-600 dark:text-primary-400">
                    {gate.plannedDate}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Project Statuses (for portfolio reports) */}
      {content.projectStatuses && content.projectStatuses.length > 0 && (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700">
            <h2 className="text-lg font-semibold text-navy-900 dark:text-white">
              Project Portfolio Status
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 dark:bg-navy-800/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Project
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Owner
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Phase
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Health
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Key Issues
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                {content.projectStatuses.map((project) => (
                  <tr key={project.projectId} className="hover:bg-slate-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3 font-medium text-navy-900 dark:text-white">
                      {project.projectName}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {project.owner}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 text-xs font-medium bg-slate-100 dark:bg-navy-800/40 dark:bg-white/10 rounded">
                        {project.phase}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <RAGIndicator status={project.status.overallHealth} size="md" showLabel />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                      {project.keyIssues.length > 0 ? project.keyIssues.join(', ') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <ReportFooter
        reportId={report.id}
        generatedAt={report.createdAt}
        pmoDomain={content.auditTrail?.pmoDomain || 'PERFORMANCE_MONITORING'}
        iso21500Mapping={content.auditTrail?.iso21500Mapping}
        pmbokMapping={content.auditTrail?.pmbokMapping}
        prince2Mapping={content.auditTrail?.prince2Mapping || 'Highlight Report / Progress Theme'}
        dataSnapshot={content.auditTrail?.dataSnapshot}
      />
    </div>
  );
};

export default SteeringCommitteeReport;
