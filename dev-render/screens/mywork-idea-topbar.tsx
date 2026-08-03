/**
 * Vegas-render — REALNY `MyWorkHub` z OTWARTĄ ideą, żeby zobaczyć CAŁĄ górę:
 * rząd pilli otwartych dokumentów („Lista · … · …") + Menu 1 powłoki Idei
 * + Menu 3. To jedyny harness, w którym te rzędy stoją razem — same ekrany
 * `?screen=mindmap-canvas` pokazują wyłącznie powłokę Idei, bez pilli huba.
 *
 * PO CO: zgłoszenie właściciela 2026-07-28 „z tego zrobimy jedną linię".
 * Flaga `ff_ideaTopBarOneLine=1` scala klaster poleceń Menu 1 do rzędu pilli
 * (portal do `IDEA_TOP_BAR_SLOT_ID`) i kasuje Menu 3. Bez tego ekranu nie da
 * się sprawdzić WZROKIEM ani scalenia, ani braku nachodzenia rzędów.
 *
 * Mechanika mocków: import `./mindmap-canvas` dla EFEKTÓW UBOCZNYCH — ten
 * moduł już seeduje sesję, podmienia `Api.getMyIdea*` na mock STANOWY i
 * zakłada siatkę bezpieczeństwa na `fetch`. Zero duplikatu fixture'ów.
 *
 * URL: ?screen=mywork-idea-topbar
 *      [&ff_ideaTopBarOneLine=1 → scalony układ]
 *      [&theme=light|dark]
 */
// Efekty uboczne: seed sesji + mock Api mapy + siatka bezpieczeństwa fetch
// + wymuszenie `ff_melsCanvas=1`. MUSI być przed importem huba.
import './mindmap-canvas';

import React from 'react';

import { MyWorkHub } from '../../src/components/MyWork/MyWorkHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';

const IDEA_ID = 'idea-dbr77-demo-mindmap-canvas';

// `?tool=mindmap|whiteboard|process_flow|table` — górny pasek jest WSPÓLNY dla
// czterech reprezentacji, więc odbiór wymaga sprawdzenia każdej z nich. Hub
// czyta narzędzie startowe z `data.initialTool` otwartego dokumentu
// (`createDefaultIdeaWorkspaceState`), więc podajemy je tam.
const TOOL = (() => {
  const raw = new URLSearchParams(window.location.search).get('tool') || 'mindmap';
  return ['mindmap', 'whiteboard', 'process_flow', 'table'].includes(raw) ? raw : 'mindmap';
})();

// ── GRAF PER NARZĘDZIE ──────────────────────────────────────────────────────
// PUŁAPKA, KTÓRA JUŻ RAZ DAŁA FAŁSZYWY ALARM (2026-07-28): import
// `./mindmap-canvas` podstawia mapę z węzłami typu `idea`/`branch`. Tablica
// i Przepływ takich typów NIE ZNAJĄ — ReactFlow degraduje je do typu
// zastępczego („Node type «idea» not found"), więc płótno wygląda jakby
// działało, ale węzły nie dają się zaznaczyć i pasek edycji obiektu nigdy się
// nie dokuje. Wniosek „pasek edycji nie działa w Tablicy" był artefaktem
// ekranu, nie produktu. Dlatego dla tych dwóch narzędzi podmieniamy graf na
// węzły ICH typów — mock STANOWY, tak jak w `whiteboard-workshop`.
const GRAF_TABLICY = {
  version: 4,
  preferredTool: 'whiteboard',
  nodes: [
    {
      id: 'wb-frame',
      type: 'frameNode',
      position: { x: 40, y: 40 },
      style: { width: 520, height: 320 },
      data: { label: 'Discovery — warsztat 1', collapsed: false },
    },
    {
      id: 'wb-sticky-1',
      type: 'stickyNote',
      position: { x: 80, y: 120 },
      parentId: 'wb-frame',
      data: { label: 'Klient nie ma spisanej dokumentacji procesu', priority: 2 },
    },
    {
      id: 'wb-sticky-2',
      type: 'stickyNote',
      position: { x: 300, y: 120 },
      parentId: 'wb-frame',
      data: { label: 'Ręczne przepisywanie danych z maili', priority: 1 },
    },
    {
      id: 'wb-shape',
      type: 'shapeNode',
      position: { x: 190, y: 240 },
      parentId: 'wb-frame',
      data: { label: 'Automatyzować czy uporządkować ręcznie?', shape: 'diamond' },
    },
    {
      id: 'wb-text',
      type: 'textBlock',
      position: { x: 640, y: 80 },
      data: { label: 'Gdzie klient traci najwięcej czasu?' },
    },
  ],
  edges: [
    {
      id: 'wb-e1',
      source: 'wb-shape',
      target: 'wb-sticky-2',
      type: 'labeled',
      label: 'zacznij tutaj',
    },
  ],
  extensions: {},
};

