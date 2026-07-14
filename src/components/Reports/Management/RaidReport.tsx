/**
 * RAID Report Component
 * Risk, Assumption, Issue, Dependency (RAID) reporting
 */

import { AlertTriangle, FileText, Flag, Sparkles } from 'lucide-react';
import React from 'react';

import { ManagementReport, RAGStatus, RaidReportContent } from '../../../types';
import { RAGIndicator } from './shared/RAGIndicator';
import { ReportFooter } from './shared/ReportFooter';
import { ReportHeader } from './shared/ReportHeader';

interface RaidReportProps {
  report: ManagementReport;
  className?: string;
}

const getOverallStatus = (content: RaidReportContent): RAGStatus => {
  if (content.escalations.some((e) => e.level === 'RED')) {
    return 'RED';
  }
  if (content.escalations.some((e) => e.level === 'AMBER')) {
    return 'AMBER';
  }
  return 'GREEN';
};

const renderSectionTable = (title: string, items: RaidReportContent['risks'], accent: string) => (
  <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
    <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${accent}`} />
      <h3 className="text-lg font-semibold text-navy-900 dark:text-white">{title}</h3>
    </div>
    <div className="overflow-x-auto">
      <table
        /* §27-exempt: tabela dokumentowa/raportowa read-only, do druku/eksportu */ className="w-full"
      >
        <thead>
          <tr className="bg-slate-50 dark:bg-navy-800/50 text-xs uppercase text-slate-500 dark:text-slate-400">
            <th className="px-4 py-3 text-left">Title</th>
            <th className="px-4 py-3 text-left">Owner</th>
            <th className="px-4 py-3 text-center">Severity</th>
            <th className="px-4 py-3 text-left">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-white/5 text-sm">
          {items.length === 0 ? (
            <tr>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-500" colSpan={4}>
                No items logged.
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                <td className="px-4 py-3 font-medium text-navy-900 dark:text-white">
                  {item.title}
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                  {item.ownerId || '—'}
                </td>
                <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">
                  {item.severity}
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{item.status}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export const RaidReport: React.FC<RaidReportProps> = ({ report, className = '' }) => {
  const content = report.content as RaidReportContent;
  const overallStatus = getOverallStatus(content);

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
        overallHealth={overallStatus}
      />

      <div className="bg-gradient-to-r from-amber-50 to-amber-50 dark:from-amber-900/20 dark:to-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-500/20 p-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={18} className="text-amber-500" />
          <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
            Executive Summary
          </h2>
        </div>
        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
          {content.executiveSummary || 'No executive summary available.'}
        </p>
      </div>

      {renderSectionTable('Risks', content.risks, 'bg-danger-500')}
      {renderSectionTable('Assumptions', content.assumptions, 'bg-slate-400')}
      {renderSectionTable('Issues', content.issues, 'bg-amber-500')}
      {renderSectionTable('Dependencies', content.dependencies, 'bg-blue-500')}

      {content.decisionsRequired?.length > 0 && (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Flag size={18} className="text-amber-500" />
            <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
              Decisions Required
            </h3>
          </div>
          <div className="space-y-2 text-sm">
            {content.decisionsRequired.map((decision) => (
              <div key={decision.id} className="flex items-center justify-between gap-4">
                <span className="font-medium text-navy-900 dark:text-white">{decision.title}</span>
                <span className="text-xs text-slate-600 dark:text-slate-500">
                  Due {decision.deadline}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {content.escalations?.length > 0 && (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-danger-500" />
            <h3 className="text-lg font-semibold text-navy-900 dark:text-white">Escalations</h3>
          </div>
          <div className="space-y-3 text-sm">
            {content.escalations.map((escalation) => (
              <div key={escalation.id} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <RAGIndicator status={escalation.level} size="sm" />
                  <span className="text-slate-600 dark:text-slate-300">{escalation.reason}</span>
                </div>
                {escalation.dueDate && (
                  <span className="text-xs text-slate-600 dark:text-slate-500">
                    Due {escalation.dueDate}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-slate-50 dark:bg-navy-900/60 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
        <div className="flex items-center gap-2 mb-3">
          <FileText size={16} className="text-slate-500" />
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Escalation Summary
          </h4>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Overall RAID status is{' '}
          <span className="font-medium text-slate-700 dark:text-slate-200">{overallStatus}</span>.
          Escalations are calculated from open issues, dependency blockers, and critical risks.
        </p>
      </div>

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

export default RaidReport;
