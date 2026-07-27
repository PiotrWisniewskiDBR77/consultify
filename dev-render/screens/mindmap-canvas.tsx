/**
 * Vegas-render — REALNY MindMap (archetyp A · Canvas) z bogatym mock-grafem.
 *
 * Cel: pokazać `<IdeaMapWorkspace>` (src/components/MyWork/IdeaMapWorkspace.tsx)
 * jako czysty artefakt-canvas (powłoka MELS: Menu 1, lewy rail, prawy accordion,
 * graf+gałęzie, chip Zdrowie mapy) — NIE demo pojedynczej flagi jak
 * `melscanvas-workspace.tsx` (ODB O5, 3-węzłowy graf PRZED/PO ff_melsCanvas).
 * Ten screen ZAWSZE renderuje ON (powłoka MELS / IdeaCanvasMelsView) z
 * pełnym, realistycznym grafem doradczym: węzeł centralny + 6 gałęzi +
 * pod-węzły (idee) — żeby ocenić gęstość/czytelność wielogałęziowego drzewa,
 * nie tylko szkielet.
 *
 * Mechanizm 1:1 z melscanvas-workspace.tsx (ten sam wzorzec — REUŻYJ, nie
 * wymyślaj): AppProviders + seedRealisticSession + Api.getMyIdea/getMyIdeaMap
 * patch na singletonie + fetch safety-net dla /api/ i /my-work/.
 * IdeaMapWorkspace jest REALNYM komponentem produkcyjnym — brak re-implementacji.
 *
 * URL: ?screen=mindmap-canvas [&theme=light|dark] [&ff_melsCanvas=1 wymuszone
 * zawsze ON przez ten screen, param ignorowany świadomie — patrz FORCE_ON niżej]
 */
import React from 'react';

import { IdeaMapWorkspace } from '../../src/components/MyWork/IdeaMapWorkspace';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import { zamontujMockKomentarzy } from '../mocks/komentarze';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

useAppStore.setState({
  theme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light',
} as any);

// `isMelsCanvasEnabled()` czyta `window.location.search` bezpośrednio — ten
// screen ma ZAWSZE pokazywać powłokę MELS (IdeaCanvasMelsView), więc wstrzykuje
// `ff_melsCanvas=1` do URL-a przed montowaniem komponentu (bez przeładowania
// strony), zamiast wymagać ręcznego dopisania parametru w linku.
(function forceMelsCanvasOn() {
  const url = new URL(window.location.href);
  if (url.searchParams.get('ff_melsCanvas') !== '1') {
    url.searchParams.set('ff_melsCanvas', '1');
    window.history.replaceState({}, '', url.toString());
  }
})();

const IDEA_ID = 'idea-dbr77-demo-mindmap-canvas';

const MOCK_IDEA = {
  id: IDEA_ID,
  title: 'Podnieść marżę na projektach wdrożeniowych o 8 p.p. w 12 miesięcy',
  seed_text:
    'Marża na wdrożeniach spada mimo rosnącego portfela — koszty przekroczeń i rework rosną szybciej niż przychód.',
  stage: 'shaping',
  branch: '',
  area: 'Doradztwo operacyjne',
  priority: 78,
  updatedAt: '2026-07-19T08:30:00Z',
};

