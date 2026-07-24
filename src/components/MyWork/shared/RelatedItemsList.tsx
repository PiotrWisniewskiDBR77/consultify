/**
 * RelatedItemsList — JEDEN wzór listy powiązań w centrum karty n-Type.
 *
 * POWÓD (2026-07-24): sekcje „Wynika z" (Zadanie) i „Dotyczy" (Decyzja)
 * renderowały to samo DWOMA różnymi kawałkami JSX i obie pokazywały
 * właścicielowi surowe dane deweloperskie:
 *   · Zadanie:  `DECISION` + `decision-dbr77-demo-1`
 *   · Decyzja:  `TASK`     + `link-2`
 * Ten komponent zastępuje obie kopie: typ po polsku (mapa `linkedTypeLabel`),
 * tytuł obiektu zamiast identyfikatora.
 *
 * ZASADA „nie wymyślaj danych": gdy powiązanie nie niesie tytułu, pokazujemy
 * SAM typ — nigdy surowego id w zastępstwie tytułu.
 *
 * Wygląd: wyłącznie tokeny c-* (zero navy/slate/hex/crimson).
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

import { linkedTypeLabel } from '@/utils/enumLabels';

export interface RelatedItemEntry {
  /** Klucz Reacta — identyfikator obiektu. NIE jest renderowany. */
  id: string;
  /** Surowy typ obiektu ('task' | 'decision' | 'initiative' | 'insight' | …). */
  type?: string | null;
  /** Tytuł obiektu. Gdy pusty (albo równy id) — wiersz pokazuje sam typ. */
  title?: string | null;
}

const BADGE_CLASS =
  'inline-flex shrink-0 items-center px-2 py-0.5 rounded-md text-[10px] font-medium ' +
  'border border-c-border text-c-text-secondary bg-c-surface-raised';

export const RelatedItemsList: React.FC<{ items: RelatedItemEntry[] }> = ({ items }) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  return (
    <div className="space-y-1">
      {items.map((item) => {
        const label = linkedTypeLabel(item.type, isPolish);
        const rawTitle = String(item.title ?? '').trim();
        // Producenci bywają leniwi i podstawiają id pod tytuł — wtedy tytułu NIE MA.
        const title = rawTitle && rawTitle !== String(item.id) ? rawTitle : '';
        return (
          <div key={item.id} className="flex min-w-0 items-center gap-2 text-sm text-c-text">
            {label ? <span className={BADGE_CLASS}>{label}</span> : null}
            {title ? <span className="truncate">{title}</span> : null}
          </div>
        );
      })}
    </div>
  );
};

export default RelatedItemsList;
