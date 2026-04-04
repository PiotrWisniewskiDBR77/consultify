/**
 * ManagerModuleView — Table + Preview layout for each of the 6 manager lanes.
 *
 * Opens as a full-screen view. Fetches ManagerProblemRow[] from the backend.
 * Left: ProblemTable (filterable, sortable). Right: ProblemPreview (details + actions).
 */

import {
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  Layers,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getMenu3AiButtonClass } from '@/components/shared/ModuleHub/menu3ActionButtonStyles';

import {
  V8ExecutionControlApi,
  type V8ManagerProblemRow,
} from '../../services/api/v8/execution-control';
import { AiRecommendationPanel } from './Manager/AiRecommendationPanel';
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
  metrics: Array<{ label: string; value: number | string; variant?: 'default' | 'warn' | 'critical' }>;
  description: string;
}

interface ManagerModuleViewProps {
  moduleId: string;
  projectId?: string;
  onBack: () => void;
  onOpenEntity?: (entityType: string, entityId: string) => void;
  onRegisterActions?: (node: React.ReactNode) => void;
}

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

const MODULE_ICONS: Record<string, React.ReactNode> = {
  'action-queue': <ClipboardList size={16} className="text-amber-500" />,
  decisions: <Scale size={16} className="text-indigo-500" />,
  blockers: <AlertTriangle size={16} className="text-rose-500" />,
  workload: <Target size={16} className="text-blue-500" />,
  risk: <Shield size={16} className="text-orange-500" />,
  'people-change': <Users size={16} className="text-emerald-500" />,
};

const MODULE_TITLES: Record<string, string> = {
  'action-queue': 'Action Queue',
  decisions: 'Decisions & Approvals',
  blockers: 'Blockers & Escalations',
  workload: 'Resource & Workload',
  risk: 'Execution Risk',
  'people-change': 'People & Change',
};

const MODULE_DESCRIPTIONS: Record<string, string> = {
  'action-queue': 'Overdue tasks, blocked items, and critical issues requiring immediate attention.',
  decisions: 'Pending, overdue, and deferred decisions blocking progress.',
  blockers: 'Blocked initiatives, tasks, dependencies, and critical issues.',
  workload: 'Overloaded team members, unassigned tasks, missing estimates.',
  risk: 'Open risks, overdue initiatives, missing baselines, stale items.',
  'people-change': 'Missing owners, sponsors, dates, and bus-factor risks.',
};

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

  useEffect(() => { fetchProblems(); }, [fetchProblems]);

  return { rows, loading, refresh: fetchProblems };
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------

