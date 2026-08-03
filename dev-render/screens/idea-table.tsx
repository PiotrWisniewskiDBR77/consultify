/**
 * Dev-render host for the Idea Table as a Matryca artefakt (SPEC-A archetype
 * D — grid+toolbar centrum, ARTIFACT_ANATOMY_STANDARD §13).
 *
 * Renders the REAL `<IdeasTableContent>` (MyWork "Ideas → Table view" —
 * ResizableTable + built-in row detail flyout via `TableWithPreviewLayout`,
 * the same component `MyIdeasListContent` mounts in production) wrapped in
 * the REAL shared powłoka: `<TopBar>` (Menu 1) from `ExecutiveModuleShell` +
 * the canonical `<ArtifactRightPanel>` accordion (Akcje·Właściwości·
 * Powiązania·Komentarze·Historia/AI — SSOT order). No re-implementation:
 * `IdeasTableContent` is pure-presentational (all data + handlers via
 * props, no store/API), so it mounts standalone with a mocked `MyIdea[]`
 * array — the same pattern as `dev-render/screens/assessment-initiatives-table.tsx`.
 *
 * Exercises: sort/resize/filter header, row select → bulk affordance,
 * per-row kebab (convert/favorite/folder/delete), click-to-open row preview
 * (built into the component, right of the grid), PLUS the outer artefakt-
 * level right panel (properties of the TABLE itself, not a row). Light+dark
 * tokens, zero crimson on focus/status/selection.
 */
import { FileSpreadsheet, History as HistoryIcon, Plus, Sparkles, Tag } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { IdeasTableContent } from '@/components/MyWork/IdeasTableContent';
import type { MyIdea, SortDir, SortField } from '@/components/MyWork/myIdeasTypes';
import { TopBar, type TopBarChipDescriptor } from '@/components/shared/ExecutiveModuleShell';
import {
  PreviewActionBar,
  PreviewAIHintStrip,
  PreviewMetaCard,
  PreviewRelations,
} from '@/components/shared/PreviewPane';
import {
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';
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

  const rightSections: ArtifactRightPanelSection[] = useMemo(
    () => [
      {
        id: 'actions',
        label: isPl ? 'Akcje' : 'Actions',
        children: (
          <PreviewActionBar
            rows={[
              {
                buttons: [
                  {
                    label: isPl ? 'Uzupełnij puste' : 'Fill empty',
                    icon: Sparkles,
                    colorScheme: 'neutral',
                    onClick: () => {},
                    flex: true,
                  },
                  {
                    label: isPl ? 'Eksportuj arkusz' : 'Export sheet',
                    icon: FileSpreadsheet,
                    colorScheme: 'neutral',
                    onClick: () => {},
                    flex: true,
                  },
                ],
              },
            ]}
          />
        ),
      },
      {
        id: 'properties',
        label: isPl ? 'Właściwości' : 'Properties',
        children: (
          <PreviewMetaCard
            pills={[
              { label: isPl ? 'Wiersze' : 'Rows', value: String(ideas.length) },
              { label: isPl ? 'Folder' : 'Folder', value: isPl ? 'Bez folderu' : 'No folder' },
              { label: isPl ? 'Właściciel' : 'Owner', value: 'Piotr W.' },
              {
                label: isPl ? 'Widoczność' : 'Visibility',
                value: isPl ? 'Zespół' : 'Team',
                tone: 'info',
              },
            ]}
          />
        ),
      },
      {
        id: 'relations',
        label: isPl ? 'Powiązania' : 'Relations',
        children: (
          <PreviewRelations
            items={[
              {
                id: 'r1',
                label: isPl ? '1 inicjatywa promowana' : '1 promoted initiative',
                icon: HistoryIcon,
                type: 'initiative',
              },
              {
                id: 'r2',
                label: isPl ? 'Powiązana Mapa rekomendacji' : 'Linked Recommendation map',
                icon: Tag,
                type: 'mindmap',
              },
            ]}
          />
        ),
      },
      {
        id: 'comments',
        label: isPl ? 'Komentarze' : 'Comments',
        isEmpty: true,
        emptyLabel: isPl ? 'Brak komentarzy.' : 'No comments yet.',
        children: null,
      },
      {
        id: 'history',
        label: isPl ? 'Historia / AI' : 'History / AI',
        children: (
          <PreviewAIHintStrip
            hints={[
              isPl ? 'Pogrupuj wg etapu' : 'Group by stage',
              isPl ? 'Zaproponuj kolejny pomysł' : 'Suggest next idea',
            ]}
            onRunHint={() => {}}
          />
        ),
      },
    ],
    [isPl, ideas.length]
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
        <div className="flex min-h-0 flex-1">
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
          <ArtifactRightPanel
            sections={rightSections}
            ariaLabel={isPl ? 'Szczegóły tabeli pomysłów' : 'Idea table details'}
          />
        </div>
      </div>
    </MemoryRouter>
  );
}

export default IdeaTableScreen;
