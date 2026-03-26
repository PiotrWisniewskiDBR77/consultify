import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

vi.mock('@/i18n', () => ({
  default: {
    language: 'en',
    t: (key: string) => key,
  },
}));

vi.mock('@/services/tokenService', () => ({
  tokenService: {
    getToken: vi.fn(() => null),
    getRefreshToken: vi.fn(() => null),
    refreshToken: vi.fn(() => null),
  },
}));

vi.mock('@/services/api/v8/my-work', () => ({
  V8MyWorkApi: {
    getCalendarUnified: vi.fn(),
    getCalendarConflicts: vi.fn(),
    createCalendarEvent: vi.fn(),
    getNotebookPages: vi.fn(),
    getNotebookPage: vi.fn(),
    createNotebookPage: vi.fn(),
    updateNotebookPage: vi.fn(),
    deleteNotebookPage: vi.fn(),
    pinNotebookPage: vi.fn(),
    setNotebookPageStatus: vi.fn(),
  },
}));

import { Api } from '@/services/api';
import { V8MyWorkApi } from '@/services/api/v8/my-work';

describe('Api calendar V8 fallback guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('does not fall back to legacy unified calendar on transient V8 errors', async () => {
    vi.mocked(V8MyWorkApi.getCalendarUnified).mockRejectedValue({
      status: 429,
      message: 'Too Many Requests',
    });

    await expect(
      Api.getMyWorkCalendarUnified({ start: '2026-03-01', end: '2026-04-01' }),
    ).rejects.toMatchObject({
      status: 429,
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('falls back to legacy calendar conflicts only for non-supported V8 statuses', async () => {
    vi.mocked(V8MyWorkApi.getCalendarConflicts).mockRejectedValue({
      status: 404,
      message: 'Not Found',
    });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ totalItems: 0, tasks: [], decisions: [], hasConflicts: false }),
    } as Response);

    await expect(Api.getMyWorkCalendarConflicts('2026-03-27')).resolves.toEqual({
      totalItems: 0,
      tasks: [],
      decisions: [],
      hasConflicts: false,
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      '/api/my-work/calendar/conflicts?date=2026-03-27',
      expect.objectContaining({
        headers: expect.any(Object),
      }),
    );
  });
});
