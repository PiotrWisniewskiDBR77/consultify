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
});
