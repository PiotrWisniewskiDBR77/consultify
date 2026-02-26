/**
 * FeasibilityAnalysis — Initiative vs feasibility dimensions matrix
 * V3-F02: Portfolio quality gate — Feasibility sub-view
 */

import { AlertTriangle, ExternalLink, Lightbulb } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '@/services/funnelAnalytics';

import type { AnalysisIssue, InitiativeFeasibility } from './types';

interface FeasibilityAnalysisProps {
  feasibilities: InitiativeFeasibility[];
  issues: AnalysisIssue[];
  onOpenInitiative: (id: string) => void;
}

const DIMENSION_COLORS = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
} as const;

export const FeasibilityAnalysis: React.FC<FeasibilityAnalysisProps> = ({
  feasibilities,
  issues,
  onOpenInitiative,
}) => {
  const { t } = useTranslation();

  const handleIssueClick = (issue: AnalysisIssue) => {
    trackFunnelEvent('initiatives_analysis_issue_opened', {
      subview: 'feasibility',
      issueType: issue.issueType,
    });
    if (issue.initiativeId) onOpenInitiative(issue.initiativeId);
  };

  const highRiskCount = feasibilities.filter((f) => f.overallScore < 50).length;
  const keyMetric = highRiskCount;

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4">
        <div className="text-2xl font-semibold text-slate-900 dark:text-white">{keyMetric}</div>
        <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {t('initiatives.analysis.feasibility.highRiskCount', {
            count: keyMetric,
            defaultValue: '{{count}} high-risk initiative(s)',
          })}
        </div>
      </div>

      {/* Feasibility matrix */}
      <div className="rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-navy-800/50 border-b border-slate-200 dark:border-navy-700">
              <th className="text-left px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                {t('initiatives.analysis.feasibility.initiative', 'Initiative')}
              </th>
              <th className="text-center px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                {t('initiatives.analysis.feasibility.budget', 'Budget')}
              </th>
              <th className="text-center px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                {t('initiatives.analysis.feasibility.skills', 'Skills')}
              </th>
              <th className="text-center px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                {t('initiatives.analysis.feasibility.time', 'Time')}
              </th>
              <th className="text-center px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                {t('initiatives.analysis.feasibility.risk', 'Risk')}
              </th>
              <th className="text-right px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                {t('initiatives.analysis.feasibility.score', 'Score')}
              </th>
            </tr>
          </thead>
          <tbody>
            {feasibilities.map((f) => (
              <tr
                key={f.initiativeId}
                className="border-b border-slate-100 dark:border-navy-800/50"
              >
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                  {f.initiativeName}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-block w-3 h-3 rounded-full ${DIMENSION_COLORS[f.dimensions.budget]}`}
                    title={f.dimensions.budget}
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-block w-3 h-3 rounded-full ${DIMENSION_COLORS[f.dimensions.skills]}`}
                    title={f.dimensions.skills}
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-block w-3 h-3 rounded-full ${DIMENSION_COLORS[f.dimensions.time]}`}
                    title={f.dimensions.time}
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-block w-3 h-3 rounded-full ${DIMENSION_COLORS[f.dimensions.risk]}`}
                    title={f.dimensions.risk}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={
                      f.overallScore < 50
                        ? 'font-semibold text-red-600 dark:text-red-400'
                        : f.overallScore < 75
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                    }
                  >
                    {f.overallScore}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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

      {feasibilities.length === 0 && issues.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
          <AlertTriangle size={32} className="mb-3 opacity-50" />
          <p className="text-sm">
            {t('initiatives.analysis.feasibility.noData', 'No feasibility data available.')}
          </p>
        </div>
      )}
    </div>
  );
};
