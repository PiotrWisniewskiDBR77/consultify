/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import AcceptInvitationView from '../../src/views/AcceptInvitationView';

vi.mock('../../src/services/api', () => ({
  API_URL: 'https://api.test/api',
}));

const state = {
  currentUser: null as
    | null
    | {
        id: string;
        email: string;
        isAuthenticated: boolean;
      },
  logout: vi.fn(),
};

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: (selector: any) => selector(state),
}));

describe('AcceptInvitationView', () => {
  beforeEach(() => {
    state.currentUser = null;
    state.logout.mockReset();
  });

  it('uses shared API_URL base for invitation validation request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        valid: true,
        invitationType: 'ORG',
        organizationName: 'Org One',
        email: 'user@example.com',
        roleToAssign: 'USER',
        expiresAt: '2026-06-01T00:00:00.000Z',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <AcceptInvitationView token="abc-token" />
      </MemoryRouter>
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith('https://api.test/api/invitations/validate/abc-token');
  });

  it('shows mismatch warning and logout action for authenticated different email', async () => {
    const user = userEvent.setup();
    state.currentUser = {
      id: 'u-1',
      email: 'other@example.com',
      isAuthenticated: true,
    };
    state.logout.mockReset();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        valid: true,
        invitationType: 'ORG',
        organizationName: 'Org One',
        email: 'invited@example.com',
        roleToAssign: 'USER',
        expiresAt: '2026-06-01T00:00:00.000Z',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <AcceptInvitationView token="abc-token" />
      </MemoryRouter>
    );

    expect(
      await screen.findByText('Signed in with a different account')
    ).toBeInTheDocument();
    expect(screen.getByText(/This invitation is for/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept & Join' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Sign out and continue' }));
    expect(state.logout).toHaveBeenCalledTimes(1);
  });

  it('fails closed for blank invitation token without calling validate API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <AcceptInvitationView token="   " />
      </MemoryRouter>
    );

    expect(await screen.findByText('Invalid Invitation')).toBeInTheDocument();
    expect(screen.getByText('Invalid invitation link')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
