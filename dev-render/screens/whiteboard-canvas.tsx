/**
 * Vegas render — dev-render host for the REAL `<IdeaMapWorkspace>` component
 * (src/components/MyWork/IdeaMapWorkspace.tsx) forced into its
 * `activeTool === 'whiteboard'` branch, which mounts the REAL
 * `<IdeaWhiteboardTool>` (src/components/MyWork/IdeaWhiteboardTool.tsx) —
 * SPEC-A archetyp Canvas. No re-implementation of either component.
 *
 * Pattern copied 1:1 from `melscanvas-workspace.tsx` (the established
 * dev-render-for-IdeaMapWorkspace harness): `Api` is a plain exported object
 * (`export const Api = {...}`), so reassigning a method patches the same
 * singleton every module imports. IdeaMapWorkspace's own
 * `useWorkspaceGraphRuntime` hook AND IdeaWhiteboardTool's internal hydrate
 * fallback both read through `Api.getMyIdeaMap` — one mock payload feeds both.
 *
 *   ?screen=whiteboard-canvas          → light
 *   ?screen=whiteboard-canvas&theme=dark → dark
 *
 * `initialTool="whiteboard"` is passed directly (a real IdeaMapWorkspace
 * prop) instead of relying on the map.preferredTool restore race, so the
 * whiteboard is mounted on the very first render — no flicker through the
 * mind map first.
 *
 * Mock board: a frame ("Discovery — warsztat 1") holding two sticky notes, a
 * decision shapeNode (diamond), a heading textBlock, and a linkNode — enough
 * node-type variety (registered in whiteboard/nodes/nodeTypes.ts: stickyNote·
 * textBlock·shapeNode·frameNode·linkNode) to read as a real workshop board,
 * plus one labeled edge connecting the decision to a sticky.
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

const IDEA_ID = 'idea-dbr77-demo-whiteboard-1';

const MOCK_IDEA = {
  id: IDEA_ID,
  title: 'Warsztat Discovery — automatyzacja checklisty',
  seed_text: 'Tablica robocza z warsztatu odkrywczego z klientem.',
  stage: 'shaping',
  branch: '',
  area: 'Operacje',
  priority: 58,
  updatedAt: '2026-07-19T08:00:00Z',
};

const MOCK_MAP = {
  map: {
    version: 4,
    preferredTool: 'whiteboard',
    nodes: [
      {
        id: 'n-frame',
        type: 'frameNode',
        position: { x: 40, y: 40 },
        style: { width: 520, height: 360 },
        data: { label: 'Discovery — warsztat 1', collapsed: false },
      },
      {
        id: 'n-heading',
        type: 'textBlock',
        position: { x: 80, y: 100 },
        parentId: 'n-frame',
        data: { label: 'Gdzie klient traci najwięcej czasu?' },
      },
      {
        id: 'n-sticky-1',
        type: 'stickyNote',
        position: { x: 80, y: 180 },
        parentId: 'n-frame',
        data: { label: 'Klient nie ma spisanej dokumentacji procesu', priority: 2 },
      },
      {
        id: 'n-sticky-2',
        type: 'stickyNote',
        position: { x: 300, y: 180 },
        parentId: 'n-frame',
        data: { label: 'Ręczne przepisywanie danych z maili do systemu', priority: 1 },
      },
      {
        id: 'n-decision',
        type: 'shapeNode',
        position: { x: 190, y: 300 },
        parentId: 'n-frame',
        data: { label: 'Automatyzować czy najpierw uporządkować ręcznie?', shape: 'diamond' },
      },
      {
        id: 'n-link',
        type: 'linkNode',
        position: { x: 640, y: 120 },
        data: { label: 'Szablon checklisty onboardingu', url: 'https://example.com/checklist' },
      },
    ],
    edges: [
      {
        id: 'e-decision-sticky2',
        source: 'n-decision',
        target: 'n-sticky-2',
        type: 'labeled',
        label: 'zacznij tutaj',
      },
    ],
    extensions: {},
  },
};

// Komentarze: mock STANOWY (przeżywa F5) — patrz dev-render/mocks/komentarze.ts
zamontujMockKomentarzy('dev-render:whiteboard-canvas:comments');

Api.getMyIdea = (async () => MOCK_IDEA) as typeof Api.getMyIdea;
// ★ AUDYT RAILA (2026-07-27): mock MUSI byc STANOWY. Zamrozony
// (`syncMyIdeaMap = async () => MOCK_MAP.map`) cofal kazdy dodany wezel przy
// pierwszym sync, wiec kliknieta ikona raila wygladala na martwa mimo dzialania.
// Wzorzec 1:1 z `whiteboard-workshop.tsx`.
// ★ 2026-07-28: dołożona TRWAŁOŚĆ między przeładowaniami (sessionStorage),
// wzorzec 1:1 z `mindmap-canvas.tsx`. Bez niej `let` na poziomie modułu
// resetował się przy każdym F5 i scenariusza „ustawienie krawędzi przeżywa
// przeładowanie" (strzałka kierunku, styl linii, etykieta) NIE dało się
// sprawdzić — mock wyglądał na stanowy, a gubił stan na odświeżeniu.
// `?resetMap=1` czyści zapis i wraca do fixture.
const STORAGE_KEY = 'wb-canvas-mock-map';

function loadPersistedMap(): any {
  try {
    if (new URLSearchParams(window.location.search).get('resetMap') === '1') {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return structuredClone(MOCK_MAP.map);
    }
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.nodes)) return parsed;
    }
  } catch {
    /* sessionStorage może być zablokowany — fallback na fixture */
  }
  return structuredClone(MOCK_MAP.map);
}

