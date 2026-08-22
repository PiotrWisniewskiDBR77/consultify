import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmailDigestSettings } from '@/components/settings/EmailDigestSettings';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
  }),
}));

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

const currentUser = {
  id: 'user-1',
  email: 'owner@example.com',
  firstName: 'Piotr',
  lastName: 'Owner',
  role: 'OWNER',
} as any;

describe('EmailDigestSettings persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (Api.get as any).mockImplementation((url: string) => {
      if (url === '/settings/notifications/email') {
        return Promise.resolve({
          taskUpdates: true,
          projectAlerts: true,
          weeklyDigest: true,
          marketing: false,
        });
      }
      if (url === '/settings/notifications/digest') {
        return Promise.resolve({ frequency: 'instant', content: 'summary', format: 'html' });
      }
      return Promise.resolve(null);
    });
    (Api.put as any).mockResolvedValue({ success: true });
  });

  it('saves email and digest preferences then reads persisted values back', async () => {
    render(<EmailDigestSettings currentUser={currentUser} onUpdateUser={vi.fn()} />);

    expect(await screen.findByText('Task Updates')).toBeInTheDocument();
    const marketingRow = screen.getByText('Marketing').closest('.flex');
    const marketingToggle = marketingRow?.querySelector('button');
    expect(marketingToggle).toBeTruthy();
    await userEvent.click(marketingToggle as HTMLButtonElement);
    await userEvent.click(screen.getByText('Daily'));
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(Api.put).toHaveBeenCalledWith(
        '/settings/notifications/email',
        expect.objectContaining({ marketing: true })
      );
      expect(Api.put).toHaveBeenCalledWith(
        '/settings/notifications/digest',
        expect.objectContaining({ frequency: 'daily' })
      );
    });
    await waitFor(() => {
      expect(Api.get).toHaveBeenCalledWith('/settings/notifications/email');
      expect(Api.get).toHaveBeenCalledWith('/settings/notifications/digest');
    });
  });

  it('cold-hydrates the canonical weekly digest envelope', async () => {
    (Api.get as any).mockImplementation((url: string) => {
      if (url === '/settings/notifications/email') {
        return Promise.resolve({ taskUpdates: true, projectAlerts: true, weeklyDigest: true, marketing: false });
      }
      if (url === '/settings/notifications/digest') {
        return Promise.resolve({ frequency: 'weekly', content: 'summary', format: 'html' });
      }
      return Promise.resolve(null);
    });

    render(<EmailDigestSettings currentUser={currentUser} onUpdateUser={vi.fn()} />);

    const weekly = await screen.findByRole('button', { name: /Weekly Receive a summary once per week/i });
    expect(weekly.className).toContain('border-c-accent');
    expect(Api.get).toHaveBeenCalledWith('/settings/notifications/digest');
  });
});
