/**
 * Dev-render host for Fala 10 (parytet Airtable) — GRUPOWANIE: dropdown "Grupuj
 * wg" (wybór dowolnej kolumny) + zwijanie/rozwijanie grup w Idea Table TOOL
 * (the metadata-first PlatformGridView — NOT the outer Ideas list).
 *
 * Same rationale as `idea-table-tool-sortfilter.tsx` (CLAUDE.md #7 + audyt-idee
 * 2026-07-22): `PlatformGridView` only renders in-app when
 * `tablePlatformMetadataFirst` resolves a live platform base, which the demo
 * DB currently has none of. It is pure-presentational, so we mount the REAL
 * component here with mocked TableNode[]/field set + a local `groupBy` state
 * whose selector control mirrors exactly the dropdown wired into
 * TableToolbar.tsx (same markup/interaction, same setGroupBy contract) — this
 * proves the groupBy → groupedRows → collapse chain end to end even though the
 * full TableToolbar (30+ required props, presence/connectors/heatmap/etc.)
 * is out of scope for a lightweight harness.
 *
 * Try it: pick a column from "Grupuj wg" to group rows; click a group header
 * (chevron) to collapse/expand it; pick "Bez grupowania" to ungroup.
 */
import { Check, ChevronDown, Group } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import type { FormatRule } from '@/components/MyWork/table/ConditionalFormatting';
import type { ColumnDef, TableNode } from '@/components/MyWork/table/tableTypes';
import { PlatformGridView } from '@/components/MyWork/table/ViewRouter';
import type { FieldType } from '@/types/tablePlatform';

const isPl = (new URLSearchParams(window.location.search).get('lang') || 'pl') !== 'en';

