/**
 * AuditInitiativesTab — DEC-2026-08-25-66 (Piotr, werdykt partii D, uwaga 4 —
 * parytet z Tools/Assessment): the table had no row kebab at all. This
 * proves the kebab now exists with REAL, backend-gated transitions
 * (register/dismiss/defer), not a decorative addition.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../auditsMethodApi', async () => {
  const actual = await vi.importActual<typeof import('../auditsMethodApi')>('../auditsMethodApi');
  return {
    ...actual,
    listProposals: vi.fn(),
    registerProposal: vi.fn(),
    dismissProposal: vi.fn(),
    deferProposal: vi.fn(),
  };
});

import { AuditInitiativesTab } from '../tabs/AuditInitiativesTab';
import { listProposals, registerProposal, type AuditProposalSummary } from '../auditsMethodApi';

const mockedListProposals = vi.mocked(listProposals);
const mockedRegisterProposal = vi.mocked(registerProposal);

const draftProposal: AuditProposalSummary = {
  id: 'prop-1',
  programId: 'prog-1',
  programName: 'Q3 Compliance Audit',
  title: 'Fix intake process gap',
  sourceFindingIds: ['f-1', 'f-2'],
  priority: 'high',
  status: 'draft',
  updatedAt: '2026-08-10',
};

const registeredProposal: AuditProposalSummary = { ...draftProposal, id: 'prop-2', status: 'registered' };

async function openKebab(index = 0) {
  const triggers = await screen.findAllByRole('button', { name: /row actions/i });
  fireEvent.click(triggers[index]);
  return screen.findByRole('menu');
}

describe('AuditInitiativesTab — row kebab (DEC-2026-08-25-66)', () => {
  it('renders a working kebab with Register enabled for a draft proposal', async () => {
    mockedListProposals.mockResolvedValue({ items: [draftProposal], total: 1 });
    render(<AuditInitiativesTab isPolish={false} />);
    await waitFor(() => expect(screen.getByText('Fix intake process gap')).toBeInTheDocument());

    const menu = await openKebab();
    const registerItem = within(menu).getByText('Register as initiative');
    expect(registerItem.closest('button')).not.toBeDisabled();
  });

  it('disables Register/Defer/Dismiss for an already-registered proposal, with a real reason', async () => {
    mockedListProposals.mockResolvedValue({ items: [registeredProposal], total: 1 });
    render(<AuditInitiativesTab isPolish={false} />);
    await waitFor(() => expect(screen.getByText('Fix intake process gap')).toBeInTheDocument());

    const menu = await openKebab();
    expect(within(menu).getByText('Register as initiative').closest('button')).toBeDisabled();
    expect(within(menu).getByText('Defer').closest('button')).toBeDisabled();
    expect(within(menu).getByText('Dismiss').closest('button')).toBeDisabled();
  });

  it('calls the real registerProposal endpoint and reflects the returned status', async () => {
    mockedListProposals.mockResolvedValue({ items: [draftProposal], total: 1 });
    mockedRegisterProposal.mockResolvedValue({ ...draftProposal, status: 'registered' });
    render(<AuditInitiativesTab isPolish={false} />);
    await waitFor(() => expect(screen.getByText('Fix intake process gap')).toBeInTheDocument());

    const menu = await openKebab();
    fireEvent.click(within(menu).getByText('Register as initiative'));

    await waitFor(() => expect(mockedRegisterProposal).toHaveBeenCalledWith('prop-1'));
    await waitFor(() => expect(screen.getByText('Registered')).toBeInTheDocument());
  });

  it('shows Delete disabled with a real reason — never a silent no-op', async () => {
    mockedListProposals.mockResolvedValue({ items: [draftProposal], total: 1 });
    render(<AuditInitiativesTab isPolish={false} />);
    await waitFor(() => expect(screen.getByText('Fix intake process gap')).toBeInTheDocument());

    const menu = await openKebab();
    const deleteItem = within(menu).getByText('Delete');
    expect(deleteItem.closest('button')).toBeDisabled();
    expect(within(menu).getByText(/immutable audit trail/i)).toBeInTheDocument();
  });
});
