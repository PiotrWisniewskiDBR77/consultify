/**
 * ODB O5 — dev-render host for the REAL `<IdeaMapWorkspace>` component
 * (src/components/MyWork/IdeaMapWorkspace.tsx), to screenshot the
 * `melsCanvasFlag` (src/utils/melsCanvasFlag.ts, default OFF) OFF vs ON for
 * Piotr's acceptance (CLAUDE.md #7 — supervisor renders first).
 *
 * The flag is resolved by `isMelsCanvasEnabled()` directly from
 * `window.location.search` (`?ff_melsCanvas=1`):
 *   ?screen=melscanvas-workspace                   → OFF (legacy floating chrome)
 *   ?screen=melscanvas-workspace&ff_melsCanvas=1    → ON (EditorShell / IdeaCanvasMelsView)
 *
 * IdeaMapWorkspace is the REAL production component — no re-implementation.
 * It self-fetches through `Api.getMyIdea` / `Api.getMyIdeaMap` (hydrate()
 * effect) AND independently through `useWorkspaceGraphRuntime` (same
 * `Api.getMyIdeaMap`, canvas/workspaceGraphRuntime.ts) — both short-circuited
 * here to a small 3-node mind map (center + 2 branches) so the canvas isn't
 * empty. `Api` is a plain exported object (`export const Api = {...}`), so
 * reassigning a method patches the same singleton every module imports
 * (pattern from assessment-initiatives-panel.tsx / assessment-menu3-status-
 * chips.tsx).
 *
 * `IdeaMapWorkspace` only needs `ideaId` (non-`new-idea-*` so it takes the
 * "load existing" hydrate branch, not the create-draft branch) + `onClose`/
 * `onSaved`. Mounted inside `AppProviders`, which already supplies a
 * `BrowserRouter` (`useSearchParams`/`useNavigate` need a router — do NOT
 * add a second `<MemoryRouter>` here, react-router throws on nested
 * Routers), with an ADMIN session seed (`seedRealisticSession`) so
 * `useAppStore().currentUser` resolves.
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

const IDEA_ID = 'idea-dbr77-demo-1';

const MOCK_IDEA = {
  id: IDEA_ID,
  title: 'Skrócić czas wdrożenia nowego klienta o 30%',
  seed_text: 'Onboarding trwa dziś średnio 6 tygodni — za dużo ręcznych kroków.',
  stage: 'shaping',
  branch: '',
  area: 'Operacje',
  priority: 62,
  updatedAt: '2026-07-16T09:00:00Z',
};

const MOCK_MAP = {
  map: {
    version: 3,
    preferredTool: 'mindmap',
    nodes: [
      {
        id: 'center-1',
        type: 'center',
        position: { x: 260, y: 200 },
        data: { label: 'Skrócić onboarding o 30%' },
      },
      {
        id: 'branch-1',
        type: 'branch',
        position: { x: 60, y: 60 },
        data: { label: 'Automatyzacja checklisty', kind: 'branch' },
      },
      {
        id: 'branch-2',
        type: 'branch',
        position: { x: 460, y: 60 },
        data: { label: 'Self-service portal klienta', kind: 'branch' },
      },
      {
        id: 'idea-1',
        type: 'idea',
        position: { x: 60, y: 340 },
        data: { label: 'Szablon dokumentów wstępny', kind: 'idea', parentId: 'branch-1' },
      },
    ],
    edges: [
      { id: 'e-c-b1', source: 'center-1', target: 'branch-1', type: 'gradient' },
      { id: 'e-c-b2', source: 'center-1', target: 'branch-2', type: 'gradient' },
      { id: 'e-b1-i1', source: 'branch-1', target: 'idea-1', type: 'gradient' },
    ],
    extensions: {},
  },
};

Api.getMyIdea = (async () => MOCK_IDEA) as typeof Api.getMyIdea;
Api.getMyIdeaMap = (async () => MOCK_MAP) as typeof Api.getMyIdeaMap;
Api.syncMyIdeaMap = (async () => MOCK_MAP.map) as typeof Api.syncMyIdeaMap;
Api.saveMyIdeaMap = (async () => MOCK_MAP.map) as typeof Api.saveMyIdeaMap;
Api.updateMyIdea = (async () => MOCK_IDEA) as typeof Api.updateMyIdea;
Api.getMyIdeaEdges = (async () => []) as typeof Api.getMyIdeaEdges;

// Safety net: anything else this heavy component fires on mount (presence,
// notifications, knowledge-card lookups, …) resolves to an empty/neutral
// payload instead of hitting the dev-render vite server and throwing an
// HTML-body JSON-parse console error. i18n's /locales/** still passes
// through to the real fetch.
const g = window as unknown as { __MELSCANVAS_FETCH__?: boolean };
if (!g.__MELSCANVAS_FETCH__) {
  g.__MELSCANVAS_FETCH__ = true;
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

export function MelsCanvasWorkspaceScreen(): React.ReactElement {
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

export default MelsCanvasWorkspaceScreen;
