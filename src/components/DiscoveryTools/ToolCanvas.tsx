/**
 * ToolCanvas - Main content area for strategic tools
 *
 * Renders step-specific content and inline assist panel.
 */

import React from 'react';

import { StepDefinition, ToolSession, ToolType } from '@/store/useToolStore';

import { ToolContextPanel } from './ToolContextPanel';
import { ContextStep } from './steps/ContextStep';
import { SummaryStep } from './steps/SummaryStep';
import { SWOTCorrelationsStep } from './tools/DynamicSWOT/SWOTCorrelationsStep';
import { SWOTQuadrantStep } from './tools/DynamicSWOT/SWOTQuadrantStep';
import { GrowthPathQuadrantStep } from './tools/GrowthPaths/GrowthPathQuadrantStep';
import { ForceStep } from './tools/MarketForces/ForceStep';
import { PortfolioItemsStep } from './tools/PortfolioPriority/PortfolioItemsStep';
import { PortfolioMatrixStep } from './tools/PortfolioPriority/PortfolioMatrixStep';
import { AssumptionsStep } from './tools/RiskUncertainty/AssumptionsStep';
import { RisksStep } from './tools/RiskUncertainty/RisksStep';
import { ScenariosStep } from './tools/RiskUncertainty/ScenariosStep';
import {
  A3CountermeasuresStep,
  A3ProblemStep,
  A3RootCauseStep,
  DMSEscalationStep,
  DMSKPIsStep,
  InventoryClassificationStep,
  InventoryReplenishmentStep,
  OperationalSectionStep,
  SOPChecklistsStep,
  SOPStandardsStep,
  SMEDImprovementsStep,
  SMEDStepsStep,
} from './tools/Operational';

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
}

// ==================== COMPONENT ====================

export const ToolCanvas: React.FC<ToolCanvasProps> = ({
  toolType,
  currentStep,
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
}) => {
  // Render step-specific content
  const renderStepContent = () => {
    if (!stepDefinition) {
      return (
        <div className="flex items-center justify-center h-full text-slate-400">
          Loading step...
        </div>
      );
    }

    // Context step (first step for all tools)
    if (stepDefinition.id === 'context') {
      return <ContextStep toolType={toolType} session={session} isPolish={isPolish} />;
    }

    // Summary step (last step for all tools)
    if (stepDefinition.id === 'summary') {
      return <SummaryStep toolType={toolType} session={session} isPolish={isPolish} />;
    }

    // Tool-specific steps
    if (toolType === 'dynamic-swot') {
      // SWOT quadrant steps
      if (['strengths', 'weaknesses', 'opportunities', 'threats'].includes(stepDefinition.id)) {
        return (
          <SWOTQuadrantStep
            quadrant={stepDefinition.id as 'strengths' | 'weaknesses' | 'opportunities' | 'threats'}
            session={session}
            isPolish={isPolish}
          />
        );
      }

      // Correlations step
      if (stepDefinition.id === 'correlations') {
        return <SWOTCorrelationsStep session={session} isPolish={isPolish} />;
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
        ['market-penetration', 'market-development', 'product-development', 'diversification'].includes(
          stepDefinition.id
        )
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
      ['sop-builder', 'a3-problem-solving', 'smed-planner', 'dms-builder', 'inventory-autopilot'].includes(
        toolType
      )
    ) {
      if (stepDefinition.id !== 'context' && stepDefinition.id !== 'summary') {
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
      <div className="flex-1 overflow-y-auto p-6">{renderStepContent()}</div>

      <ToolContextPanel
        toolType={toolType}
        session={session}
        isPolish={isPolish}
        orgName={orgName}
        aiContent={isStreaming ? streamedContent : undefined}
        onOpenChat={onOpenChat}
        onOpenInitiatives={onOpenInitiatives}
        generatedInitiatives={generatedInitiatives}
        recentInitiatives={recentInitiatives}
        chatSnippets={chatSnippets}
      />
    </div>
  );
};

export default ToolCanvas;
