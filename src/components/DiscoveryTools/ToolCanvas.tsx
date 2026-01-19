/**
 * ToolCanvas - Main content area for strategic tools
 *
 * Renders step-specific content and integrated chat.
 */

import React from 'react';
import { Send, Sparkles } from 'lucide-react';

import { ToolType, StepDefinition, ToolSession } from '@/store/useToolStore';
import { ContextStep } from './steps/ContextStep';
import { SummaryStep } from './steps/SummaryStep';
import { SWOTQuadrantStep } from './tools/DynamicSWOT/SWOTQuadrantStep';
import { SWOTCorrelationsStep } from './tools/DynamicSWOT/SWOTCorrelationsStep';
import { ForceStep } from './tools/MarketForces/ForceStep';

// ==================== TYPES ====================

interface ToolCanvasProps {
  toolType: ToolType;
  currentStep: number;
  stepDefinition?: StepDefinition;
  session: ToolSession;
  isStreaming: boolean;
  streamedContent: string;
  onSendMessage: (message: string) => Promise<void>;
  onRequestSuggestions: () => Promise<void>;
  isPolish: boolean;
}

// ==================== COMPONENT ====================

export const ToolCanvas: React.FC<ToolCanvasProps> = ({
  toolType,
  currentStep,
  stepDefinition,
  session,
  isStreaming,
  streamedContent,
  onSendMessage,
  onRequestSuggestions,
  isPolish,
}) => {
  const [chatInput, setChatInput] = React.useState('');

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isStreaming) return;
    const message = chatInput;
    setChatInput('');
    await onSendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

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
      return (
        <ContextStep
          toolType={toolType}
          session={session}
          isPolish={isPolish}
        />
      );
    }

    // Summary step (last step for all tools)
    if (stepDefinition.id === 'summary') {
      return (
        <SummaryStep
          toolType={toolType}
          session={session}
          isPolish={isPolish}
        />
      );
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
        return (
          <SWOTCorrelationsStep
            session={session}
            isPolish={isPolish}
          />
        );
      }
    }

    if (toolType === 'market-forces') {
      // Porter force steps
      if (['rivalry', 'newEntrants', 'substitutes', 'buyerPower', 'supplierPower'].includes(stepDefinition.id)) {
        return (
          <ForceStep
            forceId={stepDefinition.id as 'rivalry' | 'newEntrants' | 'substitutes' | 'buyerPower' | 'supplierPower'}
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
        {renderStepContent()}
      </div>

      {/* Chat sidebar */}
      <div className="w-96 border-l border-slate-200 dark:border-navy-700 flex flex-col bg-white dark:bg-navy-900">
        {/* Chat header */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-slate-900 dark:text-white">
              {isPolish ? 'Asystent AI' : 'AI Assistant'}
            </h3>
            <button
              onClick={onRequestSuggestions}
              disabled={isStreaming}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3 h-3" />
              {isPolish ? 'Sugestie' : 'Suggest'}
            </button>
          </div>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {session.chatHistory.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  message.role === 'user'
                    ? 'bg-primary-500 text-white'
                    : 'bg-slate-100 dark:bg-navy-800 text-slate-900 dark:text-white'
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}

          {/* Streaming indicator */}
          {isStreaming && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-slate-100 dark:bg-navy-800 text-slate-900 dark:text-white">
                {streamedContent || (
                  <span className="flex items-center gap-2">
                    <span className="animate-pulse">●</span>
                    <span className="animate-pulse animation-delay-100">●</span>
                    <span className="animate-pulse animation-delay-200">●</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Chat input */}
        <div className="p-4 border-t border-slate-200 dark:border-navy-700">
          <div className="flex items-end gap-2">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isPolish ? 'Zadaj pytanie...' : 'Ask a question...'}
              rows={2}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none text-sm"
            />
            <button
              onClick={handleSendMessage}
              disabled={!chatInput.trim() || isStreaming}
              className="p-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolCanvas;
