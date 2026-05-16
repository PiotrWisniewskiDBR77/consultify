/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useAppStoreMock = vi.fn();
const fetchMock = vi.fn();

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: () => useAppStoreMock(),
}));

import InviteUserModal from '../../src/components/InviteUserModal';

describe('InviteUserModal invite submit error contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStoreMock.mockReturnValue({
      currentUser: { role: 'SUPER_ADMIN' },
    });
    localStorage.setItem('token', 'token-1');
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/projects')) {
        return { ok: true, json: async () => [] } as any;
      }
      if (url.endsWith('/api/billing/seats')) {
        return {
          ok: true,
          json: async () => ({
            maxSeats: 5,
            seatsUsed: 1,
            seatsRemaining: 4,
            canAddSeats: true,
            seatPrice: 49,
            currency: 'USD',
            isPaidOrg: false,
          }),
        } as any;
      }
      return { ok: true, json: async () => ({ success: true }) } as any;
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  it('renders non-leaking accessible alert when add-seat fails', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/projects')) {
        return { ok: true, json: async () => [] } as any;
      }
      if (url.endsWith('/api/billing/seats')) {
        return {
          ok: true,
          json: async () => ({
            maxSeats: 1,
            seatsUsed: 1,
            seatsRemaining: 0,
            canAddSeats: true,
            seatPrice: 49,
            currency: 'USD',
            isPaidOrg: false,
          }),
        } as any;
      }
      if (url.endsWith('/api/billing/seats/add')) {
        return {
          ok: false,
          json: async () => ({
            error: {
              code: 'SEAT_ADD_FAILED',
              message: 'SQLSTATE[HY000] /var/app/secrets should never leak',
            },
          }),
        } as any;
      }
      return { ok: true, json: async () => ({ success: true }) } as any;
    });

    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<InviteUserModal onClose={vi.fn()} onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText('Email Address *'), 'teammate@example.com');
    await user.click(screen.getByRole('button', { name: /Add Seat & Invite|Send Invitation/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Could not add a seat. Try again or contact support.');
    expect(alert.textContent).not.toContain('SQLSTATE');
    expect(alert.textContent).not.toContain('/var/');
    expect(screen.getByTestId('invite-user-error-code')).toHaveTextContent('Code: SEAT_ADD_FAILED');
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('renders non-leaking accessible alert when invite send fails', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/projects')) {
        return { ok: true, json: async () => [] } as any;
      }
      if (url.endsWith('/api/billing/seats')) {
        return {
          ok: true,
          json: async () => ({
            maxSeats: 5,
            seatsUsed: 1,
            seatsRemaining: 4,
            canAddSeats: true,
            seatPrice: 49,
            currency: 'USD',
            isPaidOrg: false,
          }),
        } as any;
      }
      if (url.endsWith('/api/invitations/org')) {
        return {
          ok: false,
          json: async () => ({
            error: {
              code: 'INVITE_SEND_FAILED',
              message: 'internal: /var/tmp token leak should never render',
            },
          }),
        } as any;
      }
      return { ok: true, json: async () => ({ success: true }) } as any;
    });

    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<InviteUserModal onClose={vi.fn()} onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText('Email Address *'), 'teammate@example.com');
    await user.click(screen.getByRole('button', { name: /Send Invitation/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Could not send invitation. Try again or contact support.');
    expect(alert.textContent).not.toContain('internal:');
    expect(alert.textContent).not.toContain('/var/');
    expect(screen.getByTestId('invite-user-error-code')).toHaveTextContent(
      'Code: INVITE_SEND_FAILED'
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('does not render failure alert on successful invite', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/projects')) {
        return { ok: true, json: async () => [] } as any;
      }
      if (url.endsWith('/api/billing/seats')) {
        return {
          ok: true,
          json: async () => ({
            maxSeats: 5,
            seatsUsed: 1,
            seatsRemaining: 4,
            canAddSeats: true,
            seatPrice: 49,
            currency: 'USD',
            isPaidOrg: false,
          }),
        } as any;
      }
      if (url.endsWith('/api/invitations/org')) {
        return { ok: true, json: async () => ({ success: true }) } as any;
      }
      return { ok: true, json: async () => ({ success: true }) } as any;
    });

    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<InviteUserModal onClose={vi.fn()} onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText('Email Address *'), 'teammate@example.com');
    await user.click(screen.getByRole('button', { name: /Send Invitation/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
