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

import { LoadingState } from '@/components/ui/primitives';
import { CONSULTING_TOOL_STANDARD_OUTPUTS } from '@/config/consultingToolsStandard';
import { useToolAI } from '@/hooks/discovery/useToolAI';
import { usePresentationMode } from '@/hooks/usePresentationMode';
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
import { GenerateInitiativesModal } from './GenerateInitiativesModal';
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

const statusLabel = (
  status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'GENERATED' | 'COMPLETED',
  isPolish: boolean
) =>
  (
    ({
      DRAFT: isPolish ? 'Draft' : 'Draft',
      REVIEW: isPolish ? 'Review' : 'Review',
      APPROVED: isPolish ? 'Approved' : 'Approved',
      GENERATED: isPolish ? 'Generated' : 'Generated',
      COMPLETED: isPolish ? 'Completed' : 'Completed',
    }) as const
  )[status] || status;

type ToolSaveState = 'saved' | 'saving' | 'dirty' | 'error';

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

const getPriorityHint = (priority: CommentPriority, isPolish: boolean) =>
  priority === 'high'
    ? isPolish
      ? 'Wymaga natychmiastowej uwagi'
      : 'Requires immediate attention'
    : priority === 'low'
      ? isPolish
        ? 'Komentarz informacyjny'
        : 'Informational comment'
      : isPolish
        ? 'Komentarz standardowy'
        : 'Standard comment';

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
    loadSession,
    saveSession,
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
  const [saveState, setSaveState] = useState<ToolSaveState>('saved');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [activeSection, setActiveSection] = useState<string>(
    isStrategicPhaseTool ? 'mission' : 'work'
  );
  const [commandRowPortalTarget, setCommandRowPortalTarget] = useState<HTMLElement | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showRequestReviewModal, setShowRequestReviewModal] = useState(false);
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
      toast.success(isPolish ? 'Wyeksportowano PDF' : 'PDF exported');
    } catch {
      toast.error(isPolish ? 'Nie udało się wyeksportować PDF' : 'PDF export failed');
    } finally {
      setIsExportingPdf(false);
    }
  }, [isPolish, sessionName, toolMeta.name, toolType]);

  const autoExportRanRef = useRef(false);
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
      const sessionData = await Api.getToolSession(toolSessionId);
      setToolStatus((sessionData.status || 'DRAFT').toUpperCase() as any);
      setSessionName(sessionData.name || '');
      setCreatedAt(sessionData.createdAt || '');
      setLastModified(sessionData.updatedAt || '');
      setSaveState('saved');
      setGeneratedInitiatives(sessionData.generatedInitiatives || []);
      setToolDecisions(sessionData.decisions || []);
      setToolPermissions(sessionData.permissions || {});

      hydrateSessionFromApi({
        id: toolSessionId,
        toolType,
        name: sessionData.name,
        createdAt: sessionData.createdAt,
        updatedAt: sessionData.updatedAt,
        status: sessionData.status,
        answers: sessionData.answers || {},
        completionPercent: sessionData.completion_percent ?? sessionData.completionPercent,
      });

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
      toast.error(isPolish ? 'Błąd ładowania sesji' : 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [hydrateSessionFromApi, isPolish, toolSessionId, toolType]);

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

  useEffect(() => {
    const initSession = async () => {
      if (sessionId) {
        setToolSessionId(sessionId);
        loadSession(sessionId);
        return;
      }

      if (!currentSession || currentSession.toolType !== toolType) {
        createSession(toolType);
        const name = `${toolMeta.name} — Session`;
        try {
          const created = await Api.createToolSession({
            toolType,
            name,
            projectId: currentProjectId || null,
          });
          setToolSessionId(created.id);
          setSessionName(name);
          setToolStatus('DRAFT');
          setLastModified(new Date().toISOString());
          setSaveState('saved');
        } catch (error) {
          console.error('Failed to create tool session:', error);
          toast.error(isPolish ? 'Nie udało się utworzyć sesji' : 'Failed to create session');
        }
      }
    };

    void initSession();
  }, [
    createSession,
    currentProjectId,
    currentSession,
    isPolish,
    loadSession,
    sessionId,
    toolMeta.name,
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

  useEffect(() => {
    if (!currentSession || !toolSessionId) return;
    if (!isSessionHydrated) return;
    setSaveState('dirty');
    const timeout = setTimeout(async () => {
      setSaveState('saving');
      try {
        await Api.updateToolSession(toolSessionId, {
          answers: currentSession.inputData as Record<string, unknown>,
          completionPercent: completionReady ? 100 : progress,
          confidenceAvg,
          missingItems: missingItemsPayload,
          wizardState: wizardStatePayload,
        });
        const savedAt = new Date().toISOString();
        setLastModified(savedAt);
        setSaveState('saved');
      } catch (error) {
        console.error('Auto-save failed:', error);
        setSaveState('error');
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [
    completionReady,
    confidenceAvg,
    currentSession,
    isSessionHydrated,
    missingItemsPayload,
    progress,
    toolSessionId,
    wizardStatePayload,
  ]);

  const handleSave = async () => {
    if (!toolSessionId || !currentSession) return;
    if (!isSessionHydrated) {
      toast.error(
        t('tools.session.notLoadedYet', 'Session is still loading — try again in a moment')
      );
      return;
    }
    setSaving(true);
    setSaveState('saving');
    try {
      await Api.updateToolSession(toolSessionId, {
        answers: currentSession.inputData as Record<string, unknown>,
        completionPercent: completionReady ? 100 : progress,
        confidenceAvg,
        missingItems: missingItemsPayload,
        wizardState: wizardStatePayload,
      });
      await saveSession();
      const savedAt = new Date().toISOString();
      setLastModified(savedAt);
      setSaveState('saved');
      toast.success(isPolish ? 'Zapisano' : 'Saved');
    } catch {
      setSaveState('error');
      toast.error(isPolish ? 'Błąd zapisu' : 'Save failed');
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
      toast.error(
        isPolish ? 'Wypełnij wszystkie wymagane elementy' : 'Complete all required items first'
      );
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
      toast.success(isPolish ? 'Wysłano do review' : 'Sent to review');
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
    try {
      const result = await Api.approveTool(toolSessionId);
      setToolStatus((result.status || 'APPROVED').toUpperCase() as any);
      toast.success(isPolish ? 'Zatwierdzono' : 'Approved');
      await fetchAll();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve');
    }
  };

  const handleSendBack = async () => {
    if (!toolSessionId) return;
    const reason = prompt(isPolish ? 'Powód odesłania:' : 'Reason for sending back:');
    if (!reason) return;
    try {
      const result = await Api.sendToolBackToDraft(toolSessionId, reason);
      setToolStatus((result.status || 'DRAFT').toUpperCase() as any);
      toast.success(isPolish ? 'Odesłano do draftu' : 'Sent back to draft');
      await fetchAll();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send back');
    }
  };

  const handleGenerate = async (payload: {
    methodologyId: string;
    count: number;
    includeChatContext: boolean;
    decisionOwnerId?: string;
  }) => {
    if (!toolSessionId) return;
    if (toolPermissions.canGenerate === false) {
      toast.error(isPolish ? 'Brak uprawnień' : 'Permission denied');
      return;
    }
    try {
      setGenerationDefaults(payload);
      const result = await Api.generateToolInitiatives(toolSessionId, payload);
      if (result?.status) {
        setToolStatus(String(result.status).toUpperCase() as any);
      }
      const updated = await Api.getToolGeneratedInitiatives(toolSessionId);
      setGeneratedInitiatives(updated.initiatives || []);
      setShowGenerateModal(false);
      await fetchAll();
      toast.success(isPolish ? 'Wygenerowano inicjatywy' : 'Initiatives generated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate');
    }
  };

  const handleGenerateAI = async () => {
    const primaryAction = phaseAiActions[0];
    if (!primaryAction) return;
    setIsGeneratingAI(true);
    try {
      await runPhaseAiAction(primaryAction.id);
      toast.success(isPolish ? 'AI zakończyło generowanie' : 'AI generation finished');
    } catch {
      toast.error(isPolish ? 'Błąd generowania AI' : 'AI generation failed');
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
      toast.success(isPolish ? 'Dodano komentarz' : 'Comment added');
      return true;
    } catch {
      toast.error(isPolish ? 'Nie udało się dodać komentarza' : 'Failed to add comment');
      return false;
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!toolSessionId) return;
    try {
      await Api.delete(`/api/tools/${toolSessionId}/comments/${commentId}`);
      const updated = await Api.get(`/api/tools/${toolSessionId}/comments`);
      setComments(updated || []);
      toast.success(isPolish ? 'Usunięto komentarz' : 'Comment deleted');
    } catch {
      toast.error(isPolish ? 'Nie udało się usunąć komentarza' : 'Failed to delete comment');
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
          label: isPolish ? 'Utworzono' : 'Created',
          style: 'border-emerald-300/50 bg-emerald-500/10 text-emerald-600',
        },
        comment: {
          icon: <MessageSquare size={10} />,
          label: isPolish ? 'Komentarz' : 'Comment',
          style: 'border-amber-300/50 bg-amber-500/10 text-amber-600',
        },
        review_requested: {
          icon: <Send size={10} />,
          label: isPolish ? 'Review' : 'Review',
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
        value: statusLabel(toolStatus, isPolish),
        onChange: () => {},
        readOnly: true,
      },
      {
        id: 'runtimeStage',
        label: { en: 'Consulting stage', pl: 'Etap konsultingowy' },
        type: 'text',
        value:
          {
            entry: isPolish ? 'Wejście i cel' : 'Entry & purpose',
            conversation: isPolish ? 'Rozmowa i zbieranie' : 'Conversation & capture',
            analysis: isPolish ? 'Analiza' : 'Analysis',
            summary: isPolish ? 'Wnioski i summary' : 'Conclusions & summary',
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
                {isPolish ? 'Visible human + AI loop' : 'Visible human + AI loop'}
              </div>
              <div className="text-sm text-slate-700 dark:text-slate-300">
                {isPolish
                  ? 'Sesja ma pokazywać pytanie decyzyjne, jakość dowodów, warstwę syntezy i gotowość outputów bez ukrywania pracy AI.'
                  : 'The session should keep the decision question, evidence quality, synthesis layer, and output readiness visible without hiding AI work.'}
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
              {isPolish ? 'Aktualny etap' : 'Current stage'}:{' '}
              {
                {
                  entry: isPolish ? 'Wejście i cel' : 'Entry & purpose',
                  conversation: isPolish ? 'Rozmowa i zbieranie' : 'Conversation & capture',
                  analysis: isPolish ? 'Analiza i benchmarking' : 'Analysis & benchmarking',
                  summary: isPolish ? 'Wnioski i final summary' : 'Conclusions & final summary',
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
                        ? isPolish
                          ? 'Gotowe'
                          : 'Ready'
                        : isPolish
                          ? 'Wymaga pracy'
                          : 'Needs work')}
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
              onOpenInitiatives={() => setShowGenerateModal(true)}
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
              {isPolish ? 'Brak danych sesji' : 'No session data'}
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
            {isPolish ? 'Previous' : 'Previous'}
          </button>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {isPolish ? 'Krok' : 'Step'} {currentStep}/{stepDefs.length}
          </div>
          <button
            type="button"
            onClick={() => nextStep()}
            disabled={currentStep >= stepDefs.length || !canAdvanceStep()}
            className="rounded-lg bg-navy-900 px-3 py-2 text-sm text-white hover:bg-navy-800 disabled:opacity-50"
          >
            {isPolish ? 'Next' : 'Next'}
          </button>
        </div>
      </div>
    );

    const reviewSection = (
      <div className="space-y-8">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {isPolish ? 'Applied conclusions i gotowość' : 'Applied conclusions & readiness'}
          </h2>
          <div className="rounded-2xl bg-slate-50/70 dark:bg-navy-900/40 p-4 space-y-4">
            <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 text-sm text-slate-600 dark:border-navy-700/70 dark:bg-navy-950/30 dark:text-slate-300">
              {isPolish
                ? 'Ta sekcja zamienia analizę w praktyczne wnioski i sprawdza, czy sesja ma już jakość źródła do raportu, prezentacji, inicjatywy lub idei.'
                : 'This section turns analysis into applied conclusions and checks whether the session is source-grade enough for a report, presentation, initiative, or idea.'}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
                  {isPolish ? 'Status' : 'Status'}
                </div>
                <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {statusLabel(toolStatus, isPolish)}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
                  {isPolish ? 'Progress' : 'Progress'}
                </div>
                <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">{progress}%</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
                  {isPolish ? 'Created' : 'Created'}
                </div>
                <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {createdAt ? new Date(createdAt).toLocaleDateString() : '—'}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
                  {isPolish ? 'Last modified' : 'Last modified'}
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
                    {isPolish ? 'Applied conclusions' : 'Applied conclusions'}
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
                  {isPolish ? 'Final source summary' : 'Final source summary'}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {swotData.summary.executiveSummary}
                </p>
              </div>
            )}

            {reviewGaps.length > 0 && (
              <div className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                <div className="mb-2 font-medium">
                  {isPolish ? 'Brakujące elementy' : 'Missing items'}
                </div>
                <ul className="space-y-1">
                  {reviewGaps.map((gap, index) => (
                    <li key={`${gap}-${index}`}>• {gap}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 text-xs text-slate-500 dark:border-navy-700/70 dark:bg-navy-950/30 dark:text-slate-400">
              {isPolish
                ? 'Akcje lifecycle tej sesji są w Menu 3 po prawej: Request Review, Approve, Send back i Generate initiatives.'
                : 'Session lifecycle actions live in Menu 3 on the right: Request Review, Approve, Send back, and Generate initiatives.'}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {isPolish ? 'Generation settings' : 'Generation settings'}
          </h2>
          <div className="grid gap-4 md:grid-cols-3 rounded-2xl bg-slate-50/70 dark:bg-navy-900/40 p-4">
            <label className="space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
                {isPolish ? 'Methodology' : 'Methodology'}
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
                {isPolish ? 'Initiatives count' : 'Initiatives count'}
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
              <span>{isPolish ? 'Include chat context' : 'Include chat context'}</span>
            </label>
          </div>
        </div>

        {toolDecisions.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {isPolish ? 'Gate decisions' : 'Gate decisions'}
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
              {isPolish ? 'Source artifact' : 'Source artifact'}
            </h2>
            <div className="rounded-2xl bg-slate-50/70 p-4 dark:bg-navy-900/40">
              <div className="text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
                {isPolish ? 'Final source summary' : 'Final source summary'}
              </div>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                {swotData.summary.executiveSummary}
              </p>
              {(swotData.summary.appliedConclusions?.length || 0) > 0 && (
                <div className="mt-4">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-500">
                    {isPolish ? 'Applied conclusions' : 'Applied conclusions'}
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
            {isPolish ? 'Kontrakt outputów' : 'Output contract'}
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
                    ? isPolish
                      ? 'Dla ruchów lub wniosków gotowych do wdrożenia.'
                      : 'For moves or conclusions ready for execution.'
                    : outputType === 'report'
                      ? isPolish
                        ? 'Dla final source summary gotowego do pokazania.'
                        : 'For a final source summary ready to be reviewed.'
                      : outputType === 'presentation'
                        ? isPolish
                          ? 'Dla komunikacji wizualnej bez ponownego składania narracji.'
                          : 'For visual communication without rebuilding the narrative.'
                        : isPolish
                          ? 'Dla obiecujących hipotez lub kierunków do dalszej pracy.'
                          : 'For promising hypotheses or directions that need further work.'}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {isPolish ? 'Inicjatywy z tej sesji' : 'Initiatives from this session'}
          </h2>
          <EmbeddedView
            title={isPolish ? 'Generated initiatives' : 'Generated initiatives'}
            count={generatedInitiatives.length}
            viewModes={['list']}
            readOnly
          >
            {generatedInitiatives.length === 0 ? (
              <div className="px-1 text-[11px] text-slate-500 dark:text-slate-400">
                {isPolish ? 'Brak wygenerowanych inicjatyw' : 'No initiatives generated yet'}
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
                {isPolish ? 'Recommended moves' : 'Recommended moves'}
              </h2>
              <div className="space-y-2">
                {(swotData?.recommendedMoves || []).length === 0 ? (
                  <div className="rounded-2xl bg-slate-50/70 dark:bg-navy-900/40 p-4 text-sm text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Brak wygenerowanych ruchów.' : 'No moves generated yet.'}
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
                {isPolish ? 'Output candidates' : 'Output candidates'}
              </h2>
              <div className="space-y-2">
                {(swotData?.outputCandidates || []).length === 0 ? (
                  <div className="rounded-2xl bg-slate-50/70 dark:bg-navy-900/40 p-4 text-sm text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Brak kandydatów outputów.' : 'No output candidates yet.'}
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
        onOpenInitiatives={() => setShowGenerateModal(true)}
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
        {isPolish ? 'Brak danych sesji' : 'No session data'}
      </div>
    );

    // ── Standard-C group tabs (mirrors InsightViewer/InitiativeDocumentView) ──
    // A bilingual groupLabels array switched on isPolish, plus a per-section
    // group + cSpan assignment, so NModeShell's C-board renders top group tabs
    // and lets wide/table-heavy sections breathe in the dense 3-column grid.
    const groupLabels = isPolish
      ? ['Sesja', 'Analiza', 'Outputs', 'Współpraca', 'Zapisy']
      : ['Session', 'Analysis', 'Outputs', 'Collaboration', 'Records'];
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
                      {isPolish ? 'AI consultant flow' : 'AI consultant flow'}
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
                  onOpenInitiatives={() => setShowGenerateModal(true)}
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
                  {isPolish ? 'Brak danych sesji' : 'No session data'}
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
                {isPolish ? 'Poprzedni' : 'Previous'}
              </button>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {isPolish ? 'Krok' : 'Step'} {phaseIndex}/{stepDefs.length}
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
                  ? isPolish
                    ? 'Zakończ'
                    : 'Finish'
                  : isPolish
                    ? 'Następny'
                    : 'Next'}
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
              en: isOutputs ? 'Outputs & Actions' : step.name,
              pl: isOutputs ? 'Outputs & Actions' : step.namePl,
            },
            badge: isOutputs
              ? generatedInitiatives.length + (swotData?.outputCandidates?.length || 0)
              : undefined,
            group: groupLabels[phaseGroupIndex(step.id)],
            cSpan: 3 as const, // phase canvases are wide step workspaces
            component: renderPhaseCanvas(step),
          };
        }),
        {
          id: 'ai-collaboration',
          icon: Sparkles,
          label: { en: 'AI Collaboration Panel', pl: 'AI Collaboration Panel' },
          group: groupLabels[3],
          cSpan: 2 as const,
          component: aiCollaborationSection,
        },
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
            getCommentPriorityHint={(priority) => getPriorityHint(priority, isPolish)}
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
            title={isPolish ? 'Powiązania' : 'Backlinks'}
            count={toolBacklinks.length}
            loading={toolBacklinksLoading}
            readOnly
            viewModes={['list']}
          >
            {toolBacklinks.length === 0 && !toolBacklinksLoading ? (
              <div className="px-1 text-[11px] text-slate-500 dark:text-slate-400">
                {isPolish ? 'Brak powiązań' : 'No links yet'}
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
    showGenerateModal,
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
    return `${isPolish ? 'Zapisano' : 'Saved'} ${new Date(lastModified).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }, [isPolish, lastModified]);

  const commandRowActions = useMemo(() => {
    const showAiActions = effectivePhaseAiActions.length > 0 || isStreaming || aiReviewCount > 0;

    return (
      <div
        className="flex flex-wrap items-center justify-end gap-1.5"
        data-menu3-actions="tool-lifecycle-ai-chat"
      >
        <span
          className="inline-flex h-8 items-center rounded-full border border-slate-200/60 bg-slate-100 px-3 text-[11px] font-semibold text-slate-500 dark:border-navy-700/60 dark:bg-navy-800 dark:text-slate-300"
          data-menu3-lifecycle-status={toolStatus}
        >
          {statusLabel(toolStatus, isPolish)}
        </span>
        {toolStatus === 'DRAFT' ? (
          <button
            type="button"
            onClick={handleRequestReview}
            disabled={!completionReady || toolPermissions.canRequestReview === false}
            className={getMenu3AiButtonClass(false)}
            title={
              completionReady
                ? isPolish
                  ? 'Wyślij sesję do review'
                  : 'Request review for this session'
                : isPolish
                  ? 'Uzupełnij wymagane elementy przed review'
                  : 'Complete required items before review'
            }
          >
            <Send size={12} />
            {isPolish ? 'Request Review' : 'Request Review'}
          </button>
        ) : null}
        {toolStatus === 'REVIEW' ? (
          <>
            <button
              type="button"
              onClick={handleApprove}
              disabled={toolPermissions.canApproveTool === false}
              className={getMenu3AiButtonClass(false)}
              title={isPolish ? 'Zatwierdź sesję' : 'Approve this session'}
            >
              <CheckCircle2 size={12} />
              {isPolish ? 'Approve' : 'Approve'}
            </button>
            <button
              type="button"
              onClick={handleSendBack}
              className={getMenu3AiButtonClass(false)}
              title={
                isPolish ? 'Odeślij do draftu z komentarzem' : 'Send back to draft with a comment'
              }
            >
              <ExternalLink size={12} />
              {isPolish ? 'Send back' : 'Send back'}
            </button>
          </>
        ) : null}
        {['APPROVED', 'GENERATED', 'COMPLETED'].includes(toolStatus) ? (
          <button
            type="button"
            onClick={() => setShowGenerateModal(true)}
            disabled={toolPermissions.canGenerate === false}
            className={getMenu3AiButtonClass(false)}
            title={
              isPolish
                ? 'Wygeneruj inicjatywy z zatwierdzonej sesji'
                : 'Generate initiatives from approved session'
            }
          >
            <Sparkles size={12} />
            {isPolish ? 'Generate initiatives' : 'Generate initiatives'}
          </button>
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
  ]);

  useEffect(() => {
    if (!onCommandRowActionsChange) return;

    onCommandRowActionsChange(commandRowActions);
    return () => onCommandRowActionsChange(null);
  }, [commandRowActions, onCommandRowActionsChange]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const syncPortalTarget = () => {
      setCommandRowPortalTarget(document.getElementById('module-command-row-right-actions'));
    };

    syncPortalTarget();
    const rafId = window.requestAnimationFrame(syncPortalTarget);
    return () => window.cancelAnimationFrame(rafId);
  }, [toolSessionId, commandRowActions]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-navy-950">
        <LoadingState variant="spinner" label={isPolish ? 'Ładowanie...' : 'Loading...'} />
      </div>
    );
  }

  return (
    <>
      {commandRowPortalTarget && commandRowActions
        ? createPortal(commandRowActions, commandRowPortalTarget)
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
          statusDotColor: toolMeta.statusDot,
        }}
        properties={properties}
        sections={sections}
        actions={[]}
        actionsVisible={false}
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
      >
        {null}
      </NModeShell>

      <div id="tool-report-export" className="hidden p-8 bg-white text-slate-900">
        <h1 className="text-2xl font-semibold">{sessionName || `${toolMeta.name} — Session`}</h1>
        <p className="mt-2 text-sm text-slate-600">{toolType}</p>
        <div className="mt-6 space-y-2">
          <div>Status: {statusLabel(toolStatus, false)}</div>
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

      {showGenerateModal && (
        <GenerateInitiativesModal
          isPolish={isPolish}
          defaults={generationDefaults}
          onClose={() => setShowGenerateModal(false)}
          onGenerate={handleGenerate}
        />
      )}

      {showRequestReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 dark:bg-navy-900">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {isPolish ? 'Request review' : 'Request review'}
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {isPolish
                  ? 'Skonfiguruj właściciela decyzji i termin review.'
                  : 'Configure decision owner and review due date.'}
              </p>
            </div>

            <div className="space-y-4">
              <label className="block space-y-1">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {isPolish ? 'Decision owner' : 'Decision owner'}
                </span>
                <select
                  value={reviewDecisionOwnerId}
                  onChange={(e) => setReviewDecisionOwnerId(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300/60 bg-white px-3 text-sm dark:border-navy-600/40 dark:bg-navy-950"
                >
                  <option value="">{isPolish ? '-- Wybierz --' : '-- Select --'}</option>
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
                  {isPolish ? 'Due date' : 'Due date'}
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
                  {isPolish ? 'Priority' : 'Priority'}
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
                {isPolish ? 'Cancel' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmRequestReview()}
                className="rounded-lg bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-800"
              >
                {isPolish ? 'Send review' : 'Send review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ToolDocumentView;
