/**
 * Team Meeting Report Component
 * Weekly status report for project team synchronization
 * PRINCE2: Checkpoint Report
 */

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import React from 'react';

import { ManagementReport, TeamMeetingReportContent } from '../../../types';
import { MetricCardsGrid } from './shared/MetricCard';
import { RAGIndicator } from './shared/RAGIndicator';
import { ReportFooter } from './shared/ReportFooter';
import { ReportHeader } from './shared/ReportHeader';
import { TaskListSection } from './shared/TaskListSection';

interface TeamMeetingReportProps {
  report: ManagementReport;
  className?: string;
}

export const TeamMeetingReport: React.FC<TeamMeetingReportProps> = ({ report, className = '' }) => {
  const content = report.content as TeamMeetingReportContent;
  const summary = content.statusSummary;

  // Prepare metrics for grid
  const metrics = [
    {
      label: 'Progress',
      value: summary.progressPercent,
      unit: '%',
      status: summary.healthStatus,
    },
    {
      label: 'Tasks Completed',
      value: `${summary.tasksCompleted}/${summary.tasksTotal}`,
      status:
        summary.tasksCompleted >= summary.tasksTotal * 0.7
          ? ('GREEN' as const)
          : ('AMBER' as const),
    },
    {
      label: 'Blocked',
      value: summary.tasksBlocked,
      status:
        summary.tasksBlocked === 0
          ? ('GREEN' as const)
          : summary.tasksBlocked > 5
            ? ('RED' as const)
            : ('AMBER' as const),
    },
    {
      label: 'Pending Decisions',
      value: summary.decisionsPending,
      status:
        summary.decisionsPending === 0
          ? ('GREEN' as const)
          : summary.decisionsPending > 3
            ? ('RED' as const)
            : ('AMBER' as const),
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
        overallHealth={summary.healthStatus}
      />

      {/* AI Narrative */}
      {report.aiNarrative && (
        <div className="bg-gradient-to-r from-primary-50 to-crimson-50 dark:from-primary-900/20 dark:to-crimson-900/20 rounded-xl border border-primary-200 dark:border-primary-500/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} className="text-primary-500" />
            <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">
              AI Summary
            </span>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {report.aiNarrative}
          </p>
        </div>
      )}

      {/* Metrics Grid */}
      <MetricCardsGrid metrics={metrics} columns={4} />

      {/* AI Highlights & Concerns */}
      {(((content as any).aiHighlights?.length ?? 0) > 0 ||
        ((content as any).aiConcerns?.length ?? 0) > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(content as any).aiHighlights && (content as any).aiHighlights.length > 0 && (
            <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-2">
                <CheckCircle2 size={16} />
                Highlights
              </h3>
              <ul className="space-y-1">
                {(content as any).aiHighlights.map((highlight: string, idx: number) => (
                  <li key={idx} className="text-sm text-emerald-800 dark:text-emerald-300">
                    • {highlight}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(content as any).aiConcerns && (content as any).aiConcerns.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-500/20 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400 mb-2">
                <AlertTriangle size={16} />
                Concerns
              </h3>
              <ul className="space-y-1">
                {(content as any).aiConcerns.map((concern: string, idx: number) => (
                  <li key={idx} className="text-sm text-amber-800 dark:text-amber-300">
                    • {concern}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Completed Work */}
      <TaskListSection
        title="Completed This Period"
        icon={<CheckCircle2 size={16} className="text-emerald-500" />}
        variant="completed"
        items={content.completedWork.map((item: any) => ({
          id: item.id,
          title: item.title,
          assignee: item.completedByName,
          projectName: item.projectName,
          meta: item.initiativeTitle ? `Initiative: ${item.initiativeTitle}` : undefined,
        }))}
        emptyMessage="No tasks completed in this period."
        maxItems={10}
      />

      {/* Work In Progress */}
      <TaskListSection
        title="Work In Progress"
        icon={<Clock size={16} className="text-blue-500" />}
        variant="default"
        items={content.workInProgress.map((item: any) => ({
          id: item.id,
          title: item.title,
          status: item.status,
          assignee: item.assigneeName,
          dueDate: item.dueDate,
          projectName: item.projectName,
          meta: `${item.progressPercent}% complete`,
        }))}
        emptyMessage="No tasks in progress."
        maxItems={10}
      />

      {/* Blockers */}
      {content.blockers.length > 0 && (
        <TaskListSection
          title="Blockers & Issues"
          icon={<AlertTriangle size={16} className="text-danger-500" />}
          variant="blocked"
          items={content.blockers.map((item: any) => ({
            id: item.id,
            title: item.title,
            assignee: item.ownerName,
            projectName: item.projectName,
            severity: item.severity,
            daysInfo: `${item.daysBlocked} days blocked`,
            meta: item.blockedReason,
          }))}
          emptyMessage="No blocked items."
        />
      )}

      {/* Pending Decisions */}
      {content.pendingDecisions.length > 0 && (
        <TaskListSection
          title="Pending Decisions"
          icon={<HelpCircle size={16} className="text-amber-500" />}
          variant="pending"
          items={content.pendingDecisions.map((item: any) => ({
            id: item.id,
            title: item.title,
            assignee: item.ownerName,
            projectName: item.projectName,
            daysInfo: `${item.daysWaiting} days waiting`,
            severity: item.urgency,
          }))}
          emptyMessage="No pending decisions."
        />
      )}

      {/* Next Period Plan */}
      <TaskListSection
        title="Plan for Next Period"
        icon={<CalendarDays size={16} className="text-primary-500" />}
        variant="default"
        items={content.nextPeriodPlan.map((item: any) => ({
          id: item.id,
          title: item.title,
          assignee: item.assigneeName,
          dueDate: item.plannedDate,
          projectName: item.projectName,
          severity: item.priority,
        }))}
        emptyMessage="No tasks planned for next period."
        maxItems={10}
      />

      {/* Project Breakdown (for portfolio reports) */}
      {content.projectBreakdown && content.projectBreakdown.length > 0 && (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700">
            <h3 className="font-semibold text-navy-900 dark:text-white">Project Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table
              /* §27-exempt: tabela dokumentowa/raportowa read-only, do druku/eksportu */ className="w-full"
            >
              <thead>
                <tr className="bg-slate-50 dark:bg-navy-800/50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Tasks
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Blockers
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Highlights
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                {content.projectBreakdown.map((project) => (
                  <tr key={project.projectId} className="hover:bg-slate-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3 font-medium text-navy-900 dark:text-white">
                      {project.projectName}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <RAGIndicator status={project.status} size="sm" showLabel />
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600 dark:text-slate-300">
                      {project.tasksCompleted}/{project.tasksTotal}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          project.blockers > 0
                            ? 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        }`}
                      >
                        {project.blockers}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                      {project.highlights.join(', ') || '—'}
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
        pmoDomain="PERFORMANCE_MONITORING"
        prince2Mapping="Checkpoint Report / Progress Theme"
      />
    </div>
  );
};

export default TeamMeetingReport;
