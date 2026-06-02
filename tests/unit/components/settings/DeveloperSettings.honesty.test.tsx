import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Api from '@/services/api';
import { DeveloperSettings } from '@/components/settings/DeveloperSettings';

vi.mock('@/services/api', () => ({
  default: {
    getDeveloperSettings: vi.fn(),
    saveDeveloperSettings: vi.fn(),
    getFeatureFlags: vi.fn(),
  },
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('DeveloperSettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.getDeveloperSettings).mockResolvedValue({ settings: {} });
    vi.mocked(Api.getFeatureFlags).mockRejectedValue(new Error('Flags down'));
  });

  it('does not render static feature flags when flag loading fails', async () => {
    render(<DeveloperSettings currentUser={{ id: 'user-1', email: 'user@example.com' } as any} />);

    fireEvent.click(screen.getByRole('tab', { name: /Feature Flags/i }));

    await waitFor(() => {
      expect(screen.getByText('Feature flags unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('ENABLE_ANALYTICS')).not.toBeInTheDocument();
  });
});
