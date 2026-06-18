/**
 * InterviewPipelineStepper — top-level numbered process pipeline for the
 * Interview module (M10, decision D-03 / 2026-06-06 redesign).
 *
 * Renders the canonical stages ① Szablony → ② Przydzielone → ③ Inbox →
 * ④ Dopuszczenie → ⑤ Wnioski → ⑥ Inicjatywy as clickable pills with per-stage
 * count badges ("③ 3 do oceny"). It is a thin PRESENTATIONAL component: the
 * parent (InterviewHub) owns the data, permission gating (which stages are
 * passed in `steps`) and the active stage.
 *
 * It deliberately reuses the VISUAL language of `WizardModal/WizardStepper`
 * (progress bar + rounded numbered pills + crimson active accent) but drives
 * navigation by tab id (free jumping between permitted stages), NOT by the
 * wizard's linear `maxReachableIndex` reachability gate — every stage handed in
 * is reachable.
 *
 * Gated behind `isInterviewPipelineStepperEnabled()` at the call site; this
 * component never decides visibility.
 */

import { Check } from 'lucide-react';
import React from 'react';

import type { ModuleTab } from '../shared/ModuleHub';

export interface InterviewPipelineStep {
  id: ModuleTab;
  /** Canonical stage numeral (①–⑥). */
  numeral: string;
  /** Clean stage label (no numeral prefix). */
  label: string;
  /** Optional per-stage count badge. */
  count?: number;
}

interface InterviewPipelineStepperProps {
  steps: InterviewPipelineStep[];
  activeTab: ModuleTab;
  onStepChange: (id: ModuleTab) => void;
  isPolish: boolean;
}

export const InterviewPipelineStepper: React.FC<InterviewPipelineStepperProps> = ({
  steps,
  activeTab,
  onStepChange,
  isPolish,
}) => {
  const total = steps.length;
  if (total === 0) return null;

  // Active index within the pipeline. -1 when the current view is a non-pipeline
  // tab (e.g. Sessions) — then no pill is "active" and nothing is "complete".
  const activeIndex = steps.findIndex((s) => s.id === activeTab);
  // Progress fill: covered fraction up to (and including) the active stage.
  const progress = activeIndex < 0 ? 0 : total <= 1 ? 1 : activeIndex / (total - 1);

  return (
    <div
      className="border-b border-slate-200 bg-slate-50/70 px-3 py-2.5 dark:border-white/[0.08] dark:bg-navy-950/30"
      aria-label={isPolish ? 'Proces wywiadu' : 'Interview process'}
    >
      {/* Progress bar */}
      <div
        className="mb-2.5 h-1 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-navy-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={activeIndex + 1}
      >
        <div
          className="h-full rounded-full bg-navy-900 transition-[width] duration-300 ease-out"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      {/* Clickable stage pills */}
      <ol
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${Math.max(total, 1)}, minmax(0, 1fr))` }}
      >
        {steps.map((step, index) => {
          const isActive = index === activeIndex;
          const isComplete = activeIndex >= 0 && index < activeIndex;
          const hasCount = typeof step.count === 'number' && step.count > 0;

          return (
            <li key={step.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onStepChange(step.id)}
                aria-current={isActive ? 'step' : undefined}
                className={`group relative w-full rounded-xl border px-2 py-1.5 text-left transition-all hover:border-primary-500/50 ${
                  isActive
                    ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500/20 dark:bg-primary-500/15'
                    : isComplete
                      ? 'border-emerald-300/50 bg-white text-slate-600 dark:border-emerald-500/20 dark:bg-navy-900/70 dark:text-slate-300'
                      : 'border-slate-200 bg-slate-100/70 text-slate-500 dark:border-white/[0.08] dark:bg-navy-900/50 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-colors ${
                      isActive
                        ? 'bg-navy-900 text-white shadow-sm'
                        : isComplete
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200/80 text-slate-500 dark:bg-navy-800 dark:text-slate-400'
                    }`}
                  >
                    {isComplete ? <Check size={12} strokeWidth={3} /> : step.numeral}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`flex items-center gap-1.5 truncate text-xs font-semibold leading-tight ${
                        isActive ? 'text-primary-700 dark:text-primary-200' : ''
                      }`}
                    >
                      <span className="truncate">{step.label}</span>
                      {hasCount ? (
                        <span
                          className={`inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                            isActive
                              ? 'bg-navy-900 text-white'
                              : 'bg-slate-200 text-slate-600 dark:bg-navy-800 dark:text-slate-300'
                          }`}
                        >
                          {step.count}
                        </span>
                      ) : null}
                    </span>
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

export default InterviewPipelineStepper;
