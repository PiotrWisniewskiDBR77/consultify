/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const apiGetMyIdeaMapMock = vi.fn();
const toastErrorMock = vi.fn();

// IdeaProcessFlowTool.tsx calls t() for these two banner-copy keys with NO
// fallback argument — relies on real locale resources (public/locales/en/
// translation.json). The naive mock has no access to those resources, so it
// must special-case the keys asserted on below rather than echo the raw i18n
// key (component-drift note, T1/fala1).
const I18N_KEY_OVERRIDES: Record<string, string> = {
  'myWorkIdeas.processFlowTool.readOnlyMode': 'Read-only mode',
  'myWorkIdeas.processFlowTool.youCanReviewFlowButEditing':
    'You can review the flow, but editing and saving are currently disabled.',
  'myWorkIdeas.processFlowTool.processFlowTemporarilyUnavailable':
    'Process flow is temporarily unavailable.',
  'myWorkIdeas.processFlowTool.thisDoesMeanProcessEmptyRetry':
    'This does not mean the process is empty. Retry loading the map and check again.',
  'myWorkIdeas.processFlowTool.retry': 'Retry',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) =>
      typeof fallback === 'string'
        ? fallback
        : (fallback?.defaultValue ?? I18N_KEY_OVERRIDES[_key] ?? _key),
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: (...args: any[]) => toastErrorMock(...args),
    success: vi.fn(),
  },
}));

vi.mock('reactflow', () => ({
  default: ({ children }: any) => <div data-testid="react-flow">{children}</div>,
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
  applyNodeChanges: vi.fn((_changes, nodes) => nodes),
  useUpdateNodeInternals: () => vi.fn(),
  useReactFlow: () => ({ fitView: vi.fn(), getNodes: () => [], getEdges: () => [], project: (p: any) => p }),
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

vi.mock('../../../src/components/MyWork/processflow/ProcessFlowContextMenu', () => ({
  ProcessFlowContextMenu: () => null,
  getNodeContextActions: () => [],
  getCanvasContextActions: () => [],
}));

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

describe('IdeaProcessFlowTool error honesty', () => {
  it('shows an explicit read-only banner when the process flow is locked', async () => {
    apiGetMyIdeaMapMock.mockResolvedValue({
      map: {
        version: 1,
        nodes: [],
        edges: [],
        extensions: {},
      },
    });

    render(<IdeaProcessFlowTool open ideaId="idea-1" locked />);

    await waitFor(() => {
      expect(screen.getByText('Read-only mode')).toBeInTheDocument();
    });

    expect(
      screen.getByText('You can review the flow, but editing and saving are currently disabled.')
    ).toBeInTheDocument();
  });

  it('shows a visible retryable load error instead of leaving an empty canvas after hydrate failure', async () => {
    apiGetMyIdeaMapMock.mockRejectedValue(new Error('Map failed to load'));

    render(<IdeaProcessFlowTool open ideaId="idea-1" />);

    // The hydrate now retries the GET a few times (M07 reload-race fix) before giving up,
    // so the error banner appears after the bounded backoff rather than on the first throw.
    await waitFor(
      () => {
        expect(screen.getByText('Process flow is temporarily unavailable.')).toBeInTheDocument();
      },
      { timeout: 4000 }
    );

    expect(
      screen.getByText('This does not mean the process is empty. Retry loading the map and check again.')
    ).toBeInTheDocument();
    expect(toastErrorMock).toHaveBeenCalledWith('Map failed to load');

    // Retry must trigger a fresh hydrate → additional GET attempts (exact count is the
    // retry budget, so assert it strictly increases rather than hard-coding it).
    const callsBeforeRetry = apiGetMyIdeaMapMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /\+ Retry/i }));
    await waitFor(() => {
      expect(apiGetMyIdeaMapMock.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
    });
  });
});
