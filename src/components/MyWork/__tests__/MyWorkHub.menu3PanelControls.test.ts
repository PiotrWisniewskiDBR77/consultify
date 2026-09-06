import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// MP-MENU3 (2026-09-06): `MyWorkHub.tsx` renderowało własne Menu 3 (chipy
// Skrzynki) całkowicie POZA kanonicznym `StandardModuleBar`, więc pigułki
// „Teresa"/„Pokaż panel" (jeden prawy panel, `useJedenPanel`) nigdy się tu
// nie renderowały — mimo że `InboxContent` już hostuje `JedenPrawyPanel`
// (patrz `StandardModuleBar.tsx` `useStandardPanelControls`, ta sama logika
// co w `InterviewHub`). Naprawa wstrzykuje te same pigułki BEZPOŚREDNIO do
// istniejącego prawego klastra Menu 3 Skrzynki (bez montowania drugiego
// Menu 2 — `ModuleNavBar` zawsze renderuje własną lupę, co dałoby DRUGĄ,
// osieroconą ikonę wyszukiwania nad już istniejącym paskiem).
//
// Źródłowy test statyczny (wzorzec: `IdeaMapWorkspace.candidateGate.
// ownerFeedback.test.ts`) — komponent zbyt duży/stanowy, by montować go
// w całości w teście jednostkowym.
const source = fs.readFileSync(path.resolve(__dirname, '../MyWorkHub.tsx'), 'utf8');

describe('MyWorkHub renderuje kanoniczny StandardModuleBar (MP-MENU3)', () => {
  it('importuje useStandardPanelControls z kanonicznej fasady StandardModuleBar', () => {
    expect(source).toContain(
      "import { useStandardPanelControls } from '@/components/standard/StandardModuleBar';"
    );
  });

  it('wywołuje hook bezwarunkowo na szczycie komponentu (reguły hooków)', () => {
    expect(source).toContain('const jedenPanelControls = useStandardPanelControls();');
  });

  it('renderuje pigułki w prawym klastrze Menu 3 Skrzynki — tryb normalny', () => {
    // Sąsiaduje z istniejącym przyciskiem „Wstępna klasyfikacja AI" (AI Triage) —
    // ten sam prawy klaster (`MENU_3_RIGHT_CLASS`), nie osobny wiersz.
    const aiTriageIdx = source.indexOf("t('myWork.hub.aITriage', 'Wstępna klasyfikacja AI')");
    const panelControlsIdx = source.indexOf('{jedenPanelControls}', aiTriageIdx);
    expect(aiTriageIdx).toBeGreaterThan(0);
    expect(panelControlsIdx).toBeGreaterThan(aiTriageIdx);
  });

  it('renderuje pigułki także w trybie bulk-select (spójność ze StandardModuleBar)', () => {
    const dismissIdx = source.indexOf("bulkActions?.triage('dismiss')");
    const panelControlsIdx = source.indexOf('{jedenPanelControls}', dismissIdx);
    expect(dismissIdx).toBeGreaterThan(0);
    expect(panelControlsIdx).toBeGreaterThan(dismissIdx);
  });
});
