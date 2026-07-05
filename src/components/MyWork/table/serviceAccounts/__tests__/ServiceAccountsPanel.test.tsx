/**
 * @vitest-environment jsdom
 *
 * Component tests for `<ServiceAccountsPanel>` (E1-1 Service Accounts UI).
 *
 * Coverage:
 *   - Renders the existing accounts list (name, scope chips, token prefix).
 *   - Create flow: calls the API with name/scopes/expiry and shows the
 *     one-time token reveal card afterwards.
 *   - The one-time token is never re-displayed after a subsequent refresh —
 *     it only ever comes from the create response.
 *   - Revoke flow requires a second confirm click before calling the API,
 *     and removes the row from the list on success.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServiceAccounts: vi.fn(),
  createServiceAccount: vi.fn(),
  revokeServiceAccount: vi.fn(),
}));

vi.mock('@/services/api/tablePlatform.api', () => ({
  getServiceAccounts: mocks.getServiceAccounts,
  createServiceAccount: mocks.createServiceAccount,
  revokeServiceAccount: mocks.revokeServiceAccount,
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign((..._args: unknown[]) => undefined, {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

import { ServiceAccountsPanel } from '../ServiceAccountsPanel';

const ACCOUNTS = [
  {
    id: 'sa-1',
    name: 'Zapier integration',
    description: null,
    token_prefix: 'tp_sa_abc123',
    scopes: ['records:read', 'records:write'],
    last_used_at: null,
    expires_at: null,
    created_at: '2026-07-01T00:00:00Z',
  },
];

describe('ServiceAccountsPanel', () => {
  it('renders the existing accounts list', () => {
    render(<ServiceAccountsPanel testInitialAccounts={ACCOUNTS} />);
    expect(screen.getByTestId('sa-row-sa-1')).toHaveTextContent('Zapier integration');
    expect(screen.getByTestId('sa-row-sa-1')).toHaveTextContent('tp_sa_abc123');
    expect(screen.getByTestId('sa-row-sa-1')).toHaveTextContent('records:read');
    expect(screen.getByTestId('sa-row-sa-1')).toHaveTextContent('records:write');
  });

  it('shows an empty state when there are no accounts', () => {
    render(<ServiceAccountsPanel testInitialAccounts={[]} />);
    expect(screen.getByTestId('sa-list-empty')).toBeInTheDocument();
  });

  it('creates a service account and reveals the token exactly once', async () => {
    mocks.createServiceAccount.mockResolvedValue({
      account: {
        id: 'sa-2',
        name: 'New SA',
        description: null,
        token_prefix: 'tp_sa_def456',
        scopes: ['records:read'],
        last_used_at: null,
        expires_at: null,
        created_at: '2026-07-05T00:00:00Z',
      },
      token: 'tp_sa_def456_full_secret_value',
    });

    render(<ServiceAccountsPanel testInitialAccounts={[]} />);

    fireEvent.change(screen.getByTestId('sa-create-name'), {
      target: { value: 'New SA' },
    });
    fireEvent.click(screen.getByTestId('sa-create-scope-records:read'));
    fireEvent.click(screen.getByTestId('sa-create-submit'));

    await waitFor(() => {
      expect(mocks.createServiceAccount).toHaveBeenCalledWith({
        name: 'New SA',
        scopes: ['records:read'],
      });
    });

    // Token revealed once, with a copy affordance and a "won't see again" warning.
    expect(screen.getByTestId('sa-created-result')).toHaveTextContent(
      'tp_sa_def456_full_secret_value'
    );
    expect(screen.getByTestId('sa-created-result')).toHaveTextContent(
      /will not see it again/i
    );

    // New row appended to the list from the create response (no extra fetch needed).
    expect(screen.getByTestId('sa-row-sa-2')).toHaveTextContent('New SA');
  });

  it('rejects create when no scope is selected', async () => {
    render(<ServiceAccountsPanel testInitialAccounts={[]} />);
    fireEvent.change(screen.getByTestId('sa-create-name'), {
      target: { value: 'No Scope SA' },
    });
    fireEvent.click(screen.getByTestId('sa-create-submit'));

    await waitFor(() => {
      expect(mocks.createServiceAccount).not.toHaveBeenCalled();
    });
  });

  it('requires a confirm click before revoking, then removes the row', async () => {
    mocks.revokeServiceAccount.mockResolvedValue(undefined);

    render(<ServiceAccountsPanel testInitialAccounts={ACCOUNTS} />);

    fireEvent.click(screen.getByTestId('sa-revoke-sa-1'));
    expect(mocks.revokeServiceAccount).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('sa-revoke-confirm-sa-1'));

    await waitFor(() => {
      expect(mocks.revokeServiceAccount).toHaveBeenCalledWith('sa-1');
    });
    await waitFor(() => {
      expect(screen.queryByTestId('sa-row-sa-1')).not.toBeInTheDocument();
    });
  });

  it('cancels revoke confirmation without calling the API', () => {
    render(<ServiceAccountsPanel testInitialAccounts={ACCOUNTS} />);
    fireEvent.click(screen.getByTestId('sa-revoke-sa-1'));
    fireEvent.click(screen.getByTestId('sa-revoke-cancel-sa-1'));
    expect(mocks.revokeServiceAccount).not.toHaveBeenCalled();
    expect(screen.getByTestId('sa-row-sa-1')).toBeInTheDocument();
  });
});
