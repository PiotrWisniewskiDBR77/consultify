/**
 * Dev-render host for the Idea Table as a Matryca artefakt (SPEC-A archetype
 * D — grid+toolbar centrum, ARTIFACT_ANATOMY_STANDARD §13).
 *
 * Renders the REAL `<IdeasTableContent>` (MyWork "Ideas → Table view" —
 * ResizableTable + built-in row detail flyout via `TableWithPreviewLayout`,
 * the same component `MyIdeasListContent` mounts in production) wrapped in
 * the REAL shared powłoka: `<TopBar>` (Menu 1) from `ExecutiveModuleShell`.
 * No re-implementation: `IdeasTableContent` is pure-presentational (all data
 * + handlers via props, no store/API), so it mounts standalone with a mocked
 * `MyIdea[]` array — the same pattern as
 * `dev-render/screens/assessment-initiatives-table.tsx`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ★ 2026-09-01 — USUNIĘTY eksploracyjny `<ArtifactRightPanel>` (dyżur 175).
 *
 * POWÓD: właściciel TRZY RAZY zgłosił „preview z tej tabeli nie jest zgodny
 * ze standardem/wzorem" (30.08, 01.09 ×2) i dwie naprawy nie trafiły, bo
 * szukały defektu w produkcie. Zmierzone w żywym DOM (1440×900, oba ekrany
 * mountują TEN SAM `IdeasTableContent`):
 *
 *   ?screen=idea-table-production → panel podglądu 403 px  ✔ kanon
 *   ?screen=idea-table            → panel podglądu 340 px  ✘ dno clamp()
 *
 * Kanon §7.2 to `clamp(340px, 28%, 480px)`; przy 1440 px daje 403 px. Ten
 * ekran dokładał z prawej `ArtifactRightPanel` (~440 px), więc 28% liczyło
 * się z ~1000 px = 280 px i podgląd SPADAŁ NA DNO clamp (340 px). Skutkiem
 * ubocznym ekran pokazywał DWA prawe panele obok siebie z powtórzonymi
 * nagłówkami „POWIĄZANIA" i „AI" — w dodatku sprzecznymi („Brak powiązań"
 * w podglądzie vs „1 inicjatywa promowana" w panelu, bo dane panelu były
 * zmyślone TUTAJ, w harnessie).
 *
 * PRODUKCJA TEGO NIE MA: `MyIdeasListContent.tsx:1943` montuje
 * `IdeasTableContent` jako JEDYNE dziecko kolumnowego flexa — zero trafień
 * na `RightPanel` w całym pliku. Panel był „exploratory" (tak nazywał go
 * własny komentarz tego pliku i docstring `idea-table-production.tsx`).
 * Właściciel oceniał więc kompozycję, której w produkcie nie ma, a my trzy
 * razy naprawialiśmy produkt, który był zgodny z kanonem. ZŁOTA REGUŁA nr 1
 * (CLAUDE.md): weryfikuj REALNY runtime.
 *
 * OTWARTE PYTANIE PRODUKTOWE (nie rozstrzygam go po cichu): jeśli tabela ma
 * kiedyś być artefaktem SPEC-A z własnym prawym panelem, to podgląd wiersza
 * i panel artefaktu potrzebują reguły WZAJEMNEGO WYKLUCZANIA — inaczej dwa
 * prawe panele zawsze zjadą podgląd na dno clamp(). Do decyzji właściciela.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Exercises: sort/resize/filter header, row select → bulk affordance,
 * per-row kebab (convert/favorite/folder/delete), click-to-open row preview
 * (built into the component, right of the grid). Light+dark tokens, zero
 * crimson on focus/status/selection.
 */
import { Plus } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { IdeasTableContent } from '@/components/MyWork/IdeasTableContent';
import type { MyIdea, SortDir, SortField } from '@/components/MyWork/myIdeasTypes';
import { TopBar, type TopBarChipDescriptor } from '@/components/shared/ExecutiveModuleShell';
import type { ColumnWidths, FilterOption, TableFilters } from '@/components/ui/ResizableTable';

