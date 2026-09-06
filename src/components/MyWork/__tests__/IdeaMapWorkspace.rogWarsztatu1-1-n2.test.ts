import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildIdeaMenu1Chips } from '../ideaCanvasMelsChips';

/**
 * 1.1-N2 (2026-09-06, DEC-409) — słowa właściciela o prawym rogu warsztatu
 * Pomysłów (Process Flow, „i zrób tak we wszystkich ideach oczywiście"):
 *
 *   1. „To co jest w menu 2 to pozostałość, możesz ją wywalić"
 *        → segment ikon `WorkspacePanelStrip` (Narzędzia/Kontekst/Sugestie AI)
 *          znika z Menu 2 warsztatu.
 *   2. „przycisk konwertuj proponuję wrzucić do kebaba te 3 funkcje i usunąć
 *      ten przycisk"
 *        → primary CTA „Konwertuj ▾" znika; Inicjatywa · Taski · Raport wchodzą
 *          do kebaba Menu 1 jako sekcja „Konwertuj na…".
 *   3. „Zrobić przycisk panel i przycisk AI a nie teresa"
 *        → w rogu zostają DOKŁADNIE dwa przyciski: „Panel" i „AI".
 *   4. „usunąć iskra i zapisano przed chwilą"
 *        → chip statusu (`IdeaStatusChip`) znika; stan zapisu żyje wyłącznie w
 *          stanie krytycznym (konflikt = alert, błąd zapisu = toast).
 *
 * WSZYSTKIE cztery reprezentacje idei (mindmap · whiteboard · process_flow ·
 * table) przechodzą przez JEDEN host `IdeaMapWorkspace` i JEDEN builder chipów,
 * więc ten sam róg obowiązuje w każdym warsztacie — dlatego blokada jest
 * source-level na tych dwóch plikach (komponent jest za duży/stanowy, by
 * montować go w całości; ten sam wzorzec co
 * `IdeaMapWorkspace.menu3TeresaPillRemoved.test.ts`).
 */
const workspace = fs.readFileSync(path.resolve(__dirname, '../IdeaMapWorkspace.tsx'), 'utf8');
const menu1Bits = fs.readFileSync(path.resolve(__dirname, '../IdeaCanvasMenu1Bits.tsx'), 'utf8');
const hub = fs.readFileSync(path.resolve(__dirname, '../MyWorkHub.tsx'), 'utf8');

describe('1.1-N2: róg warsztatu idei ma dokładnie dwa przyciski — Panel i AI', () => {
  it('róg (primaryActionSlot) renderuje IdeaCornerActions, a nie CTA „Konwertuj"', () => {
    expect(workspace).toContain('<IdeaCornerActions');
    // MUTACJA: przywrócenie <IdeaConvertMenu .../> w primaryActionSlot = RED.
    expect(workspace).not.toContain('IdeaConvertMenu');
    expect(fs.existsSync(path.resolve(__dirname, '../IdeaConvertMenu.tsx'))).toBe(false);
  });

  it('IdeaCornerActions ma dokładnie dwa przyciski o etykietach „Panel" i „AI"', () => {
    const start = menu1Bits.indexOf('export const IdeaCornerActions');
    expect(start).toBeGreaterThan(0);
    const body = menu1Bits.slice(start);
    expect(body.match(/<button/g)?.length).toBe(2);
    expect(body).toContain('data-testid="idea-corner-panel"');
    expect(body).toContain('data-testid="idea-corner-ai"');
    expect(workspace).toContain("t('mindmap.cornerPanel', 'Panel')");
    expect(workspace).toContain("t('mindmap.cornerAi', 'AI')");
  });

  it('chip statusu („Kształtuje się · Zapisano przed chwilą") zniknął z rogu', () => {
    // MUTACJA: przywrócenie <IdeaStatusChip …/> w titleTrailingSlot = RED.
    expect(workspace).not.toContain('IdeaStatusChip');
    expect(menu1Bits).not.toContain('IdeaStatusChip');
    expect(workspace).not.toContain('titleTrailingSlot={');
    expect(workspace).not.toContain('data-testid="idea-show-panel"');
  });

  it('błąd zapisu ma własne wyjście (toast), skoro chip statusu zniknął', () => {
    expect(workspace).toContain('const handleGraphSaveError = useCallback(');
    expect(workspace).toContain('onSaveError: handleGraphSaveError,');
  });

  it('Menu 2 warsztatu nie renderuje już segmentu ikon WorkspacePanelStrip', () => {
    // MUTACJA: przywrócenie bloku `{activeTab === 'ideas' && activeDocumentId &&
    // (<WorkspacePanelStrip value={activeIdeaWorkspaceState?.activePanel …}/>)}`
    // = RED. (Jedyne pozostałe wystąpienie komponentu w pliku to martwa gałąź
    // Notatnika za `SHOW_LEGACY_NOTEBOOK_TOOLS_STRIP = false` — poza zakresem.)
    expect(hub).not.toContain('value={activeIdeaWorkspaceState?.activePanel || ideaActivePanel}');
    expect(hub.match(/<WorkspacePanelStrip/g) || []).toHaveLength(1);
  });
});

describe('1.1-N2: kebab Menu 1 niesie trzy funkcje zdjętego przycisku „Konwertuj"', () => {
  const chips = buildIdeaMenu1Chips({
    isPolish: true,
    handlers: {
      onExport: () => {},
      onHistory: () => {},
      onDuplicate: () => {},
      onDelete: () => {},
      onSearch: () => {},
      onShowHelp: () => {},
      onConvert: () => {},
    },
  });

  it('sekcja „Konwertuj na…" ma dokładnie 3 pozycje w kebabie (group: overflow)', () => {
    const convert = chips.filter((c) => c.overflowSection === 'Konwertuj na…');
    expect(convert).toHaveLength(3);
    expect(convert.every((c) => c.group === 'overflow')).toBe(true);
    expect(convert.map((c) => c.id)).toEqual([
      'idea-convert-initiative',
      'idea-convert-task_set',
      'idea-convert-report',
    ]);
    expect(convert.map((c) => c.label)).toEqual(['Inicjatywa', 'Taski', 'Raport']);
  });

  it('bez handlera onConvert sekcja nie powstaje (żadnego martwego wpisu)', () => {
    const bez = buildIdeaMenu1Chips({ isPolish: true, handlers: { onExport: () => {} } });
    expect(bez.filter((c) => c.id.startsWith('idea-convert-'))).toHaveLength(0);
  });

  it('puste płótno wyłącza konwersję (parytet z disabled starego CTA)', () => {
    const puste = buildIdeaMenu1Chips({
      isPolish: true,
      handlers: { onConvert: () => {}, convertDisabled: true },
    });
    const convert = puste.filter((c) => c.id.startsWith('idea-convert-'));
    expect(convert).toHaveLength(3);
    expect(convert.every((c) => c.disabled)).toBe(true);
  });

  it('kebab dalej niesie Duplikuj/Eksportuj/Historia/Szukaj/Skróty/Usuń', () => {
    const ids = chips.map((c) => c.id);
    for (const id of [
      'idea-duplicate',
      'idea-export',
      'idea-history',
      'idea-search',
      'idea-shortcuts',
      'idea-delete',
    ]) {
      expect(ids).toContain(id);
    }
  });
});
