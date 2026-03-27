/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IntegrationSettings } from '../../../src/components/settings/IntegrationSettings';

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getIntegrations: vi.fn(),
    getIntegrationProviders: vi.fn(),
    getProjects: vi.fn(),
    getMcpProviders: vi.fn(),
    get: vi.fn(),
  },
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
    success: vi.fn(),
    error: vi.fn(),
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
});
