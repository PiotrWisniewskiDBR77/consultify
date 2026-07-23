/**
 * Dev-render host for Fala 8 (parytet Airtable) — stan pustego filtra.
 *
 * `PlatformGridView` only renders in-app when `tablePlatformMetadataFirst`
 * resolves a live platform base (CLAUDE.md #7 + audyt-idee 2026-07-22), so
 * this harness reproduces the exact decision `ViewRouter.mainContent` makes
 * (see `src/components/MyWork/table/ViewRouter.tsx`, `isEmptyDueToFilter`)
 * locally: three real components — `EmptyStateView`, `EmptyFilterStateView`,
 * `PlatformGridView` — switched on the same `nodes.length` / `filters.rules`
 * / `processedRows.length` logic the real router uses, so the actual
 * behaviour is visible before Piotr sees it.
 *
 * Try it:
 *  - "9 rekordów, brak filtra" → tabela normalna.
 *  - "9 rekordów, filtr = 0 wyników" → wpisz w filtrze kolumny "Właściciel"
 *    coś, co nic nie dopasowuje (np. "zzz") → widać "Brak wyników dla
 *    filtra" + "Wyczyść filtry". Kliknięcie czyści filtr i wraca tabela.
 *  - "0 rekordów (naprawdę pusto)" → widać dotychczasowy "Dodaj pierwszy
 *    rekord" (EmptyStateView), NIE "Brak wyników dla filtra".
 */
import React, { useMemo, useState } from 'react';

import type { FormatRule } from '@/components/MyWork/table/ConditionalFormatting';
import { EmptyFilterStateView } from '@/components/MyWork/table/EmptyFilterStateView';
import { EmptyStateView } from '@/components/MyWork/table/EmptyStateView';
import type {
  ColumnDef,
  FilterGroup,
  SortConfig,
  TableNode,
} from '@/components/MyWork/table/tableTypes';
import { PlatformGridView } from '@/components/MyWork/table/ViewRouter';
import type { FieldType } from '@/types/tablePlatform';

const isPl = (new URLSearchParams(window.location.search).get('lang') || 'pl') !== 'en';

const FIELDS: { id: string; name: string; fieldType: FieldType; isComputed: boolean }[] = [
  { id: 'label', name: isPl ? 'Nazwa' : 'Label', fieldType: 'singleLineText', isComputed: false },
  {
    id: 'owner',
    name: isPl ? 'Właściciel' : 'Owner',
    fieldType: 'singleLineText',
    isComputed: false,
  },
  { id: 'status', name: 'Status', fieldType: 'singleSelect', isComputed: false },
];

const VISIBLE_COLUMNS: ColumnDef[] = FIELDS.map((f) => ({
  key: f.id,
  header: f.name,
  type: 'text',
  visible: true,
  width: 200,
}));

const PLATFORM_FIELDS = FIELDS.map((f, i) => ({
  id: f.id,
  tableId: 'mock-table',
  name: f.name,
  fieldType: f.fieldType,
  options: {},
  isComputed: f.isComputed,
  order: i,
  createdAt: '2026-07-22T09:00:00Z',
  updatedAt: '2026-07-22T09:00:00Z',
}));

const PLATFORM_FIELD_BY_ID = new Map(
  FIELDS.map((f) => [
    f.id,
    { fieldType: f.fieldType, options: {} as Record<string, unknown>, isComputed: f.isComputed },
  ])
);

const NINE_ROWS: TableNode[] = Array.from({ length: 9 }).map((_, i) => ({
  id: `rec-${i + 1}`,
  type: 'idea',
  data: {
    label: isPl ? `Pomysł ${i + 1}` : `Idea ${i + 1}`,
    owner: ['Anna K.', 'Marek T.', 'Zofia L.'][i % 3],
    status: isPl ? 'W toku' : 'In progress',
  },
}));

const NO_FORMAT_RULES: FormatRule[] = [];
const EMPTY_FILTER_GROUP: FilterGroup = { logic: 'and', rules: [] };

type Scenario = 'has-rows' | 'zero-real';

