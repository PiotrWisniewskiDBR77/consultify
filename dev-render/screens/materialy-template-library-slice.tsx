/**
 * Dev-render: MATERIAŁY ▸ Biblioteka wzorców — slice „szablon dokumentu".
 *
 * Montuje REALNY `<TemplatesTabContent />` z MOCK-danymi w kształcie, jaki
 * produkuje `mapCanonicalTemplateArtifact` po rozdzieleniu tożsamości
 * (artifactIndexId ≠ canonicalTemplateId). Bez logowania, bez bazy, bez API —
 * komponent bierze wiersze z propsa `templates`, więc nic nie stubujemy
 * (uwaga: main.tsx nadpisuje `Api.get`, więc gdyby ekran czegoś potrzebował,
 * mockujemy METODY `Api` w useEffect, nigdy `window.fetch`).
 *
 * Co ma być widać (rule #7 — zrzut PRZED oczami właściciela):
 *  1. wiersz kanoniczny (document_template) — bez odznak, „Użyj wzorca" aktywne,
 *  2. wiersz LEGACY (report_builder_templates) — neutralna odznaka „Legacy",
 *  3. wiersz OSIEROCONY — wyszarzony tytuł + odznaka „Brak źródła”, akcja
 *     „Użyj wzorca" wyłączona z powodem (kebab wiersza / preview),
 *  4. wiersz bez statusu/zakresu/daty — „Nieznany" i „—" zamiast udawanego stanu.
 *  5. wiersz ARKUSZ (sheet) — TemplateItem nie niesie żadnego pola struktury
 *     dla arkuszy, więc miniatura w Galerii ma być zawsze ta sama neutralna
 *     sylwetka `SheetSilhouette`/`NEUTRAL_SHEET_SILHOUETTE`, NIGDY zmyślona liczba.
 *
 * N4 (noc 2026-07-27/28) — Galeria za `ff_galeria_szablonow` (default OFF):
 * dopisz `&ff_galeria_szablonow=1` do URL, żeby zamiast dzisiejszej tabeli
 * zobaczyć przełącznik Galeria ↔ Tabela + kafle z miniaturami niosącymi
 * strukturę wzorca (port 1:1 zaakceptowanego prototypu
 * `proto/galeria-szablonow`). Bez tego parametru (albo z `=0`) ekran
 * renderuje się BYTE-IDENTYCZNIE jak przed N4 — to jest dowód dla
 * odbioru „flaga OFF = bez zmian".
 *
 * URL: ?screen=materialy-template-library-slice[&lang=pl|en][&theme=light|dark][&ff_galeria_szablonow=0|1]
 */
