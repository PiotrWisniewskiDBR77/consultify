/**
 * Dev-render host for Z16b follow-up: Ctrl/Cmd+V PASTE inside the Idea Table
 * TOOL (the metadata-first PlatformGridView — NOT the outer Ideas list).
 *
 * Same rationale as `idea-table-tool-kebab.tsx` (CLAUDE.md #7 + audyt-idee
 * 2026-07-22): `PlatformGridView` only renders in-app when
 * `tablePlatformMetadataFirst` resolves a live platform base, which the demo
 * DB currently has none of. It is pure-presentational, so we mount the REAL
 * component here with a mocked TableNode[]/field set and a REAL
 * `handleFieldChange` (writes to local state, unlike the kebab harness's
 * no-op) so paste's actual writes are visible on screen before Piotr sees it.
 *
 * Try it: click a cell to focus it, Ctrl/Cmd+C on another populated cell (or
 * range via Shift+arrows) to copy, then Ctrl/Cmd+V on the focus target.
 */
import React, { useMemo, useState } from 'react';

import type { FormatRule } from '@/components/MyWork/table/ConditionalFormatting';
import type { ColumnDef, TableNode } from '@/components/MyWork/table/tableTypes';
import { PlatformGridView } from '@/components/MyWork/table/ViewRouter';
import type { FieldType } from '@/types/tablePlatform';

const isPl = (new URLSearchParams(window.location.search).get('lang') || 'pl') !== 'en';

// ── Mock schema (platform fields → ColumnDef mirror) ────────────────────────
// `total` is marked isComputed so the harness can also show paste correctly
// skipping a computed field (per KRYTERIUM ODBIORU — never overwrite one).
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
  {
    id: 'total',
    name: isPl ? 'Suma (obliczana)' : 'Total (computed)',
    fieldType: 'singleLineText',
    isComputed: true,
  },
];

const VISIBLE_COLUMNS: ColumnDef[] = FIELDS.map((f) => ({
  key: f.id,
  header: f.name,
  type: 'text',
  visible: true,
  width: 220,
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
      label: isPl ? 'Automatyzacja faktur — pilot' : 'Invoice automation — pilot',
      owner: 'Anna K.',
      status: isPl ? 'W toku' : 'In progress',
      total: '12',
    },
  },
  {
    id: 'rec-2',
    type: 'idea',
    data: {
      label: isPl ? 'Skalowanie na 3 procesy' : 'Scale to 3 processes',
      owner: 'Marek T.',
      status: isPl ? 'Do zrobienia' : 'To do',
      total: '7',
    },
  },
  {
    id: 'rec-3',
    type: 'idea',
    data: {
      label: isPl ? 'Integracja z ERP' : 'ERP integration',
      owner: 'Zofia L.',
      status: isPl ? 'Zablokowane' : 'Blocked',
      total: '3',
    },
  },
];

const NO_FORMAT_RULES: FormatRule[] = [];

export function IdeaTableToolPasteScreen(): React.ReactElement {
  const [rows, setRows] = useState<TableNode[]>(INITIAL_ROWS);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [editingCellId, setEditingCellId] = useState<string | null>(null);

  const platformFieldById = useMemo(() => PLATFORM_FIELD_BY_ID, []);

  const handleFieldChange = (nodeId: string, field: string, value: unknown) => {
    setRows((prev) =>
      prev.map((r) => (r.id === nodeId ? { ...r, data: { ...r.data, [field]: value } } : r))
    );
  };

  return (
    <div className="flex h-screen w-full flex-col bg-c-bg p-6">
      <div className="mb-3 text-[11px] text-c-text-muted">
        {isPl
          ? 'Dev-render — wklejanie Ctrl/Cmd+V (PlatformGridView, Z16b domknięcie). Kolumna "Suma (obliczana)" jest isComputed — wklejanie ją pomija.'
          : 'Dev-render — Ctrl/Cmd+V paste (PlatformGridView, Z16b close-out). "Total (computed)" column is isComputed — paste skips it.'}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <PlatformGridView
          processedRows={rows}
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
        />
      </div>
    </div>
  );
}

export default IdeaTableToolPasteScreen;
