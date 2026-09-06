import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// 1.1-N (2026-09-06, DEC-404c) — słowo właściciela o prawym rogu warsztatu:
// "Menu 3" (klaster w rogu top bara: Iskra · Zapisano przed chwilą / Pokaż
// panel / Teresa / kebab / Konwertuj) miał DWA wejścia do tego samego prawego
// panelu — ghost pigułka "Teresa" (`buildIdeaMenu1Chips` handlers.onDiscuss)
// OBOK zakładki "Teresa" wewnątrz kanonicznego panelu (`IdeaElementInspector`,
// "Składnik | Teresa", zostaje BEZ ZMIAN). Naprawa zdejmuje TYLKO ghost
// pigułkę z klastra — jedno wejście do panelu: "Pokaż panel" gdy zamknięty,
// zakładka "Teresa" gdy otwarty.
//
// Source-level regression lock (wzorzec: `IdeaMapWorkspace.candidateGate.
// ownerFeedback.test.ts` — komponent za duży/stanowy, by montować go w
// całości w teście jednostkowym). Mutacja: przywrócenie
// `onDiscuss: handleDiscussWithTeresa,` w obiekcie `handlers` przekazanym do
// `buildIdeaMenu1Chips` MUSI zaczerwienić ten test.
const source = fs.readFileSync(path.resolve(__dirname, '../IdeaMapWorkspace.tsx'), 'utf8');

describe('1.1-N: Menu 3 (róg top bara) nie renderuje ghost pigułki "Teresa"', () => {
  it('melsCanvasChips (Menu 1/Menu 3 top-bar chips) nie przekazuje handlers.onDiscuss do buildIdeaMenu1Chips', () => {
    const start = source.indexOf('const melsCanvasChips = useMemo(');
    expect(start).toBeGreaterThan(0);
    const end = source.indexOf('\n  );', start);
    expect(end).toBeGreaterThan(start);
    const body = source.slice(start, end);
    // ★ To jest dokładnie mutacja, która musi dać RED: przywrócenie tej linii
    // (ghost pigułka "Teresa" z powrotem w Menu 3) łamie DEC-404c.
    expect(body).not.toContain('onDiscuss:');
    expect(body).not.toContain('handleDiscussWithTeresa');
  });

  it('handleDiscussWithTeresa zostaje w kodzie — dalej napędza zakładkę panelu i legacy toolbar', () => {
    // Usunięcie CAŁEJ funkcji byłoby nadgorliwością: `renderIdeaRightPanel`
    // (klik "Sugestie AI" w Menu 2) i legacy `IdeaWorkspaceToolbar` (gałąź
    // `!melsCanvasEnabled`, dziś nieosiągalna) dalej po nią sięgają.
    expect(source).toContain('const handleDiscussWithTeresa = useCallback(');
    expect(source.match(/handleDiscussWithTeresa/g)?.length).toBeGreaterThanOrEqual(3);
  });

  // ★ AKTUALIZACJA 1.1-N2 (2026-09-06, DEC-409): pigułka „Pokaż panel" została
  // zastąpiona przyciskiem „Panel" w rogu (`IdeaCornerActions`, testid
  // `idea-corner-panel`) — patrz `IdeaMapWorkspace.rogWarsztatu1-1-n2.test.ts`.
  // Warunek kroku 1 zostaje ten sam co do treści: klaster rogu ma JEDNO jawne
  // wejście do panelu i ŻADNEJ pigułki „Teresa" — wejście AI to przycisk „AI"
  // otwierający zakładkę tego samego panelu.
  it('róg ma jawne wejście do panelu (przycisk „Panel") i żadnej pigułki Teresa', () => {
    expect(source).toContain('<IdeaCornerActions');
    expect(source).toContain("t('mindmap.cornerPanel', 'Panel')");
    expect(source).not.toContain('data-testid="idea-menu1-teresa"');
  });
});
