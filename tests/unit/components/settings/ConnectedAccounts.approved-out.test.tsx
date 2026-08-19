/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiGet, apiDelete } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock('../../../../src/services/api', () => ({
  Api: { get: apiGet, delete: apiDelete },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : _key),
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { ConnectedAccounts } from '../../../../src/components/settings/ConnectedAccounts';

describe('ConnectedAccounts approved-out OAuth boundary', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiDelete.mockReset();
    window.history.replaceState({}, '', '/settings/profile');
  });

  it('does not offer a new provider connection when no legacy account exists', async () => {
    apiGet.mockResolvedValue({ accounts: [] });

    render(<ConnectedAccounts currentUser={{ id: 'user-1' } as any} onUpdateUser={vi.fn()} />);

    expect(await screen.findByText('No external accounts are connected.')).toBeInTheDocument();
    expect(screen.queryByText('Google')).not.toBeInTheDocument();
    expect(screen.queryByText('LinkedIn')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument();
  });

  it('keeps a legacy connection visible and permits revocation without exposing connect', async () => {
    apiGet
      .mockResolvedValueOnce({
        accounts: [
          {
            provider: 'google',
            email: 'owner@example.test',
            displayName: null,
            connectedAt: '2026-08-19T00:00:00.000Z',
            status: 'ACTIVE',
          },
        ],
      })
      .mockResolvedValueOnce({ accounts: [] });
    apiDelete.mockResolvedValue({ success: true });

    render(<ConnectedAccounts currentUser={{ id: 'user-1' } as any} onUpdateUser={vi.fn()} />);

    expect(await screen.findByText('owner@example.test')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

    await waitFor(() =>
      expect(apiDelete).toHaveBeenCalledWith('/settings/connected-accounts/google')
    );
    expect(await screen.findByText('No external accounts are connected.')).toBeInTheDocument();
  });
});
