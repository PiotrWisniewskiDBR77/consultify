import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DataPrivacySettings } from '@/components/settings/DataPrivacySettings';
import { Api } from '@/services/api';

const tMock = (_key: string, fallback: string) => fallback;

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tMock,
  }),
}));

const preferences = {
  shareAnalytics: true,
  shareUsageData: false,
  improveAI: true,
  marketingEmails: false,
  productUpdates: true,
  newsletterSubscribed: false,
  allowThirdPartyIntegrations: true,
  dataRetentionPolicy: 'standard',
  enablePiiRedaction: false,
};

describe('DataPrivacySettings honest UI', () => {
  const user = { id: 'user-1', email: 'user@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('alert', vi.fn());
  });

  it('does not render failed data privacy loads as editable defaults', async () => {
    vi.mocked(Api.get).mockRejectedValue(new Error('Data privacy API down'));

    render(<DataPrivacySettings currentUser={user as any} />);

    await waitFor(() => {
      expect(screen.getByText('Data privacy unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Data privacy API down')).toBeInTheDocument();
    expect(screen.queryByText('Data Sharing')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save/i })).toBeDisabled();
  });

  it('does not show saved state or call onUpdate when read-back returns stale preferences', async () => {
    const onUpdate = vi.fn();
    vi.mocked(Api.get)
      .mockResolvedValueOnce({ preferences })
      .mockResolvedValueOnce({ preferences });
    vi.mocked(Api.put).mockResolvedValue({ success: true });

    render(<DataPrivacySettings currentUser={user as any} onUpdate={onUpdate} />);

    await screen.findByText('Data Retention');

    fireEvent.click(screen.getByRole('button', { name: /Minimal/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Data privacy preferences save was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(screen.queryByText('Saved!')).not.toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
