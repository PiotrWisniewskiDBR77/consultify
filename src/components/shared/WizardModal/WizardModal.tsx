/**
 * WizardModal — the CANONICAL wizard shell for the platform (§5 / §5b).
 *
 * The platform currently ships THREE wizards that should look and behave
 * identically inside one consistent, managed-color frame (owner's principle #1):
 *
 *   1. Survey wizard      (Interview / template builder flow)
 *   2. InsightCreatorModal (src/components/Interview/InsightCreatorModal.tsx)
 *   3. InitiativeWizardModal (src/components/Initiatives/Wizard/InitiativeWizardModal.tsx)
 *
 * Today each of those re-implements its own modal chrome, stepper header and
 * footer. This component is the single source of truth for that chrome:
 *   - modal overlay + centered, rounded-2xl, backdrop-blurred panel
 *   - a §5b header with a progress bar + clickable, numbered step pills
 *     (current highlighted, complete = check, future = muted)
 *   - a canonical "this step is empty until you generate" placeholder driven by
 *     step.status === 'empty'
 *   - a Back / Next / Complete footer with sensible enable/disable + a spinner
 *     on Complete while `completing`
 *   - full bilingual (en/pl) copy and a11y (aria-current, Esc-to-close, dialog
 *     role + labelling)
 *
 * It accepts a managed `accentColor` so survey / insight / initiative can carry
 * different accents WITHOUT diverging on layout.
 *
 * STATUS: this is a NEW, additive canon component. It is intentionally NOT yet
 * wired into the three existing wizards — migrating each wizard to adopt this
 * shell (lifting their step state into the controlled `activeStepIndex` /
 * `onStepChange` props and moving step bodies into `WizardStep.content`) is a
 * deliberate FOLLOW-UP task, kept separate so this extraction stays mechanical.
 *
 * NOTE: inline `style` is used deliberately for the managed `accentColor`
 * (a runtime value with no static Tailwind token), so the repo's no-inline-style
 * rule is disabled at file scope.
 */
