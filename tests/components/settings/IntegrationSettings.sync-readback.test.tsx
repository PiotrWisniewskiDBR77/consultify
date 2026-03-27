/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IntegrationSettings } from '../../../src/components/settings/IntegrationSettings';

const { apiMock, toastSuccess, toastError } = vi.hoisted(() => ({
  apiMock: {
    getIntegrations: vi.fn(),
    getIntegrationProviders: vi.fn(),
    getProjects: vi.fn(),
    getMcpProviders: vi.fn(),
    get: vi.fn(),
    connectIntegration: vi.fn(),
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

describe('IntegrationSettings governed sync readback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getIntegrations.mockResolvedValue([
      {
        id: 'int-1',
        provider: 'jira',
        name: 'Jira',
        status: 'pending',
        config: { site_url: 'https://acme.atlassian.net' },
        sync_scope: 'bidirectional',
        sync_scope_label: 'Bidirectional sync',
        onboarding_status: 'pending_external_auth_or_configuration',
        configured_fields: ['site_url'],
        required_fields: ['site_url', 'cloud_id'],
        created_at: '2026-03-27T20:00:00.000Z',
        last_synced_at: null,
        last_error: null,
      },
    ]);
    apiMock.getIntegrationProviders.mockResolvedValue({
      providers: [
        {
          id: 'jira',
          name: 'jira',
          displayName: 'Jira',
          category: 'project',
          isActive: true,
          isBeta: false,
          isEnterpriseOnly: false,
        },
      ],
    });
    apiMock.getProjects.mockResolvedValue([]);
    apiMock.getMcpProviders.mockResolvedValue([]);
    apiMock.get.mockResolvedValue([]);
    apiMock.connectIntegration.mockResolvedValue({
      success: true,
      onboardingStatus: 'pending_external_auth',
      authUrl: 'https://example.test/oauth/start',
    });
    vi.stubGlobal('open', vi.fn());
  });

  it('shows governed pending setup truth instead of connected sync controls', async () => {
    render(
      <IntegrationSettings
        currentUser={{ id: 'user-1', organizationId: 'org-1', role: 'ADMIN' } as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Pending setup')).toBeInTheDocument();
    });

    expect(screen.getByText(/Missing setup fields/i)).toHaveTextContent('cloud_id');
    expect(screen.getByRole('button', { name: /Complete setup/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sync now/i })).not.toBeInTheDocument();
  });

  it('starts authorization from canonical connect flow instead of claiming immediate connection', async () => {
    apiMock.getIntegrations.mockResolvedValue([]);

    render(
      <IntegrationSettings
        currentUser={{ id: 'user-1', organizationId: 'org-1', role: 'ADMIN' } as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Save integration/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: JSON.stringify({ site_url: 'https://acme.atlassian.net', cloud_id: 'cloud-1' }),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save integration/i }));

    await waitFor(() => {
      expect(apiMock.connectIntegration).toHaveBeenCalledWith('jira', {
        site_url: 'https://acme.atlassian.net',
        cloud_id: 'cloud-1',
      });
    });

    expect(window.open).toHaveBeenCalledWith(
      'https://example.test/oauth/start',
      '_blank',
      'width=600,height=700'
    );
    expect(toastSuccess).toHaveBeenCalledWith(
      'Authorization started. Finish the external auth step to complete setup.'
    );
  });
});
