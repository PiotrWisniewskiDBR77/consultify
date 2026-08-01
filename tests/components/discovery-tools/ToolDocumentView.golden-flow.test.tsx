/**
 * @vitest-environment jsdom
 *
 * TLS-02 / TLS-03 golden-flow regression coverage for ToolDocumentView.
 *
 * Mounts the REAL `ToolDocumentView` (src/components/DiscoveryTools/ToolDocumentView.tsx)
 * with a REAL, live `useToolStore` (Zustand) — deliberately NOT mocked, because the
 * two behaviors under test (TLS-02 create-guard, TLS-03 section-nav data survival +
 * unmount autosave-flush) are only meaningful proofs if the store holding
 * `currentSession`/`inputData` is the actual production store, not a stub.
 *
 * What IS mocked (genuinely external/unrelated to the two fixes under test):
 *  - `@/services/api` (Api singleton) — network boundary.
 *  - `@/store/useAppStore`, `@/store/useConversationStore` — unrelated app chrome.
 *  - `@/hooks/usePresentationMode` — N/C mode persistence, irrelevant here.
 *  - `@/hooks/discovery/useToolAI` — AI chat/streaming, irrelevant here.
 *  - `@/utils/pdfExport` — unrelated export feature.
 *  - `@/components/shared/NModeLayout` (NModeShell) — this is the shared N-mode
 *    "chrome" (header/properties-strip/left-nav/canvas/framer-motion transitions).
 *    It is a large, generic shell used by ~6 unrelated artifact types and is
 *    covered by its own tests; it is not part of what TLS-02/TLS-03 fixed. It is
 *    replaced here with a minimal stub that still exercises the REAL contract
 *    ToolDocumentView depends on: it renders `sections.find(activeSection).component`
 *    (mirroring the real `NModeCanvas`) and exposes a button per section id that
 *    calls the real `onSectionChange` handler — i.e. real section-switch wiring,
 *    fake pixels.
 *
 * Left REAL and actually rendered for the section-navigation test:
 *  - `ToolCanvas` -> `SWOTBuildPhase` (the actual Dynamic SWOT quadrant editor),
 *    so the Weaknesses-quadrant edit in TLS-03 case 2 goes through the real
 *    rendered `<input>` + real `addSWOTItem` store action, not a synthetic path.
 *
 * NOTE on console noise: ToolDocumentView has its own pre-existing
 * `requestAnimationFrame`-driven command-row portal-sync effect (unrelated to
 * TLS-02/TLS-03) that lands a state update outside of RTL's `act()` window in
 * jsdom. This produces harmless "not wrapped in act(...)" warnings on stderr
 * during the section-navigation and unmount-flush tests below; all three
 * tests still assert and pass deterministically (verified with repeated
 * runs). This is a property of the component's unrelated portal effect, not
 * of the behaviors under test.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Api mock (overrides the global tests/setup.ts mock for this file) ───────
const getToolSessionMock = vi.fn();
const createToolSessionMock = vi.fn();
const updateToolSessionMock = vi.fn();
const getUsersMock = vi.fn();
const getLinkGraphBacklinksMock = vi.fn();
const apiGetMock = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    getToolSession: (...args: unknown[]) => getToolSessionMock(...args),
    createToolSession: (...args: unknown[]) => createToolSessionMock(...args),
    updateToolSession: (...args: unknown[]) => updateToolSessionMock(...args),
    getUsers: (...args: unknown[]) => getUsersMock(...args),
    getLinkGraphBacklinks: (...args: unknown[]) => getLinkGraphBacklinksMock(...args),
    get: (...args: unknown[]) => apiGetMock(...args),
  },
}));

// ── Unrelated app chrome / stores ────────────────────────────────────────────
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

// ── NModeShell stub: real section-switch wiring, no chrome/animation weight ──
vi.mock('@/components/shared/NModeLayout', () => ({
  NModeShell: (props: any) => {
    const { sections = [], activeSection, onSectionChange, loading } = props;
    if (loading) return <div data-testid="nmode-shell-loading" />;
    const active = sections.find((s: any) => s.id === activeSection);
    return (
      <div data-testid="nmode-shell">
        <div data-testid="nmode-shell-nav">
          {sections.map((s: any) => (
            <button
              key={s.id}
              type="button"
              data-testid={`nmode-section-${s.id}`}
              onClick={() => onSectionChange(s.id)}
            >
              {s.id}
            </button>
          ))}
        </div>
        <div data-testid="nmode-shell-active">{active?.component}</div>
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

const baseSwotSession = (overrides: Record<string, unknown> = {}) => ({
  id: 'sess-existing-1',
  name: 'Dynamic SWOT — Session',
  toolType: 'dynamic-swot',
  status: 'DRAFT',
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
  completionPercent: 20,
  answers: {
    items: [
      {
        id: 'existing-s1',
        text: 'Existing strength item',
        quadrant: 'strengths',
        impact: 'high',
        source: 'user',
        confidence: 4,
        status: 'accepted',
        proposalStatus: 'accepted',
      },
    ],
  },
  generatedInitiatives: [],
  decisions: [],
  permissions: {},
  ...overrides,
});

describe('ToolDocumentView golden-flow (TLS-02 create-guard, TLS-03 section-nav + unmount autosave flush)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetToolStore();
    getUsersMock.mockResolvedValue([]);
    getLinkGraphBacklinksMock.mockResolvedValue([]);
    apiGetMock.mockResolvedValue([]);
  });

  afterEach(() => {
    resetToolStore();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TLS-02 — duplicate tool_sessions create guard
  // ─────────────────────────────────────────────────────────────────────────
  it('TLS-02: calls Api.createToolSession exactly once under a StrictMode double-invoke race', async () => {
    createToolSessionMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ id: 'new-session-1', status: 'DRAFT' }), 10);
        })
    );

    render(
      <React.StrictMode>
        <ToolDocumentView toolType="dynamic-swot" sessionId={undefined} onBack={vi.fn()} />
      </React.StrictMode>
    );

    await waitFor(() => {
      expect(createToolSessionMock).toHaveBeenCalled();
    });

    // Give any (incorrectly) duplicated in-flight call a chance to also land.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(createToolSessionMock).toHaveBeenCalledTimes(1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TLS-03 — section navigation preserves an in-progress edit
  // ─────────────────────────────────────────────────────────────────────────
  it('TLS-03: an edit made in the SWOT Build phase survives switching sections away and back', async () => {
    getToolSessionMock.mockResolvedValue(baseSwotSession());
    updateToolSessionMock.mockResolvedValue({ id: 'sess-existing-1' });

    render(
      <ToolDocumentView toolType="dynamic-swot" sessionId="sess-existing-1" onBack={vi.fn()} />
    );

    await waitFor(() => {
      expect(getToolSessionMock).toHaveBeenCalledWith('sess-existing-1');
    });
    // Let the rest of fetchAll's chained awaits (getUsers, comments, history,
    // backlinks) settle before interacting, so their state updates land inside
    // act() instead of racing our subsequent fireEvent calls.
    await waitFor(() => {
      expect(getUsersMock).toHaveBeenCalled();
      expect(getLinkGraphBacklinksMock).toHaveBeenCalled();
      expect(apiGetMock).toHaveBeenCalledTimes(2);
    });

    // Navigate to the 'swot' phase section (SWOT Build — renders all 4 quadrants).
    const swotNavButton = await screen.findByTestId('nmode-section-swot');
    fireEvent.click(swotNavButton);

    await waitFor(() => {
      expect(screen.getByText('Weaknesses')).toBeInTheDocument();
    });

    // Find the Weaknesses quadrant card and add a new item through the REAL
    // rendered input (SWOTBuildPhase's QuadrantCard "add point" input+button).
    const weaknessesHeading = screen.getByText('Weaknesses');
    const weaknessesCard = weaknessesHeading.closest('div.rounded-\\[26px\\]') as HTMLElement;
    expect(weaknessesCard).toBeTruthy();

    const draftInput = within(weaknessesCard).getByRole('textbox');
    fireEvent.change(draftInput, { target: { value: 'New weakness from golden-flow test' } });
    const addButton = within(weaknessesCard).getByRole('button');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('New weakness from golden-flow test')).toBeInTheDocument();
    });

    // Switch away to another section (Mission & Context — does not render any
    // SWOT quadrant items), then back to 'swot'.
    fireEvent.click(screen.getByTestId('nmode-section-mission'));
    await waitFor(() => {
      expect(screen.queryByText('Weaknesses')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('New weakness from golden-flow test')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('nmode-section-swot'));

    await waitFor(() => {
      expect(screen.getByText('New weakness from golden-flow test')).toBeInTheDocument();
    });

    // Proof this went through the real store, not local component state: the
    // Strengths item hydrated from the API is still present too.
    expect(screen.getByText('Existing strength item')).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TLS-03 — unmount flushes a pending (debounced) autosave
  // ─────────────────────────────────────────────────────────────────────────
  it('TLS-03: unmounting before the 2s autosave debounce fires still persists the edit', async () => {
    getToolSessionMock.mockResolvedValue(baseSwotSession());
    let resolveUpdate: (value: unknown) => void = () => {};
    updateToolSessionMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        })
    );

    const { unmount } = render(
      <ToolDocumentView toolType="dynamic-swot" sessionId="sess-existing-1" onBack={vi.fn()} />
    );

    await waitFor(() => {
      expect(getToolSessionMock).toHaveBeenCalledWith('sess-existing-1');
    });
    await waitFor(() => {
      expect(getUsersMock).toHaveBeenCalled();
      expect(getLinkGraphBacklinksMock).toHaveBeenCalled();
      expect(apiGetMock).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(await screen.findByTestId('nmode-section-swot'));
    await waitFor(() => {
      expect(screen.getByText('Weaknesses')).toBeInTheDocument();
    });

    const weaknessesHeading = screen.getByText('Weaknesses');
    const weaknessesCard = weaknessesHeading.closest('div.rounded-\\[26px\\]') as HTMLElement;
    const draftInput = within(weaknessesCard).getByRole('textbox');
    fireEvent.change(draftInput, { target: { value: 'Unmount-flush weakness' } });
    fireEvent.click(within(weaknessesCard).getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('Unmount-flush weakness')).toBeInTheDocument();
    });

    // The debounced autosave effect has (synchronously, in its effect body —
    // not its setTimeout callback) armed `pendingAutoSaveFlushRef`. Unmount
    // NOW, well before the 2000ms debounce would fire, and prove the
    // TLS-03 unmount-flush effect still calls Api.updateToolSession.
    expect(updateToolSessionMock).not.toHaveBeenCalled();

    await act(async () => {
      unmount();
    });

    expect(updateToolSessionMock).toHaveBeenCalledTimes(1);
    const [calledSessionId, calledPayload] = updateToolSessionMock.mock.calls[0];
    expect(calledSessionId).toBe('sess-existing-1');
    const savedItems = (calledPayload as any)?.answers?.items ?? [];
    const savedWeakness = savedItems.find(
      (item: any) => item.text === 'Unmount-flush weakness'
    );
    expect(savedWeakness).toBeTruthy();
    expect(savedWeakness.quadrant).toBe('weaknesses');

    resolveUpdate({});
  });
});
