import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { useToolStore } from '@/store/useToolStore';

import { SWOTInputExplorationPhase } from '../SWOTInputExplorationPhase';

function Harness() {
  const session = useToolStore((state) => state.currentSession);
  return session ? <SWOTInputExplorationPhase session={session} isPolish={false} /> : null;
}

describe('SWOTInputExplorationPhase AI fill', () => {
  beforeEach(() => {
    useToolStore.setState({ currentSession: null, currentStep: 1, savedSessions: [] });
    useToolStore.getState().createSession('dynamic-swot');
    vi.restoreAllMocks();
  });

  it('requests governed proposals for all streams without auto-accepting any item', async () => {
    const create = vi.spyOn(Api, 'createSwotProposals').mockResolvedValue({
      proposals: [
        {
          id: 'proposal-1',
          toolSessionId: useToolStore.getState().currentSession!.id,
          quadrant: 'strengths',
          operation: 'add',
          targetItemId: null,
          before: null,
          proposedAfter: { text: 'AI proposed strength' },
          finalAfter: null,
          rationale: 'Source-backed rationale',
          sourceRefs: ['mission'],
          isAssumption: false,
          confidence: 0.8,
          modelMetadata: {},
          status: 'pending',
          expectedVersion: 1,
          createdBy: 'teresa',
          createdAt: new Date().toISOString(),
          decidedBy: null,
          decidedAt: null,
        },
      ],
    });

    render(<Harness />);
    fireEvent.click(screen.getByTestId('swot-fill-all-ai'));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith(useToolStore.getState().currentSession!.id);
    expect(await screen.findByText('AI proposed strength')).toBeInTheDocument();
    expect((useToolStore.getState().currentSession!.inputData as any).signals).toHaveLength(0);
    expect(
      within(screen.getByRole('tablist', { name: 'SWOT categories' })).getAllByText('0/5')
    ).toHaveLength(4);
    expect(
      within(screen.getByRole('navigation', { name: 'SWOT analysis streams' })).getAllByText('0/5')
    ).toHaveLength(4);
  });

  it('shows a governed failure without accepting or inventing any item', async () => {
    vi.spyOn(Api, 'createSwotProposals').mockRejectedValue(new Error('provider unavailable'));
    render(<Harness />);

    fireEvent.click(screen.getByTestId('swot-fill-all-ai'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Teresa could not prepare proposals. Try again.'
    );
    expect((useToolStore.getState().currentSession!.inputData as any).signals).toHaveLength(0);
  });
});
