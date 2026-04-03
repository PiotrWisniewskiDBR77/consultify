/**
 * TimelineAnalysis — Gantt-lite horizontal bars with inline date editing
 * V3-F02: Portfolio quality gate — Timeline sub-view
 * V3-F02b: Inline date management and owner display
 */

import {
  AlertTriangle,
  Calendar,
  Check,
  ExternalLink,
  Lightbulb,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '@/services/funnelAnalytics';

import type { AnalysisIssue, OrgUser, QuickUpdatePayload, TimelineBar } from './types';

interface TimelineAnalysisProps {
  bars: TimelineBar[];
  issues: AnalysisIssue[];
  onOpenInitiative: (id: string) => void;
  onQuickUpdate?: (initiativeId: string, updates: QuickUpdatePayload) => Promise<void>;
  users?: OrgUser[];
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
  onQuickUpdate,
  users = [],
}) => {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const [applyingFix, setApplyingFix] = useState<string | null>(null);

  const handleIssueClick = (issue: AnalysisIssue) => {
    trackFunnelEvent('initiatives_analysis_issue_opened', {
      subview: 'timeline',
      issueType: issue.issueType,
    });
    if (issue.initiativeId) onOpenInitiative(issue.initiativeId);
  };

  const startEditing = (bar: TimelineBar) => {
    setEditingId(bar.initiativeId);
    setEditStart(bar.startDate ? bar.startDate.slice(0, 10) : '');
    setEditEnd(bar.endDate ? bar.endDate.slice(0, 10) : '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditStart('');
    setEditEnd('');
  };

  const handleSaveDates = useCallback(
    async (initiativeId: string) => {
      if (!onQuickUpdate) return;
      if (editStart && editEnd && new Date(editStart) > new Date(editEnd)) {
        toast.error(
          t('initiatives.analysis.timeline.invalidDates', 'Start date must be before end date')
        );
        return;
      }
      setSaving(true);
      try {
        const updates: QuickUpdatePayload = {};
        if (editStart) updates.plannedStartDate = editStart;
        if (editEnd) updates.plannedEndDate = editEnd;
        await onQuickUpdate(initiativeId, updates);
        toast.success(t('initiatives.analysis.timeline.datesUpdated', 'Dates updated'));
        setEditingId(null);
      } catch {
        toast.error(t('initiatives.analysis.timeline.updateFailed', 'Failed to update dates'));
      } finally {
        setSaving(false);
      }
    },
    [editEnd, editStart, onQuickUpdate, t]
  );

  const handleApplyAiFix = useCallback(
    async (issue: AnalysisIssue) => {
      if (!onQuickUpdate || !issue.initiativeId || !issue.autoFixPayload) return;
      setApplyingFix(issue.id);
      try {
        await onQuickUpdate(issue.initiativeId, issue.autoFixPayload as QuickUpdatePayload);
        toast.success(t('initiatives.analysis.fixApplied', 'AI suggestion applied'));
      } catch {
        toast.error(t('initiatives.analysis.fixFailed', 'Failed to apply fix'));
      } finally {
        setApplyingFix(null);
      }
    },
    [onQuickUpdate, t]
  );

  const delayedCount = bars.filter((b) => b.status === 'delayed').length;
  const noDatesCount = bars.filter((b) => b.status === 'no-dates').length;
  const keyMetric = delayedCount + noDatesCount;

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

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    });
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

      {/* Gantt-lite bars with inline editing */}
      {bars.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-navy-800/50 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t('initiatives.analysis.timeline.initiativeTimelines', 'Initiative timelines')}
            </h3>
            {onQuickUpdate && (
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {t('initiatives.analysis.timeline.clickToEdit', 'Click dates to edit')}
              </span>
            )}
          </div>
          <div className="p-4 space-y-2">
            {bars.map((bar) => {
              const isEditing = editingId === bar.initiativeId;
              return (
                <div key={bar.initiativeId} className="space-y-1">
                  <div className="flex items-center gap-4">
                    <div className="w-44 shrink-0">
                      <span className="text-sm font-medium text-slate-900 dark:text-white truncate block">
                        {bar.initiativeName}
                      </span>
                      {bar.ownerName && (
                        <span className="text-xs text-slate-400 dark:text-slate-500 truncate block">
                          {bar.ownerName}
                        </span>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="date"
                          value={editStart}
                          onChange={(e) => setEditStart(e.target.value)}
                          className="px-2 py-1 text-xs bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                        />
                        <span className="text-xs text-slate-400">→</span>
                        <input
                          type="date"
                          value={editEnd}
                          onChange={(e) => setEditEnd(e.target.value)}
                          className="px-2 py-1 text-xs bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                        />
                        <button
                          onClick={() => handleSaveDates(bar.initiativeId)}
                          disabled={saving}
                          className="p-1 rounded text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="p-1 rounded text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
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
                        <div className="shrink-0 flex items-center gap-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {formatDate(bar.startDate)} – {formatDate(bar.endDate)}
                          </span>
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
                          {onQuickUpdate && (
                            <button
                              onClick={() => startEditing(bar)}
                              className="p-1 rounded text-slate-400 hover:text-primary-500 hover:bg-primary-500/10 transition-colors"
                              title={t('initiatives.analysis.timeline.editDates', 'Edit dates')}
                            >
                              <Calendar size={14} />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Issues list with AI fix */}
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
                  <div className="flex items-center gap-1 shrink-0">
                    {issue.autoFixPayload && onQuickUpdate && (
                      <button
                        onClick={() => handleApplyAiFix(issue)}
                        disabled={applyingFix === issue.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                      >
                        <Sparkles size={12} />
                        {applyingFix === issue.id
                          ? t('initiatives.analysis.applying', 'Applying...')
                          : t('initiatives.analysis.applyFix', 'Apply fix')}
                      </button>
                    )}
                    {issue.initiativeId && (
                      <button
                        onClick={() => handleIssueClick(issue)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 transition-colors"
                      >
                        <ExternalLink size={12} />
                        {t('initiatives.analysis.openInitiative', 'Open initiative')}
                      </button>
                    )}
                  </div>
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
