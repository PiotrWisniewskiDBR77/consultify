/**
 * ToolActionBar - Bottom navigation and actions
 *
 * Provides step navigation and AI action buttons.
 */

import { ChevronLeft, ChevronRight, Sparkles, Square, Wand2 } from 'lucide-react';
import React from 'react';

import { StepDefinition } from '@/store/useToolStore';

// ==================== TYPES ====================

interface ToolActionBarProps {
  currentStep: number;
  totalSteps: number;
  canAdvance: boolean;
  isStreaming: boolean;
  stepDefinition?: StepDefinition;
  onPrevStep: () => void;
  onNextStep: () => void;
  onRequestSuggestions: () => Promise<void>;
  onGenerateAnalysis: () => Promise<void>;
  onAbort: () => void;
  isPolish: boolean;
}

// ==================== COMPONENT ====================

export const ToolActionBar: React.FC<ToolActionBarProps> = ({
  currentStep,
  totalSteps,
  canAdvance,
  isStreaming,
  stepDefinition,
  onPrevStep,
  onNextStep,
  onRequestSuggestions,
  onGenerateAnalysis,
  onAbort,
  isPolish,
}) => {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;
  const isAIStep = stepDefinition?.aiAssisted;
  const isAnalysisStep = [
    'correlations',
    'summary',
    'results',
    'reasoning',
    'prepare',
    'initiatives',
  ].includes(stepDefinition?.id || '');

  return (
    <div className="bg-white dark:bg-navy-900 border-t border-slate-200 dark:border-navy-700 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left: Previous button */}
        <button
          onClick={onPrevStep}
          disabled={isFirstStep}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
            ${
              isFirstStep
                ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
            }
          `}
        >
          <ChevronLeft className="w-4 h-4" />
          {isPolish ? 'Poprzedni' : 'Previous'}
        </button>

        {/* Center: AI Actions */}
        <div className="flex items-center gap-2">
          {isStreaming ? (
            <button
              onClick={onAbort}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-sm font-medium"
            >
              <Square className="w-4 h-4" />
              {isPolish ? 'Zatrzymaj' : 'Stop'}
            </button>
          ) : (
            <>
              {isAIStep && !isAnalysisStep && (
                <button
                  onClick={onRequestSuggestions}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors text-sm font-medium"
                >
                  <Sparkles className="w-4 h-4" />
                  {isPolish ? 'AI Sugestie' : 'AI Suggest'}
                </button>
              )}
              {isAnalysisStep && (
                <button
                  onClick={onGenerateAnalysis}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-primary-500 to-purple-500 text-white hover:from-primary-600 hover:to-purple-600 transition-colors text-sm font-medium"
                >
                  <Wand2 className="w-4 h-4" />
                  {isPolish ? 'Generuj analizę' : 'Generate Analysis'}
                </button>
              )}
            </>
          )}
        </div>

        {/* Right: Next button */}
        <button
          onClick={onNextStep}
          disabled={!canAdvance || isStreaming}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
            ${
              !canAdvance || isStreaming
                ? 'bg-slate-100 dark:bg-navy-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                : 'bg-primary-500 text-white hover:bg-primary-600'
            }
          `}
        >
          {isLastStep ? (isPolish ? 'Zakończ' : 'Finish') : isPolish ? 'Następny' : 'Next'}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ToolActionBar;
