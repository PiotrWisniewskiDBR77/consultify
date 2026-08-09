/**
 * S1-U2 — Notebook navigation-trap regression tests.
 *
 * (b) From an open notebook there must ALWAYS be a way back to the notebooks
 *     list: the sidebar back button (`notebook-back-to-library`) must render
 *     whenever `onBackToLibrary` is provided, and clicking it must call it.
 * (c) The duplicated in-sidebar Inbox/Active/All/Today tab bar is gone —
 *     page-status presets live in the hub's single Command Row (Menu 3).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotebookContent } from '../../../src/components/MyWork/NotebookContent';

const renderWithRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

const { apiMock, editorMock } = vi.hoisted(() => ({
  apiMock: {
    getNotebookPages: vi.fn(),
    getNotebookPage: vi.fn(),
    notebookGetAIProposals: vi.fn(),
    updateNotebookPage: vi.fn(),
    getOrphanedNotebookPageIds: vi.fn(async () => []),
  },
  editorMock: {
    commands: { setContent: vi.fn() },
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
  default: { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() },
}));

vi.mock('@/services/api', () => ({
  Api: apiMock,
  API_URL: '',
  getHeaders: () => ({}),
}));

vi.mock('@/services/funnelAnalytics', () => ({ trackFunnelEvent: vi.fn() }));

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

describe('NotebookContent back navigation (S1-U2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getNotebookPages.mockResolvedValue([]);
    apiMock.notebookGetAIProposals.mockResolvedValue([]);
    apiMock.updateNotebookPage.mockResolvedValue({});
  });

  it('renders the back-to-library button and calls onBackToLibrary on click', async () => {
    const onBack = vi.fn();
    renderWithRouter(
      <NotebookContent
        searchQuery=""
        notebookId="nb-1"
        notebookTitle="Strategy 2026"
        onBackToLibrary={onBack}
      />
    );

    const backBtn = await screen.findByTestId('notebook-back-to-library');
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('does NOT render the duplicated in-sidebar status tab bar (absorbed into Menu 3)', async () => {
    renderWithRouter(
      <NotebookContent
        searchQuery=""
        notebookId="nb-1"
        notebookTitle="Strategy 2026"
        onBackToLibrary={vi.fn()}
      />
    );

    await waitFor(() => expect(apiMock.getNotebookPages).toHaveBeenCalled());
    // The old second chip line rendered an "Active" tab button in the sidebar;
    // the status axis (All/Inbox/Active) is owned by Menu 3 in the hub now.
    expect(screen.queryByRole('button', { name: /^Active$/ })).not.toBeInTheDocument();
  });
});