// Kształt 1:1 z `processflow-canvas.tsx`: typ węzła to ZAWSZE `flowNode`,
// a rolę niesie `data.shape` (start/action/decision/end) + `data.laneId`.
const GRAF_PRZEPLYWU = {
  version: 4,
  preferredTool: 'process_flow',
  nodes: [
    {
      id: 'pf-start',
      type: 'flowNode',
      position: { x: 40, y: 40 },
      data: { label: 'Zapytanie od klienta', shape: 'start', laneId: 'lane-sprzedaz' },
    },
    {
      id: 'pf-a1',
      type: 'flowNode',
      position: { x: 240, y: 40 },
      data: { label: 'Kwalifikacja leada', shape: 'action', laneId: 'lane-sprzedaz' },
    },
    {
      id: 'pf-d1',
      type: 'flowNode',
      position: { x: 440, y: 40 },
      data: { label: 'Pasuje do profilu?', shape: 'decision', laneId: 'lane-sprzedaz' },
    },
    {
      id: 'pf-a2',
      type: 'flowNode',
      position: { x: 660, y: 220 },
      data: { label: 'Warsztat Discovery', shape: 'action', laneId: 'lane-delivery' },
    },
    {
      id: 'pf-end',
      type: 'flowNode',
      position: { x: 900, y: 220 },
      data: { label: 'Wdrożenie uruchomione', shape: 'end', laneId: 'lane-delivery' },
    },
  ],
  edges: [
    { id: 'pf-e1', source: 'pf-start', target: 'pf-a1', type: 'flowEdge' },
    { id: 'pf-e2', source: 'pf-a1', target: 'pf-d1', type: 'flowEdge' },
    { id: 'pf-e3', source: 'pf-d1', target: 'pf-a2', type: 'flowEdge', label: 'tak' },
    { id: 'pf-e4', source: 'pf-a2', target: 'pf-end', type: 'flowEdge' },
  ],
  extensions: {
    processFlow: {
      lanes: [
        { id: 'lane-sprzedaz', label: 'Sprzedaż', color: '#c7d2fe' },
        { id: 'lane-delivery', label: 'Delivery', color: '#bbf7d0' },
      ],
    },
  },
};

const GRAF_PER_NARZEDZIE: Record<string, unknown> = {
  whiteboard: GRAF_TABLICY,
  process_flow: GRAF_PRZEPLYWU,
};

if (GRAF_PER_NARZEDZIE[TOOL]) {
  // Mock STANOWY: `biezacaMapa` to jedyne źródło prawdy dla odczytu i zapisu.
  // Zamrożony mock (zwracający wciąż fixture) kłamie po pierwszej edycji.
  let biezacaMapa: any = structuredClone(GRAF_PER_NARZEDZIE[TOOL]);
  const scal = (payload: any) => {
    biezacaMapa = {
      ...biezacaMapa,
      nodes: Array.isArray(payload?.nodes) ? payload.nodes : biezacaMapa.nodes,
      edges: Array.isArray(payload?.edges) ? payload.edges : biezacaMapa.edges,
      extensions:
        payload?.extensions && typeof payload.extensions === 'object'
          ? { ...biezacaMapa.extensions, ...payload.extensions }
          : biezacaMapa.extensions,
    };
    return biezacaMapa;
  };
  Api.getMyIdeaMap = (async () => ({ map: biezacaMapa })) as typeof Api.getMyIdeaMap;
  Api.syncMyIdeaMap = (async (_id: string, payload: any) =>
    scal(payload)) as typeof Api.syncMyIdeaMap;
  Api.saveMyIdeaMap = (async (_id: string, payload: any) =>
    scal(payload)) as typeof Api.saveMyIdeaMap;
}

// Rząd pilli huba odtwarza się z `sessionStorage` (`readStoredMyWorkDocuments`).
// Zasiewamy DWIE otwarte idee — dokładnie jak na zrzucie właściciela („Proces
// ofertowania" + aktywna) — żeby było widać kropki statusu i przewijanie kart.
try {
  window.sessionStorage.setItem(
    'moduleHub.openDocuments.mywork',
    JSON.stringify({
      openDocuments: [
        {
          id: 'idea-demo-proces-ofertowania',
          type: 'idea',
          name: 'Proces ofertowania',
          status: 'in_progress',
        },
        {
          id: IDEA_ID,
          type: 'idea',
          name: 'Podnieść marżę na projektach wdrożeniowych',
          status: 'in_progress',
          data: { initialTool: TOOL },
        },
      ],
      activeDocumentId: IDEA_ID,
    })
  );
} catch {
  /* prywatny tryb — hub wystartuje z pustym rzędem pilli */
}

export function MyWorkIdeaTopBarScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
        <MyWorkHub />
      </div>
    </AppProviders>
  );
}

export default MyWorkIdeaTopBarScreen;
