/**
 * F6 (DEC-461, defekt zrzut 17-pomysly-process-flow-po.png) — dev-render
 * repro dla pływającej palety narzędzi zasłaniającej pierwszy węzeł.
 *
 * Kopia `processflow-canvas.tsx` (ta sama technika: REALNY
 * `<IdeaMapWorkspace>` → REALNY `<IdeaProcessFlowTool>`, mock tylko na
 * poziomie `Api`) zredukowana do DOKŁADNEGO scenariusza ze zrzutu: JEDEN
 * węzeł (`Steps 1`, `Lanes 1`) postawiony w `position: { x: 0, y: 0 }` —
 * lewa krawędź płótna — bo tylko wtedy `fitView` centruje ciasny graf
 * dokładnie tam, gdzie stoi paleta (`CanvasLeftToolbar`,
 * `[data-mels-floating-rail-surface]`, `position: fixed`). Wielo-węzłowy
 * mock w `processflow-canvas.tsx` NIE reprodukuje tego — szeroki graf
 * `fitView`-uje się do skali, przy której lewy węzeł nie ląduje pod paletą.
 *
 *   ?screen=processflow-canvas-single-node          → light
 *   ?screen=processflow-canvas-single-node&theme=dark → dark
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

const IDEA_ID = 'idea-dbr77-demo-flow-single-node';

const MOCK_IDEA = {
  id: IDEA_ID,
  title: 'Protect the planned maintenance window as a fixed asset',
  seed_text: 'Single-step process — reproduces the palette-over-first-node defect.',
  stage: 'shaping',
  branch: '',
  area: 'Operations',
  priority: 71,
  updatedAt: '2026-09-14T05:36:00Z',
};

const LANES = [{ id: 'lane-ops', label: 'Operations', color: '#c7d2fe' }];

const MOCK_MAP = {
  map: {
    version: 4,
    preferredTool: 'process_flow',
    nodes: [
      {
        id: 'n-only',
        type: 'flowNode',
        // Lewa krawędź płótna — dokładnie ten scenariusz ze zrzutu.
        position: { x: 0, y: 0 },
        data: {
          label: 'Protect the planned maintenance window as a fixed asset',
          shape: 'action',
          laneId: 'lane-ops',
        },
      },
    ],
    edges: [],
    extensions: {
      processFlow: {
        lanes: LANES,
        flowMode: 'classic',
        semanticKit: 'classic',
      },
    },
  },
};

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

(window as unknown as { __PF_MOCK_MAP__?: () => unknown }).__PF_MOCK_MAP__ = () => mapState;

Api.getMyIdea = (async () => MOCK_IDEA) as typeof Api.getMyIdea;
Api.getMyIdeaMap = (async () => ({ map: mapState })) as typeof Api.getMyIdeaMap;
Api.syncMyIdeaMap = (async (_ideaId: string, payload: any) =>
  persist(payload || {})) as typeof Api.syncMyIdeaMap;
Api.saveMyIdeaMap = (async (_ideaId: string, payload: any) =>
  persist(payload || {})) as typeof Api.saveMyIdeaMap;
(window as unknown as { __RAIL_DEBUG_MAP__?: () => unknown }).__RAIL_DEBUG_MAP__ = () => mapState;
Api.updateMyIdea = (async () => MOCK_IDEA) as typeof Api.updateMyIdea;
Api.getMyIdeaEdges = (async () => []) as typeof Api.getMyIdeaEdges;

const g = window as unknown as { __PROCESSFLOW_SINGLE_FETCH__?: boolean };
if (!g.__PROCESSFLOW_SINGLE_FETCH__) {
  g.__PROCESSFLOW_SINGLE_FETCH__ = true;
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

export function ProcessFlowCanvasSingleNodeScreen(): React.ReactElement {
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

export default ProcessFlowCanvasSingleNodeScreen;
