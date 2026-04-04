/**
 * PortfolioAnalysisView — Main container for portfolio quality gate
 * V3-F02: Initiatives Portfolio Analysis
 *
 * 5 sub-views: Resources, Feasibility, Logic, Timeline, Completeness
 */

import React, { useCallback, useEffect } from 'react';

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
  /** Controlled sub-view from parent (lifted to Hub for Menu 3 chips) */
  subview: AnalysisSubview;
  /** Callback to register action buttons rendered in Menu 3 right side */
  onRegisterActions?: (node: React.ReactNode) => void;
}

export const PortfolioAnalysisView: React.FC<PortfolioAnalysisViewProps> = ({
  initiatives,
  onOpenInitiative,
  onQuickUpdate,
  users = [],
  subview,
  onRegisterActions,
}) => {
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

  const registerActions = useCallback(
    (node: React.ReactNode) => onRegisterActions?.(node),
    [onRegisterActions]
  );

  return (
    <div className="flex flex-col h-full">
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
