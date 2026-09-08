/**
 * SaveStateIndicator — renders the `MethodSaveState` machine as a Header/bottom
 * status pill, with the Retry/Stay choice for `SAVE_FAILED` (TOOL-SESSION §6.3.7).
 *
 * Crimson-safe: SAVE_FAILED uses `c-danger` (the one place red is semantic —
 * a save failure is a real blocker). Everything else is neutral/`c-info`/`c-success`.
 */
import { AlertTriangle, Check, CloudOff, Loader2, PencilLine } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { MethodSaveState } from '@/method-core/contracts';
import { formatListTime } from '@/utils/listDateFormat';

export interface SaveStateIndicatorProps {
  state: MethodSaveState;
  lastSavedAt: string | null;
  errorMessage?: string | null;
  onSaveNow?: () => void;
  onRetry?: () => void;
  onStay?: () => void;
  /** Compact = icon + short label only (Header). Default full label (bottom bar). */
  compact?: boolean;
  className?: string;
}

/**
 * Godzina zapisu przez SSOT `listDateFormat` — locale idzie z języka konta.
 * Wcześniej stało tu `toLocaleTimeString('pl-PL')`, więc użytkownik EN widział
 * polski zapis godziny (K7).
 */
function formatTime(iso: string | null): string {
  if (!iso) return '';
  const wynik = formatListTime(iso, '');
  return wynik;
}

export const SaveStateIndicator: React.FC<SaveStateIndicatorProps> = ({
  state,
  lastSavedAt,
  errorMessage,
  onSaveNow,
  onRetry,
  onStay,
  compact = false,
  className = '',
}) => {
  const { t } = useTranslation();
  const base = 'inline-flex items-center gap-1.5 text-xs font-medium';

  let icon: React.ReactNode;
  let label: string;
  let tone = 'text-c-text-muted';

  switch (state) {
    case 'CLEAN':
      icon = <Check size={13} />;
      label =
        compact || !lastSavedAt
          ? t('methodWorkspace.saveState.saved', 'Saved')
          : t('methodWorkspace.saveState.savedAt', 'Saved {{time}}', { time: formatTime(lastSavedAt) });
      tone = 'text-c-text-muted';
      break;
    case 'SAVED':
      icon = <Check size={13} className="text-c-success" />;
      label = lastSavedAt
        ? t('methodWorkspace.saveState.savedAt', 'Saved {{time}}', { time: formatTime(lastSavedAt) })
        : t('methodWorkspace.saveState.saved', 'Saved');
      tone = 'text-c-success';
      break;
    case 'DIRTY':
      icon = <PencilLine size={13} />;
      label = t('methodWorkspace.saveState.dirty', 'Unsaved changes');
      tone = 'text-c-warning';
      break;
    case 'SAVING':
      icon = <Loader2 size={13} className="animate-spin" />;
      label = t('methodWorkspace.saveState.saving', 'Saving…');
      tone = 'text-c-info';
      break;
    case 'SAVE_FAILED':
      icon = <AlertTriangle size={13} />;
      label = t('methodWorkspace.saveState.failed', 'Save failed');
      tone = 'text-c-danger';
      break;
    case 'OFFLINE_PENDING':
      icon = <CloudOff size={13} />;
      label = t('methodWorkspace.saveState.offlineQueued', 'Offline — queued');
      tone = 'text-c-warning';
      break;
    default:
      icon = null;
      label = '';
  }

  return (
    <div className={`${base} ${tone} ${className}`} data-testid="save-state-indicator" data-state={state}>
      {icon}
      <span>{label}</span>
      {!compact && state === 'DIRTY' && onSaveNow && (
        <button
          type="button"
          onClick={onSaveNow}
          className="ml-1 rounded px-1.5 py-0.5 text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          {t('methodWorkspace.saveState.saveNow', 'Save now')}
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
              {t('methodWorkspace.saveState.retry', 'Try again')}
            </button>
          )}
          {onStay && (
            <button
              type="button"
              onClick={onStay}
              className="rounded px-1.5 py-0.5 text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {t('methodWorkspace.saveState.stay', 'Stay')}
            </button>
          )}
        </span>
      )}
    </div>
  );
};

export default SaveStateIndicator;
