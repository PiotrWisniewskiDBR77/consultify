import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotebookContent } from '../../../src/components/MyWork/NotebookContent';

const { toastErrorMock, apiMock, editorMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  apiMock: {
    getNotebookPages: vi.fn(),
    getNotebookPage: vi.fn(),
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
    t: (_key: string, fallback?: string) => fallback || _key,
    i18n: { language: 'en' },
  }),
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
vi.mock('../../../src/components/MyWork/notebook/SlashMenu', () => ({
  INITIAL_SLASH_STATE: { open: false },
  detectSlashTrigger: () => null,
  SlashMenu: () => <div />,
}));
vi.mock('../../../src/components/MyWork/shared/askAiHelper', () => ({
  buildAskAIMessage: () => 'ask-ai',
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

    render(<NotebookContent searchQuery="" openPageId="missing-note" />);

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

    const { unmount } = render(<NotebookContent searchQuery="" />);

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
});
