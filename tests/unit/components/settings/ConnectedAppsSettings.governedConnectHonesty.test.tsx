import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConnectedAppsSettings } from '@/components/settings/ConnectedAppsSettings';

vi.mock('@/hooks/useUserIntegrations', () => ({
  useUserIntegrations: () => ({
    integrations: [],
    providers: [],
    connectedCount: 0,
    loading: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    testConnection: vi.fn(),
    refreshToken: vi.fn(),
    updateConfig: vi.fn(),
    getConnectionStatus: vi.fn(),
    getSyncLogs: vi.fn(),
    refresh: vi.fn(),
    isConnected: vi.fn(() => false),
    getIntegration: vi.fn(),
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => ({
    i18n: { language: 'pl' },
    t: (_key: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
  }),
}));

vi.mock('@/components/settings/integrations/MappingDriftPanel', () => ({
  default: () => null,
}));

vi.mock('@/services/api', () => ({
  getHeaders: () => ({ 'Content-Type': 'application/json' }),
}));

describe('ConnectedAppsSettings governed connect honesty', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the server rejection and does not start OAuth for Teams', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ availability: { teams: { configured: true, authType: 'oauth2' } } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 501,
        json: async () => ({
          error: 'Integracja nie jest dostępna w tej wersji',
          code: 'GOVERNED_CONNECTOR_NOT_APPROVED',
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    render(<ConnectedAppsSettings />);

    await waitFor(() => expect(screen.queryByLabelText('Microsoft Teams unavailable')).toBeNull());
    const teamsCard = screen.getByText('Microsoft Teams').closest('.group');
    fireEvent.click(teamsCard!.querySelector('button')!);
    fireEvent.change(screen.getByPlaceholderText('Enter tenant id'), {
      target: { value: 'tenant-day377' },
    });
    const connectButtons = screen.getAllByRole('button', { name: 'Connect' });
    fireEvent.click(connectButtons[connectButtons.length - 1]);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Integracja nie jest dostępna w tej wersji')
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/settings/integrations/teams/connect',
      expect.objectContaining({ method: 'POST' })
    );
    expect(screen.getByPlaceholderText('Enter tenant id')).toBeInTheDocument();
  });
});
