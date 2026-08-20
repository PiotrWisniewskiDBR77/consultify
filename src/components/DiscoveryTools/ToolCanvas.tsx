/**
 * ToolCanvas - Main content area for strategic tools
 *
 * Renders step-specific content and inline assist panel.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ConsultingMissionContext } from '@/config/consultingToolsStandard';
import {
  ProposalCardType,
  SessionGenerationStatus,
  StepDefinition,
  ToolSession,
  ToolType,
} from '@/store/useToolStore';

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
import {
  AmbitionDecomposerBuildPhase,
  AmbitionDecomposerInputPhase,
  AmbitionDecomposerInsightsPhase,
  AmbitionDecomposerOutputsPhase,
} from './tools/AmbitionDecomposer';
import {
  CapabilityMapperBuildPhase,
  CapabilityMapperInputPhase,
  CapabilityMapperInsightsPhase,
  CapabilityMapperOutputsPhase,
} from './tools/CapabilityMapper';
import { GenericDomainStep } from './tools/Digital';
import { SWOTBuildPhase } from './tools/DynamicSWOT/SWOTBuildPhase';
import { SWOTInputExplorationPhase } from './tools/DynamicSWOT/SWOTInputExplorationPhase';
import { SWOTInsightsPhase } from './tools/DynamicSWOT/SWOTInsightsPhase';
import {
  FocusTradeoffBuildPhase,
  FocusTradeoffInputPhase,
  FocusTradeoffInsightsPhase,
  FocusTradeoffOutputsPhase,
} from './tools/FocusTradeoff';
import {
  GrowthPathsInputPhase,
  GrowthPathsInsightsPhase,
  GrowthPathsOptionsPhase,
  GrowthPathsOutputsPhase,
} from './tools/GrowthPaths/GrowthPathsPhases';
import {
  MarketForcesBuildPhase,
  MarketForcesInputPhase,
  MarketForcesInsightsPhase,
  MarketForcesOutputsPhase,
} from './tools/MarketForces/MarketForcesPhases';
import {
  NarrativeEngineBuildPhase,
  NarrativeEngineInputPhase,
  NarrativeEngineInsightsPhase,
  NarrativeEngineOutputsPhase,
} from './tools/NarrativeEngine';
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
import {
  PortfolioInputPhase,
  PortfolioInsightsPhase,
  PortfolioItemsPhase,
  PortfolioOutputsPhase,
} from './tools/PortfolioPriority/PortfolioPriorityPhases';
import {
  RiskInputPhase,
  RiskInsightsPhase,
  RiskMapPhase,
  RiskOutputsPhase,
} from './tools/RiskUncertainty/RiskUncertaintyPhases';
import {
  ValueChainBuildPhase,
  ValueChainInputPhase,
  ValueChainInsightsPhase,
  ValueChainOutputsPhase,
} from './tools/ValueChain/ValueChainPhases';

// ==================== TYPES ====================

interface ToolCanvasProps {
  toolType: ToolType;
  currentStep: number;
  stepDefinition?: StepDefinition;
  session: ToolSession;
  isStreaming: boolean;
  streamedContent: string;
  isPolish: boolean;
  onOpenChat: () => void;
  onOpenInitiatives?: () => void;
  generatedInitiatives?: { id: string; title: string; status?: string }[];
  onGenerateFullSession?: () => void;
  onContinue?: () => void;
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
  onOpenChat,
  onOpenInitiatives,
  generatedInitiatives,
  onGenerateFullSession,
  onContinue,
  missionSuggestion,
  onApplyMissionSuggestion,
  onDismissMissionSuggestion,
  isGeneratingAI,
  sessionGenerationStatus,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}) => {
  const { t } = useTranslation();
  // Render step-specific content
  const renderStepContent = () => {
    if (!stepDefinition) {
      return (
        <div className="flex items-center justify-center h-full text-c-text-secondary">
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
            onContinue={onContinue}
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
          <SummaryStep
            toolType={toolType}
            session={session}
            isPolish={isPolish}
            onAcceptCard={onAcceptCard}
            onRejectCard={onRejectCard}
            onRethinkCard={onRethinkCard}
          />
        );
      }
    }

    // Context step (first step for all tools)
    if (stepDefinition.id === 'context') {
      return (
        <ContextStep
          toolType={toolType}
          session={session}
          isPolish={isPolish}
          onGenerateFullSession={onGenerateFullSession}
          sessionGenerationStatus={sessionGenerationStatus}
        />
      );
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
      if (stepDefinition.id === 'mission') {
        return (
          <ContextStep
            toolType={toolType}
            session={session}
            isPolish={isPolish}
            onGenerateFullSession={onGenerateFullSession}
            sessionGenerationStatus={sessionGenerationStatus}
          />
        );
      }

      if (stepDefinition.id === 'input') {
        return (
          <MarketForcesInputPhase
            session={session}
            isPolish={isPolish}
            onAcceptCard={onAcceptCard}
            onRejectCard={onRejectCard}
            onRethinkCard={onRethinkCard}
          />
        );
      }

      if (stepDefinition.id === 'forces') {
        return (
          <MarketForcesBuildPhase
            session={session}
            isPolish={isPolish}
            onAcceptCard={onAcceptCard}
            onRejectCard={onRejectCard}
            onRethinkCard={onRethinkCard}
          />
        );
      }

      if (stepDefinition.id === 'insights') {
        return (
          <MarketForcesInsightsPhase
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
            <MarketForcesOutputsPhase
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

    if (toolType === 'value-chain') {
      if (stepDefinition.id === 'mission') {
        return (
          <ContextStep
            toolType={toolType}
            session={session}
            isPolish={isPolish}
            onGenerateFullSession={onGenerateFullSession}
            sessionGenerationStatus={sessionGenerationStatus}
          />
        );
      }

      if (stepDefinition.id === 'input') {
        return (
          <ValueChainInputPhase
            session={session}
            isPolish={isPolish}
            onAcceptCard={onAcceptCard}
            onRejectCard={onRejectCard}
            onRethinkCard={onRethinkCard}
          />
        );
      }

      if (stepDefinition.id === 'activities') {
        return (
          <ValueChainBuildPhase
            session={session}
            isPolish={isPolish}
            onAcceptCard={onAcceptCard}
            onRejectCard={onRejectCard}
            onRethinkCard={onRethinkCard}
          />
        );
      }

      if (stepDefinition.id === 'insights') {
        return (
          <ValueChainInsightsPhase
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
            <ValueChainOutputsPhase
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

    if (toolType === 'capability-mapper') {
      if (stepDefinition.id === 'mission') {
        return (
          <ContextStep
            toolType={toolType}
            session={session}
            isPolish={isPolish}
            onGenerateFullSession={onGenerateFullSession}
            sessionGenerationStatus={sessionGenerationStatus}
          />
        );
      }

      if (stepDefinition.id === 'input') {
        return (
          <CapabilityMapperInputPhase
            session={session}
            isPolish={isPolish}
            onAcceptCard={onAcceptCard}
            onRejectCard={onRejectCard}
            onRethinkCard={onRethinkCard}
          />
        );
      }

      if (stepDefinition.id === 'capabilities') {
        return (
          <CapabilityMapperBuildPhase
            session={session}
            isPolish={isPolish}
            onAcceptCard={onAcceptCard}
            onRejectCard={onRejectCard}
            onRethinkCard={onRethinkCard}
          />
        );
      }

      if (stepDefinition.id === 'insights') {
        return (
          <CapabilityMapperInsightsPhase
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
            <CapabilityMapperOutputsPhase
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

    if (toolType === 'ambition-decomposer') {
      if (stepDefinition.id === 'mission') {
        return (
          <ContextStep
            toolType={toolType}
            session={session}
            isPolish={isPolish}
            onGenerateFullSession={onGenerateFullSession}
            sessionGenerationStatus={sessionGenerationStatus}
          />
        );
      }

      if (stepDefinition.id === 'input') {
        return (
          <AmbitionDecomposerInputPhase
            session={session}
            isPolish={isPolish}
            onAcceptCard={onAcceptCard}
            onRejectCard={onRejectCard}
            onRethinkCard={onRethinkCard}
          />
        );
      }

      if (stepDefinition.id === 'themes') {
        return (
          <AmbitionDecomposerBuildPhase
            session={session}
            isPolish={isPolish}
            onAcceptCard={onAcceptCard}
            onRejectCard={onRejectCard}
            onRethinkCard={onRethinkCard}
          />
        );
      }

      if (stepDefinition.id === 'insights') {
        return (
          <AmbitionDecomposerInsightsPhase
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
            <AmbitionDecomposerOutputsPhase
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

    if (toolType === 'focus-tradeoff') {
      if (stepDefinition.id === 'mission') {
        return (
          <ContextStep
            toolType={toolType}
            session={session}
            isPolish={isPolish}
            onGenerateFullSession={onGenerateFullSession}
            sessionGenerationStatus={sessionGenerationStatus}
          />
        );
      }

      if (stepDefinition.id === 'input') {
        return (
          <FocusTradeoffInputPhase
            session={session}
            isPolish={isPolish}
            onAcceptCard={onAcceptCard}
            onRejectCard={onRejectCard}
            onRethinkCard={onRethinkCard}
          />
        );
      }

      if (stepDefinition.id === 'priorities') {
        return (
          <FocusTradeoffBuildPhase
            session={session}
            isPolish={isPolish}
            onAcceptCard={onAcceptCard}
            onRejectCard={onRejectCard}
            onRethinkCard={onRethinkCard}
          />
        );
      }

      if (stepDefinition.id === 'insights') {
        return (
          <FocusTradeoffInsightsPhase
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
            <FocusTradeoffOutputsPhase
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

    if (toolType === 'narrative-engine') {
      if (stepDefinition.id === 'mission') {
        return (
          <ContextStep
            toolType={toolType}
            session={session}
            isPolish={isPolish}
            onGenerateFullSession={onGenerateFullSession}
            sessionGenerationStatus={sessionGenerationStatus}
          />
        );
      }

      if (stepDefinition.id === 'input') {
        return (
          <NarrativeEngineInputPhase
            session={session}
            isPolish={isPolish}
            onAcceptCard={onAcceptCard}
            onRejectCard={onRejectCard}
            onRethinkCard={onRethinkCard}
          />
        );
      }

      if (stepDefinition.id === 'pillars') {
        return (
          <NarrativeEngineBuildPhase
            session={session}
            isPolish={isPolish}
            onAcceptCard={onAcceptCard}
            onRejectCard={onRejectCard}
            onRethinkCard={onRethinkCard}
          />
        );
      }

      if (stepDefinition.id === 'insights') {
        return (
          <NarrativeEngineInsightsPhase
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
            <NarrativeEngineOutputsPhase
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

    if (toolType === 'growth-paths') {
      if (stepDefinition.id === 'mission') {
        return (
          <ContextStep
            toolType={toolType}
            session={session}
            isPolish={isPolish}
            onGenerateFullSession={onGenerateFullSession}
            sessionGenerationStatus={sessionGenerationStatus}
          />
        );
      }

      if (stepDefinition.id === 'input') {
        return (
          <GrowthPathsInputPhase
            session={session}
            isPolish={isPolish}
            onAcceptCard={onAcceptCard}
            onRejectCard={onRejectCard}
            onRethinkCard={onRethinkCard}
          />
        );
      }

      if (stepDefinition.id === 'options') {
        return (
          <GrowthPathsOptionsPhase
            session={session}
            isPolish={isPolish}
            onAcceptCard={onAcceptCard}
            onRejectCard={onRejectCard}
            onRethinkCard={onRethinkCard}
          />
        );
      }

      if (stepDefinition.id === 'insights') {
        return (
          <GrowthPathsInsightsPhase
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
            <GrowthPathsOutputsPhase
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

    if (toolType === 'portfolio-priority') {
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
          <PortfolioInputPhase
            session={session}
            isPolish={isPolish}
            onAcceptCard={onAcceptCard}
            onRejectCard={onRejectCard}
            onRethinkCard={onRethinkCard}
          />
        );
      }
      if (stepDefinition.id === 'items') {
        return (
          <PortfolioItemsPhase
            session={session}
            isPolish={isPolish}
            onAcceptCard={onAcceptCard}
            onRejectCard={onRejectCard}
            onRethinkCard={onRethinkCard}
          />
        );
      }
      if (stepDefinition.id === 'insights') {
        return (
          <PortfolioInsightsPhase
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
            <PortfolioOutputsPhase
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

    if (toolType === 'risk-uncertainty') {
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
          <RiskInputPhase
            session={session}
            isPolish={isPolish}
            onAcceptCard={onAcceptCard}
            onRejectCard={onRejectCard}
            onRethinkCard={onRethinkCard}
          />
        );
      }
      if (stepDefinition.id === 'assumptions') {
        return (
          <RiskMapPhase
            session={session}
            isPolish={isPolish}
            onAcceptCard={onAcceptCard}
            onRejectCard={onRejectCard}
            onRethinkCard={onRethinkCard}
          />
        );
      }
      if (stepDefinition.id === 'insights') {
        return (
          <RiskInsightsPhase
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
            <RiskOutputsPhase
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

    // --- Wave 1 digital trio: dedicated domain steps via GenericDomainStep ---
    const DIGITAL_DOMAIN_STEPS: Record<string, string[]> = {
      'ai-discovery': ['use-cases', 'prerequisites', 'pilot-plan'],
      'pain-explorer': ['problems', 'hypotheses', 'evidence-gaps'],
      'rpa-scanner': ['candidates', 'sizing', 'backlog'],
    };
    if (
      DIGITAL_DOMAIN_STEPS[toolType] &&
      DIGITAL_DOMAIN_STEPS[toolType].includes(stepDefinition.id)
    ) {
      return (
        <GenericDomainStep
          sectionId={stepDefinition.id}
          title={isPolish ? stepDefinition.namePl : stepDefinition.name}
          description={isPolish ? stepDefinition.descriptionPl : stepDefinition.description}
          session={session}
          isPolish={isPolish}
        />
      );
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

    // Default guard — every launchable (shipped) tool resolves a step above.
    // This is belt-and-suspenders: shipped tools never reach here, and HIDE
    // tools are blocked from launching by the `isComingSoon` catalog flag, so
    // no paid session can ever surface a raw "not implemented" string.
    // We still render a graceful, on-brand panel rather than a blank/error.
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded-2xl border border-dashed border-c-border-subtle bg-c-surface-raised p-8 text-center">
          <p className="text-base font-medium text-c-text-secondary">
            {t('discoveryToolsMain.toolCanvas.stepBeingPrepared')}
          </p>
          <p className="mt-2 text-sm text-c-text-muted">
            {t('discoveryToolsMain.toolCanvas.stepBeingPreparedDescription')}
          </p>
        </div>
      </div>
    );
  };

  return <div className="h-full overflow-y-auto p-6">{renderStepContent()}</div>;
};

export default ToolCanvas;
