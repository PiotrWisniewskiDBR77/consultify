/**
 * Dev-render host — PODGLĄD POMYSŁU, sufit stopki (zgłoszenie właściciela
 * „preview z tej tabeli nie jest zgodny ze wzorem", trzeci raz).
 *
 * NIE jest to re-implementacja podglądu. Montuje DOKŁADNIE tę kompozycję, którą
 * w produkcie robi `TableWithPreviewLayout` (linie 611-619): realny
 * `PreviewPaneShell` z realnym `IdeaPreviewBody` w treści i realnym
 * `IdeaPreviewFooter` w stopce, na kanonicznej szerokości panelu
 * (`PREVIEW_PANE_WIDTH`) i na wysokości ZMIERZONEJ na żywo (728 px).
 *
 * ?sufit=0 wyłącza sufit stopki (stan PRZED naprawą) — służy do pokazania
 * defektu obok naprawy na jednym obrazie. Wyłączenie jest realizowane
 * `maxHeight: 'none'` NA TYM SAMYM elemencie stopki, którym rządzi kanon; nie
 * ma tu drugiej, własnej powłoki.
 *
 * Zmierzone na produkcie (Moja Praca → Pomysły → klik w wiersz, 1440×900):
 *   PRZED: panel 728 = nagłówek 64 + treść 138 + stopka 500
 *   PO:    panel 728 = nagłówek 64 + treść 322 + stopka 316
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { IdeaPreviewBody, IdeaPreviewFooter } from '../../src/components/MyWork/IdeaPreview';
import type { MyIdea } from '../../src/components/MyWork/myIdeasTypes';
import { PREVIEW_PANE_WIDTH } from '../../src/components/shared/PreviewPane/previewGeometry';
import { PreviewPaneShell } from '../../src/components/ui/ResizableTable/PreviewPaneShell';

const params = new URLSearchParams(window.location.search);
const SUFIT = params.get('sufit') !== '0';

/** Wysokość panelu zmierzona na żywo w produkcie — nie liczba „ładna". */
const WYSOKOSC_PANELU = 728;

const POMYSL = {
  id: 'idea-devrender-1',
  title: 'Wejście na rynek DACH — mapa hipotez',
  body: 'Gałęzie: popyt mid-market, konkurencja lokalna, kanały sprzedaży, ryzyka regulacyjne. Priorytet na Q3: zwalidować popyt zanim ruszy budowa oferty.',
  stage: 'incubating',
  preferredTool: 'mindmap',
  tags: ['rynek', 'DACH'],
  area: 'Ekspansja',
  priority: 2,
  potential: 'Wysoki',
  complexity: 'Średnia',
  mapNodes: 18,
  mapEdges: 21,
  sourceType: 'manual',
  createdAt: '2026-07-11T09:00:00.000Z',
  updatedAt: '2026-09-04T09:00:00.000Z',
} as unknown as MyIdea;

const PodgladPomysluSufitStopki: React.FC = () => {
  const [rozwiniete, setRozwiniete] = React.useState(false);

  return (
    <MemoryRouter>
    <div className="min-h-screen bg-c-bg p-6">
      <div
        className="mb-3 text-sm font-semibold text-c-text"
        data-dev-render-chrome
      >
        {SUFIT
          ? 'PO — stopka ma sufit z kanonu (calc(100% − 386px)); blok „Szczegóły” mieści się w całości'
          : 'PRZED — stopka bez sufitu; blok „Szczegóły” ucięty na nagłówku tabeli właściwości'}
      </div>
      <div
        className="rounded-2xl bg-c-surface-raised p-3"
        style={{ width: PREVIEW_PANE_WIDTH, height: WYSOKOSC_PANELU }}
      >
        <PreviewPaneShell
          title={POMYSL.title}
          onClose={() => undefined}
          footer={
            <IdeaPreviewFooter
              idea={POMYSL}
              isPolish
              onOpenIdeaInProcessFlow={() => undefined}
              onConvertComplete={() => undefined}
            />
          }
          className={`h-full ${SUFIT ? '' : '[&>[data-preview-block=footer]]:!max-h-none'}`}
        >
          <IdeaPreviewBody
            idea={POMYSL}
            isPolish
            detailsExpanded={rozwiniete}
            onToggleDetailsExpanded={() => setRozwiniete((v) => !v)}
          />
        </PreviewPaneShell>
      </div>
    </div>
    </MemoryRouter>
  );
};

export default PodgladPomysluSufitStopki;
