import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
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

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('EnterpriseIntegrationsHub honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('confirm', vi.fn(() => true));

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

    expect(screen.getByText('Webhook mutations unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Webhook/i })).toBeDisabled();
    expect(screen.getAllByTitle(/duplicate superadmin webhook routes/i).length).toBeGreaterThanOrEqual(3);

    fireEvent.click(screen.getByTitle('View deliveries'));

    await waitFor(() => {
      expect(screen.getByText('Webhook deliveries unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('No deliveries yet')).not.toBeInTheDocument();
    expect(Api.createSystemWebhook).not.toHaveBeenCalled();
    expect(Api.testSystemWebhook).not.toHaveBeenCalled();
    expect(Api.deleteSystemWebhook).not.toHaveBeenCalled();
  });

  it('does not claim integration disconnect when read-back stays stale', async () => {
    vi.mocked(Api.getSystemIntegrations).mockResolvedValue({
      integrations: [
        {
          id: 'int-1',
          type: 'slack',
          name: 'Slack',
          enabled: true,
          status: 'connected',
          config: {},
          created_at: '2026-04-26T00:00:00.000Z',
        },
      ],
    });
    vi.mocked(Api.getSystemWebhooks).mockResolvedValue({ webhooks: [] });
    vi.mocked(Api.deleteSystemIntegration).mockResolvedValue({ success: true });

    render(<EnterpriseIntegrationsHub />);

    await screen.findByText('Slack');
    fireEvent.click(screen.getByTitle('Disconnect'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Integration disconnect was not confirmed by the server'
      );
    });

    expect(toast.success).not.toHaveBeenCalledWith('Integration disconnected');
  });

  it('renders malformed integration and webhook fields with safe fallbacks', async () => {
    vi.mocked(Api.getSystemIntegrations).mockResolvedValue({
      integrations: [
        {
          id: 'int-1',
          type: 'slack',
          name: '',
          enabled: true,
          status: 'bad-status',
          last_sync_at: 'not-a-date',
          config: {},
          created_at: 'not-a-date',
        },
      ],
    });
    vi.mocked(Api.getSystemWebhooks).mockResolvedValue({
      webhooks: [
        {
          id: 'webhook-1',
          name: '',
          url: '',
          events: null,
          is_active: true,
          success_count: 'bad-success',
          failure_count: 'bad-failure',
          last_triggered_at: 'not-a-date',
          created_at: 'not-a-date',
        },
      ],
    });

    render(<EnterpriseIntegrationsHub />);

    expect(await screen.findByText('Unknown integration')).toBeInTheDocument();
    expect(screen.getByText('disconnected')).toBeInTheDocument();
    expect(screen.getByText(/Last sync: Unknown date/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Webhooks/i }));

    expect(await screen.findByText('Unnamed webhook')).toBeInTheDocument();
    expect(screen.getByText('Unknown URL')).toBeInTheDocument();
    expect(screen.getByText('✓ 0')).toBeInTheDocument();
    expect(screen.getByText('✗ 0')).toBeInTheDocument();
    expect(screen.queryByText(/bad-|Invalid Date/i)).not.toBeInTheDocument();
  });
});
