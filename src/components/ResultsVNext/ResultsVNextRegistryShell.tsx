/**
 * ResultsVNextRegistryShell — the ONE shared registry layout for every
 * RN-G2 domain (KPI / ROI / OKR). This is P0 of the RN-G2 work breakdown
 * (docs/product/results-vnext/RN_G2_UI_SCOPE.md §G) — the shell only, no
 * domain screens yet.
 *
 * Composes the Triada standard EXACTLY — StandardModuleBar (Menu 1/2/3, in
 * `children` mode) hosting a StandardTable + StandardPreview split, 1:1 with
 * the established pattern in `ReportsTabContent.tsx` / My Work Tasks
 * (`docs/ui-standards/TRIADA_KANON.md`). The shell does NOT reimplement any
 * of the three standard components' mechanics — it only wires their props
 * together and adds ONE thing none of them has on its own: a top-level
 * "forbidden" state that replaces the whole content area for a deep link to
 * a visibility-denied resource (§D).
 *
 * A future domain screen (P1's KPI registry, etc.) supplies only:
 *  - `moduleBar` — Menu 2/3 config (tabs/statusFilters/chips/bulk/...)
 *  - `table`     — columns/data/rowMenu/persistKey/... (StandardTableProps)
 *  - `preview`   — StandardPreviewProps for the selected row, or null/undefined
 *  - `forbidden` — set only when a deep link resolves to an ABAC DENY
 *
 * Loading/empty/error are NOT special-cased here — they are native to
 * `StandardTable` (`loading`/`empty`/`emptyMessage`/`error`+`onRetry`) and a
 * domain screen sets them directly on `table`, exactly like every other
 * StandardTable consumer in the repo. "Locked / lifecycle-gated" is per-row
 * (kebab `disabled`+`note`, see `LifecycleLockBadge.lockedRowMenuAction`) and
 * per-field (`HonestValueCell`) — also no shell-level special case needed.
 */

import React, { useEffect, useRef } from 'react';

import { PREVIEW_PANE_WIDTH } from '@/components/shared/PreviewPane/previewGeometry';
import {
  StandardModuleBar,
  type StandardModuleBarProps,
  StandardPreview,
  type StandardPreviewProps,
  StandardTable,
  type StandardTableProps,
} from '@/components/standard';

import type { ResultsVNextDomain, ResultsVNextForbiddenDetail } from './types';
import { ResultsVNextForbiddenState } from './ResultsVNextForbiddenState';

/** `persistKey` is REQUIRED here — RN-G2 must not silently fall back to an
 * unnamespaced key. See RN_G2_UI_SCOPE.md §H "collision trap": legacy
 * KPI/ROI/OKR already occupy `results.kpi-scorecards` / `results.roi-reviews`
 * / `results.okr-sets` (T36-T38 in the closed TableSurfaceId union) — RN-G2's
 * keys MUST be distinct or column-layout localStorage state corrupts both
 * screens. Every RN-G2 domain page in this package uses a
 * `results-vnext.<domain>-registry` key (see ResultsKpi/Roi/OkrRegistryPage.tsx).
 */
export type ResultsVNextTableProps = StandardTableProps & { persistKey: string };

export interface ResultsVNextRegistryShellProps {
  /** Used for `data-testid`/ARIA labelling only — no behavioral branching. */
  domain: ResultsVNextDomain;
  /** Menu 1/2/3 — everything StandardModuleBar takes except `children`. */
  moduleBar: Omit<StandardModuleBarProps, 'children'>;
  /** The registry table — columns/data/rowMenu/persistKey/loading/empty/error. */
  table: ResultsVNextTableProps;
  /** The row preview — omit/null when nothing is selected. */
  preview?: StandardPreviewProps | null;
  /**
   * Deep-link ABAC DENY (§D) — when set, replaces the ENTIRE content area
   * (table + preview) with the honest "you don't have access" state. Does
   * NOT affect the Menu 1/2/3 bar, which still orients the user.
   */
  forbidden?: ResultsVNextForbiddenDetail | null;
  onForbiddenBack?: () => void;
  className?: string;
}

