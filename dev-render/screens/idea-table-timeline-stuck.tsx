/**
 * Dev-render host for the REAL `<IdeaMapWorkspace>` component
 * (src/components/MyWork/IdeaMapWorkspace.tsx) forced into its
 * `activeTool === 'table'` branch, which mounts the REAL
 * `<IdeaTableTool>` (src/components/MyWork/IdeaTableTool.tsx).
 *
 * Purpose: reproduce + verify the fix for the "Timeline zakładka stuck" bug —
 *   1. View-TAB strip (Domyślny/Triażowanie/Scoring/Log decyzji/Timeline)
 *      is a `savedViews` list; clicking a tab calls `applyView(view)`.
 *   2. View-TYPE strip (Tabela/Kanban/Oś czasu-Gantt/Kalendarz/Macierz/
 *      Galeria) sets ONE global `viewLayout` state directly.
 *   3. `applyView` (src/components/MyWork/table/useTableViews.ts) only did
 *      `if (view.layout) setViewLayout(view.layout)` — so switching FROM the
 *      "Timeline" tab (which does carry `layout: 'timeline'`) TO any other
 *      tab (Domyślny/Triażowanie/Scoring/Log decyzji — none carry `layout`)
 *      left `viewLayout` stuck on `'timeline'`, permanently showing the
 *      Gantt/no-dates empty state regardless of which tab is "active".
 *
 * Pattern copied 1:1 from `whiteboard-canvas.tsx` (the established
 * dev-render-for-IdeaMapWorkspace harness): `Api` is a plain exported object,
 * so reassigning a method patches the same singleton every module imports.
 *
 * STATEFUL mock (per task instructions — a frozen mock gives false negatives
 * here, since column edits / view changes must survive across renders within
 * the same session): `currentMapState` is a mutable module-level variable.
 * `getMyIdeaMap` always returns the latest `currentMapState`; `syncMyIdeaMap`
 * / `saveMyIdeaMap` merge whatever partial map they receive into it and
 * return the merged result.
 *
 *   ?screen=idea-table-timeline-stuck          → light
 *   ?screen=idea-table-timeline-stuck&theme=dark → dark
 *
 * Mock table: 5 idea rows, columns = Nazwa (text) + Status (select) +
 * Właściciel (text) — DELIBERATELY NO "date" type column, so clicking the
 * "Timeline" tab reproduces the real "Brak dat do wyświetlenia" empty state
 * (this is the documented-OK part of the bug — the bug is what happens
 * AFTER, on the way back).
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

const IDEA_ID = 'idea-dbr77-demo-table-timeline-1';

const MOCK_IDEA = {
  id: IDEA_ID,
  title: 'Program lojalnościowy B2B — tabela wdrożeniowa',
  seed_text: 'Śledzenie zadań wdrożeniowych programu lojalnościowego.',
  stage: 'shaping',
  branch: '',
  area: 'Sprzedaż',
  priority: 64,
  updatedAt: '2026-07-25T10:00:00Z',
};

const TABLE_COLUMNS = [
  { key: 'label', header: 'Nazwa', type: 'text', visible: true, width: 260 },
  {
    key: 'status',
    header: 'Status',
    type: 'select',
    visible: true,
    width: 160,
    options: ['todo', 'in_progress', 'done'],
    optionColors: { todo: 'slate', in_progress: 'amber', done: 'emerald' },
  },
  { key: 'owner', header: 'Właściciel', type: 'text', visible: true, width: 160 },
];

const TABLE_NODES = [
  {
    id: 'rec-1',
    type: 'idea',
    data: { label: 'Zdefiniować poziomy programu', status: 'done', owner: 'Anna K.' },
  },
  {
    id: 'rec-2',
    type: 'idea',
    data: { label: 'Integracja z CRM', status: 'in_progress', owner: 'Marek T.' },
  },
  {
    id: 'rec-3',
    type: 'idea',
    data: { label: 'Regulamin prawny programu', status: 'in_progress', owner: 'Zofia L.' },
  },
  {
    id: 'rec-4',
    type: 'idea',
    data: { label: 'Materiały komunikacyjne', status: 'todo', owner: 'Bartek P.' },
  },
  {
    id: 'rec-5',
    type: 'idea',
    data: { label: 'Pilotaż z top-10 klientami', status: 'todo', owner: 'Anna K.' },
  },
];

// ── Stateful mock map (mutated in place by sync/save; getMyIdeaMap always
// reads the current value) — a frozen mock would mask exactly the kind of
// bug this harness exists to reproduce. ────────────────────────────────────
let currentMapState: Record<string, any> = {
  version: 4,
  preferredTool: 'table',
  nodes: TABLE_NODES,
  edges: [],
  extensions: {
    table: {
      columns: TABLE_COLUMNS,
      // No `views`/`activeViewId`/`viewLayout` persisted — IdeaTableTool's
      // own useTableViews() default state (savedViews incl. the Timeline
      // preset, viewLayout='table') is what's under test.
    },
  },
};

function mergeMapPatch(patch: Record<string, any>): Record<string, any> {
  currentMapState = {
    ...currentMapState,
    ...patch,
    extensions: {
      ...(currentMapState.extensions || {}),
      ...(patch.extensions || {}),
    },
  };
  return currentMapState;
}

Api.getMyIdea = (async () => MOCK_IDEA) as typeof Api.getMyIdea;
Api.getMyIdeaMap = (async () => ({ map: currentMapState })) as typeof Api.getMyIdeaMap;
Api.syncMyIdeaMap = (async (_ideaId: string, patch: any) =>
  mergeMapPatch(patch)) as typeof Api.syncMyIdeaMap;
Api.saveMyIdeaMap = (async (_ideaId: string, patch: any) =>
  mergeMapPatch(patch)) as typeof Api.saveMyIdeaMap;
Api.updateMyIdea = (async () => MOCK_IDEA) as typeof Api.updateMyIdea;
Api.getMyIdeaEdges = (async () => []) as typeof Api.getMyIdeaEdges;

// Safety net: anything else this heavy component fires on mount (presence,
// notifications, table-platform metadata-first probes, …) resolves to an
// empty/neutral payload instead of hitting the dev-render vite server and
// throwing an HTML-body JSON-parse console error. i18n's /locales/** still
// passes through to the real fetch.
const g = window as unknown as { __TABLE_TIMELINE_FETCH__?: boolean };
if (!g.__TABLE_TIMELINE_FETCH__) {
  g.__TABLE_TIMELINE_FETCH__ = true;
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

export function IdeaTableTimelineStuckScreen(): React.ReactElement {
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
            initialTool="table"
            onClose={() => {}}
            onSaved={() => {}}
          />
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default IdeaTableTimelineStuckScreen;
