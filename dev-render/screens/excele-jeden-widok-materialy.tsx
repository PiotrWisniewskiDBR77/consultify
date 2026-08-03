/**
 * Dev-render host — odbiór "jeden Excel na każdej ścieżce" (2026-07-28),
 * ŚCIEŻKA 4: Materiały → Arkusze → otwarcie z listy.
 *
 * Montuje REALNY `<OutputsAggregateTabContent />` (komponent, którego używa
 * `SheetsTabContent` — Menu 1 zakładka "Sheets" w `ReportsAndPresentationsHub`
 * — gdy rejestr ma choć jeden wiersz, patrz `SheetsTabContent.tsx` linia ~85)
 * z JEDNYM wierszem `kind: 'sheet'`, `sheetOrigin: 'workbook'` (czyli
 * PRAWDZIWY skoroszyt Excela z `generated_workbooks`, NIE eksport tabeli
 * platformowej — patrz `SheetOrigin` w `types.ts`).
 *
 * PRZED naprawą (2026-07-28): klik "Otwórz" na takim wierszu wołał
 * `openGovernedSheetRow`, która przy `tablePlatformMetadataFirst` ON (default)
 * i braku mapowania na tabelę platformową (naturalne w tym harnessie — zero
 * backendu, `resolveTablePlatformWorkspaceIdForTable` zawodzi sieciowo i
 * zwraca `null`) PO CICHU ściągała plik (`downloadSheetArtifactXlsx`) zamiast
 * otworzyć siatkę. PO naprawie nawiguje do `/excele?artifactId=<id>` —
 * DOKŁADNIE tę samą ścieżkę reopen co bezpośredni link.
 *
 * Rows przekazane jako PROP (nie przez window.fetch mock) — `OutputsAggregateTabContent`
 * bierze `rows: UnifiedOutputRow[]` bezpośrednio, wzorem
 * `materialy-template-library-slice.tsx` dla `TemplatesTabContent`.
 *
 * URL: ?screen=excele-jeden-widok-materialy&theme=light|dark&lang=pl
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ExceleView } from '@/components/AIChat/KimiWorkspace/ExceleView';
import { OutputsAggregateTabContent } from '@/components/ReportsAndPresentations/OutputsAggregateTabContent';
import type { UnifiedOutputRow } from '@/components/ReportsAndPresentations/types';
import { useRapActions } from '@/components/ReportsAndPresentations/useRapData';
import type { FilterChip } from '@/components/shared/ModuleHub';
import { FeatureFlagsProvider } from '@/contexts/FeatureFlagsContext';
import { Api } from '@/services/api';

const ID = 'wb-dev-render-materialy-row';

const ROWS: UnifiedOutputRow[] = [
  {
    kind: 'sheet',
    originRecordId: ID,
    artifactId: ID,
    title: 'Budżet operacyjny 2026 (arkusz z Materiałów)',
    statusKey: 'draft',
    owner: 'Piotr Wiśniewski',
    updatedAt: new Date().toISOString(),
    exportFormats: ['xlsx'],
    sheetOrigin: 'workbook',
  },
];

const WORKBOOK = {
  id: ID,
  title: 'Budżet operacyjny 2026 (arkusz z Materiałów)',
  schema_json: {
    title: 'Budżet operacyjny 2026 (arkusz z Materiałów)',
    sheets: [
      {
        name: 'Arkusz1',
        columns: [
          { key: 'pozycja', header: 'Pozycja' },
          { key: 'q1', header: 'Q1' },
          { key: 'q2', header: 'Q2' },
        ],
        rows: [
          {
            cells: {
              pozycja: { value: 'Przychód' },
              q1: { value: 100000 },
              q2: { formula: 'B2*1.1' },
            },
          },
          {
            cells: {
              pozycja: { value: 'Koszty' },
              q1: { value: 60000 },
              q2: { formula: 'B3*1.05' },
            },
          },
        ],
      },
    ],
  },
};

function installWorkbookMock(): void {
  const realGet = Api.get.bind(Api);
  Api.get = (async (url: string, ...rest: unknown[]) => {
    if (typeof url === 'string' && url.includes(`/workbook/${ID}`)) return WORKBOOK;
    return realGet(url, ...(rest as []));
  }) as typeof Api.get;
}

function MaterialySheetsListHost(): React.ReactElement {
  installWorkbookMock();
  const actions = useRapActions();
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);

  return (
    <div className="h-screen w-full overflow-hidden bg-c-bg flex flex-col">
      <div className="border-b border-c-border px-6 py-3 shrink-0">
        <div className="text-sm font-semibold text-c-text">
          Materiały ▸ Arkusze — 1 wiersz (kind=sheet, sheetOrigin=workbook)
        </div>
        <div className="mt-0.5 text-xs text-c-text-muted">
          Kliknij "Otwórz" (kebab wiersza albo dwuklik) — powinno wylądować w `/excele?artifactId=
          {ID}` z edytowalną siatką (nie pobranie pliku, nie Table Studio).
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <OutputsAggregateTabContent
          viewMode="table"
          searchQuery=""
          activeFilters={activeFilters}
          onFilterChange={setActiveFilters}
          rows={ROWS}
          loading={false}
          error={null}
          onRefresh={() => {}}
          actions={actions}
        />
      </div>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

export default function ExceleJedenWidokMaterialyScreen(): React.ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <FeatureFlagsProvider showDevTools={false}>
        <MemoryRouter initialEntries={['/presentations?tab=outputs_sheets']}>
          <Routes>
            <Route path="/presentations" element={<MaterialySheetsListHost />} />
            <Route path="/excele" element={<ExceleView />} />
          </Routes>
        </MemoryRouter>
      </FeatureFlagsProvider>
    </QueryClientProvider>
  );
}
