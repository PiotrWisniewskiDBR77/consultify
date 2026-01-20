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
import { ForceStep } from './tools/MarketForces/ForceStep';

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
      />
    </div>
  );
};

export default ToolCanvas;
