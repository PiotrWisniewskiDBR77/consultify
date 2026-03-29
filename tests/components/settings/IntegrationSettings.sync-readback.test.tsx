/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IntegrationSettings } from '../../../src/components/settings/IntegrationSettings';

const { apiMock, toastSuccess, toastError, navigateMock } = vi.hoisted(() => ({
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
  navigateMock: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
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
    navigateMock.mockReset();
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
        required_fields: ['site_url', 'cloud_id', 'client_id', 'client_secret'],
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
      authUrl: 'https://auth.atlassian.com/authorize?state=state-1',
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
      expect(screen.getAllByText('Pending setup').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('One canonical provider connect journey')).toBeInTheDocument();
    expect(screen.getByText('Canonical setup path')).toBeInTheDocument();
    expect(screen.getByText(/Missing setup fields/i)).toHaveTextContent('cloud_id');
    expect(screen.getByText(/Missing setup fields/i)).toHaveTextContent('client_id');
    expect(screen.getByText(/Missing setup fields/i)).toHaveTextContent('client_secret');
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
        value: JSON.stringify({
          site_url: 'https://acme.atlassian.net',
          cloud_id: 'cloud-1',
          client_id: 'jira-client-id',
          client_secret: 'jira-client-secret',
        }),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save integration/i }));

    await waitFor(() => {
      expect(apiMock.connectIntegration).toHaveBeenCalledWith('jira', {
        site_url: 'https://acme.atlassian.net',
        cloud_id: 'cloud-1',
        client_id: 'jira-client-id',
        client_secret: 'jira-client-secret',
      });
    });

    expect(window.open).toHaveBeenCalledWith(
      'https://auth.atlassian.com/authorize?state=state-1',
      '_blank',
      'width=600,height=700'
    );
    expect(toastSuccess).toHaveBeenCalledWith(
      'Authorization started. Finish the external auth step to complete setup.'
    );
  });

  it('shows governed reauth state with a clear recovery step', async () => {
    apiMock.getIntegrations.mockResolvedValue([
      {
        id: 'int-2',
        provider: 'jira',
        name: 'Jira',
        status: 'requires_reauth',
        config: { site_url: 'https://acme.atlassian.net' },
        sync_scope: 'bidirectional',
        configured_fields: ['site_url', 'cloud_id', 'client_id', 'client_secret'],
        required_fields: ['site_url', 'cloud_id', 'client_id', 'client_secret'],
        created_at: '2026-03-27T20:00:00.000Z',
        last_synced_at: '2026-03-28T08:00:00.000Z',
        last_error: 'OAuth refresh token expired',
      },
    ]);

    render(
      <IntegrationSettings
        currentUser={{ id: 'user-1', organizationId: 'org-1', role: 'ADMIN' } as any}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText('Reauth Required').length).toBeGreaterThan(0);
    });

    expect(
      screen.getByText('Governed sync marked this connection as requiring re-authorization before sync can resume.')
    ).toBeInTheDocument();
    expect(screen.getByText(/Next step:/)).toHaveTextContent('Re-authorize this provider in Sync Hub.');
    expect(screen.getByRole('button', { name: /View governed status/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Open governed Sync Hub/i }));
    expect(navigateMock).toHaveBeenCalledWith('/admin/integrations');
  });

  it('shows validation pending instead of generic pending when configuration awaits governed verification', async () => {
    apiMock.getIntegrations.mockResolvedValue([
      {
        id: 'int-3',
        provider: 'jira',
        name: 'Jira',
        status: 'pending',
        config: {
          site_url: 'https://acme.atlassian.net',
          cloud_id: 'cloud-1',
          client_id: 'jira-client-id',
          client_secret: 'jira-client-secret',
        },
        onboarding_status: 'configuration_submitted_pending_validation',
        configured_fields: ['site_url', 'cloud_id', 'client_id', 'client_secret'],
        required_fields: ['site_url', 'cloud_id', 'client_id', 'client_secret'],
        created_at: '2026-03-27T20:00:00.000Z',
        last_synced_at: null,
        last_error: null,
      },
    ]);

    render(
      <IntegrationSettings
        currentUser={{ id: 'user-1', organizationId: 'org-1', role: 'ADMIN' } as any}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText('Validation pending').length).toBeGreaterThan(0);
    });

    expect(
      screen.getByText('Configuration was submitted, but governed validation has not finished yet.')
    ).toBeInTheDocument();
    expect(screen.getByText(/Next step:/)).toHaveTextContent(
      'Wait for governed validation before sync controls become available.'
    );
    expect(screen.getByRole('button', { name: /View governed status/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Open governed Sync Hub/i }));
    expect(navigateMock).toHaveBeenCalledWith('/admin/integrations');
  });
});
