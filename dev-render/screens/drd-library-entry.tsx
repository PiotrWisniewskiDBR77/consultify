/**
 * DrdLibraryEntryHarness — screenshot-only harness for "01-library-light".
 *
 * ★ THIS IS NOT A MOCK OF THE REAL `AssessmentHub` (2700+ lines, deeply
 * wired to stores/APIs) — reproducing it here would risk exactly the
 * "moduł kleci własną tabelę" trap CLAUDE.md forbids. Instead this uses the
 * REAL `StandardModuleBar` + `StandardTable` + `StandardPreview` canon
 * components with one mock DRD row, to illustrate honestly what the
 * Library/Processes entry point looks like and where the click leads —
 * nothing more. Disclosed as such in the final report; not a substitute for
 * a real AssessmentHub screenshot.
 *
 * 2026-08-30 uwaga właściciela ("nie ma żadnego podglądu" / "kolumny nie są
 * wystarczające") — obie naprawione TUTAJ, 1:1 ze wzorcem realnego
 * `AssessmentHub` processes tab (src/components/assessment/AssessmentHub.tsx
 * `tableColumns` default branch + `PreviewPaneAside`/`StandardPreview` w
 * sekcji `activeTab === 'processes'`):
 *   - kolumny: Typ (ikona+skrót frameworku) · Nazwa · Status · Postęp (pasek,
 *     `StandardTable`/`FilterableTable` renderuje go automatycznie dla
 *     `column.id === 'progress'`) · Autor · Zaktualizowano — te same 6 co w
 *     realnym ekranie, nie wymyślone na potrzeby harnessu.
 *   - podgląd: klik wiersza otwiera `StandardPreview` w `PreviewPaneAside`
 *     (ta sama fasada co realny ekran) z kartą meta (status+postęp), tabelą
 *     właściwości (respondent, sesje wywiadu, oś DRD, następny krok) i akcją
 *     „Otwórz proces".
 */
import { Activity, ExternalLink, FolderKanban } from 'lucide-react';
import React, { useState } from 'react';

import { PreviewPaneAside } from '../../src/components/shared/PreviewPane';
import { StandardModuleBar } from '../../src/components/standard/StandardModuleBar';
import { StandardPreview } from '../../src/components/standard/StandardPreview';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '../../src/components/standard/StandardTable';

const COLUMNS: TableColumn[] = [
  {
    id: 'framework',
    label: 'Typ',
    width: '90px',
    render: () => (
      <div className="flex items-center gap-2">
        <Activity size={16} className="text-c-text-muted" />
        <span className="font-mono text-xs font-bold text-c-text-secondary">DRD</span>
      </div>
    ),
  },
  { id: 'name', label: 'Nazwa', sortable: true },
  { id: 'status', label: 'Status' },
  { id: 'progress', label: 'Postęp', width: '150px' },
  { id: 'createdBy', label: 'Autor', width: '140px' },
  { id: 'updatedAt', label: 'Zaktualizowano', width: '120px', sortable: true },
];

interface DrdRow extends TableRow {
  name: string;
  framework: string;
  status: string;
  progress: number;
  createdBy: string;
  updatedAt: string;
  respondent: string;
  sessionsDone: number;
  sessionsTotal: number;
  axis: string;
  nextStep: string;
}

const ROWS: DrdRow[] = [
  {
    id: 'drd-demo-1',
    name: 'DBR77 — Digital Readiness Diagnosis (demo)',
    framework: 'DRD',
    status: 'W trakcie wywiadu',
    progress: 42,
    createdBy: 'Anna Nowak',
    updatedAt: '2026-08-13',
    respondent: 'Marek Zieliński (Dyrektor operacyjny)',
    sessionsDone: 3,
    sessionsTotal: 7,
    axis: 'Oś 2 — Procesy i dane',
    nextStep: 'Dokończyć wywiad na osi „Procesy i dane" (4 pytania zostały).',
  },
];

