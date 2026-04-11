/**
 * ToolActionBar - Bottom navigation and actions
 *
 * Provides step navigation only.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import React from 'react';

// ==================== TYPES ====================

interface ToolActionBarProps {
  currentStep: number;
  totalSteps: number;
  canAdvance: boolean;
  onPrevStep: () => void;
  onNextStep: () => void;
  isPolish: boolean;
}

// ==================== COMPONENT ====================

export const ToolActionBar: React.FC<ToolActionBarProps> = ({
  currentStep,
  totalSteps,
  canAdvance,
  onPrevStep,
  onNextStep,
  isPolish,
}) => {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

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
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {isPolish ? 'Krok' : 'Step'} {currentStep}/{totalSteps}
        </div>

        {/* Right: Next button */}
        <button
          onClick={onNextStep}
          disabled={!canAdvance}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
            ${
              !canAdvance
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
