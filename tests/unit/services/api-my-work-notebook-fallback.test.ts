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
    notebookCaptureUpload: vi.fn(),
    createNotebookPage: vi.fn(),
    updateNotebookPage: vi.fn(),
    deleteNotebookPage: vi.fn(),
    pinNotebookPage: vi.fn(),
    setNotebookPageStatus: vi.fn(),
    classifyNotebookPage: vi.fn(),
    convertNotebookPage: vi.fn(),
    createNotebookAIProposal: vi.fn(),
    getNotebookAIProposals: vi.fn(),
    resolveNotebookAIProposal: vi.fn(),
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

  it('does not fall back to legacy notebook classify on transient V8 errors', async () => {
    vi.mocked(V8MyWorkApi.classifyNotebookPage).mockRejectedValue({
      status: 429,
      message: 'Too Many Requests',
    });

    await expect(Api.classifyNotebookPage('note-42')).rejects.toMatchObject({
      status: 429,
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('falls back to legacy notebook classify only for non-supported V8 statuses', async () => {
    vi.mocked(V8MyWorkApi.classifyNotebookPage).mockRejectedValue({
      status: 404,
      message: 'Not Found',
    });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ suggestedType: 'tasks' }),
    } as Response);

    await expect(Api.classifyNotebookPage('note-42')).resolves.toEqual({
      suggestedType: 'tasks',
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      '/api/my-work/notebook/pages/note-42/classify',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('does not fall back to legacy notebook AI proposals on transient V8 errors', async () => {
    vi.mocked(V8MyWorkApi.createNotebookAIProposal).mockRejectedValue({
      status: 429,
      message: 'Too Many Requests',
    });

    await expect(
      Api.notebookCreateAIProposal('note-42', {
        proposalType: 'append',
        blockContent: { type: 'paragraph' },
        rationale: 'Add summary',
      }),
    ).rejects.toMatchObject({
      status: 429,
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not fall back to legacy notebook convert on transient V8 errors', async () => {
    vi.mocked(V8MyWorkApi.convertNotebookPage).mockRejectedValue({
      status: 429,
      message: 'Too Many Requests',
    });

    await expect(Api.convertNotebookPage('note-42', 'initiative')).rejects.toMatchObject({
      status: 429,
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('falls back to legacy notebook convert only for non-supported V8 statuses', async () => {
    vi.mocked(V8MyWorkApi.convertNotebookPage).mockRejectedValue({
      status: 404,
      message: 'Not Found',
    });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'legacy-initiative-1', type: 'initiative', title: 'Converted note' }),
    } as Response);

    await expect(Api.convertNotebookPage('note-42', 'initiative', { title: 'Converted note' })).resolves.toEqual({
      id: 'legacy-initiative-1',
      type: 'initiative',
      title: 'Converted note',
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      '/api/my-work/notebook/pages/note-42/convert',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ target: 'initiative', title: 'Converted note' }),
      }),
    );
  });

  it('falls back to legacy notebook AI proposal list only for non-supported V8 statuses', async () => {
    vi.mocked(V8MyWorkApi.getNotebookAIProposals).mockRejectedValue({
      status: 404,
      message: 'Not Found',
    });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ proposals: [{ id: 'legacy-proposal-1' }] }),
    } as Response);

    await expect(Api.notebookGetAIProposals('note-42', { status: 'proposed', limit: 20 })).resolves.toEqual({
      proposals: [{ id: 'legacy-proposal-1' }],
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      '/api/notebook/pages/note-42/ai-proposals?status=proposed&limit=20',
      expect.objectContaining({
        headers: expect.any(Object),
      }),
    );
  });

  it('falls back to legacy notebook AI proposal resolve only for non-supported V8 statuses', async () => {
    vi.mocked(V8MyWorkApi.resolveNotebookAIProposal).mockRejectedValue({
      status: 405,
      message: 'Method Not Allowed',
    });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'proposal-1', status: 'accepted' }),
    } as Response);

    await expect(Api.notebookResolveAIProposal('proposal-1', 'accepted')).resolves.toEqual({
      id: 'proposal-1',
      status: 'accepted',
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      '/api/notebook/ai-proposals/proposal-1/resolve',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('routes notebook file upload through capture upload and then resolves the created page', async () => {
    vi.mocked(V8MyWorkApi.notebookCaptureUpload).mockResolvedValue({
      pageId: 'captured-note-1',
      source: 'upload',
    } as any);
    vi.mocked(V8MyWorkApi.getNotebookPage).mockResolvedValue({
      id: 'captured-note-1',
      title: 'Captured note',
      contentJson: {},
      tags: [],
      status: 'active',
      pinned: false,
    } as any);

    const file = new File(['hello'], 'note.txt', { type: 'text/plain' });
    const result = await Api.uploadNotebookFile(file);

    expect(result).toMatchObject({
      id: 'captured-note-1',
      title: 'Captured note',
    });
    expect(vi.mocked(V8MyWorkApi.notebookCaptureUpload)).toHaveBeenCalledWith(file);
    expect(vi.mocked(V8MyWorkApi.getNotebookPage)).toHaveBeenCalledWith('captured-note-1');
  });

  it('falls back to legacy notebook capture upload only for non-supported V8 statuses', async () => {
    vi.mocked(V8MyWorkApi.notebookCaptureUpload).mockRejectedValue({
      status: 404,
      message: 'Not Found',
    });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ pageId: 'captured-note-2', source: 'upload' }),
    } as Response);
    vi.mocked(V8MyWorkApi.getNotebookPage).mockResolvedValue({
      id: 'captured-note-2',
      title: 'Captured note two',
      contentJson: {},
      tags: [],
      status: 'active',
      pinned: false,
    } as any);

    const file = new File(['hello'], 'note-two.txt', { type: 'text/plain' });
    const result = await Api.uploadNotebookFile(file);

    expect(result).toMatchObject({
      id: 'captured-note-2',
      title: 'Captured note two',
    });
    expect(fetch).toHaveBeenCalledWith(
      '/api/notebook/capture/upload',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      })
    );
  });

  it('streams notebook action extraction through the shared Api client seam', async () => {
    const chunks = [
      'data: {"type":"stage","label":"Analyzing..."}\n',
      '\n',
      'data: {"type":"actions","items":[{"title":"Follow up","suggestedOwner":null,"suggestedDue":null,"priority":"medium"}]}\n\n',
      'data: {"type":"done","count":1}\n\n',
    ];
    let index = 0;
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: async () => {
            if (index >= chunks.length) {
              return { done: true, value: undefined };
            }
            const value = new TextEncoder().encode(chunks[index]);
            index += 1;
            return { done: false, value };
          },
        }),
      },
    } as any);

    const events: Array<Record<string, unknown>> = [];
    await Api.streamNotebookActionExtraction('note-stream-1', {
      language: 'en',
      onEvent: (event) => events.push(event),
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/my-work/notebook/pages/note-stream-1/extract-actions',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(events).toEqual([
      { type: 'stage', label: 'Analyzing...' },
      {
        type: 'actions',
        items: [{ title: 'Follow up', suggestedOwner: null, suggestedDue: null, priority: 'medium' }],
      },
      { type: 'done', count: 1 },
    ]);
  });
});
