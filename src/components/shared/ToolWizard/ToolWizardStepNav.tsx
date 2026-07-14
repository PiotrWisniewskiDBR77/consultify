/**
 * ToolWizardStepNav — Left sidebar step navigation for wizard
 * Follows NModeLeftNav pattern (242px sticky), adapted for wizard flow.
 */

import { Check, Circle, Lock } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { MissingItem, WizardSessionData, WizardStepConfig, WizardStepId } from './types';

interface ToolWizardStepNavProps {
  steps: WizardStepConfig[];
  currentStep: WizardStepId;
  sessionData: WizardSessionData;
  onStepChange: (step: WizardStepId) => void;
  missingItems: MissingItem[];
  locked?: boolean;
}

const STEP_ORDER: WizardStepId[] = ['define', 'inputs', 'work', 'review', 'finalize', 'outputs'];

function getStepIndex(stepId: WizardStepId): number {
  return STEP_ORDER.indexOf(stepId);
}

function isStepCompleted(
  stepId: WizardStepId,
  currentStep: WizardStepId,
  sessionData: WizardSessionData
): boolean {
  if (sessionData.status === 'FINALIZED') return stepId !== 'outputs';
  return getStepIndex(stepId) < getStepIndex(currentStep);
}

function isStepAccessible(
  stepId: WizardStepId,
  currentStep: WizardStepId,
  sessionData: WizardSessionData
): boolean {
  if (sessionData.status === 'FINALIZED') return true;
  return getStepIndex(stepId) <= getStepIndex(currentStep) + 1;
}

export const ToolWizardStepNav: React.FC<ToolWizardStepNavProps> = ({
  steps,
  currentStep,
  sessionData,
  onStepChange,
  missingItems,
  locked,
}) => {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'pl' ? 'pl' : 'en';

  return (
    <nav
      className="w-[242px] shrink-0 sticky top-0 self-start border-r border-slate-200 dark:border-navy-700 bg-white/50 dark:bg-navy-900/50 overflow-y-auto"
      style={{ maxHeight: 'calc(100vh - 120px)' }}
    >
      <div className="py-4 px-3 space-y-1">
        {steps.map((step) => {
          const isCurrent = step.id === currentStep;
          const completed = isStepCompleted(step.id, currentStep, sessionData);
          const accessible = isStepAccessible(step.id, currentStep, sessionData);
          const stepMissing = missingItems.filter((m) => m.stepId === step.id && !m.resolved);
          const hasRequiredMissing = stepMissing.some((m) => m.severity === 'required');

          return (
            <button
              key={step.id}
              onClick={() => accessible && !locked && onStepChange(step.id)}
              disabled={!accessible || locked}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left
                transition-colors duration-150 group
                ${
                  isCurrent
                    ? 'bg-slate-100 dark:bg-white/[0.07] text-slate-900 dark:text-white'
                    : completed
                      ? 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800'
                      : accessible
                        ? 'text-slate-500 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800'
                        : 'text-slate-600 dark:text-slate-400 cursor-not-allowed opacity-60'
                }
              `}
            >
              <span className="shrink-0">
                {locked && !completed ? (
                  <Lock size={16} className="text-slate-600 dark:text-slate-400" />
                ) : completed ? (
                  <Check size={16} className="text-emerald-500" />
                ) : isCurrent ? (
                  <Circle
                    size={16}
                    className="text-slate-700 dark:text-slate-200 fill-slate-200/50 dark:fill-white/10"
                  />
                ) : (
                  <Circle size={16} />
                )}
              </span>

              <span className="flex-1 min-w-0">
                <span
                  className={`block text-sm font-medium truncate ${isCurrent ? 'text-slate-900 dark:text-white' : ''}`}
                >
                  {step.label[lang]}
                </span>
                {step.description && (
                  <span className="block text-[11px] text-slate-500 dark:text-slate-500 truncate mt-0.5">
                    {step.description[lang]}
                  </span>
                )}
              </span>

              {hasRequiredMissing && !completed && (
                <span
                  className="shrink-0 w-2 h-2 rounded-full bg-amber-500"
                  title="Missing required items"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
