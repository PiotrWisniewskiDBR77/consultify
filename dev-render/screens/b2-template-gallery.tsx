/**
 * B2 — weryfikacja GALERII SZABLONÓW (`IdeaTemplateGallery`) dla WSZYSTKICH
 * 4 narzędzi canvas Idei w JEDNYM harnessie.
 *
 * DLACZEGO OSOBNY HARNESS (a nie mindmap-canvas / whiteboard-canvas /
 * processflow-canvas): tamte trzy mają ZAMROŻONY mock Api —
 * `Api.syncMyIdeaMap = async () => MOCK_MAP.map` i `getMyIdeaMap` zwracający
 * ciągle ten sam obiekt. Zastosowanie szablonu robi sync→refetch, więc na
 * zamrożonym mocku zmiana ZAWSZE „znika" i każdy szablon wygląda na martwy
 * (to był poprzedni fałszywy alarm). Tu mock jest STANOWY — wzorzec 1:1
 * z `whiteboard-workshop.tsx` (`currentMap` + `mergeMapPayload`), dodatkowo
 * z bumpem `version` (galeria przekazuje `baseVersion` → serwer produkcyjny
 * odrzuca 409 przy nieaktualnej wersji; mock musi wersję realnie podnosić).
 *
 *   ?screen=b2-template-gallery&tool=mindmap|whiteboard|process_flow|table
 *   &theme=dark          → ciemny motyw
 *   &empty=1             → pusta kanwa (existingNodeCount = 0, ścieżka BEZ confirm)
 *
 * Debug w konsoli: `__B2_MAP__()` — aktualny stan mapy po stronie „serwera".
 */
import React from 'react';

import { IdeaMapWorkspace } from '../../src/components/MyWork/IdeaMapWorkspace';
import type { CanvasToolType } from '../../src/components/MyWork/ideaSelectionTypes';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const params = new URLSearchParams(window.location.search);
const TOOL = (params.get('tool') || 'mindmap') as CanvasToolType;
const EMPTY = params.get('empty') === '1';

useAppStore.setState({ theme: params.get('theme') === 'dark' ? 'dark' : 'light' } as any);

const IDEA_ID = `idea-b2-template-gallery-${TOOL}`;

const MOCK_IDEA = {
  id: IDEA_ID,
  title: 'B2 — weryfikacja galerii szablonów',
  seed_text: 'Idea testowa dla sprawdzenia „Use template" i „AI fill" w 4 narzędziach.',
  stage: 'shaping',
  branch: '',
  area: 'Doradztwo operacyjne',
  priority: 60,
  updatedAt: '2026-07-27T08:00:00Z',
};

// Kanwa NIEPUSTA (domyślnie) — to WŁAŚNIE ta ścieżka odpala confirm
// „zastąpić N elementów?" w `handleApply`, czyli scenariusz, na którym
// właściciel zgłosił „nic się nie dzieje".
const SEED_NODES = EMPTY
  ? []
  : [
      {
        id: 'center-1',
        type: 'center',
        position: { x: 420, y: 300 },
        data: { label: 'Istniejąca zawartość kanwy' },
      },
      {
        id: 'branch-1',
        type: 'branch',
        position: { x: 200, y: 150 },
        data: { label: 'Wątek A', kind: 'branch' },
      },
      {
        id: 'branch-2',
        type: 'branch',
        position: { x: 660, y: 150 },
        data: { label: 'Wątek B', kind: 'branch' },
      },
    ];

const INITIAL_MAP: any = {
  version: 3,
  preferredTool: TOOL,
  nodes: SEED_NODES,
  edges: EMPTY
    ? []
    : [
        { id: 'e-1', source: 'center-1', target: 'branch-1', type: 'gradient' },
        { id: 'e-2', source: 'center-1', target: 'branch-2', type: 'gradient' },
      ],
  extensions: {},
};

