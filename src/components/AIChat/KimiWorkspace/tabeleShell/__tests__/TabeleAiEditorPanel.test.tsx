/**
 * @vitest-environment jsdom
 *
 * Component tests for `<TabeleAiEditorPanel>` (Block C · C-S5).
 *
 * Coverage:
 *   - Renders all 8 level cards.
 *   - Levels 7/8 are disabled when `isSuperAdmin` is false.
 *   - "Propose" calls `proposeAiEdit` with the active level + prompt.
 *   - Diff card renders after propose, with Apply/Reject buttons wired
 *     to the corresponding API client functions.
 *   - Apply clears the active proposal on success.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  proposeAiEdit: vi.fn(),
  applyAiProposal: vi.fn(),
  rejectAiProposal: vi.fn(),
  getAiBudget: vi.fn(),
}));

vi.mock('@/services/api/tablePlatform.api', () => ({
  proposeAiEdit: mocks.proposeAiEdit,
  applyAiProposal: mocks.applyAiProposal,
  rejectAiProposal: mocks.rejectAiProposal,
  getAiBudget: mocks.getAiBudget,
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(
    (msg: string, _opts?: unknown) => msg,
    { success: vi.fn(), error: vi.fn() }
  ),
}));

import { TabeleAiEditorPanel } from '../aiEditor/TabeleAiEditorPanel';

describe('<TabeleAiEditorPanel>', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 8 level cards', () => {
    render(
      <TabeleAiEditorPanel
        tableId="tbl-1"
        workspaceId="ws-1"
        testInitialBudget={null}
      />
    );
    for (const id of [
      'cell',
      'record',
      'column',
      'structure',
      'view',
      'relational',
      'methodological',
      'source',
    ]) {
      expect(screen.getByTestId(`ai-editor-level-${id}`)).toBeInTheDocument();
    }
  });

  it('disables methodological + source for non-super-admin', () => {
    render(
      <TabeleAiEditorPanel
        tableId="tbl-1"
        workspaceId="ws-1"
        isSuperAdmin={false}
        testInitialBudget={null}
      />
    );
    expect(screen.getByTestId('ai-editor-level-methodological')).toBeDisabled();
    expect(screen.getByTestId('ai-editor-level-source')).toBeDisabled();
    expect(screen.getByTestId('ai-editor-level-cell')).not.toBeDisabled();
  });

  it('proposes edits with the active level and prompt', async () => {
    mocks.proposeAiEdit.mockResolvedValueOnce({
      proposalId: 'p-1',
      level: 'cell',
      softWarn: false,
      handlerStatus: 'live',
    });

    render(
      <TabeleAiEditorPanel
        tableId="tbl-1"
        workspaceId="ws-1"
        testInitialBudget={null}
      />
    );

    fireEvent.change(screen.getByTestId('ai-editor-prompt'), {
      target: { value: 'Set status to Done for record 42' },
    });

    fireEvent.click(screen.getByTestId('ai-editor-propose'));

    await waitFor(() => {
      expect(mocks.proposeAiEdit).toHaveBeenCalledWith('tbl-1', {
        level: 'cell',
        prompt: 'Set status to Done for record 42',
        context: undefined,
      });
    });
    expect(screen.getByTestId('ai-proposal-diff-card')).toBeInTheDocument();
  });

  it('apply success clears the active proposal', async () => {
    mocks.proposeAiEdit.mockResolvedValueOnce({
      proposalId: 'p-1',
      level: 'cell',
      softWarn: false,
      handlerStatus: 'live',
    });
    mocks.applyAiProposal.mockResolvedValueOnce({
      proposalId: 'p-1',
      applied: true,
      reason: 'ok',
    });

    render(
      <TabeleAiEditorPanel
        tableId="tbl-1"
        workspaceId="ws-1"
        testInitialBudget={null}
      />
    );
    fireEvent.change(screen.getByTestId('ai-editor-prompt'), {
      target: { value: 'do something' },
    });
    fireEvent.click(screen.getByTestId('ai-editor-propose'));

    await waitFor(() => screen.getByTestId('ai-proposal-diff-card'));
    fireEvent.click(screen.getByTestId('ai-proposal-apply'));

    await waitFor(() => {
      expect(mocks.applyAiProposal).toHaveBeenCalledWith('p-1', 'ws-1', {
        idempotent: true,
      });
    });
    await waitFor(() => {
      expect(screen.queryByTestId('ai-proposal-diff-card')).toBeNull();
    });
  });

  it('reject calls rejectAiProposal and hides the card', async () => {
    mocks.proposeAiEdit.mockResolvedValueOnce({
      proposalId: 'p-2',
      level: 'cell',
      softWarn: false,
      handlerStatus: 'live',
    });
    mocks.rejectAiProposal.mockResolvedValueOnce({
      proposalId: 'p-2',
      rejected: true,
    });

    render(
      <TabeleAiEditorPanel
        tableId="tbl-1"
        workspaceId="ws-1"
        testInitialBudget={null}
      />
    );
    fireEvent.change(screen.getByTestId('ai-editor-prompt'), {
      target: { value: 'do something' },
    });
    fireEvent.click(screen.getByTestId('ai-editor-propose'));
    await waitFor(() => screen.getByTestId('ai-proposal-diff-card'));
    fireEvent.click(screen.getByTestId('ai-proposal-reject'));
    await waitFor(() => {
      expect(mocks.rejectAiProposal).toHaveBeenCalledWith('p-2', 'ws-1');
    });
    await waitFor(() => {
      expect(screen.queryByTestId('ai-proposal-diff-card')).toBeNull();
    });
  });
});
