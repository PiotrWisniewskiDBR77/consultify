/**
 * @vitest-environment jsdom
 *
 * REGRESSION TEST — P0-5 „preferredTool" corruption (2026-07-24).
 *
 * Zlecenie właściciela: test regresyjny wychwytujący błąd, w którym Idea typu
 * `table` (albo `process_flow`/`whiteboard`) otwarta Z LISTY (URL bez sluga
 * narzędzia w ścieżce, więc `initialTool` jest `undefined`) i bez lokalnej
 * preferencji w localStorage renderowała się jako Mind Map zamiast Table —
 * a autosave WSPÓLNEGO kanału (useWorkspaceGraphRuntime.buildPayload,
 * IdeaMapWorkspace.tsx ~L591 `preferredTool: activeTool`) wysyłał wtedy
 * `preferredTool: 'mindmap'`, NADPISUJĄC prawdziwy typ Idei w bazie.
 *
 * Naprawa (commit 632bda738c, `hydrate()` ~L1547-1573 w IdeaMapWorkspace.tsx):
 * gdy nie ma deep-linku (`initialTool`) ani lokalnej preferencji
 * (`readLocalToolPreference`), hydrate honoruje `mapRes.map.preferredTool`
 * (własna natura Idei) jako fallback zamiast zostawiać `activeTool` na
 * domyślnym 'mindmap'.
 *
 * Metoda: renderujemy PRAWDZIWY `IdeaMapWorkspace` (prawdziwe `hydrate()` +
 * prawdziwy `useWorkspaceGraphRuntime`/`useIdeaMapSync` — to one, nie
 * duplikat, faktycznie wysyłają POST /map/sync w produkcji), mockując
 * WYŁĄCZNIE (a) `Api`, (b) cztery ciężkie silniki narzędzi (Mind Map / Table /
 * Process Flow / Whiteboard — każdy z nich to osobny wielotysiącliniowy
 * komponent z własnymi zależnościami canvas/DnD, więc pełny e2e render byłby
 * nieproporcjonalny) i (c) drobne prezentacyjne dzieci/hooki niezwiązane z
 * logiką hydrate/autosave (paski, drawery, palety poleceń) — żeby uniknąć
 * montowania całego 4000-liniowego drzewa UI. Mockowany silnik Mind Mapy
 * (IdeaRecommendationMap) w swoim `useEffect` woła
 * `props.externalRuntime.captureGraph(...)` — DOKŁADNIE tym samym kanałem,
 * którym w produkcji realny komponent zgłasza edycję do wspólnego
 * `graphRuntime` — więc jeśli `activeTool` pozostanie błędnie na 'mindmap',
 * ten test przechwytuje REALNE wywołanie `Api.syncMyIdeaMap` z zepsutym
 * payloadem (assercja B), a mockowany silnik Table (IdeaTableTool) w ogóle
 * nie ma takiego kanału (w produkcji ma WŁASNĄ, zahardkodowaną na 'table'
 * ścieżkę zapisu — `useTablePersistence.ts` — więc jest odporny; to
 * odzwierciedla mock).
 *
 * DOWÓD ODWRACALNOŚCI: patrz raport wykonawcy — test uruchomiony z tymczasowo
 * usuniętym fallbackiem w `hydrate()` FAILuje (dokładnie na assercji A —
 * mounted === 'tool-mindmap' zamiast 'tool-table'); z przywróconym
 * fallbackiem (kod obecny na origin/demo, commit 632bda738c) PASSuje.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Api — pojedyncze źródło prawdy dla GET/POST map, jak w istniejącym wzorcu
// (tests/components/MyWork/workspaceGraphRuntime.softMerge.t7.test.ts). ─────
const getMyIdea = vi.fn();
const getMyIdeaMap = vi.fn();
const syncMyIdeaMap = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    getMyIdea: (...a: unknown[]) => getMyIdea(...a),
    getMyIdeaMap: (...a: unknown[]) => getMyIdeaMap(...a),
    syncMyIdeaMap: (...a: unknown[]) => syncMyIdeaMap(...a),
    createMyIdeaMapSnapshot: vi.fn().mockResolvedValue(null),
    updateMyIdea: vi.fn().mockResolvedValue({}),
  },
  getMapVersionFromPayload: () => null,
}));

// useAppStore — override lokalny (zamiast globalnego z tests/setup.ts) żeby
// domknąć klucze, których IdeaMapWorkspace faktycznie czyta z tego store'a.
vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector?: (s: any) => unknown) => {
    const state = {
      currentUser: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
      currentProjectId: 'proj-1',
      setChatKickoffMessage: vi.fn(),
      isChatCollapsed: true,
      toggleChatCollapse: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: { subscribe: vi.fn(() => () => {}) },
}));

vi.mock('@/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));

// ── Cztery silniki narzędzi (Mind Map / Table / Process Flow / Whiteboard) —
// każdy to osobny, wielotysiącliniowy komponent (canvas/DnD/wiele hooków
// pomocniczych). Zastępujemy je sondami: pokazują testid mówiący, KTÓRE
// narzędzie faktycznie się zamontowało (assercja A), a Mind Mapa dodatkowo
// wywołuje `externalRuntime.captureGraph` — realny, produkcyjny kanał
// autosave (assercja B). ─────────────────────────────────────────────────────
vi.mock('@/components/MyWork/IdeaRecommendationMap', () => ({
  IdeaRecommendationMap: (props: any) => {
    React.useEffect(() => {
      // Odzwierciedla realny mechanizm: realny IdeaRecommendationMap
      // przekazuje zmiany grafu do wspólnego runtime przez
      // `externalRuntime.captureGraph` (IdeaMapWorkspace.tsx ~L3694-3706),
      // który (nieattrapowany, prawdziwy `useWorkspaceGraphRuntime`) buduje
      // payload z `preferredTool: activeTool` (~L591/164) i POST-uje go do
      // Api.syncMyIdeaMap. Jeśli ten komponent w ogóle się zamontował, to
      // (jak w żywej regresji) dlatego że `activeTool` błędnie utknął na
      // 'mindmap' — a każda jego edycja/auto-akcja skorumpuje bazę.
      props.externalRuntime?.captureGraph?.(
        { nodes: [{ id: 'probe-node', data: {} }], edges: [] },
        { immediate: true }
      );
    }, []);
    return <div data-testid="tool-mindmap" data-preferred-tool={String(props.preferredTool)} />;
  },
}));

vi.mock('@/components/MyWork/IdeaTableTool', () => ({
  // Realny IdeaTableTool NIE dostaje `externalRuntime` — ma własną,
  // zahardkodowaną na 'table' ścieżkę zapisu (table/useTablePersistence.ts),
  // odporną na ten bug z definicji. Sonda to odzwierciedla: nic nie wysyła.
  IdeaTableTool: () => <div data-testid="tool-table" />,
}));

vi.mock('@/components/MyWork/IdeaProcessFlowTool', () => ({
  IdeaProcessFlowTool: () => <div data-testid="tool-process_flow" />,
}));

vi.mock('@/components/MyWork/IdeaWhiteboardTool', () => ({
  IdeaWhiteboardTool: () => <div data-testid="tool-whiteboard" />,
}));

// ── Reszta drzewa: paski/drawery/palety/hooki prezentacyjne, niezwiązane z
// logiką hydrate()/autosave pod testem. Trywialne atrapy, żeby nie montować
// całego ~4000-liniowego drzewa UI IdeaMapWorkspace (nieproporcjonalne dla
// tego testu regresyjnego). ─────────────────────────────────────────────────
vi.mock('@/components/standard/IdeaRightPanel', () => ({
  IdeaRightPanel: () => null,
}));
vi.mock('@/components/shared/NModeBlocks/ArtifactAttachPopover', () => ({
  ArtifactAttachPopover: () => null,
}));
vi.mock('@/components/MyWork/IdeaAISuggestionsPanel', () => ({
  IdeaAISuggestionsPanel: () => null,
}));
vi.mock('@/components/MyWork/IdeaCanvasMelsView', () => ({
  // MELS is now the sole runtime shell. Preserve its `canvas` slot so this
  // regression probe still observes which real tool the workspace selected;
  // dropping the slot would make every tool assertion fail before hydrate is
  // exercised at all.
  IdeaCanvasMelsView: ({ canvas }: { canvas?: React.ReactNode }) => <>{canvas}</>,
}));
vi.mock('@/components/MyWork/IdeaCanvasMenu1Bits', () => ({
  IdeaSaveIndicator: () => null,
  IdeaStageChip: () => null,
  IdeaToolIcon: () => null,
}));
vi.mock('@/components/MyWork/IdeaCanvasSecondBar', () => ({
  IdeaCanvasSecondBar: () => null,
}));
vi.mock('@/components/MyWork/IdeaContextPanel', () => ({
  IdeaContextPanel: () => null,
}));
vi.mock('@/components/MyWork/IdeaConvertMenu', () => ({
  IdeaConvertMenu: () => null,
}));
vi.mock('@/components/MyWork/IdeaExportMenu', () => ({
  IdeaExportMenu: () => null,
}));
vi.mock('@/components/MyWork/IdeaGhostCards', () => ({
  IdeaGhostCards: () => null,
}));
vi.mock('@/components/MyWork/IdeaNodeDetailDrawer', () => ({
  IdeaNodeDetailDrawer: () => null,
}));
vi.mock('@/components/MyWork/IdeaProposalReview', () => ({
  IdeaProposalReview: () => null,
}));
vi.mock('@/components/MyWork/IdeaTemplateGallery', () => ({
  IdeaTemplateGallery: () => null,
  applyIdeaTemplate: vi.fn(),
  findIdeaTemplate: vi.fn(),
}));
vi.mock('@/components/MyWork/IdeaTeresaSection', () => ({
  IdeaTeresaSection: () => null,
}));
vi.mock('@/components/MyWork/IdeaUnifiedSearch', () => ({
  IdeaUnifiedSearch: () => null,
}));
vi.mock('@/components/MyWork/IdeaVotingMode', () => ({
  IdeaVotingMode: () => null,
}));
vi.mock('@/components/MyWork/IdeaWorkspaceToolbar', () => ({
  IdeaWorkspaceToolbar: () => null,
  getIdeaWorkspaceToolLabel: (tool: string) => String(tool),
}));
vi.mock('@/components/MyWork/IdeaWorkspaceTools', () => ({
  IdeaWorkspaceTools: () => null,
  IDEA_PANEL_SECTIONS: ['problem', 'status', 'inspector', 'convert', 'health'],
}));
vi.mock('@/components/MyWork/mindmap/AIGovernancePanel', () => ({
  AIGovernanceBadge: () => null,
  AIGovernancePanel: () => null,
}));
vi.mock('@/components/MyWork/mindmap/CanvasLeftToolbar', () => ({
  CanvasLeftToolbar: () => null,
}));
vi.mock('@/components/MyWork/mindmap/IdeaViewSwitcher', () => ({
  IdeaViewSwitcher: () => null,
}));
vi.mock('@/components/MyWork/mindmap/SnapshotHistory', () => ({
  SnapshotHistory: () => null,
}));
vi.mock('@/components/MyWork/mindmap/UnifiedNodeDetailDrawer', () => ({
  UnifiedNodeDetailDrawer: () => null,
}));
vi.mock('@/components/MyWork/shared/KeyboardShortcutsHelp', () => ({
  KeyboardShortcutsHelp: () => null,
}));
vi.mock('@/components/MyWork/CommandPalette', () => ({
  CommandPalette: () => null,
  useCommandPalette: () => ({
    isOpen: false,
    open: vi.fn(),
    close: vi.fn(),
    toggle: vi.fn(),
  }),
}));
vi.mock('@/components/MyWork/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: () => ({
    showHelp: false,
    setShowHelp: vi.fn(),
    shortcuts: [],
  }),
}));
vi.mock('@/components/MyWork/canvas/useIdeasTeresaBridge', () => ({
  useIdeasTeresaBridge: () => ({ emitStatus: vi.fn() }),
}));
vi.mock('@/components/MyWork/shared/ConfirmDialog', () => ({
  useConfirmDialog: () => ({ dialog: null, confirm: vi.fn().mockResolvedValue(true) }),
}));

import { IdeaMapWorkspace } from '@/components/MyWork/IdeaMapWorkspace';

const IDEA_ID = 'idea-table-regression-1';
const LOCAL_TOOL_PREF_KEY = `consultify.idea-active-tool.${IDEA_ID}`;

function mockServerMapAsTable() {
  getMyIdea.mockResolvedValue({
    id: IDEA_ID,
    title: 'Proces ofertowania',
    seed_text: 'seed',
    stage: 'seed',
    branch: '',
    area: '',
    priority: 50,
    updatedAt: new Date().toISOString(),
  });
  getMyIdeaMap.mockResolvedValue({
    map: {
      nodes: [],
      edges: [],
      extensions: {},
      version: 1,
      preferredTool: 'table',
    },
  });
  syncMyIdeaMap.mockResolvedValue({ version: 2 });
}

describe('IdeaMapWorkspace — P0-5 preferredTool corruption regression', () => {
  beforeEach(() => {
    getMyIdea.mockReset();
    getMyIdeaMap.mockReset();
    syncMyIdeaMap.mockReset();
    // ★ Warunek 3: localStorage czyste — brak lokalnej preferencji narzędzia
    // dla tej idei (readLocalToolPreference musi zwrócić null).
    window.localStorage.clear();
    // Wymuszamy legacy (nie-mels) gałąź renderu IdeaMapWorkspace — identyczny
    // `canvasToolsNode`/`graphRuntime` niesie obie gałęzie, legacy jest po
    // prostu tańsza do zamontowania w teście.
    window.localStorage.setItem('ff.mels_canvas', '0');
    mockServerMapAsTable();
  });

  it(
    'ASSERCJA A: Idea preferredTool=table otwarta z listy (brak sluga w URL, ' +
      'czysty localStorage) renderuje się jako Table, NIE jako Mind Map',
    async () => {
      render(
        <MemoryRouter initialEntries={['/my-work/ideas/' + IDEA_ID]}>
          {/* ★ Warunek 2: brak `initialTool` — dokładnie tak wygląda otwarcie
              Z LISTY (URL bez sluga narzędzia w ścieżce). */}
          <IdeaMapWorkspace ideaId={IDEA_ID} onClose={vi.fn()} onSaved={vi.fn()} />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(getMyIdeaMap).toHaveBeenCalled();
      });

      const tableEl = await screen.findByTestId('tool-table');
      expect(tableEl).toBeInTheDocument();
      expect(screen.queryByTestId('tool-mindmap')).not.toBeInTheDocument();

      expect(window.localStorage.getItem(LOCAL_TOOL_PREF_KEY)).toBeNull();
    }
  );

  it(
    'ASSERCJA B: autosave (kanał useWorkspaceGraphRuntime, realny, ' +
      'nieattrapowany) NIE nadpisuje preferredTool na "mindmap" dla tej Idei',
    async () => {
      render(
        <MemoryRouter initialEntries={['/my-work/ideas/' + IDEA_ID]}>
          <IdeaMapWorkspace ideaId={IDEA_ID} onClose={vi.fn()} onSaved={vi.fn()} />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('tool-table')).toBeInTheDocument();
      });

      // Table (mockowany) nie ma kanału `externalRuntime.captureGraph` (w
      // produkcji ma własną, zahardkodowaną-na-'table' persystencję) — więc
      // żaden autosave przez wspólny graphRuntime nie powinien wystąpić z tej
      // strony. Dajemy realnym timerom useIdeaMapSync (setTimeout 0/idleMs)
      // szansę odpalić, gdyby jednak coś zakolejkowało zapis.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      const corruptingCalls = syncMyIdeaMap.mock.calls.filter(
        ([, payload]: [string, any]) => payload?.preferredTool === 'mindmap'
      );
      expect(corruptingCalls).toHaveLength(0);

      // Dla każdego faktycznego wywołania zapisu (jeśli jakiekolwiek wystąpiło)
      // preferredTool musi być 'table' albo w ogóle nie być wysyłany — nigdy
      // 'mindmap'.
      for (const [, payload] of syncMyIdeaMap.mock.calls as Array<[string, any]>) {
        expect(['table', undefined]).toContain(payload?.preferredTool);
      }
    }
  );
});