import React, { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { TemplatesTabContent } from '../../src/components/ReportsAndPresentations/TemplatesTabContent';
import type { TemplateItem } from '../../src/components/ReportsAndPresentations/types';
import type { FilterChip } from '../../src/components/shared/ModuleHub';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';

const TEMPLATES: TemplateItem[] = [
  {
    id: 'idx-1111-1111-1111-111111111111',
    artifactIndexId: 'idx-1111-1111-1111-111111111111',
    canonicalTemplateId: 'doc-tpl-aaaa-bbbb-cccc-dddddddddddd',
    originRuntime: 'document_template',
    source: 'canonical',
    legacy: false,
    orphaned: false,
    title: 'Raport diagnostyczny — wzorzec dokumentu',
    description:
      'Kanoniczny szablon Document Studio. „Użyj wzorca" prowadzi do Mode 3 z konkretnym canonical id.',
    type: 'report',
    category: 'R3',
    scope: 'organization',
    status: 'approved',
    updatedAt: '2026-07-18T09:30:00.000Z',
    createdBy: 'Piotr Wiśniewski',
    sectionCount: 7,
  },
  {
    id: 'idx-2222-2222-2222-222222222222',
    artifactIndexId: 'idx-2222-2222-2222-222222222222',
    canonicalTemplateId: 'rbt-5555-6666-7777-888888888888',
    originRuntime: 'report_template',
    source: 'legacy',
    legacy: true,
    orphaned: false,
    title: 'R1 — Tygodniowy przegląd realizacji',
    description:
      'Wzorzec ze starego rejestru report_builder_templates. Generacja bez zmian — tylko jawne oznaczenie.',
    type: 'report',
    category: 'R1',
    scope: 'system',
    status: 'published',
    updatedAt: '2026-06-30T14:05:00.000Z',
    createdBy: 'System',
    sectionCount: 6,
  },
  {
    id: 'idx-3333-3333-3333-333333333333',
    artifactIndexId: 'idx-3333-3333-3333-333333333333',
    canonicalTemplateId: null,
    originRuntime: 'document_template',
    source: 'canonical',
    legacy: false,
    orphaned: true,
    title: 'Raport zarządczy (wzorzec bez źródła)',
    description:
      'Indeks zna wpis, ale kanoniczny rekord szablonu nie istnieje — wpis NIE jest oferowany do użycia.',
    type: 'report',
    category: 'executive_update',
    scope: 'personal',
    status: 'deprecated',
    updatedAt: '2026-05-11T08:00:00.000Z',
    createdBy: 'Anna Kowalska',
  },
  {
    id: 'idx-4444-4444-4444-444444444444',
    artifactIndexId: 'idx-4444-4444-4444-444444444444',
    canonicalTemplateId: 'deck-tpl-9999-0000-1111-222222222222',
    originRuntime: 'presentation_template',
    source: 'canonical',
    legacy: false,
    orphaned: false,
    title: 'Prezentacja komitetu sterującego (bez metadanych)',
    description:
      'Indeks nie podał statusu, zakresu ani daty — pokazujemy „Nieznany" i „—", zamiast udawać poprawny stan.',
    type: 'presentation',
    category: 'R2',
    scope: 'unknown',
    status: 'unknown',
    updatedAt: null,
    createdBy: 'System',
    slideCount: 12,
  },
  {
    id: 'idx-5555-5555-5555-555555555555',
    artifactIndexId: 'idx-5555-5555-5555-555555555555',
    canonicalTemplateId: 'wb-tpl-3333-4444-5555-666666666666',
    originRuntime: null,
    source: 'canonical',
    legacy: false,
    orphaned: false,
    title: 'Model budżetu operacyjnego (arkusz)',
    description:
      'TemplateItem nie niesie żadnego pola struktury dla arkuszy (mapCanonicalTemplateArtifact ' +
      'nigdy nie ustawia licznika dla type=sheet) — miniatura Galerii ma być zawsze ta sama ' +
      'neutralna sylwetka, nie zmyślona liczba kolumn/wierszy/zakładek.',
    type: 'sheet',
    category: 'custom',
    scope: 'organization',
    status: 'published',
    updatedAt: '2026-07-20T07:55:00.000Z',
    createdBy: 'Zespół DRD',
  },
];

export default function MaterialyTemplateLibrarySliceScreen(): React.ReactElement {
  // Stan aktywnych filtrów żyje TU (jak w prawdziwym ReportsAndPresentationsHub,
  // które trzyma `activeFilters` przez useState) — bez tego chipy Galerii
  // (N4) klikałyby się, ale nic by się nie zawężało w tym harnessie.
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);

  return (
    <MemoryRouter initialEntries={['/materialy?tab=templates']}>
      <FeatureFlagsProvider showDevTools={false}>
        <div className="h-screen w-screen bg-c-bg">
          <div className="border-b border-c-border px-6 py-3">
            <div className="text-sm font-semibold text-c-text">
              Materiały ▸ Biblioteka wzorców — slice „szablon dokumentu"
            </div>
            <div className="mt-0.5 text-xs text-c-text-muted">
              1) kanoniczny dokument · 2) LEGACY (report_builder_templates) · 3) OSIEROCONY (bez
              źródła, „Użyj wzorca" wyłączone) · 4) bez statusu/zakresu/daty · 5) ARKUSZ (bez danych
              struktury → sylwetka neutralna). Dopisz <code>&amp;ff_galeria_szablonow=1</code> do
              URL, żeby zobaczyć Galerię (N4).
            </div>
          </div>
          <div className="h-[calc(100%-64px)]">
            <TemplatesTabContent
              viewMode="table"
              searchQuery=""
              activeFilters={activeFilters}
              onFilterChange={setActiveFilters}
              templates={TEMPLATES}
              loading={false}
              error={null}
            />
          </div>
        </div>
      </FeatureFlagsProvider>
    </MemoryRouter>
  );
}
