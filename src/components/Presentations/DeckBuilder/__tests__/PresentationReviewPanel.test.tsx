import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PresentationReviewPanel } from '../PresentationReviewPanel';
import { PresentationApprovalsApi } from '../../../../services/api/presentationApprovals.api';
import { OrganizationApi } from '../../../../services/api/organizations.api';

vi.mock('../../../../services/api/presentationApprovals.api', () => ({
  PresentationApprovalsApi: {
    getState: vi.fn(),
    submit: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
  },
}));

vi.mock('../../../../services/api/organizations.api', () => ({
  OrganizationApi: { getOrganizationMembers: vi.fn() },
}));

const approvals = vi.mocked(PresentationApprovalsApi);
const organizations = vi.mocked(OrganizationApi);

describe('PresentationReviewPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    approvals.getState.mockResolvedValue({
      state: 'draft', assignment: null, versionId: 'deck-1@7', currentForVersion: true,
    });
    organizations.getOrganizationMembers.mockResolvedValue([
      { userId: 'author', name: 'Autor', email: 'author@example.com', status: 'active' },
      { userId: 'reviewer', name: 'Recenzent', email: 'reviewer@example.com', status: 'active' },
    ] as never);
    approvals.submit.mockResolvedValue({} as never);
    approvals.approve.mockResolvedValue({} as never);
    approvals.reject.mockResolvedValue({} as never);
  });

  it('excludes the author and submits the current presentation version for review', async () => {
    render(<PresentationReviewPanel deckId="deck-1" version={7} organizationId="org-1" currentUserId="author" qualityPanel={<div>Quality</div>} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Zatwierdzenie' }));
    await screen.findByRole('option', { name: 'Recenzent' });
    expect(screen.queryByRole('option', { name: 'Autor' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Recenzent'), { target: { value: 'reviewer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij do zatwierdzenia' }));

    await waitFor(() => expect(approvals.submit).toHaveBeenCalledWith('deck-1', 'reviewer'));
  });

  it('lets only the assigned reviewer approve or request changes with a reason', async () => {
    approvals.getState.mockResolvedValue({
      state: 'review',
      assignment: { id: 'a-1', assigned_to_user_id: 'reviewer', status: 'pending' },
      versionId: 'deck-1@7',
      currentForVersion: true,
    });

    render(<PresentationReviewPanel deckId="deck-1" version={7} organizationId="org-1" currentUserId="reviewer" qualityPanel={<div>Quality</div>} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Zatwierdzenie' }));

    const requestChanges = await screen.findByRole('button', { name: 'Poproś o zmiany' });
    expect(requestChanges).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('Uzasadnienie wymaganych zmian'), { target: { value: 'Uzupełnij źródło.' } });
    fireEvent.click(requestChanges);

    await waitFor(() => expect(approvals.reject).toHaveBeenCalledWith('deck-1', 'Uzupełnij źródło.'));
  });
});
