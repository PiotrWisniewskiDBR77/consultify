/**
 * PortfolioAnalysisView — Main container for portfolio quality gate
 * V3-F02: Initiatives Portfolio Analysis
 *
 * 5 sub-views: Resources, Feasibility, Logic, Timeline, Completeness
 */

import { BarChart3, CheckCircle2, ChevronRight, GitBranch, Target, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';
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

const SUBVIEWS: { id: AnalysisSubview; labelKey: string; descKey: string; icon: React.ReactNode }[] = [
  { id: 'resources', labelKey: 'initiatives.analysis.resources.title', descKey: 'initiatives.analysis.resources.desc', icon: <Users size={20} className="text-violet-500" /> },
  { id: 'feasibility', labelKey: 'initiatives.analysis.feasibility.title', descKey: 'initiatives.analysis.feasibility.desc', icon: <Target size={20} className="text-amber-500" /> },
  { id: 'logic', labelKey: 'initiatives.analysis.logic.title', descKey: 'initiatives.analysis.logic.desc', icon: <GitBranch size={20} className="text-cyan-500" /> },
  { id: 'timeline', labelKey: 'initiatives.analysis.timeline.title', descKey: 'initiatives.analysis.timeline.desc', icon: <BarChart3 size={20} className="text-emerald-500" /> },
  { id: 'completeness', labelKey: 'initiatives.analysis.completeness.title', descKey: 'initiatives.analysis.completeness.desc', icon: <CheckCircle2 size={20} className="text-rose-500" /> },
];

const SUBVIEW_DESCS: Record<AnalysisSubview, string> = {
  resources: 'Team allocation, workload balance, and capacity gaps.',
  feasibility: 'Feasibility scores, risk flags, and readiness gates.',
  logic: 'Dependency chains, circular refs, and logic integrity.',
  timeline: 'Schedule health, milestone drift, and critical path.',
  completeness: 'Data quality, missing fields, and gate readiness.',
};

export const PortfolioAnalysisView: React.FC<PortfolioAnalysisViewProps> = ({
  initiatives,
  onOpenInitiative,
  onQuickUpdate,
  users = [],
}) => {
  const { t } = useTranslation();
  const [subview, setSubview] = useState<AnalysisSubview>('resources');

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
      {/* Sub-view tile cards — DBR77 style matching Management cockpit */}
      <div className="shrink-0 p-4 border-b border-slate-200 dark:border-navy-700 bg-slate-50/50 dark:bg-navy-900/30">
        <div className="flex items-stretch gap-3 overflow-x-auto">
          {SUBVIEWS.map((sv) => {
            const active = subview === sv.id;
            return (
              <button
                key={sv.id}
                type="button"
                onClick={() => setSubview(sv.id)}
                className={[
                  'group text-left rounded-xl border p-4 min-w-[180px] flex-1 transition-all',
                  active
                    ? 'bg-white dark:bg-navy-900 border-primary-500/40 shadow-sm ring-1 ring-primary-500/20'
                    : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 hover:shadow-md hover:border-cyan-500/40 dark:hover:border-cyan-400/30',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className={[
                    'shrink-0 w-9 h-9 flex items-center justify-center rounded-xl transition-colors',
                    active
                      ? 'bg-primary-500/10'
                      : 'bg-slate-100 dark:bg-navy-800 group-hover:bg-cyan-50 dark:group-hover:bg-cyan-900/20',
                  ].join(' ')}>
                    {sv.icon}
                  </div>
                  <ChevronRight size={14} className={[
                    'transition-colors mt-1',
                    active ? 'text-primary-500' : 'text-slate-300 dark:text-slate-600 group-hover:text-cyan-500',
                  ].join(' ')} />
                </div>
                <h3 className={[
                  'text-sm font-semibold mb-0.5',
                  active ? 'text-primary-600 dark:text-primary-400' : 'text-slate-900 dark:text-white',
                ].join(' ')}>
                  {t(sv.labelKey, sv.id.charAt(0).toUpperCase() + sv.id.slice(1))}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t(sv.descKey, SUBVIEW_DESCS[sv.id])}
                </p>
              </button>
            );
          })}
        </div>
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
          />
        )}
        {subview === 'feasibility' && (
          <FeasibilityAnalysis
            feasibilities={feasibilities}
            issues={feasibilityIssues}
            onOpenInitiative={onOpenInitiative}
            onQuickUpdate={onQuickUpdate}
            users={users}
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
          />
        )}
      </div>
    </div>
  );
};
