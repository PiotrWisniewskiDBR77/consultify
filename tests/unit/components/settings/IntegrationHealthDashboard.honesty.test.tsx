import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IntegrationHealthDashboard } from '@/components/settings/integrations/IntegrationHealthDashboard';
import { Api } from '@/services/api';
import { V8SyncApi } from '@/services/api/v8/sync';

const tMock = (_key: string, fallback?: string | { defaultValue?: string }) =>
  typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key);

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('@/services/api/v8/sync', () => ({
  shouldFallbackToLegacySync: vi.fn(() => true),
  V8SyncApi: {
    getHubHealth: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tMock,
  }),
}));

describe('IntegrationHealthDashboard honest UI', () => {
  const user = { id: 'user-1', email: 'user@example.com' };
  const healthyIntegration = {
    integrationId: 'slack',
    connectorId: 'Slack',
    icon: 'S',
    status: 'healthy',
    enabled: true,
    lastRunAt: '2026-04-26T10:00:00.000Z',
    unresolvedErrorCount: 0,
    requestsToday: 3,
    requestsThisMonth: 30,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(V8SyncApi.getHubHealth).mockRejectedValue(new Error('Use legacy'));
  });

  it('does not render failed health loads as zero connected integrations', async () => {
    vi.mocked(Api.get).mockRejectedValue(new Error('Health API down'));

    render(<IntegrationHealthDashboard currentUser={user as any} />);

    await waitFor(() => {
      expect(screen.getByText('Integration health unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Health API down')).toBeInTheDocument();
    expect(screen.queryByText('No integrations connected')).not.toBeInTheDocument();
  });

  it('does not claim toggle success when read-back keeps the old enabled value', async () => {
    vi.mocked(Api.get)
      .mockResolvedValueOnce({ integrations: [healthyIntegration] })
      .mockResolvedValueOnce({ integrations: [healthyIntegration] });
    vi.mocked(Api.put).mockResolvedValue({ success: true });

    render(<IntegrationHealthDashboard currentUser={user as any} />);

    await screen.findByText('Slack');

    fireEvent.click(screen.getByTitle('Pause'));

    await waitFor(() => {
      expect(screen.getByText('Integration toggle was not confirmed by the server')).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });

  it('does not claim bulk disconnect success when read-back still shows selected integration enabled', async () => {
    vi.mocked(Api.get)
      .mockResolvedValueOnce({ integrations: [healthyIntegration] })
      .mockResolvedValueOnce({ integrations: [healthyIntegration] });
    vi.mocked(Api.post).mockResolvedValue({ success: true });
    vi.stubGlobal('confirm', vi.fn(() => true));

    render(<IntegrationHealthDashboard currentUser={user as any} />);

    await screen.findByText('Slack');

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Disconnect/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Integration disconnect was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByText('Slack')).toBeInTheDocument();
  });
});
