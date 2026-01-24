/**
 * ToolWorkspace - Main container for strategic tool interface
 *
 * Orchestrates the tool header, canvas, and action bar.
 * Manages session state and AI interactions.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';

import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { useToolAI } from '@/hooks/discovery/useToolAI';
import { ToolType, useToolStore } from '@/store/useToolStore';
import { AppView } from '@/types';

import { ToolActionBar } from './ToolActionBar';
import { ToolCanvas } from './ToolCanvas';
import { ToolHeader } from './ToolHeader';
import { ToolReviewPanel } from './ToolReviewPanel';
import { GenerateInitiativesModal } from './GenerateInitiativesModal';

// ==================== TYPES ====================

interface ToolWorkspaceProps {
  toolType: ToolType;
  sessionId?: string;
  onBack: () => void;
  onCreateInitiative?: () => void;
}

// ==================== TOOL METADATA ====================

const TOOL_METADATA: Record<
  ToolType,
  {
    name: string;
    namePl: string;
    color: string;
    badge: string;
  }
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

export const ToolWorkspace: React.FC<ToolWorkspaceProps> = ({
  toolType,
  sessionId,
  onBack,
  onCreateInitiative,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const {
    currentOrganization,
    activeChatMessages,
    navigateWithChatContext,
    setCurrentView,
    currentProjectId,
  } = useAppStore();
  const [toolSessionId, setToolSessionId] = useState<string | null>(sessionId || null);
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
  } = useToolStore();

  // AI integration
  const {
    isStreaming,
    streamedContent,
    requestSuggestions,
    generateCorrelations,
    generateSummary,
    abortStream,
  } = useToolAI({ toolType });

  const toolMeta = TOOL_METADATA[toolType];
  const stepDefs = getStepDefinitions();
  const progress = calculateProgress();

  const reviewGaps = useMemo(() => {
    if (!currentSession) return [];
    const gaps: string[] = [];
    const data = currentSession.inputData as any;
    if (toolType === 'dynamic-swot') {
      if (!data.context?.goal || !data.context?.scope) gaps.push('Missing strategic context');
      ['strengths', 'weaknesses', 'opportunities', 'threats'].forEach((q) => {
        if (!data.items?.some((i: any) => i.quadrant === q)) {
          gaps.push(`Missing ${q}`);
        }
      });
      if (!data.correlations?.length) gaps.push('Missing correlations');
    }
    if (toolType === 'market-forces') {
      if (!data.context?.industry) gaps.push('Missing industry');
      if (!data.context?.geographicScope) gaps.push('Missing geographic scope');
      Object.values(data.forces || {}).forEach((force: any) => {
        if (!force?.drivers?.length) gaps.push(`Missing drivers for ${force?.name}`);
      });
    }
    return gaps;
  }, [currentSession, toolType]);

  const completionReady = reviewGaps.length === 0;

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

      await Api.updateToolSession(toolSessionId, {
        answers: currentSession.inputData as Record<string, unknown>,
        completionPercent: completionReady ? 100 : completionPercent,
        confidenceAvg,
        contextSnapshot,
      });
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
    recentInitiatives,
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

  // Handle AI actions
  const handleRequestSuggestions = async () => {
    await requestSuggestions();
  };

  const handleGenerateAnalysis = async () => {
    const currentStepDef = stepDefs[currentStep - 1];
    if (currentStepDef?.id === 'correlations') {
      await generateCorrelations();
    } else if (currentStepDef?.id === 'summary') {
      await generateSummary();
    }
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
      toast.error(isPolish ? 'Brak wymagan DoD' : 'DoD not satisfied');
      return;
    }
    setShowRequestReviewModal(true);
  };

  const handleConfirmRequestReview = async () => {
    if (!toolSessionId) return;
    try {
      const result = await Api.requestToolReview(toolSessionId, {
        dueDate: reviewDueDate || undefined,
        priority: reviewPriority,
      });
      setToolStatus(result.status || 'REVIEW');
      toast.success(isPolish ? 'Review requested' : 'Review requested');
      await refreshToolSession();
      setShowRequestReviewModal(false);
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
      toast.success(isPolish ? 'Tool approved' : 'Tool approved');
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
      toast.success(isPolish ? 'Sent back to draft' : 'Sent back to draft');
      await refreshToolSession();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send back');
    }
  };

  const handleGenerate = async (payload: {
    methodologyId: string;
    count: number;
    includeChatContext: boolean;
  }) => {
    if (!toolSessionId) return;
    if (toolPermissions.canGenerate === false) {
      toast.error(isPolish ? 'Brak uprawnien' : 'Permission denied');
      return;
    }
    try {
      setGenerationDefaults(payload);
      await Api.generateToolInitiatives(toolSessionId, payload);
      const updated = await Api.getToolGeneratedInitiatives(toolSessionId);
      setGeneratedInitiatives(updated.initiatives || []);
      await refreshToolSession();
      setShowGenerateModal(false);
      toast.success(isPolish ? 'Generated initiatives' : 'Generated initiatives');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate initiatives');
    }
  };

  if (!currentSession) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950">
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
        onHelp={() => console.log('Help clicked')}
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
            toolType={toolType}
            currentStep={currentStep}
            stepDefinition={stepDefs[currentStep - 1]}
            session={currentSession}
            isStreaming={isStreaming}
            streamedContent={streamedContent}
            isPolish={isPolish}
            orgName={currentOrganization?.name}
            onOpenChat={handleOpenChat}
            onOpenInitiatives={handleOpenInitiatives}
            generatedInitiatives={generatedInitiatives}
            recentInitiatives={recentInitiatives}
            chatSnippets={activeChatMessages.slice(-3).map((m) => ({
              role: m.role,
              content: m.content,
            }))}
          />
        )}
      </div>

      {/* Action Bar */}
      {toolStatus !== 'REVIEW' && (
        <ToolActionBar
          currentStep={currentStep}
          totalSteps={stepDefs.length}
          canAdvance={canAdvanceStep()}
          isStreaming={isStreaming}
          stepDefinition={stepDefs[currentStep - 1]}
          onPrevStep={handlePrevStep}
          onNextStep={handleNextStep}
          onRequestSuggestions={handleRequestSuggestions}
          onGenerateAnalysis={handleGenerateAnalysis}
          onAbort={abortStream}
          isPolish={isPolish}
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
          <div className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-navy-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {isPolish ? 'Request review' : 'Request review'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {isPolish
                  ? 'Sprawdz kompletność i potwierdz wysłanie do review.'
                  : 'Check completeness and confirm sending to review.'}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {reviewGaps.length === 0
                  ? isPolish
                    ? 'Brak braków w DoD.'
                    : 'No DoD gaps.'
                  : `${isPolish ? 'Braki' : 'Gaps'}: ${reviewGaps.join(', ')}`}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {isPolish ? 'Due date' : 'Due date'}
                </label>
                <input
                  type="date"
                  value={reviewDueDate}
                  onChange={(e) => setReviewDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {isPolish ? 'Priorytet' : 'Priority'}
                </label>
                <select
                  value={reviewPriority}
                  onChange={(e) =>
                    setReviewPriority(e.target.value as 'low' | 'medium' | 'high' | 'critical')
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
                >
                  <option value="low">{isPolish ? 'Niski' : 'Low'}</option>
                  <option value="medium">{isPolish ? 'Sredni' : 'Medium'}</option>
                  <option value="high">{isPolish ? 'Wysoki' : 'High'}</option>
                  <option value="critical">{isPolish ? 'Krytyczny' : 'Critical'}</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 dark:border-navy-700 flex justify-end gap-3">
              <button
                onClick={() => setShowRequestReviewModal(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg"
              >
                {isPolish ? 'Anuluj' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmRequestReview}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-medium"
              >
                {isPolish ? 'Wyślij do review' : 'Send to review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ToolWorkspace;
