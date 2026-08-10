/**
 * @vitest-environment jsdom
 *
 * E02-N6-NODE regression test.
 *
 * Root cause: Process Flow's node context-menu "Convert to initiative" called
 * handleConvert(action) with NO explicit node id, so handleConvert fell back
 * to `nodes.filter(n => n.selected)` — the whole-workspace selection state.
 * Right-click in Process Flow does NOT select the node it opens a menu for
 * (see the "prawy klik go nie zaznacza" comment on the sibling `onCopy`
 * handler in IdeaProcessFlowTool.tsx), so a user could right-click node B
 * while node A was selected elsewhere and have node A converted instead.
 *
 * On top of that, the event carried the node ids under the key `selectedIds`,
 * but the receiver (IdeaMapWorkspace's handleQuickAction / CONVERT_PREFIX_MAP
 * branch) only ever reads `eventDetail.nodeIds` — so even a correct id would
 * have been silently dropped and the receiver would fall back yet again, this
 * time to ITS OWN stale `selection.ids`.
 *
 * This test exercises the real IdeaProcessFlowTool component (real
 * ProcessFlowContextMenu / getNodeContextActions, real handleConvert), with
 * only `reactflow` mocked to give the test a way to (a) select a node the
 * normal way and (b) open a node's context menu the normal way (right-click
 * does NOT select, mirroring production ReactFlow + this component's own
 * onNodeContextMenu handler, which only sets context-menu state).
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const apiGetMyIdeaMapMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Minimal ReactFlow stand-in: renders one button per node that fires a real
// 'select' NodeChange through onNodesChange (so applyNodeChanges below can
// actually flip `selected`, exactly like production ReactFlow does on a left
// click), and a second control that fires onNodeContextMenu WITHOUT touching
// selection — matching IdeaProcessFlowTool's own onNodeContextMenu, which
// only calls setContextMenu(), never setNodes(). This is what makes
// "right-click doesn't select" true in both production and this test.
vi.mock('reactflow', () => ({
  default: ({ nodes, onNodeContextMenu, onNodesChange }: any) => (
    <div data-testid="react-flow">
      {nodes.map((n: any) => (
        <div key={n.id}>
          <button
            type="button"
            data-testid={`select-${n.id}`}
            onClick={() => onNodesChange?.([{ id: n.id, type: 'select', selected: true }])}
          >
            select {n.id}
          </button>
          <button
            type="button"
            data-testid={`rightclick-${n.id}`}
            onClick={(event) => onNodeContextMenu?.(event, n)}
          >
            right-click {n.id}
          </button>
        </div>
      ))}
    </div>
  ),
  ReactFlow: ({ children }: any) => <div data-testid="react-flow">{children}</div>,
  ReactFlowProvider: ({ children }: any) => <div>{children}</div>,
  Background: () => null,
  MiniMap: () => null,
  Controls: () => null,
  Panel: ({ children }: any) => <div>{children}</div>,
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
  ConnectionMode: { Strict: 'strict', Loose: 'loose' },
  MarkerType: { Arrow: 'arrow', ArrowClosed: 'arrowclosed' },
  addEdge: vi.fn((edge, edges) => [...edges, edge]),
  applyEdgeChanges: vi.fn((_changes, edges) => edges),
  // Real enough 'select' handling to let the test flip `selected` on a node,
  // the same way production reactflow does — everything else passes through.
  applyNodeChanges: vi.fn((changes: any[], nodes: any[]) =>
    nodes.map((n) => {
      const change = changes.find((c) => c.id === n.id);
      return change?.type === 'select' ? { ...n, selected: !!change.selected } : n;
    })
  ),
  useUpdateNodeInternals: () => vi.fn(),
  useReactFlow: () => ({
    fitView: vi.fn(),
    getNodes: () => [],
    getEdges: () => [],
    project: (p: any) => p,
  }),
  useStore: (selector: (s: any) => any) => selector({ transform: [0, 0, 1] }),
}));

vi.mock('@reactflow/core', () => ({
  getSmoothStepPath: () => ['', 0, 0, 0, 0],
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

vi.mock('../../../src/components/MyWork/canvas/useIdeaMapSync', () => ({
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

vi.mock('../../../src/components/MyWork/processflow/useProcessFlowNodes', () => ({
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

vi.mock('../../../src/components/MyWork/processflow/useProcessFlowQuickActions', () => ({
  useProcessFlowQuickActions: vi.fn(),
}));

vi.mock('../../../src/components/MyWork/canvas/CanvasZoomControls', () => ({
  CanvasZoomControls: () => null,
}));

vi.mock('../../../src/components/MyWork/mindmap/CollaborationOverlay', () => ({
  CollaborationOverlay: () => null,
}));

vi.mock('../../../src/components/MyWork/ProcessKPIDashboard', () => ({
  ProcessKPIDashboard: () => null,
}));

vi.mock('../../../src/components/MyWork/VSMNodeComponent', () => ({
  vsmNodeTypes: {},
}));

vi.mock('../../../src/components/MyWork/VSMTimelineBar', () => ({
  VSMTimelineBar: () => null,
}));

vi.mock('../../../src/components/MyWork/processflow/useProcessFlowValidation', () => ({
  useProcessFlowValidation: () => ({
    result: null,
    isValidating: false,
    validate: vi.fn(),
    issuesForObject: () => [],
  }),
}));

vi.mock('../../../src/components/MyWork/processflow/useProcessFlowAIProposal', () => ({
  useProcessFlowAIProposal: () => ({
    activeProposal: null,
    isGenerating: false,
    error: null,
    createProposal: vi.fn(),
    resolveProposal: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

vi.mock('../../../src/components/MyWork/processflow/useProcessFlowReadback', () => ({
  useProcessFlowReadback: () => ({
    result: null,
    isLoading: false,
    fetchReadback: vi.fn(),
  }),
}));

vi.mock('../../../src/components/MyWork/processflow/useProcessFlowExport', () => ({
  useProcessFlowExport: () => ({
    isExporting: false,
    exportAs: vi.fn(),
  }),
}));

vi.mock('../../../src/components/MyWork/processflow/ProcessFlowPropertiesPanel', () => ({
  ProcessFlowPropertiesPanel: () => null,
}));

vi.mock('../../../src/components/MyWork/processflow/ValidationResultsPanel', () => ({
  ValidationResultsPanel: () => null,
}));

vi.mock('../../../src/components/MyWork/processflow/AIProposalPanel', () => ({
  AIProposalPanel: () => null,
}));

vi.mock('../../../src/components/MyWork/processflow/ReadbackPanel', () => ({
  ReadbackPanel: () => null,
}));

vi.mock('../../../src/components/MyWork/processflow/ExportDialog', () => ({
  ExportDialog: () => null,
}));

// NOTE: ProcessFlowContextMenu / getNodeContextActions are intentionally left
// REAL (not mocked) — the defect and its fix both live in how
// IdeaProcessFlowTool wires `onConvertInitiative` into that real menu.

vi.mock('../../../src/components/MyWork/processflow/nodes/BPMNStartNode', () => ({
  BPMNStartNode: () => null,
}));

vi.mock('../../../src/components/MyWork/processflow/nodes/BPMNEndNode', () => ({
  BPMNEndNode: () => null,
}));

vi.mock('../../../src/components/MyWork/processflow/nodes/ActivityNode', () => ({
  ActivityNode: () => null,
}));

vi.mock('../../../src/components/MyWork/processflow/nodes/GatewayNode', () => ({
  GatewayNode: () => null,
}));

vi.mock('../../../src/components/MyWork/processflow/nodes/DataObjectNode', () => ({
  DataObjectNode: () => null,
}));

vi.mock('../../../src/components/MyWork/processflow/nodes/SubprocessNode', () => ({
  SubprocessNode: () => null,
}));

vi.mock('../../../src/components/shared/NModeBlocks/EmptyStateInline', () => ({
  EmptyStateInline: ({ message, hint, action }: any) => (
    <div data-testid="empty-state-inline">
      {message && <div>{message}</div>}
      {hint && <div>{hint}</div>}
      {action && <button onClick={action.onClick}>+ {action.label}</button>}
    </div>
  ),
}));

import { IdeaProcessFlowTool } from '../../../src/components/MyWork/IdeaProcessFlowTool';

describe('E02-N6-NODE: Process Flow node "Convert to initiative"', () => {
  it('converts the right-clicked node, not whatever is selected elsewhere in the workspace', async () => {
    apiGetMyIdeaMapMock.mockResolvedValue({
      map: {
        version: 1,
        nodes: [
          { id: 'node-A', type: 'flowNode', position: { x: 0, y: 0 }, data: { label: 'A' } },
          { id: 'node-B', type: 'flowNode', position: { x: 200, y: 0 }, data: { label: 'B' } },
        ],
        edges: [],
        extensions: {},
      },
    });

    const onQuickAction = vi.fn();

    render(<IdeaProcessFlowTool open ideaId="idea-1" onQuickAction={onQuickAction} />);

    await waitFor(() => {
      expect(screen.getByTestId('select-node-A')).toBeInTheDocument();
    });

    // Node A is selected the normal way (a plain click / ReactFlow 'select'
    // NodeChange) — this is the stale/unrelated workspace selection.
    fireEvent.click(screen.getByTestId('select-node-A'));

    // Right-click node B. Per production ReactFlow + this component's own
    // onNodeContextMenu, this does NOT select node B — it only opens the
    // context menu for it.
    fireEvent.click(screen.getByTestId('rightclick-node-B'));

    const convertItem = await screen.findByRole('menuitem', { name: /convert to initiative/i });
    fireEvent.click(convertItem);

    expect(onQuickAction).toHaveBeenCalledTimes(1);
    const [action, detail] = onQuickAction.mock.calls[0];
    expect(action).toBe('pf_convert_initiative');
    // The right-clicked node (B), NOT the selected-elsewhere node (A).
    expect(detail.nodeIds).toEqual(['node-B']);
    // Regression guard for the dead-key bug: the receiver
    // (IdeaMapWorkspace.handleQuickAction) only reads `nodeIds`, never
    // `selectedIds` — assert we no longer send the dead key at all.
    expect(detail).not.toHaveProperty('selectedIds');
  });

  it('converts the full multi-selection when the right-clicked node is part of it', async () => {
    apiGetMyIdeaMapMock.mockResolvedValue({
      map: {
        version: 1,
        nodes: [
          { id: 'node-A', type: 'flowNode', position: { x: 0, y: 0 }, data: { label: 'A' } },
          { id: 'node-B', type: 'flowNode', position: { x: 200, y: 0 }, data: { label: 'B' } },
        ],
        edges: [],
        extensions: {},
      },
    });

    const onQuickAction = vi.fn();

    render(<IdeaProcessFlowTool open ideaId="idea-1" onQuickAction={onQuickAction} />);

    await waitFor(() => {
      expect(screen.getByTestId('select-node-A')).toBeInTheDocument();
    });

    // Both nodes selected via the normal selection path.
    fireEvent.click(screen.getByTestId('select-node-A'));
    fireEvent.click(screen.getByTestId('select-node-B'));

    // Right-click lands on node B, which IS part of the current selection.
    fireEvent.click(screen.getByTestId('rightclick-node-B'));

    const convertItem = await screen.findByRole('menuitem', { name: /convert to initiative/i });
    fireEvent.click(convertItem);

    expect(onQuickAction).toHaveBeenCalledTimes(1);
    const [, detail] = onQuickAction.mock.calls[0];
    expect(new Set(detail.nodeIds)).toEqual(new Set(['node-A', 'node-B']));
  });
});
