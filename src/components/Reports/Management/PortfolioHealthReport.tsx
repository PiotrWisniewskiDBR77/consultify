/**
 * Portfolio Health Report Component
 * Portfolio-level RAG overview and escalation focus
 */

import { AlertTriangle, CheckCircle2, Flag, Sparkles, Target } from 'lucide-react';
import React from 'react';

import { ManagementReport, PortfolioHealthReportContent, RAGStatus } from '../../../types';
import { MetricCard } from './shared/MetricCard';
import { RAGIndicator } from './shared/RAGIndicator';
import { ReportFooter } from './shared/ReportFooter';
import { ReportHeader } from './shared/ReportHeader';

interface PortfolioHealthReportProps {
  report: ManagementReport;
  className?: string;
}

export const PortfolioHealthReport: React.FC<PortfolioHealthReportProps> = ({
  report,
  className = '',
}) => {
  const content = report.content as PortfolioHealthReportContent;
  const overview = content.portfolioOverview;

  const metrics: Array<{ label: string; value: number; status: RAGStatus }> = [
    {
      label: 'Total Projects',
      value: overview.totalProjects,
      status: overview.overallHealth,
    },
    {
      label: 'On Track',
      value: overview.onTrack,
      status: overview.onTrack > 0 ? 'GREEN' : 'GREY',
    },
    {
      label: 'At Risk',
      value: overview.atRisk,
      status: overview.atRisk > 0 ? 'AMBER' : 'GREEN',
    },
    {
      label: 'Critical',
      value: overview.critical,
      status: overview.critical > 0 ? 'RED' : 'GREEN',
    },
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      <ReportHeader
        title={report.title}
        reportType={report.reportType}
        scope={report.scope}
        periodStart={report.periodStart}
        periodEnd={report.periodEnd}
        generatedAt={report.createdAt}
        generatedBy={report.generatedByName}
        overallHealth={overview.overallHealth}
      />

      <div className="bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-900/20 dark:to-blue-900/20 rounded-xl border border-emerald-200 dark:border-emerald-500/20 p-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={18} className="text-emerald-500" />
          <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
            Executive Summary
          </h2>
        </div>
        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
          {content.executiveSummary || 'No executive summary available.'}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            status={metric.status}
            size="sm"
          />
        ))}
      </div>

      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target size={18} className="text-primary-500" />
          <h3 className="text-lg font-semibold text-navy-900 dark:text-white">Health Drivers</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {content.healthDrivers.map(
            (driver: PortfolioHealthReportContent['healthDrivers'][number]) => (
              <div
                key={driver.category}
                className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-navy-700 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-navy-900 dark:text-white">
                    {driver.category}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{driver.summary}</p>
                </div>
                <RAGIndicator status={driver.status} size="sm" showLabel />
              </div>
            )
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center gap-2">
          <Flag size={18} className="text-amber-500" />
          <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
            Project Health Snapshot
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table
            /* §27-exempt: tabela dokumentowa/raportowa read-only, do druku/eksportu */ className="w-full"
          >
            <thead>
              <tr className="bg-slate-50 dark:bg-navy-800/50 text-xs uppercase text-slate-500 dark:text-slate-400">
                <th className="px-4 py-3 text-left">Project</th>
                <th className="px-4 py-3 text-left">Owner</th>
                <th className="px-4 py-3 text-center">RAG</th>
                <th className="px-4 py-3 text-left">Key Issues</th>
                <th className="px-4 py-3 text-left">Next Milestone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5 text-sm">
              {content.projectHealth.map(
                (project: PortfolioHealthReportContent['projectHealth'][number]) => (
                  <tr key={project.projectId} className="hover:bg-slate-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3 font-medium text-navy-900 dark:text-white">
                      {project.projectName}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {project.ownerName || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <RAGIndicator status={project.status} size="sm" showLabel />
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {project.keyIssues?.length ? project.keyIssues.join(', ') : 'No major issues'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {project.nextMilestone || '—'}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {content.decisionsRequired?.length > 0 && (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-danger-500" />
            <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
              Decisions Required
            </h3>
          </div>
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
            {content.decisionsRequired.map(
              (decision: PortfolioHealthReportContent['decisionsRequired'][number]) => (
                <div key={decision.id} className="flex items-center justify-between gap-4">
                  <span className="font-medium text-navy-900 dark:text-white">
                    {decision.title}
                  </span>
                  <span className="text-xs text-slate-600 dark:text-slate-500">
                    Due {decision.deadline}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {content.warnings?.length > 0 && (
        <div className="bg-danger-50 dark:bg-danger-900/10 rounded-xl border border-danger-200 dark:border-danger-500/30 p-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-danger-500" />
            <h3 className="text-lg font-semibold text-danger-700 dark:text-danger-400">
              Escalations
            </h3>
          </div>
          <ul className="space-y-2 text-sm text-danger-700 dark:text-danger-300">
            {content.warnings.map((warning: string, index: number) => (
              <li key={index} className="flex items-start gap-2">
                <span>•</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {content.nextPeriodPriorities?.length > 0 && (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={18} className="text-emerald-500" />
            <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
              Next Period Priorities
            </h3>
          </div>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
            {content.nextPeriodPriorities.map((priority: string, idx: number) => (
              <li key={idx}>• {priority}</li>
            ))}
          </ul>
        </div>
      )}

      <ReportFooter
        reportId={content.auditTrail?.reportId || report.id}
        generatedAt={content.auditTrail?.generatedAt || report.createdAt}
        version={content.auditTrail?.version}
        pmoDomain={content.auditTrail?.pmoDomain}
        iso21500Mapping={content.auditTrail?.iso21500Mapping}
        pmbokMapping={content.auditTrail?.pmbokMapping}
        prince2Mapping={content.auditTrail?.prince2Mapping}
        dataSnapshot={content.auditTrail?.dataSnapshot}
      />
    </div>
  );
};

export default PortfolioHealthReport;
