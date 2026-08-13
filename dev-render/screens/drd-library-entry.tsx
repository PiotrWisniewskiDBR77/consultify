/**
 * DrdLibraryEntryHarness — screenshot-only harness for "01-library-light".
 *
 * ★ THIS IS NOT A MOCK OF THE REAL `AssessmentHub` (2700+ lines, deeply
 * wired to stores/APIs) — reproducing it here would risk exactly the
 * "moduł kleci własną tabelę" trap CLAUDE.md forbids. Instead this uses the
 * REAL `StandardModuleBar` + `StandardTable` canon components with one mock
 * DRD row, to illustrate honestly what the Library/Processes entry point
 * looks like and where the click leads — nothing more. Disclosed as such in
 * the final report; not a substitute for a real AssessmentHub screenshot.
 */
import { FolderKanban } from 'lucide-react';
import React, { useState } from 'react';

import { StandardModuleBar } from '../../src/components/standard/StandardModuleBar';
import { StandardTable, type TableColumn, type TableRow } from '../../src/components/standard/StandardTable';

const COLUMNS: TableColumn[] = [
  { id: 'name', label: 'Nazwa', sortable: true },
  { id: 'framework', label: 'Metodyka', sortable: true },
  { id: 'status', label: 'Status' },
  { id: 'updatedAt', label: 'Zaktualizowano' },
];

const ROWS: TableRow[] = [
  {
    id: 'drd-demo-1',
    name: 'DBR77 — Digital Readiness Diagnosis (demo)',
    framework: 'DRD',
    status: 'W trakcie wywiadu',
    updatedAt: '2026-08-13',
  },
];

export const DrdLibraryEntryHarness: React.FC<{ onOpen?: (id: string) => void }> = ({ onOpen }) => {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col bg-c-bg" data-testid="drd-library-entry-harness">
      <StandardModuleBar
        breadcrumbs={[{ label: 'Assessment' }, { label: 'Library' }, { label: 'Processes' }]}
        tabs={[
          { id: 'library', label: 'Library' },
          { id: 'processes', label: 'Processes' },
          { id: 'outputs', label: 'Outputs' },
          { id: 'reports', label: 'Reports' },
          { id: 'initiatives', label: 'Initiatives' },
        ]}
        activeTab="processes"
      />
      <div className="flex items-center gap-2 border-b border-c-border-subtle bg-c-info/5 px-4 py-2 text-xs text-c-text-secondary">
        <FolderKanban size={13} className="text-c-info" />
        Flaga <code className="rounded bg-c-surface-raised px-1 py-0.5">drdMethodWorkspaceSliceV1</code> = ON — kliknięcie
        wiersza DRD otwiera <code className="rounded bg-c-surface-raised px-1 py-0.5">MethodWorkspaceShell</code> zamiast
        starego edytora, pod tym samym URL <code className="rounded bg-c-surface-raised px-1 py-0.5">/assessment/drd/:id</code>.
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <StandardTable
          columns={COLUMNS}
          data={ROWS}
          selectedRowId={selectedRowId}
          onRowClick={(row) => {
            setSelectedRowId(row.id);
            onOpen?.(row.id);
          }}
        />
      </div>
    </div>
  );
};

export default DrdLibraryEntryHarness;
