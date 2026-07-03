/**
 * InitiativeDraftJourney
 *
 * M13 flow redesign (2026-07-02): a DRAFT initiative document opens with a
 * clear "co dalej" journey strip — the consultant-grade guidance the owner
 * asked for ("czy konsultant tak prowadziłby klienta?").
 *
 * Three steps, state-aware:
 *  1. Treść dokumentu  — fill the document sections (AI-assisted),
 *  2. Plan i zadania   — add tasks / generate a plan (feeds the Gantt),
 *  3. Dalej w procesie — explicit gate action (Send to review → ... → Start
 *     Execution), driven by the backend gate-readiness transitions.
 *
 * Pure presentational; step computation is exported for unit tests.
 */

import { Bot, CheckCircle2, ChevronRight, ListTodo, Rocket, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

// ── Step computation (exported for tests) ───────────────────────────────────

export type DraftJourneyStepId = 'content' | 'plan' | 'advance';

export interface DraftJourneyStep {
  id: DraftJourneyStepId;
  done: boolean;
  /** The first not-done step is "current" — its CTA is visually primary. */
  current: boolean;
}

export interface DraftJourneyInput {
  /** Does the document already have meaningful content (summary/description)? */
  hasContent: boolean;
  /** Number of tasks attached to the initiative (Gantt source). */
  taskCount: number;
}

export function computeDraftJourneySteps(input: DraftJourneyInput): DraftJourneyStep[] {
  const doneById: Record<DraftJourneyStepId, boolean> = {
    content: !!input.hasContent,
    plan: input.taskCount > 0,
    advance: false,
  };
  const order: DraftJourneyStepId[] = ['content', 'plan', 'advance'];
  let currentAssigned = false;
  return order.map((id) => {
    const done = doneById[id];
    const current = !done && !currentAssigned;
    if (current) currentAssigned = true;
    return { id, done, current };
  });
}

/** localStorage key for per-initiative dismissal. */
export function draftJourneyDismissKey(initiativeId: string): string {
  return `initiative-draft-journey-dismissed:${initiativeId}`;
}

// ── Component ───────────────────────────────────────────────────────────────

export interface InitiativeDraftJourneyProps {
  hasContent: boolean;
  taskCount: number;
  /** Label of the first available gate transition (e.g. "Send to review"). */
  advanceActionLabel?: string | null;
  onFillWithAi: () => void;
  onPlanTasks: () => void;
  /** Runs the first available gate transition. Undefined → step shows hint only. */
  onAdvance?: () => void;
  onDismiss: () => void;
}

const STEP_META: Record<
  DraftJourneyStepId,
  { icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  content: { icon: Bot },
  plan: { icon: ListTodo },
  advance: { icon: Rocket },
};

export const InitiativeDraftJourney: React.FC<InitiativeDraftJourneyProps> = ({
  hasContent,
  taskCount,
  advanceActionLabel,
  onFillWithAi,
  onPlanTasks,
  onAdvance,
  onDismiss,
}) => {
  const { t } = useTranslation();
  const steps = computeDraftJourneySteps({ hasContent, taskCount });

  const stepCopy: Record<DraftJourneyStepId, { title: string; cta: string }> = {
    content: {
      title: t('initiatives.draftJourney.contentTitle', 'Treść dokumentu'),
      cta: t('initiatives.draftJourney.contentCta', 'Wypełnij z AI'),
    },
    plan: {
      title: t('initiatives.draftJourney.planTitle', 'Plan i zadania'),
      cta: t('initiatives.draftJourney.planCta', 'Zaplanuj zadania'),
    },
    advance: {
      title: t('initiatives.draftJourney.advanceTitle', 'Dalej w procesie'),
      cta: advanceActionLabel || t('initiatives.draftJourney.advanceCta', 'Prześlij do przeglądu'),
    },
  };

  const handlers: Record<DraftJourneyStepId, (() => void) | undefined> = {
    content: onFillWithAi,
    plan: onPlanTasks,
    advance: onAdvance,
  };

  return (
    <div
      data-testid="initiative-draft-journey"
      className="rounded-xl border border-teal-200/70 dark:border-teal-500/20 bg-teal-50/60 dark:bg-teal-500/[0.06] px-4 py-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-teal-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
              {t('initiatives.draftJourney.badge', 'Szkic')}
            </span>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
              {t(
                'initiatives.draftJourney.headline',
                'To jest dokument roboczy inicjatywy — trzy kroki do startu'
              )}
            </p>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-2">
            {steps.map((step, idx) => {
              const Icon = STEP_META[step.id].icon;
              const copy = stepCopy[step.id];
              const handler = handlers[step.id];
              return (
                <React.Fragment key={step.id}>
                  {idx > 0 && (
                    <ChevronRight size={13} className="text-slate-400 dark:text-slate-600" />
                  )}
                  <div className="flex items-center gap-1.5">
                    {step.done ? (
                      <CheckCircle2
                        size={14}
                        data-testid={`journey-done-${step.id}`}
                        className="text-teal-600 dark:text-teal-400"
                      />
                    ) : (
                      <Icon
                        size={14}
                        className={
                          step.current
                            ? 'text-teal-700 dark:text-teal-300'
                            : 'text-slate-500 dark:text-slate-400'
                        }
                      />
                    )}
                    <span
                      className={`text-xs ${
                        step.done
                          ? 'text-slate-500 dark:text-slate-400 line-through decoration-slate-300 dark:decoration-navy-600'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {copy.title}
                    </span>
                    {!step.done && handler && (
                      <button
                        type="button"
                        data-testid={`journey-cta-${step.id}`}
                        onClick={handler}
                        className={
                          step.current
                            ? 'rounded-lg bg-teal-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-teal-700 transition-colors'
                            : 'rounded-lg border border-slate-300/70 dark:border-navy-600 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors'
                        }
                      >
                        {copy.cta}
                      </button>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          aria-label={t('common.dismiss', 'Zamknij')}
          data-testid="journey-dismiss"
          onClick={onDismiss}
          className="shrink-0 rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default InitiativeDraftJourney;
