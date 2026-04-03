/**
 * ResourcesAnalysis — Resource allocation heatmap/table with inline management
 * V3-F02: Portfolio quality gate — Resources sub-view
 * V3-F02b: Inline owner reassignment and initiative management
 */

import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Lightbulb,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '@/services/funnelAnalytics';
import type { PortfolioInitiative } from '@/types';

import type { AnalysisIssue, OrgUser, QuickUpdatePayload, ResourceAllocation } from './types';

interface ResourcesAnalysisProps {
  allocations: ResourceAllocation[];
  issues: AnalysisIssue[];
  onOpenInitiative: (id: string) => void;
  onQuickUpdate?: (initiativeId: string, updates: QuickUpdatePayload) => Promise<void>;
  users?: OrgUser[];
  initiatives?: PortfolioInitiative[];
}

export const ResourcesAnalysis: React.FC<ResourcesAnalysisProps> = ({
  allocations,
  issues,
  onOpenInitiative,
  onQuickUpdate,
  users = [],
  initiatives = [],
}) => {
  const { t } = useTranslation();
  const [expandedResourceId, setExpandedResourceId] = useState<string | null>(null);
  const [reassigningInitId, setReassigningInitId] = useState<string | null>(null);
  const [selectedNewOwner, setSelectedNewOwner] = useState<string>('');
  const [applyingFix, setApplyingFix] = useState<string | null>(null);

  const handleIssueClick = (issue: AnalysisIssue) => {
    trackFunnelEvent('initiatives_analysis_issue_opened', {
      subview: 'resources',
      issueType: issue.issueType,
    });
    if (issue.initiativeId) onOpenInitiative(issue.initiativeId);
  };

  const handleReassignOwner = useCallback(
    async (initiativeId: string, newOwnerId: string, role: string) => {
      if (!onQuickUpdate || !newOwnerId) return;
      try {
        const updates: QuickUpdatePayload =
          role === 'Business Owner'
            ? { ownerBusinessId: newOwnerId }
            : { ownerExecutionId: newOwnerId };
        await onQuickUpdate(initiativeId, updates);
        toast.success(t('initiatives.analysis.resources.ownerReassigned', 'Owner reassigned'));
        setReassigningInitId(null);
        setSelectedNewOwner('');
      } catch {
        toast.error(
          t('initiatives.analysis.resources.reassignFailed', 'Failed to reassign owner')
        );
      }
    },
    [onQuickUpdate, t]
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

  const overallocatedCount = allocations.filter((a) => a.status === 'overallocated').length;

  const getInitiativeName = (id: string) => {
    const init = initiatives.find((i) => i.id === id);
    return init?.name ?? id;
  };

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4">
        <div className="text-2xl font-semibold text-slate-900 dark:text-white">
          {overallocatedCount}
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {t('initiatives.analysis.resources.overallocatedCount', {
            count: overallocatedCount,
            defaultValue: '{{count}} overallocated resource(s)',
          })}
        </div>
      </div>

      {/* Resource allocation table with expandable rows */}
      <div className="rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-navy-800/50 border-b border-slate-200 dark:border-navy-700">
              <th className="text-left px-4 py-3 font-medium text-slate-700 dark:text-slate-300 w-8" />
              <th className="text-left px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                {t('initiatives.analysis.resources.resource', 'Resource')}
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                {t('initiatives.analysis.resources.role', 'Role')}
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                {t('initiatives.analysis.resources.initiatives', 'Initiatives')}
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                {t('initiatives.analysis.resources.utilization', 'Utilization')}
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                {t('initiatives.analysis.resources.status', 'Status')}
              </th>
            </tr>
          </thead>
          <tbody>
            {allocations.map((a) => {
              const isExpanded = expandedResourceId === a.resourceId;
              return (
                <React.Fragment key={a.resourceId}>
                  <tr
                    className={`border-b border-slate-100 dark:border-navy-800/50 cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-800/30 ${
                      a.status === 'overallocated' ? 'bg-red-500/5 dark:bg-red-500/10' : ''
                    }`}
                    onClick={() =>
                      setExpandedResourceId(isExpanded ? null : a.resourceId)
                    }
                  >
                    <td className="px-4 py-3 text-slate-400">
                      {isExpanded ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {a.resourceName}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{a.role}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {a.allocatedInitiatives.length}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-200 dark:bg-navy-700 rounded-full max-w-[100px]">
                          <div
                            className={`h-2 rounded-full ${
                              a.utilizationPercent > 100
                                ? 'bg-red-500'
                                : a.utilizationPercent > 80
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                            }`}
                            style={{
                              width: `${Math.min(100, a.utilizationPercent)}%`,
                            }}
                          />
                        </div>
                        <span
                          className={
                            a.utilizationPercent > 100
                              ? 'font-semibold text-red-600 dark:text-red-400'
                              : 'text-slate-700 dark:text-slate-300'
                          }
                        >
                          {a.utilizationPercent}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          a.status === 'overallocated'
                            ? 'bg-red-500/20 text-red-700 dark:text-red-300'
                            : a.status === 'underutilized'
                              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                              : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {a.status === 'overallocated'
                          ? t('initiatives.analysis.resources.overallocated', 'Overallocated')
                          : a.status === 'underutilized'
                            ? t('initiatives.analysis.resources.underutilized', 'Underutilized')
                            : t('initiatives.analysis.resources.ok', 'OK')}
                      </span>
                    </td>
                  </tr>
                  {/* Expanded: list assigned initiatives with reassign option */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={6} className="px-0 py-0">
                        <div className="bg-slate-50/50 dark:bg-navy-900/50 border-b border-slate-200 dark:border-navy-700">
                          <div className="px-8 py-3 space-y-2">
                            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                              {t(
                                'initiatives.analysis.resources.assignedInitiatives',
                                'Assigned initiatives'
                              )}
                            </div>
                            {a.allocatedInitiatives.map((initId, idx) => {
                              const initName = getInitiativeName(initId);
                              const isReassigning = reassigningInitId === initId;
                              return (
                                <div
                                  key={initId}
                                  className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700"
                                >
                                  <span className="flex-1 text-sm font-medium text-slate-900 dark:text-white truncate">
                                    {initName}
                                  </span>
                                  {isReassigning ? (
                                    <div className="flex items-center gap-2">
                                      <select
                                        value={selectedNewOwner}
                                        onChange={(e) => setSelectedNewOwner(e.target.value)}
                                        className="px-2 py-1 text-xs bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <option value="">
                                          {t(
                                            'initiatives.analysis.resources.selectOwner',
                                            'Select new owner...'
                                          )}
                                        </option>
                                        {users
                                          .filter((u) => u.id !== a.resourceId)
                                          .map((u) => (
                                            <option key={u.id} value={u.id}>
                                              {u.firstName} {u.lastName}
                                            </option>
                                          ))}
                                      </select>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleReassignOwner(initId, selectedNewOwner, a.role);
                                        }}
                                        disabled={!selectedNewOwner}
                                        className="p-1 rounded text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-30"
                                      >
                                        <Check size={14} />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setReassigningInitId(null);
                                          setSelectedNewOwner('');
                                        }}
                                        className="p-1 rounded text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1">
                                      {onQuickUpdate && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setReassigningInitId(initId);
                                            setSelectedNewOwner('');
                                          }}
                                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                                          title={t(
                                            'initiatives.analysis.resources.reassign',
                                            'Reassign owner'
                                          )}
                                        >
                                          <UserPlus size={12} />
                                          {t('initiatives.analysis.resources.reassign', 'Reassign')}
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onOpenInitiative(initId);
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 transition-colors"
                                      >
                                        <ExternalLink size={12} />
                                        {t('initiatives.analysis.openInitiative', 'Open')}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
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

      {allocations.length === 0 && issues.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
          <AlertTriangle size={32} className="mb-3 opacity-50" />
          <p className="text-sm">
            {t('initiatives.analysis.resources.noData', 'No resource allocation data available.')}
          </p>
        </div>
      )}
    </div>
  );
};
