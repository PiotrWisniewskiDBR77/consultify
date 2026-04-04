/**
 * PortfolioAnalysisView — Main container for portfolio quality gate
 * V3-F02: Initiatives Portfolio Analysis
 *
 * 5 sub-views: Resources, Feasibility, Logic, Timeline, Completeness
 */

import { BarChart3, CheckCircle2, GitBranch, Target, Users } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '@/services/funnelAnalytics';
import type { PortfolioInitiative } from '@/types';

import { CompletenessAnalysis } from './CompletenessAnalysis';
import { FeasibilityAnalysis } from './FeasibilityAnalysis';
import { LogicAnalysis } from './LogicAnalysis';
import { ResourcesAnalysis } from './ResourcesAnalysis';
import { TimelineAnalysis } from './TimelineAnalysis';
import type { AnalysisSubview, OrgUser, QuickUpdatePayload } from './types';
import { useCompletenessRows } from './usePortfolioAnalysisData';
import { usePortfolioAnalysisData } from './usePortfolioAnalysisData';

interface PortfolioAnalysisViewProps {
  initiatives: PortfolioInitiative[];
  onOpenInitiative: (id: string) => void;
  onQuickUpdate?: (initiativeId: string, updates: QuickUpdatePayload) => Promise<void>;
  users?: OrgUser[];
}

const SUBVIEWS: { id: AnalysisSubview; labelKey: string; icon: React.ReactNode }[] = [
  { id: 'resources', labelKey: 'initiatives.analysis.resources.title', icon: <Users size={14} className="text-violet-400" /> },
  { id: 'feasibility', labelKey: 'initiatives.analysis.feasibility.title', icon: <Target size={14} className="text-amber-400" /> },
  { id: 'logic', labelKey: 'initiatives.analysis.logic.title', icon: <GitBranch size={14} className="text-cyan-400" /> },
  { id: 'timeline', labelKey: 'initiatives.analysis.timeline.title', icon: <BarChart3 size={14} className="text-emerald-400" /> },
  { id: 'completeness', labelKey: 'initiatives.analysis.completeness.title', icon: <CheckCircle2 size={14} className="text-rose-400" /> },
];

export const PortfolioAnalysisView: React.FC<PortfolioAnalysisViewProps> = ({
  initiatives,
  onOpenInitiative,
  onQuickUpdate,
  users = [],
}) => {
  const { t } = useTranslation();
  const [subview, setSubview] = useState<AnalysisSubview>('resources');
  const [actionButtons, setActionButtons] = useState<React.ReactNode>(null);
  const registerActions = useCallback((node: React.ReactNode) => setActionButtons(node), []);

  const {
    allocations,
    resourceIssues,
    feasibilities,
    feasibilityIssues,
    dependencies,
    logicIssues,
    bars,
    timelineIssues,
  } = usePortfolioAnalysisData(initiatives);

  const completenessRows = useCompletenessRows(
    initiatives as Array<PortfolioInitiative & { level?: string }>
  );

  const completenessIssues = completenessRows
    .filter((r) => !r.gateReady)
    .map((r) => ({
      id: `comp-${r.initiativeId}`,
      severity: r.missingCritical > 0 ? ('critical' as const) : ('high' as const),
      description: `${r.initiativeName} is ${100 - r.completeness}% incomplete (${r.missingCritical} critical missing)`,
      initiativeId: r.initiativeId,
      initiativeName: r.initiativeName,
      fixSuggestion: 'Review required fields in initiative detail',
      issueType: 'completeness' as const,
    }));

  useEffect(() => {
    trackFunnelEvent('initiatives_analysis_opened', { subview });
  }, [subview]);

  return (
    <div className="flex flex-col h-full">
      {/* Menu 3: sub-view chips (left) + action buttons (right) — §3.2/§3.3 canon */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-navy-900 border-b border-slate-200/60 dark:border-white/5">
        <div className="flex items-center gap-2">
          {SUBVIEWS.map((sv) => (
            <button
              key={sv.id}
              type="button"
              onClick={() => setSubview(sv.id)}
              className={`h-8 inline-flex items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium border transition-colors whitespace-nowrap ${
                subview === sv.id
                  ? 'bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-500/40'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50'
              }`}
            >
              {sv.icon}
              {t(sv.labelKey, sv.id.charAt(0).toUpperCase() + sv.id.slice(1))}
            </button>
          ))}
        </div>
        {actionButtons && (
          <div className="flex items-center gap-1.5 shrink-0">
            {actionButtons}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {subview === 'resources' && (
          <ResourcesAnalysis
            allocations={allocations}
            issues={resourceIssues}
            onOpenInitiative={onOpenInitiative}
            onQuickUpdate={onQuickUpdate}
            users={users}
            initiatives={initiatives}
            onRegisterActions={registerActions}
          />
        )}
        {subview === 'feasibility' && (
          <FeasibilityAnalysis
            feasibilities={feasibilities}
            issues={feasibilityIssues}
            onOpenInitiative={onOpenInitiative}
            onQuickUpdate={onQuickUpdate}
            users={users}
            onRegisterActions={registerActions}
          />
        )}
        {subview === 'logic' && (
          <LogicAnalysis
            dependencies={dependencies}
            issues={logicIssues}
            onOpenInitiative={onOpenInitiative}
            onQuickUpdate={onQuickUpdate}
            initiatives={initiatives}
            users={users}
            onRegisterActions={registerActions}
          />
        )}
        {subview === 'timeline' && (
          <TimelineAnalysis
            bars={bars}
            issues={timelineIssues}
            onOpenInitiative={onOpenInitiative}
            onQuickUpdate={onQuickUpdate}
            users={users}
            initiatives={initiatives}
            dependencies={dependencies}
            onRegisterActions={registerActions}
          />
        )}
        {subview === 'completeness' && (
          <CompletenessAnalysis
            initiatives={completenessRows}
            issues={completenessIssues}
            onOpenInitiative={onOpenInitiative}
            onQuickUpdate={onQuickUpdate}
            users={users}
            rawInitiatives={initiatives}
            onRegisterActions={registerActions}
          />
        )}
      </div>
    </div>
  );
};
