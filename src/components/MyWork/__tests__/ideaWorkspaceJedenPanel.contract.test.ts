/**
 * JEDEN PRAWY PANEL — WSZYSTKIE płótna warsztatu Pomysłów
 * (decyzja CTO 2026-09-05, druga część zgłoszenia właściciela: „napraw temat
 * menu bocznego, panelu bocznego, zarówno w IDE, jak i w notatce").
 *
 * Naprawa mapy myśli (`94d67f53cb`) trafiła w JEDNEGO gospodarza —
 * `IdeaMapWorkspace` — który obsługuje CZTERY narzędzia (`mindmap`,
 * `process_flow`, `whiteboard`, `table`). Ten test pilnuje, żeby ta wspólność
 * została wspólnością, a nie rozjechała się per narzędzie: jedna powłoka,
 * jedna kolumna, jedna paleta po lewej.
 *
 * Zmierzone na żywym renderze (127.0.0.1:3034, sesja odbiorowa), po jednym
 * zrzucie na narzędzie — `aside` = 1 z zaznaczeniem, 1 w zakładce Teresy,
 * 0 przy zamkniętym panelu: proof-mapa-*, proof-przeplyw-*, proof-tablica-*,
 * proof-tabela-*.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const katalog = path.resolve(__dirname, '..');
const workspace = fs.readFileSync(path.join(katalog, 'IdeaMapWorkspace.tsx'), 'utf8');
const melsView = fs.readFileSync(path.join(katalog, 'IdeaCanvasMelsView.tsx'), 'utf8');
const inspektor = fs.readFileSync(
  path.join(katalog, 'panel/IdeaElementInspector.tsx'),
  'utf8'
);
const nudge = fs.readFileSync(path.join(katalog, 'IdeaAINudgeStrip.tsx'), 'utf8');
const nawigacja = fs.readFileSync(
  path.resolve(__dirname, '../../../routes/ideaWorkspaceNavigation.ts'),
  'utf8'
);

describe('Warsztat Pomysłów — jeden prawy panel na KAŻDYM płótnie', () => {
  it('wszystkie cztery narzędzia dzielą jednego gospodarza panelu', () => {
    // Gdyby któreś narzędzie dostało własną trasę/powłokę, naprawa panelu
    // przestałaby go dotyczyć bez żadnego sygnału.
    for (const tool of ['mindmap', 'process_flow', 'table', 'whiteboard']) {
      expect(nawigacja).toContain(`'${tool}'`);
    }
    for (const tool of ['IdeaRecommendationMap', 'IdeaProcessFlowTool', 'IdeaTableTool', 'IdeaWhiteboardTool']) {
      expect(workspace).toContain(`<${tool}`);
    }
    // Jedna powłoka dla wszystkich (bez gałęzi „legacy" per narzędzie).
    expect(workspace).toContain('const melsCanvasEnabled = true;');
    expect(workspace).toContain('<IdeaCanvasMelsView');
  });

  it('panel elementu jest JEDYNYM korzeniem kolumny — powłoka nie dokłada drugiego', () => {
    // `ExecutiveModuleShell` opakowuje panel `div`-em, nie `aside`-em: panel
    // niesie własny `<aside aria-label>`, a zagnieżdżone punkty orientacyjne
    // to dla czytnika ekranu dwa panele zamiast jednego.
    const shell = fs.readFileSync(
      path.resolve(__dirname, '../../shared/ExecutiveModuleShell/index.tsx'),
      'utf8'
    );
    expect(shell).toContain('<div\n            data-testid="mels-element-inspector-rail"');
    expect(shell).not.toContain('<aside\n            data-testid="mels-element-inspector-rail"');
    // Akordeon w środku renderuje się jako `div` — jeden korzeń na panel.
    expect(inspektor).toContain('renderAs="div"');
  });

  it('Teresa jest ZAKŁADKĄ tego panelu, a globalny dok ustępuje na całej trasie warsztatu', () => {
    expect(inspektor).toContain('data-testid={`idea-panel-tab-${tab.id}`}');
    expect(workspace).toContain('teresaContent={teresaPanelNode}');
    expect(workspace).toContain("import('@/components/AIChat/UnifiedChatPanel')");
    const layout = fs.readFileSync(
      path.resolve(__dirname, '../../../layouts/MainLayout.tsx'),
      'utf8'
    );
    expect(layout).toContain('/^\\/my-work\\/ideas\\/[^/]+\\/workspace(\\/|$)/');
  });

  it('zakładka ma WŁASNY stan — wejście na płótno zaczyna od obiektu, nie od rozmowy', () => {
    // ★ Zmierzone 05.09 na `/workspace/table`: przy zakładce liczonej WPROST
    // z `isChatCollapsed` panel otwierał się na Teresie u każdego, kto
    // zostawił czat otwarty na innym ekranie (`aria-selected` zakładki
    // „Element" = false zaraz po wejściu).
    expect(workspace).toContain(
      "const [zakladkaPanelu, setZakladkaPanelu] = useState<'element' | 'teresa'>('element');"
    );
    expect(workspace).toContain('const poprzedniStanCzatu = useRef<boolean>(isChatCollapsed);');
    // „Omów z Teresą" przełącza zakładkę JAWNIE — inaczej przy już otwartym
    // czacie żadne przejście stanu by nie zaszło i przycisk byłby martwy.
    // 1.1-N2 (DEC-409): trzecie wywołanie to przycisk „AI" w rogu warsztatu
    // (`IdeaCornerActions`) — jedyne wejście AI w rogu po zdjęciu pigułki
    // „Teresa" (krok 1) i chipa statusu (krok 2).
    expect(workspace.match(/ustawZakladkePanelu\('teresa'\)/g)).toHaveLength(3);
  });

  it('nad płótnem nie pływają karty analizy, a paleta stoi po lewej', () => {
    expect(nudge).toContain('useCanvasAnalysisSlot');
    expect(nudge).toContain('if (host && !slot) return null;');
    expect(nudge).toContain('createPortal(pasek, slot)');
    expect(inspektor).toContain('data-testid="idea-canvas-analysis-slot"');
    expect(melsView).toContain('floatingToolRailSide="left"');
    expect(workspace).toContain('side="left"');
    // Pusty pasek sekcji nie rysuje już drugiej kolumny ikon.
    expect(workspace).toContain('rightRailTools={[]}');
  });

  it('Matryca (Tabela) dostaje rynnę, bo nakładka nie może leżeć na siatce', () => {
    // Zmierzone: paleta (x 81–125) zasłaniała kolumnę zaznaczania wierszy
    // 2–13. Płótna graficzne mają pod paletą puste tło, tabela nie ma.
    expect(workspace).toContain("activeTool === 'table' ? { paddingLeft: 72 } : undefined");
    expect(workspace).toContain('data-testid="idea-canvas-content"');
  });

  it('panel da się zamknąć, a zamknięcie jest zapamiętane', () => {
    expect(workspace).toContain("'myWork.ideaWorkspace.rightPanelClosed'");
    // 1.1-N2 (DEC-409): pigułka „Pokaż panel" (`idea-show-panel`) zastąpiona
    // przyciskiem „Panel" w rogu — ten sam pstryczek, ta sama pamięć.
    expect(workspace).toContain('<IdeaCornerActions');
    expect(workspace).toContain('zapiszPanelZamkniety(nastepny);');
    expect(inspektor).toContain('data-testid="idea-panel-close"');
    // Zaznaczenie węzła NIE otwiera panelu wbrew użytkownikowi.
    expect(workspace).toContain('panelZamkniety ? undefined :');
  });
});
