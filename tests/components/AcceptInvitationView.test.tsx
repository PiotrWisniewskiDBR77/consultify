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

  it('does not leak backend details on validation failure and exposes alert role', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: { message: 'postgres://rw:secret@host/db', code: 'INVITATION_TOKEN_INVALID' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <AcceptInvitationView token="abc-token" />
      </MemoryRouter>
    );

    expect(await screen.findByText('Invalid Invitation')).toBeInTheDocument();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('We could not validate this invitation');
    expect(alert).not.toHaveTextContent('postgres://rw:secret@host/db');
  });

  it('does not leak backend details on accept failure and exposes form alert role', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          valid: true,
          invitationType: 'ORG',
          organizationName: 'Org One',
          email: 'user@example.com',
          roleToAssign: 'USER',
          expiresAt: '2026-06-01T00:00:00.000Z',
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: 'internal stack trace', code: 'INVITATION_ACCEPTANCE_FAILED' },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <AcceptInvitationView token="abc-token" />
      </MemoryRouter>
    );

    await screen.findByText('Join Org One');
    await user.type(screen.getByLabelText('First Name *'), 'Jane');
    await user.type(screen.getByLabelText('Last Name *'), 'Doe');
    await user.type(screen.getByLabelText('Job Title *'), 'Manager');
    await user.type(screen.getByLabelText('Department *'), 'Ops');
    await user.type(screen.getByLabelText('Password *'), 'secret123');
    await user.type(screen.getByLabelText('Confirm Password *'), 'secret123');
    await user.click(screen.getByLabelText(/I agree to the/i));
    await user.click(screen.getByRole('button', { name: 'Accept & Join' }));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('We could not complete invitation acceptance');
      expect(alert).not.toHaveTextContent('internal stack trace');
    });
  });
});
