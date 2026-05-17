import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SecurityOverviewPage } from '@/components/settings/security/SecurityOverviewPage';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    getActiveSessions: vi.fn(),
    getLoginHistory: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, vars?: Record<string, unknown>) =>
      vars?.count ? fallback.replace('{{count}}', String(vars.count)) : fallback,
  }),
}));

const user = { id: 'user-1', email: 'user@example.com', mfaEnabled: false };

describe('SecurityOverviewPage honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render fallback security score when security data fails to load', async () => {
    vi.mocked(Api.getActiveSessions).mockRejectedValue(new Error('Sessions API down'));
    vi.mocked(Api.getLoginHistory).mockResolvedValue([]);
    vi.mocked(Api.get).mockResolvedValue({});

    render(<SecurityOverviewPage currentUser={user as any} />);

    await waitFor(() => {
      expect(screen.getByText('Security overview unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Sessions API down')).toBeInTheDocument();
    expect(screen.queryByText('Protection Status')).not.toBeInTheDocument();
  });

  it('renders unknown date instead of invalid security event timestamps', async () => {
    vi.mocked(Api.getActiveSessions).mockResolvedValue({ sessions: [] });
    vi.mocked(Api.getLoginHistory).mockResolvedValue([
      {
        id: 'event-1',
        timestamp: 'not-a-date',
        status: 'success',
        location: 'Warsaw',
        ip: '127.0.0.1',
        device: 'Chrome',
      },
    ]);
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/settings/recovery') {
        return { recoveryEmail: true, recoveryPhone: false, backupCodesCount: 0 };
      }
      return { isEnabled: true, method: 'totp' };
    });

    render(<SecurityOverviewPage currentUser={user as any} />);

    await screen.findByText('Protection Status');
    expect(screen.getByText('Unknown date')).toBeInTheDocument();
  });
});
