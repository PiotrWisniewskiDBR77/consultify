/**
 * PortfolioAnalysisView — Main container for portfolio quality gate
 * V3-F02: Initiatives Portfolio Analysis
 *
 * 5 sub-views: Resources, Feasibility, Logic, Timeline, Completeness
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  InitiativePreviewV3Body,
  InitiativePreviewV3Footer,
  type InitiativePreviewV3Model,
} from '@/components/Initiatives/InitiativePreviewV3';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import type { PortfolioInitiative } from '@/types';

import { AnalysisWorkspacePanel } from './AnalysisWorkspacePanel';
import { CompletenessAnalysis } from './CompletenessAnalysis';
import { FeasibilityAnalysis } from './FeasibilityAnalysis';
import { LogicAnalysis } from './LogicAnalysis';
import { PortfolioAnalysisTable } from './PortfolioAnalysisTable';
import { ResourcesAnalysis } from './ResourcesAnalysis';
import { TimelineAnalysis } from './TimelineAnalysis';
import type {
  AnalysisSubview,
  AnalysisWorkspacePanelConfig,
  OrgUser,
  QuickUpdatePayload,
} from './types';
import { useCompletenessRows } from './usePortfolioAnalysisData';
import { usePortfolioAnalysisData } from './usePortfolioAnalysisData';

interface PortfolioAnalysisViewProps {
  initiatives: PortfolioInitiative[];
  onOpenInitiative: (id: string) => void;
  onQuickUpdate?: (initiativeId: string, updates: QuickUpdatePayload) => Promise<void>;
  users?: OrgUser[];
  projectId?: string;
  /** Controlled sub-view from parent (lifted to Hub for Menu 3 chips) */
  subview: AnalysisSubview;
  /** Callback to register action buttons rendered in Menu 3 right side */
  onRegisterActions?: (node: React.ReactNode) => void;
}

interface PortfolioDependency {
  id: string;
  fromInitiativeId: string;
  toInitiativeId: string;
  type: string;
  projectId?: string | null;
}

type PreviewItem = PortfolioInitiative & { title: string };