export const ManagerModuleView: React.FC<ManagerModuleViewProps> = ({
  moduleId,
  projectId,
  onBack,
  onOpenEntity,
  onRegisterActions,
}) => {
  const { t } = useTranslation();
  const icon = MODULE_ICONS[moduleId];
  const title = MODULE_TITLES[moduleId] || moduleId;
  const description = MODULE_DESCRIPTIONS[moduleId] || '';

  const { rows, loading, refresh } = useManagerProblems(moduleId, projectId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // AI panel state
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiPanelMode, setAiPanelMode] = useState<'recommend' | 'triage' | 'manage-all'>('manage-all');
  const [aiProblemId, setAiProblemId] = useState<string | undefined>();

  const openAiRecommend = useCallback((problemId: string) => {
    setAiProblemId(problemId);
    setAiPanelMode('recommend');
    setAiPanelOpen(true);
  }, []);

  const openAiTriage = useCallback(() => {
    setAiProblemId(undefined);
    setAiPanelMode('triage');
    setAiPanelOpen(true);
  }, []);

  const openAiManageAll = useCallback(() => {
    setAiProblemId(undefined);
    setAiPanelMode('manage-all');
    setAiPanelOpen(true);
  }, []);

  const closeAiPanel = useCallback(() => {
    setAiPanelOpen(false);
    setAiProblemId(undefined);
  }, []);

  const toggleAiTriage = useCallback(() => {
    if (aiPanelOpen && aiPanelMode === 'triage') {
      closeAiPanel();
      return;
    }
    openAiTriage();
  }, [aiPanelMode, aiPanelOpen, closeAiPanel, openAiTriage]);

  const toggleAiManageAll = useCallback(() => {
    if (aiPanelOpen && aiPanelMode === 'manage-all') {
      closeAiPanel();
      return;
    }
    openAiManageAll();
  }, [aiPanelMode, aiPanelOpen, closeAiPanel, openAiManageAll]);

  const toggleAiRecommend = useCallback(
    (problemId: string) => {
      if (
        aiPanelOpen &&
        aiPanelMode === 'recommend' &&
        aiProblemId === problemId
      ) {
        closeAiPanel();
        return;
      }
      openAiRecommend(problemId);
    },
    [aiPanelMode, aiPanelOpen, aiProblemId, closeAiPanel, openAiRecommend]
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
      try {
        const et = row.sourceEntityType === 'TASK' ? 'TASK' : 'INITIATIVE';
        const eid = row.sourceEntityId;

        switch (action.id) {
          case 'replan':
            await V8ExecutionControlApi.interveneReplan({
              entityId: eid,
              newDeadline: '',
              reason: `Manager action: replan ${row.title}`,
            });
            break;
          case 'reassign':
          case 'distribute_work':
          case 'assign_owner':
          case 'assign_sponsor':
          case 'assign_maker':
            break;
          case 'escalate':
            await V8ExecutionControlApi.interveneEscalate({
              entityId: eid,
              severity: row.severity,
              message: `Escalation: ${row.title}. ${row.rootCause}`,
            });
            break;
          case 'approve':
            if (row.sourceEntityType === 'DECISION') {
              await V8ExecutionControlApi.submitLaneDecision(moduleId, {
                suggestionId: row.sourceEntityId,
                state: 'approved',
              });
            }
            break;
          case 'reject':
            if (row.sourceEntityType === 'DECISION') {
              await V8ExecutionControlApi.submitLaneDecision(moduleId, {
                suggestionId: row.sourceEntityId,
                state: 'rejected',
              });
            }
            break;
          case 'defer':
            if (row.sourceEntityType === 'DECISION') {
              await V8ExecutionControlApi.submitLaneDecision(moduleId, {
                suggestionId: row.sourceEntityId,
                state: 'deferred',
              });
            }
            break;
          case 'open_entity':
            onOpenEntity?.(row.sourceEntityType, row.sourceEntityId);
            break;
          case 'create_mitigation':
          case 'mark_mitigated':
            if (row.sourceEntityType === 'RAID_ITEM') {
              await V8ExecutionControlApi.updateRaidMitigation(
                row.sourceEntityId,
                {
                  raidItemId: row.sourceEntityId,
                  mitigationStatus: action.id === 'mark_mitigated' ? 'MITIGATED' : 'IN_PROGRESS',
                }
              );
            }
            break;
          default:
            break;
        }
      } catch {
        // silently fail — action may not be supported yet
      }
      refresh();
    },
    [moduleId, refresh, onOpenEntity]
  );

  const handlePreviewAction = useCallback(
    (action: ProblemAction) => {
      if (selectedProblem) handleAction(selectedProblem, action);
    },
    [selectedProblem, handleAction]
  );

  const counts = useMemo(() => ({
    critical: rows.filter((r) => r.severity === 'critical').length,
    warning: rows.filter((r) => r.severity === 'warning').length,
    info: rows.filter((r) => r.severity === 'info').length,
  }), [rows]);

  useEffect(() => {
    if (!onRegisterActions) return;
    onRegisterActions(
      <>
        <button
          type="button"
          onClick={toggleAiTriage}
          disabled={loading || rows.length === 0}
          className={getMenu3AiButtonClass(aiPanelOpen && aiPanelMode === 'triage')}
          title="AI Triage — cluster and prioritize problems"
        >
          <Layers size={12} />
          AI Triage
        </button>
        <button
          type="button"
          onClick={toggleAiManageAll}
          disabled={loading || rows.length === 0}
          className={getMenu3AiButtonClass(aiPanelOpen && aiPanelMode === 'manage-all')}
          title="AI Manage All — comprehensive management plan"
        >
          <Sparkles size={12} />
          AI Manage All
        </button>
      </>
    );
    return () => onRegisterActions(null);
  }, [
    aiPanelMode,
    aiPanelOpen,
    loading,
    onRegisterActions,
    rows.length,
    toggleAiManageAll,
    toggleAiTriage,
  ]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-navy-950 overflow-hidden">
      {/* ─── Header ─── */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-navy-800">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h1>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{description}</p>
          </div>

          {/* Counters */}
          <div className="flex items-center gap-2">
            {counts.critical > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-[10px] font-semibold text-rose-700 dark:text-rose-400">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                {counts.critical}
              </span>
            )}
            {counts.warning > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {counts.warning}
              </span>
            )}
            <span className="text-[10px] text-slate-400 tabular-nums">{rows.length} total</span>
          </div>

          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ─── Body: Table + Preview ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Table (left) */}
        <div className={`flex-1 min-w-0 ${selectedProblem ? 'border-r border-slate-200 dark:border-navy-700' : ''}`}>
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
        {selectedProblem && (
          <div className="w-[380px] shrink-0 flex flex-col">
            <ProblemPreview
              problem={selectedProblem}
              onAction={handlePreviewAction}
              onClose={() => setSelectedId(null)}
              onOpenEntity={onOpenEntity}
            />
            {/* AI Suggest button at bottom of preview */}
            <div className="shrink-0 border-t border-slate-200 dark:border-navy-700 px-3 py-2">
              <button
                type="button"
                onClick={() => toggleAiRecommend(selectedProblem.id)}
                className={`${getMenu3AiButtonClass(
                  aiPanelOpen &&
                    aiPanelMode === 'recommend' &&
                    aiProblemId === selectedProblem.id
                )} w-full justify-center`}
              >
                <Sparkles size={13} />
                {t('execution.manager.ai.suggest', 'AI — How to manage this?')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI Recommendation Panel */}
      <AiRecommendationPanel
        isOpen={aiPanelOpen}
        onClose={closeAiPanel}
        mode={aiPanelMode}
        laneId={moduleId}
        problemId={aiProblemId}
        projectId={projectId}
      />
    </div>
  );
};
