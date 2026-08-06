/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock('../../../../src/components/AIChat/KimiWorkspace/useKimiArtifactPipeline', () => ({
  useKimiArtifactPipeline: () => ({
    taskSteps: [], totalSteps: 0, completedSteps: 0, isGenerating: false,
    isCompleted: false, isFailed: false, failureReason: null, preview: null,
    currentRun: null, isBusy: false, startGeneration: vi.fn(), advancePipeline: vi.fn(),
    handleReplay: vi.fn(), handleRemix: vi.fn(), handleDownload: vi.fn(),
  }),
}));

vi.mock('../../../../src/components/AIChat/KimiWorkspace/KimiWorkspaceShell', () => ({
  KimiWorkspaceShell: () => (
    <div data-testid="kimi-shell">
      <button>Open builder</button><button>Download PPTX</button>
    </div>
  ),
}));

vi.mock('../../../../src/utils/melsPrezentacjeFlag', () => ({
  isMelsPrezentacjeEnabled: () => false,
}));

vi.mock('../../../../src/services/api', () => ({
  Api: { get: (...args: unknown[]) => state.apiGet(...args), post: vi.fn() },
}));

vi.mock('../../../../src/store/useConversationStore', () => ({
  useConversationStore: (selector: any) => selector({ activeMessages: [] }),
}));

vi.mock('../../../../src/store/useAppStore', () => ({
  useAppStore: (selector: any) =>
    selector({ chatKickoffMessage: null, clearChatKickoffMessage: vi.fn() }),
}));

import PrezentacjeView from '../../../../src/components/AIChat/KimiWorkspace/PrezentacjeView';

function renderReopen() {
  return render(
    <MemoryRouter initialEntries={['/prezentacje-gen?artifactId=deck-broken']}>
      <Routes><Route path="/prezentacje-gen" element={<PrezentacjeView />} /></Routes>
    </MemoryRouter>
  );
}

async function expectBlockingState() {
  await waitFor(() => expect(screen.getByTestId('prezentacje-reopen-error')).toBeInTheDocument());
  expect(screen.queryByTestId('kimi-shell')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /open builder/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /download pptx/i })).not.toBeInTheDocument();
  expect(screen.queryByText(/^Presentation$/)).not.toBeInTheDocument();
}

describe('PrezentacjeView — artifact reopen fails closed', () => {
  beforeEach(() => state.apiGet.mockReset());

  it('shows a blocking state for a 404 instead of a fabricated empty deck', async () => {
    state.apiGet
      .mockRejectedValueOnce(Object.assign(new Error('not found'), { status: 404 }))
      .mockResolvedValueOnce({ data: { data: { originRuntime: 'document' } } });
    renderReopen();
    await expectBlockingState();
  });

  it('shows a blocking state when persisted deck JSON is invalid', async () => {
    state.apiGet
      .mockResolvedValueOnce({ data: { data: { id: 'deck-broken' } } })
      .mockResolvedValueOnce({
        data: { data: { id: 'deck-broken', title: 'Broken', deck_json: '{invalid-json' } },
      });
    renderReopen();
    await expectBlockingState();
  });
});
