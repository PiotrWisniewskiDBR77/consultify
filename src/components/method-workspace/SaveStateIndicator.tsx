/**
 * SaveStateIndicator — renders the `MethodSaveState` machine as a Header/bottom
 * status pill, with the Retry/Stay choice for `SAVE_FAILED` (TOOL-SESSION §6.3.7).
 *
 * Crimson-safe: SAVE_FAILED uses `c-danger` (the one place red is semantic —
 * a save failure is a real blocker). Everything else is neutral/`c-info`/`c-success`.
 */
import { AlertTriangle, Check, CloudOff, Loader2, PencilLine } from 'lucide-react';
import React from 'react';

import type { MethodSaveState } from '@/method-core/contracts';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export interface SaveStateIndicatorProps {
  state: MethodSaveState;
  lastSavedAt: string | null;
  errorMessage?: string | null;
  onSaveNow?: () => void;
  onRetry?: () => void;
  onStay?: () => void;
  /** Compact = icon + short label only (Header). Default full label (bottom bar). */
  compact?: boolean;
  /**
   * Whether this instance announces state changes via `aria-live` (default true).
   * The shell renders this component twice (header + bottom bar) for the SAME
   * state — pass `false` on one of the two so screen reader users hear the
   * change once, not twice.
   */
  announce?: boolean;
  className?: string;
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export const SaveStateIndicator: React.FC<SaveStateIndicatorProps> = ({
  state,
  lastSavedAt,
  errorMessage,
  onSaveNow,
  onRetry,
  onStay,
  compact = false,
  announce = true,
  className = '',
}) => {
  const prefersReducedMotion = useReducedMotion();
  const base = 'inline-flex items-center gap-1.5 text-xs font-medium';

  let icon: React.ReactNode;
  let label: string;
  let tone = 'text-c-text-muted';

  switch (state) {
    case 'CLEAN':
      icon = <Check size={13} />;
      label = compact ? 'Zapisano' : lastSavedAt ? `Zapisano ${formatTime(lastSavedAt)}` : 'Zapisano';
      tone = 'text-c-text-muted';
      break;
    case 'SAVED':
      icon = <Check size={13} className="text-c-success" />;
      label = lastSavedAt ? `Zapisano ${formatTime(lastSavedAt)}` : 'Zapisano';
      tone = 'text-c-success';
      break;
    case 'DIRTY':
      icon = <PencilLine size={13} />;
      label = 'Niezapisane zmiany';
      tone = 'text-c-warning';
      break;
    case 'SAVING':
      icon = <Loader2 size={13} className={prefersReducedMotion ? '' : 'animate-spin'} />;
      label = 'Zapisywanie…';
      tone = 'text-c-info';
      break;
    case 'SAVE_FAILED':
      icon = <AlertTriangle size={13} />;
      label = 'Zapis nieudany';
      tone = 'text-c-danger';
      break;
    case 'OFFLINE_PENDING':
      icon = <CloudOff size={13} />;
      label = 'Offline — w kolejce';
      tone = 'text-c-warning';
      break;
    default:
      icon = null;
      label = '';
  }

  return (
    <div
      role="status"
      aria-live={announce ? 'polite' : 'off'}
      aria-atomic="true"
      className={`${base} ${tone} ${className}`}
      data-testid="save-state-indicator"
      data-state={state}
    >
      {icon}
      <span>{label}</span>
      {!compact && state === 'DIRTY' && onSaveNow && (
        <button
          type="button"
          onClick={onSaveNow}
          className="ml-1 rounded px-1.5 py-0.5 text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          Zapisz teraz
        </button>
      )}
      {state === 'SAVE_FAILED' && errorMessage && (
        <span className="text-c-text-muted font-normal">— {errorMessage}</span>
      )}
      {state === 'SAVE_FAILED' && (onRetry || onStay) && (
        <span className="ml-1 flex items-center gap-1">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded px-1.5 py-0.5 text-c-danger hover:bg-c-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              Spróbuj ponownie
            </button>
          )}
          {onStay && (
            <button
              type="button"
              onClick={onStay}
              className="rounded px-1.5 py-0.5 text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              Zostań
            </button>
          )}
        </span>
      )}
    </div>
  );
};

export default SaveStateIndicator;
