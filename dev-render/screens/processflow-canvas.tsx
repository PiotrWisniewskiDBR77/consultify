/**
 * Vegas render — dev-render host for the REAL `<IdeaMapWorkspace>` component
 * (src/components/MyWork/IdeaMapWorkspace.tsx) forced into its
 * `activeTool === 'process_flow'` branch, which mounts the REAL
 * `<IdeaProcessFlowTool>` (src/components/MyWork/IdeaProcessFlowTool.tsx) —
 * SPEC-A archetyp Canvas. No re-implementation of either component.
 *
 * Pattern copied 1:1 from `melscanvas-workspace.tsx` (the established
 * dev-render-for-IdeaMapWorkspace harness): `Api` is a plain exported object
 * (`export const Api = {...}`), so reassigning a method patches the same
 * singleton every module imports. IdeaMapWorkspace's own
 * `useWorkspaceGraphRuntime` hook AND IdeaProcessFlowTool's internal hydrate
 * fallback both read through `Api.getMyIdeaMap` — one mock payload feeds both.
 *
 *   ?screen=processflow-canvas          → light
 *   ?screen=processflow-canvas&theme=dark → dark
 *
 * `initialTool="process_flow"` is passed directly (a real IdeaMapWorkspace
 * prop) instead of relying on the map.preferredTool restore race, so the
 * Process Flow canvas is mounted on the very first render — no flicker
 * through the mind map first.
 *
 * Mock graph: 2 swimlanes (Klient / Zespół wdrożenia), a start/end pair, a
 * decision node with a Tak/Nie branch and a rework loop back to an earlier
 * action — enough shape variety (start/action/decision/end + conditional
 * edges) to read as a real onboarding process, not a placeholder.
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

const IDEA_ID = 'idea-dbr77-demo-flow-1';

const MOCK_IDEA = {
  id: IDEA_ID,
  title: 'Proces wdrożenia nowego klienta',
  seed_text: 'Mapa procesu onboardingu — od zgłoszenia do uruchomienia usługi.',
  stage: 'shaping',
  branch: '',
  area: 'Operacje',
  priority: 71,
  updatedAt: '2026-07-19T08:00:00Z',
};

const LANES = [
  { id: 'lane-client', label: 'Klient', color: '#c7d2fe' },
  { id: 'lane-team', label: 'Zespół wdrożenia', color: '#bbf7d0' },
];

const MOCK_MAP = {
  map: {
    version: 4,
    preferredTool: 'process_flow',
    nodes: [
      {
        id: 'n-start',
        type: 'flowNode',
        position: { x: 40, y: 40 },
        data: { label: 'Start', shape: 'start', laneId: 'lane-client' },
      },
      {
        id: 'n-request',
        type: 'flowNode',
        position: { x: 240, y: 40 },
        data: { label: 'Klient składa zgłoszenie', shape: 'action', laneId: 'lane-client' },
      },
      {
        id: 'n-verify',
        type: 'flowNode',
        position: { x: 460, y: 200 },
        data: { label: 'Zespół weryfikuje dane', shape: 'action', laneId: 'lane-team' },
      },
      {
        id: 'n-decision',
        type: 'flowNode',
        position: { x: 680, y: 200 },
        data: { label: 'Dane kompletne?', shape: 'decision', laneId: 'lane-team' },
      },
      {
        id: 'n-approve',
        type: 'flowNode',
        position: { x: 900, y: 200 },
        data: { label: 'Uruchom wdrożenie', shape: 'action', laneId: 'lane-team' },
      },
      {
        id: 'n-reject',
        type: 'flowNode',
        position: { x: 680, y: 40 },
        data: { label: 'Poproś o uzupełnienie danych', shape: 'action', laneId: 'lane-client' },
      },
      {
        id: 'n-end',
        type: 'flowNode',
        position: { x: 1120, y: 200 },
        data: { label: 'Koniec', shape: 'end', laneId: 'lane-team' },
      },
    ],
    edges: [
      { id: 'e-start-request', source: 'n-start', target: 'n-request', type: 'flowEdge' },
      { id: 'e-request-verify', source: 'n-request', target: 'n-verify', type: 'flowEdge' },
      { id: 'e-verify-decision', source: 'n-verify', target: 'n-decision', type: 'flowEdge' },
      {
        id: 'e-decision-approve',
        source: 'n-decision',
        target: 'n-approve',
        type: 'flowEdge',
        label: 'Tak',
        data: { conditionType: 'yes' },
      },
      {
        id: 'e-decision-reject',
        source: 'n-decision',
        target: 'n-reject',
        type: 'flowEdge',
        label: 'Nie',
        data: { conditionType: 'no' },
      },
      { id: 'e-reject-request', source: 'n-reject', target: 'n-request', type: 'flowEdge' },
      { id: 'e-approve-end', source: 'n-approve', target: 'n-end', type: 'flowEdge' },
    ],
    extensions: {
      processFlow: {
        lanes: LANES,
        flowMode: 'classic',
        semanticKit: 'classic',
      },
    },
  },
};

// ── STANOWY mock (B0 2026-07-27) ────────────────────────────────────────────
// Zamrozony mock (get zwracal wciaz ten sam MOCK_MAP, a sync/save go ignorowaly)
// daje FALSZYWE bugi w kazdym scenariuszu z refetchem po mutacji: dodany wezel
// „znika" po zapisie, bo serwer-atrapa oddaje stara wersje. Tutaj jedna
// mutowalna zmienna modulu jest zrodlem prawdy: sync/save ja NADPISUJA
// (podbijajac version), a get czyta ja SWIEZO przy kazdym wywolaniu.
let mapState: {
  version: number;
  nodes: any[];
  edges: any[];
  extensions: any;
  preferredTool: string;
} = JSON.parse(JSON.stringify(MOCK_MAP.map));

function persist(payload: { nodes?: any[]; edges?: any[]; extensions?: any; preferredTool?: any }) {
  mapState = {
    ...mapState,
    version: (mapState.version || 0) + 1,
    nodes: Array.isArray(payload?.nodes) ? payload.nodes : mapState.nodes,
    edges: Array.isArray(payload?.edges) ? payload.edges : mapState.edges,
    extensions: payload?.extensions ?? mapState.extensions,
    preferredTool: payload?.preferredTool ?? mapState.preferredTool,
  };
  return mapState;
}

// Okno diagnostyczne: `window.__PF_MOCK_MAP__()` zwraca to, co „serwer" ma
// zapisane — pozwala odroznic „wezel nie powstal" od „wezel powstal, ale nie
// dojechal do zapisu" bez zgadywania. Reload strony resetuje mapState (modul
// wykonuje sie od nowa) — to celowe, harness ma startowac z czystej sceny.
(window as unknown as { __PF_MOCK_MAP__?: () => unknown }).__PF_MOCK_MAP__ = () => mapState;

Api.getMyIdea = (async () => MOCK_IDEA) as typeof Api.getMyIdea;
Api.getMyIdeaMap = (async () => ({ map: mapState })) as typeof Api.getMyIdeaMap;
Api.syncMyIdeaMap = (async (_ideaId: string, payload: any) =>
  persist(payload || {})) as typeof Api.syncMyIdeaMap;
Api.saveMyIdeaMap = (async (_ideaId: string, payload: any) =>
  persist(payload || {})) as typeof Api.saveMyIdeaMap;
// Alias zgodnosci dla audytu raila — ten sam stan, druga nazwa.
(window as unknown as { __RAIL_DEBUG_MAP__?: () => unknown }).__RAIL_DEBUG_MAP__ = () => mapState;
Api.updateMyIdea = (async () => MOCK_IDEA) as typeof Api.updateMyIdea;
Api.getMyIdeaEdges = (async () => []) as typeof Api.getMyIdeaEdges;

// Safety net: anything else this heavy component fires on mount (presence,
// notifications, knowledge-card lookups, …) resolves to an empty/neutral
// payload instead of hitting the dev-render vite server and throwing an
// HTML-body JSON-parse console error. i18n's /locales/** still passes
// through to the real fetch.
const g = window as unknown as { __PROCESSFLOW_FETCH__?: boolean };
if (!g.__PROCESSFLOW_FETCH__) {
  g.__PROCESSFLOW_FETCH__ = true;
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

export function ProcessFlowCanvasScreen(): React.ReactElement {
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
            initialTool="process_flow"
            onClose={() => {}}
            onSaved={() => {}}
          />
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default ProcessFlowCanvasScreen;
