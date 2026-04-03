/**
 * FeasibilityAnalysis — Initiative vs feasibility dimensions matrix
 * V3-F02: Portfolio quality gate — Feasibility sub-view
 * V3-F02b: Expandable rows with inline quick-edit for budget, owner, dates
 */

import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '@/services/funnelAnalytics';

import type { AnalysisIssue, InitiativeFeasibility, OrgUser, QuickUpdatePayload } from './types';

interface FeasibilityAnalysisProps {
  feasibilities: InitiativeFeasibility[];
  issues: AnalysisIssue[];
  onOpenInitiative: (id: string) => void;
  onQuickUpdate?: (initiativeId: string, updates: QuickUpdatePayload) => Promise<void>;
  users?: OrgUser[];
}

const DIMENSION_COLORS = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
} as const;

const DIMENSION_LABELS = {
  green: 'Good',
  amber: 'Needs attention',
  red: 'Critical',
} as const;

export const FeasibilityAnalysis: React.FC<FeasibilityAnalysisProps> = ({
  feasibilities,
  issues,
  onOpenInitiative,
  onQuickUpdate,
  users = [],
}) => {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editBudget, setEditBudget] = useState<string>('');
  const [editOwner, setEditOwner] = useState<string>('');
  const [editStartDate, setEditStartDate] = useState<string>('');
  const [editEndDate, setEditEndDate] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [applyingFix, setApplyingFix] = useState<string | null>(null);

  const handleIssueClick = (issue: AnalysisIssue) => {
    trackFunnelEvent('initiatives_analysis_issue_opened', {
      subview: 'feasibility',
      issueType: issue.issueType,
    });
    if (issue.initiativeId) onOpenInitiative(issue.initiativeId);
  };

  const toggleExpand = (f: InitiativeFeasibility) => {
    if (expandedId === f.initiativeId) {
      setExpandedId(null);
    } else {
      setExpandedId(f.initiativeId);
      setEditBudget(f.budget != null ? String(f.budget) : '');
      setEditOwner('');
      setEditStartDate(f.plannedStartDate ? f.plannedStartDate.slice(0, 10) : '');
      setEditEndDate(f.plannedEndDate ? f.plannedEndDate.slice(0, 10) : '');
    }
  };

  const handleSaveChanges = useCallback(
    async (initiativeId: string) => {
      if (!onQuickUpdate) return;
      setSaving(true);
      try {
        const updates: QuickUpdatePayload = {};
        if (editBudget !== '') updates.budget = Number(editBudget);
        if (editOwner) updates.ownerBusinessId = editOwner;
        if (editStartDate) updates.plannedStartDate = editStartDate;
        if (editEndDate) updates.plannedEndDate = editEndDate;

        if (Object.keys(updates).length === 0) {
          setExpandedId(null);
          return;
        }

        await onQuickUpdate(initiativeId, updates);
        toast.success(t('initiatives.analysis.feasibility.updated', 'Initiative updated'));
        setExpandedId(null);
      } catch {
        toast.error(
          t('initiatives.analysis.feasibility.updateFailed', 'Failed to update initiative')
        );
      } finally {
        setSaving(false);
      }
    },
    [editBudget, editEndDate, editOwner, editStartDate, onQuickUpdate, t]
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

  const highRiskCount = feasibilities.filter((f) => f.overallScore < 50).length;

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4">
        <div className="text-2xl font-semibold text-slate-900 dark:text-white">{highRiskCount}</div>
        <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {t('initiatives.analysis.feasibility.highRiskCount', {
            count: highRiskCount,
            defaultValue: '{{count}} high-risk initiative(s)',
          })}
        </div>
      </div>

      {/* Feasibility matrix with expandable rows */}
      <div className="rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-navy-800/50 border-b border-slate-200 dark:border-navy-700">
              <th className="text-left px-4 py-3 font-medium text-slate-700 dark:text-slate-300 w-8" />
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
            {feasibilities.map((f) => {
              const isExpanded = expandedId === f.initiativeId;
              return (
                <React.Fragment key={f.initiativeId}>
                  <tr
                    className={`border-b border-slate-100 dark:border-navy-800/50 cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-800/30 ${
                      f.overallScore < 50 ? 'bg-red-500/5 dark:bg-red-500/10' : ''
                    }`}
                    onClick={() => toggleExpand(f)}
                  >
                    <td className="px-4 py-3 text-slate-400">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {f.initiativeName}
                      </div>
                      {f.ownerName && (
                        <div className="text-xs text-slate-400 dark:text-slate-500">{f.ownerName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block w-3 h-3 rounded-full ${DIMENSION_COLORS[f.dimensions.budget]}`}
                        title={DIMENSION_LABELS[f.dimensions.budget]}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block w-3 h-3 rounded-full ${DIMENSION_COLORS[f.dimensions.skills]}`}
                        title={DIMENSION_LABELS[f.dimensions.skills]}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block w-3 h-3 rounded-full ${DIMENSION_COLORS[f.dimensions.time]}`}
                        title={DIMENSION_LABELS[f.dimensions.time]}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block w-3 h-3 rounded-full ${DIMENSION_COLORS[f.dimensions.risk]}`}
                        title={DIMENSION_LABELS[f.dimensions.risk]}
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
                  {isExpanded && (
                    <tr>
                      <td colSpan={7} className="px-0 py-0">
                        <div className="bg-slate-50/50 dark:bg-navy-900/50 border-b border-slate-200 dark:border-navy-700 px-8 py-4">
                          {onQuickUpdate ? (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                                    {t('initiatives.analysis.feasibility.budgetLabel', 'Budget')}
                                  </label>
                                  <input
                                    type="number"
                                    value={editBudget}
                                    onChange={(e) => setEditBudget(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full px-3 py-2 text-sm bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                                    placeholder="0"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                                    {t(
                                      'initiatives.analysis.feasibility.businessOwner',
                                      'Business Owner'
                                    )}
                                  </label>
                                  <select
                                    value={editOwner}
                                    onChange={(e) => setEditOwner(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full px-3 py-2 text-sm bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                                  >
                                    <option value="">
                                      {f.ownerName ||
                                        t('initiatives.analysis.feasibility.noChange', 'No change')}
                                    </option>
                                    {users.map((u) => (
                                      <option key={u.id} value={u.id}>
                                        {u.firstName} {u.lastName}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                                    {t('initiatives.analysis.feasibility.startDate', 'Start date')}
                                  </label>
                                  <input
                                    type="date"
                                    value={editStartDate}
                                    onChange={(e) => setEditStartDate(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full px-3 py-2 text-sm bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                                    {t('initiatives.analysis.feasibility.endDate', 'End date')}
                                  </label>
                                  <input
                                    type="date"
                                    value={editEndDate}
                                    onChange={(e) => setEditEndDate(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full px-3 py-2 text-sm bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSaveChanges(f.initiativeId);
                                  }}
                                  disabled={saving}
                                  className="px-4 py-2 text-xs font-medium rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50"
                                >
                                  {saving
                                    ? t('initiatives.analysis.saving', 'Saving...')
                                    : t('initiatives.analysis.saveChanges', 'Save changes')}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedId(null);
                                  }}
                                  className="px-4 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                                >
                                  {t('initiatives.analysis.cancel', 'Cancel')}
                                </button>
                                <div className="ml-auto">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenInitiative(f.initiativeId);
                                    }}
                                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 transition-colors"
                                  >
                                    <ExternalLink size={12} />
                                    {t('initiatives.analysis.openFull', 'Open full view')}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-4">
                              <span className="text-sm text-slate-600 dark:text-slate-400">
                                {f.ownerName && `Owner: ${f.ownerName}`}
                                {f.budget != null && ` · Budget: ${f.budget.toLocaleString()}`}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenInitiative(f.initiativeId);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 transition-colors"
                              >
                                <ExternalLink size={12} />
                                {t('initiatives.analysis.openInitiative', 'Open initiative')}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Issues list with AI fix actions */}
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
