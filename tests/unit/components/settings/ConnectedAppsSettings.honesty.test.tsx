import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConnectedAppsSettings } from '@/components/settings/ConnectedAppsSettings';

const refreshMock = vi.fn();
const disconnectMock = vi.fn();

vi.mock('@/hooks/useUserIntegrations', () => ({
  useUserIntegrations: () => ({
    integrations: [
      {
        id: 'int-1',
        userId: 'user-1',
        provider: 'slack',
        providerName: 'Slack',
        config: {},
        status: 'active',
        capabilities: [],
        createdAt: '2026-04-26T10:00:00.000Z',
        updatedAt: '2026-04-26T10:00:00.000Z',
      },
    ],
    providers: [],
    connectedCount: 1,
    loading: false,
    error: null,
    connect: vi.fn(),
    disconnect: disconnectMock,
    testConnection: vi.fn(),
    refreshToken: vi.fn(),
    updateConfig: vi.fn(),
    getConnectionStatus: vi.fn(),
    getSyncLogs: vi.fn(),
    refresh: refreshMock,
    isConnected: vi.fn(),
    getIntegration: vi.fn(),
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

vi.mock('@/components/settings/integrations/MappingDriftPanel', () => ({
  default: () => null,
}));

describe('ConnectedAppsSettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('does not claim disconnect success when read-back still shows provider connected', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            integrations: [
              {
                id: 'int-1',
                provider: 'slack',
                status: 'active',
              },
            ],
            providers: [],
          }),
        })
    );

    render(<ConnectedAppsSettings />);

    fireEvent.click(screen.getByRole('button', { name: /Disconnect/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Integration disconnect was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
