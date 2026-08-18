import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api, API_URL } from '@/services/api';

describe('notification preference API contract', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('writes and reads the canonical authenticated-user preference resource', async () => {
    const preferences = {
      taskAssignment: { email: true, inApp: false },
      taskUpdates: { email: true, inApp: true },
      milestones: { email: true, inApp: true },
      mentions: { email: true, inApp: true },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ preferences }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await Api.saveNotificationPreferences('ignored-client-user-id', preferences);
    await expect(Api.getNotificationPreferences('ignored-client-user-id')).resolves.toEqual(
      preferences
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${API_URL}/settings/preferences/notifications`,
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ preferences }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${API_URL}/settings/preferences/notifications`,
      expect.not.objectContaining({ method: expect.anything() })
    );
  });

  it('rejects malformed read responses instead of presenting editable defaults', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }))
    );

    await expect(Api.getNotificationPreferences('user-1')).rejects.toThrow(
      'Notification preferences response is invalid'
    );
  });
});
