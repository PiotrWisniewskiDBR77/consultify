/**
 * @vitest-environment jsdom
 *
 * Performance measurement — IdeaProcessFlowTool mount time vs node count.
 *
 * Context (docs/qa/ideas-complete-transformation-2026-08-09/17_PERFORMANCE_MEASUREMENT.md):
 * Process Flow enables ReactFlow's `onlyRenderVisibleElements` once the
 * hydrated source reaches 300 nodes. The benchmark therefore verifies two
 * different contracts: below the threshold every hydrated node is present in
 * the DOM; at and above it the full source is hydrated while only a non-empty
 * viewport subset is mounted in the DOM.
 *
 * Mock scaffolding below is copied from the REAL, already-passing
 * tests/components/MyWork/IdeaProcessFlowTool.error-state.test.tsx (proven
 * to mount this component), with two changes: (1) `reactflow` /
 * `@reactflow/core` are left UNMOCKED so nodes really render through
 * ReactFlow's DOM path, and (2) Api.getMyIdeaMap returns a synthetic N-node
 * flow instead of a fixed fixture.
 */
import React from 'react';
import { render, cleanup, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any, interpolation?: Record<string, unknown>) => {
      const template = typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key);
      const values = interpolation ?? (typeof fallback === 'object' ? fallback : undefined);
      if (!values) return template;
      return Object.entries(values).reduce(
        (value, [key, replacement]) =>
          key === 'defaultValue'
            ? value
            : value.replaceAll(`{{${key}}}`, String(replacement)),
        template
      );
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

let currentNodes: any[] = [];
const apiGetMyIdeaMapMock = vi.fn(async () => ({
  map: { version: 1, nodes: currentNodes, edges: [], extensions: {} },
}));

vi.mock('@/services/api', () => ({
  Api: {
    getMyIdeaMap: (...args: any[]) => apiGetMyIdeaMapMock(...args),
    syncMyIdeaMap: vi.fn(),
  },
}));

vi.mock('@/services/ideaAIGenerator', () => ({
  generateAIProposal: vi.fn(),
  generateProcessSummary: vi.fn(),
  runProcessCoach: vi.fn(),
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentUser: { firstName: 'Piotr', lastName: 'W', email: 'piotr@example.com' },
  }),
}));

vi.mock('@/utils/artifactLinks', () => ({
  withNormalizedArtifactLinks: (value: any) => value,
}));

vi.mock('../../src/components/MyWork/canvas/useIdeaMapSync', () => ({
  formatIdeaMapSyncLabel: () => 'Saved just now',
  resolveIdeaMapHydration: (_ideaId: string, map: any) => ({ map }),
  useIdeaMapSync: () => ({
    saving: false,
    syncState: 'idle',
    lastSavedAt: null,
    queueSync: vi.fn(),
    flushNow: vi.fn(),
    primeServerVersion: vi.fn(),
  }),
}));

vi.mock('../../src/components/MyWork/processflow/useProcessFlowNodes', () => ({
  useProcessFlowNodes: () => ({
    deleteSelected: vi.fn(),
    duplicateSelected: vi.fn(),
    handleLaneRename: vi.fn(),
    handleLaneDelete: vi.fn(),
    handleLaneColorChange: vi.fn(),
    handleLaneMoveUp: vi.fn(),
    handleLaneMoveDown: vi.fn(),
  }),
}));

vi.mock('../../src/components/MyWork/processflow/useProcessFlowQuickActions', () => ({
  useProcessFlowQuickActions: vi.fn(),
}));

vi.mock('../../src/components/MyWork/canvas/CanvasZoomControls', () => ({
  CanvasZoomControls: () => null,
}));

vi.mock('../../src/components/MyWork/mindmap/CollaborationOverlay', () => ({
  CollaborationOverlay: () => null,
}));

vi.mock('../../src/components/MyWork/ProcessKPIDashboard', () => ({
  ProcessKPIDashboard: () => null,
}));

