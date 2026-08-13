/**
 * FinanceStatusAnnouncer — wspólny, zawsze zamontowany `role="status"`
 * (Pakiet I, wymaganie #7 „ogłaszanie stanów dynamicznych").
 *
 * Problem, który to naprawia: panele AP-CLIENT (compare/comments/saved
 * views/export-import/lineage) przełączają WIDOCZNĄ treść między
 * loading→error/loaded przez zwrócenie zupełnie INNEGO drzewa DOM z
 * warunkowego `return`. Nowo wstawiony węzeł z `aria-live` nie jest
 * niezawodnie ogłaszany przez czytniki ekranu (zależnie od przeglądarki/AT) —
 * dopiero ISTNIEJĄCY, stały węzeł live-region, którego TEKST się zmienia,
 * daje spójne ogłoszenie w NVDA/JAWS/VoiceOver.
 *
 * Renderuj `<StatusAnnouncer message={...} />` jako element-sibling przy
 * KAŻDYM warunkowym `return` (loading/error/loaded), nie tylko raz na końcu —
 * dzięki temu węzeł jest zamontowany od pierwszego renderu i tylko jego
 * tekst się zmienia między kolejnymi stanami.
 */
import React from 'react';

export interface FinanceStatusAnnouncerProps {
  message: string;
  /** `assertive` dla błędów/przerwań, `polite` (domyślnie) dla postępu/sukcesu. */
  priority?: 'polite' | 'assertive';
}

export function FinanceStatusAnnouncer({
  message,
  priority = 'polite',
}: FinanceStatusAnnouncerProps): React.ReactElement {
  return (
    <div
      role="status"
      aria-live={priority}
      className="sr-only"
      data-testid="finance-status-announcer"
    >
      {message}
    </div>
  );
}

export default FinanceStatusAnnouncer;
