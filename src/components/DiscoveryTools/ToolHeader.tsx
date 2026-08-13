/**
 * ToolHeader — nawigacja kroków sesji narzędzia (pasek pod Menu 1).
 *
 * Identyfikacja artefaktu (tytuł, status, akcje, kebab) przeniosła się do
 * wspólnej powłoki SPEC-A (`ToolArtifactShell` → `NModeHeader`, patrz
 * `src/components/DiscoveryTools/shared/ToolArtifactShell.tsx`). Ten
 * komponent zostaje jako `secondaryBar` powłoki — pasek postępu + kroki
 * sesji (odpowiednik nawigacji wewnętrznej archetypu Canvas, §13.3
 * ARTIFACT_ANATOMY_STANDARD.md). Wyłącznie tokeny `c-*`.
 */

import { Check } from 'lucide-react';
import React from 'react';

import { StepDefinition } from '@/store/useToolStore';

// ==================== TYPES ====================

interface ToolHeaderProps {
  progress: number;
  currentStep: number;
  totalSteps: number;
  steps: StepDefinition[];
  completedSteps: string[];
  onStepClick: (step: number) => void;
  isPolish: boolean;
}

// ==================== COMPONENT ====================

export const ToolHeader: React.FC<ToolHeaderProps> = ({
  progress,
  currentStep,
  totalSteps,
  steps,
  completedSteps,
  onStepClick,
  isPolish,
}) => {
  return (
    <div
      className="border-b border-c-border-subtle bg-c-surface"
      role="navigation"
      aria-label={isPolish ? 'Kroki sesji' : 'Session steps'}
    >
      {/* Progress */}
      <div className="flex items-center gap-3 px-6 py-2">
        <div
          className="h-1.5 w-32 shrink-0 overflow-hidden rounded-full bg-c-surface-raised"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-c-info transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="shrink-0 text-xs tabular-nums text-c-text-muted">{progress}%</span>
        <span className="sr-only" aria-live="polite">
          {isPolish
            ? `Krok ${currentStep} z ${totalSteps}`
            : `Step ${currentStep} of ${totalSteps}`}
        </span>
      </div>

      {/* Step navigation */}
      <div className="flex items-center gap-2 overflow-x-auto px-6 pb-2">
        {steps.map((step, index) => {
          const stepNum = index + 1;
          const isActive = stepNum === currentStep;
          const isCompleted = completedSteps.includes(step.id);
          const canClick = isCompleted || stepNum <= currentStep;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => canClick && onStepClick(stepNum)}
              disabled={!canClick}
              aria-current={isActive ? 'step' : undefined}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] ${
                isActive
                  ? 'bg-c-surface-raised font-medium text-c-text'
                  : isCompleted
                    ? 'text-c-text-secondary hover:bg-c-surface-raised'
                    : 'text-c-text-muted'
              } ${canClick ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
            >
              {isCompleted ? (
                <Check size={14} className="text-c-success" aria-hidden="true" />
              ) : (
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                    isActive ? 'bg-c-info text-white' : 'bg-c-surface-raised text-c-text-muted'
                  }`}
                >
                  {stepNum}
                </span>
              )}
              <span>{isPolish ? step.namePl : step.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ToolHeader;
