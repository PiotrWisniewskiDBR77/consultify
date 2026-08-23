import {
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  Lightbulb,
  MessageSquare,
  Send,
  Sparkles,
  Target,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { ArtifactPropertiesTable } from '@/components/standard/ArtifactPropertiesTable';
import {
  ARTIFACT_PANEL_CARD_CLASS_DOCKED,
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';
import { LoadingState } from '@/components/ui/primitives';
import { CONSULTING_TOOL_STANDARD_OUTPUTS } from '@/config/consultingToolsStandard';
import { useToolAI } from '@/hooks/discovery/useToolAI';
import { usePresentationMode } from '@/hooks/usePresentationMode';
import {
  mapToolSessionSyncStatusToLegacySaveState,
  useToolSessionSync,
} from '@/hooks/useToolSessionSync';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import {
  type StepDefinition,
  type SWOTData,
  type ToolType,
  useToolStore,
} from '@/store/useToolStore';
import { AppView } from '@/types';
import { exportToPDF } from '@/utils/pdfExport';

import { getMenu3AiButtonClass } from '../shared/ModuleHub/menu3ActionButtonStyles';
import { EmbeddedView } from '../shared/NModeBlocks';
import { type NModePropertyField, type NModeSection, NModeShell } from '../shared/NModeLayout';
import {
  ActivityLogCanvas,
  type ActivityLogEntry,
  type ActivityStats,
  type ActivityTypeMeta,
  type CommentItem,
  type CommentPriority,
  CommentsCanvas,
  type DateFilter,
  type SortOrder,
} from '../shared/NModeSections';
import { countAiCardStatuses, getAiReviewTotal, scrollToAiCards } from './aiCardGovernance';
import { ToolPhaseAiActions } from './shared/ToolPhaseAiActions';
import { getToolPhaseAiActions } from './toolAiActions';
import { ToolCanvas } from './ToolCanvas';
import {
  computeDynamicSwotOverallReadiness,
  computeDynamicSwotPhaseSummaries,
  computeToolCompletionItems,
  computeToolReviewGaps,
} from './toolCompletion';
import { ToolContextPanel } from './ToolContextPanel';
import { TeresaSwotProposals } from './tools/DynamicSWOT/TeresaSwotProposals';

interface ToolDocumentViewProps {
  toolType: ToolType;
  sessionId?: string;
  onBack: () => void;
  onOpenInitiative?: (initiativeId: string) => void;
  autoExportPdf?: boolean;
  onAutoExportPdfConsumed?: () => void;
  onCommandRowActionsChange?: (node: React.ReactNode | null) => void;
}

interface HistoryEvent {
  id: string;
  eventType: string;
  createdAt: string;
  actorName?: string;
  payload?: any;
}

interface Decision {
  decision_type: string;
  status: string;
  decision_id?: string;
  decision_status?: string;
  owner_name?: string;
  due_date?: string;
}

const TOOL_META: Partial<
  Record<
    ToolType,
    {
      name: string;
      namePl: string;
      badge: string;
      category: 'strategic' | 'operational' | 'digital' | 'automation';
      statusDot: string;
    }
  >
> = {
  'dynamic-swot': {
    name: 'Dynamic SWOT',
    namePl: 'Dynamiczny SWOT',
    badge: 'SWT',
    category: 'strategic',
    statusDot: 'bg-emerald-400',
  },
  'market-forces': {
    name: 'Market Forces',
    namePl: 'Siły Rynkowe',
    badge: 'PTR',
    category: 'strategic',
    statusDot: 'bg-blue-400',
  },
  'growth-paths': {
    name: 'Growth Paths',
    namePl: 'Ścieżki Wzrostu',
    badge: 'ANS',
    category: 'strategic',
    statusDot: 'bg-primary-400',
  },
  'portfolio-priority': {
    name: 'Portfolio Priority',
    namePl: 'Priorytetyzacja Portfolio',
    badge: 'BCG',
    category: 'strategic',
    statusDot: 'bg-pink-400',
  },
  'risk-uncertainty': {
    name: 'Risk & Uncertainty',
    namePl: 'Ryzyko i Niepewność',
    badge: 'RSK',
    category: 'strategic',
    statusDot: 'bg-amber-400',
  },
};

const prettifyToolType = (toolType: string) =>
  toolType
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const buildToolMeta = (toolType: ToolType) => {
  const predefined = TOOL_META[toolType];
  if (predefined) return predefined;

  const pretty = prettifyToolType(toolType);
  return {
    name: pretty,
    namePl: pretty,
    badge: pretty
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 3)
      .toUpperCase(),
    category: 'strategic' as const,
    statusDot: 'bg-slate-400',
  };
};

const getConsultingJourneyStage = (stepId?: string) => {
  if (!stepId) return 'entry';
  if (['mission', 'context'].includes(stepId)) return 'entry';
  if (['input', 'strengths', 'weaknesses', 'opportunities', 'threats'].includes(stepId)) {
    return 'conversation';
  }
  if (
    ['outputs', 'summary', 'results', 'reasoning', 'prepare', 'report', 'initiatives'].includes(
      stepId
    )
  ) {
    return 'summary';
  }
  if (['insights', 'correlations', 'swot'].includes(stepId)) return 'analysis';
  return 'conversation';
};

// Status codes are identical in both languages, no translation needed.
const statusLabel = (status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'GENERATED' | 'COMPLETED') => status;

const getPriorityDotClass = (priority: CommentPriority) =>
  priority === 'high' ? 'bg-danger-500' : priority === 'low' ? 'bg-emerald-500' : 'bg-blue-500';

const getPriorityButtonClass = (priority: CommentPriority, isActive: boolean) =>
  isActive
    ? priority === 'high'
      ? 'border-danger-400/80 text-danger-300 bg-danger-500/20'
      : priority === 'low'
        ? 'border-emerald-400/80 text-emerald-300 bg-emerald-500/20'
        : 'border-indigo-400/70 text-indigo-300 bg-indigo-500/15'
    : 'border-slate-300/55 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 hover:border-slate-400/70 hover:text-slate-700 dark:hover:text-slate-300';

const getPriorityLabel = (priority: CommentPriority) =>
  priority === 'high' ? 'High' : priority === 'low' ? 'Low' : 'Normal';

const getPriorityHint = (priority: CommentPriority, t: (key: string) => string) =>
  priority === 'high'
    ? t('discoveryToolsMain.toolDocumentView.priorityHintHigh')
    : priority === 'low'
      ? t('discoveryToolsMain.toolDocumentView.priorityHintLow')
      : t('discoveryToolsMain.toolDocumentView.priorityHintNormal');

export const ToolDocumentView: React.FC<ToolDocumentViewProps> = ({
  toolType,
  sessionId,
  onBack,
  onOpenInitiative,
  autoExportPdf,
  onAutoExportPdfConsumed,
  onCommandRowActionsChange,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const {
    currentOrganization,
    currentProjectId,
    isChatCollapsed,
    toggleChatCollapse,
    activeChatMessages,
  } = useAppStore();
  const { updateWorkspaceFromView } = useConversationStore();
  const { mode, setMode } = usePresentationMode({ entityType: 'tool', syncURL: false });

  const {
    currentSession,
    currentStep,
    createSession,
    setCurrentStep,
    nextStep,
    prevStep,
    canAdvanceStep,
    calculateProgress,
    getStepDefinitions,
    hydrateSessionFromApi,
    acceptCard,
    rejectCard,
  } = useToolStore();

  const {
    isStreaming,
    streamedContent,
    generateFullSession,
    runPhaseAiAction,
    phaseAiActions,
    activeAiActionId,
    missionSuggestion,
    applyMissionSuggestion,
    dismissMissionSuggestion,
    rethinkCard,
    abortStream,
  } = useToolAI({ toolType });

  const isStrategicPhaseTool = [
    'dynamic-swot',
    'market-forces',
    'growth-paths',
    'portfolio-priority',
    'risk-uncertainty',
  ].includes(toolType);
  const toolMeta = buildToolMeta(toolType);
  const stepDefs = getStepDefinitions();
  const currentStepDef = stepDefs[currentStep - 1];
  const progress = calculateProgress();

  const [toolSessionId, setToolSessionId] = useState<string | null>(sessionId || null);
  const [toolStatus, setToolStatus] = useState<
    'DRAFT' | 'REVIEW' | 'APPROVED' | 'GENERATED' | 'COMPLETED'
  >('DRAFT');
  const [sessionName, setSessionName] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [lastModified, setLastModified] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [activeSection, setActiveSection] = useState<string>(
    isStrategicPhaseTool ? 'mission' : 'work'
  );
  const [commandRowPortalTarget, setCommandRowPortalTarget] = useState<HTMLElement | null>(null);
  const [showRequestReviewModal, setShowRequestReviewModal] = useState(false);
  const [showTeresaProposals, setShowTeresaProposals] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const [generatedInitiatives, setGeneratedInitiatives] = useState<
    { id: string; title: string; status?: string }[]
  >([]);
  const [toolDecisions, setToolDecisions] = useState<Decision[]>([]);
  const [toolPermissions, setToolPermissions] = useState<{
    canRequestReview?: boolean;
    canApproveTool?: boolean;
    canGenerate?: boolean;
  }>({});
  const [comments, setComments] = useState<any[]>([]);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [toolBacklinks, setToolBacklinks] = useState<
    Array<{ id: string; sourceType: string; sourceId: string }>
  >([]);
  const [toolBacklinksLoading, setToolBacklinksLoading] = useState(false);
  const [users, setUsers] = useState<
    { id: string; firstName?: string; lastName?: string; email?: string; name?: string }[]
  >([]);

  const [reviewDueDate, setReviewDueDate] = useState('');
  const [reviewPriority, setReviewPriority] = useState<'low' | 'medium' | 'high' | 'critical'>(
    'medium'
  );
  const [reviewDecisionOwnerId, setReviewDecisionOwnerId] = useState('');

  const [generationDefaults, setGenerationDefaults] = useState({
    methodologyId: 'impact-feasibility',
    count: 3,
    includeChatContext: true,
  });

  const [commentDraft, setCommentDraft] = useState('');
  const [commentDateFilter, setCommentDateFilter] = useState<DateFilter>('all');
  const [commentSortOrder, setCommentSortOrder] = useState<SortOrder>('desc');
  const [draftPriority, setDraftPriority] = useState<CommentPriority>('normal');

  useEffect(() => {
    if (mode !== 'n') setMode('n');
  }, [mode, setMode]);

  const reviewGaps = useMemo(
    () => computeToolReviewGaps(toolType, currentSession?.inputData, isPolish),
    [toolType, currentSession?.inputData, isPolish]
  );
  const completionItems = useMemo(
    () => computeToolCompletionItems(toolType, currentSession?.inputData, isPolish),
    [toolType, currentSession?.inputData, isPolish]
  );
  const aiReviewCount = useMemo(
    () => getAiReviewTotal(countAiCardStatuses(currentSession?.inputData)),
    [currentSession?.inputData]
  );
  const completionReady = reviewGaps.length === 0;
  // H3 DoD chain: this document view is the canonical tool runtime, so it must
  // report confidence — the review/approve gate requires confidence_avg >= 3.
  // Same heuristic as ToolWorkspace: review-ready sessions score 4, otherwise
  // scale with progress (schema floor is 1).
  const confidenceAvg = useMemo(() => {
    if (!currentSession) return 1;
    if (completionReady) return 4;
    return Math.max(1, Math.min(5, Math.round(progress / 20)));
  }, [completionReady, currentSession, progress]);
  const missingItemsPayload = useMemo(
    () =>
      reviewGaps.map((gap, index) => ({
        id: `${toolType}-gap-${index + 1}`,
        label: gap,
        severity: 'blocker' as const,
        stepId: currentStepDef?.id || 'review',
        resolved: false,
      })),
    [currentStepDef?.id, reviewGaps, toolType]
  );
  const wizardStatePayload = useMemo(
    () => ({
      sessionId: toolSessionId || sessionId || '',
      toolType,
      status:
        toolStatus === 'REVIEW'
          ? 'REVIEW'
          : ['APPROVED', 'GENERATED', 'COMPLETED', 'FINALIZED'].includes(toolStatus)
            ? 'FINALIZED'
            : 'IN_PROGRESS',
      currentStep: currentStepDef?.id || 'context',
      locked: ['APPROVED', 'GENERATED', 'COMPLETED', 'FINALIZED'].includes(toolStatus),
      review: {
        missingItems: missingItemsPayload,
      },
    }),
    [currentStepDef?.id, missingItemsPayload, sessionId, toolSessionId, toolStatus, toolType]
  );

  // RB-HTTP-01: server (tool_sessions in PostgreSQL) is the source of truth
  // for this session's working state. This hook owns load/create/autosave
  // over HTTP, offline detection + retry, 409/conflict handling, and a
  // localStorage recovery draft that is NEVER treated as authoritative —
  // see src/hooks/useToolSessionSync.ts and
  // docs/program/METHOD_TOOLS_2026-08-13/SESSION_HTTP_INVENTORY.md. The
  // zustand store (`currentSession.inputData`) stays the editable/derived
  // UI state; a dedicated effect below forwards it into this hook.
  const toolSync = useToolSessionSync<Record<string, unknown>>({
    toolId: toolSessionId,
    getExtraPayload: () => ({
      completionPercent: completionReady ? 100 : progress,
      confidenceAvg,
      missingItems: missingItemsPayload,
      wizardState: wizardStatePayload,
    }),
    onRecoveryDiscarded: () => {
      toast(
        t(
          'discoveryToolsMain.toolDocumentView.recoveryDraftDiscarded',
          'A local unsynced draft was discarded — the server already had newer data.'
        )
      );
    },
    // toolSyncRef (declared right below) is populated on every render
    // before this can ever fire -- it only runs from inside load(), which
    // this component triggers itself (fetchAll -> toolSync.load()) no
    // earlier than its own first effect pass.
    onRecoveryAvailable: (_draftData, draftSavedAt) => {
      toast.custom(
        (tst) => (
          <div
            className={`${
              tst.visible ? 'animate-enter' : 'animate-leave'
            } max-w-md w-full bg-c-surface-raised shadow-xl rounded-xl pointer-events-auto ring-1 ring-c-border overflow-hidden`}
          >
            <div className="p-4">
              <p className="text-sm font-medium text-c-text">
                {t(
                  'discoveryToolsMain.toolDocumentView.recoveryDraftAvailable',
                  'Unsynced local changes from a previous session were found.'
                )}
              </p>
              <p className="text-xs text-c-text-secondary mt-0.5">
                {t(
                  'discoveryToolsMain.toolDocumentView.recoveryDraftSavedAt',
                  'Saved locally at {{time}}',
                  {
                    time: new Date(draftSavedAt).toLocaleString(),
                  }
                )}
              </p>
              <div className="flex items-center gap-4 mt-2">
                <button
                  onClick={() => {
                    toast.dismiss(tst.id);
                    toolSyncRef.current?.applyRecoveryDraft();
                  }}
                  className="text-xs font-medium text-c-text underline underline-offset-2 hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
                >
                  {t('discoveryToolsMain.toolDocumentView.recoveryDraftRecover', 'Recover')}
                </button>
                <button
                  onClick={() => {
                    toast.dismiss(tst.id);
                    toolSyncRef.current?.discardRecoveryDraft();
                  }}
                  className="text-xs text-c-text-secondary hover:text-c-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
                >
                  {t('discoveryToolsMain.toolDocumentView.recoveryDraftDiscardAction', 'Discard')}
                </button>
              </div>
            </div>
          </div>
        ),
        {
          duration: 15000,
          // React StrictMode may run the initial load effect twice in development.
          // A stable, session-scoped id makes react-hot-toast update the existing
          // recovery prompt instead of rendering two contradictory actions for
          // the same draft.
          id: `tool-session-recovery-${toolSessionId || 'pending'}`,
        }
      );
    },
  });
  const toolSyncRef = useRef(toolSync);
  toolSyncRef.current = toolSync;

  const swotData = useMemo(
    () =>
      toolType === 'dynamic-swot' ? (currentSession?.inputData as SWOTData | undefined) : undefined,
    [currentSession?.inputData, toolType]
  );
  const effectivePhaseAiActions = useMemo(() => {
    if (phaseAiActions.length > 0) return phaseAiActions;
    return getToolPhaseAiActions(toolType, currentStepDef);
  }, [currentStepDef, phaseAiActions, toolType]);
  const dynamicSwotPhaseSummaries = useMemo(
    () => (toolType === 'dynamic-swot' ? computeDynamicSwotPhaseSummaries(swotData, isPolish) : []),
    [isPolish, swotData, toolType]
  );
  const dynamicSwotReadiness = useMemo(
    () =>
      toolType === 'dynamic-swot' ? computeDynamicSwotOverallReadiness(swotData, isPolish) : null,
    [isPolish, swotData, toolType]
  );
  const consultingJourneyStage = useMemo(
    () => getConsultingJourneyStage(currentStepDef?.id),
    [currentStepDef?.id]
  );

  useEffect(() => {
    if (!isStrategicPhaseTool) return;
    if (currentStepDef?.id && activeSection !== currentStepDef.id) {
      setActiveSection(currentStepDef.id);
    }
  }, [activeSection, currentStepDef?.id, isStrategicPhaseTool]);

  const handleExportPdf = useCallback(async () => {
    try {
      setIsExportingPdf(true);
      const safeName = (sessionName || toolMeta.name)
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .toLowerCase();
      const date = new Date().toISOString().slice(0, 10);
      await exportToPDF('tool-report-export', {
        filename: `tool-report-${toolType}-${safeName}-${date}.pdf`,
        title: `${toolMeta.name} • Tool Report`,
        orientation: 'portrait',
      });
      toast.success(t('discoveryToolsMain.toolDocumentView.pDFExported'));
    } catch {
      toast.error(t('discoveryToolsMain.toolDocumentView.pDFExportFailed'));
    } finally {
      setIsExportingPdf(false);
    }
  }, [isPolish, sessionName, toolMeta.name, toolType]);

  const autoExportRanRef = useRef(false);
  // Identity of the store object created by API hydration. Hydration is not a
  // user edit and must never arm autosave: doing so caused a read-only reopen
  // to rewrite persisted answers/progress after two seconds. Store mutations
  // replace currentSession, so the first genuine edit naturally clears this
  // identity guard without adding a second dirty-state system.
  const hydratedSessionObjectRef = useRef<unknown>(null);
  useEffect(() => {
    if (!autoExportPdf) {
      autoExportRanRef.current = false;
      return;
    }
    if (loading || isExportingPdf || autoExportRanRef.current) return;
    autoExportRanRef.current = true;
    void handleExportPdf().finally(() => onAutoExportPdfConsumed?.());
  }, [autoExportPdf, handleExportPdf, isExportingPdf, loading, onAutoExportPdfConsumed]);

  const fetchAll = useCallback(async () => {
    if (!toolSessionId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Server (via toolSync.load) is the single fetch of record truth --
      // it also evaluates any localStorage recovery draft against it (see
      // useToolSessionSync.ts). `sessionData` here is that SAME response;
      // nothing below issues a second GET.
      const sessionData = await toolSync.load();
      if (!sessionData) {
        // toolSync already recorded 'offline' or 'error' status/error --
        // still surface the same toast the old direct-fetch path showed.
        toast.error(t('discoveryToolsMain.toolDocumentView.failedToLoadSession'));
        return;
      }
      setToolStatus((sessionData.status || 'DRAFT').toUpperCase() as any);
      setSessionName(sessionData.name || '');
      setCreatedAt(sessionData.createdAt || '');
      setLastModified(sessionData.updatedAt || '');
      setGeneratedInitiatives(
        (sessionData.generatedInitiatives || []).map((initiative) => ({
          ...initiative,
          title: initiative.title || initiative.id,
        }))
      );
      setToolDecisions((sessionData.decisions as unknown as Decision[]) || []);
      setToolPermissions(sessionData.permissions || {});

      hydrateSessionFromApi({
        id: toolSessionId,
        toolType,
        name: sessionData.name,
        createdAt: sessionData.createdAt,
        updatedAt: sessionData.updatedAt,
        status: sessionData.status,
        answers: sessionData.answers || {},
        completionPercent:
          typeof sessionData.completion_percent === 'number'
            ? sessionData.completion_percent
            : sessionData.completionPercent,
        wizardState: (sessionData.wizardState as { currentStep?: string } | null) ?? null,
      });
      hydratedSessionObjectRef.current = useToolStore.getState().currentSession;

      const fetchedUsers = await Api.getUsers();
      setUsers(fetchedUsers || []);

      try {
        const commentsRes = await Api.get(`/api/tools/${toolSessionId}/comments`);
        setComments(commentsRes || []);
      } catch {
        setComments([]);
      }

      try {
        const historyRes = await Api.get(`/api/tools/${toolSessionId}/history`);
        setHistory(historyRes || []);
      } catch {
        setHistory([]);
      }
    } catch (error) {
      console.error('Failed to fetch tool session:', error);
      toast.error(t('discoveryToolsMain.toolDocumentView.failedToLoadSession'));
    } finally {
      setLoading(false);
    }
    // NOTE: depends on `toolSync.load` (a stable useCallback), not the
    // `toolSync` object itself -- that object literal is recreated on
    // every render, and including it here would re-trigger this callback
    // (and the effect below that calls it) on every render, not just
    // when toolSessionId actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrateSessionFromApi, isPolish, toolSessionId, toolSync.load, toolType]);

  useEffect(() => {
    if (!toolSessionId) return;
    setToolBacklinksLoading(true);
    Api.getLinkGraphBacklinks({ type: 'tool_session', id: toolSessionId, limit: 50 })
      .then((rows: any) => {
        setToolBacklinks(
          (Array.isArray(rows) ? rows : [])
            .map((row: any) => ({
              id: String(row?.id || ''),
              sourceType: String(row?.sourceType || ''),
              sourceId: String(row?.sourceId || ''),
            }))
            .filter((row) => row.sourceType && row.sourceId)
        );
      })
      .catch(() => setToolBacklinks([]))
      .finally(() => setToolBacklinksLoading(false));
  }, [toolSessionId]);

  const createSessionInFlightRef = useRef(false);
  useEffect(() => {
    const initSession = async () => {
      if (sessionId) {
        // Server truth arrives via fetchAll()/toolSync.load() below --
        // deliberately NOT seeded from the zustand-persisted local
        // `savedSessions` cache (RB-HTTP-01): that cache can hold a STALE
        // session from a previous browser session under the same id, and
        // this view has no way to tell "genuinely fresh local edit" apart
        // from "stale leftover" without the server round-trip anyway. The
        // real recovery path for genuinely unsynced edits is the
        // toolId-scoped recovery draft in useToolSessionSync, which IS
        // evaluated against the server response.
        setToolSessionId(sessionId);
        return;
      }

      if (createSessionInFlightRef.current) return;
      if (!currentSession || currentSession.toolType !== toolType) {
        createSessionInFlightRef.current = true;
        createSession(toolType);
        const name = `${toolMeta.name} — Session`;
        try {
          const createdId = await toolSync.create({
            toolType,
            name,
            projectId: currentProjectId || null,
          });
          setToolSessionId(createdId);
          setSessionName(name);
          setToolStatus('DRAFT');
          setLastModified(new Date().toISOString());
        } catch (error) {
          console.error('Failed to create tool session:', error);
          toast.error(t('discoveryToolsMain.toolDocumentView.failedToCreateSession'));
          // A genuine failure should stay retryable if deps change again
          // (e.g. currentProjectId resolves later) — only a duplicate
          // RACE is what this guard exists to block.
          createSessionInFlightRef.current = false;
        }
      }
    };

    void initSession();
    // `toolSync.create` (stable useCallback), not `toolSync` itself -- see
    // the note on fetchAll's deps above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    createSession,
    currentProjectId,
    currentSession,
    isPolish,
    sessionId,
    toolMeta.name,
    toolSync.create,
    toolType,
  ]);

  useEffect(() => {
    if (toolSessionId) void fetchAll();
  }, [fetchAll, toolSessionId]);

  // H3 resume-safety: until fetchAll() hydrates the store from the API,
  // `currentSession` may still hold a DIFFERENT session persisted from a
  // previous visit (zustand persist). Auto-saving that stale inputData into
  // this toolSessionId would silently overwrite the resumed session's answers.
  // hydrateSessionFromApi sets currentSession.id = toolSessionId, so an id
  // match is the proof that we are saving the session we actually loaded.
  const isSessionHydrated = Boolean(
    currentSession && toolSessionId && currentSession.id === toolSessionId
  );

  // RB-HTTP-01: forward every genuine local edit into toolSync, which owns
  // debounce/autosave/offline-retry/409-conflict/recovery-draft from here
  // on (src/hooks/useToolSessionSync.ts). `hydratedSessionObjectRef` keeps
  // the same job it always had: a hydration-only store update (not a real
  // user edit) must not arm autosave.
  useEffect(() => {
    if (!currentSession || !toolSessionId) return;
    if (!isSessionHydrated) return;
    if (currentSession === hydratedSessionObjectRef.current) return;
    toolSync.setData(currentSession.inputData as Record<string, unknown>);
    // `toolSync.setData` (stable useCallback), not `toolSync` itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSession, isSessionHydrated, toolSessionId, toolSync.setData]);

  // Keep the header's "last saved" timestamp in step with a successful
  // autosave without waiting for a full reload.
  useEffect(() => {
    if (toolSync.session?.updatedAt) setLastModified(toolSync.session.updatedAt);
  }, [toolSync.session]);

  // toolSync owns the unmount-flush itself (mirrors the old TLS-03 effect,
  // now inside the hook so it is covered by the hook's own unit tests).

  const saveState = mapToolSessionSyncStatusToLegacySaveState(toolSync.status);

  // Conflict-recovery action: discard local/unsynced state and refetch
  // from the server (see useToolSessionSync.ts's `reconcile`), then
  // re-run the same fetchAll() the initial load used so every other piece
  // of document state (comments/history/decisions/...) comes back in
  // step with the reconciled session, not just the answers blob.
  const handleReconcileConflict = useCallback(async () => {
    await toolSync.reconcile();
    if (toolSessionId) void fetchAll();
    // `toolSync.reconcile` (stable useCallback), not `toolSync` itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAll, toolSessionId, toolSync.reconcile]);

  const showConflictToast = useCallback(() => {
    toast.custom(
      (tst) => (
        <div
          className={`${
            tst.visible ? 'animate-enter' : 'animate-leave'
          } max-w-md w-full bg-c-surface-raised shadow-xl rounded-xl pointer-events-auto ring-1 ring-c-border overflow-hidden`}
        >
          <div className="p-4 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-c-text">
                {t(
                  'discoveryToolsMain.toolDocumentView.saveConflict',
                  'Could not save — this session changed on the server.'
                )}
              </p>
              <button
                onClick={() => {
                  toast.dismiss(tst.id);
                  void handleReconcileConflict();
                }}
                className="mt-2 text-xs font-medium text-c-text underline underline-offset-2 hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
              >
                {t('discoveryToolsMain.toolDocumentView.saveConflictReload', 'Reload from server')}
              </button>
            </div>
          </div>
        </div>
      ),
      { duration: 8000 }
    );
  }, [handleReconcileConflict, t]);

  const handleSave = async () => {
    if (!toolSessionId || !currentSession) return;
    if (!isSessionHydrated) {
      toast.error(
        t('tools.session.notLoadedYet', 'Session is still loading — try again in a moment')
      );
      return;
    }
    setSaving(true);
    try {
      const outcome = await toolSync.flush();
      if (outcome === 'saved') {
        toast.success(t('discoveryToolsMain.toolDocumentView.saved'));
      } else if (outcome === 'conflict') {
        showConflictToast();
      } else if (outcome === 'offline') {
        toast.error(
          t(
            'discoveryToolsMain.toolDocumentView.saveOffline',
            'You are offline — this change is saved locally and will sync automatically.'
          )
        );
      } else {
        toast.error(t('discoveryToolsMain.toolDocumentView.saveFailed'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChat = () => {
    updateWorkspaceFromView(AppView.DISCOVERY_TOOLS_STRATEGIC, toolSessionId || undefined, {
      toolType,
      sessionName,
    });
    if (isChatCollapsed) toggleChatCollapse();
  };

  const handleRequestReview = async () => {
    if (!toolSessionId || !completionReady) {
      toast.error(t('discoveryToolsMain.toolDocumentView.completeAllRequiredItemsFirst'));
      return;
    }
    setShowRequestReviewModal(true);
  };

  const handleConfirmRequestReview = async () => {
    if (!toolSessionId) return;
    try {
      const result = await Api.requestToolReview(toolSessionId, {
        decisionOwnerId: reviewDecisionOwnerId || undefined,
        dueDate: reviewDueDate || undefined,
        priority: reviewPriority,
      });
      setToolStatus((result.status || 'REVIEW').toUpperCase() as any);
      toast.success(t('discoveryToolsMain.toolDocumentView.sentToReview'));
      setShowRequestReviewModal(false);
      setReviewDecisionOwnerId('');
      setReviewDueDate('');
      setReviewPriority('medium');
      await fetchAll();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to request review');
    }
  };

  const handleApprove = async () => {
    if (!toolSessionId) return;
    // RB-024: Approve must use the same readiness invariant as Request review —
    // otherwise a session can be approved while completionItems still show gaps.
    if (!completionReady) {
      toast.error(t('discoveryToolsMain.toolDocumentView.completeAllRequiredItemsFirst'));
      return;
    }
    try {
      const result = await Api.approveTool(toolSessionId);
      setToolStatus((result.status || 'APPROVED').toUpperCase() as any);
      toast.success(t('discoveryToolsMain.toolDocumentView.approved'));
      await fetchAll();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve');
    }
  };

  const handleSendBack = async () => {
    if (!toolSessionId) return;
    const reason = prompt(t('discoveryToolsMain.toolDocumentView.reasonForSendingBack'));
    if (!reason) return;
    try {
      const result = await Api.sendToolBackToDraft(toolSessionId, reason);
      setToolStatus((result.status || 'DRAFT').toUpperCase() as any);
      toast.success(t('discoveryToolsMain.toolDocumentView.sentBackToDraft'));
      await fetchAll();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send back');
    }
  };

  const handleGenerateAI = async () => {
    const primaryAction = phaseAiActions[0];
    if (!primaryAction) return;
    setIsGeneratingAI(true);
    try {
      await runPhaseAiAction(primaryAction.id);
      toast.success(t('discoveryToolsMain.toolDocumentView.aIGenerationFinished'));
    } catch {
      toast.error(t('discoveryToolsMain.toolDocumentView.aIGenerationFailed'));
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleAddComment = async (content: string) => {
    if (!toolSessionId || !content.trim()) return false;
    try {
      await Api.post(`/api/tools/${toolSessionId}/comments`, { content: content.trim() });
      const updated = await Api.get(`/api/tools/${toolSessionId}/comments`);
      setComments(updated || []);
      toast.success(t('discoveryToolsMain.toolDocumentView.commentAdded'));
      return true;
    } catch {
      toast.error(t('discoveryToolsMain.toolDocumentView.failedToAddComment'));
      return false;
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!toolSessionId) return;
    try {
      await Api.delete(`/api/tools/${toolSessionId}/comments/${commentId}`);
      const updated = await Api.get(`/api/tools/${toolSessionId}/comments`);
      setComments(updated || []);
      toast.success(t('discoveryToolsMain.toolDocumentView.commentDeleted'));
    } catch {
      toast.error(t('discoveryToolsMain.toolDocumentView.failedToDeleteComment'));
    }
  };

  const nModeComments: CommentItem[] = useMemo(
    () =>
      comments
        .filter((comment) => {
          if (commentDateFilter === 'all') return true;
          const date = new Date(comment.createdAt);
          const now = new Date();
          if (commentDateFilter === 'today') return date.toDateString() === now.toDateString();
          if (commentDateFilter === '7d') return now.getTime() - date.getTime() < 7 * 86400000;
          if (commentDateFilter === '30d') return now.getTime() - date.getTime() < 30 * 86400000;
          return true;
        })
        .sort((a, b) =>
          commentSortOrder === 'desc'
            ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
        .map((comment) => ({
          id: comment.id,
          authorName: comment.authorName || comment.author_name || 'User',
          content: comment.content || comment.text || '',
          createdAt: comment.createdAt || comment.created_at || new Date().toISOString(),
          isAIGenerated: comment.authorId === 'ai-assistant',
          priority: 'normal' as CommentPriority,
        })),
    [commentDateFilter, commentSortOrder, comments]
  );

  const activityEntries: ActivityLogEntry[] = useMemo(
    () =>
      history.map((entry) => ({
        id: entry.id,
        type: entry.eventType,
        description: entry.eventType,
        timestamp: entry.createdAt,
        userName: entry.actorName,
        oldValue: entry.payload?.oldValue ? String(entry.payload.oldValue) : undefined,
        newValue: entry.payload?.newValue ? String(entry.payload.newValue) : undefined,
      })),
    [history]
  );

  const activityStats: ActivityStats = useMemo(() => {
    const total = history.length;
    const edited = history.filter((entry) => entry.eventType.includes('edit')).length;
    const escalations = history.filter((entry) => entry.eventType.includes('review')).length;
    const collaboration = history.filter(
      (entry) => entry.eventType.includes('comment') || entry.eventType.includes('share')
    ).length;
    return { total, edited, escalations, collaboration };
  }, [history]);

  const activityTypeMeta = useCallback(
    (type: string): ActivityTypeMeta => {
      const map: Record<string, ActivityTypeMeta> = {
        created: {
          icon: <CheckCircle2 size={10} />,
          label: t('discoveryToolsMain.toolDocumentView.created'),
          style: 'border-emerald-300/50 bg-emerald-500/10 text-emerald-600',
        },
        comment: {
          icon: <MessageSquare size={10} />,
          label: t('discoveryToolsMain.toolDocumentView.comment'),
          style: 'border-amber-300/50 bg-amber-500/10 text-amber-600',
        },
        review_requested: {
          icon: <Send size={10} />,
          label: t('discoveryToolsMain.toolDocumentView.review'),
          style: 'border-blue-300/50 bg-blue-500/10 text-blue-600',
        },
      };
      return (
        map[type] || {
          icon: <Clock size={10} />,
          label: type,
          style: 'border-slate-300/50 bg-slate-500/10 text-slate-600',
        }
      );
    },
    [isPolish]
  );

  const properties: NModePropertyField[] = useMemo(
    () => [
      {
        id: 'toolType',
        label: { en: 'Tool type', pl: 'Typ narzędzia' },
        type: 'text',
        value: toolType,
        onChange: () => {},
        readOnly: true,
      },
      {
        id: 'category',
        label: { en: 'Category', pl: 'Kategoria' },
        type: 'text',
        value: toolMeta.category,
        onChange: () => {},
        readOnly: true,
      },
      {
        id: 'status',
        label: { en: 'Status', pl: 'Status' },
        type: 'text',
        value: statusLabel(toolStatus),
        onChange: () => {},
        readOnly: true,
      },
      {
        id: 'runtimeStage',
        label: { en: 'Consulting stage', pl: 'Etap konsultingowy' },
        type: 'text',
        value:
          {
            entry: t('discoveryToolsMain.toolDocumentView.entryPurpose'),
            conversation: t('discoveryToolsMain.toolDocumentView.conversationCapture'),
            analysis: t('discoveryToolsMain.toolDocumentView.analysis'),
            summary: t('discoveryToolsMain.toolDocumentView.conclusionsSummary'),
          }[consultingJourneyStage] || consultingJourneyStage,
        onChange: () => {},
        readOnly: true,
      },
      {
        id: 'currentStep',
        label: { en: 'Current step', pl: 'Aktualny krok' },
        type: 'text',
        value: currentStepDef ? (isPolish ? currentStepDef.namePl : currentStepDef.name) : '-',
        onChange: () => {},
        readOnly: true,
      },
      {
        id: 'progress',
        label: { en: 'Progress', pl: 'Postęp' },
        type: 'text',
        value: `${progress}%`,
        onChange: () => {},
        readOnly: true,
      },
    ],
    [
      consultingJourneyStage,
      currentStepDef,
      isPolish,
      progress,
      toolMeta.category,
      toolStatus,
      toolType,
    ]
  );

  const sections: NModeSection[] = useMemo(() => {
    const workSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-navy-700/70 dark:bg-navy-950/30">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-600 dark:text-slate-500">
                {t('discoveryToolsMain.toolDocumentView.visibleHumanAILoop')}
              </div>
              <div className="text-sm text-slate-700 dark:text-slate-300">
                {t('discoveryToolsMain.toolDocumentView.sessionVisibilityDescription')}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {CONSULTING_TOOL_STANDARD_OUTPUTS.map((outputType) => (
                <span
                  key={outputType}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600 dark:border-navy-700 dark:bg-navy-900/70 dark:text-slate-300"
                >
                  {outputType}
                </span>
              ))}
              {toolType === 'dynamic-swot' && dynamicSwotReadiness && (
                <span
                  className={`rounded-full border px-3 py-1 text-[11px] font-medium ${
                    dynamicSwotReadiness.readiness === 'ready'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'
                      : dynamicSwotReadiness.readiness === 'needs-work'
                        ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
                        : 'border-danger-200 bg-danger-50 text-danger-700 dark:border-danger-900/40 dark:bg-danger-900/20 dark:text-danger-300'
                  }`}
                >
                  {dynamicSwotReadiness.label}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-600 dark:text-slate-500">
              {t('discoveryToolsMain.toolDocumentView.currentStage')}:{' '}
              {
                {
                  entry: t('discoveryToolsMain.toolDocumentView.entryPurpose'),
                  conversation: t('discoveryToolsMain.toolDocumentView.conversationCapture'),
                  analysis: t('discoveryToolsMain.toolDocumentView.analysisBenchmarking'),
                  summary: t('discoveryToolsMain.toolDocumentView.conclusionsFinalSummary'),
                }[consultingJourneyStage]
              }
            </div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {currentStepDef
                ? isPolish
                  ? currentStepDef.namePl
                  : currentStepDef.name
                : toolMeta.name}
            </h2>
            {currentStepDef && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isPolish ? currentStepDef.descriptionPl : currentStepDef.description}
              </p>
            )}
          </div>
        </div>

        {toolType === 'dynamic-swot' ? (
          <div className="grid gap-3 xl:grid-cols-5">
            {dynamicSwotPhaseSummaries.map((phase, index) => {
              const isActive = currentStepDef?.id === phase.id;
              return (
                <button
                  key={phase.id}
                  type="button"
                  onClick={() => setCurrentStep(index + 1)}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    isActive
                      ? 'border-primary-300 bg-primary-500/10 shadow-sm'
                      : phase.readiness === 'ready'
                        ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/10'
                        : phase.readiness === 'needs-work'
                          ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/10'
                          : 'border-slate-200 bg-white dark:border-navy-700 dark:bg-navy-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-slate-600 dark:text-slate-500">
                      {index + 1}
                    </span>
                    {phase.done ? (
                      <Check size={12} className="text-emerald-500" />
                    ) : (
                      <span className="text-[11px] text-slate-600">{phase.gapCount}</span>
                    )}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {phase.label}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {phase.primaryGap ||
                      (phase.done
                        ? t('discoveryToolsMain.toolDocumentView.readyStatus')
                        : t('discoveryToolsMain.toolDocumentView.needsWorkStatus'))}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {stepDefs.map((step: StepDefinition, index: number) => {
              const stepNum = index + 1;
              const isCompleted = currentSession?.steps?.some(
                (sessionStep) =>
                  sessionStep.stepId === step.id && sessionStep.status === 'completed'
              );
              const isActive = currentStep === stepNum;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setCurrentStep(stepNum)}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition-colors ${
                    isActive
                      ? 'bg-primary-500/15 text-primary-700 dark:text-primary-300'
                      : isCompleted
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-100 dark:bg-navy-900/70 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {isCompleted ? (
                    <Check size={12} />
                  ) : (
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200/80 dark:bg-navy-800 text-[10px]">
                      {stepNum}
                    </span>
                  )}
                  <span>{isPolish ? step.namePl : step.name}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="rounded-2xl bg-slate-50/70 dark:bg-navy-900/40 p-4">
          {currentSession ? (
            <ToolCanvas
              toolType={toolType}
              currentStep={currentStep}
              stepDefinition={currentStepDef}
              session={currentSession}
              isStreaming={isStreaming}
              streamedContent={streamedContent || ''}
              isPolish={isPolish}
              onOpenChat={handleOpenChat}
              generatedInitiatives={generatedInitiatives}
              missionSuggestion={missionSuggestion}
              onApplyMissionSuggestion={applyMissionSuggestion}
              onDismissMissionSuggestion={dismissMissionSuggestion}
              onAcceptCard={acceptCard}
              onRejectCard={rejectCard}
              onRethinkCard={(cardType, cardId, comment) => {
                const phaseId = stepDefs[currentStep - 1]?.id || 'mission';
                rethinkCard(phaseId, cardType, cardId, comment);
              }}
            />
          ) : (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              {t('discoveryToolsMain.toolDocumentView.noSessionData')}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => prevStep()}
            disabled={currentStep <= 1}
            className="rounded-lg bg-slate-100 dark:bg-navy-900/70 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 disabled:opacity-50"
          >
            {t('discoveryToolsMain.toolDocumentView.previous')}
          </button>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {t('discoveryToolsMain.toolDocumentView.step')} {currentStep}/{stepDefs.length}
          </div>
          <button
            type="button"
            onClick={() => nextStep()}
            disabled={currentStep >= stepDefs.length || !canAdvanceStep()}
            className="rounded-lg bg-navy-900 px-3 py-2 text-sm text-white hover:bg-navy-800 disabled:opacity-50"
          >
            {t('discoveryToolsMain.toolDocumentView.next')}
          </button>
        </div>
      </div>
    );

    const reviewSection = (
      <div className="space-y-8">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {t('discoveryToolsMain.toolDocumentView.appliedConclusionsReadiness')}
          </h2>
          <div className="rounded-2xl bg-slate-50/70 dark:bg-navy-900/40 p-4 space-y-4">
            <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 text-sm text-slate-600 dark:border-navy-700/70 dark:bg-navy-950/30 dark:text-slate-300">
              {t('discoveryToolsMain.toolDocumentView.appliedConclusionsSectionDescription')}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
                  {t('discoveryToolsMain.toolDocumentView.status')}
                </div>
                <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {statusLabel(toolStatus)}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
                  {t('discoveryToolsMain.toolDocumentView.progress')}
                </div>
                <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">{progress}%</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
                  {t('discoveryToolsMain.toolDocumentView.created2')}
                </div>
                <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {createdAt ? new Date(createdAt).toLocaleDateString() : '—'}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
                  {t('discoveryToolsMain.toolDocumentView.lastModified')}
                </div>
                <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {lastModified ? new Date(lastModified).toLocaleString() : '—'}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {completionItems.map((item, index) => (
                <div key={`${item.label}-${index}`} className="flex items-center gap-3 text-sm">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      item.done ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  />
                  <span
                    className={
                      item.done
                        ? 'text-slate-700 dark:text-slate-300'
                        : 'text-slate-500 dark:text-slate-400'
                    }
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            {toolType === 'dynamic-swot' &&
              (swotData?.summary?.appliedConclusions?.length || 0) > 0 && (
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-500/5 px-4 py-3">
                  <div className="mb-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    {t('discoveryToolsMain.toolDocumentView.appliedConclusions')}
                  </div>
                  <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                    {swotData?.summary?.appliedConclusions?.map((conclusion, index) => (
                      <li key={`${conclusion}-${index}`}>• {conclusion}</li>
                    ))}
                  </ul>
                </div>
              )}

            {toolType === 'dynamic-swot' && swotData?.summary?.executiveSummary && (
              <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 dark:border-navy-700/70 dark:bg-navy-950/30">
                <div className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                  {t('discoveryToolsMain.toolDocumentView.finalSourceSummary')}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {swotData.summary.executiveSummary}
                </p>
              </div>
            )}

            {reviewGaps.length > 0 && (
              <div className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                <div className="mb-2 font-medium">
                  {t('discoveryToolsMain.toolDocumentView.missingItems')}
                </div>
                <ul className="space-y-1">
                  {reviewGaps.map((gap, index) => (
                    <li key={`${gap}-${index}`}>• {gap}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 text-xs text-slate-500 dark:border-navy-700/70 dark:bg-navy-950/30 dark:text-slate-400">
              {t('discoveryToolsMain.toolDocumentView.lifecycleActionsHint')}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {t('discoveryToolsMain.toolDocumentView.generationSettings')}
          </h2>
          <div className="grid gap-4 md:grid-cols-3 rounded-2xl bg-slate-50/70 dark:bg-navy-900/40 p-4">
            <label className="space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
                {t('discoveryToolsMain.toolDocumentView.methodology')}
              </span>
              <select
                value={generationDefaults.methodologyId}
                onChange={(e) =>
                  setGenerationDefaults((prev) => ({ ...prev, methodologyId: e.target.value }))
                }
                className="h-9 w-full rounded-lg border border-slate-300/60 bg-white px-3 text-sm dark:border-navy-600/40 dark:bg-navy-900"
              >
                <option value="impact-feasibility">Impact-Feasibility Matrix</option>
                <option value="strategic-alignment">Strategic Alignment</option>
                <option value="quick-wins">Quick Wins First</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
                {t('discoveryToolsMain.toolDocumentView.initiativesCount')}
              </span>
              <input
                type="number"
                min={1}
                max={10}
                value={generationDefaults.count}
                onChange={(e) =>
                  setGenerationDefaults((prev) => ({
                    ...prev,
                    count: Math.max(1, Number(e.target.value) || 3),
                  }))
                }
                className="h-9 w-full rounded-lg border border-slate-300/60 bg-white px-3 text-sm dark:border-navy-600/40 dark:bg-navy-900"
              />
            </label>
            <label className="flex items-end gap-2 rounded-xl bg-white/70 dark:bg-navy-950/40 px-3 py-2 text-sm text-slate-600 dark:text-slate-400">
              <input
                type="checkbox"
                checked={generationDefaults.includeChatContext}
                onChange={(e) =>
                  setGenerationDefaults((prev) => ({
                    ...prev,
                    includeChatContext: e.target.checked,
                  }))
                }
              />
              <span>{t('discoveryToolsMain.toolDocumentView.includeChatContext')}</span>
            </label>
          </div>
        </div>

        {toolDecisions.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {t('discoveryToolsMain.toolDocumentView.gateDecisions')}
            </h2>
            <div className="space-y-2 rounded-2xl bg-slate-50/70 dark:bg-navy-900/40 p-4">
              {toolDecisions.map((decision, index) => (
                <div
                  key={`${decision.decision_id || decision.decision_type}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/70 dark:bg-navy-950/40 px-3 py-2 text-sm"
                >
                  <span className="text-slate-700 dark:text-slate-300">
                    {decision.decision_type}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {decision.decision_status || decision.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );

    const outputsSection = (
      <div className="space-y-8">
        {toolType === 'dynamic-swot' && swotData?.summary?.executiveSummary && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {t('discoveryToolsMain.toolDocumentView.sourceArtifact')}
            </h2>
            <div className="rounded-2xl bg-slate-50/70 p-4 dark:bg-navy-900/40">
              <div className="text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
                {t('discoveryToolsMain.toolDocumentView.finalSourceSummary')}
              </div>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                {swotData.summary.executiveSummary}
              </p>
              {(swotData.summary.appliedConclusions?.length || 0) > 0 && (
                <div className="mt-4">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-500">
                    {t('discoveryToolsMain.toolDocumentView.appliedConclusions')}
                  </div>
                  <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                    {swotData.summary.appliedConclusions?.map((conclusion, index) => (
                      <li key={`${conclusion}-${index}`}>• {conclusion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {t('discoveryToolsMain.toolDocumentView.outputContract')}
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {CONSULTING_TOOL_STANDARD_OUTPUTS.map((outputType) => (
              <div
                key={outputType}
                className="rounded-2xl bg-slate-50/70 p-4 text-sm text-slate-600 dark:bg-navy-900/40 dark:text-slate-300"
              >
                <div className="font-medium text-slate-800 dark:text-slate-100">{outputType}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {outputType === 'initiative'
                    ? t('discoveryToolsMain.toolDocumentView.outputHintInitiative')
                    : outputType === 'report'
                      ? t('discoveryToolsMain.toolDocumentView.outputHintReport')
                      : outputType === 'presentation'
                        ? t('discoveryToolsMain.toolDocumentView.outputHintPresentation')
                        : t('discoveryToolsMain.toolDocumentView.outputHintIdea')}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {t('discoveryToolsMain.toolDocumentView.initiativesFromThisSession')}
          </h2>
          <EmbeddedView
            title={t('discoveryToolsMain.toolDocumentView.generatedInitiatives')}
            count={generatedInitiatives.length}
            viewModes={['list']}
            readOnly
          >
            {generatedInitiatives.length === 0 ? (
              <div className="px-1 text-[11px] text-slate-500 dark:text-slate-400">
                {t('discoveryToolsMain.toolDocumentView.noInitiativesGeneratedYet')}
              </div>
            ) : (
              <div className="space-y-2">
                {generatedInitiatives.map((initiative) => (
                  <button
                    key={initiative.id}
                    type="button"
                    onClick={() => onOpenInitiative?.(initiative.id)}
                    className="flex w-full items-center justify-between rounded-xl bg-white/70 dark:bg-navy-950/40 px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300"
                  >
                    <span className="truncate">{initiative.title}</span>
                    <ExternalLink size={14} className="shrink-0 text-slate-600" />
                  </button>
                ))}
              </div>
            )}
          </EmbeddedView>
        </div>

        {toolType === 'dynamic-swot' && (
          <>
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                {t('discoveryToolsMain.toolDocumentView.recommendedMoves')}
              </h2>
              <div className="space-y-2">
                {(swotData?.recommendedMoves || []).length === 0 ? (
                  <div className="rounded-2xl bg-slate-50/70 dark:bg-navy-900/40 p-4 text-sm text-slate-500 dark:text-slate-400">
                    {t('discoveryToolsMain.toolDocumentView.noMovesGeneratedYet')}
                  </div>
                ) : (
                  swotData?.recommendedMoves?.map((move) => (
                    <div
                      key={move.id}
                      className="rounded-2xl bg-slate-50/70 dark:bg-navy-900/40 p-4 space-y-2"
                    >
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {move.title}
                      </div>
                      <div className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-500">
                        {move.category}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{move.rationale}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                {t('discoveryToolsMain.toolDocumentView.outputCandidates')}
              </h2>
              <div className="space-y-2">
                {(swotData?.outputCandidates || []).length === 0 ? (
                  <div className="rounded-2xl bg-slate-50/70 dark:bg-navy-900/40 p-4 text-sm text-slate-500 dark:text-slate-400">
                    {t('discoveryToolsMain.toolDocumentView.noOutputCandidatesYet')}
                  </div>
                ) : (
                  swotData?.outputCandidates?.map((candidate) => (
                    <div
                      key={candidate.id}
                      className="rounded-2xl bg-slate-50/70 dark:bg-navy-900/40 p-4 space-y-1"
                    >
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {candidate.title}
                      </div>
                      <div className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-500">
                        {candidate.outputType}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {candidate.description}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );

    const aiCollaborationSection = currentSession ? (
      <ToolContextPanel
        toolType={toolType}
        session={currentSession}
        currentStepId={currentStepDef?.id}
        isPolish={isPolish}
        orgName={currentOrganization?.name}
        aiContent={isStreaming ? streamedContent : undefined}
        onOpenChat={handleOpenChat}
        generatedInitiatives={generatedInitiatives}
        recentInitiatives={generatedInitiatives.slice(0, 5)}
        chatSnippets={(activeChatMessages || []).slice(-6).map((message: any) => ({
          role: message.role,
          content: message.content,
        }))}
        embedded
      />
    ) : (
      <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
        {t('discoveryToolsMain.toolDocumentView.noSessionData')}
      </div>
    );

    // ── Standard-C group tabs (mirrors InsightViewer/InitiativeDocumentView) ──
    // A bilingual groupLabels array switched on isPolish, plus a per-section
    // group + cSpan assignment, so NModeShell's C-board renders top group tabs
    // and lets wide/table-heavy sections breathe in the dense 3-column grid.
    const groupLabels = t('discoveryToolsMain.toolDocumentView.groupLabels', {
      returnObjects: true,
    }) as string[];
    const phaseGroupIndex = (stepId: string): number => {
      if (['mission', 'context', 'input', 'signals'].includes(stepId)) return 0;
      if (
        ['insights', 'synthesis', 'swot', 'forces', 'options', 'items', 'assumptions'].includes(
          stepId
        )
      ) {
        return 1;
      }
      if (['outputs', 'report', 'initiatives', 'results', 'summary'].includes(stepId)) return 2;
      return 0;
    };
    // Static (non-phase) sections: group + Standard-C span/hidden hints.
    const staticGroupIndexById: Record<string, number> = {
      work: 0,
      review: 1,
      outputs: 2,
      'ai-collaboration': 3,
      comments: 4,
      activity: 4,
      'used-in': 4,
    };
    const cSpanById: Record<string, 1 | 2 | 3> = {
      work: 3, // wide step canvas + tool workspace
      review: 2, // readiness + generation grids
      outputs: 3, // output contract grid + initiatives + candidates
      'ai-collaboration': 2,
    };
    const cHiddenById = (id: string): boolean => {
      if (id === 'comments') return nModeComments.length === 0;
      if (id === 'activity') return history.length === 0;
      if (id === 'used-in') return toolBacklinks.length === 0;
      return false;
    };

    if (isStrategicPhaseTool) {
      const renderPhaseCanvas = (phaseStep: StepDefinition, extras?: React.ReactNode) => {
        const phaseIndex = stepDefs.findIndex((step) => step.id === phaseStep.id) + 1;
        const isStrategicSessionPhase = [
          'mission',
          'input',
          'swot',
          'forces',
          'options',
          'items',
          'assumptions',
          'insights',
          'outputs',
        ].includes(phaseStep.id);

        return (
          <div className="space-y-6">
            {!isStrategicSessionPhase && (
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-navy-700/70 dark:bg-navy-950/30">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-600 dark:text-slate-500">
                      {t('discoveryToolsMain.toolDocumentView.aIConsultantFlow')}
                    </div>
                    <div className="text-sm text-slate-700 dark:text-slate-300">
                      {isPolish ? phaseStep.descriptionPl : phaseStep.description}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-50/70 dark:border-navy-700/70 dark:bg-navy-900/40">
              {currentSession ? (
                <ToolCanvas
                  toolType={toolType}
                  currentStep={phaseIndex}
                  stepDefinition={phaseStep}
                  session={currentSession}
                  isStreaming={isStreaming}
                  streamedContent={streamedContent || ''}
                  isPolish={isPolish}
                  onOpenChat={handleOpenChat}
                  generatedInitiatives={generatedInitiatives}
                  onGenerateFullSession={generateFullSession}
                  missionSuggestion={missionSuggestion}
                  onApplyMissionSuggestion={applyMissionSuggestion}
                  onDismissMissionSuggestion={dismissMissionSuggestion}
                  isGeneratingAI={isGeneratingAI}
                  sessionGenerationStatus={currentSession.sessionGenerationStatus}
                  onAcceptCard={acceptCard}
                  onRejectCard={rejectCard}
                  onRethinkCard={(cardType, cardId, comment) => {
                    rethinkCard(phaseStep.id, cardType, cardId, comment);
                  }}
                />
              ) : (
                <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  {t('discoveryToolsMain.toolDocumentView.noSessionData')}
                </div>
              )}
            </div>

            {extras}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(Math.max(1, phaseIndex - 1))}
                disabled={phaseIndex <= 1}
                className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 disabled:opacity-50 dark:bg-navy-900/70 dark:text-slate-300"
              >
                {t('discoveryToolsMain.toolDocumentView.previous2')}
              </button>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t('discoveryToolsMain.toolDocumentView.step')} {phaseIndex}/{stepDefs.length}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (phaseIndex === currentStep) {
                    nextStep();
                    return;
                  }
                  setCurrentStep(Math.min(stepDefs.length, phaseIndex + 1));
                }}
                disabled={
                  phaseIndex >= stepDefs.length || (phaseIndex === currentStep && !canAdvanceStep())
                }
                className="rounded-lg bg-navy-900 px-3 py-2 text-sm text-white hover:bg-navy-800 disabled:opacity-50"
              >
                {phaseIndex >= stepDefs.length
                  ? t('discoveryToolsMain.toolDocumentView.finish')
                  : t('discoveryToolsMain.toolDocumentView.nextStep')}
              </button>
            </div>
          </div>
        );
      };

      const phaseIcon = (stepId: string) => {
        if (['mission', 'context'].includes(stepId)) return Target;
        if (['input', 'signals'].includes(stepId)) return MessageSquare;
        if (['insights', 'synthesis'].includes(stepId)) return Lightbulb;
        if (['outputs', 'report', 'initiatives'].includes(stepId)) return CheckCircle2;
        return Target;
      };

      return [
        ...stepDefs.map((step) => {
          const isOutputs = ['outputs', 'report', 'initiatives'].includes(step.id);
          return {
            id: step.id,
            icon: phaseIcon(step.id),
            label: {
              en: step.name,
              pl: step.namePl,
            },
            badge: isOutputs
              ? generatedInitiatives.length + (swotData?.outputCandidates?.length || 0)
              : undefined,
            group: groupLabels[phaseGroupIndex(step.id)],
            cSpan: 3 as const, // phase canvases are wide step workspaces
            component: renderPhaseCanvas(step),
          };
        }),
        ...(toolType === 'dynamic-swot'
          ? []
          : [
              {
                id: 'ai-collaboration',
                icon: Sparkles,
                label: { en: 'AI Collaboration Panel', pl: 'AI Collaboration Panel' },
                group: groupLabels[3],
                cSpan: 2 as const,
                component: aiCollaborationSection,
              },
            ]),
      ] as NModeSection[];
    }

    const defaultSections: NModeSection[] = [
      {
        id: 'work',
        icon: Target,
        label: { en: 'Work', pl: 'Praca' },
        component: workSection,
      },
      {
        id: 'review',
        icon: CheckCircle2,
        label: { en: 'Review', pl: 'Review' },
        badge: reviewGaps.length,
        component: reviewSection,
      },
      {
        id: 'outputs',
        icon: Lightbulb,
        label: { en: 'Outputs', pl: 'Outputs' },
        badge: generatedInitiatives.length + (swotData?.outputCandidates?.length || 0),
        component: outputsSection,
      },
      {
        id: 'ai-collaboration',
        icon: Sparkles,
        label: { en: 'AI Collaboration Panel', pl: 'AI Collaboration Panel' },
        component: aiCollaborationSection,
      },
      {
        id: 'comments',
        icon: MessageSquare,
        label: { en: 'Comments', pl: 'Komentarze' },
        badge: nModeComments.length,
        component: (
          <CommentsCanvas
            comments={nModeComments}
            onDeleteComment={handleDeleteComment}
            dateFilter={commentDateFilter}
            onDateFilterChange={setCommentDateFilter}
            sortOrder={commentSortOrder}
            onToggleSort={() => setCommentSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
            commentDraft={commentDraft}
            onCommentDraftChange={setCommentDraft}
            onSubmitComment={async () => {
              const added = await handleAddComment(commentDraft);
              if (added) {
                setCommentDraft('');
                setDraftPriority('normal');
              }
            }}
            draftPriority={draftPriority}
            onDraftPriorityChange={setDraftPriority}
            getPriorityDotClass={getPriorityDotClass}
            getCommentPriority={() => 'normal'}
            getPriorityButtonClass={getPriorityButtonClass}
            getCommentPriorityLabel={getPriorityLabel}
            getCommentPriorityHint={(priority) => getPriorityHint(priority, t)}
          />
        ),
      },
      {
        id: 'activity',
        icon: History,
        label: { en: 'Activity', pl: 'Aktywność' },
        badge: history.length,
        component: (
          <ActivityLogCanvas
            entries={activityEntries}
            stats={activityStats}
            typeMeta={activityTypeMeta}
          />
        ),
      },
      {
        id: 'used-in',
        icon: ExternalLink,
        label: { en: 'Used in', pl: 'Used in' },
        badge: toolBacklinks.length,
        component: (
          <EmbeddedView
            title={t('discoveryToolsMain.toolDocumentView.backlinks')}
            count={toolBacklinks.length}
            loading={toolBacklinksLoading}
            readOnly
            viewModes={['list']}
          >
            {toolBacklinks.length === 0 && !toolBacklinksLoading ? (
              <div className="px-1 text-[11px] text-slate-500 dark:text-slate-400">
                {t('discoveryToolsMain.toolDocumentView.noLinksYet')}
              </div>
            ) : (
              <div className="space-y-2">
                {toolBacklinks.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl bg-white/70 dark:bg-navy-950/40 px-3 py-2"
                  >
                    <div className="text-[11px] font-medium text-slate-800 dark:text-slate-200">
                      {item.sourceType}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      {item.sourceId}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </EmbeddedView>
        ),
      },
    ];

    return defaultSections.map((section) => ({
      ...section,
      group: groupLabels[staticGroupIndexById[section.id] ?? 4],
      cSpan: cSpanById[section.id] ?? section.cSpan,
      cHidden: cHiddenById(section.id) || section.cHidden,
    }));
  }, [
    activeChatMessages,
    activityEntries,
    activityStats,
    activityTypeMeta,
    canAdvanceStep,
    commentDateFilter,
    commentDraft,
    commentSortOrder,
    comments.length,
    completionItems,
    completionReady,
    createdAt,
    currentOrganization?.name,
    currentSession,
    currentStep,
    currentStepDef,
    draftPriority,
    dynamicSwotPhaseSummaries,
    dynamicSwotReadiness,
    generatedInitiatives,
    handleAddComment,
    handleDeleteComment,
    handleGenerateAI,
    handleOpenChat,
    history.length,
    isStrategicPhaseTool,
    isGeneratingAI,
    isPolish,
    isStreaming,
    lastModified,
    nModeComments,
    nextStep,
    onOpenInitiative,
    prevStep,
    progress,
    reviewGaps,
    setCurrentStep,
    stepDefs,
    streamedContent,
    swotData?.outputCandidates,
    swotData?.recommendedMoves,
    toolBacklinks,
    toolBacklinksLoading,
    toolMeta.name,
    toolPermissions.canApproveTool,
    toolPermissions.canGenerate,
    toolPermissions.canRequestReview,
    toolStatus,
    toolType,
  ]);

  const handleSectionChange = useCallback(
    (sectionId: string) => {
      setActiveSection(sectionId);

      if (!isStrategicPhaseTool) return;

      const targetIndex = stepDefs.findIndex((step) => step.id === sectionId);
      if (targetIndex >= 0) {
        setCurrentStep(targetIndex + 1);
      }
    },
    [isStrategicPhaseTool, setCurrentStep, stepDefs]
  );

  const lastSavedLabel = useMemo(() => {
    if (!lastModified) return undefined;
    return `${t('discoveryToolsMain.toolDocumentView.saved')} ${new Date(
      lastModified
    ).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }, [isPolish, lastModified]);

  const lifecycleControls = useMemo(() => {
    const showAiActions = effectivePhaseAiActions.length > 0 || isStreaming || aiReviewCount > 0;

    return (
      <div
        className="flex flex-wrap items-center justify-end gap-1.5"
        data-menu3-actions="tool-lifecycle-ai-chat"
      >
        {toolType === 'dynamic-swot' ? (
          <button
            type="button"
            onClick={() => setShowTeresaProposals((visible) => !visible)}
            className={getMenu3AiButtonClass(false)}
            data-testid="ask-teresa-toolbar"
          >
            <Sparkles size={12} />
            {isPolish ? 'Zapytaj Teresę' : 'Ask Teresa'}
          </button>
        ) : null}
        <span
          className="inline-flex h-8 items-center rounded-full border border-slate-200/60 bg-slate-100 px-3 text-[11px] font-semibold text-slate-500 dark:border-navy-700/60 dark:bg-navy-800 dark:text-slate-300"
          data-menu3-lifecycle-status={toolStatus}
        >
          {statusLabel(toolStatus)}
        </span>
        {toolStatus === 'DRAFT' ? (
          <button
            type="button"
            onClick={handleRequestReview}
            disabled={!completionReady || toolPermissions.canRequestReview === false}
            className={getMenu3AiButtonClass(false)}
            title={
              completionReady
                ? t('discoveryToolsMain.toolDocumentView.requestReviewTitleReady')
                : t('discoveryToolsMain.toolDocumentView.requestReviewTitleNotReady')
            }
          >
            <Send size={12} />
            {t('discoveryToolsMain.toolDocumentView.requestReview')}
          </button>
        ) : null}
        {toolStatus === 'REVIEW' ? (
          <>
            <button
              type="button"
              onClick={handleApprove}
              disabled={!completionReady || toolPermissions.canApproveTool === false}
              className={getMenu3AiButtonClass(false)}
              title={
                completionReady
                  ? t('discoveryToolsMain.toolDocumentView.approveThisSession')
                  : t('discoveryToolsMain.toolDocumentView.requestReviewTitleNotReady')
              }
            >
              <CheckCircle2 size={12} />
              {t('discoveryToolsMain.toolDocumentView.approve')}
            </button>
            <button
              type="button"
              onClick={handleSendBack}
              className={getMenu3AiButtonClass(false)}
              title={t('discoveryToolsMain.toolDocumentView.sendBackToDraftWithAComment')}
            >
              <ExternalLink size={12} />
              {t('discoveryToolsMain.toolDocumentView.sendBack')}
            </button>
          </>
        ) : null}
        {showAiActions ? (
          <ToolPhaseAiActions
            actions={effectivePhaseAiActions}
            activeActionId={activeAiActionId}
            isStreaming={isStreaming}
            isPolish={isPolish}
            onRunAction={(actionId) => void runPhaseAiAction(actionId)}
            onAbort={abortStream}
            aiReviewCount={aiReviewCount}
            onReviewAiCards={scrollToAiCards}
            className="shrink-0"
          />
        ) : null}
      </div>
    );
  }, [
    abortStream,
    activeAiActionId,
    aiReviewCount,
    completionReady,
    effectivePhaseAiActions,
    handleApprove,
    handleRequestReview,
    handleSendBack,
    isPolish,
    isStreaming,
    runPhaseAiAction,
    toolPermissions.canApproveTool,
    toolPermissions.canGenerate,
    toolPermissions.canRequestReview,
    toolStatus,
    toolType,
  ]);

  useEffect(() => {
    if (!onCommandRowActionsChange) return;

    onCommandRowActionsChange(toolType === 'dynamic-swot' ? null : lifecycleControls);
    return () => onCommandRowActionsChange(null);
  }, [lifecycleControls, onCommandRowActionsChange, toolType]);

  const sessionRightPanelSections: ArtifactRightPanelSection[] = useMemo(
    () => [
      {
        id: 'actions',
        label: isPolish ? 'Akcje' : 'Actions',
        icon: Sparkles,
        defaultOpen: true,
        children: lifecycleControls,
      },
      {
        id: 'properties',
        label: isPolish ? 'Właściwości' : 'Properties',
        icon: Target,
        defaultOpen: true,
        children: (
          <ArtifactPropertiesTable
            propertyLabel={isPolish ? 'Właściwość' : 'Property'}
            valueLabel={isPolish ? 'Wartość' : 'Value'}
            rows={properties.map((property) => ({
              id: property.id,
              label: isPolish ? property.label.pl : property.label.en,
              value: String(property.value ?? '—'),
            }))}
          />
        ),
      },
      {
        id: 'relations',
        label: isPolish ? 'Powiązania' : 'Relations',
        icon: ExternalLink,
        defaultOpen: false,
        badge: toolBacklinks.length,
        showZeroBadge: true,
        isEmpty: toolBacklinks.length === 0,
        emptyLabel: isPolish ? 'Brak powiązanych elementów.' : 'No related items.',
        children: (
          <ul className="space-y-2 text-xs text-c-text-secondary">
            {toolBacklinks.map((item) => (
              <li key={item.id}>{`${item.sourceType}: ${item.sourceId}`}</li>
            ))}
          </ul>
        ),
      },
      {
        id: 'evidence',
        label: isPolish ? 'Źródła i założenia' : 'Sources & assumptions',
        icon: CheckCircle2,
        defaultOpen: false,
        children: (
          <p className="text-xs leading-relaxed text-c-text-secondary">
            {isPolish
              ? 'Źródła, założenia i materiał wejściowy użyty w tej sesji są widoczne w kroku Input & Exploration.'
              : 'Sources, assumptions, and input material used in this session are available in Input & Exploration.'}
          </p>
        ),
      },
      {
        id: 'results',
        label: isPolish ? 'Rezultaty' : 'Results',
        icon: Lightbulb,
        defaultOpen: false,
        badge: generatedInitiatives.length + (swotData?.outputCandidates?.length || 0),
        showZeroBadge: true,
        children: (
          <p className="text-xs text-c-text-secondary">
            {isPolish ? `Postęp sesji: ${progress}%` : `Session progress: ${progress}%`}
          </p>
        ),
      },
      {
        id: 'comments',
        label: isPolish ? 'Komentarze' : 'Comments',
        icon: MessageSquare,
        defaultOpen: false,
        badge: nModeComments.length,
        showZeroBadge: true,
        isEmpty: nModeComments.length === 0,
        emptyLabel: isPolish ? 'Brak komentarzy.' : 'No comments.',
        children: <p className="text-xs text-c-text-secondary">{nModeComments.length}</p>,
      },
    ],
    [
      generatedInitiatives.length,
      isPolish,
      lifecycleControls,
      nModeComments.length,
      progress,
      properties,
      swotData?.outputCandidates?.length,
      toolBacklinks,
    ]
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const syncPortalTarget = () => {
      setCommandRowPortalTarget(document.getElementById('module-command-row-right-actions'));
    };

    syncPortalTarget();
    const rafId = window.requestAnimationFrame(syncPortalTarget);
    return () => window.cancelAnimationFrame(rafId);
  }, [toolSessionId, lifecycleControls]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-navy-950">
        <LoadingState variant="spinner" label={t('discoveryToolsMain.toolDocumentView.loading')} />
      </div>
    );
  }

  return (
    <>
      {toolType !== 'dynamic-swot' && commandRowPortalTarget && lifecycleControls
        ? createPortal(lifecycleControls, commandRowPortalTarget)
        : null}
      <NModeShell
        loading={loading}
        presentationMode="n"
        onPresentationModeChange={() => {}}
        showModeSwitcher={false}
        header={{
          title: sessionName || `${toolMeta.name} — Session`,
          onTitleChange: setSessionName,
          titleReadOnly: true,
          artifactId: toolSessionId || toolType,
          artifactType: 'tool',
          onSave: handleSave,
          saving,
          saveState,
          lastSavedLabel,
          isDirty: saveState === 'dirty' || saveState === 'error',
          onClose: onBack,
          statusLabel: statusLabel(toolStatus),
          statusTone:
            toolStatus === 'DRAFT' ? 'draft' : toolStatus === 'REVIEW' ? 'review' : 'approved',
        }}
        rightPanel={
          <div data-testid="tool-session-properties" className="h-full">
            <ArtifactRightPanel
              sections={sessionRightPanelSections}
              className={ARTIFACT_PANEL_CARD_CLASS_DOCKED}
              ariaLabel={isPolish ? 'Panel sesji narzędzia' : 'Tool session panel'}
            />
          </div>
        }
        sections={sections}
        actions={[]}
        actionsVisible={false}
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
      >
        {null}
      </NModeShell>

      {showTeresaProposals && toolType === 'dynamic-swot' && toolSessionId ? (
        <aside
          role="dialog"
          aria-modal="false"
          aria-label={isPolish ? 'Propozycje Teresy' : 'Teresa proposals'}
          className="fixed bottom-5 right-5 z-40 max-h-[70vh] w-[min(440px,calc(100vw-2.5rem))] overflow-y-auto rounded-2xl border border-c-border bg-c-surface p-4 shadow-2xl"
          data-testid="teresa-proposals-panel"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <strong className="text-sm text-c-text">
              {isPolish ? 'Propozycje Teresy' : 'Teresa proposals'}
            </strong>
            <button
              type="button"
              onClick={() => setShowTeresaProposals(false)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setShowTeresaProposals(false);
              }}
              className="rounded-lg px-2 py-1 text-xs text-c-text-secondary hover:bg-c-surface-raised"
              autoFocus
            >
              {isPolish ? 'Zamknij' : 'Close'}
            </button>
          </div>
          <TeresaSwotProposals toolSessionId={toolSessionId} isPolish={isPolish} />
        </aside>
      ) : null}

      <div id="tool-report-export" className="hidden p-8 bg-white text-slate-900">
        <h1 className="text-2xl font-semibold">{sessionName || `${toolMeta.name} — Session`}</h1>
        <p className="mt-2 text-sm text-slate-600">{toolType}</p>
        <div className="mt-6 space-y-2">
          <div>Status: {statusLabel(toolStatus)}</div>
          <div>Progress: {progress}%</div>
          <div>Current step: {currentStepDef?.name || '-'}</div>
        </div>
        {toolType === 'dynamic-swot' && swotData?.summary?.executiveSummary && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold">Executive summary</h2>
            <p className="mt-2 text-sm">{swotData.summary.executiveSummary}</p>
          </div>
        )}
      </div>

      {showRequestReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 dark:bg-navy-900">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {t('discoveryToolsMain.toolDocumentView.requestReview2')}
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t('discoveryToolsMain.toolDocumentView.configureDecisionOwnerHint')}
              </p>
            </div>

            <div className="space-y-4">
              <label className="block space-y-1">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {t('discoveryToolsMain.toolDocumentView.decisionOwner')}
                </span>
                <select
                  value={reviewDecisionOwnerId}
                  onChange={(e) => setReviewDecisionOwnerId(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300/60 bg-white px-3 text-sm dark:border-navy-600/40 dark:bg-navy-950"
                >
                  <option value="">{t('discoveryToolsMain.toolDocumentView.select')}</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name ||
                        [user.firstName, user.lastName].filter(Boolean).join(' ') ||
                        user.email ||
                        user.id}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {t('discoveryToolsMain.toolDocumentView.dueDate')}
                </span>
                <input
                  type="date"
                  value={reviewDueDate}
                  onChange={(e) => setReviewDueDate(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300/60 bg-white px-3 text-sm dark:border-navy-600/40 dark:bg-navy-950"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {t('discoveryToolsMain.toolDocumentView.priority')}
                </span>
                <select
                  value={reviewPriority}
                  onChange={(e) => setReviewPriority(e.target.value as any)}
                  className="h-10 w-full rounded-lg border border-slate-300/60 bg-white px-3 text-sm dark:border-navy-600/40 dark:bg-navy-950"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRequestReviewModal(false)}
                className="rounded-lg border border-slate-300/60 px-4 py-2 text-sm text-slate-700 dark:border-navy-600/40 dark:text-slate-300"
              >
                {t('discoveryToolsMain.toolDocumentView.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmRequestReview()}
                className="rounded-lg bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-800"
              >
                {t('discoveryToolsMain.toolDocumentView.sendReview')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ToolDocumentView;
