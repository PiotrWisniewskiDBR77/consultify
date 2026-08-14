import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotebookContent } from '../../../src/components/MyWork/NotebookContent';

// C3 (KROK 6): NotebookContent now calls useNavigate (expand-into-document),
// so it must render inside a Router.
const renderWithRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

const { toastErrorMock, apiMock, editorMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  apiMock: {
    getNotebookPages: vi.fn(),
    getNotebookPage: vi.fn(),
    getOrphanedNotebookPageIds: vi.fn(async () => []),
    notebookGetAIProposals: vi.fn(),
    updateNotebookPage: vi.fn(),
  },
  editorMock: {
    commands: {
      setContent: vi.fn(),
    },
    on: vi.fn(),
    off: vi.fn(),
    getJSON: vi.fn(() => ({ type: 'doc', content: [] })),
    state: {
      selection: { $from: { before: () => 0, depth: 0 }, empty: true },
      doc: { descendants: vi.fn() },
    },
    view: { domAtPos: vi.fn(() => ({ node: document.createElement('div') })), dispatch: vi.fn() },
    chain: vi.fn(() => ({
      focus: () => ({
        setTextSelection: () => ({ run: vi.fn() }),
        deleteRange: () => ({ run: vi.fn() }),
        insertTable: () => ({ run: vi.fn() }),
        setHorizontalRule: () => ({ run: vi.fn() }),
      }),
    })),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  Api: apiMock,
  // M04 cover-image surface reads these named exports; provide inert stubs so
  // the cover effect short-circuits (empty API_URL) instead of firing fetch.
  API_URL: '',
  getHeaders: () => ({}),
}));

vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    emitMyWorkEvent: vi.fn(),
    setChatKickoffMessage: vi.fn(),
    isChatCollapsed: false,
    toggleChatCollapse: vi.fn(),
  }),
}));

vi.mock('@tiptap/react', () => ({
  useEditor: () => editorMock,
  EditorContent: () => <div data-testid="editor-content" />,
}));

vi.mock('../../../src/components/MyWork/ConvertToOutputMenu', () => ({
  ConvertToOutputMenu: () => <div />,
}));
vi.mock('../../../src/components/MyWork/notebook/ActionItemsPanel', () => ({
  ActionItemsPanel: () => <div />,
}));
vi.mock('../../../src/components/MyWork/notebook/AIChatInlinePanel', () => ({
  AI_BLOCK_MIME: 'application/x-test',
  AIChatInlinePanel: () => <div />,
}));
vi.mock('../../../src/components/MyWork/notebook/AICommandPrompt', () => ({
  AICommandPrompt: () => <div />,
}));
vi.mock('../../../src/components/MyWork/notebook/AIInlineResponse', () => ({
  AIInlineResponse: () => <div />,
}));
vi.mock('../../../src/components/MyWork/notebook/AITopicsPanel', () => ({
  AITopicsPanel: () => <div />,
}));
vi.mock('../../../src/components/MyWork/notebook/ConvertChecklistModal', () => ({
  ConvertChecklistModal: () => <div />,
}));
vi.mock('../../../src/components/MyWork/notebook/NewPageModal', () => ({
  NewPageModal: () => <div />,
}));
vi.mock('../../../src/components/MyWork/notebook/NotebookAttachmentsSection', () => ({
  NotebookAttachmentsSection: () => <div />,
}));
vi.mock('../../../src/components/MyWork/notebook/NotebookCanonicalPathStrip', () => ({
  NotebookCanonicalPathStrip: () => <div />,
}));
vi.mock('../../../src/components/MyWork/notebook/NotebookContextPanel', () => ({
  NotebookContextPanel: () => <div />,
}));
vi.mock('../../../src/components/MyWork/notebook/NotebookToolbar', () => ({
  NotebookToolbar: () => <div />,
}));
vi.mock('../../../src/components/MyWork/notebook/NotebookBubbleToolbar', () => ({
  NotebookBubbleToolbar: () => <div />,
}));
vi.mock('../../../src/components/MyWork/notebook/NotebookBacklinksBar', () => ({
  NotebookBacklinksBar: () => <div />,
}));
vi.mock('../../../src/components/MyWork/notebook/SlashMenu', () => ({
  INITIAL_SLASH_STATE: { open: false },
  detectSlashTrigger: () => null,
  SlashMenu: () => <div />,
}));
vi.mock('../../../src/components/MyWork/shared/askAiHelper', () => ({
  buildAskAIMessage: () => 'ask-ai',
}));
// TipTap extension module pulls in lowlight/highlight.js which does not
// resolve in the vitest environment — the editor is mocked anyway.
vi.mock('../../../src/components/MyWork/notebook/extensions', () => ({
  CalloutNode: {},
  DetailsContentNode: {},
  DetailsNode: {},
  DetailsSummaryNode: {},
  EmbeddedRefNode: {},
  NOTEBOOK_CODE_LANGUAGES: [],
  NotebookBookmark: { configure: () => ({}) },
  NotebookCodeBlock: {},
  NotebookImage: { configure: () => ({}) },
}));

