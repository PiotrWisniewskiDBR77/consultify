/**
 * ToolWorkspace - Main container for strategic tool interface
 *
 * Orchestrates the tool header, canvas, and action bar.
 * Manages session state and AI interactions.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
  const { currentOrganization, activeChatMessages, navigateWithChatContext, setCurrentView } =
    useAppStore();
  const [toolSessionId, setToolSessionId] = useState<string | null>(sessionId || null);
  const [toolStatus, setToolStatus] = useState<'DRAFT' | 'REVIEW' | 'APPROVED'>('DRAFT');
  const [generatedInitiatives, setGeneratedInitiatives] = useState<
    { id: string; title: string; status?: string }[]
  >([]);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
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
      const created = await Api.createToolSession({ toolType, name });
      setToolSessionId(created.id);
      setToolStatus(created.status as 'DRAFT');
    };
    ensureToolSession();
  }, [toolSessionId, currentSession, toolType]);

  // Sync backend tool session data
  useEffect(() => {
    const syncSession = async () => {
      if (!currentSession || !toolSessionId) return;
      const completionPercent = calculateProgress();
      const contextSnapshot = {
        org: currentOrganization || null,
        chat: activeChatMessages.slice(-30).map((m) => ({ role: m.role, content: m.content })),
      };

      await Api.updateToolSession(toolSessionId, {
        answers: currentSession.inputData,
        completionPercent,
        confidenceAvg: Math.min(5, Math.max(1, Math.round(completionPercent / 20))),
        contextSnapshot,
      });
    };
    const timeout = setTimeout(syncSession, 1500);
    return () => clearTimeout(timeout);
  }, [currentSession, toolSessionId, currentOrganization, activeChatMessages, calculateProgress]);

  // Load generated initiatives when tool session exists
  useEffect(() => {
    const loadGenerated = async () => {
      if (!toolSessionId) return;
      const data = await Api.getToolSession(toolSessionId);
      setToolStatus((data.status || 'DRAFT').toUpperCase());
      setGeneratedInitiatives(data.generatedInitiatives || []);
    };
    loadGenerated();
  }, [toolSessionId]);

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

  const toolMeta = TOOL_METADATA[toolType];
  const stepDefs = getStepDefinitions();
  const progress = calculateProgress();

  const completionReady = progress >= 100;

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
    setCurrentView(AppView.FULL_STEP2_INITIATIVES);
  };

  const handleRequestReview = async () => {
    if (!toolSessionId) return;
    const result = await Api.requestToolReview(toolSessionId);
    setToolStatus(result.status || 'REVIEW');
  };

  const handleApprove = async () => {
    if (!toolSessionId) return;
    const result = await Api.approveTool(toolSessionId);
    setToolStatus(result.status || 'APPROVED');
    setShowGenerateModal(true);
  };

  const handleSendBack = async () => {
    if (!toolSessionId) return;
    const result = await Api.sendToolBackToDraft(toolSessionId);
    setToolStatus(result.status || 'DRAFT');
  };

  const handleGenerate = async (payload: {
    methodologyId: string;
    count: number;
    includeChatContext: boolean;
  }) => {
    if (!toolSessionId) return;
    setGenerationDefaults(payload);
    await Api.generateToolInitiatives(toolSessionId, payload);
    const updated = await Api.getToolGeneratedInitiatives(toolSessionId);
    setGeneratedInitiatives(updated.initiatives || []);
    setShowGenerateModal(false);
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
        canRequestReview={completionReady}
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
    </div>
  );
};

export default ToolWorkspace;
