/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProposalCard } from '../../../src/components/DiscoveryTools/shared/ProposalCard';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'discoveryToolsSteps.proposalCard.accept': 'Accept',
        'discoveryToolsSteps.proposalCard.commentAndRethink': 'Comment & rethink',
        'discoveryToolsSteps.proposalCard.rethink': 'Rethink',
        'discoveryToolsSteps.proposalCard.reject': 'Reject',
        'discoveryToolsSteps.proposalCard.feedbackPlaceholder': 'Your feedback for AI',
        'discoveryToolsSteps.proposalCard.rethinkShort': 'Send',
      })[key] || key,
    i18n: { language: 'en' },
  }),
}));

describe('ProposalCard', () => {
  const onAccept = vi.fn();
  const onReject = vi.fn();
  const onRethink = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows proposal actions inside the kebab menu only', async () => {
    render(
      <ProposalCard
        cardId="card-1"
        cardType="item"
        proposalStatus="ai-proposed"
        onAccept={onAccept}
        onReject={onReject}
        onRethink={onRethink}
      >
        <div>AI proposal body</div>
      </ProposalCard>
    );

    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Row actions'));

    expect(screen.getByRole('menuitem', { name: 'Accept' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Comment & rethink' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Rethink' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Reject' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Accept' }));

    await waitFor(() => {
      expect(onAccept).toHaveBeenCalledWith('item', 'card-1');
    });
  });

  it('opens comment flow from kebab menu and sends rethink comment', async () => {
    render(
      <ProposalCard
        cardId="card-2"
        cardType="move"
        proposalStatus="ai-proposed"
        onAccept={onAccept}
        onReject={onReject}
        onRethink={onRethink}
      >
        <div>AI proposal body</div>
      </ProposalCard>
    );

    fireEvent.click(screen.getByLabelText('Row actions'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Comment & rethink' }));

    fireEvent.change(screen.getByPlaceholderText('Your feedback for AI'), {
      target: { value: 'Make it more concrete' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(onRethink).toHaveBeenCalledWith('move', 'card-2', 'Make it more concrete');
    });
  });
});