describe('NotebookContent manual gate regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getNotebookPages.mockResolvedValue([]);
    apiMock.notebookGetAIProposals.mockResolvedValue([]);
    apiMock.updateNotebookPage.mockResolvedValue({});
  });

  it('shows an honest error when openPageId cannot be loaded', async () => {
    apiMock.getNotebookPage.mockRejectedValue(new Error('missing'));

    renderWithRouter(<NotebookContent searchQuery="" openPageId="missing-note" />);

    await waitFor(() => {
      expect(apiMock.getNotebookPage).toHaveBeenCalledWith('missing-note');
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to open the requested note');
    });
  });

  it('flushes a pending save when the notebook view unmounts', async () => {
    apiMock.getNotebookPages.mockResolvedValue([
      {
        id: 'note-1',
        title: 'Test note',
        projectId: null,
        visibility: 'private',
        tags: [],
        contentJson: { type: 'doc', content: [] },
        contentText: '',
        maturity: 'seed',
        icon: null,
        summary: null,
        status: 'active',
        pinned: false,
        convertedTo: null,
        attachments: [],
        createdAt: '2026-03-28T10:00:00.000Z',
        updatedAt: '2026-03-28T10:00:00.000Z',
      },
    ]);

    editorMock.getJSON.mockReturnValue({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Persist me on exit' }] }],
    });

    const { unmount } = renderWithRouter(<NotebookContent searchQuery="" />);

    await waitFor(() => {
      expect(apiMock.getNotebookPages).toHaveBeenCalled();
      expect(editorMock.on).toHaveBeenCalledWith('update', expect.any(Function));
    });

    const updateHandler = editorMock.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'update'
    )?.[1] as (() => void) | undefined;

    expect(updateHandler).toBeDefined();

    act(() => {
      updateHandler?.();
    });

    unmount();

    await waitFor(() => {
      expect(apiMock.updateNotebookPage).toHaveBeenCalledWith(
        'note-1',
        expect.objectContaining({
          contentText: 'Persist me on exit',
        })
      );
    });
  });

  // L-09: autosave is debounced (~350ms coalescing window). Rapid successive
  // editor updates must collapse into ONE persisted PUT, not one per keystroke.
  it('coalesces rapid editor updates into a single debounced save', async () => {
    vi.useFakeTimers();
    try {
      apiMock.getNotebookPages.mockResolvedValue([
        {
          id: 'note-1',
          title: 'Debounce note',
          projectId: null,
          visibility: 'private',
          tags: [],
          contentJson: { type: 'doc', content: [] },
          contentText: '',
          maturity: 'seed',
          icon: null,
          summary: null,
          status: 'active',
          pinned: false,
          convertedTo: null,
          attachments: [],
          createdAt: '2026-03-28T10:00:00.000Z',
          updatedAt: '2026-03-28T10:00:00.000Z',
        },
      ]);

      let keystroke = 0;
      editorMock.getJSON.mockImplementation(() => ({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: `typing ${keystroke}` }] },
        ],
      }));

      renderWithRouter(<NotebookContent searchQuery="" />);

      await vi.waitFor(() => {
        expect(apiMock.getNotebookPages).toHaveBeenCalled();
        expect(editorMock.on).toHaveBeenCalledWith('update', expect.any(Function));
      });

      const updateHandler = editorMock.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'update'
      )?.[1] as (() => void) | undefined;
      expect(updateHandler).toBeDefined();

      // Drain any mount-time save so the assertion isolates the debounce window.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });
      apiMock.updateNotebookPage.mockClear();

      // Three rapid "keystrokes" within a single debounce window, then let the
      // window elapse. The burst must collapse into ONE persisted PUT carrying
      // only the latest content — never one PUT per keystroke.
      await act(async () => {
        keystroke = 1;
        updateHandler?.();
        keystroke = 2;
        updateHandler?.();
        keystroke = 3;
        updateHandler?.();
        await vi.advanceTimersByTimeAsync(400);
      });

      expect(apiMock.updateNotebookPage).toHaveBeenCalledTimes(1);
      expect(apiMock.updateNotebookPage).toHaveBeenCalledWith(
        'note-1',
        expect.objectContaining({ contentText: 'typing 3' })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  // C3 (KROK 6): "Expand into document" creates a work-canvas draft copy of the
  // note (D-C-2 provenance) via POST /api/work-canvas/drafts.
  it('renders the expand-into-document button and POSTs a draft with provenance', async () => {
    apiMock.getNotebookPages.mockResolvedValue([
      {
        id: 'note-1',
        title: 'Expand me',
        projectId: null,
        visibility: 'private',
        tags: [],
        contentJson: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body text' }] }],
        },
        contentText: 'Body text',
        maturity: 'seed',
        icon: null,
        summary: null,
        status: 'active',
        pinned: false,
        convertedTo: null,
        attachments: [],
        createdAt: '2026-03-28T10:00:00.000Z',
        updatedAt: '2026-03-28T10:00:00.000Z',
      },
    ]);
    editorMock.getJSON.mockReturnValue({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body text' }] }],
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'draft-77' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const { findByTestId } = renderWithRouter(<NotebookContent searchQuery="" />);

      const button = await findByTestId('notebook-expand-to-document');
      await act(async () => {
        button.click();
      });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/work-canvas/drafts',
          expect.objectContaining({ method: 'POST' })
        );
      });
      // Other mounted surfaces (e.g. NotebookTopicChips) may issue their own
      // fetches first; locate the draft POST specifically rather than assuming
      // it is call[0].
      const draftCall = fetchMock.mock.calls.find(
        (c) => c[0] === '/api/work-canvas/drafts'
      );
      const body = JSON.parse(draftCall![1].body);
      expect(body.kind).toBe('document');
      expect(body.contentMd).toContain('Body text');
      expect(body.provenance).toEqual(
        expect.objectContaining({
          source: 'notebook-expand',
          sourceType: 'notebook',
          sourceId: 'note-1',
          sourceTitle: 'Expand me',
        })
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
