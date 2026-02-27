/**
 * LogicAnalysis — Dependency graph (simplified list view)
 * V3-F02: Portfolio quality gate — Logic sub-view
 */

import { AlertTriangle, ArrowRight, ExternalLink, Lightbulb } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '@/services/funnelAnalytics';

import type { AnalysisIssue, DependencyLink } from './types';

interface LogicAnalysisProps {
  dependencies: DependencyLink[];
  issues: AnalysisIssue[];
  onOpenInitiative: (id: string) => void;
}

export const LogicAnalysis: React.FC<LogicAnalysisProps> = ({
  dependencies,
  issues,
  onOpenInitiative,
}) => {
  const { t } = useTranslation();

  const handleIssueClick = (issue: AnalysisIssue) => {
    trackFunnelEvent('initiatives_analysis_issue_opened', {
      subview: 'logic',
      issueType: issue.issueType,
    });
    if (issue.initiativeId) onOpenInitiative(issue.initiativeId);
  };

  const criticalCount = issues.filter(
    (i) => i.severity === 'critical' || i.severity === 'high'
  ).length;
  const keyMetric = criticalCount;

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4">
        <div className="text-2xl font-semibold text-slate-900 dark:text-white">{keyMetric}</div>
        <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {t('initiatives.analysis.logic.criticalDependencyIssues', {
            count: keyMetric,
            defaultValue: '{{count}} critical dependency issue(s)',
          })}
        </div>
      </div>

      {/* Dependency list */}
      {dependencies.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-navy-800/50 border-b border-slate-200 dark:border-navy-700">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t('initiatives.analysis.logic.dependencies', 'Dependencies')}
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-navy-800/50">
            {dependencies.map((d) => (
              <div
                key={`${d.fromId}-${d.toId}`}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <span className="font-medium text-slate-900 dark:text-white truncate max-w-[140px]">
                  {d.fromName}
                </span>
                <ArrowRight size={16} className="text-slate-400 shrink-0" />
                <span className="text-slate-600 dark:text-slate-400 truncate max-w-[140px]">
                  {d.toName}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Issues list */}
      {issues.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            {t('initiatives.analysis.issues', 'Issues')}
          </h3>
          <div className="space-y-2">
            {issues
              .sort((a, b) => {
                const order: Record<string, number> = {
                  critical: 0,
                  high: 1,
                  medium: 2,
                  low: 3,
                };
                return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
              })
              .map((issue) => (
                <div
                  key={issue.id}
                  className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-3 hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors"
                >
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium shrink-0 ${
                      issue.severity === 'critical'
                        ? 'bg-red-500/20 text-red-700 dark:text-red-300'
                        : issue.severity === 'high'
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                          : issue.severity === 'medium'
                            ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                            : 'bg-slate-500/20 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {issue.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900 dark:text-white">{issue.description}</p>
                    {issue.fixSuggestion && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                        <Lightbulb size={12} />
                        {issue.fixSuggestion}
                      </p>
                    )}
                  </div>
                  {issue.initiativeId && (
                    <button
                      onClick={() => handleIssueClick(issue)}
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 transition-colors"
                    >
                      <ExternalLink size={12} />
                      {t('initiatives.analysis.openInitiative', 'Open initiative')}
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {dependencies.length === 0 && issues.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
          <AlertTriangle size={32} className="mb-3 opacity-50" />
          <p className="text-sm">
            {t('initiatives.analysis.logic.noData', 'No dependency data available.')}
          </p>
        </div>
      )}
    </div>
  );
};