export const PortfolioAnalysisView: React.FC<PortfolioAnalysisViewProps> = ({
  initiatives,
  onOpenInitiative,
  onQuickUpdate,
  users = [],
  projectId,
  subview,
  onRegisterActions,
}) => {
  const { t } = useTranslation();
  const [workspacePanel, setWorkspacePanel] = useState<AnalysisWorkspacePanelConfig | null>(null);
  const [previewInitiativeId, setPreviewInitiativeId] = useState<string | null>(null);
  const [portfolioDependencies, setPortfolioDependencies] = useState<PortfolioDependency[] | null>(
    null
  );

  const refreshPortfolioDependencies = useCallback(async () => {
    try {
      const query = projectId ? `?projectId=${projectId}` : '';
      const response = await Api.get(`/initiatives/portfolio/dependencies${query}`);
      setPortfolioDependencies(Array.isArray(response?.dependencies) ? response.dependencies : []);
    } catch (error) {
      console.error('[PortfolioAnalysisView] Failed to load portfolio dependencies:', error);
      setPortfolioDependencies(null);
    }
  }, [projectId]);

  useEffect(() => {
    void refreshPortfolioDependencies();
  }, [refreshPortfolioDependencies]);

  const handleCreateDependency = useCallback(
    async (predecessorId: string, successorId: string, type: string = 'FINISH_TO_START') => {
      await Api.post('/initiatives/portfolio/dependencies', {
        fromInitiativeId: predecessorId,
        toInitiativeId: successorId,
        type,
        projectId: projectId || null,
      });
      await refreshPortfolioDependencies();
    },
    [projectId, refreshPortfolioDependencies]
  );

  const handleDeleteDependency = useCallback(
    async (dependencyId: string) => {
      await Api.delete(`/initiatives/portfolio/dependencies/${dependencyId}`);
      await refreshPortfolioDependencies();
    },
    [refreshPortfolioDependencies]
  );

  const {
    allocations,
    resourceIssues,
    feasibilities,
    feasibilityIssues,
    dependencies,
    logicIssues,
    bars,
    timelineIssues,
  } = usePortfolioAnalysisData(initiatives, portfolioDependencies);

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

  const registerWorkspacePanel = useCallback((panel: AnalysisWorkspacePanelConfig | null) => {
    setWorkspacePanel(panel);
  }, []);

  useEffect(() => {
    setWorkspacePanel(null);
  }, [subview]);

  useEffect(() => {
    if (!previewInitiativeId) return;
    const previewStillExists = initiatives.some(
      (initiative) => initiative.id === previewInitiativeId
    );
    if (!previewStillExists) {
      setPreviewInitiativeId(null);
    }
  }, [initiatives, previewInitiativeId]);

  const previewInitiative = useMemo(
    () => initiatives.find((initiative) => initiative.id === previewInitiativeId) ?? null,
    [initiatives, previewInitiativeId]
  );

  const previewItem = useMemo<PreviewItem | null>(
    () =>
      previewInitiative
        ? ({ ...previewInitiative, title: previewInitiative.name } as PreviewItem)
        : null,
    [previewInitiative]
  );

  const previewItemIds = useMemo(
    () => initiatives.map((initiative) => initiative.id),
    [initiatives]
  );

  const getPreviewItemById = useCallback(
    (id: string): PreviewItem | null => {
      const initiative = initiatives.find((item) => item.id === id);
      return initiative ? ({ ...initiative, title: initiative.name } as PreviewItem) : null;
    },
    [initiatives]
  );

  const handlePreviewInitiative = useCallback((initiativeId: string) => {
    setPreviewInitiativeId(initiativeId);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewInitiativeId(null);
  }, []);

  const renderPreview = useCallback(
    (item: PreviewItem) => <InitiativePreviewV3Body initiative={getPreviewModel(item)} />,
    []
  );

  const renderPreviewFooter = useCallback(
    (item: PreviewItem) => (
      <InitiativePreviewV3Footer
        initiative={getPreviewModel(item)}
        tasksCount={Array.isArray((item as any).tasks) ? (item as any).tasks.length : undefined}
      />
    ),
    []
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* T26 R13 — canonical table (real initiatives). The five analysis
          subviews below are relocated, not deleted (surfaceRegister.ts T26
          relocateFromList: kpi-cards/portfolio-charts). */}
      <div className="h-1/2 min-h-[280px] shrink-0 overflow-hidden border-b border-slate-200 dark:border-navy-700">
        <PortfolioAnalysisTable initiatives={initiatives} onOpenInitiative={onOpenInitiative} />
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="flex h-full overflow-hidden">
          <div
            className={`min-w-0 flex-1 ${workspacePanel ? 'border-r border-slate-200 dark:border-navy-700' : ''}`}
          >
            <TableWithPreviewLayout<PreviewItem>
              selectedId={previewInitiativeId}
              selectedItem={previewItem}
              onSelect={(id) => {
                if (id) handlePreviewInitiative(id);
                else handleClosePreview();
              }}
              itemIds={previewItemIds}
              getItemById={getPreviewItemById}
              renderPreview={renderPreview}
              renderPreviewFooter={renderPreviewFooter}
            >
              <div className="h-full overflow-auto p-6">
                {subview === 'resources' && (
                  <ResourcesAnalysis
                    allocations={allocations}
                    issues={resourceIssues}
                    onOpenInitiative={handlePreviewInitiative}
                    onQuickUpdate={onQuickUpdate}
                    users={users}
                    initiatives={initiatives}
                    onRegisterActions={registerActions}
                    onRegisterWorkspacePanel={registerWorkspacePanel}
                  />
                )}
                {subview === 'feasibility' && (
                  <FeasibilityAnalysis
                    feasibilities={feasibilities}
                    issues={feasibilityIssues}
                    onOpenInitiative={handlePreviewInitiative}
                    onQuickUpdate={onQuickUpdate}
                    users={users}
                    onRegisterActions={registerActions}
                    onRegisterWorkspacePanel={registerWorkspacePanel}
                  />
                )}
                {subview === 'logic' && (
                  <LogicAnalysis
                    dependencies={dependencies}
                    issues={logicIssues}
                    onOpenInitiative={handlePreviewInitiative}
                    onQuickUpdate={onQuickUpdate}
                    onCreateDependency={handleCreateDependency}
                    onDeleteDependency={handleDeleteDependency}
                    initiatives={initiatives}
                    users={users}
                    onRegisterActions={registerActions}
                    onRegisterWorkspacePanel={registerWorkspacePanel}
                  />
                )}
                {subview === 'timeline' && (
                  <TimelineAnalysis
                    bars={bars}
                    issues={timelineIssues}
                    onOpenInitiative={handlePreviewInitiative}
                    onQuickUpdate={onQuickUpdate}
                    users={users}
                    initiatives={initiatives}
                    dependencies={dependencies}
                    onRegisterActions={registerActions}
                    onRegisterWorkspacePanel={registerWorkspacePanel}
                  />
                )}
                {subview === 'completeness' && (
                  <CompletenessAnalysis
                    initiatives={completenessRows}
                    issues={completenessIssues}
                    onOpenInitiative={handlePreviewInitiative}
                    onQuickUpdate={onQuickUpdate}
                    users={users}
                    rawInitiatives={initiatives}
                    onRegisterActions={registerActions}
                    onRegisterWorkspacePanel={registerWorkspacePanel}
                  />
                )}
              </div>
            </TableWithPreviewLayout>
          </div>

          {workspacePanel && (
            <div className="w-[460px] shrink-0 min-w-0 border-l border-slate-200 dark:border-navy-700">
              <AnalysisWorkspacePanel
                panel={workspacePanel}
                onClose={() => setWorkspacePanel(null)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function getPreviewModel(initiative: PortfolioInitiative): InitiativePreviewV3Model {
  return {
    id: initiative.id,
    name: initiative.name,
    status: initiative.status,
    axis: (initiative as any).axis,
    priority: (initiative as any).priority,
    progress: (initiative as any).progress ?? null,
    createdAt: (initiative as any).createdAt ?? null,
    updatedAt: (initiative as any).updatedAt ?? null,
    summary: (initiative as any).summary ?? null,
    description: (initiative as any).description ?? null,
    plannedStartDate: (initiative as any).plannedStartDate ?? null,
    plannedEndDate: (initiative as any).plannedEndDate ?? null,
    ownerBusiness: (initiative as any).ownerBusiness ?? null,
    ownerExecution: (initiative as any).ownerExecution ?? null,
    sourceType: (initiative as any).sourceType ?? (initiative as any).source_type ?? null,
    sourceId: (initiative as any).sourceId ?? (initiative as any).source_id ?? null,
  };
}
