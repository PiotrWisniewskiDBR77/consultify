/**
 * PreviewPaneAside — kontener bocznego podglądu (blok 1–6 stoi w środku).
 *
 * ── PO CO TO ISTNIEJE ──────────────────────────────────────────────────────
 *
 * `TABLE_AND_PREVIEW_CANON.md` §7.2 mówi wprost: **wymiar pochodzi WYŁĄCZNIE
 * z komponentu** — „szerokość i odstęp ustawia `StandardPreview` /
 * `PreviewPaneShell`. Ekran ich **nie nadpisuje**", a `w-[420px]`/`w-[360px]`/
 * `w-[460px]` są wymienione z nazwy jako zakaz.
 *
 * W praktyce żaden komponent tej szerokości nie ustawiał. `StandardPreview`
 * renderuje `PreviewPaneShell`, który jest `h-full flex flex-col` — czyli
 * wypełnia to, co dostanie. Wymiar musiał więc wymyślić KAŻDY ekran osobno,
 * i wymyślał: przegląd 2026-08-30 znalazł `<aside className="w-[400px] …">`
 * w Assessment (Hub ×3, Outputs ×2, Library ×1), Results, ReportBuilder,
 * SuperAdmin i CaseWorkspace. Kanon zakazywał czynności, do której nie dawał
 * alternatywy — a taki zakaz jest zawsze przegrany.
 *
 * Ten komponent jest tą alternatywą. Ekran deklaruje „tu jest podgląd";
 * szerokość (`PREVIEW_PANE_WIDTH` = `clamp(340px, 28%, 480px)`, złożona
 * z `CANON_PREVIEW`, nie z literału), padding wrappera i powierzchnia
 * przychodzą stąd. Separacja od tabeli to `gap-1.5` rodzica, **bez
 * `border-l`** (§7.2).
 *
 * `TableWithPreviewLayout` ma tę geometrię wbudowaną u siebie i NIE potrzebuje
 * tego wrappera — jest dla ekranów, które montują `StandardPreview` obok
 * własnej `StandardTable`.
 *
 * @module components/shared/PreviewPane/PreviewPaneAside
 */

import React from 'react';

import { PREVIEW_PANE_WIDTH } from './previewGeometry';

export interface PreviewPaneAsideProps {
  children: React.ReactNode;
  /** Etykieta dla czytników ekranu (region podglądu). */
  ariaLabel?: string;
  /** Dodatkowe klasy — NIE do ustawiania szerokości (§7.2). */
  className?: string;
}

export const PreviewPaneAside: React.FC<PreviewPaneAsideProps> = ({
  children,
  ariaLabel,
  className = '',
}) => (
  <aside
    aria-label={ariaLabel}
    data-preview-pane
    className={`shrink-0 overflow-hidden bg-slate-50 p-3 dark:bg-navy-950 ${className}`.trim()}
    style={{ width: PREVIEW_PANE_WIDTH }}
  >
    {children}
  </aside>
);

export default PreviewPaneAside;