export const DrdLibraryEntryHarness: React.FC<{ onOpen?: (id: string) => void }> = ({ onOpen }) => {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const selectedRow = ROWS.find((row) => row.id === selectedRowId) ?? null;

  return (
    <div className="flex h-full flex-col bg-c-bg" data-testid="drd-library-entry-harness">
      {/* Etykiety 1:1 z realnym AssessmentHub (src/components/assessment/AssessmentHub.tsx,
          klucze i18n assessment.hub.tabs.*) — harness był po angielsku mimo że
          resztę ekranu (tabela, flaga) renderuje po polsku (mieszany język). */}
      <StandardModuleBar
        breadcrumbs={[{ label: 'Ocena' }, { label: 'Biblioteka' }, { label: 'Procesy' }]}
        tabs={[
          { id: 'library', label: 'Biblioteka' },
          { id: 'processes', label: 'Procesy' },
          { id: 'outputs', label: 'Wnioski' },
          { id: 'reports', label: 'Raporty' },
          { id: 'initiatives', label: 'Inicjatywy' },
        ]}
        activeTab="processes"
      />
      {/* Pasek wyjaśniający flagę dla inżyniera obsługującego harness — NIE
          część produktu. Bez `data-dev-render-chrome` zrzuty `grafika-zrzuty.mjs`
          (chowa elementy z tym atrybutem) pokazywały go jako pasek z kodem
          w kadrze — pułapka z CLAUDE.md #7. Przegląd nocny 03-wywiad/05-ocena,
          2026-08-30 (ta sama klasa defektu naprawiona w siri-workspace.tsx). */}
      <div
        data-dev-render-chrome="true"
        className="flex items-center gap-2 border-b border-c-border-subtle bg-c-info/5 px-4 py-2 text-xs text-c-text-secondary"
      >
        <FolderKanban size={13} className="text-c-info" />
        Flaga{' '}
        <code className="rounded bg-c-surface-raised px-1 py-0.5">drdMethodWorkspaceSliceV1</code> =
        ON — PODWÓJNE kliknięcie wiersza DRD (albo „Otwórz proces") otwiera{' '}
        <code className="rounded bg-c-surface-raised px-1 py-0.5">MethodWorkspaceShell</code>{' '}
        zamiast starego edytora, pod tym samym URL{' '}
        <code className="rounded bg-c-surface-raised px-1 py-0.5">/assessment/drd/:id</code>.
        Pojedyncze kliknięcie — jak w realnym AssessmentHub — tylko otwiera podgląd z prawej, NIE
        nawiguje.
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-auto p-4">
          <StandardTable
            columns={COLUMNS}
            data={ROWS}
            selectedRowId={selectedRowId}
            onRowClick={(row) => {
              setSelectedRowId(row.id);
            }}
            onRowDoubleClick={(row) => {
              onOpen?.(row.id);
            }}
          />
        </div>
        {selectedRow ? (
          <PreviewPaneAside ariaLabel="Podgląd procesu DRD">
            <StandardPreview
              title={selectedRow.name}
              onClose={() => setSelectedRowId(null)}
              onOpenFull={() => onOpen?.(selectedRow.id)}
              openLabel="Otwórz proces"
              meta={{
                pills: [
                  { label: selectedRow.status, tone: 'info' },
                  { label: `${selectedRow.progress}%`, tone: 'neutral' },
                ],
                trailing: (
                  <span className="text-[11px] font-semibold text-c-text-secondary">
                    {selectedRow.updatedAt}
                  </span>
                ),
              }}
              details={{
                label: 'Stan wywiadu',
                properties: [
                  { id: 'respondent', label: 'Respondent', value: selectedRow.respondent },
                  {
                    id: 'sessions',
                    label: 'Sesje wywiadu',
                    value: `${selectedRow.sessionsDone}/${selectedRow.sessionsTotal}`,
                  },
                  { id: 'axis', label: 'Bieżąca oś', value: selectedRow.axis },
                  { id: 'author', label: 'Autor', value: selectedRow.createdBy },
                  { id: 'next', label: 'Następny krok', value: selectedRow.nextStep },
                ],
              }}
              relations={[]}
              actions={{
                informational: [
                  {
                    id: 'open-process',
                    variant: 'neutral',
                    label: 'Otwórz proces',
                    icon: ExternalLink,
                    shortcut: 'O',
                    onClick: () => onOpen?.(selectedRow.id),
                  },
                ],
              }}
            />
          </PreviewPaneAside>
        ) : null}
      </div>
    </div>
  );
};

export default DrdLibraryEntryHarness;
