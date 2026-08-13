/**
 * Dev-render host — Idea Table in the REAL PRODUCTION shape (S9-GATE4EVIDENCE
 * TASK 1, 2026-08-12, in response to the coordinator's dispute of the
 * `g4v3__table__*` reading).
 *
 * `dev-render/screens/idea-table.tsx` composes `IdeasTableContent` next to an
 * exploratory `ArtifactRightPanel` — useful for RISK-29's panel-fix evidence,
 * but NOT the shape a real user sees. This screen instead wraps
 * `IdeasTableContent` in a BYTE-FOR-BYTE copy of the wrapper
 * `MyIdeasListContent.tsx:1785-1791` actually renders in production
 * (`viewMode === 'table'` branch): sole child of a column flex, full
 * viewport, no sibling panel. No re-implementation of `IdeasTableContent`
 * itself — same pure-presentational component, same mock idea set as
 * `idea-table.tsx`, so the only variable under test is the WRAPPER shape.
 *
 * URL: ?screen=idea-table-production [&theme=light|dark] [&lang=pl|en]
 */
import React, { useMemo, useState } from 'react';
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

export function IdeaTableProductionScreen(): React.ReactElement {
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
    // MemoryRouter: IdeasTableContent's row-preview footer renders
    // <ConvertToOutputMenu>, which calls useNavigate() — needs a Router
    // ancestor even though dev-render never actually navigates.
    <MemoryRouter initialEntries={['/']}>
      {/*
        PRODUCTION SHAPE — this outer div is a byte-for-byte copy of
        MyIdeasListContent.tsx:1786's className string (the `viewMode ===
        'table'` branch), at full viewport, with NO sibling panel. This is
        the exact question TASK 1 asks: is the kebab column reachable when
        IdeasTableContent is mounted the way production actually mounts it,
        not the way the exploratory `idea-table.tsx` artefact-panel harness
        does.
      */}
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-c-bg" style={{ height: '100vh', width: '100vw' }}>
        {/* MyIdeasListContent.tsx:1791 */}
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

export default IdeaTableProductionScreen;
