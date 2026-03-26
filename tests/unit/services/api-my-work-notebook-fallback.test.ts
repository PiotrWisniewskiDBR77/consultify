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

describe('Api notebook V8 fallback guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('does not fall back to legacy notebook create on transient V8 errors', async () => {
    vi.mocked(V8MyWorkApi.createNotebookPage).mockRejectedValue({
      status: 429,
      message: 'Too Many Requests',
    });

    await expect(Api.createNotebookPage({ title: 'Transient throttled note' })).rejects.toMatchObject({
      status: 429,
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('falls back to legacy notebook create only for non-supported V8 statuses', async () => {
    vi.mocked(V8MyWorkApi.createNotebookPage).mockRejectedValue({
      status: 404,
      message: 'Not Found',
    });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'legacy-note-1' }),
    } as Response);

    await expect(Api.createNotebookPage({ title: 'Legacy fallback note' })).resolves.toEqual({
      id: 'legacy-note-1',
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/my-work/notebook/pages', expect.objectContaining({
      method: 'POST',
    }));
  });
});
