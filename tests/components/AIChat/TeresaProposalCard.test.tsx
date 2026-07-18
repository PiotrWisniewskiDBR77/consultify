/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { TeresaProposalCard } from '../../../src/components/AIChat/TeresaProposalCard';

const approveTeresaProposal = vi.fn();
const rejectTeresaProposal = vi.fn();
const executeTeresaProposal = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
  }),
}));

vi.mock('../../../src/services/api', () => ({
  Api: {
    approveTeresaProposal: (...args: unknown[]) => approveTeresaProposal(...args),
    rejectTeresaProposal: (...args: unknown[]) => rejectTeresaProposal(...args),
    executeTeresaProposal: (...args: unknown[]) => executeTeresaProposal(...args),
  },
}));

const baseProposal = {
  proposalId: 'proposal-1',
  contractId: 'teresa_copilot_v1',
  title: 'Prepare initiative draft',
  summary: 'Proposal prepared for Initiatives.',
  state: 'proposal',
  approvalState: 'awaiting_review',
  allowedActions: ['approve', 'reject', 'navigate'] as const,
  targetModule: 'initiatives',
  targetLabel: 'Initiatives',
  handoffIntent: 'create',
  previewLines: ['Problem statement', 'Expected outcome'],
  auditCount: 1,
  resultRef: null,
  degraded: null,
};

describe('TeresaProposalCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders proposal details', () => {
    render(<TeresaProposalCard proposal={baseProposal as any} />);

    expect(screen.getByText('Teresa proposal')).toBeInTheDocument();
    expect(screen.getByText('Prepare initiative draft')).toBeInTheDocument();
    expect(screen.getByText('Problem statement')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });

  it('approves proposal and notifies parent with updated envelope', async () => {
    const onProposalUpdated = vi.fn();
    approveTeresaProposal.mockResolvedValue({
      data: {
        ...baseProposal,
        state: 'approved',
        approvalState: 'approved',
        allowedActions: ['execute', 'reject', 'navigate'],
      },
    });

    render(
      <TeresaProposalCard proposal={baseProposal as any} onProposalUpdated={onProposalUpdated} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      expect(approveTeresaProposal).toHaveBeenCalledWith('proposal-1');
      expect(onProposalUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'approved',
          allowedActions: expect.arrayContaining(['execute']),
        })
      );
    });
  });
});
