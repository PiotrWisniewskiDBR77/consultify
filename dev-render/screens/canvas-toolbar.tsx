/**
 * Mock host for <CanvasToolbarV2> — the lightweight canvas toolbar redesign
 * (Harvard/wdrozenie-100/_PRZEGLAD_DOMOWY_WYNIKI_2026-07-10.md #87-#87d).
 *
 * Reuses the REAL component (no re-implementation), feeds it a realistic
 * zone/template contract, and renders it over a plain canvas-body mock so the
 * supervisor can screenshot the toolbar in isolation before Piotr sees it
 * (CLAUDE.md #7). Status feedback + "busy" spinner are wired to local state
 * so the click interactions are pokeable, matching the honesty doctrine
 * (REAL/PARTIAL badges on document/idea zone items where the backend gap is
 * real today).
 */
import React, { useState } from 'react';

import {
  CANVAS_TOOLBAR_V2_ICONS,
  CanvasToolbarV2,
  type CanvasToolbarV2View,
  type CanvasToolbarV2ZoneItem,
} from '../../src/components/MyWork/canvas/CanvasToolbarV2';

const TEMPLATES = [
  { id: 'zbierz-mysli', label: 'Zbierz myśli', capability: 'real' as const },
  { id: 'napisz-dokument', label: 'Napisz dokument', capability: 'real' as const },
  { id: 'zrob-research', label: 'Zrób research', capability: 'partial' as const },
  { id: 'przygotuj-decyzje', label: 'Przygotuj decyzję', capability: 'partial' as const },
  { id: 'rozpisz-plan', label: 'Rozpisz plan', capability: 'real' as const },
];

export function CanvasToolbarScreen(): React.ReactElement {
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [view, setView] = useState<CanvasToolbarV2View>('document');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState('Gotowy.');

  function runMock(id: string, label: string, ms = 700) {
    setBusyId(id);
    setStatus(`${label}...`);
    window.setTimeout(() => {
      setBusyId(null);
      setStatus(`${label} — gotowe.`);
    }, ms);
  }

  const documentActions: CanvasToolbarV2ZoneItem[] = [
    {
      id: 'presentation',
      label: 'Prezentacja',
      icon: CANVAS_TOOLBAR_V2_ICONS.presentation,
      capability: 'real',
      busy: busyId === 'presentation',
      onClick: () => runMock('presentation', 'Tworzenie prezentacji z canvasu'),
    },
    {
      id: 'report',
      label: 'Raport',
      icon: CANVAS_TOOLBAR_V2_ICONS.report,
      capability: 'real',
      busy: busyId === 'report',
      onClick: () => runMock('report', 'Tworzenie raportu z canvasu'),
    },
    {
      id: 'excel',
      label: 'Excel',
      icon: CANVAS_TOOLBAR_V2_ICONS.excel,
      capability: 'real',
      busy: busyId === 'excel',
      onClick: () => runMock('excel', 'Tworzenie arkusza z canvasu'),
    },
  ];

  const ideaActions: CanvasToolbarV2ZoneItem[] = [
    {
      id: 'mindmap',
      label: 'Mind Map',
      icon: CANVAS_TOOLBAR_V2_ICONS.mindMap,
      capability: 'partial',
      busy: busyId === 'mindmap',
      onClick: () => runMock('mindmap', 'Wysyłanie do Mind Map'),
    },
    {
      id: 'process-flow',
      label: 'Process Flow',
      icon: CANVAS_TOOLBAR_V2_ICONS.processFlow,
      capability: 'partial',
      busy: busyId === 'process-flow',
      onClick: () => runMock('process-flow', 'Wysyłanie do Process Flow'),
    },
    {
      id: 'whiteboard',
      label: 'Whiteboard',
      icon: CANVAS_TOOLBAR_V2_ICONS.whiteboard,
      capability: 'partial',
      busy: busyId === 'whiteboard',
      onClick: () => runMock('whiteboard', 'Wysyłanie do Whiteboard'),
    },
    {
      id: 'idea-table',
      label: 'Tabela',
      icon: CANVAS_TOOLBAR_V2_ICONS.ideaTable,
      capability: 'partial',
      busy: busyId === 'idea-table',
      onClick: () => runMock('idea-table', 'Wysyłanie do Tabeli'),
    },
    {
      id: 'note',
      label: 'Notatka',
      icon: CANVAS_TOOLBAR_V2_ICONS.note,
      capability: 'real',
      busy: busyId === 'note',
      onClick: () => runMock('note', 'Zapis jako notatka'),
    },
  ];

  return (
    <div className="flex h-screen min-h-0 flex-col bg-c-bg text-c-text">
      <div className="border-b border-c-border-subtle bg-c-surface px-4 py-2 text-xs text-c-text-muted">
        Harness: CanvasToolbarV2 (dev-render only, nie wysyła do backendu — kliknięcia symulują opóźnienie)
      </div>
      <CanvasToolbarV2
        onNewCanvasBlank={() => {
          setActiveTemplateId(null);
          setStatus('Nowy czysty canvas.');
        }}
        templates={TEMPLATES}
        activeTemplateId={activeTemplateId}
        onSelectTemplate={(id) => {
          setActiveTemplateId(id);
          const label = TEMPLATES.find((t) => t.id === id)?.label ?? id;
          setStatus(`Nowy canvas z template'u: ${label}.`);
        }}
        documentActions={documentActions}
        ideaActions={ideaActions}
        onImportMarkdown={() => runMock('import-md', 'Import Markdown')}
        onExportMarkdown={() => runMock('export-md', 'Export Markdown')}
        view={view}
        onToggleView={(next) => {
          setView(next);
          setStatus(`Widok: ${next === 'document' ? 'dokument' : 'markdown'}.`);
        }}
        onClose={() => setStatus('Zamknięcie canvasu (mock — no-op w harnessie).')}
        kebabItems={[
          { id: 'versions', label: 'Wersje', onClick: () => runMock('versions', 'Otwieranie historii wersji') },
          { id: 'reset', label: 'Reset', onClick: () => runMock('reset', 'Reset canvasu') },
          {
            id: 'capabilities',
            label: 'Capabilities & workflow',
            onClick: () => runMock('capabilities', 'Otwieranie panelu capabilities'),
          },
        ]}
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-c-border-subtle bg-c-surface p-6">
          <div className="text-sm font-semibold text-c-text">Company Work Note</div>
          <p className="mt-2 text-sm leading-6 text-c-text-secondary">
            Treść canvasu (mock) — pasek powyżej to pełna specyfikacja L→R: New Canvas · dokumenty
            (Prezentacja/Raport/Excel) · idea+notatka (Mind Map/Process Flow/Whiteboard/Tabela/Notatka) ·
            import/export MD · widok · X · kebab.
          </p>
        </div>
      </div>
      <div className="border-t border-c-border-subtle bg-c-surface px-4 py-2 text-xs text-c-text-muted">
        Status: {status}
      </div>
    </div>
  );
}

export default CanvasToolbarScreen;
