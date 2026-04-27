import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EnterpriseConfigurationPanel } from '@/components/SuperAdmin/system/EnterpriseConfigurationPanel';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    getSystemConfigs: vi.fn(),
    getSystemConfigVersions: vi.fn(),
    updateSystemConfig: vi.fn(),
    deleteSystemConfig: vi.fn(),
    createSystemConfig: vi.fn(),
    rollbackSystemConfig: vi.fn(),
  },
}));

const config = {
  id: 'cfg-1',
  key: 'feature.enabled',
  value: 'true',
  type: 'string',
  category: 'general',
  description: 'Feature toggle',
  is_sensitive: false,
  updated_at: 'not-a-date',
};

describe('EnterpriseConfigurationPanel honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('confirm', vi.fn(() => true));

    vi.mocked(Api.getSystemConfigs).mockRejectedValue(new Error('Config backend down'));
    vi.mocked(Api.getSystemConfigVersions).mockResolvedValue({ versions: [] });
    vi.mocked(Api.createSystemConfig).mockResolvedValue({ id: 'cfg-1' });
    vi.mocked(Api.updateSystemConfig).mockResolvedValue({ success: true });
    vi.mocked(Api.deleteSystemConfig).mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render config load failures as zero configuration stats or empty categories', async () => {
    render(<EnterpriseConfigurationPanel />);

    await waitFor(() => {
      expect(screen.getByText('Configuration overview unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('System configuration unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Total Configs')).not.toBeInTheDocument();
    expect(screen.queryByText('Sensitive')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Add Config/i })).toBeDisabled();
    expect(screen.getByPlaceholderText('Search configurations...')).toBeDisabled();
  });

  it('does not render failed version history loads as no version history', async () => {
    vi.mocked(Api.getSystemConfigs).mockResolvedValue([config]);
    vi.mocked(Api.getSystemConfigVersions).mockRejectedValue(new Error('History backend down'));

    render(<EnterpriseConfigurationPanel />);

    await waitFor(() => {
      expect(screen.getByText('feature.enabled')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('History'));

    await waitFor(() => {
      expect(screen.getByText('Version history unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByText('No version history available')).not.toBeInTheDocument();
  });

  it('keeps add modal open when configuration creation read-back is stale', async () => {
    vi.mocked(Api.getSystemConfigs).mockResolvedValue([]);

    render(<EnterpriseConfigurationPanel />);

    await screen.findByText('Total Configs');
    fireEvent.click(screen.getByRole('button', { name: /Add Config/i }));
    fireEvent.change(screen.getByPlaceholderText('my_config_key'), {
      target: { value: 'feature.enabled' },
    });
    fireEvent.change(screen.getByLabelText('Configuration Value'), {
      target: { value: 'true' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }));

    await waitFor(() => {
      expect(
        screen
          .getAllByRole('alert')
          .some((alert) =>
            alert.textContent?.includes('Configuration creation was not confirmed by the server')
          )
      ).toBe(true);
    });
    expect(screen.getByPlaceholderText('my_config_key')).toBeInTheDocument();
  });

  it('keeps add modal open when configuration creation response has no id', async () => {
    vi.mocked(Api.getSystemConfigs).mockResolvedValue([]);
    vi.mocked(Api.createSystemConfig).mockResolvedValue({ success: true });

    render(<EnterpriseConfigurationPanel />);

    await screen.findByText('Total Configs');
    fireEvent.click(screen.getByRole('button', { name: /Add Config/i }));
    fireEvent.change(screen.getByPlaceholderText('my_config_key'), {
      target: { value: 'feature.enabled' },
    });
    fireEvent.change(screen.getByLabelText('Configuration Value'), {
      target: { value: 'true' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }));

    await waitFor(() => {
      expect(
        screen
          .getAllByRole('alert')
          .some((alert) =>
            alert.textContent?.includes('Configuration creation response was incomplete')
          )
      ).toBe(true);
    });
    expect(screen.getByPlaceholderText('my_config_key')).toBeInTheDocument();
  });

  it('does not update or delete configurations when read-back remains stale', async () => {
    vi.mocked(Api.getSystemConfigs).mockResolvedValue([config]);

    render(<EnterpriseConfigurationPanel />);

    await screen.findByText('feature.enabled');
    fireEvent.click(screen.getByTitle('Edit'));
    fireEvent.change(screen.getByLabelText('Configuration Value'), {
      target: { value: 'false' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(
        screen
          .getAllByRole('alert')
          .some((alert) =>
            alert.textContent?.includes('Configuration update was not confirmed by the server')
          )
      ).toBe(true);
    });
    expect(screen.getByLabelText('Configuration Value')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    fireEvent.click(screen.getByTitle('Delete'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Configuration deletion was not confirmed by the server'
      );
    });
    expect(screen.getByText('feature.enabled')).toBeInTheDocument();
  });

  it('requires rollback confirmation from a fresh config read', async () => {
    vi.stubGlobal('prompt', vi.fn(() => 'rollback test'));
    vi.mocked(Api.getSystemConfigs).mockResolvedValue([config]);
    vi.mocked(Api.getSystemConfigVersions).mockResolvedValue({
      versions: [
        {
          id: 'ver-current',
          config_key: 'feature.enabled',
          old_value: 'false',
          new_value: 'true',
          changed_at: 'not-a-date',
          changed_by: 'admin',
        },
        {
          id: 'ver-old',
          config_key: 'feature.enabled',
          old_value: 'true',
          new_value: 'false',
          changed_at: 'not-a-date',
          changed_by: 'admin',
        },
      ],
    });

    render(<EnterpriseConfigurationPanel />);

    await screen.findByText('feature.enabled');
    fireEvent.click(screen.getByTitle('History'));
    await screen.findByText('Rollback to this version');
    fireEvent.click(screen.getByText('Rollback to this version'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Configuration rollback was not confirmed by the server'
      );
    });
  });

  it('accepts wrapped config payloads and renders malformed fields safely', async () => {
    vi.mocked(Api.getSystemConfigs).mockResolvedValue({
      configs: [
        {
          ...config,
          key: 123,
          type: 'unexpected',
          category: '',
          description: null,
          is_sensitive: '1',
        },
      ],
    });

    render(<EnterpriseConfigurationPanel />);

    expect(await screen.findByText('123')).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });
});
