/**
 * TimelineAnalysis — Gantt-lite horizontal bars
 * V3-F02: Portfolio quality gate — Timeline sub-view
 */

import { AlertTriangle, ExternalLink, Lightbulb } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '@/services/funnelAnalytics';

import type { AnalysisIssue, TimelineBar } from './types';

interface TimelineAnalysisProps {
  bars: TimelineBar[];
  issues: AnalysisIssue[];
  onOpenInitiative: (id: string) => void;
}

const BAR_COLORS = {
  'on-schedule': 'bg-blue-500',
  delayed: 'bg-red-500',
  'at-risk': 'bg-amber-500',
  'no-dates': 'bg-slate-400 dark:bg-slate-500',
} as const;

export const TimelineAnalysis: React.FC<TimelineAnalysisProps> = ({
  bars,
  issues,
  onOpenInitiative,
}) => {
  const { t } = useTranslation();

  const handleIssueClick = (issue: AnalysisIssue) => {
    trackFunnelEvent('initiatives_analysis_issue_opened', {
      subview: 'timeline',
      issueType: issue.issueType,
    });
    if (issue.initiativeId) onOpenInitiative(issue.initiativeId);
  };

  const delayedCount = bars.filter((b) => b.status === 'delayed').length;
  const noDatesCount = bars.filter((b) => b.status === 'no-dates').length;
  const keyMetric = delayedCount + noDatesCount;

  // Compute timeline scale (earliest start to latest end)
  const dates = bars.flatMap((b) => [b.startDate, b.endDate].filter(Boolean) as string[]);
  const minDate = dates.length
    ? new Date(Math.min(...dates.map((d) => new Date(d).getTime())))
    : new Date();
  const maxDate = dates.length
    ? new Date(Math.max(...dates.map((d) => new Date(d).getTime())))
    : new Date();
  const totalMs = maxDate.getTime() - minDate.getTime() || 1;

  const getLeftPercent = (dateStr: string | null) => {
    if (!dateStr) return 0;
    const d = new Date(dateStr).getTime();
    return ((d - minDate.getTime()) / totalMs) * 100;
  };

  const getWidthPercent = (start: string | null, end: string | null) => {
    if (!start || !end) return 8;
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    return Math.max(8, ((e - s) / totalMs) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4">
        <div className="text-2xl font-semibold text-slate-900 dark:text-white">{keyMetric}</div>
        <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {t('initiatives.analysis.timeline.issuesCount', {
            count: keyMetric,
            defaultValue: '{{count}} timeline issue(s) (delayed or no dates)',
          })}
        </div>
      </div>

      {/* Gantt-lite bars */}
      {bars.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-navy-800/50 border-b border-slate-200 dark:border-navy-700">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t('initiatives.analysis.timeline.initiativeTimelines', 'Initiative timelines')}
            </h3>
          </div>
          <div className="p-4 space-y-3">
            {bars.map((bar) => (
              <div key={bar.initiativeId} className="flex items-center gap-4">
                <span className="w-40 shrink-0 text-sm font-medium text-slate-900 dark:text-white truncate">
                  {bar.initiativeName}
                </span>
                <div className="flex-1 min-w-0 h-8 relative bg-slate-100 dark:bg-navy-800 rounded-lg overflow-hidden">
                  {bar.startDate && bar.endDate ? (
                    <div
                      className={`absolute top-1 bottom-1 rounded-lg ${BAR_COLORS[bar.status]} min-w-[4px]`}
                      style={{
                        left: `${getLeftPercent(bar.startDate)}%`,
                        width: `${getWidthPercent(bar.startDate, bar.endDate)}%`,
                      }}
                    />
                  ) : (
                    <div
                      className={`absolute top-1 bottom-1 left-1/2 -translate-x-1/2 w-2 rounded-lg ${BAR_COLORS['no-dates']}`}
                    />
                  )}
                </div>
                <span
                  className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${
                    bar.status === 'delayed'
                      ? 'bg-red-500/20 text-red-700 dark:text-red-300'
                      : bar.status === 'at-risk'
                        ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                        : bar.status === 'no-dates'
                          ? 'bg-slate-500/20 text-slate-600 dark:text-slate-400'
                          : 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                  }`}
                >
                  {bar.status === 'delayed'
                    ? t('initiatives.analysis.timeline.delayed', 'Delayed')
                    : bar.status === 'at-risk'
                      ? t('initiatives.analysis.timeline.atRisk', 'At risk')
                      : bar.status === 'no-dates'
                        ? t('initiatives.analysis.timeline.noDates', 'No dates')
                        : t('initiatives.analysis.timeline.onSchedule', 'On schedule')}
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

      {bars.length === 0 && issues.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
          <AlertTriangle size={32} className="mb-3 opacity-50" />
          <p className="text-sm">
            {t('initiatives.analysis.timeline.noData', 'No timeline data available.')}
          </p>
        </div>
      )}
    </div>
  );
};
