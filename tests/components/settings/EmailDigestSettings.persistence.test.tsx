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

  it('saves email category preferences then reads persisted values back, preserving digest fields untouched', async () => {
    render(<EmailDigestSettings currentUser={currentUser} onUpdateUser={vi.fn()} />);

    expect(await screen.findByText('Task Updates')).toBeInTheDocument();
    const marketingRow = screen.getByText('Marketing').closest('.flex');
    const marketingToggle = marketingRow?.querySelector('button');
    expect(marketingToggle).toBeTruthy();
    await userEvent.click(marketingToggle as HTMLButtonElement);
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(Api.put).toHaveBeenCalledWith(
        '/settings/notifications/email',
        expect.objectContaining({ marketing: true })
      );
      // N3: frequency/content/format have no UI control anymore (digest is
      // a no-op placebo, hidden per DEC-2026-08-25-21). The save still
      // round-trips whatever was loaded, unmodified — it must not silently
      // drop or mutate these fields just because they're not rendered.
      expect(Api.put).toHaveBeenCalledWith(
        '/settings/notifications/digest',
        expect.objectContaining({ frequency: 'instant', content: 'summary', format: 'html' })
      );
    });
    await waitFor(() => {
      expect(Api.get).toHaveBeenCalledWith('/settings/notifications/email');
      expect(Api.get).toHaveBeenCalledWith('/settings/notifications/digest');
    });
  });

  it('N3: hides the digest/weekly-digest controls behind a single planned notice', async () => {
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

    // The still-real category toggles remain visible and interactive.
    expect(await screen.findByText('Task Updates')).toBeInTheDocument();

    // The digest engine is a no-op end to end (server/src/cron/DailyDigestCron.js
    // always returns zeroed counts) — no frequency/content/format picker, and
    // no "Weekly Digest" category checkbox, should be rendered as if they did
    // something. A single honest notice takes their place.
    expect(screen.queryByText('Digest Settings')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Weekly Receive a summary once per week/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Weekly Digest' })).not.toBeInTheDocument();
    expect(
      screen.getByText('Planned — this channel will go live after rollout')
    ).toBeInTheDocument();

    // But the loaded value is still preserved for round-trip fidelity —
    // this is a UI hide, not a data loss.
    expect(Api.get).toHaveBeenCalledWith('/settings/notifications/digest');
  });
});