const DEFAULT_COLUMN_WIDTHS: ColumnWidths = {
  select: 40,
  title: 560,
  stage: 150,
  tags: 230,
  tool: 190,
  date: 128,
  actions: 56,
};

const MOCK_IDEAS: MyIdea[] = [
  {
    id: 'idea-1',
    title: 'Ekspansja DE — mapa hipotez',
    body: 'Mapa hipotez wejścia na rynek DE — popyt, konkurencja, kanały, ryzyka.',
    tags: ['rynek', 'DE'],
    stage: 'shaping',
    preferredTool: 'mindmap',
    createdAt: '2026-06-20T09:00:00Z',
    updatedAt: '2026-07-15T11:20:00Z',
  },
  {
    id: 'idea-2',
    title: 'Automatyzacja raportowania OEE',
    body: 'Dashboard OEE zasilany z hali w czasie rzeczywistym.',
    tags: ['operacje', 'automatyzacja'],
    stage: 'ready',
    preferredTool: 'table',
    createdAt: '2026-06-18T09:00:00Z',
    updatedAt: '2026-07-12T08:00:00Z',
  },
  {
    id: 'idea-3',
    title: 'Program lojalnościowy B2B',
    body: 'Warstwowy program partnerski dla top-50 klientów.',
    tags: ['sprzedaż'],
    stage: 'incubating',
    preferredTool: 'whiteboard',
    createdAt: '2026-07-01T09:00:00Z',
    updatedAt: '2026-07-10T14:30:00Z',
  },
  {
    id: 'idea-4',
    title: 'Ujednolicenie modelu danych produkcyjnych',
    body: 'Wspólny schemat danych między liniami produkcyjnymi.',
    tags: ['dane', 'operacje'],
    stage: 'spark',
    preferredTool: 'process_flow',
    createdAt: '2026-07-08T09:00:00Z',
    updatedAt: '2026-07-11T09:45:00Z',
  },
  {
    id: 'idea-5',
    title: 'Pilotaż DACH — wejście na rynek',
    body: 'Wnioski z mapy hipotez DE przełożone na plan pilotażu.',
    tags: ['rynek', 'DACH'],
    stage: 'promoted',
    preferredTool: 'mindmap',
    createdAt: '2026-05-30T09:00:00Z',
    updatedAt: '2026-07-05T16:10:00Z',
  },
];

const STAGE_OPTIONS: FilterOption[] = [
  { value: 'spark', label: 'Iskra' },
  { value: 'incubating', label: 'Rośnie' },
  { value: 'shaping', label: 'Kształtuje' },
  { value: 'ready', label: 'Gotowy' },
  { value: 'promoted', label: 'Promowany' },
];
const TAG_OPTIONS: FilterOption[] = [
  { value: 'rynek', label: 'rynek' },
  { value: 'DE', label: 'DE' },
  { value: 'operacje', label: 'operacje' },
  { value: 'automatyzacja', label: 'automatyzacja' },
  { value: 'sprzedaż', label: 'sprzedaż' },
  { value: 'dane', label: 'dane' },
  { value: 'DACH', label: 'DACH' },
];
const TOOL_OPTIONS: FilterOption[] = [
  { value: 'mindmap', label: 'Mapa rekomendacji' },
  { value: 'table', label: 'Tabela' },
  { value: 'process_flow', label: 'Proces' },
  { value: 'whiteboard', label: 'Whiteboard' },
];

