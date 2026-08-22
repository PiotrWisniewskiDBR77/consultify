/**
 * @vitest-environment jsdom
 *
 * RB-024 — Approve must use the SAME readiness invariant (`completionReady`,
 * derived from `computeToolReviewGaps`) as Request review. Before this fix,
 * Approve only checked permission — a session could be approved from the UI
 * while `completionItems`/review gaps still showed unresolved blockers.
 *
 * The Approve/Request-review command row renders via a `createPortal` into
 * `#module-command-row-right-actions` (normally supplied by the parent hub),
 * so this suite provides that target element itself.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getToolSessionMock = vi.fn();
const createToolSessionMock = vi.fn();
const updateToolSessionMock = vi.fn();
const getUsersMock = vi.fn();
const getLinkGraphBacklinksMock = vi.fn();
const apiGetMock = vi.fn();
const approveToolMock = vi.fn();
const requestToolReviewMock = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    getToolSession: (...args: unknown[]) => getToolSessionMock(...args),
    createToolSession: (...args: unknown[]) => createToolSessionMock(...args),
    updateToolSession: (...args: unknown[]) => updateToolSessionMock(...args),
    getUsers: (...args: unknown[]) => getUsersMock(...args),
    getLinkGraphBacklinks: (...args: unknown[]) => getLinkGraphBacklinksMock(...args),
    get: (...args: unknown[]) => apiGetMock(...args),
    approveTool: (...args: unknown[]) => approveToolMock(...args),
    requestToolReview: (...args: unknown[]) => requestToolReviewMock(...args),
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentOrganization: { id: 'org-1', name: 'Test Org' },
    currentProjectId: null,
    isChatCollapsed: true,
    toggleChatCollapse: vi.fn(),
    activeChatMessages: [],
  }),
}));

vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: () => ({
    updateWorkspaceFromView: vi.fn(),
  }),
}));

vi.mock('@/hooks/usePresentationMode', () => ({
  usePresentationMode: () => ({ mode: 'n', setMode: vi.fn(), isN: true, isC: false }),
}));

vi.mock('@/hooks/discovery/useToolAI', () => ({
  useToolAI: () => ({
    isStreaming: false,
    streamedContent: '',
    error: null,
    sendMessage: vi.fn(),
    requestSuggestions: vi.fn(),
    generateCorrelations: vi.fn(),
    generateSummary: vi.fn(),
    generateFullSession: vi.fn(),
    runPhaseAiAction: vi.fn(),
    rethinkCard: vi.fn(),
    abortStream: vi.fn(),
    phaseAiActions: [],
    activeAiActionId: null,
    missionSuggestion: null,
    applyMissionSuggestion: vi.fn(),
    dismissMissionSuggestion: vi.fn(),
    getStepOpeningQuestion: vi.fn(),
  }),
}));

vi.mock('@/utils/pdfExport', () => ({
  exportToPDF: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/components/shared/NModeLayout', () => ({
  NModeShell: (props: any) => {
    const { sections = [], activeSection, loading } = props;
    if (loading) return <div data-testid="nmode-shell-loading" />;
    const active = sections.find((s: any) => s.id === activeSection);
    return (
      <div data-testid="nmode-shell">
        <div data-testid="nmode-shell-active">{active?.component}</div>
        <div data-testid="nmode-shell-right-panel">{props.rightPanel}</div>
        {props.children}
      </div>
    );
  },
}));

import { ToolDocumentView } from '@/components/DiscoveryTools/ToolDocumentView';
import { useToolStore } from '@/store/useToolStore';

const resetToolStore = () => {
  useToolStore.setState({
    currentSession: null,
    currentStep: 1,
    savedSessions: [],
  } as any);
};

// Deliberately missing mission/quadrants/tensions/moves/summary/outputs —
// guarantees computeToolReviewGaps('dynamic-swot', ...) returns a non-empty
// list, i.e. completionReady=false.
const sessionInReviewWithGaps = () => ({
  id: 'sess-review-1',
  name: 'Dynamic SWOT — Session',
  toolType: 'dynamic-swot',
  status: 'REVIEW',
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
  completionPercent: 40,
  answers: {},
  generatedInitiatives: [],
  decisions: [],
  permissions: { canApproveTool: true, canRequestReview: true },
});

describe('ToolDocumentView — RB-024 Approve readiness invariant', () => {
  let portalTarget: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    resetToolStore();
    getUsersMock.mockResolvedValue([]);
    getLinkGraphBacklinksMock.mockResolvedValue([]);
    apiGetMock.mockResolvedValue([]);
    // The command row (Approve/Request review) renders via createPortal into
    // this element, normally supplied by the parent DiscoveryToolsHub shell.
    portalTarget = document.createElement('div');
    portalTarget.id = 'module-command-row-right-actions';
    document.body.appendChild(portalTarget);
  });

  afterEach(() => {
    resetToolStore();
    portalTarget.remove();
  });

  it('disables Approve and never calls Api.approveTool while review gaps remain unresolved', async () => {
    getToolSessionMock.mockResolvedValue(sessionInReviewWithGaps());

    render(<ToolDocumentView toolType="dynamic-swot" sessionId="sess-review-1" onBack={vi.fn()} />);

    const approveButton = await screen.findByRole('button', { name: /approve/i });
    expect(approveButton).toBeDisabled();

    fireEvent.click(approveButton);
    // Give any (incorrect) async handler a chance to fire.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(approveToolMock).not.toHaveBeenCalled();
  });

  it('Request review is disabled by the exact same gaps (same completionReady invariant as Approve)', async () => {
    getToolSessionMock.mockResolvedValue({ ...sessionInReviewWithGaps(), status: 'DRAFT' });

    render(<ToolDocumentView toolType="dynamic-swot" sessionId="sess-review-1" onBack={vi.fn()} />);

    // The global i18next mock (tests/setup.ts) returns the raw key when no
    // `defaultValue` is passed, and this call site doesn't pass one.
    const requestReviewButton = await screen.findByRole('button', { name: /requestReview/i });
    expect(requestReviewButton).toBeDisabled();

    fireEvent.click(requestReviewButton);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(requestToolReviewMock).not.toHaveBeenCalled();
  });

  it('Approve is enabled and calls Api.approveTool once completion gaps are resolved', async () => {
    const readyAnswers = {
      context: { goal: 'Grow revenue', scope: 'EU market', successSignal: '10% ARR growth' },
      items: [
        { id: 's1', text: 'Strong brand', quadrant: 'strengths', proposalStatus: 'accepted' },
        { id: 'w1', text: 'Slow support', quadrant: 'weaknesses', proposalStatus: 'accepted' },
        { id: 'o1', text: 'New market', quadrant: 'opportunities', proposalStatus: 'accepted' },
        { id: 't1', text: 'New entrant', quadrant: 'threats', proposalStatus: 'accepted' },
      ],
      tensions: [{ id: 'te1', proposalStatus: 'accepted' }],
      recommendedMoves: [{ id: 'm1', proposalStatus: 'accepted' }],
      outputCandidates: [{ id: 'oc1', proposalStatus: 'accepted' }],
      summary: { executiveSummary: 'Solid position', proposalStatus: 'accepted' },
    };
    getToolSessionMock.mockResolvedValue({
      ...sessionInReviewWithGaps(),
      answers: readyAnswers,
    });
    approveToolMock.mockResolvedValue({ status: 'APPROVED' });

    render(<ToolDocumentView toolType="dynamic-swot" sessionId="sess-review-1" onBack={vi.fn()} />);

    const approveButton = await screen.findByRole('button', { name: /approve/i });
    await waitFor(() => expect(approveButton).not.toBeDisabled());

    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(approveToolMock).toHaveBeenCalledWith('sess-review-1');
    });
  });
});
