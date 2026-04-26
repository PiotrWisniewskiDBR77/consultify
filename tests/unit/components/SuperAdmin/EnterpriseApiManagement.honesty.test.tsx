import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EnterpriseApiManagement } from '@/components/SuperAdmin/system/EnterpriseApiManagement';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    getApiKeys: vi.fn(),
    getApiKeyUsage: vi.fn(),
    updateApiKey: vi.fn(),
    createUserApiKey: vi.fn(),
    revokeApiKey: vi.fn(),
  },
}));

describe('EnterpriseApiManagement honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(Api.getApiKeys).mockRejectedValue(new Error('API keys backend down'));
    vi.mocked(Api.getApiKeyUsage).mockResolvedValue({
      usage: [],
      totals: { total_requests: 0, avg_response_time: 0, total_errors: 0 },
      endpoints: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render API key load failures as an empty key list', async () => {
    render(<EnterpriseApiManagement />);

    await waitFor(() => {
      expect(screen.getByText('API keys unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('API keys backend down')).toBeInTheDocument();
    expect(screen.queryByText('No API keys found')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create API Key/i })).toBeDisabled();
    expect(screen.getByPlaceholderText('Search API keys...')).toBeDisabled();
  });

  it('does not invite usage inspection when API keys cannot load', async () => {
    render(<EnterpriseApiManagement />);

    fireEvent.click(screen.getByRole('button', { name: /Usage Analytics/i }));

    await waitFor(() => {
      expect(screen.getByText('API key usage unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('Select an API key to view usage analytics')).not.toBeInTheDocument();
  });
});
