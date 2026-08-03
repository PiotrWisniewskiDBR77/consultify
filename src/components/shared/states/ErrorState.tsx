/**
 * ErrorState — Systemic "the load/action failed" placeholder (VEGAS V7.1)
 *
 * A full-surface error state paired with an EXIT: retry the operation and/or
 * step back to somewhere safe. Distinct from `EmptyState variant="error"`
 * (which is for lists/panels that render inline alongside a filter bar) —
 * `ErrorState` is for whole-surface failures (a record/canvas/deck failed to
 * load entirely) where the user needs a clear way out, not just a retry.
 *
 * HARD RULE: `description` must be a short, human-authored sentence — NEVER
 * interpolate a raw `Error.message`, stack trace, or `[object Object]` into
 * it. There is deliberately no `error`/`err` prop here so call sites are not
 * tempted to pass the raw exception through; log the real error elsewhere
 * (telemetry/console) and pass a calm, specific sentence to this component.
 *
 * Colors use the app CSS token layer (var(--c-*)); light/dark are automatic.
 * NEVER use the brand crimson accent token for the actions here — crimson is
 * reserved for deliberate brand moments, not default CTAs. `c-danger` is
 * fine for the icon badge: that IS the critical semantic this state exists
 * to communicate.
 *
 * @example
 * <ErrorState
 *   title={t('initiative.loadFailed', 'Could not load this initiative')}
 *   description={t('initiative.loadFailedDesc', 'The record may have been moved or removed.')}
 *   onRetry={refetch}
 *   onBack={() => navigate(-1)}
 * />
 */

import { AlertTriangle, ArrowLeft, RotateCw } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface ErrorStateProps {
  /** Thesis headline — states what failed, not "Error". */
  title?: string;
  /** One human-authored sentence. NEVER a raw exception message. */
  description?: string;
  /** Retry handler — renders as the primary (neutral filled) action. */
  onRetry?: () => void;
  /** Override the default "Try again" label. */
  retryLabel?: string;
  /** Exit handler — go back / leave this screen. Renders as a secondary action. */
  onBack?: () => void;
  /** Override the default "Go back" label. */
  backLabel?: string;
  /** Reduce vertical padding for inline / in-panel usage. */
  compact?: boolean;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  description,
  onRetry,
  retryLabel,
  onBack,
  backLabel,
  compact = false,
  className = '',
}) => {
  const { t } = useTranslation();
  const heading = title ?? t('common.errorTitle', { defaultValue: 'Something went wrong' });

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'px-4 py-8' : 'px-8 py-16'
      } ${className}`.trim()}
    >
      <div
        className={`flex items-center justify-center rounded-token-lg bg-[var(--c-danger)]/12 text-[var(--c-danger)] ${
          compact ? 'mb-3 h-11 w-11' : 'mb-5 h-16 w-16'
        }`}
      >
        <AlertTriangle size={compact ? 22 : 30} aria-hidden />
      </div>

      <h3
        className={`font-semibold text-[var(--c-text)] ${compact ? 'mb-1 text-base' : 'mb-2 text-lg'}`}
      >
        {heading}
      </h3>

      {description && (
        <p className={`max-w-sm text-[var(--c-text-muted)] ${compact ? 'text-sm' : 'text-[15px]'}`}>
          {description}
        </p>
      )}

      {(onRetry || onBack) && (
        <div
          className={`flex flex-wrap items-center justify-center gap-3 ${compact ? 'mt-4' : 'mt-6'}`}
        >
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-token-md border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-2 text-sm font-medium text-[var(--c-text)] transition-colors hover:bg-[var(--c-surface-raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-surface)]"
            >
              <ArrowLeft size={16} aria-hidden />
              {backLabel ?? t('common.goBack', { defaultValue: 'Go back' })}
            </button>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-token-md bg-[var(--c-text)] px-4 py-2 text-sm font-medium text-[var(--c-surface)] transition-colors hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-surface)]"
            >
              <RotateCw size={16} aria-hidden />
              {retryLabel ?? t('common.retry', { defaultValue: 'Try again' })}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

ErrorState.displayName = 'ErrorState';

export default ErrorState;
