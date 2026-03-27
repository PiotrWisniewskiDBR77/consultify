/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationChannelsSettings } from '../../../src/components/settings/notifications/NotificationChannelsSettings';
import { IntegrationsMarketplace } from '../../../src/components/settings/integrations/IntegrationsMarketplace';

const { apiMock, toastSuccess, toastError } = vi.hoisted(() => ({
  apiMock: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('../../../src/services/api', () => ({
  Api: apiMock,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    success: (...args: any[]) => toastSuccess(...args),
    error: (...args: any[]) => toastError(...args),
  },
}));

vi.mock('../../../src/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

describe('legacy alias connect continuity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.get.mockImplementation((url: string) => {
      if (url === '/api/user/integrations') {
        return Promise.resolve({ success: true, data: [] });
      }
      if (url === '/api/user/notification-channels') {
        return Promise.resolve({ success: true, data: null });
      }
      return Promise.resolve([]);
    });
    apiMock.post.mockResolvedValue({
      success: true,
      onboardingStatus: 'pending_external_auth_or_configuration',
      authUrl: null,
    });
    apiMock.put.mockResolvedValue({ success: true });
  });

  it('keeps marketplace card disconnected when alias connect only starts pending setup', async () => {
    render(
      <IntegrationsMarketplace
        currentUser={{ id: 'user-1', organizationId: 'org-1' } as any}
        onUpdateUser={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Connect' }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Connect' })[0]!);

    await waitFor(() => {
      expect(apiMock.post).toHaveBeenCalledWith('/api/integrations/github/connect', {});
    });

    expect(toastSuccess).toHaveBeenCalledWith(
      'Setup started. Complete the required configuration fields to continue.'
    );
    expect(screen.queryByTitle('Disconnect')).not.toBeInTheDocument();
  });

  it('keeps notification channel disconnected when alias connect only starts pending setup', async () => {
    render(
      <NotificationChannelsSettings
        currentUser={{ id: 'user-1', organizationId: 'org-1' } as any}
        onUpdateUser={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Connect Slack' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Connect Slack' }));

    await waitFor(() => {
      expect(apiMock.post).toHaveBeenCalledWith('/api/integrations/slack/connect', {});
    });

    expect(toastSuccess).toHaveBeenCalledWith(
      'Setup started. Complete the required configuration fields to continue.'
    );
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
  });
});
