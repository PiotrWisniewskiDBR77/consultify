/**
 * ToolCanvas - Main content area for strategic tools
 *
 * Renders step-specific content and inline assist panel.
 */

import React from 'react';

import type { ConsultingMissionContext } from '@/config/consultingToolsStandard';
import {
  ProposalCardType,
  SessionGenerationStatus,
  StepDefinition,
  ToolSession,
  ToolType,
} from '@/store/useToolStore';

import { ToolPhaseAiActions } from './shared/ToolPhaseAiActions';
import { ContextStep } from './steps/ContextStep';
import { ImpactHypothesisStep } from './steps/ImpactHypothesisStep';
import { InitiativesStep } from './steps/InitiativesStep';
import { PrepareStep } from './steps/PrepareStep';
import { ProcessAutomationEconomicsStep } from './steps/ProcessAutomationEconomicsStep';
import { ProcessAutomationMeasurementStep } from './steps/ProcessAutomationMeasurementStep';
import { ReasoningStep } from './steps/ReasoningStep';
import { ReportStep } from './steps/ReportStep';
import { ResultsStep } from './steps/ResultsStep';
import { SummaryStep } from './steps/SummaryStep';
import type { ToolPhaseAiActionDefinition, ToolPhaseAiActionId } from './toolAiActions';
import { ToolContextPanel } from './ToolContextPanel';
import { SWOTBuildPhase } from './tools/DynamicSWOT/SWOTBuildPhase';
import { SWOTInputExplorationPhase } from './tools/DynamicSWOT/SWOTInputExplorationPhase';
import { SWOTInsightsPhase } from './tools/DynamicSWOT/SWOTInsightsPhase';
import { GrowthPathQuadrantStep } from './tools/GrowthPaths/GrowthPathQuadrantStep';
import { ForceStep } from './tools/MarketForces/ForceStep';
import {
  A3CountermeasuresStep,
  A3ProblemStep,
  A3RootCauseStep,
  DMSEscalationStep,
  DMSKPIsStep,
  InventoryClassificationStep,
  InventoryReplenishmentStep,
  OperationalSectionStep,
  SMEDImprovementsStep,
  SMEDStepsStep,
  SOPChecklistsStep,
  SOPStandardsStep,
} from './tools/Operational';
import { PortfolioItemsStep } from './tools/PortfolioPriority/PortfolioItemsStep';
import { PortfolioMatrixStep } from './tools/PortfolioPriority/PortfolioMatrixStep';
import { AssumptionsStep } from './tools/RiskUncertainty/AssumptionsStep';
import { RisksStep } from './tools/RiskUncertainty/RisksStep';
import { ScenariosStep } from './tools/RiskUncertainty/ScenariosStep';

// ==================== TYPES ====================

interface ToolCanvasProps {
  toolType: ToolType;
  currentStep: number;
  stepDefinition?: StepDefinition;
  session: ToolSession;
  isStreaming: boolean;
  streamedContent: string;
  isPolish: boolean;
  orgName?: string | null;
  onOpenChat: () => void;
  onOpenInitiatives?: () => void;
  generatedInitiatives?: { id: string; title: string; status?: string }[];
  recentInitiatives?: { id: string; title: string; status?: string }[];
  chatSnippets?: { role: string; content: string }[];
  showContextPanel?: boolean;
  onGenerateFullSession?: () => void;
  phaseAiActions?: ToolPhaseAiActionDefinition[];
  activeAiActionId?: ToolPhaseAiActionId | null;
  onRunPhaseAiAction?: (actionId: ToolPhaseAiActionId) => void;
  onAbortAi?: () => void;
  missionSuggestion?: Partial<ConsultingMissionContext> | null;
  onApplyMissionSuggestion?: () => void;
  onDismissMissionSuggestion?: () => void;
  isGeneratingAI?: boolean;
  sessionGenerationStatus?: SessionGenerationStatus;
  onAcceptCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRejectCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRethinkCard?: (cardType: ProposalCardType, cardId: string, comment?: string) => void;
}

