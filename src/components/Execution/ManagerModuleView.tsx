/**
 * ManagerModuleView — Table + Preview layout for each of the 6 manager lanes.
 *
 * Opens as a full-screen view. Fetches ManagerProblemRow[] from the backend.
 * Left: ProblemTable (filterable, sortable). Right: ProblemPreview (details + actions).
 */

import { Layers, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { getMenu3AiButtonClass } from '@/components/shared/ModuleHub/menu3ActionButtonStyles';

import { V8UnavailableBanner } from '@/components/shared/V8UnavailableBanner';
import { Api } from '../../services/api';
import {
  V8ExecutionControlApi,
  type V8ManagerProblemRow,
} from '../../services/api/v8/execution-control';
import {
  AiRecommendationPanel,
  type ManagementWorkspaceMode,
} from './Manager/AiRecommendationPanel';
import { ProblemPreview } from './Manager/ProblemPreview';
import { ProblemTable } from './Manager/ProblemTable';
import type { ManagerProblemRow, ProblemAction } from './Manager/types';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type ManagerModuleId =
  | 'action-queue'
  | 'decisions'
  | 'blockers'
  | 'workload'
  | 'risk'
  | 'people-change';

export interface ManagerModuleDef {
  id: ManagerModuleId;
  title: string;
  icon: React.ReactNode;
  metrics: Array<{
    label: string;
    value: number | string;
    variant?: 'default' | 'warn' | 'critical';
  }>;
  description: string;
}

interface ManagerModuleViewProps {
  moduleId: string;
  projectId?: string;
  onOpenEntity?: (entityType: string, entityId: string) => void;
  onRegisterActions?: (node: React.ReactNode) => void;
}

// ---------------------------------------------------------------------------
// DATA HOOK
// ---------------------------------------------------------------------------

function useManagerProblems(moduleId: string, projectId?: string) {
  const [rows, setRows] = useState<ManagerProblemRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProblems = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await V8ExecutionControlApi.getManagerProblems(moduleId, projectId);
      const data = (resp as any)?.data || resp;
      const problems: V8ManagerProblemRow[] = data?.problems || [];
      setRows(
        problems.map((p) => ({
          ...p,
          severity: p.severity as any,
          sourceEntityType: p.sourceEntityType as any,
          problemType: p.problemType as any,
          affectedEntities: (p.affectedEntities || []).map((e) => ({
            ...e,
            type: e.type as any,
          })),
          actions: (p.actions || []).map((a) => ({
            ...a,
            id: a.id as any,
            variant: (a.variant || 'default') as any,
          })),
        }))
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [moduleId, projectId]);

  useEffect(() => {
    fetchProblems();
  }, [fetchProblems]);

  return { rows, loading, refresh: fetchProblems };
}

const THIRD_WORKSPACE_CONFIG: Record<
  ManagerModuleId,
  { mode: ManagementWorkspaceMode; label: string; title: string }
> = {
  'action-queue': {
    mode: 'due-soon',
    label: 'Due Soon',
    title: 'Due Soon — items about to become active issues',
  },
  decisions: {
    mode: 'decision-pack',
    label: 'Decision Pack',
    title: 'Decision Pack — resolve approvals and blockers faster',
  },
  blockers: {
    mode: 'recovery-plan',
    label: 'Recovery Plan',
    title: 'Recovery Plan — unblock and recover delivery flow',
  },
  risk: {
    mode: 'watchlist',
    label: 'Watchlist',
    title: 'Watchlist — monitor early warning signals',
  },
  workload: {
    mode: 'rebalance',
    label: 'Rebalance',
    title: 'Rebalance — reduce overload and restore capacity balance',
  },
  'people-change': {
    mode: 'ownership-fix',
    label: 'Ownership Fix',
    title: 'Ownership Fix — close accountability and governance gaps',
  },
};

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------

export const ManagerModuleView: React.FC<ManagerModuleViewProps> = ({
  moduleId,
  projectId,
  onOpenEntity,
  onRegisterActions,
}) => {
  const { t } = useTranslation();
  const { rows, loading, refresh } = useManagerProblems(moduleId, projectId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Read-back state for manager decision approvals: decisionId -> outcome.
  const [decisionOutcomes, setDecisionOutcomes] = useState<Record<string, 'approved' | 'rejected'>>(
    {}
  );

  // workspace panel state
  const [workspaceMode, setWorkspaceMode] = useState<ManagementWorkspaceMode | null>(null);
  const [aiProblemId, setAiProblemId] = useState<string | undefined>();
  const thirdWorkspace = THIRD_WORKSPACE_CONFIG[moduleId as ManagerModuleId];

  const openAiRecommend = useCallback((problemId: string) => {
    setAiProblemId(problemId);
    setWorkspaceMode('recommend');
  }, []);

  const openAiTriage = useCallback(() => {
    setAiProblemId(undefined);
    setWorkspaceMode('triage');
  }, []);

  const openActionPlan = useCallback(() => {
    setAiProblemId(undefined);
    setWorkspaceMode('action-plan');
  }, []);

  const openThirdWorkspace = useCallback(() => {
    setAiProblemId(undefined);
    setWorkspaceMode(thirdWorkspace.mode);
  }, [thirdWorkspace.mode]);

  const closeWorkspacePanel = useCallback(() => {
    setWorkspaceMode(null);
    setAiProblemId(undefined);
  }, []);

  const toggleAiTriage = useCallback(() => {
    if (workspaceMode === 'triage') {
      closeWorkspacePanel();
      return;
    }
    openAiTriage();
  }, [closeWorkspacePanel, openAiTriage, workspaceMode]);

  const toggleActionPlan = useCallback(() => {
    if (workspaceMode === 'action-plan') {
      closeWorkspacePanel();
      return;
    }
    openActionPlan();
  }, [closeWorkspacePanel, openActionPlan, workspaceMode]);

  const toggleThirdWorkspace = useCallback(() => {
    if (workspaceMode === thirdWorkspace.mode) {
      closeWorkspacePanel();
      return;
    }
    openThirdWorkspace();
  }, [closeWorkspacePanel, openThirdWorkspace, thirdWorkspace.mode, workspaceMode]);

  const toggleAiRecommend = useCallback(
    (problemId: string) => {
      if (workspaceMode === 'recommend' && aiProblemId === problemId) {
        closeWorkspacePanel();
        return;
      }
      openAiRecommend(problemId);
    },
    [aiProblemId, closeWorkspacePanel, openAiRecommend, workspaceMode]
  );

  const selectedProblem = useMemo(
    () => rows.find((r) => r.id === selectedId) || null,
    [rows, selectedId]
  );

  const handleSelect = useCallback((row: ManagerProblemRow) => {
    setSelectedId(row.id);
  }, []);

  const handleDoubleClick = useCallback(
    (row: ManagerProblemRow) => {
      onOpenEntity?.(row.sourceEntityType, row.sourceEntityId);
    },
    [onOpenEntity]
  );

  const handleAction = useCallback(
    async (row: ManagerProblemRow, action: ProblemAction) => {
      if (action.id === 'open_entity') {
        onOpenEntity?.(row.sourceEntityType, row.sourceEntityId);
        return;
      }

      // Manager approval write-back: decision approve/reject posts directly to the
      // decisions API and surfaces a confirmed read-back badge (P0-7).
      if (
        row.sourceEntityType === 'DECISION' &&
        (action.id === 'approve' || action.id === 'reject')
      ) {
        const outcome = action.id === 'approve' ? 'approved' : 'rejected';
        try {
          await Api.decideDecision(row.sourceEntityId, outcome);
          setDecisionOutcomes((prev) => ({ ...prev, [row.sourceEntityId]: outcome }));
          toast.success(
            outcome === 'approved'
              ? t('execution.manager.decision.approved', 'Decision approved')
              : t('execution.manager.decision.rejected', 'Decision rejected')
          );
        } catch (error) {
          const message =
            error instanceof Error && error.message
              ? error.message
              : t('execution.manager.actionFailed', 'Action failed');
          toast.error(message);
        }
        refresh();
        return;
      }

      try {
        const resp = await V8ExecutionControlApi.executeManagerProblemAction(
          moduleId,
          { problemId: row.id, actionId: action.id },
          projectId
        );
        const result = (resp as { data?: { message?: string } }).data || resp;
        toast.success(result.message || t('execution.manager.actionApplied', 'Action applied'));
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : t('execution.manager.actionFailed', 'Action failed');
        toast.error(message);
      }
      refresh();
    },
    [moduleId, onOpenEntity, projectId, refresh, t]
  );

  const handlePreviewAction = useCallback(
    (action: ProblemAction) => {
      if (selectedProblem) handleAction(selectedProblem, action);
    },
    [selectedProblem, handleAction]
  );

  useEffect(() => {
    if (!onRegisterActions) return;
    onRegisterActions(
      <>
        <button
          type="button"
          onClick={toggleAiTriage}
          disabled={loading || rows.length === 0}
          className={getMenu3AiButtonClass(workspaceMode === 'triage')}
          title="AI Triage — cluster and prioritize problems"
        >
          <Layers size={12} />
          AI Triage
        </button>
        <button
          type="button"
          onClick={toggleActionPlan}
          disabled={loading || rows.length === 0}
          className={getMenu3AiButtonClass(workspaceMode === 'action-plan')}
          title="Action Plan — operational moves and follow-up"
        >
          <Sparkles size={12} />
          Action Plan
        </button>
        <button
          type="button"
          onClick={toggleThirdWorkspace}
          disabled={loading || rows.length === 0}
          className={getMenu3AiButtonClass(workspaceMode === thirdWorkspace.mode)}
          title={thirdWorkspace.title}
        >
          <Sparkles size={12} />
          {thirdWorkspace.label}
        </button>
      </>
    );
    return () => onRegisterActions(null);
  }, [
    loading,
    onRegisterActions,
    rows.length,
    thirdWorkspace.label,
    thirdWorkspace.mode,
    thirdWorkspace.title,
    toggleActionPlan,
    toggleAiTriage,
    toggleThirdWorkspace,
    workspaceMode,
  ]);

  return (
    <V8UnavailableBanner moduleName="Manager Cockpit">
    <div className="h-full flex flex-col bg-c-bg overflow-hidden">
      {/* ─── Body: Table + Preview ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Table (left) */}
        <div
          className={`flex-1 min-w-0 ${
            selectedProblem || workspaceMode ? 'border-r border-c-border-subtle' : ''
          }`}
        >
          <ProblemTable
            rows={rows}
            selectedId={selectedId}
            onSelect={handleSelect}
            onDoubleClick={handleDoubleClick}
            onAction={handleAction}
            loading={loading}
            emptyMessage={
              loading
                ? undefined
                : t('manager.noProblems', 'No problems detected — everything is on track.')
            }
          />
        </div>

        {/* Preview (right) */}
        {!workspaceMode && selectedProblem && (
          <div className="w-[380px] shrink-0 flex flex-col">
            <ProblemPreview
              problem={selectedProblem}
              onAction={handlePreviewAction}
              onClose={() => setSelectedId(null)}
              onOpenEntity={onOpenEntity}
              confirmedOutcome={
                selectedProblem.sourceEntityType === 'DECISION'
                  ? decisionOutcomes[selectedProblem.sourceEntityId]
                  : undefined
              }
            />
            {/* AI Suggest button at bottom of preview */}
            <div className="shrink-0 border-t border-c-border-subtle px-3 py-2">
              <button
                type="button"
                onClick={() => toggleAiRecommend(selectedProblem.id)}
                className={`${getMenu3AiButtonClass(
                  workspaceMode === 'recommend' && aiProblemId === selectedProblem.id
                )} w-full justify-center`}
              >
                <Sparkles size={13} />
                {t('execution.manager.ai.suggest', 'AI — How to manage this?')}
              </button>
            </div>
          </div>
        )}

        {workspaceMode && (
          <div className="w-[460px] shrink-0 min-w-0 border-l border-c-border-subtle">
            <AiRecommendationPanel
              isOpen={Boolean(workspaceMode)}
              onClose={closeWorkspacePanel}
              mode={workspaceMode}
              laneId={moduleId}
              problemId={aiProblemId}
              projectId={projectId}
              rows={rows}
              onSelectProblem={(problemId) => {
                const row = rows.find((item) => item.id === problemId);
                if (row) {
                  setSelectedId(problemId);
                  setAiProblemId(undefined);
                  setWorkspaceMode(null);
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
    </V8UnavailableBanner>
  );
};
