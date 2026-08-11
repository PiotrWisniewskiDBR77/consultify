/**
 * TeresaUnavailableNotice — the "AI degraded, manual workflow continues" state.
 *
 * Tor PLATFORMY (rn-g3-lane-platform2, 2026-08-11), punkt zakresu 4 „Wspólne
 * stany zapisu". `06_ACCEPTANCE_AND_VERIFICATION_HANDBOOK.md` §12 (Honest
 * state matrix) wymaga dla każdej domeny osobno: „Teresa unavailable z pełną
 * manualną ścieżką". §9 dodaje: „degraded path: brak Teresy nie blokuje
 * manualnego workflow". Zanim ten plik powstał, żaden współdzielony
 * komponent tego nie niósł — trzy istniejące, ad-hoc realizacje
 * (`DecisionsPanelContent.tsx`, `DecisionPreviewPanel.tsx`) to jednorazowe
 * toasty „AI unavailable" bez żadnej wzmianki o tym, że manualna ścieżka
 * nadal działa, i bez wspólnego wyglądu.
 *
 * Sąsiaduje z `SaveState.tsx` (saving/saved/error/conflict/forbidden) —
 * razem kompletują słownik „stanów pisania" wymagany przez zadanie: saving,
 * saved, save failed, stale/conflict (409), Teresa unavailable. To NIE jest
 * stan `SaveStatus`: Teresa może być niedostępna niezależnie od tego, czy
 * ekran ma cokolwiek do zapisania — dlatego osobny, mniejszy prymityw, a nie
 * siódma wartość w `SaveStatus`.
 *
 * Ton jest CELOWO informacyjny (neutralny/muted), nie ostrzegawczy: to nie
 * jest błąd użytkownika ani utrata danych — praca manualna jest w pełni
 * dostępna. `role="status"` + `aria-live="polite"`, NIE `alert`/`assertive`.
 *
 * Colors use the app CSS token layer (var(--c-*)); light/dark automatic.
 * Zero crimson — Teresa niedostępna to informacja, nie stan krytyczny.
 */

import { RefreshCw, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface TeresaUnavailableNoticeProps {
  /** Attempt to reconnect. Renders a "Try again" affordance when provided. */
  onRetry?: () => void;
  /** Override the default explanation sentence. */
  description?: string;
  /** Reduce to a single inline line for tight spaces (panel section, pill row). */
  compact?: boolean;
  className?: string;
}

/**
 * Inline/banner notice: Teresa (AI) is unreachable right now, but the manual
 * workflow on this screen is NOT blocked. Callers keep their manual actions
 * enabled — this component only announces the degradation, it never disables
 * anything by itself.
 */
export const TeresaUnavailableNotice: React.FC<TeresaUnavailableNoticeProps> = ({
  onRetry,
  description,
  compact = false,
  className = '',
}) => {
  const { t } = useTranslation();

  const title = t('state.teresa.unavailableTitle', { defaultValue: 'Teresa is unavailable' });
  const body =
    description ??
    t('state.teresa.unavailableDescription', {
      defaultValue: 'AI suggestions are paused. You can keep working manually.',
    });

  return (
    <div
      role="status"
      aria-live="polite"
      data-state="teresa-unavailable"
      className={`flex items-start gap-2.5 rounded-token-md border border-[var(--c-border-subtle)] bg-[var(--c-surface-raised)] px-3 ${
        compact ? 'py-2' : 'py-3'
      } ${className}`.trim()}
    >
      <Sparkles size={16} className="mt-0.5 shrink-0 text-[var(--c-text-muted)]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--c-text)]">{title}</p>
        {!compact && <p className="mt-0.5 text-xs text-[var(--c-text-muted)]">{body}</p>}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-token-md border border-[var(--c-border)] bg-[var(--c-surface)] px-2.5 py-1 text-xs font-medium text-[var(--c-text)] transition-colors hover:bg-[var(--c-surface-raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
        >
          <RefreshCw size={12} aria-hidden />
          {t('common.retry', { defaultValue: 'Try again' })}
        </button>
      )}
    </div>
  );
};

TeresaUnavailableNotice.displayName = 'TeresaUnavailableNotice';

export default TeresaUnavailableNotice;