// Layout: centrum + 6 gałęzi rozłożonych promieniście (zegar 12/2/4/6/8/10),
// każda z 1-2 pod-węzłami typu `idea`. Tytuły = realne tematy doradcze
// (nie placeholdery „Branch 1" / „Idea A").
const MOCK_MAP = {
  map: {
    version: 3,
    preferredTool: 'mindmap',
    nodes: [
      {
        id: 'center-1',
        type: 'center',
        position: { x: 620, y: 420 },
        data: { label: 'Podnieść marżę na wdrożeniach o 8 p.p.' },
      },
      // 12:00 — Zakres i wycena
      {
        id: 'branch-scope',
        type: 'branch',
        position: { x: 560, y: 100 },
        data: { label: 'Dyscyplina zakresu i wyceny', kind: 'branch' },
      },
      {
        id: 'idea-scope-1',
        type: 'idea',
        position: { x: 340, y: 20 },
        data: {
          label: 'Standaryzacja change-request z progiem akceptacji',
          kind: 'idea',
          parentId: 'branch-scope',
        },
      },
      {
        id: 'idea-scope-2',
        type: 'idea',
        position: { x: 760, y: 20 },
        data: {
          label: 'Kalkulator wyceny wdrożenia oparty na benchmarku',
          kind: 'idea',
          parentId: 'branch-scope',
        },
      },
      // 2:00 — Efektywność zespołu
      {
        id: 'branch-team',
        type: 'branch',
        position: { x: 1040, y: 260 },
        data: { label: 'Efektywność zespołu wdrożeniowego', kind: 'branch' },
      },
      {
        id: 'idea-team-1',
        type: 'idea',
        position: { x: 1260, y: 180 },
        data: {
          label: 'Macierz kompetencji konsultantów per moduł',
          kind: 'idea',
          parentId: 'branch-team',
        },
      },
      {
        id: 'idea-team-2',
        type: 'idea',
        position: { x: 1260, y: 340 },
        data: {
          label: 'Rotacja ról senior/junior na krytycznych etapach',
          kind: 'idea',
          parentId: 'branch-team',
        },
      },
      // 4:00 — Rework i jakość
      {
        id: 'branch-quality',
        type: 'branch',
        position: { x: 1040, y: 580 },
        data: { label: 'Redukcja rework i defektów', kind: 'branch' },
      },
      {
        id: 'idea-quality-1',
        type: 'idea',
        position: { x: 1260, y: 660 },
        data: {
          label: 'Bramka jakości przed odbiorem klienta (UAT gate)',
          kind: 'idea',
          parentId: 'branch-quality',
        },
      },
      // 6:00 — Model komercyjny
      {
        id: 'branch-commercial',
        type: 'branch',
        position: { x: 560, y: 740 },
        data: { label: 'Model komercyjny kontraktów', kind: 'branch' },
      },
      {
        id: 'idea-commercial-1',
        type: 'idea',
        position: { x: 340, y: 820 },
        data: {
          label: 'Przejście z time&material na milestone fixed-fee',
          kind: 'idea',
          parentId: 'branch-commercial',
        },
      },
      {
        id: 'idea-commercial-2',
        type: 'idea',
        position: { x: 760, y: 820 },
        data: {
          label: 'Klauzula waloryzacji przy przedłużeniu harmonogramu',
          kind: 'idea',
          parentId: 'branch-commercial',
        },
      },
      // 8:00 — Narzędzia i automatyzacja
      {
        id: 'branch-tooling',
        type: 'branch',
        position: { x: 200, y: 580 },
        data: { label: 'Automatyzacja pracy wdrożeniowej', kind: 'branch' },
      },
      {
        id: 'idea-tooling-1',
        type: 'idea',
        position: { x: -20, y: 660 },
        data: {
          label: 'Biblioteka reużywalnych konfiguracji per branża',
          kind: 'idea',
          parentId: 'branch-tooling',
        },
      },
      // 10:00 — Governance klienta
      {
        id: 'branch-governance',
        type: 'branch',
        position: { x: 200, y: 260 },
        data: { label: 'Governance po stronie klienta', kind: 'branch' },
      },
      {
        id: 'idea-governance-1',
        type: 'idea',
        position: { x: -20, y: 180 },
        data: {
          label: 'Cotygodniowy steering z eskalacją 48h',
          kind: 'idea',
          parentId: 'branch-governance',
        },
      },
      {
        id: 'idea-governance-2',
        type: 'idea',
        position: { x: -20, y: 340 },
        data: {
          label: 'Jednoznaczny właściciel decyzji po stronie klienta',
          kind: 'idea',
          parentId: 'branch-governance',
        },
      },
    ],
    edges: [
      { id: 'e-c-scope', source: 'center-1', target: 'branch-scope', type: 'gradient' },
      { id: 'e-c-team', source: 'center-1', target: 'branch-team', type: 'gradient' },
      { id: 'e-c-quality', source: 'center-1', target: 'branch-quality', type: 'gradient' },
      { id: 'e-c-commercial', source: 'center-1', target: 'branch-commercial', type: 'gradient' },
      { id: 'e-c-tooling', source: 'center-1', target: 'branch-tooling', type: 'gradient' },
      { id: 'e-c-governance', source: 'center-1', target: 'branch-governance', type: 'gradient' },
      { id: 'e-scope-1', source: 'branch-scope', target: 'idea-scope-1', type: 'gradient' },
      { id: 'e-scope-2', source: 'branch-scope', target: 'idea-scope-2', type: 'gradient' },
      { id: 'e-team-1', source: 'branch-team', target: 'idea-team-1', type: 'gradient' },
      { id: 'e-team-2', source: 'branch-team', target: 'idea-team-2', type: 'gradient' },
      { id: 'e-quality-1', source: 'branch-quality', target: 'idea-quality-1', type: 'gradient' },
      {
        id: 'e-commercial-1',
        source: 'branch-commercial',
        target: 'idea-commercial-1',
        type: 'gradient',
      },
      {
        id: 'e-commercial-2',
        source: 'branch-commercial',
        target: 'idea-commercial-2',
        type: 'gradient',
      },
      { id: 'e-tooling-1', source: 'branch-tooling', target: 'idea-tooling-1', type: 'gradient' },
      {
        id: 'e-governance-1',
        source: 'branch-governance',
        target: 'idea-governance-1',
        type: 'gradient',
      },
      {
        id: 'e-governance-2',
        source: 'branch-governance',
        target: 'idea-governance-2',
        type: 'gradient',
      },
    ],
    extensions: {},
  },
};

// Komentarze: mock STANOWY (przeżywa F5) — patrz dev-render/mocks/komentarze.ts
zamontujMockKomentarzy('dev-render:mindmap-canvas:comments');

