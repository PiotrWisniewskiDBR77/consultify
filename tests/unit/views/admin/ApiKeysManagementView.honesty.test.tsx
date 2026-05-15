import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { ApiKeysManagementView } from '@/views/admin/ApiKeysManagementView';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentOrganization: { id: 'org-1' },
    currentUser: { id: 'user-1' },
  }),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('ApiKeysManagementView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.get).mockRejectedValue(new Error('API key service down'));
  });

  it('does not render failed API key loads as an empty key list with create actions', async () => {
    render(<ApiKeysManagementView />);

    await waitFor(() => {
      expect(screen.getByText('API keys unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('API key list unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No API Keys')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create API Key/i })).toBeDisabled();
  });

  it('refreshes API key data after create, remount, and revoke workflows', async () => {
    const persistedKey = {
      id: 'key-1',
      name: 'Prod Integration',
      description: 'Created from admin UI',
      keyPrefix: 'ck_live_123',
      permissions: ['read:projects'],
      createdAt: '2026-04-26T09:00:00.000Z',
    };
    vi.mocked(Api.get)
      .mockResolvedValueOnce({ keys: [] })
      .mockResolvedValueOnce({ keys: [persistedKey] })
      .mockResolvedValueOnce({ keys: [persistedKey] })
      .mockResolvedValueOnce({ keys: [] });
    vi.mocked(Api.post).mockResolvedValue({
      plainTextKey: 'ck_live_123456',
      key: persistedKey,
    });
    vi.mocked(Api.delete).mockResolvedValue({ success: true });
    vi.stubGlobal('confirm', vi.fn(() => true));

    const { unmount } = render(<ApiKeysManagementView />);

    await waitFor(() => {
      expect(screen.getByText('No API Keys')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /Create API Key/i })[0]);
    fireEvent.change(screen.getByPlaceholderText('e.g., Production Integration'), {
      target: { value: 'Prod Integration' },
    });
    fireEvent.change(screen.getByPlaceholderText('What is this key used for?'), {
      target: { value: 'Created from admin UI' },
    });
    fireEvent.click(screen.getByLabelText(/Read projects/i));
    fireEvent.click(screen.getByRole('button', { name: /Create Key/i }));

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith(
        '/api/api-keys',
        expect.objectContaining({
          name: 'Prod Integration',
          permissions: ['read:projects'],
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText('API Key Created')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /I've Copied the Key/i }));

    await waitFor(() => {
      expect(screen.getByText('Prod Integration')).toBeInTheDocument();
    });

    unmount();
    render(<ApiKeysManagementView />);

    await waitFor(() => {
      expect(screen.getByText('Prod Integration')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Revoke key'));

    await waitFor(() => {
      expect(Api.delete).toHaveBeenCalledWith('/api/api-keys/key-1');
    });
    await waitFor(() => {
      expect(screen.queryByText('Prod Integration')).not.toBeInTheDocument();
    });
    expect(screen.getByText('No API Keys')).toBeInTheDocument();
  });
});