/* eslint-disable no-restricted-syntax */
import { Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { WizardModalProps } from './types';
import { CREATOR_SHELL_GEOMETRY } from './geometry';
import { WizardStepper } from './WizardStepper';
import './creatorShell.css';

/** Default accent: the app primary token (matches the existing wizards). */
const DEFAULT_ACCENT = 'rgb(var(--color-primary-600, 79 70 229))';

const COPY = {
  cancel: { en: 'Cancel', pl: 'Anuluj' },
  back: { en: 'Back', pl: 'Wstecz' },
  next: { en: 'Next', pl: 'Dalej' },
  complete: { en: 'Complete', pl: 'Zakończ' },
  working: { en: 'Working…', pl: 'Pracuję…' },
  close: { en: 'Close', pl: 'Zamknij' },
  emptyStep: {
    en: 'This step is empty until you generate.',
    pl: 'Ten krok jest pusty, dopóki nie wygenerujesz.',
  },
} as const;

export const WizardModal: React.FC<WizardModalProps> = ({
  geometry = 'legacy',
  creatorSubtitle,
  creatorHeaderStatus,
  creatorScopeSummary,
  open,
  onClose,
  title,
  steps,
  activeStepIndex,
  onStepChange,
  onComplete,
  completing = false,
  footer,
  isPolish: isPolishProp,
  accentColor = DEFAULT_ACCENT,
  nextDisabled = false,
  children,
}) => {
  const { i18n } = useTranslation();
  // Self-localize unless the host forces a language.
  const isPolish = isPolishProp ?? i18n.language === 'pl';
  const geometryClassName =
    geometry === 'creator'
      ? CREATOR_SHELL_GEOMETRY.stepped.panelClassName
      : CREATOR_SHELL_GEOMETRY.legacy.panelClassName;

  const panelRef = useRef<HTMLDivElement | null>(null);
  const [reducedTransparency, setReducedTransparency] = React.useState(false);

  useEffect(() => {
    if (geometry !== 'creator' || typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-reduced-transparency: reduce)');
    const sync = () => setReducedTransparency(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, [geometry]);

  const total = steps.length;
  const safeIndex = Math.min(Math.max(activeStepIndex, 0), Math.max(total - 1, 0));
  const activeStep = steps[safeIndex];
  const isFirstStep = safeIndex <= 0;
  const isLastStep = safeIndex >= total - 1;

  // Reachability gate: the user may jump to any already-visited or active step,
  // plus the immediate next one. This keeps the canon honest (you can't skip
  // ahead past where you've reached) while staying friendly.
  const maxReachableIndex = Math.min(safeIndex + 1, Math.max(total - 1, 0));

  const tr = useCallback(
    (entry: { en: string; pl: string }) => (isPolish ? entry.pl : entry.en),
    [isPolish]
  );

  // Esc-to-close.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Move focus into the panel when it opens (basic focus management).
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const headingId = useMemo(
    () => `wizard-modal-title-${Math.random().toString(36).slice(2, 9)}`,
    []
  );

  const goBack = useCallback(() => {
    if (!isFirstStep) onStepChange(safeIndex - 1);
  }, [isFirstStep, onStepChange, safeIndex]);

  const goNext = useCallback(() => {
    if (isLastStep) {
      onComplete();
    } else {
      onStepChange(safeIndex + 1);
    }
  }, [isLastStep, onComplete, onStepChange, safeIndex]);

  if (!open) return null;

  const bodyContent = activeStep?.content ?? children;
  const showEmptyPlaceholder = activeStep?.status === 'empty' && !bodyContent;

  return (
    <div
      className={`fixed inset-0 z-overlay flex items-center justify-center ${geometry === 'creator' ? 'bg-[var(--creator-scrim)]' : 'bg-slate-950/55 backdrop-blur-sm'}`}
      onMouseDown={(event) => {
        // Overlay click (outside the panel) closes.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className={`mx-4 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 outline-none dark:border-white/[0.08] dark:bg-navy-900 ${geometry === 'creator' ? 'creator-shell' : ''} ${geometryClassName}`}
      >
        {/* Header */}
        <div
          data-creator-band={geometry === 'creator' ? 'header' : undefined}
          data-transparency={geometry === 'creator' && reducedTransparency ? 'opaque' : undefined}
          className={`flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/[0.08] ${geometry === 'creator' ? 'creator-glass-band h-[60px]' : ''}`}
        >
          <h2
            id={headingId}
            className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            <span
              aria-hidden="true"
              className="inline-block h-5 w-1.5 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
            <span className="min-w-0">
              <span className="block">{tr(title)}</span>
              {geometry === 'creator' && creatorSubtitle ? (
                <span className="block truncate text-xs font-normal text-c-text-muted">
                  {creatorSubtitle}
                </span>
              ) : null}
            </span>
          </h2>
          {geometry === 'creator' && creatorHeaderStatus ? (
            <div className="ml-auto mr-2">{creatorHeaderStatus}</div>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label={tr(COPY.close)}
            className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-100"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* §5b — progress bar + clickable step pills */}
        <div
          data-creator-band={geometry === 'creator' ? 'steps' : undefined}
          data-transparency={geometry === 'creator' && reducedTransparency ? 'opaque' : undefined}
          className={geometry === 'creator' ? 'creator-glass-band h-[70px] shrink-0' : ''}
        >
          <WizardStepper
            steps={steps}
            activeStepIndex={safeIndex}
            maxReachableIndex={maxReachableIndex}
            onStepChange={onStepChange}
            isPolish={isPolish}
            accentColor={geometry === 'creator' ? 'var(--c-cta-bg)' : accentColor}
          />
        </div>

        {geometry === 'creator' ? (
          <div
            data-creator-band="scope"
            data-transparency={reducedTransparency ? 'opaque' : undefined}
            className="creator-glass-band flex h-[36px] shrink-0 items-center gap-2 border-b px-5 text-xs text-c-text-secondary"
          >
            {creatorScopeSummary}
          </div>
        ) : null}

        {/* Body — the active step's content (or the canonical empty placeholder) */}
        <div
          data-creator-scroll={geometry === 'creator' ? 'content' : undefined}
          className={
            geometry === 'creator'
              ? 'min-h-0 flex-1 overflow-hidden bg-c-surface'
              : 'flex-1 space-y-4 overflow-auto p-3'
          }
        >
          {showEmptyPlaceholder ? (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center dark:border-white/[0.12] dark:bg-navy-900/40">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {tr(COPY.emptyStep)}
              </p>
              {activeStep?.hint ? (
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  {isPolish ? activeStep.hint.pl : activeStep.hint.en}
                </p>
              ) : null}
            </div>
          ) : (
            bodyContent
          )}
        </div>

        {/* Footer */}
        {footer ?? (
          <div
            data-creator-band={geometry === 'creator' ? 'footer' : undefined}
            data-transparency={geometry === 'creator' && reducedTransparency ? 'opaque' : undefined}
            className={`flex shrink-0 items-center gap-3 border-t border-slate-200 p-3 dark:border-white/[0.08] ${geometry === 'creator' ? 'creator-glass-band h-[70px]' : ''}`}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={completing}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-white/[0.1] dark:bg-navy-900 dark:text-slate-300 dark:hover:bg-white/[0.06]"
            >
              {tr(COPY.cancel)}
            </button>
            <div className="flex-1" />
            {!isFirstStep && (
              <button
                type="button"
                onClick={goBack}
                disabled={completing}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-white/[0.1] dark:bg-navy-900 dark:text-slate-300 dark:hover:bg-white/[0.06]"
              >
                {tr(COPY.back)}
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              disabled={nextDisabled || completing}
              className="flex min-w-[150px] items-center justify-center gap-2 rounded-xl px-4 py-2 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: accentColor }}
            >
              {isLastStep ? (
                completing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {tr(COPY.working)}
                  </>
                ) : (
                  tr(COPY.complete)
                )
              ) : (
                tr(COPY.next)
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WizardModal;
