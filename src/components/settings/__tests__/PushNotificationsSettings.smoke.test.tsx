/**
 * @vitest-environment jsdom
 *
 * Smoke tests for PushNotificationsSettings — verifies the component loads its
 * persisted desktop preference, gates mobile push as "coming soon", surfaces an
 * error state with retry, and persists the desktop toggle through the
 * notification preferences endpoint (merging rather than clobbering).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, def?: unknown) => {
      if (def && typeof def === 'object') {
        return (def as { defaultValue?: string }).defaultValue ?? _k;
      }
      return (def as string) ?? _k;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }) };
});

const { apiGet, apiPut } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPut: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: { get: apiGet, put: apiPut },
}));

// InfoButton (used inside SettingsSection) pulls in help context; stub it out.
vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

import { PushNotificationsSettings } from '../PushNotificationsSettings';

const setPermission = (value: NotificationPermission) => {
  // jsdom does not implement Notification; provide a minimal stub.
  (globalThis as unknown as { Notification: unknown }).Notification = {
    permission: value,
    requestPermission: vi.fn(async () => 'granted' as NotificationPermission),
  };
};

beforeEach(() => {
  apiGet.mockReset();
  apiPut.mockReset();
  apiGet.mockResolvedValue({ preferences: { desktop: false, email: true } });
  apiPut.mockResolvedValue({});
  setPermission('granted');
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('PushNotificationsSettings smoke', () => {
  it('loads preferences and renders the desktop + gated mobile rows', async () => {
    render(<PushNotificationsSettings userId="user-1" />);
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/settings/preferences/notifications'));
    expect(screen.getByText('Desktop Notifications')).toBeInTheDocument();
    expect(screen.getByText('Mobile Push Notifications')).toBeInTheDocument();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });

  it('persists the desktop toggle by merging into existing preferences', async () => {
    render(<PushNotificationsSettings userId="user-1" />);
    const toggle = await screen.findByRole('switch');
    fireEvent.click(toggle);
    await waitFor(() => expect(apiPut).toHaveBeenCalled());
    const [url, payload] = apiPut.mock.calls[0];
    expect(url).toBe('/settings/preferences/notifications');
    // Merge must preserve the unrelated `email` flag and set desktop=true.
    expect(payload).toEqual({ preferences: { desktop: true, email: true } });
  });

  it('shows an error state with retry when loading fails', async () => {
    apiGet.mockRejectedValueOnce(new Error('boom'));
    render(<PushNotificationsSettings userId="user-1" />);
    const retry = await screen.findByRole('button', { name: /try again/i });
    // Recover on retry.
    apiGet.mockResolvedValueOnce({ preferences: { desktop: false } });
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByText('Desktop Notifications')).toBeInTheDocument());
  });
});
