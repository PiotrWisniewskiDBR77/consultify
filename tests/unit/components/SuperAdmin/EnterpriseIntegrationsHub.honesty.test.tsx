import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EnterpriseIntegrationsHub } from '@/components/SuperAdmin/system/EnterpriseIntegrationsHub';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    getSystemIntegrations: vi.fn(),
    getSystemWebhooks: vi.fn(),
    getSystemWebhookDeliveries: vi.fn(),
    refreshSystemIntegration: vi.fn(),
    deleteSystemIntegration: vi.fn(),
    deleteSystemWebhook: vi.fn(),
    testSystemWebhook: vi.fn(),
    createSystemWebhook: vi.fn(),
  },
}));

describe('EnterpriseIntegrationsHub honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.mocked(Api.get).mockResolvedValue({ connectors: [] });
    vi.mocked(Api.getSystemIntegrations).mockRejectedValue(
      new Error('Integrations backend down')
    );
    vi.mocked(Api.getSystemWebhooks).mockRejectedValue(new Error('Webhooks backend down'));
    vi.mocked(Api.getSystemWebhookDeliveries).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render integration and webhook load failures as clean empty states', async () => {
    render(<EnterpriseIntegrationsHub />);

    await waitFor(() => {
      expect(screen.getByText('Integration overview unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Connected integrations unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No integrations connected')).not.toBeInTheDocument();
    expect(screen.queryByText('Active Webhooks')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Webhooks/i }));

    await waitFor(() => {
      expect(screen.getByText('Webhooks unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('No webhooks configured')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Webhook/i })).toBeDisabled();
  });

  it('does not render failed webhook delivery loads as no deliveries yet', async () => {
    vi.mocked(Api.getSystemIntegrations).mockResolvedValue({ integrations: [] });
    vi.mocked(Api.getSystemWebhooks).mockResolvedValue({
      webhooks: [
        {
          id: 'webhook-1',
          name: 'CRM webhook',
          url: 'https://example.com/hook',
          events: ['project.created'],
          is_active: true,
          success_count: 1,
          failure_count: 0,
          created_at: new Date().toISOString(),
        },
      ],
    });
    vi.mocked(Api.getSystemWebhookDeliveries).mockRejectedValue(
      new Error('Deliveries backend down')
    );

    render(<EnterpriseIntegrationsHub />);

    fireEvent.click(screen.getByRole('button', { name: /Webhooks/i }));

    await waitFor(() => {
      expect(screen.getByText('CRM webhook')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('View deliveries'));

    await waitFor(() => {
      expect(screen.getByText('Webhook deliveries unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('No deliveries yet')).not.toBeInTheDocument();
  });
});
