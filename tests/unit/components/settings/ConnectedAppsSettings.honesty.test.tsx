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
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => ({
    t: (_key: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
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
        // mount useEffect: GET /api/settings/integrations/oauth/status
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
        // handleDisconnect: POST /api/settings/integrations/slack/oauth-disconnect
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
        // fetchIntegrationSnapshot: GET /api/settings/integrations (read-back still active)
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

  it('fails closed while provider availability is unknown or unavailable', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('status unavailable'));
    vi.stubGlobal('fetch', fetchMock);

    render(<ConnectedAppsSettings />);

    expect(screen.getByLabelText('Gmail unavailable')).toBeInTheDocument();
    await screen.findByRole('alert');
    expect(
      screen.getByText(/OAuth connections remain disabled/i)
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps a provider missing from an otherwise valid registry disabled', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ availability: {} }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ConnectedAppsSettings />);

    await waitFor(() => expect(screen.getByLabelText('Gmail unavailable')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps explicit configured=false disabled without blocking basic credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        availability: { gmail: { configured: false, authType: 'oauth2' } },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ConnectedAppsSettings />);

    await waitFor(() => expect(screen.getByLabelText('Gmail unavailable')).toBeInTheDocument());
    const appleCalendar = screen.getByText('Apple Calendar (iCal)').closest('.group');
    expect(appleCalendar?.querySelector('button')).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('enables OAuth only after explicit configured=true and starts one request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          availability: { gmail: { configured: true, authType: 'oauth2' } },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authUrl: 'https://accounts.example.test/oauth' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    render(<ConnectedAppsSettings />);

    await waitFor(() => expect(screen.queryByLabelText('Gmail unavailable')).toBeNull());
    const gmail = screen.getByText('Gmail').closest('.group');
    expect(gmail).not.toBeNull();
    fireEvent.click(gmail!.querySelector('button')!);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/settings/integrations/oauth/start/gmail',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('retries availability deterministically without enabling providers on another failure', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('status unavailable'));
    vi.stubGlobal('fetch', fetchMock);

    render(<ConnectedAppsSettings />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText('Gmail unavailable')).toBeInTheDocument();
  });
});
