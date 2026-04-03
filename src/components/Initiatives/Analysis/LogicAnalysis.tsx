/**
 * LogicAnalysis — Dependency graph with conflict resolution
 * V3-F02: Portfolio quality gate — Logic sub-view
 * V3-F02b: Inline dependency management and AI fix actions
 */

import {
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '@/services/funnelAnalytics';

import type { AnalysisIssue, DependencyLink, QuickUpdatePayload } from './types';

interface LogicAnalysisProps {
  dependencies: DependencyLink[];
  issues: AnalysisIssue[];
  onOpenInitiative: (id: string) => void;
  onQuickUpdate?: (initiativeId: string, updates: QuickUpdatePayload) => Promise<void>;
}

export const LogicAnalysis: React.FC<LogicAnalysisProps> = ({
  dependencies,
  issues,
  onOpenInitiative,
  onQuickUpdate,
}) => {
  const { t } = useTranslation();
  const [applyingFix, setApplyingFix] = useState<string | null>(null);

  const handleIssueClick = (issue: AnalysisIssue) => {
    trackFunnelEvent('initiatives_analysis_issue_opened', {
      subview: 'logic',
      issueType: issue.issueType,
    });
    if (issue.initiativeId) onOpenInitiative(issue.initiativeId);
  };

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

  const criticalCount = issues.filter(
    (i) => i.severity === 'critical' || i.severity === 'high'
  ).length;

  const conflictingDeps = dependencies.filter((d) => d.hasTimingConflict);
  const healthyDeps = dependencies.filter((d) => !d.hasTimingConflict);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4">
          <div className="text-2xl font-semibold text-slate-900 dark:text-white">
            {dependencies.length}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('initiatives.analysis.logic.totalDeps', 'Total dependencies')}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4">
          <div className="text-2xl font-semibold text-red-600 dark:text-red-400">
            {conflictingDeps.length}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('initiatives.analysis.logic.timingConflicts', 'Timing conflicts')}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4">
          <div className="text-2xl font-semibold text-slate-900 dark:text-white">
            {criticalCount}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('initiatives.analysis.logic.criticalDependencyIssues', {
              count: criticalCount,
              defaultValue: '{{count}} critical issue(s)',
            })}
          </div>
        </div>
      </div>

      {/* Conflicting dependencies (highlighted) */}
      {conflictingDeps.length > 0 && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 overflow-hidden">
          <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-900/50">
            <h3 className="text-sm font-semibold text-red-700 dark:text-red-300">
              {t('initiatives.analysis.logic.conflictingDeps', 'Timing conflicts — requires attention')}
            </h3>
          </div>
          <div className="divide-y divide-red-100 dark:divide-red-900/30">
            {conflictingDeps.map((d) => (
              <div
                key={`${d.fromId}-${d.toId}`}
                className="flex items-center gap-3 px-4 py-3 text-sm bg-red-500/5 dark:bg-red-500/10"
              >
                <AlertTriangle size={14} className="text-red-500 shrink-0" />
                <button
                  onClick={() => onOpenInitiative(d.fromId)}
                  className="font-medium text-slate-900 dark:text-white truncate max-w-[160px] hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                  {d.fromName}
                </button>
                <ArrowRight size={16} className="text-red-400 shrink-0" />
                <button
                  onClick={() => onOpenInitiative(d.toId)}
                  className="text-slate-600 dark:text-slate-400 truncate max-w-[160px] hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                  {d.toName}
                </button>
                <span className="text-xs text-red-600 dark:text-red-400 font-medium ml-auto">
                  {t('initiatives.analysis.logic.conflict', 'Conflict')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Healthy dependency list */}
      {healthyDeps.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-navy-800/50 border-b border-slate-200 dark:border-navy-700">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t('initiatives.analysis.logic.dependencies', 'Dependencies')}
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-navy-800/50">
            {healthyDeps.map((d) => (
              <div
                key={`${d.fromId}-${d.toId}`}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <button
                  onClick={() => onOpenInitiative(d.fromId)}
                  className="font-medium text-slate-900 dark:text-white truncate max-w-[160px] hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                  {d.fromName}
                </button>
                <ArrowRight size={16} className="text-slate-400 shrink-0" />
                <button
                  onClick={() => onOpenInitiative(d.toId)}
                  className="text-slate-600 dark:text-slate-400 truncate max-w-[160px] hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                  {d.toName}
                </button>
                <span className="ml-auto text-xs text-emerald-600 dark:text-emerald-400">
                  {t('initiatives.analysis.logic.ok', 'OK')}
                </span>
              </div>
            ))}
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