// ==================== COMPONENT ====================

export const ToolCanvas: React.FC<ToolCanvasProps> = ({
  toolType,
  currentStep: _currentStep,
  stepDefinition,
  session,
  isStreaming,
  streamedContent,
  isPolish,
  orgName,
  onOpenChat,
  onOpenInitiatives,
  generatedInitiatives,
  recentInitiatives,
  chatSnippets,
  showContextPanel = true,
  onGenerateFullSession,
  phaseAiActions = [],
  activeAiActionId = null,
  onRunPhaseAiAction,
  onAbortAi,
  missionSuggestion,
  onApplyMissionSuggestion,
  onDismissMissionSuggestion,
  isGeneratingAI,
  sessionGenerationStatus,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}) => {
  const isDynamicSwotSessionPhase =
    toolType === 'dynamic-swot' &&
    ['mission', 'input', 'swot', 'insights', 'outputs'].includes(stepDefinition?.id || '');
  const shouldShowContextPanel = showContextPanel && !isDynamicSwotSessionPhase;

  // Render step-specific content
  const renderStepContent = () => {
    if (!stepDefinition) {
      return (
        <div className="flex items-center justify-center h-full text-slate-400">
          Loading step...
        </div>
      );
    }

    if (toolType === 'dynamic-swot') {
      if (stepDefinition.id === 'mission') {
        return (
          <ContextStep
            toolType={toolType}
            session={session}
            isPolish={isPolish}
            onGenerateFullSession={onGenerateFullSession}
            sessionGenerationStatus={sessionGenerationStatus}
            missionSuggestion={missionSuggestion}
            onApplyMissionSuggestion={onApplyMissionSuggestion}
            onDismissMissionSuggestion={onDismissMissionSuggestion}
          />
        );
      }

      if (stepDefinition.id === 'input') {
        return (
          <SWOTInputExplorationPhase
            session={session}
            isPolish={isPolish}
            onAcceptCard={onAcceptCard}
            onRejectCard={onRejectCard}
            onRethinkCard={onRethinkCard}
          />
        );
      }

      if (stepDefinition.id === 'swot') {
        return (
          <SWOTBuildPhase
            session={session}
            isPolish={isPolish}
            isGeneratingAI={isGeneratingAI || isStreaming}
            onAcceptCard={onAcceptCard}
            onRejectCard={onRejectCard}
            onRethinkCard={onRethinkCard}
          />
        );
      }

      if (stepDefinition.id === 'insights') {
        return (
          <SWOTInsightsPhase
            session={session}
            isPolish={isPolish}
            onAcceptCard={onAcceptCard}
            onRejectCard={onRejectCard}
            onRethinkCard={onRethinkCard}
          />
        );
      }

      if (stepDefinition.id === 'outputs') {
        return (
          <div className="space-y-6">
            <SummaryStep
              toolType={toolType}
              session={session}
              isPolish={isPolish}
              onAcceptCard={onAcceptCard}
              onRejectCard={onRejectCard}
              onRethinkCard={onRethinkCard}
            />
            <InitiativesStep
              toolType={toolType}
              session={session}
              isPolish={isPolish}
              generatedInitiatives={generatedInitiatives}
              onOpenInitiatives={onOpenInitiatives}
              onOpenChat={onOpenChat}
            />
          </div>
        );
      }
    }

    // Context step (first step for all tools)
    if (stepDefinition.id === 'context') {
      return <ContextStep toolType={toolType} session={session} isPolish={isPolish} />;
    }

    // Summary step (last step for all tools)
    if (stepDefinition.id === 'summary') {
      return (
        <div className="space-y-6">
          <SummaryStep toolType={toolType} session={session} isPolish={isPolish} />
          <InitiativesStep
            toolType={toolType}
            session={session}
            isPolish={isPolish}
            generatedInitiatives={generatedInitiatives}
            onOpenInitiatives={onOpenInitiatives}
            onOpenChat={onOpenChat}
          />
        </div>
      );
    }

    if (stepDefinition.id === 'impact-hypothesis') {
      return <ImpactHypothesisStep session={session} isPolish={isPolish} />;
    }

    if (stepDefinition.id === 'results') {
      return <ResultsStep session={session} isPolish={isPolish} />;
    }

    if (stepDefinition.id === 'reasoning') {
      return <ReasoningStep session={session} isPolish={isPolish} />;
    }

    if (stepDefinition.id === 'prepare') {
      return <PrepareStep session={session} isPolish={isPolish} />;
    }

    if (stepDefinition.id === 'initiatives') {
      return (
        <InitiativesStep
          toolType={toolType}
          session={session}
          isPolish={isPolish}
          generatedInitiatives={generatedInitiatives}
          onOpenInitiatives={onOpenInitiatives}
          onOpenChat={onOpenChat}
        />
      );
    }

    if (stepDefinition.id === 'report') {
      return <ReportStep toolType={toolType} session={session} isPolish={isPolish} />;
    }

    if (toolType === 'process-automation') {
      if (stepDefinition.id === 'measurement') {
        return (
          <ProcessAutomationMeasurementStep
            session={session}
            isPolish={isPolish}
            mode="measurement"
          />
        );
      }
      if (stepDefinition.id === 're-estimation') {
        return (
          <ProcessAutomationMeasurementStep
            session={session}
            isPolish={isPolish}
            mode="re-estimation"
          />
        );
      }
      if (stepDefinition.id === 'economics') {
        return <ProcessAutomationEconomicsStep session={session} isPolish={isPolish} />;
      }
    }

    if (toolType === 'market-forces') {
      // Porter force steps
      if (
        ['rivalry', 'newEntrants', 'substitutes', 'buyerPower', 'supplierPower'].includes(
          stepDefinition.id
        )
      ) {
        return (
          <ForceStep
            forceId={
              stepDefinition.id as
                | 'rivalry'
                | 'newEntrants'
                | 'substitutes'
                | 'buyerPower'
                | 'supplierPower'
            }
            session={session}
            isPolish={isPolish}
          />
        );
      }
    }

    if (toolType === 'growth-paths') {
      if (
        [
          'market-penetration',
          'market-development',
          'product-development',
          'diversification',
        ].includes(stepDefinition.id)
      ) {
        return (
          <GrowthPathQuadrantStep
            quadrant={
              stepDefinition.id as
                | 'market-penetration'
                | 'market-development'
                | 'product-development'
                | 'diversification'
            }
            session={session}
            isPolish={isPolish}
          />
        );
      }
    }

    if (toolType === 'portfolio-priority') {
      if (stepDefinition.id === 'portfolio-items') {
        return <PortfolioItemsStep session={session} isPolish={isPolish} />;
      }
      if (stepDefinition.id === 'portfolio-matrix') {
        return <PortfolioMatrixStep session={session} isPolish={isPolish} />;
      }
    }

    if (toolType === 'risk-uncertainty') {
      if (stepDefinition.id === 'assumptions') {
        return <AssumptionsStep session={session} isPolish={isPolish} />;
      }
      if (stepDefinition.id === 'risks') {
        return <RisksStep session={session} isPolish={isPolish} />;
      }
      if (stepDefinition.id === 'scenarios') {
        return <ScenariosStep session={session} isPolish={isPolish} />;
      }
    }

    if (toolType === 'sop-builder') {
      if (stepDefinition.id === 'standards') {
        return <SOPStandardsStep session={session} isPolish={isPolish} />;
      }
      if (stepDefinition.id === 'checklists') {
        return <SOPChecklistsStep session={session} isPolish={isPolish} />;
      }
    }

    if (toolType === 'a3-problem-solving') {
      if (stepDefinition.id === 'problem') {
        return <A3ProblemStep session={session} isPolish={isPolish} />;
      }
      if (stepDefinition.id === 'root-cause') {
        return <A3RootCauseStep session={session} isPolish={isPolish} />;
      }
      if (stepDefinition.id === 'countermeasures') {
        return <A3CountermeasuresStep session={session} isPolish={isPolish} />;
      }
    }

    if (toolType === 'smed-planner') {
      if (stepDefinition.id === 'changeover-steps') {
        return <SMEDStepsStep session={session} isPolish={isPolish} />;
      }
      if (stepDefinition.id === 'improvements') {
        return <SMEDImprovementsStep session={session} isPolish={isPolish} />;
      }
    }

    if (toolType === 'dms-builder') {
      if (stepDefinition.id === 'kpis') {
        return <DMSKPIsStep session={session} isPolish={isPolish} />;
      }
      if (stepDefinition.id === 'escalation') {
        return <DMSEscalationStep session={session} isPolish={isPolish} />;
      }
    }

    if (toolType === 'inventory-autopilot') {
      if (stepDefinition.id === 'sku-classification') {
        return <InventoryClassificationStep session={session} isPolish={isPolish} />;
      }
      if (stepDefinition.id === 'replenishment') {
        return <InventoryReplenishmentStep session={session} isPolish={isPolish} />;
      }
    }

    if (
      [
        'sop-builder',
        'a3-problem-solving',
        'smed-planner',
        'dms-builder',
        'inventory-autopilot',
        'vsm-builder',
        'constraint-control',
        'decision-engine',
        'control-tower',
        'automation-pipeline',
        'robotics-feasibility',
        'logistics-automation',
        'rpa-scanner',
        'ai-discovery',
        'integration-diagnostic',
        'digital-value-pool',
        'legacy-analyzer',
        'data-inventory',
        'pain-to-solution',
        'pain-explorer',
        'process-automation',
      ].includes(toolType)
    ) {
      if (
        stepDefinition.id !== 'context' &&
        stepDefinition.id !== 'summary' &&
        ![
          'impact-hypothesis',
          'results',
          'reasoning',
          'prepare',
          'initiatives',
          'report',
          'measurement',
          're-estimation',
          'economics',
        ].includes(stepDefinition.id)
      ) {
        return (
          <OperationalSectionStep
            sectionId={stepDefinition.id}
            title={isPolish ? stepDefinition.namePl : stepDefinition.name}
            description={isPolish ? stepDefinition.descriptionPl : stepDefinition.description}
            session={session}
            isPolish={isPolish}
          />
        );
      }
    }

    // Default fallback
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        Step content not implemented yet.
      </div>
    );
  };

  return (
    <div className="flex h-full">
      {/* Main content area */}
      <div className="flex-1 overflow-y-auto p-6">
        {(phaseAiActions.length > 0 || isStreaming) && (
          <div className="mb-4 flex justify-end">
            <ToolPhaseAiActions
              actions={phaseAiActions}
              activeActionId={activeAiActionId}
              isStreaming={isStreaming}
              isPolish={isPolish}
              onRunAction={(actionId) => onRunPhaseAiAction?.(actionId)}
              onAbort={onAbortAi}
            />
          </div>
        )}
        {renderStepContent()}
      </div>

      {shouldShowContextPanel && (
        <ToolContextPanel
          toolType={toolType}
          session={session}
          currentStepId={stepDefinition?.id}
          isPolish={isPolish}
          orgName={orgName}
          aiContent={isStreaming ? streamedContent : undefined}
          onOpenChat={onOpenChat}
          onGenerateFullSession={onGenerateFullSession}
          onOpenInitiatives={onOpenInitiatives}
          generatedInitiatives={generatedInitiatives}
          recentInitiatives={recentInitiatives}
          chatSnippets={chatSnippets}
        />
      )}
    </div>
  );
};

export default ToolCanvas;