// ── STANOWY mock mapy (2026-07-27) ──────────────────────────────────────────
// PRZED: `getMyIdeaMap` zwracał wciąż ten sam zamrożony `MOCK_MAP`, a
// `syncMyIdeaMap`/`saveMyIdeaMap` IGNOROWAŁY payload. Każdy scenariusz
// „zmień coś → przeładuj → sprawdź czy przetrwało" dawał FAŁSZYWY wynik:
// zmiana znikała nie dlatego, że kod jej nie zapisał, tylko dlatego, że
// atrapa serwera oddawała starą wersję.
//
// PO: jedno źródło prawdy `mapState`, trzymane dodatkowo w `localStorage`,
// więc stan przeżywa TWARDE przeładowanie strony (F5) — inaczej moduł
// wykonałby się od nowa i zresetował mapę, co dla testu „rozmiar przeżywa
// przeładowanie" jest nie do odróżnienia od bugu. `version` rośnie przy
// każdym zapisie (workspaceGraphRuntime porównuje wersje).
//
// Konsola:
//   window.__MM_MOCK_MAP__()   → co „serwer" ma zapisane (np. node.style)
//   window.__MM_MOCK_RESET__() → czysta scena startowa + reload
const MOCK_STORAGE_KEY = `dev-render:mindmap-canvas:map:${IDEA_ID}`;

type MockMapState = {
  version: number;
  preferredTool: string;
  nodes: any[];
  edges: any[];
  extensions: Record<string, unknown>;
};

function readPersistedMap(): MockMapState {
  try {
    const raw = window.localStorage.getItem(MOCK_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
        return parsed as MockMapState;
      }
    }
  } catch {
    /* uszkodzony/zablokowany storage — startujemy ze sceny bazowej */
  }
  return JSON.parse(JSON.stringify(MOCK_MAP.map)) as MockMapState;
}

let mapState: MockMapState = readPersistedMap();

function writePersistedMap() {
  try {
    window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(mapState));
  } catch {
    /* brak storage — mock nadal działa w obrębie jednej sesji strony */
  }
}

function persistMap(payload: {
  nodes?: any[];
  edges?: any[];
  extensions?: Record<string, unknown>;
  preferredTool?: string;
}): MockMapState {
  mapState = {
    ...mapState,
    version: (mapState.version || 0) + 1,
    nodes: Array.isArray(payload?.nodes) ? payload.nodes : mapState.nodes,
    edges: Array.isArray(payload?.edges) ? payload.edges : mapState.edges,
    extensions:
      payload?.extensions && typeof payload.extensions === 'object'
        ? { ...(mapState.extensions || {}), ...payload.extensions }
        : mapState.extensions,
    preferredTool: payload?.preferredTool || mapState.preferredTool,
  };
  writePersistedMap();
  return mapState;
}

(
  window as unknown as { __MM_MOCK_MAP__?: () => unknown; __MM_MOCK_RESET__?: () => void }
).__MM_MOCK_MAP__ = () => mapState;
(
  window as unknown as { __MM_MOCK_MAP__?: () => unknown; __MM_MOCK_RESET__?: () => void }
).__MM_MOCK_RESET__ = () => {
  try {
    window.localStorage.removeItem(MOCK_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.location.reload();
};

Api.getMyIdea = (async () => MOCK_IDEA) as typeof Api.getMyIdea;
Api.getMyIdeaMap = (async () => ({ map: mapState })) as typeof Api.getMyIdeaMap;
Api.syncMyIdeaMap = (async (_ideaId: string, payload: any) =>
  persistMap(payload || {})) as typeof Api.syncMyIdeaMap;
Api.saveMyIdeaMap = (async (_ideaId: string, payload: any) =>
  persistMap(payload || {})) as typeof Api.saveMyIdeaMap;
Api.updateMyIdea = (async () => MOCK_IDEA) as typeof Api.updateMyIdea;
Api.getMyIdeaEdges = (async () => []) as typeof Api.getMyIdeaEdges;

// Safety net (identyczny wzorzec co melscanvas-workspace.tsx): wszystko inne
// co ten ciężki komponent odpala przy mount (presence, notifications,
// knowledge-card lookups, …) dostaje pusty/neutralny payload zamiast trafiać
// do vite dev servera i wywalać błąd parsowania JSON z body HTML. /locales/**
// nadal idzie realnym fetchem (i18n).
const g = window as unknown as { __MINDMAP_CANVAS_FETCH__?: boolean };
if (!g.__MINDMAP_CANVAS_FETCH__) {
  g.__MINDMAP_CANVAS_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);
    if (url.includes('/api/') || url.includes('/my-work/')) {
      return new Response(JSON.stringify({ data: [], items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return realFetch(input as RequestInfo, init);
  };
}

export function MindmapCanvasScreen(): React.ReactElement {
  return (
    <AppProviders>
      <FeatureFlagsProvider showDevTools={false}>
        <div
          style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}
          className="bg-white dark:bg-navy-900"
        >
          <IdeaMapWorkspace
            key={`idea-workspace-${IDEA_ID}`}
            ideaId={IDEA_ID}
            onClose={() => {}}
            onSaved={() => {}}
          />
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default MindmapCanvasScreen;