export function IdeaTableScreen(): React.ReactElement {
  const isPl = (new URLSearchParams(window.location.search).get('lang') || 'pl') !== 'en';

  const [ideas] = useState<MyIdea[]>(MOCK_IDEAS);
  const [tableFilters, setTableFilters] = useState<TableFilters>({});
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(DEFAULT_COLUMN_WIDTHS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [favorites, setFavorites] = useState<Set<string>>(new Set(['idea-5']));

  const allSelected = selectedIds.size > 0 && selectedIds.size === ideas.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const chips: TopBarChipDescriptor[] = useMemo(
    () => [
      {
        id: 'status',
        label: isPl ? '5 pomysłów' : '5 ideas',
        kind: 'standard',
        dotTone: 'neutral',
      },
      {
        id: 'new',
        label: isPl ? 'Nowy pomysł' : 'New idea',
        icon: Plus,
        kind: 'primary',
        onClick: () => {},
      },
    ],
    [isPl]
  );

  return (
    // IdeasTableContent's row-preview footer renders <ConvertToOutputMenu>, which
    // calls react-router-dom's useNavigate() — needs a Router ancestor even though
    // dev-render never actually navigates (pattern from
    // dev-render/screens/assessment-initiatives-table.tsx).
    <MemoryRouter initialEntries={['/']}>
      <div className="flex h-screen w-full flex-col bg-c-bg">
        <TopBar
          moduleLabel={isPl ? 'Moja praca · Pomysły' : 'My Work · Ideas'}
          title={isPl ? 'Tabela pomysłów' : 'Idea table'}
          chips={chips}
          backLabel={isPl ? 'Wróć do pomysłów' : 'Back to ideas'}
          onBack={() => {}}
        />
        {/*
          Montaż 1:1 jak produkcja (`MyIdeasListContent.tsx:1943`):
          `IdeasTableContent` jest JEDYNYM dzieckiem KOLUMNOWEGO flexa.
          Do 2026-09-01 stał tu flex WIERSZOWY z eksploracyjnym
          `ArtifactRightPanel` obok — i to ta kompozycja (nie produkt)
          ściskała podgląd wiersza z kanonicznych 403 px na dno clamp
          (340 px). Szczegóły i pomiar: docstring na górze pliku.

          Uwaga na przyszłość: poprzedni wariant potrzebował opakowania
          `min-w-0`, bo root `IdeasTableContent` (`flex-1 min-h-0 bg-c-bg`)
          nie ma `min-w-0` i jako element flexa WIERSZOWEGO nie schodził
          poniżej ~1364 px. W kolumnowym flexie problem nie istnieje —
          dlatego opakowanie znika razem z panelem, zamiast zostać jako
          martwy ślad po nieistniejącym sąsiedzie.
        */}
        <div className="flex min-h-0 flex-1 flex-col">
            <IdeasTableContent
              ideas={ideas}
            isPolish={isPl}
            tableFilters={tableFilters}
            availableStageOptions={STAGE_OPTIONS}
            availableTagOptions={TAG_OPTIONS}
            availableToolOptions={TOOL_OPTIONS}
            columnWidths={columnWidths}
            selectedIds={selectedIds}
            allSelected={allSelected}
            someSelected={someSelected}
            focusedIndex={focusedIndex}
            sortField={sortField}
            sortDir={sortDir}
            onSort={(field) => {
              if (field === sortField) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
              else {
                setSortField(field);
                setSortDir('asc');
              }
            }}
            onFocusIndexChange={setFocusedIndex}
            onToggleSelect={toggleSelect}
            onSelectAllVisible={() =>
              setSelectedIds(allSelected ? new Set() : new Set(ideas.map((i) => i.id)))
            }
            onClearSelection={() => setSelectedIds(new Set())}
            onColumnResize={(columnId, width) =>
              setColumnWidths((prev) => ({ ...prev, [columnId]: width }))
            }
            onTableFilterChange={(columnId, value) =>
              setTableFilters((prev) => ({
                ...prev,
                [columnId]: value.length > 0 ? value : undefined,
              }))
            }
            onOpenIdea={() => {}}
            isFavorite={(id) => favorites.has(id)}
            onToggleFavorite={(id) =>
              setFavorites((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
              onOpenIdeaInProcessFlow={() => {}}
              onStartConvert={() => {}}
              onDeleteIdea={() => {}}
              onRefresh={() => {}}
            />
        </div>
      </div>
    </MemoryRouter>
  );
}

export default IdeaTableScreen;
