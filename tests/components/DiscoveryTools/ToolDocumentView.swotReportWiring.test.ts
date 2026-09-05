/**
 * Odbiór 05.09 (04-narzędzia, defekt 6 „tools-swot-report").
 *
 * ZMIERZONE, jak dojść z realnej sesji SWOT do raportu z zatwierdzonego obrazu:
 *   1. renderer raportu ISTNIEJE — `renderToolReport` (src/toolOutputs/renderReport.ts)
 *      produkuje dokument, który rysuje `ToolReportView`;
 *   2. listę raportów danej sesji pokazuje `ToolOutputsPanel`;
 *   3. ...ale `ToolOutputsPanel` był renderowany WYŁĄCZNIE w `ToolWorkspace`,
 *      a hub narzędzi otwiera sesję przez `ToolDocumentView`;
 *   4. `ToolWorkspace` zostaje dziś tylko w `OperationalToolsView`, którego
 *      NIE MA w `AppRoutes.tsx`.
 * Wniosek: raport był zbudowany, ale niepodłączony — z realnej sesji nie dało
 * się do niego dojść żadną trasą. Naprawa: `ToolDocumentView` renderuje ten sam
 * panel pod tą samą bramką (APPROVED + id sesji).
 *
 * Ten test pilnuje przewodu na źródle. Powód nazwany wprost: `ToolDocumentView`
 * wywraca się przy montowaniu w jsdom (osobna robota), a bez tej asercji
 * przewód mógłby zniknąć niezauważony — dokładnie tak, jak zniknął wcześniej.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

describe('Raport SWOT — przewód z sesji do ToolOutputsPanel', () => {
  const toolDocumentView = read('src/components/DiscoveryTools/ToolDocumentView.tsx');

  it('ToolDocumentView renderuje ToolOutputsPanel pod bramką APPROVED + id sesji', () => {
    expect(toolDocumentView).toContain(
      "import ToolOutputsPanel from './report/ToolOutputsPanel'"
    );
    expect(toolDocumentView).toMatch(
      /toolStatus === 'APPROVED' && toolSessionId \?[\s\S]{0,400}<ToolOutputsPanel toolSessionId=\{toolSessionId\} \/>/
    );
  });

  it('hub narzędzi otwiera sesję z warsztatem właśnie przez ToolDocumentView', () => {
    const hub = read('src/components/Discovery/DiscoveryToolsHub.tsx');
    expect(hub).toMatch(/hasDedicatedToolDocumentView\(toolType\)/);
    expect(hub).toMatch(/<ToolDocumentView\s/);
  });

  it('ToolWorkspace nadal nie jest na żadnej trasie — dlatego przewód musi być w ToolDocumentView', () => {
    const routes = read('src/routes/AppRoutes.tsx');
    expect(routes).not.toMatch(/OperationalToolsView/);
    // gdyby ToolWorkspace kiedyś wrócił na trasę, ten test ma zmusić do
    // ponownego przemyślenia, gdzie żyje panel rezultatów
    expect(routes).not.toMatch(/<ToolWorkspace\s/);
  });

  it('renderer raportu istnieje i jest tym, którego używa ToolOutputsPanel', () => {
    expect(read('src/toolOutputs/renderReport.ts')).toContain('REPORT_RENDERER_VERSION');
    const panel = read('src/components/DiscoveryTools/report/ToolOutputsPanel.tsx');
    expect(panel).toContain("import ToolReportView from '@/components/DiscoveryTools/report/ToolReportView'");
    expect(panel).toMatch(/<ToolReportView doc=\{viewingDoc\} \/>/);
  });
});