// ── Mock STANOWY + TRWAŁY (sessionStorage) ──────────────────────────────────
// Trwałość jest KONIECZNA do punktu „czy elementy przeżywają przeładowanie":
// bez niej F5 resetuje moduł i szablon „znika" niezależnie od jakości kodu.
// `&reset=1` czyści zapis i wraca do stanu startowego.
const STORAGE_KEY = `__b2_map__${TOOL}`;
if (params.get('reset') === '1') sessionStorage.removeItem(STORAGE_KEY);

let currentMap: any = (() => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return structuredClone(INITIAL_MAP);
})();

function persist() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(currentMap));
  } catch {
    /* ignore */
  }
}

const syncLog: Array<{ at: string; n: number; first?: string; base?: number; reason?: string }> =
  [];
(window as any).__B2_LOG__ = () => syncLog;

function mergeMapPayload(payload: any) {
  syncLog.push({
    at: new Date().toISOString().slice(11, 23),
    n: Array.isArray(payload?.nodes) ? payload.nodes.length : -1,
    first: payload?.nodes?.[0]?.data?.label,
    base: payload?.baseVersion,
    reason: payload?.reason,
  });
  currentMap = {
    ...currentMap,
    version: (currentMap.version || 0) + 1,
    preferredTool: payload?.preferredTool || currentMap.preferredTool,
    nodes: Array.isArray(payload?.nodes) ? payload.nodes : currentMap.nodes,
    edges: Array.isArray(payload?.edges) ? payload.edges : currentMap.edges,
    extensions:
      payload?.extensions && typeof payload.extensions === 'object'
        ? { ...currentMap.extensions, ...payload.extensions }
        : currentMap.extensions,
  };
  persist();
  return currentMap;
}

// `&strict409=1` → mock zachowuje się jak PRODUKCYJNY serwer: odrzuca zapis
// z nieaktualnym `baseVersion` błędem 409 (my-work.routes.ts §POST /map/sync).
// Bez tego harness NIE widzi drugiej, ukrytej przyczyny B2 (przeterminowana
// wersja z `graphRuntime.graph.version` po każdym autozapisie).
const STRICT_409 = params.get('strict409') === '1';

Api.getMyIdea = (async () => MOCK_IDEA) as typeof Api.getMyIdea;
Api.getMyIdeaMap = (async () => ({ map: currentMap })) as typeof Api.getMyIdeaMap;
Api.syncMyIdeaMap = (async (_ideaId: string, payload: any) => {
  if (STRICT_409 && payload?.baseVersion != null && payload.baseVersion !== currentMap.version) {
    const err: any = new Error('Idea map conflict');
    err.status = 409;
    err.data = { code: 'IDEA_MAP_CONFLICT', currentVersion: currentMap.version };
    syncLog.push({
      at: new Date().toISOString().slice(11, 23),
      n: -409,
      base: payload.baseVersion,
    });
    throw err;
  }
  return mergeMapPayload(payload);
}) as typeof Api.syncMyIdeaMap;
Api.saveMyIdeaMap = (async (_ideaId: string, payload: any) =>
  mergeMapPayload(payload)) as typeof Api.saveMyIdeaMap;
Api.updateMyIdea = (async () => MOCK_IDEA) as typeof Api.updateMyIdea;
Api.getMyIdeaEdges = (async () => []) as typeof Api.getMyIdeaEdges;
Api.expandMyIdeaMap = (async () => ({ nodes: [], edges: [] })) as typeof Api.expandMyIdeaMap;

(window as any).__B2_MAP__ = () => currentMap;

const g = window as unknown as { __B2_TEMPLATE_GALLERY_FETCH__?: boolean };
if (!g.__B2_TEMPLATE_GALLERY_FETCH__) {
  g.__B2_TEMPLATE_GALLERY_FETCH__ = true;
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

export function B2TemplateGalleryScreen(): React.ReactElement {
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
            initialTool={TOOL}
            onClose={() => {}}
            onSaved={() => {}}
          />
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default B2TemplateGalleryScreen;