let currentMap: any = loadPersistedMap();

function persistMap() {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(currentMap));
  } catch {
    /* quota / tryb prywatny — stan zostaje tylko w pamięci */
  }
}

function mergeMapPayload(payload: any) {
  currentMap = {
    ...currentMap,
    version: (currentMap.version ?? 0) + 1,
    nodes: Array.isArray(payload?.nodes) ? payload.nodes : currentMap.nodes,
    edges: Array.isArray(payload?.edges) ? payload.edges : currentMap.edges,
    extensions:
      payload?.extensions && typeof payload.extensions === 'object'
        ? { ...currentMap.extensions, ...payload.extensions }
        : currentMap.extensions,
  };
  persistMap();
  return currentMap;
}
(window as any).__RAIL_DEBUG_MAP__ = () => currentMap;
// Sonda zgodna z mindmap-canvas — weryfikacja stanu krawędzi w konsoli.
(window as any).__WB_DEBUG_MAP__ = () => currentMap;
Api.getMyIdeaMap = (async () => ({ map: currentMap })) as typeof Api.getMyIdeaMap;
Api.syncMyIdeaMap = (async (_ideaId: string, payload: any) =>
  mergeMapPayload(payload)) as typeof Api.syncMyIdeaMap;
Api.saveMyIdeaMap = (async (_ideaId: string, payload: any) =>
  mergeMapPayload(payload)) as typeof Api.saveMyIdeaMap;
Api.updateMyIdea = (async () => MOCK_IDEA) as typeof Api.updateMyIdea;
Api.getMyIdeaEdges = (async () => []) as typeof Api.getMyIdeaEdges;

// Safety net: anything else this heavy component fires on mount (presence,
// notifications, knowledge-card lookups, …) resolves to an empty/neutral
// payload instead of hitting the dev-render vite server and throwing an
// HTML-body JSON-parse console error. i18n's /locales/** still passes
// through to the real fetch.
const g = window as unknown as { __WHITEBOARD_FETCH__?: boolean };
if (!g.__WHITEBOARD_FETCH__) {
  g.__WHITEBOARD_FETCH__ = true;
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

export function WhiteboardCanvasScreen(): React.ReactElement {
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
            initialTool="whiteboard"
            onClose={() => {}}
            onSaved={() => {}}
          />
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default WhiteboardCanvasScreen;