// ── Mock schema — includes the axis columns named in the task (Funkcja/
// Interakcja) so the picker + grouping is verified on the real-world columns,
// not just generic placeholders. ──────────────────────────────────────────
const FIELDS: {
  id: string;
  name: string;
  fieldType: FieldType;
  isComputed: boolean;
}[] = [
  { id: 'label', name: isPl ? 'Nazwa' : 'Label', fieldType: 'singleLineText', isComputed: false },
  { id: 'status', name: 'Status', fieldType: 'singleSelect', isComputed: false },
  {
    id: 'function',
    name: isPl ? 'Funkcja' : 'Function',
    fieldType: 'singleSelect',
    isComputed: false,
  },
  {
    id: 'interaction',
    name: isPl ? 'Interakcja' : 'Interaction',
    fieldType: 'singleSelect',
    isComputed: false,
  },
  {
    id: 'owner',
    name: isPl ? 'Właściciel' : 'Owner',
    fieldType: 'singleLineText',
    isComputed: false,
  },
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

const INITIAL_ROWS: TableNode[] = [
  {
    id: 'rec-1',
    type: 'idea',
    data: {
      label: isPl ? 'Żagle na jeziorze' : 'Sailing pilot',
      owner: 'Anna K.',
      status: isPl ? 'W toku' : 'In progress',
      function: isPl ? 'Sprzedaż' : 'Sales',
      interaction: isPl ? 'Samoobsługa' : 'Self-serve',
    },
  },
  {
    id: 'rec-2',
    type: 'idea',
    data: {
      label: isPl ? 'Automatyzacja faktur' : 'Invoice automation',
      owner: 'Marek T.',
      status: isPl ? 'Do zrobienia' : 'To do',
      function: isPl ? 'Finanse' : 'Finance',
      interaction: isPl ? 'Asystowana' : 'Assisted',
    },
  },
  {
    id: 'rec-3',
    type: 'idea',
    data: {
      label: isPl ? 'Integracja z ERP' : 'ERP integration',
      owner: 'Zofia L.',
      status: isPl ? 'Zablokowane' : 'Blocked',
      function: isPl ? 'Finanse' : 'Finance',
      interaction: isPl ? 'Asystowana' : 'Assisted',
    },
  },
  {
    id: 'rec-4',
    type: 'idea',
    data: {
      label: isPl ? 'Ćwiczenie budżetowe' : 'Budget drill',
      owner: 'Anna K.',
      status: isPl ? 'W toku' : 'In progress',
      function: isPl ? 'Finanse' : 'Finance',
      interaction: isPl ? 'Samoobsługa' : 'Self-serve',
    },
  },
  {
    id: 'rec-5',
    type: 'idea',
    data: {
      label: isPl ? 'Ankieta klientów' : 'Customer survey',
      owner: 'Bartek P.',
      status: isPl ? 'Do zrobienia' : 'To do',
      function: isPl ? 'Sprzedaż' : 'Sales',
      interaction: isPl ? 'Samoobsługa' : 'Self-serve',
    },
  },
];

const NO_FORMAT_RULES: FormatRule[] = [];

export function IdeaTableToolGroupingScreen(): React.ReactElement {
  const [rows] = useState<TableNode[]>(INITIAL_ROWS);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [editingCellId, setEditingCellId] = useState<string | null>(null);
  // Same shape/mechanism as TableDataProvider's groupBy/setGroupBy contract.
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [showGroupMenu, setShowGroupMenu] = useState(false);

  const platformFieldById = useMemo(() => PLATFORM_FIELD_BY_ID, []);

  const handleFieldChange = () => {};

  // Mirrors applyLocalFilterSortGroup's grouping step (no filter/sort inputs
  // in this harness — that's already proven by idea-table-tool-sortfilter).
  const groupedRows = useMemo(() => {
    if (!groupBy) return null;
    const grouped: Record<string, TableNode[]> = {};
    for (const row of rows) {
      const key = String(row.data?.[groupBy] ?? row.type ?? 'other');
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(row);
    }
    return grouped;
  }, [rows, groupBy]);

  const processedRows = groupBy ? [] : rows;

  return (
    <div className="flex h-screen w-full flex-col bg-c-bg p-6">
      <div className="mb-3 text-[11px] text-c-text-muted">
        {isPl
          ? 'Dev-render — grupowanie (Fala 10, parytet Airtable): dropdown "Grupuj wg" (dowolna kolumna) + zwijanie grup (PlatformGridView). Kontrolka niżej to dokładnie ten sam markup/interakcja co w TableToolbar.tsx.'
          : 'Dev-render — grouping (Wave 10, Airtable parity): "Group by" dropdown (any column) + group collapse (PlatformGridView). The control below is the exact same markup/interaction as TableToolbar.tsx.'}
      </div>
      <div className="mb-2 text-[11px] text-c-text-secondary">
        groupBy: <code>{JSON.stringify(groupBy)}</code>
      </div>

      {/* Identical control to TableToolbar.tsx's "Group by" dropdown */}
      <div className="mb-3 flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setShowGroupMenu((p) => !p)}
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
              groupBy
                ? 'bg-c-surface text-c-text'
                : 'text-c-text-secondary hover:bg-c-surface-raised'
            } border border-c-border-subtle`}
          >
            <Group size={12} />
            <span>
              {groupBy
                ? (VISIBLE_COLUMNS.find((c) => c.key === groupBy)?.header ??
                  (isPl ? 'Grupuj' : 'Group'))
                : isPl
                  ? 'Grupuj'
                  : 'Group'}
            </span>
            <ChevronDown size={10} className="text-c-text-muted" />
          </button>
          {showGroupMenu && (
            <div className="absolute left-0 top-full mt-1 z-50 w-52 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-xl p-2">
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">
                {isPl ? 'Grupuj wg' : 'Group by'}
              </div>
              <button
                onClick={() => {
                  setGroupBy(null);
                  setShowGroupMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-c-text hover:bg-c-surface-raised transition-colors"
              >
                <span className="w-3">{!groupBy && <Check size={12} />}</span>
                {isPl ? 'Bez grupowania' : 'No grouping'}
              </button>
              <div className="max-h-64 overflow-auto">
                {VISIBLE_COLUMNS.map((col) => (
                  <button
                    key={col.key}
                    onClick={() => {
                      setGroupBy(col.key);
                      setShowGroupMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-c-text hover:bg-c-surface-raised transition-colors"
                  >
                    <span className="w-3">{groupBy === col.key && <Check size={12} />}</span>
                    <span className="truncate">{col.header}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <PlatformGridView
          processedRows={processedRows}
          groupedRows={groupedRows}
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
          sort={null}
          setSort={() => {}}
          filters={{ logic: 'and', rules: [] }}
          setFilters={() => {}}
        />
      </div>
    </div>
  );
}

export default IdeaTableToolGroupingScreen;
