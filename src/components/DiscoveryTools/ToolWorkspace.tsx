/**
 * ToolWorkspace - Main container for strategic tool interface
 *
 * Orchestrates the tool header, canvas, and action bar.
 * Manages session state and AI interactions.
 */

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useToolAI } from '@/hooks/discovery/useToolAI';
import { ToolType, useToolStore } from '@/store/useToolStore';

import { ToolActionBar } from './ToolActionBar';
import { ToolCanvas } from './ToolCanvas';
import { ToolHeader } from './ToolHeader';

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
    sendMessage,
    requestSuggestions,
    generateCorrelations,
    generateSummary,
    abortStream,
    getStepOpeningQuestion,
  } = useToolAI({ toolType });

  // Initialize or load session
  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
    } else if (!currentSession || currentSession.toolType !== toolType) {
      createSession(toolType);
    }
  }, [sessionId, toolType, currentSession, loadSession, createSession]);

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

  // Handle chat message
  const handleSendMessage = async (message: string) => {
    await sendMessage(message);
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
        isPolish={isPolish}
      />

      {/* Tool Canvas */}
      <div className="flex-1 overflow-hidden">
        <ToolCanvas
          toolType={toolType}
          currentStep={currentStep}
          stepDefinition={stepDefs[currentStep - 1]}
          session={currentSession}
          isStreaming={isStreaming}
          streamedContent={streamedContent}
          onSendMessage={handleSendMessage}
          onRequestSuggestions={handleRequestSuggestions}
          isPolish={isPolish}
        />
      </div>

      {/* Action Bar */}
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
    </div>
  );
};

export default ToolWorkspace;
