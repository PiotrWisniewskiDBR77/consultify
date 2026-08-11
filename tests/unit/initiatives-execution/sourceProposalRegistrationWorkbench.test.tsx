import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SourceProposalRegistrationWorkbench } from '../../../src/components/Initiatives/SourceProposalRegistrationWorkbench';
import { RuntimeApiError } from '../../../src/services/initiatives-execution/runtimeApi';

vi.mock('@/components/standard/StandardTable', () => ({
  StandardTable: ({ data, onRowClick }: any) => (
    <div>
      {data.map((row: any) => (
        <button key={row.id} type="button" onClick={() => onRowClick(row)}>
          {row.title}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('@/components/shared/TableWithPreviewLayout', () => ({
  TableWithPreviewLayout: ({ children, selectedItem, renderPreview, renderPreviewFooter }: any) => (
    <div>
      {children}
      {selectedItem ? renderPreview(selectedItem) : null}
      {selectedItem ? renderPreviewFooter(selectedItem) : null}
    </div>
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));

const proposal = {
  id: 'proposal-aco-001',
  title: 'Automated Changeover Optimization',
  problem: 'Median changeover is 95 minutes.',
  proposedOutcome: null,
  sourceType: 'assessment-finding',
  sourceId: 'ASM-F-ACO-001',
  sourceVersion: 3,
  proposalVersion: 2,
  projectId: 'operations-transformation-2027',
  projectName: 'Operations Transformation 2027',
  initiativeOwnerId: 'iwona-owner',
  ownerName: 'Iwona Owner',
  evidenceState: 'READY' as const,
  duplicateState: 'CLEAR' as const,
  updatedAt: '2026-08-09T20:00:00Z',
  policy: {
    policyId: 'standard-industrial',
    version: 3,
    baseline: 'STANDARD' as const,
    strictness: 3,
    source: 'PROJECT' as const,
  },
  capabilities: {
    canRegister: true,
    canMerge: true,
    canExtend: true,
    canReturn: true,
    canDefer: true,
    canDismiss: true,
  },
};

const renderWorkbench = (overrides: Record<string, unknown> = {}) => {
  const onOpenInitiative = vi.fn();
  const register = vi.fn().mockResolvedValue({
    status: 'APPLIED',
    aggregateVersion: 1,
    initiativeId: 'aco-initiative-001',
  });
  const readBack = vi.fn().mockResolvedValue({
    version: 1,
    updatedAt: '2026-08-09T20:01:00Z',
    initiative: {
      initiativeId: 'aco-initiative-001',
      lifecycleState: 'REGISTERED_DRAFT',
      title: proposal.title,
      projectId: proposal.projectId,
      readiness: 'NOT_EVALUATED',
      source: {
        proposalId: proposal.id,
        proposalVersion: proposal.proposalVersion,
        sourceType: proposal.sourceType,
        sourceId: proposal.sourceId,
        sourceVersion: proposal.sourceVersion,
      },
    },
  });
  render(
    <SourceProposalRegistrationWorkbench
      proposals={[proposal]}
      createIds={() => ({
        initiativeId: 'aco-initiative-001',
        clientRequestId: 'aco-register-001',
      })}
      onOpenInitiative={onOpenInitiative}
      onOpenValidation={vi.fn()}
      onProposalDecided={vi.fn()}
      register={register}
      readBack={readBack}
      {...overrides}
    />
  );
  return { onOpenInitiative, register, readBack };
};

describe('SourceProposalRegistrationWorkbench', () => {
  it('restores the exact selected proposal from durable route context', () => {
    renderWorkbench({ initialSelectedId: proposal.id });
    expect(screen.getByText('Median changeover is 95 minutes.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Register$/ })).toBeInTheDocument();
  });
  it('registers only after impact confirmation, waits for read-back and opens canonical ID', async () => {
    const { register, readBack, onOpenInitiative } = renderWorkbench();
    fireEvent.click(screen.getByRole('button', { name: proposal.title }));
    expect(screen.getByText('Unknown — requires definition')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Register$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Register' }));

    await waitFor(() => expect(readBack).toHaveBeenCalledWith('aco-initiative-001'));
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({
        clientRequestId: 'aco-register-001',
        sourceVersion: 3,
      })
    );
    fireEvent.click(await screen.findByRole('button', { name: /Open Initiative/ }));
    expect(onOpenInitiative).toHaveBeenCalledWith('aco-initiative-001');
  });

  it('shows an actionable conflict and never attempts read-back', async () => {
    const register = vi
      .fn()
      .mockRejectedValue(new RuntimeApiError(409, 'VERSION_OR_IDEMPOTENCY_CONFLICT'));
    const readBack = vi.fn();
    renderWorkbench({ register, readBack });
    fireEvent.click(screen.getByRole('button', { name: proposal.title }));
    fireEvent.click(screen.getByRole('button', { name: /^Register$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Register' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Review current data');
    expect(readBack).not.toHaveBeenCalled();
  });

  it('keeps the accepted canonical ID when read-back is delayed and retries idempotently', async () => {
    const register = vi.fn().mockResolvedValue({
      status: 'APPLIED',
      aggregateVersion: 1,
      initiativeId: 'aco-initiative-001',
    });
    const readBack = vi.fn().mockRejectedValue(new Error('projection unavailable'));
    renderWorkbench({ register, readBack });
    fireEvent.click(screen.getByRole('button', { name: proposal.title }));
    fireEvent.click(screen.getByRole('button', { name: /^Register$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Register' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Registration was accepted');
    expect(screen.queryByText('proposal remains unchanged')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Register$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Register' }));
    await waitFor(() => expect(register).toHaveBeenCalledTimes(2));
    expect(register.mock.calls[1]?.[0]).toMatchObject({
      initiativeId: 'aco-initiative-001',
      clientRequestId: 'aco-register-001',
    });
  });

  it('records Return only with resolver, due date and human rationale', async () => {
    const decide = vi.fn().mockResolvedValue({ status: 'APPLIED', aggregateVersion: 1 });
    const onProposalDecided = vi.fn();
    renderWorkbench({ decide, onProposalDecided });
    fireEvent.click(screen.getByRole('button', { name: proposal.title }));
    fireEvent.click(screen.getByRole('button', { name: /Other decision/ }));
    const submit = screen.getByRole('button', { name: 'Record decision' });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Human rationale'), {
      target: { value: 'The source owner must provide the missing operational evidence.' },
    });
    fireEvent.change(screen.getByLabelText('Accountable resolver'), {
      target: { value: 'source-owner-1' },
    });
    fireEvent.change(screen.getByLabelText('Resolution due'), {
      target: { value: '2026-08-20T12:00' },
    });
    fireEvent.click(submit);

    await waitFor(() => expect(onProposalDecided).toHaveBeenCalledWith(proposal.id));
    expect(decide).toHaveBeenCalledWith(
      proposal.id,
      expect.objectContaining({
        disposition: 'RETURN',
        expectedProposalVersion: 2,
        resolverId: 'source-owner-1',
        evidenceSnapshot: expect.objectContaining({ sourceVersion: 3 }),
      })
    );
  });

  it('blocks Register while source evidence is stale', () => {
    renderWorkbench({ proposals: [{ ...proposal, evidenceState: 'STALE' }] });
    fireEvent.click(screen.getByRole('button', { name: proposal.title }));
    expect(screen.getByRole('button', { name: /^Register$/ })).toBeDisabled();
  });
});
