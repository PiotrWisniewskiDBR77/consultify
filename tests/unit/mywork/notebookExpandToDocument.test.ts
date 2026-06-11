/**
 * C3 "Rozwiń w dokument" (KROK 6) — unit tests for the pure helpers that turn
 * a notebook page into a Work Canvas draft request + /chat deep-link.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildExpandChatUrl,
  buildNotebookExpandDraftBody,
  expandNotebookPageToCanvasDraft,
  notebookContentToMarkdown,
} from '@/components/MyWork/notebook/notebookExpandToDocument';

const tiptapDoc = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Sekcja' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Plan ' },
        { type: 'text', text: 'transformacji', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' AI' },
      ],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'punkt pierwszy' }] }],
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'punkt drugi' }] }],
        },
      ],
    },
    {
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { checked: true },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'zrobione' }] }],
        },
        {
          type: 'taskItem',
          attrs: { checked: false },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'do zrobienia' }] }],
        },
      ],
    },
  ],
};

describe('notebookContentToMarkdown', () => {
  it('converts TipTap JSON (headings, marks, lists, tasks) to markdown', () => {
    const markdown = notebookContentToMarkdown(tiptapDoc);
    expect(markdown).toContain('## Sekcja');
    expect(markdown).toContain('Plan **transformacji** AI');
    expect(markdown).toContain('- punkt pierwszy');
    expect(markdown).toContain('- [x] zrobione');
    expect(markdown).toContain('- [ ] do zrobienia');
  });

  it('falls back to plain contentText when JSON is empty or malformed', () => {
    expect(notebookContentToMarkdown(null, 'plain fallback')).toBe('plain fallback');
    expect(notebookContentToMarkdown({ type: 'doc', content: [] }, 'plain fallback')).toBe(
      'plain fallback'
    );
  });
});

describe('buildNotebookExpandDraftBody', () => {
  it('builds a document draft body with D-C-2 notebook-expand provenance', () => {
    const body = buildNotebookExpandDraftBody({
      id: 'page-123',
      title: 'Notatka VTS',
      contentJson: tiptapDoc,
      contentText: 'fallback',
    });
    expect(body.kind).toBe('document');
    expect(body.title).toBe('Notatka VTS');
    expect(body.contentMd).toContain('## Sekcja');
    expect(body.content).toBe(body.contentMd);
    expect(body.provenance).toEqual({
      source: 'notebook-expand',
      sourceType: 'notebook',
      sourceId: 'page-123',
      sourceTitle: 'Notatka VTS',
    });
  });
});

describe('expandNotebookPageToCanvasDraft', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to /api/work-canvas/drafts and returns the /chat deep-link', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'draft-9' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await expandNotebookPageToCanvasDraft({
      id: 'page-123',
      title: 'Notatka VTS',
      contentJson: tiptapDoc,
      contentText: 'fallback',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/work-canvas/drafts');
    expect(init.method).toBe('POST');
    const parsedBody = JSON.parse(init.body);
    expect(parsedBody.kind).toBe('document');
    expect(parsedBody.provenance.sourceId).toBe('page-123');

    expect(result.draftId).toBe('draft-9');
    expect(result.chatUrl).toBe('/chat?workPanel=1&canvasDraftId=draft-9');
    expect(result.chatUrl).toBe(buildExpandChatUrl('draft-9'));
  });

  it('throws a descriptive error when the API rejects the draft', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'nope' }),
      })
    );
    await expect(
      expandNotebookPageToCanvasDraft({ id: 'p', title: 't', contentJson: null })
    ).rejects.toThrow('nope');
  });
});
