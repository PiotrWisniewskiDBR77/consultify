/**
 * Naprawa Whiteboard 2026-07-26 — dev-render host dla REALNEGO
 * `<IdeaMapWorkspace>` (src/components/MyWork/IdeaMapWorkspace.tsx) wymuszony
 * w gałąź `activeTool === 'whiteboard'`, montujący REALNY
 * `<IdeaWhiteboardTool>` (src/components/MyWork/IdeaWhiteboardTool.tsx).
 *
 * Kopia 1:1 wzorca z `whiteboard-canvas.tsx`, RÓŻNICA: mock Api jest
 * STANOWY (mutowalna zmienna modułu `currentMap`), a nie zamrożony —
 * `syncMyIdeaMap`/`saveMyIdeaMap` aktualizują `currentMap`, `getMyIdeaMap`
 * czyta najświeższy stan. Potrzebne do weryfikacji Zadania B (Scenes):
 * dodanie sceny → viewport zapisany w `map.extensions.scenes` → przełączenie
 * między scenami musi czytać ŚWIEŻY stan, nie zamrożony zrzut z mount.
 *
 *   ?screen=whiteboard-workshop            → light
 *   ?screen=whiteboard-workshop&theme=dark → dark
 *   &ff_whiteboardSessionInPanel=1         → Zadanie A: Session Layer w prawym panelu (ON)
 */
import React from 'react';

import { IdeaMapWorkspace } from '../../src/components/MyWork/IdeaMapWorkspace';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

useAppStore.setState({
  theme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light',
} as any);

const IDEA_ID = 'idea-dbr77-demo-whiteboard-workshop';

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

const INITIAL_MAP = {
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
    // Druga strefa daleko od pierwszej — żeby scena 2 (przesunięta w to
    // miejsce) wyraźnie różniła się widokiem od sceny 1 (ramka Discovery).
    {
      id: 'n-frame-2',
      type: 'frameNode',
      position: { x: 1400, y: 900 },
      style: { width: 420, height: 260 },
      data: { label: 'Parking lot — tematy odłożone', collapsed: false },
    },
    {
      id: 'n-sticky-3',
      type: 'stickyNote',
      position: { x: 1440, y: 970 },
      parentId: 'n-frame-2',
      data: { label: 'Integracja z ERP — osobna rozmowa', priority: 3 },
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
};

// ── Mock STANOWY (nie zamrożony) ────────────────────────────────────────────
// `currentMap` to jedyne źródło prawdy czytane/pisane przez wszystkie 4
// metody poniżej — hydrate() w IdeaWhiteboardTool i useWorkspaceGraphRuntime
// w IdeaMapWorkspace obie czytają przez Api.getMyIdeaMap, więc muszą widzieć
// to, co ostatnio zapisał sync/save (inaczej: fałszywy alarm „nie działa").
let currentMap: any = structuredClone(INITIAL_MAP);

function mergeMapPayload(payload: any) {
  currentMap = {
    ...currentMap,
    nodes: Array.isArray(payload?.nodes) ? payload.nodes : currentMap.nodes,
    edges: Array.isArray(payload?.edges) ? payload.edges : currentMap.edges,
    extensions:
      payload?.extensions && typeof payload.extensions === 'object'
        ? { ...currentMap.extensions, ...payload.extensions }
        : currentMap.extensions,
  };
  return currentMap;
}

Api.getMyIdea = (async () => MOCK_IDEA) as typeof Api.getMyIdea;
Api.getMyIdeaMap = (async () => ({ map: currentMap })) as typeof Api.getMyIdeaMap;
Api.syncMyIdeaMap = (async (_ideaId: string, payload: any) =>
  mergeMapPayload(payload)) as typeof Api.syncMyIdeaMap;
Api.saveMyIdeaMap = (async (_ideaId: string, payload: any) =>
  mergeMapPayload(payload)) as typeof Api.saveMyIdeaMap;
Api.updateMyIdea = (async () => MOCK_IDEA) as typeof Api.updateMyIdea;
Api.getMyIdeaEdges = (async () => []) as typeof Api.getMyIdeaEdges;

// Debug hook — do weryfikacji w konsoli przeglądarki (Zadanie B: porównanie
// zapisanych viewportów scen przed/po kliknięciu).
(window as any).__WB_DEBUG_MAP__ = () => currentMap;

// Safety net: anything else this heavy component fires on mount (presence,
// notifications, knowledge-card lookups, …) resolves to an empty/neutral
// payload instead of hitting the dev-render vite server and throwing an
// HTML-body JSON-parse console error. i18n's /locales/** still passes
// through to the real fetch.
const g = window as unknown as { __WHITEBOARD_WORKSHOP_FETCH__?: boolean };
if (!g.__WHITEBOARD_WORKSHOP_FETCH__) {
  g.__WHITEBOARD_WORKSHOP_FETCH__ = true;
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

export function WhiteboardWorkshopScreen(): React.ReactElement {
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

export default WhiteboardWorkshopScreen;
