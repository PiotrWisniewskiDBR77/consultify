import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { GovernedChatHandoffProposal } from '@/services/api/v8/chat';
import { GovernedChatHandoffCard } from '../GovernedChatHandoffCard';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string, vars?: Record<string, unknown>) =>
      typeof fallback === 'string'
        ? fallback.replace('{{count}}', String(vars?.count ?? ''))
        : _key,
  }),
}));

const proposal = (state: GovernedChatHandoffProposal['state']): GovernedChatHandoffProposal => ({
  proposalId: 'proposal-1',
  producerRecordId: 'message-1',
  sourceContentHash: 'a'.repeat(64),
  sourceVersion: 1,
  targetKind: 'document',
  payload: {
    messageId: 'message-1',
    suggestedTitle: 'Pinned strategy',
    citationStats: { totalFound: 3, verified: 2, unverified: 1 },
  },
  state,
  decidedAt: state === 'pending' ? null : '2026-08-19T12:00:00.000Z',
  updatedAt: '2026-08-19T12:00:00.000Z',
});

describe('GovernedChatHandoffCard', () => {
  it('shows pinned provenance and requires an explicit human decision', () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    render(
      <GovernedChatHandoffCard
        proposal={proposal('pending')}
        onApprove={onApprove}
        onReject={onReject}
        onMaterialize={vi.fn()}
      />
    );
    expect(screen.getByText('Pinned strategy')).toBeInTheDocument();
    expect(screen.getByText(/3 source references preserved/)).toBeInTheDocument();
    const provenance = screen.getByTestId('governed-chat-handoff-provenance');
    expect(provenance).toHaveTextContent('Source');
    expect(provenance).toHaveTextContent('message-1');
    expect(provenance).toHaveTextContent('Hash');
    expect(provenance).toHaveTextContent('a'.repeat(64));
    expect(provenance).toHaveTextContent('Version');
    expect(provenance).toHaveTextContent('1');
    expect(screen.queryByText('Create document')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Approve'));
    fireEvent.click(screen.getByText('Reject'));
    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it('shows truthful busy/error state and only materializes an approved proposal', () => {
    const onMaterialize = vi.fn();
    const { rerender } = render(
      <GovernedChatHandoffCard
        proposal={proposal('approved')}
        busy="materialize"
        error="Owner role is required"
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onMaterialize={onMaterialize}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Owner role is required');
    expect(screen.getByText('Create document').closest('button')).toBeDisabled();
    expect(screen.getByText('Create document').closest('button')).toHaveAttribute(
      'aria-busy',
      'true'
    );

    rerender(
      <GovernedChatHandoffCard
        proposal={proposal('materialized')}
        targetRecordId="artifact-chat-123"
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onMaterialize={onMaterialize}
      />
    );
    expect(screen.getByText('Document created')).toBeInTheDocument();
    expect(screen.getByText('artifact-chat-123')).toBeInTheDocument();
  });

  it.each([
    ['pending', 'pending', 'Pending review'],
    ['approved', 'approved', 'Approved'],
    ['rejected', 'rejected', 'Rejected'],
    ['materialized', 'materialized', 'Created'],
    ['failed', 'failed', 'Action failed'],
  ] as const)('renders %s with a distinct semantic visual state', (state, visualState, label) => {
    render(
      <GovernedChatHandoffCard
        proposal={proposal(state)}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onMaterialize={vi.fn()}
      />
    );
    expect(screen.getByTestId('governed-chat-handoff-proposal-1')).toHaveAttribute(
      'data-visual-state',
      visualState
    );
    expect(screen.getByTestId('governed-chat-handoff-state')).toHaveTextContent(label);
    expect(screen.getByTestId('governed-chat-handoff-state')).toHaveAttribute('role', 'status');
  });

  it('separates the approved decision from materializable readiness', () => {
    render(
      <GovernedChatHandoffCard
        proposal={proposal('approved')}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onMaterialize={vi.fn()}
      />
    );
    expect(screen.getByTestId('governed-chat-handoff-state')).toHaveTextContent('Approved');
    expect(screen.getByTestId('governed-chat-handoff-materializable')).toHaveTextContent(
      'Ready to create'
    );
    expect(screen.getByRole('button', { name: 'Create document' })).toBeEnabled();
  });

  it('distinguishes working and failed UI states from the underlying proposal state', () => {
    const { rerender } = render(
      <GovernedChatHandoffCard
        proposal={proposal('approved')}
        busy="materialize"
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onMaterialize={vi.fn()}
      />
    );
    expect(screen.getByTestId('governed-chat-handoff-proposal-1')).toHaveAttribute(
      'data-visual-state',
      'working'
    );
    expect(screen.getByTestId('governed-chat-handoff-state')).toHaveTextContent('Working');

    rerender(
      <GovernedChatHandoffCard
        proposal={proposal('approved')}
        error="Materialization failed"
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onMaterialize={vi.fn()}
      />
    );
    expect(screen.getByTestId('governed-chat-handoff-proposal-1')).toHaveAttribute(
      'data-visual-state',
      'failed'
    );
    expect(screen.getByTestId('governed-chat-handoff-state')).toHaveTextContent('Action failed');
  });
});
