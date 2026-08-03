/**
 * Dev-render host for Fala 7 — SORTOWANIE (klik nagłówka) + FILTR (per kolumna)
 * inside the Idea Table TOOL (the metadata-first PlatformGridView — NOT the
 * outer Ideas list).
 *
 * Same rationale as `idea-table-tool-paste.tsx` (CLAUDE.md #7 + audyt-idee
 * 2026-07-22): `PlatformGridView` only renders in-app when
 * `tablePlatformMetadataFirst` resolves a live platform base, which the demo
 * DB currently has none of. It is pure-presentational, so we mount the REAL
 * component here with mocked TableNode[]/field set + REAL `sort`/`setSort`/
 * `filters`/`setFilters` local state (mirrors what `useTableData()` would
 * provide in-app) so the actual sort/filter UI is visible before Piotr sees it.
 *
 * Try it: click a column header to cycle sort asc → desc → none. Type in the
 * small input under a header to filter "contains" (case-insensitive). Rows
 * include a blank "Budżet" cell (Zofia L.) to verify empty-last ordering, and
 * a computed column ("Priorytet (obliczany)") to verify computed columns
 * remain sortable.
 */
import React, { useMemo, useState } from 'react';

import type { FormatRule } from '@/components/MyWork/table/ConditionalFormatting';
import type {
  ColumnDef,
  FilterGroup,
  SortConfig,
  TableNode,
} from '@/components/MyWork/table/tableTypes';
import { PlatformGridView } from '@/components/MyWork/table/ViewRouter';
import type { FieldType } from '@/types/tablePlatform';

const isPl = (new URLSearchParams(window.location.search).get('lang') || 'pl') !== 'en';

// ── Mock schema (platform fields → ColumnDef mirror) ────────────────────────
// `priority` is marked isComputed to verify sort works on computed columns too
// (KRYTERIUM 4 — sortowalne po wyliczonej wartości, bez wywalania).
const FIELDS: {
  id: string;
  name: string;
  fieldType: FieldType;
  isComputed: boolean;
}[] = [
  { id: 'label', name: isPl ? 'Nazwa' : 'Label', fieldType: 'singleLineText', isComputed: false },
  {
    id: 'owner',
    name: isPl ? 'Właściciel' : 'Owner',
    fieldType: 'singleLineText',
    isComputed: false,
  },
  { id: 'status', name: 'Status', fieldType: 'singleSelect', isComputed: false },
  { id: 'budget', name: isPl ? 'Budżet' : 'Budget', fieldType: 'number', isComputed: false },
  {
    id: 'priority',
    name: isPl ? 'Priorytet (obliczany)' : 'Priority (computed)',
    fieldType: 'number',
    isComputed: true,
  },
];

