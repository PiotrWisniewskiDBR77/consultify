/**
 * Dev-render host for the K1/Airtable-parity ROW KEBAB inside the Idea Table
 * TOOL (the metadata-first PlatformGridView — NOT the outer Ideas list).
 *
 * WHY THIS HARNESS EXISTS (CLAUDE.md #7 + audyt-idee-2026-07-22):
 * The new row context-menu lives in `PlatformGridView` (src/.../table/ViewRouter.tsx),
 * which only renders in-app when `tablePlatformMetadataFirst` resolves a live
 * platform base — and the live trolley DB currently has ZERO platform bases for
 * any real idea (verified by SQL), so `usePlatform` is false everywhere and the
 * kebab is unreachable through the running app. `PlatformGridView` is
 * pure-presentational (all data + handlers via props), so we mount the REAL
 * component here with a mocked TableNode[]/field set — the same pattern as the
 * other dev-render screens — to screenshot the kebab (light+dark) BEFORE Piotr
 * sees it. Right-click a row to open the menu.
 */
import React, { useMemo, useState } from 'react';

import type { FormatRule } from '@/components/MyWork/table/ConditionalFormatting';
import type { ColumnDef, TableNode } from '@/components/MyWork/table/tableTypes';
import { PlatformGridView } from '@/components/MyWork/table/ViewRouter';
import type { FieldType } from '@/types/tablePlatform';

const isPl = (new URLSearchParams(window.location.search).get('lang') || 'pl') !== 'en';

// ── Mock schema (platform fields → ColumnDef mirror) ────────────────────────
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
  { id: 'notes', name: isPl ? 'Notatki' : 'Notes', fieldType: 'longText', isComputed: false },
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

const ROWS: TableNode[] = [
  {
    id: 'rec-1',
    type: 'idea',
    data: {
      label: isPl ? 'Automatyzacja faktur — pilot' : 'Invoice automation — pilot',
      owner: 'Anna K.',
      status: isPl ? 'W toku' : 'In progress',
      notes: isPl ? 'ROI 4 mies.' : 'ROI 4 mo.',
    },
  },
  {
    id: 'rec-2',
    type: 'idea',
    data: {
      label: isPl ? 'Skalowanie na 3 procesy' : 'Scale to 3 processes',
      owner: 'Marek T.',
      status: isPl ? 'Do zrobienia' : 'To do',
      notes: 'Q3',
    },
  },
  {
    id: 'rec-3',
    type: 'idea',
    data: {
      label: isPl ? 'Integracja z ERP' : 'ERP integration',
      owner: 'Zofia L.',
      status: isPl ? 'Zablokowane' : 'Blocked',
      notes: isPl ? '6 tyg. pilotażu' : '6 wk pilot',
    },
  },
];

const NO_FORMAT_RULES: FormatRule[] = [];

export function IdeaTableToolKebabScreen(): React.ReactElement {
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [editingCellId, setEditingCellId] = useState<string | null>(null);

  const platformFieldById = useMemo(() => PLATFORM_FIELD_BY_ID, []);

  return (
    <div className="flex h-screen w-full flex-col bg-c-bg p-6">
      <div className="mb-3 text-[11px] text-c-text-muted">
        {isPl
          ? 'Dev-render — K1 kebab wiersza (PlatformGridView). Prawy-klik na wierszu otwiera menu.'
          : 'Dev-render — K1 row kebab (PlatformGridView). Right-click a row to open the menu.'}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <PlatformGridView
          processedRows={ROWS}
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
          handleFieldChange={() => {}}
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

export default IdeaTableToolKebabScreen;
