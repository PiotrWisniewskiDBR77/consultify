/**
 * WizardStepper — the §5b header: a progress bar + clickable, numbered step
 * pills. Extracted from WizardModal for readability; not exported from the
 * package index (internal to the shell).
 *
 * Visual language mirrors the existing InsightCreatorModal stepper (navy
 * dark-mode palette, rounded pills, accent-colored active state) so the three
 * wizards converge on one look.
 *
 * NOTE: inline `style` is used deliberately for the managed `accentColor` and
 * the dynamic step-count grid template — both are runtime values that cannot be
 * expressed with static Tailwind tokens — so the repo's no-inline-style rule is
 * disabled at file scope.
 */
/* eslint-disable no-restricted-syntax */
import { Check } from 'lucide-react';
import React from 'react';

import type { WizardStep } from './types';

interface WizardStepperProps {
  steps: WizardStep[];
  activeStepIndex: number;
  /** Highest step index the user is allowed to jump to (reachability gate). */
  maxReachableIndex: number;
  onStepChange: (index: number) => void;
  isPolish: boolean;
  /** Managed accent color for the active pill + progress fill. */
  accentColor: string;
}

/** A step is "done" if it sits before the active step or is explicitly complete. */
const isStepDone = (step: WizardStep, index: number, activeStepIndex: number): boolean =>
  step.status === 'complete' || index < activeStepIndex;

export const WizardStepper: React.FC<WizardStepperProps> = ({
  steps,
  activeStepIndex,
  maxReachableIndex,
  onStepChange,
  isPolish,
  accentColor,
}) => {
  const total = steps.length;
  // Progress fill: fraction of the journey covered up to (and including) the
  // active step. Guards against a single-step wizard.
  const progress = total <= 1 ? 1 : activeStepIndex / (total - 1);

  return (
    <div className="border-b border-slate-200 bg-slate-50/70 px-3 py-2.5 dark:border-white/[0.08] dark:bg-navy-950/30">
      {/* Progress bar */}
      <div
        className="mb-2.5 h-1 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-navy-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={activeStepIndex + 1}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${Math.round(progress * 100)}%`, backgroundColor: accentColor }}
        />
      </div>

      {/* Clickable step pills */}
      <ol
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${Math.max(total, 1)}, minmax(0, 1fr))` }}
      >
        {steps.map((step, index) => {
          const isActive = index === activeStepIndex;
          const isComplete = isStepDone(step, index, activeStepIndex);
          const isReachable = index <= maxReachableIndex;
          const hint = step.hint ? (isPolish ? step.hint.pl : step.hint.en) : undefined;
          const label = isPolish ? step.label.pl : step.label.en;

          return (
            <li key={step.id} className="min-w-0">
              <button
                type="button"
                disabled={!isReachable}
                onClick={() => isReachable && onStepChange(index)}
                title={hint}
                aria-current={isActive ? 'step' : undefined}
                className={`group relative w-full rounded-xl border px-2 py-1.5 text-left transition-all ${
                  isActive
                    ? 'border-transparent bg-slate-100 ring-1 ring-slate-300/60 dark:bg-white/[0.08]'
                    : isComplete
                      ? 'border-emerald-300/50 bg-white text-slate-600 dark:border-emerald-500/20 dark:bg-navy-900/70 dark:text-slate-300'
                      : 'border-slate-200 bg-slate-100/70 text-slate-500 dark:border-white/[0.08] dark:bg-navy-900/50 dark:text-slate-400'
                } ${isReachable ? 'hover:border-slate-400/60 dark:hover:border-c-border' : 'cursor-not-allowed opacity-60'}`}
                style={isActive ? { borderColor: accentColor } : undefined}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-colors ${
                      isActive
                        ? 'text-white shadow-sm'
                        : isComplete
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200/80 text-slate-500 dark:bg-navy-800 dark:text-slate-400'
                    }`}
                    style={isActive ? { backgroundColor: accentColor } : undefined}
                  >
                    {isComplete && !isActive ? <Check size={12} strokeWidth={3} /> : index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-xs font-semibold leading-tight ${
                        isActive ? 'text-slate-900 dark:text-white' : ''
                      }`}
                    >
                      {label}
                      {step.optional ? (
                        <span className="ml-1 text-[10px] font-normal text-slate-400">
                          {isPolish ? '(opcjonalnie)' : '(optional)'}
                        </span>
                      ) : null}
                    </span>
                    {hint ? (
                      <span
                        className={`mt-0.5 hidden truncate text-[10px] leading-tight sm:block ${
                          isActive
                            ? 'text-slate-600 dark:text-slate-300'
                            : 'text-slate-400'
                        }`}
                      >
                        {hint}
                      </span>
                    ) : null}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