const VISIBLE_COLUMNS: ColumnDef[] = FIELDS.map((f) => ({
  key: f.id,
  header: f.name,
  type: f.fieldType === 'number' ? 'number' : 'text',
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

// Deliberately unordered + one blank "budget" (Zofia L.) so empty-last sort
// ordering is verifiable at a glance, and mixed-case labels so the pl
// localeCompare (ą/ę/ł ordering) is visible.
const INITIAL_ROWS: TableNode[] = [
  {
    id: 'rec-1',
    type: 'idea',
    data: {
      label: isPl ? 'Żagle na jeziorze' : 'Sailing pilot',
      owner: 'Anna K.',
      status: isPl ? 'W toku' : 'In progress',
      budget: '12000',
      priority: '2',
    },
  },
  {
    id: 'rec-2',
    type: 'idea',
    data: {
      label: isPl ? 'Automatyzacja faktur' : 'Invoice automation',
      owner: 'Marek T.',
      status: isPl ? 'Do zrobienia' : 'To do',
      budget: '3000',
      priority: '5',
    },
  },
  {
    id: 'rec-3',
    type: 'idea',
    data: {
      label: isPl ? 'Integracja z ERP' : 'ERP integration',
      owner: 'Zofia L.',
      status: isPl ? 'Zablokowane' : 'Blocked',
      budget: '', // celowo puste — musi lądować na końcu sortu, oba kierunki
      priority: '1',
    },
  },
  {
    id: 'rec-4',
    type: 'idea',
    data: {
      label: isPl ? 'Ćwiczenie budżetowe' : 'Budget drill',
      owner: 'Anna K.',
      status: isPl ? 'W toku' : 'In progress',
      budget: '900',
      priority: '9',
    },
  },
  {
    id: 'rec-5',
    type: 'idea',
    data: {
      label: isPl ? 'Ankieta klientów' : 'Customer survey',
      owner: 'Bartek P.',
      status: isPl ? 'Do zrobienia' : 'To do',
      budget: '15000',
      priority: '3',
    },
  },
];

const NO_FORMAT_RULES: FormatRule[] = [];

export function IdeaTableToolSortFilterScreen(): React.ReactElement {
  const [rows, setRows] = useState<TableNode[]>(INITIAL_ROWS);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [editingCellId, setEditingCellId] = useState<string | null>(null);
  // Mirrors useTablePlatformViews' local state shape exactly (SortConfig|null,
  // FilterGroup) — this harness is the UI test bed for that existing,
  // previously-unwired mechanism (adoption, not a new parallel one).
  const [sort, setSort] = useState<SortConfig | null>(null);
  const [filters, setFilters] = useState<FilterGroup>({ logic: 'and', rules: [] });

  const platformFieldById = useMemo(() => PLATFORM_FIELD_BY_ID, []);

  const handleFieldChange = (nodeId: string, field: string, value: unknown) => {
    setRows((prev) =>
      prev.map((r) => (r.id === nodeId ? { ...r, data: { ...r.data, [field]: value } } : r))
    );
  };

  // Client-side filter+sort mirror of applyLocalFilterSortGroup — same logic
  // shape the real hook uses, so this harness proves the props contract works
  // end to end (header click → setSort → re-render with new order).
  const visibleRows = useMemo(() => {
    let processed = rows;
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
    if (sort) {
      const isEmpty = (v: unknown) => v === null || v === undefined || v === '';
      processed = processed
        .map((row, index) => ({ row, index }))
        .sort((a, b) => {
          const aRaw = a.row.data?.[sort.key];
          const bRaw = b.row.data?.[sort.key];
          const aEmpty = isEmpty(aRaw);
          const bEmpty = isEmpty(bRaw);
          if (aEmpty && bEmpty) return a.index - b.index;
          if (aEmpty) return 1;
          if (bEmpty) return -1;
          const aNum = Number(aRaw);
          const bNum = Number(bRaw);
          if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
            const cmp = aNum - bNum;
            return cmp !== 0 ? (sort.direction === 'asc' ? cmp : -cmp) : a.index - b.index;
          }
          const cmp = String(aRaw).localeCompare(String(bRaw), 'pl', { sensitivity: 'base' });
          return cmp !== 0 ? (sort.direction === 'asc' ? cmp : -cmp) : a.index - b.index;
        })
        .map((x) => x.row);
    }
    return processed;
  }, [rows, filters, sort]);

  return (
    <div className="flex h-screen w-full flex-col bg-c-bg p-6">
      <div className="mb-3 text-[11px] text-c-text-muted">
        {isPl
          ? 'Dev-render — sortowanie (klik nagłówka) + filtr per kolumna (PlatformGridView, Fala 7). "Budżet" ma puste pole (Zofia L.) — sprawdź że ląduje na końcu w obu kierunkach sortu.'
          : 'Dev-render — header-click sort + per-column filter (PlatformGridView, Fala 7). "Budget" has a blank cell (Zofia L.) — verify it lands last in both sort directions.'}
      </div>
      <div className="mb-2 text-[11px] text-c-text-secondary">
        sort: <code>{JSON.stringify(sort)}</code> · filters: <code>{JSON.stringify(filters)}</code>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <PlatformGridView
          processedRows={visibleRows}
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
      </div>
    </div>
  );
}

export default IdeaTableToolSortFilterScreen;