export const ResultsVNextRegistryShell: React.FC<ResultsVNextRegistryShellProps> = ({
  domain,
  moduleBar,
  table,
  preview,
  forbidden,
  onForbiddenBack,
  className,
}) => {
  /**
   * Punkt zakresu 5 (tor PLATFORMY, 2026-08-11) — „Esc zamyka, focus wraca do
   * rekordu" (TRIADA §B pkt 24/42, `06_ACCEPTANCE_AND_VERIFICATION_HANDBOOK.md`
   * §10 Preview: „single-click otwiera, Esc zamyka i zwraca focus"). Zbadano:
   * ten wzorzec już istnieje jako R03-2 w `TableWithPreviewLayout.tsx`, ale ta
   * powłoka komponuje `StandardTable`+`StandardPreview` RĘCZNIE (linie ~99-121,
   * poza `TableWithPreviewLayout`), więc żadna z trzech domen RN-G2 (KPI/ROI/
   * OKR) nie dostawała Esc-to-close ani powrotu fokusu — potwierdzone czytaniem
   * `ResultsKpiRegistryPage.tsx`/`ResultsRoiRegistryPage.tsx`/
   * `ResultsOkrRegistryPage.tsx`: `onClose` tylko zeruje stan zaznaczenia,
   * zero listenera klawiatury, zero śledzenia elementu-otwieracza.
   *
   * Minimalna, wsteczna kompatybilna łatka na TYM poziomie (bez zmiany API
   * powłoki ani `StandardPreviewProps`): `preview.onClose` już istnieje jako
   * pole kontraktu — używamy go. Bez j/k nawigacji z R03-2 (powłoka nie ma
   * `itemIds`/`onSelect` — dodanie ich byłoby zmianą sygnatury, a ZASADY tego
   * zadania każą się zatrzymać i zgłosić zamiast tego, nie dopisywać propów).
   */
  const previewOpenerRef = useRef<HTMLElement | null>(null);
  const wasPreviewOpenRef = useRef(false);

  useEffect(() => {
    const isOpen = !!preview;
    if (isOpen && !wasPreviewOpenRef.current) {
      // Świeże otwarcie — zapamiętaj element, z którego przyszedł focus.
      const active = typeof document !== 'undefined' ? document.activeElement : null;
      if (active instanceof HTMLElement && active !== document.body) {
        previewOpenerRef.current = active;
      }
    } else if (!isOpen && wasPreviewOpenRef.current) {
      // Świeże zamknięcie (× albo Esc niżej) — oddaj focus, jeśli element żyje.
      const opener = previewOpenerRef.current;
      previewOpenerRef.current = null;
      if (opener && typeof document !== 'undefined' && document.contains(opener)) {
        opener.focus();
      }
    }
    wasPreviewOpenRef.current = isOpen;
  }, [preview]);

  useEffect(() => {
    if (!preview?.onClose) return;
    const onClose = preview.onClose;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [preview?.onClose]);

  return (
    <div
      className={className ?? 'h-full'}
      data-testid={`results-vnext-${domain}-registry-shell`}
      data-domain={domain}
    >
      <StandardModuleBar {...moduleBar}>
        {forbidden ? (
          <div className="h-full min-h-0 overflow-auto">
            <ResultsVNextForbiddenState forbidden={forbidden} onBack={onForbiddenBack} />
          </div>
        ) : (
          <div className="h-full flex overflow-hidden">
            <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
              <StandardTable {...table} />
            </div>
            {preview ? (
              // R09-1 (2026-08-10, defekt P1): TRIADA §C9 przepisuje
              // `clamp(340px, 28%, 480px)`, nie sztywny `w-[400px]`. Przy
              // sztywnym pikselu panel nie zwężał się razem z dostępną
              // szerokością (np. 125% zoom) — całość treści (właściwości,
              // NPV/IRR, akcje) była obcinana przez `overflow-hidden`
              // rodzica bez możliwości doscrollowania, bo panel po prostu
              // nie mieścił się w wierszu. `clamp()` (ta sama stała co w
              // `TableWithPreviewLayout`/`previewGeometry.ts`) skaluje
              // szerokość panelu razem z kontenerem, więc wiersz zawsze się
              // mieści; przy 1440px to ~403px — wizualnie nieodróżnialne od
              // poprzedniego 400px. Skrolowanie treści w pionie już działa
              // — `PreviewPaneShell` (pod `StandardPreview`) ma własny
              // `flex-1 overflow-y-auto` na body, to `overflow-hidden` tutaj
              // tnie tylko cień/róg karty, nie treść.
              <aside
                className="shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden"
                style={{ width: PREVIEW_PANE_WIDTH }}
              >
                <StandardPreview {...preview} />
              </aside>
            ) : null}
          </div>
        )}
      </StandardModuleBar>
    </div>
  );
};

export default ResultsVNextRegistryShell;
