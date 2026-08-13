/**
 * ToolWorkspace - Main container for strategic tool interface
 *
 * Orchestrates the tool header, canvas, and action bar.
 * Manages session state and AI interactions.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/shared/states';
import { computeTensionCoverage, validateMoveSet } from '@/config/swot/swotTensionEngine';
import { useHelpSidePanel } from '@/contexts/HelpContext';
import { useToolAI } from '@/hooks/discovery/useToolAI';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { ProposalCardType, ToolType, useToolStore } from '@/store/useToolStore';
import { AppView } from '@/types';

import { countAiCardStatuses, getAiReviewTotal, scrollToAiCards } from './aiCardGovernance';
import { GenerateInitiativesModal } from './GenerateInitiativesModal';
import ToolOutputsPanel from './report/ToolOutputsPanel';
import { ToolActionBar } from './ToolActionBar';
import { ToolCanvas } from './ToolCanvas';
import { ToolHeader } from './ToolHeader';
import { ToolReviewPanel } from './ToolReviewPanel';

// ==================== TYPES ====================

interface ToolWorkspaceProps {
  toolType: ToolType;
  sessionId?: string;
  onBack: () => void;
  onCreateInitiative?: () => void;
}

// ==================== TOOL METADATA ====================

const TOOL_METADATA: Partial<
  Record<
    ToolType,
    {
      name: string;
      namePl: string;
      color: string;
      badge: string;
    }
  >
> = {
  'dynamic-swot': {
    name: 'Dynamic SWOT',
    namePl: 'Dynamiczny SWOT',
    color: 'emerald',
    badge: 'SWT',
  },
  'market-forces': {
    name: 'Market Forces',
    namePl: 'Siły Rynkowe',
    color: 'blue',
    badge: 'PTR',
  },
  'growth-paths': {
    name: 'Growth Paths',
    namePl: 'Ścieżki Wzrostu',
    color: 'purple',
    badge: 'ANS',
  },
  'value-chain': {
    name: 'Value Chain',
    namePl: 'Łańcuch Wartości',
    color: 'orange',
    badge: 'VCH',
  },
  'portfolio-priority': {
    name: 'Portfolio Priority',
    namePl: 'Priorytetyzacja Portfolio',
    color: 'pink',
    badge: 'BCG',
  },
  'ambition-decomposer': {
    name: 'Ambition Decomposer',
    namePl: 'Dekompozycja Ambicji',
    color: 'cyan',
    badge: 'AMB',
  },
  'focus-tradeoff': {
    name: 'Focus & Trade-off',
    namePl: 'Fokus i Kompromisy',
    color: 'red',
    badge: 'FOC',
  },
  'risk-uncertainty': {
    name: 'Risk & Uncertainty',
    namePl: 'Ryzyko i Niepewność',
    color: 'amber',
    badge: 'RSK',
  },
  'capability-mapper': {
    name: 'Capability Mapper',
    namePl: 'Mapa Kompetencji',
    color: 'indigo',
    badge: 'CAP',
  },
  'narrative-engine': {
    name: 'Narrative Engine',
    namePl: 'Silnik Narracji',
    color: 'teal',
    badge: 'NAR',
  },
  'sop-builder': {
    name: 'SOP Builder',
    namePl: 'Kreator SOP',
    color: 'blue',
    badge: 'SOP',
  },
  'a3-problem-solving': {
    name: 'A3 Problem Solving',
    namePl: 'A3 Rozwiązywanie',
    color: 'amber',
    badge: 'A3',
  },
  'smed-planner': {
    name: 'SMED Planner',
    namePl: 'Planer SMED',
    color: 'orange',
    badge: 'SMD',
  },
  'dms-builder': {
    name: 'DMS Builder',
    namePl: 'Kreator DMS',
    color: 'emerald',
    badge: 'DMS',
  },
  'inventory-autopilot': {
    name: 'Inventory Autopilot',
    namePl: 'Autopilot Zapasów',
    color: 'purple',
    badge: 'INV',
  },
};

// ==================== COMPONENT ====================

const getFallbackMeta = (toolType: ToolType) => ({
  name: toolType,
  namePl: toolType,
  color: 'slate',
  badge: 'TLS',
});

// ==================== COMPONENT ====================

export const ToolWorkspace: React.FC<ToolWorkspaceProps> = ({
  toolType,
  sessionId,
  onBack,
  onCreateInitiative,
}) => {
  const { i18n, t } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const {
    setOpen: setHelpOpen,
    setActiveTab: setHelpTab,
    setKnowledgeModuleIdOverride,
  } = useHelpSidePanel();
  const {
    currentOrganization,
    activeChatMessages,
    navigateWithChatContext,
    setCurrentView,
    currentProjectId,
  } = useAppStore();
  const [toolSessionId, setToolSessionId] = useState<string | null>(sessionId || null);
  // CAS (Sprint S1): the server now REQUIRES `expectedVersion` on every PUT
  // /api/tools/:toolId and rejects a stale one with 409 -- see
  // ToolController.updateToolSession. Tracked in a ref (not state) because
  // it must be read synchronously inside the debounced autosave closure
  // below without forcing that effect to re-run on every version bump.
  // Populated from every server response that carries a real `version`
  // (create / GET / a successful PUT) -- NEVER incremented locally, so a
  // stale local guess can never be sent as if it were server truth.
  const sessionVersionRef = useRef<number | undefined>(undefined);
  const [toolStatus, setToolStatus] = useState<'DRAFT' | 'REVIEW' | 'APPROVED'>('DRAFT');
  const [generatedInitiatives, setGeneratedInitiatives] = useState<
    { id: string; title: string; status?: string }[]
  >([]);
  const [recentInitiatives, setRecentInitiatives] = useState<
    { id: string; title: string; status?: string }[]
  >([]);
  const [toolDecisions, setToolDecisions] = useState<
    { decision_type: string; status: string; decision_id?: string; decision_status?: string }[]
  >([]);
  const [toolPermissions, setToolPermissions] = useState<{
    canRequestReview?: boolean;
    canApproveTool?: boolean;
    canGenerate?: boolean;
  }>({});
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showRequestReviewModal, setShowRequestReviewModal] = useState(false);
  const [reviewDueDate, setReviewDueDate] = useState('');
  const [reviewPriority, setReviewPriority] = useState<'low' | 'medium' | 'high' | 'critical'>(
    'medium'
  );
  const [reviewDecisionOwnerId, setReviewDecisionOwnerId] = useState<string>('');
  const [users, setUsers] = useState<any[]>([]);
  const [generationDefaults, setGenerationDefaults] = useState<{
    methodologyId: string;
    count: number;
    includeChatContext: boolean;
  }>({
    methodologyId: 'impact-feasibility',
    count: 3,
    includeChatContext: true,
  });

  // Tool store
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
    getStepDefinitions,
    calculateProgress,
    acceptCard,
    rejectCard,
  } = useToolStore();

  // AI integration
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

  const toolMeta = TOOL_METADATA[toolType] || getFallbackMeta(toolType);
  const stepDefs = getStepDefinitions();
  const progress = calculateProgress();

  const reviewGaps = useMemo(() => {
    if (!currentSession) return [];
    const gaps: string[] = [];
    const data = currentSession.inputData as any;
    const accepted = (items: any[] = []) =>
      items.filter(
        (item: any) =>
          item?.proposalStatus !== 'ai-proposed' &&
          item?.proposalStatus !== 'rethinking' &&
          item?.proposalStatus !== 'rejected'
      );
    if (toolType === 'dynamic-swot') {
      if (!data.context?.goal || !data.context?.scope || !data.context?.successSignal) {
        gaps.push('Missing mission brief');
      }
      ['strengths', 'weaknesses', 'opportunities', 'threats'].forEach((q) => {
        if (!data.items?.some((i: any) => i.quadrant === q)) {
          gaps.push(`Missing ${q}`);
        }
      });
      if (!accepted(data.tensions).length && !accepted(data.correlations).length)
        gaps.push('Missing strategic tensions');
      else {
        // OXFORD O3: tension coverage is enforced — types formable from accepted
        // items must exist (SO/WO/ST/WT), structurally empty types are excused.
        const coverage = computeTensionCoverage(data.items || [], data.tensions || []);
        if (coverage.missing.length > 0) {
          gaps.push(`Missing tension types: ${coverage.missing.join(', ')}`);
        }
      }
      if (!accepted(data.recommendedMoves).length) gaps.push('Missing recommended moves');
      else {
        // OXFORD O3 / CONCLUSION_LAYER W2: every move needs a trade-off and a
        // rejected alternative — a recommendation without them is a list, not a decision.
        const moveVerdict = validateMoveSet(
          data.recommendedMoves || [],
          data.items || [],
          data.tensions || []
        );
        moveVerdict.perMove
          .filter((m) => m.issues.length > 0)
          .forEach((m) => {
            const codes = Array.from(new Set(m.issues.map((issue) => issue.code))).join(', ');
            gaps.push(`Move "${m.title}" fails W2 (${codes})`);
          });
      }
      if (
        !data.summary?.executiveSummary ||
        ['ai-proposed', 'rethinking', 'rejected'].includes(data.summary?.proposalStatus)
      ) {
        gaps.push('Missing final source summary');
      }
      if (!accepted(data.outputCandidates).length) gaps.push('Missing output candidates');
    }
    if (toolType === 'market-forces') {
      if (!data.context?.industry) gaps.push('Missing industry');
      if (!data.context?.geographicScope) gaps.push('Missing geographic scope');
      Object.values(data.forces || {}).forEach((force: any) => {
        if (!force?.drivers?.length) gaps.push(`Missing drivers for ${force?.name}`);
      });
    }
    if (toolType === 'value-chain') {
      if (!data.context?.industry) gaps.push('Missing industry');
      if (!data.context?.valueChainScope) gaps.push('Missing value chain scope');
      const scored = Object.values(data.activities || {}).filter(
        (a: any) => a?.drivers?.length || a?.implication
      );
      if (!scored.length) gaps.push('Missing scored value-chain activities');
      if (!accepted(data.levers).length) gaps.push('Missing margin levers');
      if (!accepted(data.recommendedMoves).length) gaps.push('Missing recommended moves');
      if (
        !data.summary?.executiveSummary ||
        ['ai-proposed', 'rethinking', 'rejected'].includes(data.summary?.proposalStatus)
      ) {
        gaps.push('Missing final source summary');
      }
      if (!accepted(data.outputCandidates).length) gaps.push('Missing output candidates');
    }
    if (toolType === 'capability-mapper') {
      if (!data.context?.industry) gaps.push('Missing industry');
      if (!data.context?.capabilityDomains) gaps.push('Missing capability domains');
      if (!accepted(data.capabilities).length) gaps.push('Missing scored capabilities');
      if (!accepted(data.gaps).length) gaps.push('Missing capability gaps');
      if (!accepted(data.recommendedMoves).length) gaps.push('Missing recommended moves');
      if (
        !data.summary?.executiveSummary ||
        ['ai-proposed', 'rethinking', 'rejected'].includes(data.summary?.proposalStatus)
      ) {
        gaps.push('Missing final source summary');
      }
      if (!accepted(data.outputCandidates).length) gaps.push('Missing output candidates');
    }
    if (toolType === 'ambition-decomposer') {
      if (!data.context?.ambitionStatement) gaps.push('Missing ambition statement');
      if (!accepted(data.themes).length) gaps.push('Missing strategic themes');
      if (!accepted(data.priorities).length) gaps.push('Missing priorities');
      if (!accepted(data.recommendedMoves).length) gaps.push('Missing recommended moves');
      if (
        !data.summary?.executiveSummary ||
        ['ai-proposed', 'rethinking', 'rejected'].includes(data.summary?.proposalStatus)
      ) {
        gaps.push('Missing final source summary');
      }
      if (!accepted(data.outputCandidates).length) gaps.push('Missing output candidates');
    }
    if (toolType === 'focus-tradeoff') {
      if (!data.context?.competingPriorities) gaps.push('Missing competing priorities');
      if (!accepted(data.priorities).length) gaps.push('Missing scored priorities');
      if (!accepted(data.tradeoffs).length) gaps.push('Missing trade-offs');
      if (!accepted(data.recommendedMoves).length) gaps.push('Missing recommended moves');
      if (
        !data.summary?.executiveSummary ||
        ['ai-proposed', 'rethinking', 'rejected'].includes(data.summary?.proposalStatus)
      ) {
        gaps.push('Missing final source summary');
      }
      if (!accepted(data.outputCandidates).length) gaps.push('Missing output candidates');
    }
    if (toolType === 'narrative-engine') {
      if (!data.context?.audience) gaps.push('Missing audience');
      if (!data.context?.coreMessage) gaps.push('Missing core message');
      if (!accepted(data.pillars).length) gaps.push('Missing narrative pillars');
      if (!accepted(data.threads).length) gaps.push('Missing storyline threads');
      if (!accepted(data.recommendedMoves).length) gaps.push('Missing recommended moves');
      if (
        !data.summary?.executiveSummary ||
        ['ai-proposed', 'rethinking', 'rejected'].includes(data.summary?.proposalStatus)
      ) {
        gaps.push('Missing final source summary');
      }
      if (!accepted(data.outputCandidates).length) gaps.push('Missing output candidates');
    }
    if (toolType === 'growth-paths') {
      if (!data.context?.goal || !data.context?.scope || !data.context?.successSignal) {
        gaps.push('Missing growth mission');
      }
      if (!data.signals?.length) gaps.push('Missing growth signals');
      const options = Object.values(data.quadrants || {}).flat();
      if (!accepted(options).length) gaps.push('Missing accepted growth options');
      if (!accepted(data.comparisons).length) gaps.push('Missing strategic comparison');
      if (!accepted(data.recommendedMoves).length) gaps.push('Missing recommended moves');
      if (
        !data.summary?.executiveSummary ||
        ['ai-proposed', 'rethinking', 'rejected'].includes(data.summary?.proposalStatus)
      ) {
        gaps.push('Missing final source summary');
      }
      if (!accepted(data.outputCandidates).length) gaps.push('Missing output candidates');
    }
    return gaps;
  }, [currentSession, toolType]);

  const completionReady = reviewGaps.length === 0;
  const currentStepDef = stepDefs[currentStep - 1];
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

  const confidenceAvg = useMemo(() => {
    if (!currentSession) return 1;
    if (completionReady) return 4;
    return Math.max(1, Math.min(5, Math.round(progress / 20)));
  }, [completionReady, currentSession, progress]);

  // Initialize or load local session
  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
    } else if (!currentSession || currentSession.toolType !== toolType) {
      createSession(toolType);
    }
  }, [sessionId, toolType, currentSession, loadSession, createSession]);

  // Load users for decision owner selection
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const fetchedUsers = await Api.getUsers();
        setUsers(fetchedUsers || []);
      } catch (err) {
        console.error('Failed to load users', err);
      }
    };
    loadUsers();
  }, []);

  // Create backend tool session on mount
  useEffect(() => {
    const ensureToolSession = async () => {
      if (toolSessionId || !currentSession) return;
      const name = `${toolMeta.name} - ${new Date().toLocaleDateString()}`;
      const created = await Api.createToolSession({
        toolType,
        name,
        projectId: currentProjectId || null,
      });
      setToolSessionId(created.id);
      setToolStatus(created.status as 'DRAFT');
      // createToolSession always starts a fresh session at version 1 (see
      // ToolController.createToolSession) -- known without a round-trip.
      sessionVersionRef.current = (created as { version?: number }).version ?? 1;
    };
    ensureToolSession();
  }, [toolSessionId, currentSession, toolType, currentProjectId]);

  // Sync backend tool session data
  useEffect(() => {
    const syncSession = async () => {
      if (!currentSession || !toolSessionId) return;
      const completionPercent = calculateProgress();
      const contextSnapshot = {
        org: currentOrganization || null,
        chat: activeChatMessages.slice(-50).map((m) => ({ role: m.role, content: m.content })),
        initiatives: recentInitiatives,
      };

      // CAS: if the version isn't known yet (create/GET still in flight),
      // skip this tick rather than sending expectedVersion: undefined and
      // drawing a guaranteed 428 -- the next debounce tick (state keeps
      // changing) or the create/load effect's own version write will
      // unblock it; nothing here is a single, unrepeatable action.
      if (sessionVersionRef.current === undefined) return;

      try {
        const result = await Api.updateToolSession(toolSessionId, {
          answers: currentSession.inputData as Record<string, unknown>,
          completionPercent: completionReady ? 100 : completionPercent,
          confidenceAvg,
          contextSnapshot,
          missingItems: missingItemsPayload,
          wizardState: wizardStatePayload,
          expectedVersion: sessionVersionRef.current,
        } as Parameters<typeof Api.updateToolSession>[1]);
        sessionVersionRef.current =
          (result as { version?: number })?.version ?? sessionVersionRef.current;
      } catch (err) {
        // A stale-version 409 (or any other autosave failure) must not
        // crash this loop with an unhandled rejection -- re-read the
        // server's current version so the NEXT debounce tick has a real
        // expectedVersion to retry with, instead of looping on the same
        // stale one forever.
        console.warn('[ToolWorkspace] autosave failed', err);
        try {
          const fresh = await Api.getToolSession(toolSessionId);
          sessionVersionRef.current = (fresh as { version?: number })?.version ?? sessionVersionRef.current;
        } catch {
          // Best-effort only -- next tick will retry the GET too.
        }
      }
    };
    const timeout = setTimeout(syncSession, 1500);
    return () => clearTimeout(timeout);
  }, [
    currentSession,
    toolSessionId,
    currentOrganization,
    activeChatMessages,
    calculateProgress,
    confidenceAvg,
    completionReady,
    missingItemsPayload,
    recentInitiatives,
    sessionId,
    toolStatus,
    toolType,
    currentStep,
    wizardStatePayload,
  ]);

  // Load generated initiatives when tool session exists
  useEffect(() => {
    const loadGenerated = async () => {
      if (!toolSessionId) return;
      const data = await Api.getToolSession(toolSessionId);
      setToolStatus((data.status || 'DRAFT').toUpperCase());
      setGeneratedInitiatives(data.generatedInitiatives || []);
      setToolDecisions(data.decisions || []);
      setToolPermissions(data.permissions || {});
      // CAS: this is the resume/reload path for a session that already
      // existed (sessionId prop) -- the create-effect's version write above
      // only covers a BRAND NEW session, so this GET is what populates
      // sessionVersionRef for a resumed one.
      sessionVersionRef.current = (data as { version?: number }).version ?? sessionVersionRef.current;
    };
    loadGenerated();
  }, [toolSessionId]);

  const refreshToolSession = async () => {
    if (!toolSessionId) return;
    const data = await Api.getToolSession(toolSessionId);
    setToolStatus((data.status || 'DRAFT').toUpperCase());
    setGeneratedInitiatives(data.generatedInitiatives || []);
    setToolDecisions(data.decisions || []);
    setToolPermissions(data.permissions || {});
    sessionVersionRef.current = (data as { version?: number }).version ?? sessionVersionRef.current;
  };

  useEffect(() => {
    const loadRecentInitiatives = async () => {
      try {
        const initiatives = await Api.getInitiatives(currentProjectId || undefined);
        const list = Array.isArray(initiatives)
          ? initiatives
          : (initiatives as { items?: any[] })?.items || [];
        setRecentInitiatives(
          list.slice(0, 5).map((item: any) => ({
            id: item.id,
            title: item.title || item.name || 'Untitled initiative',
            status: item.status,
          }))
        );
      } catch {
        setRecentInitiatives([]);
      }
    };
    loadRecentInitiatives();
  }, [currentProjectId]);

  // Auto-save on changes
  useEffect(() => {
    if (currentSession) {
      const saveTimeout = setTimeout(() => {
        saveSession();
      }, 2000);
      return () => clearTimeout(saveTimeout);
    }
    return undefined;
  }, [currentSession, saveSession]);

  // Handle step navigation
  const handleNextStep = () => {
    if (canAdvanceStep()) {
      nextStep();
    }
  };

  const handlePrevStep = () => {
    prevStep();
  };

  const handleOpenChat = () => {
    navigateWithChatContext(AppView.FULL_TRANSFORMATION_CHAT);
  };

  const handleOpenInitiatives = () => {
    if (onCreateInitiative) {
      onCreateInitiative();
      return;
    }
    setCurrentView(AppView.FULL_STEP2_INITIATIVES);
  };

  const handleRequestReview = async () => {
    if (!toolSessionId) return;
    if (!completionReady) {
      toast.error(t('discoveryToolsMain.toolWorkspace.dodNotSatisfied'));
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
      setToolStatus(result.status || 'REVIEW');
      toast.success(t('discoveryToolsMain.toolWorkspace.reviewRequested'));
      await refreshToolSession();
      setShowRequestReviewModal(false);
      // Reset form
      setReviewDecisionOwnerId('');
      setReviewDueDate('');
      setReviewPriority('medium');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to request review');
    }
  };

  const handleApprove = async () => {
    if (!toolSessionId) return;
    try {
      const result = await Api.approveTool(toolSessionId);
      setToolStatus(result.status || 'APPROVED');
      setShowGenerateModal(true);
      toast.success(t('discoveryToolsMain.toolWorkspace.toolApproved'));
      await refreshToolSession();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve tool');
    }
  };

  const handleSendBack = async (comment?: string) => {
    if (!toolSessionId) return;
    try {
      const result = await Api.sendToolBackToDraft(toolSessionId, comment);
      setToolStatus(result.status || 'DRAFT');
      toast.success(t('discoveryToolsMain.toolWorkspace.sentBackToDraft'));
      await refreshToolSession();
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
      toast.error(t('discoveryToolsMain.toolWorkspace.permissionDenied'));
      return;
    }
    try {
      setGenerationDefaults(payload);
      await Api.generateToolInitiatives(toolSessionId, payload);
      const updated = await Api.getToolGeneratedInitiatives(toolSessionId);
      setGeneratedInitiatives(updated.initiatives || []);
      await refreshToolSession();
      setShowGenerateModal(false);
      toast.success(t('discoveryToolsMain.toolWorkspace.generatedInitiatives'));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate initiatives');
    }
  };

  if (!currentSession) {
    return (
      <div className="p-6">
        <LoadingState template="panel" label={t('discoveryToolsMain.toolWorkspace.loadingTool')} />
      </div>
    );
  }

  const aiCardStatusCounts = countAiCardStatuses(currentSession.inputData);
  const aiReviewCount = getAiReviewTotal(aiCardStatusCounts);

  return (
    <div className="flex flex-col h-full bg-c-bg">
      {/* Tool Header */}
      <ToolHeader
        toolType={toolType}
        toolMeta={toolMeta}
        sessionName={currentSession.name}
        toolStatus={toolStatus}
        progress={progress}
        currentStep={currentStep}
        totalSteps={stepDefs.length}
        steps={stepDefs}
        completedSteps={currentSession.steps
          .filter((s) => s.status === 'completed')
          .map((s) => s.stepId)}
        onBack={onBack}
        onStepClick={setCurrentStep}
        onHelp={() => {
          setKnowledgeModuleIdOverride(toolType);
          setHelpTab('knowledge');
          setHelpOpen(true);
        }}
        onExport={() => console.log('Export clicked')}
        onCreateInitiative={onCreateInitiative}
        onRequestReview={handleRequestReview}
        canRequestReview={completionReady && toolPermissions.canRequestReview !== false}
        isPolish={isPolish}
      />

      {/* Tool Canvas */}
      <div className="flex-1 overflow-hidden">
        {toolStatus === 'REVIEW' ? (
          <ToolReviewPanel
            toolType={toolType}
            session={currentSession}
            gaps={reviewGaps}
            isPolish={isPolish}
            onApprove={handleApprove}
            onSendBack={handleSendBack}
            onConfigureGenerate={() => setShowGenerateModal(true)}
            generationDefaults={generationDefaults}
            decisions={toolDecisions}
            canApprove={toolPermissions.canApproveTool !== false}
            canGenerate={toolPermissions.canGenerate !== false}
          />
        ) : (
          <ToolCanvas
            {...({
              toolType,
              currentStep,
              stepDefinition: stepDefs[currentStep - 1],
              session: currentSession,
              isStreaming,
              streamedContent,
              isPolish,
              orgName: currentOrganization?.name,
              onOpenChat: handleOpenChat,
              onOpenInitiatives: handleOpenInitiatives,
              generatedInitiatives,
              recentInitiatives,
              chatSnippets: activeChatMessages.slice(-3).map((m) => ({
                role: m.role,
                content: m.content,
              })),
              onGenerateFullSession: generateFullSession,
              missionSuggestion,
              onApplyMissionSuggestion: applyMissionSuggestion,
              onDismissMissionSuggestion: dismissMissionSuggestion,
              sessionGenerationStatus: currentSession.sessionGenerationStatus,
              onAcceptCard: (cardType: ProposalCardType, cardId: string) =>
                acceptCard(cardType, cardId),
              onRejectCard: (cardType: ProposalCardType, cardId: string) =>
                rejectCard(cardType, cardId),
              onRethinkCard: (cardType: ProposalCardType, cardId: string, comment?: string) => {
                const phaseId = stepDefs[currentStep - 1]?.id || 'mission';
                rethinkCard(phaseId, cardType, cardId, comment);
              },
            } as any)}
          />
        )}
      </div>

      {/* Outputs — approved snapshot(s) promoted from this session, their
          Reports/Presentations and Initiative proposals, plus reopen for
          correction. Only meaningful once the session has been approved
          (promoteToOutput's own eligibility gate — server/src/controllers/
          ToolController.ts). Read-only surface: server/src/routes/
          toolOutputs.routes.ts. */}
      {toolStatus === 'APPROVED' && toolSessionId && (
        <div className="border-t border-c-border-subtle bg-c-bg px-6 py-4">
          <ToolOutputsPanel toolSessionId={toolSessionId} />
        </div>
      )}

      {/* Action Bar */}
      {toolStatus !== 'REVIEW' && (
        <ToolActionBar
          {...({
            currentStep,
            totalSteps: stepDefs.length,
            canAdvance: canAdvanceStep(),
            onPrevStep: handlePrevStep,
            onNextStep: handleNextStep,
            isPolish,
            phaseAiActions,
            activeAiActionId,
            isStreaming,
            onRunPhaseAiAction: (actionId: any) => void runPhaseAiAction(actionId),
            onAbortAi: abortStream,
            aiReviewCount,
            onReviewAiCards: scrollToAiCards,
          } as any)}
        />
      )}

      {showGenerateModal && (
        <GenerateInitiativesModal
          isPolish={isPolish}
          defaults={generationDefaults}
          onClose={() => setShowGenerateModal(false)}
          onGenerate={handleGenerate}
        />
      )}

      {showRequestReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-c-surface rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
            <div className="p-6 border-b border-c-border-subtle">
              <h3 className="text-lg font-semibold text-c-text">
                {t('discoveryToolsMain.toolWorkspace.requestReviewTitle')}
              </h3>
              <p className="text-sm text-c-text-muted mt-1">
                {t('discoveryToolsMain.toolWorkspace.requestReviewSubtitle')}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm text-c-text-secondary">
                {reviewGaps.length === 0
                  ? t('discoveryToolsMain.toolWorkspace.noDodGaps')
                  : `${t('discoveryToolsMain.toolWorkspace.gapsLabel')}: ${reviewGaps.join(', ')}`}
              </div>
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-1">
                  {t('discoveryToolsMain.toolWorkspace.decisionOwner')}{' '}
                  {t('discoveryToolsMain.toolWorkspace.optional')}
                </label>
                <select
                  value={reviewDecisionOwnerId}
                  onChange={(e) => setReviewDecisionOwnerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid"
                >
                  <option value="">
                    {t('discoveryToolsMain.toolWorkspace.selectPlaceholder')}
                  </option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.email || user.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-1">
                  {t('discoveryToolsMain.toolWorkspace.dueDate')}
                </label>
                <input
                  type="date"
                  value={reviewDueDate}
                  onChange={(e) => setReviewDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-1">
                  {t('discoveryToolsMain.toolWorkspace.priority')}
                </label>
                <select
                  value={reviewPriority}
                  onChange={(e) =>
                    setReviewPriority(e.target.value as 'low' | 'medium' | 'high' | 'critical')
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid"
                >
                  <option value="low">{t('discoveryToolsMain.toolWorkspace.priorityLow')}</option>
                  <option value="medium">
                    {t('discoveryToolsMain.toolWorkspace.priorityMedium')}
                  </option>
                  <option value="high">{t('discoveryToolsMain.toolWorkspace.priorityHigh')}</option>
                  <option value="critical">
                    {t('discoveryToolsMain.toolWorkspace.priorityCritical')}
                  </option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-c-border-subtle flex justify-end gap-3">
              <button
                onClick={() => setShowRequestReviewModal(false)}
                className="px-4 py-2 text-c-text-secondary hover:bg-c-surface-raised rounded-lg"
              >
                {t('discoveryToolsMain.toolWorkspace.cancel')}
              </button>
              <button
                onClick={handleConfirmRequestReview}
                className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium"
              >
                {t('discoveryToolsMain.toolWorkspace.sendToReview')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ToolWorkspace;
