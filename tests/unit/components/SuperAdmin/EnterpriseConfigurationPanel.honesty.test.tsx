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

describe('EnterpriseConfigurationPanel honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(Api.getSystemConfigs).mockRejectedValue(new Error('Config backend down'));
    vi.mocked(Api.getSystemConfigVersions).mockResolvedValue({ versions: [] });
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
    vi.mocked(Api.getSystemConfigs).mockResolvedValue([
      {
        id: 'cfg-1',
        key: 'feature.enabled',
        value: 'true',
        type: 'boolean',
        category: 'general',
        description: 'Feature toggle',
        is_sensitive: false,
        updated_at: new Date().toISOString(),
      },
    ]);
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
});
