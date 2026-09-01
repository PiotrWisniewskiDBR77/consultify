/**
 * Dev-render host for the Idea Table (MyWork "Ideas → Table view").
 *
 * Renders the REAL `<IdeasTableContent>` (ResizableTable + built-in row
 * detail flyout via `TableWithPreviewLayout`, the same component
 * `MyIdeasListContent` mounts in production) in the SAME wrapper shape
 * production uses — no `<TopBar>`, no sibling panel, sole child of a
 * column flex. No re-implementation: `IdeasTableContent` is
 * pure-presentational (all data + handlers via props, no store/API), so it
 * mounts standalone with a mocked `MyIdea[]` array.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ★ 2026-09-01 — USUNIĘTY `<TopBar>` z `ExecutiveModuleShell` (audyt
 * przyrządu, Kategoria 1).
 *
 * POWÓD: właściciel TRZY RAZY zgłosił „preview z tej tabeli nie jest zgodny
 * ze standardem/wzorem" (30.08, 01.09 ×2). Dyżur 175 (patrz historia git tego
 * pliku) usunął eksploracyjny `<ArtifactRightPanel>`, który wcześniej ściskał
 * podgląd wiersza na dno clamp() — ale zostawił `<TopBar>` nad tabelą.
 * Produkcja go NIE MA: `MyIdeasListContent.tsx:1943` montuje
 * `IdeasTableContent` jako JEDYNE dziecko kolumnowego flexa — zero trafień
 * na `TopBar` w całym pliku; `<TopBar>` żyje TYLKO w
 * `ExecutiveModuleShell/index.tsx:535`, którego ten ekran nigdy nie montuje.
 * Właściciel oceniał więc kompozycję (obcy pasek breadcrumb+chipy nad
 * tabelą), której w produkcie nie ma. ZŁOTA REGUŁA nr 1 (CLAUDE.md):
 * weryfikuj REALNY runtime.
 *
 * Ekran mountuje teraz identyczny kształt co
 * `dev-render/screens/idea-table-production.tsx` (byte-for-byte kopia
 * wrappera `MyIdeasListContent.tsx:1785-1791`, od 2026-08-12).
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Exercises: sort/resize/filter header, row select → bulk affordance,
 * per-row kebab (convert/favorite/folder/delete), click-to-open row preview
 * (built into the component, right of the grid). Light+dark tokens, zero
 * crimson on focus/status/selection.
 */
import React, { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { IdeasTableContent } from '@/components/MyWork/IdeasTableContent';
import type { MyIdea, SortDir, SortField } from '@/components/MyWork/myIdeasTypes';
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

  return (
    // IdeasTableContent's row-preview footer renders <ConvertToOutputMenu>, which
    // calls react-router-dom's useNavigate() — needs a Router ancestor even though
    // dev-render never actually navigates (pattern from
    // dev-render/screens/assessment-initiatives-table.tsx).
    <MemoryRouter initialEntries={['/']}>
      {/*
        Montaż 1:1 jak produkcja (`MyIdeasListContent.tsx:1943`):
        `IdeasTableContent` jest JEDYNYM dzieckiem KOLUMNOWEGO flexa, PEŁEN
        viewport, ZERO `<TopBar>`. Do 2026-09-01 stał tu `<TopBar>` z
        `ExecutiveModuleShell` (breadcrumb + „Wróć do pomysłów" + chipy) —
        produkcja go nie ma (`MyIdeasListContent.tsx:1943`: zero trafień na
        `TopBar` w całym pliku; `<TopBar>` żyje TYLKO w
        `ExecutiveModuleShell/index.tsx:535`, którego ten ekran nigdy nie
        montuje). Pasek zjadał szerokość pionowo nie zajmował, ale sam fakt
        obcego elementu nad tabelą to R1 (harness dokłada element, którego
        produkcja nie renderuje) — usunięty w ramach audytu przyrządu
        2026-09-01. Zob. też `idea-table-production.tsx`, który od 2026-08-12
        montuje tę samą treść w identycznym, bez-TopBar kształcie.
      */}
      <div
        className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-c-bg"
        style={{ height: '100vh', width: '100vw' }}
      >
        <div className="flex flex-col flex-1 min-h-0">
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
