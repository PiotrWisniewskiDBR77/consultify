/**
 * PrezentacjeView — "?entry=blank" auto-create failure regression test.
 *
 * Bug fixed 2026-07-28 (żywy odbiór, same class as ExceleView): a failed
 * `handleCreateEmptyDeck` used to fire only a `toast.error(...)` (gone after
 * a few seconds) while `entryMode` stayed 'blank' forever — no permanent
 * affordance to retry or leave, just an unkillable spinner. Success is
 * unaffected by this bug (`openInDeckBuilder` navigates to a DIFFERENT
 * route, `/presentations/builder/:id`, which unmounts this view).
 *
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  pipelineState: null as any,
  apiPostMock: vi.fn(),
  apiGetMock: vi.fn(),
}));

vi.mock('../../../../src/components/AIChat/KimiWorkspace/useKimiArtifactPipeline', () => ({
  useKimiArtifactPipeline: () => mockState.pipelineState,
}));

vi.mock('../../../../src/components/AIChat/KimiWorkspace/KimiWorkspaceShell', () => ({
  KimiWorkspaceShell: (props: any) => (
    <div data-testid="kimi-shell" data-lane={props.lane} />
  ),
}));

vi.mock('../../../../src/utils/melsPrezentacjeFlag', () => ({
  isMelsPrezentacjeEnabled: () => false,
}));

vi.mock('../../../../src/services/api', () => ({
  Api: {
    post: (...args: any[]) => mockState.apiPostMock(...args),
    get: (...args: any[]) => mockState.apiGetMock(...args),
  },
}));

vi.mock('../../../../src/store/useConversationStore', () => ({
  useConversationStore: (selector: any) =>
    selector({
      activeMessages: [],
    }),
}));

vi.mock('../../../../src/store/useAppStore', () => ({
  useAppStore: (selector: any) =>
    selector({
      chatKickoffMessage: null,
      clearChatKickoffMessage: vi.fn(),
    }),
}));

import PrezentacjeView from '../../../../src/components/AIChat/KimiWorkspace/PrezentacjeView';

function resetPipeline(overrides: Record<string, unknown> = {}) {
  mockState.pipelineState = {
    taskSteps: [],
    totalSteps: 8,
    completedSteps: 0,
    isGenerating: false,
    isCompleted: false,
    isFailed: false,
    failureReason: null,
    preview: null,
    currentRun: null,
    isBusy: false,
    startGeneration: vi.fn().mockResolvedValue(undefined),
    advancePipeline: vi.fn().mockResolvedValue(undefined),
    handleReplay: vi.fn(),
    handleRemix: vi.fn(),
    handleDownload: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function renderPrezentacje(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/prezentacje-gen" element={<PrezentacjeView />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PrezentacjeView — ?entry=blank auto-create gate (failure path)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPipeline();
  });

  it('shows a permanent retry/back state instead of an eternal spinner when creation fails', async () => {
    mockState.apiPostMock.mockRejectedValue(new Error('network down'));

    renderPrezentacje('/prezentacje-gen?view=new&entry=blank');

    expect(screen.getByTestId('prezentacje-blank-creating')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('prezentacje-blank-failed')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('prezentacje-blank-creating')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Spróbuj ponownie' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wróć do Materiałów' })).toBeInTheDocument();

    // The failed state persists — it does not silently revert to "creating"
    // once the toast (a few seconds) would have faded.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByTestId('prezentacje-blank-failed')).toBeInTheDocument();
  });
});
