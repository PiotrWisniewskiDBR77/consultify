/**
 * @vitest-environment jsdom
 *
 * PF-P2-03 (2026-08-10, docs/qa/ideas-manual-audit-2026-08-09/
 * 08_P1_P3_EXECUTION_PLAN_FOR_CLAUDE.md §6 Process Flow) — "add selected-edge
 * properties for label/type/delete/reverse where semantically valid ...
 * deterministic quick labels solved the tested scene but do NOT replace
 * general edge editing."
 *
 * Before this change, `IdeaProcessFlowTool.tsx`'s selected-edge bar (the
 * `ff_canvasObjectEditBar`-docked bar in Menu 3, default ON) exposed line
 * color/style/arrows/reverse for ANY selected edge, but not the edge's
 * current LABEL, its condition TYPE (Yes/No/Default/Exception), or a DELETE
 * control — those three only existed inside the click-positioned
 * `EdgeStylePopover` (label+style) and the right-click `ProcessFlowContextMenu`
 * (label/type/delete/reverse), neither of which fires for a selection made
 * any other way (keyboard, Teresa, collab sync). This test exercises the
 * real `IdeaProcessFlowTool` component (real `pfEditBarModel`/`ObjectEditBar`
 * wiring), mocking only `reactflow` (to drive edge selection the same way
 * production ReactFlow does — `onEdgesChange` with a `select` change) and the
 * heavy subsystem hooks/child panels the existing
 * `IdeaProcessFlowTool.convertNode.test.tsx` already established a pattern
 * for.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CANVAS_OBJECT_EDIT_BAR_SLOT_ID } from '../../../src/utils/canvasObjectEditBarFlag';

const apiGetMyIdeaMapMock = vi.fn();
// PF-P2-03: `useProcessFlowNodes` is mocked below with a factory that runs on
// EVERY render (real hook semantics) — a `vi.fn()` created inside that
// factory would be a NEW mock function each render, so the button captured
// in an early render's onClick and the reference this test later asserts
// against would silently be two different mocks. Hoisting one persistent
// mock avoids that trap.
const deleteSelectedMock = vi.fn();

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

// Minimal ReactFlow stand-in (same shape as IdeaProcessFlowTool.convertNode.
// test.tsx's) + one addition: a per-edge "select edge" button that fires a
// real 'select' EdgeChange through `onEdgesChange`, so `applyEdgeChanges`
// below can flip `selected` on the edge exactly like production ReactFlow
// does on a left click (see `onEdgeClick`'s own comment in
// IdeaProcessFlowTool.tsx: "ReactFlow's own onEdgesChange still runs first
// and selects the edge").
vi.mock('reactflow', () => ({
  default: ({ nodes, edges, onNodeContextMenu, onNodesChange, onEdgesChange }: any) => (
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
      {edges.map((e: any) => (
        <button
          key={e.id}
          type="button"
          data-testid={`select-edge-${e.id}`}
          onClick={() => onEdgesChange?.([{ id: e.id, type: 'select', selected: true }])}
        >
          select edge {e.id}
        </button>
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
  // Real enough 'select' handling — same pattern as applyNodeChanges below,
  // just for edges (the pre-existing mock in convertNode.test.tsx left this
  // a no-op because that test never needed to select an edge).
  applyEdgeChanges: vi.fn((changes: any[], edges: any[]) =>
    edges.map((e) => {
      const change = changes.find((c: any) => c.id === e.id);
      return change?.type === 'select' ? { ...e, selected: !!change.selected } : e;
    })
  ),
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
    deleteSelected: deleteSelectedMock,
    duplicateSelected: vi.fn(),
    copySelected: vi.fn(),
    copyNodeById: vi.fn(),
    pasteClipboard: vi.fn(),
    clipboardCount: () => 0,
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

// NOTE: pfEditBarModel / ObjectEditBar / ObjectEditBarPopovers / the real
// EDGE_CONDITIONS list are intentionally left REAL — that IS what PF-P2-03
// changed and this test is verifying.

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

function renderWithEditBarSlot(ui: React.ReactElement) {
  // The selected-edge bar portals into this slot (`ff_canvasObjectEditBar`,
  // default ON — see canvasObjectEditBarFlag.ts). Production mounts it via
  // `IdeaCanvasSecondBar`; here we just supply the DOM anchor directly.
  const slot = document.createElement('div');
  slot.id = CANVAS_OBJECT_EDIT_BAR_SLOT_ID;
  document.body.appendChild(slot);
  return render(ui);
}

const baseFixture = {
  version: 1,
  nodes: [
    { id: 'node-A', type: 'flowNode', position: { x: 0, y: 0 }, data: { label: 'A' } },
    { id: 'node-B', type: 'flowNode', position: { x: 200, y: 0 }, data: { label: 'B' } },
  ],
  edges: [
    {
      id: 'e-A-B',
      source: 'node-A',
      target: 'node-B',
      type: 'flowEdge',
      label: 'Approved',
      data: { label: 'Approved', conditionType: '' },
    },
  ],
  extensions: {},
};

describe('PF-P2-03: Process Flow selected-edge bar exposes label/type/delete', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    deleteSelectedMock.mockClear();
  });

  it('shows the current label, and Enter commits an edit through the real handler', async () => {
    apiGetMyIdeaMapMock.mockResolvedValue({ map: baseFixture });

    renderWithEditBarSlot(<IdeaProcessFlowTool open ideaId="idea-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('select-edge-e-A-B')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('select-edge-e-A-B'));

    // The bar is now docked and shows the edge's CURRENT label inline — no
    // popover needs opening just to see what the edge says today.
    const labelControl = await screen.findByTestId('object-edit-bar-edge-label');
    expect(labelControl).toHaveTextContent('Approved');

    fireEvent.click(labelControl);
    const input = screen.getByDisplayValue('Approved') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Escalate' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Popover closed, and the same button now reflects the new persisted
    // label — proves the commit went through the real `handleEdgeLabelChange`
    // → setEdges → selectedEdge → pfEditBarModel loop, not a local draft.
    await waitFor(() => {
      expect(screen.queryByDisplayValue('Escalate')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('object-edit-bar-edge-label')).toHaveTextContent('Escalate');
  });

  it('Escape leaves the persisted label untouched', async () => {
    apiGetMyIdeaMapMock.mockResolvedValue({ map: baseFixture });

    renderWithEditBarSlot(<IdeaProcessFlowTool open ideaId="idea-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('select-edge-e-A-B')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('select-edge-e-A-B'));

    const labelControl = await screen.findByTestId('object-edit-bar-edge-label');
    fireEvent.click(labelControl);
    const input = screen.getByDisplayValue('Approved') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Half-typed junk' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByDisplayValue('Half-typed junk')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('object-edit-bar-edge-label')).toHaveTextContent('Approved');
  });

  it('lists the current condition type and lets you change it through the shared EDGE_CONDITIONS list', async () => {
    apiGetMyIdeaMapMock.mockResolvedValue({ map: baseFixture });

    renderWithEditBarSlot(<IdeaProcessFlowTool open ideaId="idea-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('select-edge-e-A-B')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('select-edge-e-A-B'));

    const conditionControl = await screen.findByTestId('object-edit-bar-edge-condition');
    // Fixture edge has conditionType: '' → the "No condition" entry.
    expect(conditionControl).toHaveTextContent('No condition');

    fireEvent.click(conditionControl);
    const yesOption = await screen.findByRole('button', { name: 'Yes' });
    fireEvent.click(yesOption);

    await waitFor(() => {
      expect(screen.getByTestId('object-edit-bar-edge-condition')).toHaveTextContent('Yes');
    });
  });

  it('the delete control calls the same deleteSelected() the right-click menu and Delete key use', async () => {
    apiGetMyIdeaMapMock.mockResolvedValue({ map: baseFixture });

    renderWithEditBarSlot(<IdeaProcessFlowTool open ideaId="idea-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('select-edge-e-A-B')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('select-edge-e-A-B'));

    const deleteControl = await screen.findByTestId('object-edit-bar-delete');
    fireEvent.click(deleteControl);

    expect(deleteSelectedMock).toHaveBeenCalledTimes(1);
  });
});
