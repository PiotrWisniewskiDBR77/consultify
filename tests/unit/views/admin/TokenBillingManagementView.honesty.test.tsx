import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { TokenBillingManagementView } from '@/views/admin/TokenBillingManagementView';

vi.mock('@/views/admin/AdminLLMMultipliers', () => ({
  AdminLLMMultipliers: () => <div>LLM multipliers</div>,
}));

vi.mock('@/views/admin/AdminMarginConfig', () => ({
  AdminMarginConfig: () => <div>Margin config</div>,
}));

vi.mock('@/views/admin/AdminTokenPackages', () => ({
  AdminTokenPackages: () => <div>Token packages</div>,
}));

vi.mock('@/services/api', () => ({
  Api: {
    getLLMProviders: vi.fn(),
    getTokenPackages: vi.fn(),
    getBillingMargins: vi.fn(),
    getTokenBalance: vi.fn(),
  },
}));

describe('TokenBillingManagementView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.getLLMProviders).mockRejectedValue(new Error('Providers down'));
    vi.mocked(Api.getTokenPackages).mockResolvedValue([]);
    vi.mocked(Api.getBillingMargins).mockResolvedValue([]);
    vi.mocked(Api.getTokenBalance).mockResolvedValue(0);
  });

  it('does not render failed token billing overview sources as zero KPI cards', async () => {
    render(<TokenBillingManagementView />);

    await waitFor(() => {
      expect(screen.getByText('Token billing overview unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('Active AI Models')).not.toBeInTheDocument();
    expect(screen.queryByText('0.0k')).not.toBeInTheDocument();
  });
});
