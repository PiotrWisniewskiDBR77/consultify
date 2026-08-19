import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import type { ToolSession } from '@/store/useToolStore';

import { SWOTInsightsPhase } from '../SWOTInsightsPhase';

const receipt = {
  lineageState: 'PINNED' as const,
  receiptId: 'receipt-1',
  recommendationId: 'move-1',
  candidateId: 'candidate-1',
  toolOutputId: 'output-1',
  toolOutputVersion: 1,
  toolOutputContentHash: 'sha256-frozen',
  sourceRevision: 7,
  createdAt: '2026-08-19T12:00:00.000Z',
};

const session = {
  id: 'session-1',
  toolType: 'dynamic-swot',
  status: 'APPROVED',
  inputData: {
    signals: [],
    items: [],
    correlations: [],
    tensions: [],
    recommendedMoves: [
      {
        id: 'move-1',
        title: 'Launch bounded pilot',
        category: 'quick-win',
        rationale: 'Frozen rationale',
        linkedTensionIds: [],
        linkedItemIds: [],
        expectedImpact: 'high',
        estimatedEffort: 'medium',
        firstStep: 'Select one customer',
        ownerRole: 'Sales Director',
      },
    ],
    outputCandidates: [],
  },
} as unknown as ToolSession;

describe('SWOT mounted Candidate handoff receipt', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('cold-reopens the exact frozen receipt and does not offer a duplicate write', async () => {
    const get = vi.spyOn(Api, 'getSwotCandidateReceipts').mockResolvedValue({ receipts: [receipt] });
    const post = vi.spyOn(Api, 'handoffSwotCandidate');
    render(<SWOTInsightsPhase session={session} isPolish={false} />);

    const badge = await screen.findByTestId('swot-candidate-receipt-move-1');
    expect(badge).toHaveAttribute('title', 'output-1@1');
    expect(get).toHaveBeenCalledWith('session-1');
    expect(post).not.toHaveBeenCalled();
  });

  it('sends only the selected frozen recommendation id and renders returned receipt', async () => {
    vi.spyOn(Api, 'getSwotCandidateReceipts').mockResolvedValue({ receipts: [] });
    const post = vi.spyOn(Api, 'handoffSwotCandidate').mockResolvedValue({
      created: true,
      candidate: { id: 'candidate-1', title: 'Launch bounded pilot' },
      receipt,
    });
    render(<SWOTInsightsPhase session={session} isPolish={false} />);

    const button = await screen.findByRole('button', {
      name: 'discoveryToolsTools.common.createCandidate',
    });
    fireEvent.click(button);

    await waitFor(() => expect(post).toHaveBeenCalledWith('session-1', { id: 'move-1' }));
    expect(await screen.findByTestId('swot-candidate-receipt-move-1')).toHaveAttribute(
      'title',
      'output-1@1'
    );
  });

  it('shows an unresolved historical receipt read-only instead of hiding or inferring lineage', async () => {
    vi.spyOn(Api, 'getSwotCandidateReceipts').mockResolvedValue({
      receipts: [
        {
          ...receipt,
          lineageState: 'HISTORICAL_UNRESOLVED',
          toolOutputId: null,
          toolOutputVersion: null,
          toolOutputContentHash: null,
          sourceRevision: null,
        },
      ],
    });
    const post = vi.spyOn(Api, 'handoffSwotCandidate');
    render(<SWOTInsightsPhase session={session} isPolish={false} />);

    const badge = await screen.findByTestId('swot-candidate-receipt-move-1');
    expect(badge).toHaveTextContent('NEEDS_DECISION');
    expect(badge).toHaveAttribute(
      'title',
      'NEEDS_DECISION: historical receipt has no frozen output lineage'
    );
    expect(post).not.toHaveBeenCalled();
  });
});
