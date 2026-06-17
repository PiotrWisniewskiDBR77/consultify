import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SettingsOwnershipPanels from '@/components/settings/SettingsOwnershipPanels';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
  }),
}));

vi.mock('@/components/settings/SettingsTaxonomyPanel', () => ({
  SettingsTaxonomyPanel: () => <div>Settings taxonomy</div>,
}));

describe('SettingsOwnershipPanels honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a load alert instead of ownership panels when registry resolution fails', async () => {
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/organization-context') return { profile: { defaultLanguage: 'en' } };
      throw new Error('Registry resolve down');
    });

    render(<SettingsOwnershipPanels mode="overview" />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Registry resolve down');
    });

    expect(screen.queryByText('Tenant defaults')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings taxonomy')).not.toBeInTheDocument();
  });
});