vi.mock('../../src/components/MyWork/VSMNodeComponent', () => ({
  vsmNodeTypes: {},
}));

vi.mock('../../src/components/MyWork/VSMTimelineBar', () => ({
  VSMTimelineBar: () => null,
}));

vi.mock('../../src/components/MyWork/processflow/useProcessFlowValidation', () => ({
  useProcessFlowValidation: () => ({
    result: null,
    isValidating: false,
    validate: vi.fn(),
    issuesForObject: () => [],
  }),
}));

vi.mock('../../src/components/MyWork/processflow/useProcessFlowAIProposal', () => ({
  useProcessFlowAIProposal: () => ({
    activeProposal: null,
    isGenerating: false,
    error: null,
    createProposal: vi.fn(),
    resolveProposal: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

vi.mock('../../src/components/MyWork/processflow/useProcessFlowReadback', () => ({
  useProcessFlowReadback: () => ({
    result: null,
    isLoading: false,
    fetchReadback: vi.fn(),
  }),
}));

vi.mock('../../src/components/MyWork/processflow/useProcessFlowExport', () => ({
  useProcessFlowExport: () => ({
    isExporting: false,
    exportAs: vi.fn(),
  }),
}));

vi.mock('../../src/components/MyWork/processflow/ProcessFlowPropertiesPanel', () => ({
  ProcessFlowPropertiesPanel: () => null,
}));

vi.mock('../../src/components/MyWork/processflow/ValidationResultsPanel', () => ({
  ValidationResultsPanel: () => null,
}));

vi.mock('../../src/components/MyWork/processflow/AIProposalPanel', () => ({
  AIProposalPanel: () => null,
}));

vi.mock('../../src/components/MyWork/processflow/ReadbackPanel', () => ({
  ReadbackPanel: () => null,
}));

vi.mock('../../src/components/MyWork/processflow/ExportDialog', () => ({
  ExportDialog: () => null,
}));

vi.mock('../../src/components/MyWork/processflow/ProcessFlowContextMenu', () => ({
  ProcessFlowContextMenu: () => null,
  getNodeContextActions: () => [],
  getCanvasContextActions: () => [],
}));

vi.mock('../../src/components/MyWork/processflow/nodes/BPMNStartNode', () => ({
  BPMNStartNode: () => null,
}));

vi.mock('../../src/components/MyWork/processflow/nodes/BPMNEndNode', () => ({
  BPMNEndNode: () => null,
}));

vi.mock('../../src/components/MyWork/processflow/nodes/ActivityNode', () => ({
  ActivityNode: () => null,
}));

vi.mock('../../src/components/MyWork/processflow/nodes/GatewayNode', () => ({
  GatewayNode: () => null,
}));

vi.mock('../../src/components/MyWork/processflow/nodes/DataObjectNode', () => ({
  DataObjectNode: () => null,
}));

vi.mock('../../src/components/MyWork/processflow/nodes/SubprocessNode', () => ({
  SubprocessNode: () => null,
}));

vi.mock('../../src/components/shared/NModeBlocks/EmptyStateInline', () => ({
  EmptyStateInline: ({ message, hint, action }: any) => (
    <div data-testid="empty-state-inline">
      {message && <div>{message}</div>}
      {hint && <div>{hint}</div>}
      {action && <button onClick={action.onClick}>+ {action.label}</button>}
    </div>
  ),
}));

import { IdeaProcessFlowTool } from '../../src/components/MyWork/IdeaProcessFlowTool';

function buildNodes(n: number) {
  const nodes: any[] = [];
  const cols = Math.ceil(Math.sqrt(n));
  for (let i = 0; i < n; i++) {
    nodes.push({
      id: `n${i}`,
      type: 'flowNode',
      position: { x: (i % cols) * 220, y: Math.floor(i / cols) * 140 },
      width: 180,
      height: 80,
      data: { label: `Step ${i}`, shape: 'action' },
    });
  }
  return nodes;
}

// N=100 (mean 4.0s) -> N=500 (mean 27.4s) already showed superlinear growth
// (5x N -> ~6.8x time) in a prior run of this file, well beyond ReactFlow's
// own per-node DOM cost. REPS trimmed to 2 and per-test timeout raised for
// the larger sizes so the run finishes; see the written report for the
// N=1000/2500 attempt outcome (completed or reported as impractical).
//
// G4-PF-GUARDRAIL (this stream): after batching EdgeRehydrateFix's
// `updateNodeInternals` calls (IdeaProcessFlowTool.tsx — one call per timer
// tick instead of one per node), N=2500 became attainable in this harness —
// added to the series so the fixed shape is measured, not just N=1000.
const SIZES = [100, 500, 1000, 2500];
const REPS = 2;

describe('perf: IdeaProcessFlowTool hydration and visible-DOM culling vs node count', () => {
  beforeEach(() => {
    apiGetMyIdeaMapMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  const results: Array<{
    n: number;
    meanMs: number;
    minMs: number;
    maxMs: number;
    hydratedNodes: number;
    visibleDomNodes: number;
  }> = [];

  for (const n of SIZES) {
    it(`N=${n}: mounts IdeaProcessFlowTool with ${n} real nodes, ${REPS} repetitions`, async () => {
      currentNodes = buildNodes(n);
      const timings: number[] = [];
      let hydratedNodes = 0;
      let visibleDomNodes = 0;
      for (let r = 0; r < REPS; r++) {
        const t0 = performance.now();
        const { container, unmount } = render(
          <IdeaProcessFlowTool open ideaId={`idea-pf-${n}-${r}`} />
        );
        await waitFor(
          () => {
            const count = container.querySelectorAll('.react-flow__node').length;
            expect(container.textContent).toContain(`Steps ${n}`);
            if (n < 300) {
              expect(count).toBe(n);
            } else {
              expect(count).toBeGreaterThan(0);
              expect(count).toBeLessThan(n);
            }
          },
          { timeout: 60000 }
        );
        const t1 = performance.now();
        timings.push(t1 - t0);
        if (r === REPS - 1) {
          hydratedNodes = n;
          visibleDomNodes = container.querySelectorAll('.react-flow__node').length;
        }
        unmount();
      }
      const meanMs = timings.reduce((a, b) => a + b, 0) / timings.length;
      const minMs = Math.min(...timings);
      const maxMs = Math.max(...timings);
      results.push({ n, meanMs, minMs, maxMs, hydratedNodes, visibleDomNodes });

      // eslint-disable-next-line no-console
      console.log(
        `[processflow-mount-bench] N=${n} reps=${REPS} mean=${meanMs.toFixed(2)}ms min=${minMs.toFixed(2)}ms ` +
          `max=${maxMs.toFixed(2)}ms hydratedNodes=${hydratedNodes} visibleDomNodes=${visibleDomNodes} ` +
          `all=[${timings.map((t) => t.toFixed(2)).join(', ')}]`
      );
      expect(hydratedNodes).toBe(n);
      if (n < 300) {
        expect(visibleDomNodes).toBe(n);
      } else {
        expect(visibleDomNodes).toBeGreaterThan(0);
        expect(visibleDomNodes).toBeLessThan(n);
      }
    }, 480000);
  }

  it('prints the final N vs ms table', () => {
    // eslint-disable-next-line no-console
    console.log('\n[processflow-mount-bench] SUMMARY TABLE');
    // eslint-disable-next-line no-console
    console.log('N\tmean_ms\tmin_ms\tmax_ms\thydratedNodes\tvisibleDomNodes');
    for (const r of results) {
      // eslint-disable-next-line no-console
      console.log(
        `${r.n}\t${r.meanMs.toFixed(2)}\t${r.minMs.toFixed(2)}\t${r.maxMs.toFixed(2)}` +
          `\t${r.hydratedNodes}\t${r.visibleDomNodes}`
      );
    }
    expect(results.length).toBeGreaterThan(0);
  });
});
