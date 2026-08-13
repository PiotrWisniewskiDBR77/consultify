/**
 * TeresaProposalCard — Intent → Preview → Confirmation (człowiek) → Commit.
 * Mockuje `../workspaceApi` NA POZIOMIE MODUŁU.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../workspaceApi', async () => {
  const actual = await vi.importActual<typeof import('../workspaceApi')>('../workspaceApi');
  return {
    ...actual,
    createIntent: vi.fn(),
    getAiPreview: vi.fn(),
    decideProposal: vi.fn(),
    commitProposal: vi.fn(),
  };
});

import { TeresaProposalCard } from '../TeresaProposalCard';
import * as workspaceApi from '../workspaceApi';
import type { WorkspaceAiProposal } from '../workspaceApi';

const mockedCreateIntent = vi.mocked(workspaceApi.createIntent);
const mockedDecideProposal = vi.mocked(workspaceApi.decideProposal);
const mockedCommitProposal = vi.mocked(workspaceApi.commitProposal);

function proposal(overrides: Partial<WorkspaceAiProposal> = {}): WorkspaceAiProposal {
  return {
    id: 'proposal-1',
    programId: 'prog-1',
    targetType: 'criterion',
    targetId: 'crit-1',
    intent: 'explain_criterion',
    proposal: { explanation: 'Because the requirement says X.' },
    preview: { field: 'auditor_note', before: null, after: 'Because the requirement says X.' },
    rationale: 'Built from requirement text.',
    confidence: 0.6,
    sources: [{ type: 'criterion', id: 'crit-1', excerpt: 'Access control policy' }],
    status: 'pending',
    decidedAt: null,
    committedAt: null,
    ...overrides,
  };
}

function renderCard(props: { canPropose?: boolean; canCommit?: boolean } = {}) {
  const onCommitted = vi.fn();
  const utils = render(
    <TeresaProposalCard
      label="Teresa: explain the criterion"
      programId="prog-1"
      targetType="criterion"
      targetId="crit-1"
      intent="explain_criterion"
      canPropose={props.canPropose ?? true}
      canCommit={props.canCommit ?? true}
      isPolish={false}
      onCommitted={onCommitted}
    />
  );
  return { ...utils, onCommitted };
}

describe('TeresaProposalCard', () => {
  it('does not offer "Ask Teresa" without ai.propose, and explains why', () => {
    renderCard({ canPropose: false });
    expect(screen.queryByRole('button', { name: /ask teresa/i })).not.toBeInTheDocument();
    expect(screen.getByText(/requires the ai.propose permission/i)).toBeInTheDocument();
  });

  it('shows the before/after preview after asking Teresa', async () => {
    mockedCreateIntent.mockResolvedValue(proposal());
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: /ask teresa/i }));

    await waitFor(() => expect(mockedCreateIntent).toHaveBeenCalled());
    expect(await screen.findByText('Because the requirement says X.')).toBeInTheDocument();
    // "before" is rendered too, even when null (rendered as an em dash) — the
    // preview is always pole-po-polu, not just the new value.
    expect(screen.getByTestId('teresa-preview-row-auditor_note')).toBeInTheDocument();
  });

  it('has no active "Apply" for a proposal without sources', async () => {
    mockedCreateIntent.mockResolvedValue(proposal({ sources: [], status: 'accepted' }));
    mockedDecideProposal.mockResolvedValue(proposal({ sources: [], status: 'accepted' }));
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: /ask teresa/i }));
    await screen.findByTestId('teresa-sources');

    expect(screen.getByText(/no sources — the proposal cannot be applied/i)).toBeInTheDocument();
    // status is already 'accepted' in this fixture — the Apply button renders
    // but MUST be disabled because there are no sources.
    const applyButton = await screen.findByRole('button', { name: /^apply$/i });
    expect(applyButton).toBeDisabled();
  });

  it('requires two explicit steps — accept, then a separate commit — before anything is applied', async () => {
    mockedCreateIntent.mockResolvedValue(proposal());
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: /ask teresa/i }));
    await screen.findByText('Because the requirement says X.');

    // Step 0: no Apply button exists yet — only Accept/Reject.
    expect(screen.queryByRole('button', { name: /^apply$/i })).not.toBeInTheDocument();
    expect(mockedCommitProposal).not.toHaveBeenCalled();

    // Step 1: accept (decide) — still must NOT commit by itself.
    mockedDecideProposal.mockResolvedValue(proposal({ status: 'accepted' }));
    fireEvent.click(screen.getByRole('button', { name: /^accept$/i }));
    await waitFor(() => expect(mockedDecideProposal).toHaveBeenCalledWith('proposal-1', { decision: 'accept' }));
    expect(mockedCommitProposal).not.toHaveBeenCalled();

    // Step 2: a SEPARATE, explicit "Apply" click actually commits.
    mockedCommitProposal.mockResolvedValue(proposal({ status: 'accepted', committedAt: '2026-08-01T00:00:00Z' }));
    const applyButton = await screen.findByRole('button', { name: /^apply$/i });
    expect(applyButton).not.toBeDisabled();
    fireEvent.click(applyButton);

    await waitFor(() => expect(mockedCommitProposal).toHaveBeenCalledWith('proposal-1'));
    expect(await screen.findByText(/^applied\.$/i)).toBeInTheDocument();
  });

  it('does not offer "Apply" without ai.commit, and explains why', async () => {
    mockedCreateIntent.mockResolvedValue(proposal({ status: 'accepted' }));
    renderCard({ canCommit: false });

    fireEvent.click(screen.getByRole('button', { name: /ask teresa/i }));
    await screen.findByText('Because the requirement says X.');

    expect(screen.getByText(/requires the ai.commit permission/i)).toBeInTheDocument();
    const applyButton = screen.getByRole('button', { name: /^apply$/i });
    expect(applyButton).toBeDisabled();
  });
});
