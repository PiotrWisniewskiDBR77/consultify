/**
 * SaveState — the write half of UI-STATE-01 (finding M02-011).
 *
 * `EmptyState` / `ErrorState` / `LoadingState` cover READ outcomes. Nothing in
 * the shared library covered WRITE outcomes, so every surface invented its own
 * (a toast here, a disabled button there, silence elsewhere). This adds the
 * missing vocabulary — and only this vocabulary:
 *
 *   idle       nothing pending — render nothing at all
 *   saving     a write is in flight (actions must be disabled by the caller)
 *   saved      the write is committed AND was read back; shows when
 *   error      the write failed and can be retried without duplicating
 *   conflict   someone else wrote first; the only safe exit is reload-latest
 *   forbidden  the write was refused by policy — retry cannot help
 *
 * Two rules, both learned the hard way:
 *   1. `saved` means COMMITTED, not "the request returned". Callers must set it
 *      after a fresh read-back, never optimistically.
 *   2. `description` is a human sentence. Never interpolate `Error.message`,
 *      a payload, or an object — that is how `[object Object]` reached users.
 *
 * Colors come from the app CSS token layer (var(--c-*)); light/dark automatic.
 * `c-danger` is used only for genuinely failed writes — never as decoration.
 */

import { AlertTriangle, Check, Loader2, Lock, RefreshCw, RotateCw } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict' | 'forbidden';

export interface SaveStateIndicatorProps {
  status: SaveStatus;
  /** When the committed value was last read back. Rendered next to "Saved". */
  savedAt?: Date | string | null;
  /**
   * Retry the same write. Only offered for `error` — a conflict needs a
   * reload, and a forbidden write cannot be retried into success.
   */
  onRetry?: () => void;
  /** Reload the server's current value. Only offered for `conflict`. */
  onReload?: () => void;
  /** Override the default sentence for the current status. */
  description?: string;
  className?: string;
}

const TONE: Record<Exclude<SaveStatus, 'idle'>, string> = {
  saving: 'text-[var(--c-text-muted)]',
  saved: 'text-[var(--c-success)]',
  error: 'text-[var(--c-danger)]',
  conflict: 'text-[var(--c-warning)]',
  forbidden: 'text-[var(--c-text-muted)]',
};

const formatSavedAt = (value: Date | string | null | undefined, locale: string): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
};

/**
 * Inline write-status pill. Renders `null` for `idle` so callers can mount it
 * unconditionally without reserving space.
 */
export const SaveStateIndicator: React.FC<SaveStateIndicatorProps> = ({
  status,
  savedAt,
  onRetry,
  onReload,
  description,
  className = '',
}) => {
  const { t, i18n } = useTranslation();
  if (status === 'idle') return null;

  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  const savedAtLabel = formatSavedAt(savedAt, locale);

  const label = {
    saving: t('state.save.saving', { defaultValue: 'Saving…' }),
    saved: savedAtLabel
      ? t('state.save.savedAt', { defaultValue: 'Saved {{time}}', time: savedAtLabel })
      : t('state.save.saved', { defaultValue: 'Saved' }),
    error: t('state.save.failed', { defaultValue: 'Not saved' }),
    conflict: t('state.save.conflict', { defaultValue: 'Changed elsewhere' }),
    forbidden: t('state.save.forbidden', { defaultValue: 'Not permitted' }),
  }[status];

  const Icon = {
    saving: Loader2,
    saved: Check,
    error: AlertTriangle,
    conflict: RefreshCw,
    forbidden: Lock,
  }[status];

  const isProblem = status === 'error' || status === 'conflict' || status === 'forbidden';

  return (
    <span
      role="status"
      aria-live={isProblem ? 'assertive' : 'polite'}
      data-save-status={status}
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${TONE[status]} ${className}`.trim()}
    >
      <Icon size={14} className={status === 'saving' ? 'animate-spin' : ''} aria-hidden />
      <span>{label}</span>
      {description && <span className="text-[var(--c-text-muted)]">· {description}</span>}

      {status === 'error' && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="ml-1 inline-flex items-center gap-1 rounded-token-md border border-[var(--c-border)] px-2 py-0.5 text-[var(--c-text)] transition-colors hover:bg-[var(--c-surface-raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
        >
          <RotateCw size={12} aria-hidden />
          {t('common.retry', { defaultValue: 'Try again' })}
        </button>
      )}

      {status === 'conflict' && onReload && (
        <button
          type="button"
          onClick={onReload}
          className="ml-1 inline-flex items-center gap-1 rounded-token-md border border-[var(--c-border)] px-2 py-0.5 text-[var(--c-text)] transition-colors hover:bg-[var(--c-surface-raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
        >
          <RefreshCw size={12} aria-hidden />
          {t('state.save.reloadLatest', { defaultValue: 'Load latest' })}
        </button>
      )}
    </span>
  );
};

SaveStateIndicator.displayName = 'SaveStateIndicator';

export interface ConflictBannerProps {
  /** Who/what won the race, if the server told us. Plain text only. */
  changedBy?: string;
  changedAt?: Date | string | null;
  /** Discard the local draft and load the server's current value. */
  onReload: () => void;
  className?: string;
}

/**
 * Full-width conflict notice for a surface whose write lost a race.
 *
 * Deliberately offers ONE exit: load the latest. "Overwrite anyway" is not
 * offered here because this shell is shared and cannot know whether clobbering
 * the other write is recoverable — a surface that can genuinely merge should
 * render its own affordance next to this banner.
 */
export const ConflictBanner: React.FC<ConflictBannerProps> = ({
  changedBy,
  changedAt,
  onReload,
  className = '',
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  const when = formatSavedAt(changedAt, locale);

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-state="conflict"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-token-md border border-[var(--c-warning)]/30 bg-[var(--c-warning)]/10 px-4 py-3 ${className}`.trim()}
    >
      <div className="flex items-start gap-2.5">
        <RefreshCw size={16} className="mt-0.5 shrink-0 text-[var(--c-warning)]" aria-hidden />
        <div>
          <p className="text-sm font-medium text-[var(--c-text)]">
            {t('state.conflict.title', { defaultValue: 'This was changed somewhere else' })}
          </p>
          <p className="text-xs text-[var(--c-text-muted)]">
            {changedBy || when
              ? t('state.conflict.byAt', {
                  defaultValue: 'Last change: {{who}}{{when}}',
                  who:
                    changedBy || t('state.conflict.someoneElse', { defaultValue: 'another user' }),
                  when: when ? ` · ${when}` : '',
                })
              : t('state.conflict.description', {
                  defaultValue: 'Load the latest version before saving again.',
                })}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onReload}
        className="inline-flex items-center gap-2 rounded-token-md bg-[var(--c-text)] px-3 py-1.5 text-sm font-medium text-[var(--c-surface)] transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-surface)]"
      >
        {t('state.save.reloadLatest', { defaultValue: 'Load latest' })}
      </button>
    </div>
  );
};

ConflictBanner.displayName = 'ConflictBanner';