export function IdeaTableToolEmptyFilterScreen(): React.ReactElement {
  const [scenario, setScenario] = useState<Scenario>('has-rows');
  const [rows] = useState<TableNode[]>(NINE_ROWS);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [editingCellId, setEditingCellId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortConfig | null>(null);
  const [filters, setFilters] = useState<FilterGroup>(EMPTY_FILTER_GROUP);

  const platformFieldById = useMemo(() => PLATFORM_FIELD_BY_ID, []);

  // Source rows for this scenario — mirrors `nodes` in useTableData().
  const nodes = scenario === 'zero-real' ? [] : rows;

  // Same filter application ViewRouter's quick-filter-under-header produces.
  const processedRows = useMemo(() => {
    let processed = nodes;
    if (filters.rules.length > 0) {
      processed = processed.filter((r) => {
        const results = filters.rules.map((rule) => {
          const raw = String(r.data?.[rule.column] ?? '').toLowerCase();
          const val = String(rule.value ?? '').toLowerCase();
          return raw.includes(val);
        });
        return filters.logic === 'and' ? results.every(Boolean) : results.some(Boolean);
      });
    }
    return processed;
  }, [nodes, filters]);

  const hasActiveFilters = filters.rules.length > 0;
  const isEmptyDueToFilter = processedRows.length === 0 && (hasActiveFilters || nodes.length > 0);

  const handleFieldChange = () => {};

  return (
    <div className="flex h-screen w-full flex-col bg-c-bg p-6">
      <div className="mb-3 text-[11px] text-c-text-muted">
        {isPl
          ? 'Dev-render — stan pustego filtra (Fala 8, parytet Airtable). Wybierz scenariusz, potem wpisz filtr pod kolumną "Właściciel".'
          : 'Dev-render — empty filter state (Fala 8, Airtable parity). Pick a scenario, then type in the filter under "Owner".'}
      </div>
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setScenario('has-rows');
            setFilters(EMPTY_FILTER_GROUP);
          }}
          className={`rounded-lg border px-3 py-1.5 text-xs ${
            scenario === 'has-rows'
              ? 'border-c-focus bg-c-info/10 text-c-text'
              : 'border-c-border-subtle text-c-text-muted'
          }`}
        >
          {isPl
            ? '9 rekordów (spróbuj filtr = 0 wyników)'
            : '9 records (try a filter with 0 matches)'}
        </button>
        <button
          type="button"
          onClick={() => {
            setScenario('zero-real');
            setFilters(EMPTY_FILTER_GROUP);
          }}
          className={`rounded-lg border px-3 py-1.5 text-xs ${
            scenario === 'zero-real'
              ? 'border-c-focus bg-c-info/10 text-c-text'
              : 'border-c-border-subtle text-c-text-muted'
          }`}
        >
          {isPl ? '0 rekordów (naprawdę pusto)' : '0 records (truly empty)'}
        </button>
      </div>
      <div className="mb-2 text-[11px] text-c-text-secondary">
        nodes.length: <code>{nodes.length}</code> · processedRows.length:{' '}
        <code>{processedRows.length}</code> · isEmptyDueToFilter:{' '}
        <code>{String(isEmptyDueToFilter)}</code> · filters: <code>{JSON.stringify(filters)}</code>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {isEmptyDueToFilter ? (
          <EmptyFilterStateView onClearFilters={() => setFilters(EMPTY_FILTER_GROUP)} />
        ) : processedRows.length === 0 ? (
          <EmptyStateView
            viewType="table"
            onAddRow={() => {}}
            onImportCSV={() => {}}
            onUseAI={() => {}}
          />
        ) : (
          <PlatformGridView
            processedRows={processedRows}
            groupedRows={null}
            visibleColumns={VISIBLE_COLUMNS}
            platformFieldById={platformFieldById}
            locked={false}
            selectedRowIds={selectedRowIds}
            toggleRowSelection={(id) =>
              setSelectedRowIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            handleFieldChange={handleFieldChange}
            editingCellId={editingCellId}
            setEditingCellId={setEditingCellId}
            onOpenLinkedRecord={() => {}}
            formatRules={NO_FORMAT_RULES}
            platformFields={PLATFORM_FIELDS}
            handleDuplicateRow={() => {}}
            handleDeleteRow={() => {}}
            handleInsertRow={() => {}}
            onExpandRecord={() => {}}
            sort={sort}
            setSort={setSort}
            filters={filters}
            setFilters={setFilters}
          />
        )}
      </div>
    </div>
  );
}

export default IdeaTableToolEmptyFilterScreen;
