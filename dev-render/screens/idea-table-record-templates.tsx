/**
 * RISK-06 — dev-render host for the REAL `<RecordTemplateManager>` (src/
 * components/MyWork/table/RecordTemplateManager.tsx), CLAUDE.md #7 (owner is
 * never the first visual tester).
 *
 * This component was a DEAD MOUNT: `grep -rln RecordTemplateManager src/`
 * only ever found the file itself + `ideaActionRegistry.ts`'s `source:`
 * comment strings — zero components imported it, despite a real backend
 * (server/src/routes/table-platform.routes.ts `/tables/:tableId/
 * record-templates`) and two registered actions (`table.record_template.*`).
 * Now wired into `TableToolbar`'s "More" menu (Tools section, usePlatform
 * only) — see `tests/components/MyWork/TableToolbar.recordTemplates.test.tsx`
 * for the reachability proof. This harness screenshots the dialog itself
 * BEFORE the owner sees it live.
 *
 * `RecordTemplateManager` is the REAL production component — no
 * re-implementation. It self-fetches via `TablePlatformApi.listRecordTemplates`
 * (a named async export, not a patchable `Api`-style singleton object — see
 * decision-record.tsx's comment on why `Api` is patchable; this module isn't
 * that shape). Left UNMOCKED: in this harness (no backend) the fetch fails
 * over the network and the component's own catch path takes over — exactly
 * what a real user sees on a table with zero templates (empty state,
 * "No templates yet"). That is a genuine, honest render of the list chrome,
 * not a fabricated one.
 *
 * The "New Template" editor (`TemplateEditor`, opened via the "+ New"
 * button) does NOT fetch anything — it's a pure form keyed off the `fields`
 * prop — so clicking through to it in the live dev-render tab gives a fully
 * real, fully populated second screenshot (every editable field type:
 * singleLineText, longText, number, singleSelect, checkbox, date).
 *
 * URL: ?screen=idea-table-record-templates[&lang=pl|en][&theme=light|dark]
 */
import React from 'react';

import { RecordTemplateManager } from '@/components/MyWork/table/RecordTemplateManager';
import type { TablePlatformField } from '@/types/tablePlatform';

const isPl = (new URLSearchParams(window.location.search).get('lang') || 'pl') !== 'en';

const FIELDS: TablePlatformField[] = [
  {
    id: 'label',
    tableId: 'mock-table',
    name: isPl ? 'Nazwa' : 'Label',
    fieldType: 'singleLineText',
    options: {},
    isComputed: false,
    order: 0,
    createdAt: '2026-08-12T09:00:00Z',
    updatedAt: '2026-08-12T09:00:00Z',
  },
  {
    id: 'status',
    tableId: 'mock-table',
    name: 'Status',
    fieldType: 'singleSelect',
    options: {
      options: [
        { id: 'todo', name: isPl ? 'Do zrobienia' : 'To do' },
        { id: 'in_progress', name: isPl ? 'W toku' : 'In progress' },
        { id: 'done', name: isPl ? 'Zrobione' : 'Done' },
      ],
    },
    isComputed: false,
    order: 1,
    createdAt: '2026-08-12T09:00:00Z',
    updatedAt: '2026-08-12T09:00:00Z',
  },
  {
    id: 'owner',
    tableId: 'mock-table',
    name: isPl ? 'Właściciel' : 'Owner',
    fieldType: 'singleLineText',
    options: {},
    isComputed: false,
    order: 2,
    createdAt: '2026-08-12T09:00:00Z',
    updatedAt: '2026-08-12T09:00:00Z',
  },
  {
    id: 'effort',
    tableId: 'mock-table',
    name: isPl ? 'Wysiłek' : 'Effort',
    fieldType: 'number',
    options: {},
    isComputed: false,
    order: 3,
    createdAt: '2026-08-12T09:00:00Z',
    updatedAt: '2026-08-12T09:00:00Z',
  },
  {
    id: 'due_date',
    tableId: 'mock-table',
    name: isPl ? 'Termin' : 'Due date',
    fieldType: 'date',
    options: {},
    isComputed: false,
    order: 4,
    createdAt: '2026-08-12T09:00:00Z',
    updatedAt: '2026-08-12T09:00:00Z',
  },
  {
    id: 'urgent',
    tableId: 'mock-table',
    name: isPl ? 'Pilne' : 'Urgent',
    fieldType: 'checkbox',
    options: {},
    isComputed: false,
    order: 5,
    createdAt: '2026-08-12T09:00:00Z',
    updatedAt: '2026-08-12T09:00:00Z',
  },
  {
    id: 'notes',
    tableId: 'mock-table',
    name: isPl ? 'Notatki' : 'Notes',
    fieldType: 'longText',
    options: {},
    isComputed: false,
    order: 6,
    createdAt: '2026-08-12T09:00:00Z',
    updatedAt: '2026-08-12T09:00:00Z',
  },
  // Computed field — must be EXCLUDED from TemplateEditor's editable list
  // (EDITABLE_FIELD_TYPES check + `!f.isComputed`).
  {
    id: 'age_days',
    tableId: 'mock-table',
    name: isPl ? 'Wiek (dni)' : 'Age (days)',
    fieldType: 'number',
    options: {},
    isComputed: true,
    order: 7,
    createdAt: '2026-08-12T09:00:00Z',
    updatedAt: '2026-08-12T09:00:00Z',
  },
];

export function IdeaTableRecordTemplatesScreen(): React.ReactElement {
  return (
    <div className="flex h-screen w-full flex-col bg-c-bg p-6">
      <div className="mb-3 text-[11px] text-c-text-muted">
        {isPl
          ? 'Dev-render — RISK-06 RecordTemplateManager. Brak backendu w tym harnessie ⇒ lista templates naturalnie pusta ("No templates yet"); kliknij "+ New", aby zobaczyć TemplateEditor (nie robi fetchu, więc renderuje się w pełni, ze wszystkimi typami pól).'
          : 'Dev-render — RISK-06 RecordTemplateManager. No backend in this harness ⇒ the template list is naturally empty ("No templates yet"); click "+ New" to see TemplateEditor (does not fetch, so it renders fully, with every field type).'}
      </div>
      <RecordTemplateManager
        open
        onClose={() => {}}
        tableId="mock-table"
        fields={FIELDS}
        onUseTemplate={() => {}}
        locked={false}
      />
    </div>
  );
}

export default IdeaTableRecordTemplatesScreen;
