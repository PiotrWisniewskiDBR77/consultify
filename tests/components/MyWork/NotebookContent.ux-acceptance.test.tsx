import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotebookContent } from '../../../src/components/MyWork/NotebookContent';

// Same requirement as the sibling manual-gate file: NotebookContent calls
// useNavigate (expand-into-document), so it must render inside a Router.
const renderWithRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

const { toastErrorMock, apiMock, editorMock, mobileMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  apiMock: {
    getNotebookPages: vi.fn(),
    getNotebookPage: vi.fn(),
    notebookGetAIProposals: vi.fn(),
    updateNotebookPage: vi.fn(),
    // Not exercised by these tests, but NotebookContent fires this
    // unconditionally on mount (orphan-page badge) — must be present or the
    // mount itself throws.
    getOrphanedNotebookPageIds: vi.fn(),
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
  // MW-08: NotebookContent now reads useIsMobile() from @/hooks/useDeviceType
  // to pick between the three-column desktop layout and the mobile
  // list<->editor toggle. Mocked directly (not via matchMedia) so each test
  // can flip it deterministically.
  mobileMock: vi.fn(() => false),
}));

// The real react-i18next `useTranslation()` returns a REFERENTIALLY STABLE
// `t` (and object) across re-renders when the language doesn't change — it's
// backed by i18next's memoized `getFixedT`. A mock that returns a brand-new
// arrow function/object on every call breaks any production `useCallback`/
// `useMemo` that lists `t` in its dependency array (e.g. NotebookContent's
// `fetchPages`), turning an otherwise-stable memo into a fresh reference
// every render — which re-fires its owning effect every render, which
// re-invokes the fetch, which (once resolved) re-renders, forever. Confirmed
// empirically: this exact instability caused a genuine "Maximum update
// depth exceeded" runaway loop in this file before hoisting `t` here fixed
// it. Module-scope (not per-`useTranslation()`-call) so identity never changes.
const stableT = (_key: string, fallback?: any) =>
  typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key);
const stableI18nReturn = { t: stableT, i18n: { language: 'en' } };
vi.mock('react-i18next', () => ({
  useTranslation: () => stableI18nReturn,
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

// Real zustand returns a REFERENTIALLY STABLE object for an unchanged store
// slice across renders. A mock that builds a brand-new object (and a
// brand-new nested `currentUser`) on every call breaks that invariant: the
// `presenceUser` useMemo in NotebookContent (`[currentUser, currentUserId]`)
// recomputes every render, which gives useNotebookPresence's `connect`/
// `disconnect` useCallbacks (deps include `currentUser`) a fresh identity
// every render, which re-fires their owning effect
// (`[enabled, connect, disconnect]`) every render — and since `connect()`
// unconditionally calls `setState` even on its no-token no-op path, that is
// a real infinite render loop. Confirmed empirically: this exact mock
// instability (not NotebookContent.tsx) caused the "Maximum update depth
// exceeded" OOM in this file. Never manifests against the real store, so
// the fix belongs in this mock, not in production code. Module-scope
// (hoisted) so identity never changes, matching `stableI18nReturn` above.
const stableCurrentUser = {
  id: 'user-1',
  firstName: 'Piotr',
  lastName: 'Test',
  email: 'piotr@test.dev',
};
const stableAppStoreReturn = {
  emitMyWorkEvent: vi.fn(),
  setChatKickoffMessage: vi.fn(),
  isChatCollapsed: false,
  toggleChatCollapse: vi.fn(),
  // MW-08: owner display reads currentUser.id via
  // `const currentUserId = String(currentUser?.id || '')` in
  // NotebookContent.tsx. The sibling manual-gate mock omits this field
  // entirely (it doesn't need it); this suite does.
  currentUser: stableCurrentUser,
  // L-03 (Consolidated right rail, see NotebookRightRail.ownerContract.test.ts):
  // save-status, owner, and visibility — asserted by this suite via
  // getByTestId('notebook-save-state') — moved off the old inline strip and
  // into NotebookRightRail's "Work" tab. NotebookRightRail early-returns null
  // unless `open` is true, so the mock previously omitting these store fields
  // (all undefined/falsy) meant the rail — and everything this suite checks —
  // never rendered at all. Default it open on the Work tab.
  notebookRailOpen: true,
  notebookRailTab: 'work' as const,
  setNotebookRailOpen: vi.fn(),
  setNotebookRailTab: vi.fn(),
};
vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => stableAppStoreReturn,
}));

vi.mock('@/hooks/useDeviceType', () => ({
  useIsMobile: () => mobileMock(),
}));

// The mobile "back to list" button renders the shared `Button` primitive,
// which wraps a real `motion.button` (framer-motion). Mounting that for
// real in jsdom (no layout, no rAF timing) drove a genuine "Maximum update
// depth exceeded" loop that OOM'd the vitest worker — confirmed empirically
// on this exact test file, same root cause as (and same fix already
// established for) tests/components/navigation/Sidebar.mobile-overlay.test.tsx
// and MW-07's CalendarView.responsive.test.tsx. Strip the animation-only
// props so they don't leak onto the DOM node as unknown attributes.
vi.mock('framer-motion', () => {
  const stripMotionProps = ({
    initial: _initial,
    animate: _animate,
    exit: _exit,
    variants: _variants,
    transition: _transition,
    whileTap: _whileTap,
    whileHover: _whileHover,
    layout: _layout,
    ...rest
  }: any) => rest;

  return {
    AnimatePresence: ({ children }: any) => <>{children}</>,
    motion: {
      div: ({ children, ...props }: any) => <div {...stripMotionProps(props)}>{children}</div>,
      button: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <button ref={ref} {...stripMotionProps(props)}>
          {children}
        </button>
      )),
    },
  };
});

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
// DIAGNOSTIC ONLY: capture a real JS stack the instant React logs the
// "Maximum update depth" warning, so we can see which of our own functions
// was on the call stack at that moment (React's own console.error for this
// warning carries no component stack in this reporter's output).
const realConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('Maximum update depth')) {
    // eslint-disable-next-line no-console
    console.log('DIAG STACK AT WARNING:\n' + new Error().stack);
  }
  realConsoleError(...args);
};

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

const makePage = (overrides: Record<string, any> = {}) => ({
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
  ...overrides,
});

const getUpdateHandler = () => {
  const call = editorMock.on.mock.calls.find((c: unknown[]) => c[0] === 'update');
  return call?.[1] as (() => void) | undefined;
};

describe('NotebookContent — MW-08 UX acceptance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mobileMock.mockReturnValue(false);
    apiMock.getNotebookPages.mockResolvedValue([]);
    apiMock.notebookGetAIProposals.mockResolvedValue([]);
    apiMock.updateNotebookPage.mockResolvedValue({});
    apiMock.getOrphanedNotebookPageIds.mockResolvedValue([]);
    editorMock.getJSON.mockReturnValue({ type: 'doc', content: [] });
  });

  it('shows Saving while a save request is in flight, and Saved only after the backend responds', async () => {
    vi.useFakeTimers();
    try {
      apiMock.getNotebookPages.mockResolvedValue([makePage({ id: 'note-1', title: 'Note 1' })]);

      let resolveSave: ((value: unknown) => void) | undefined;
      apiMock.updateNotebookPage.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSave = resolve;
          })
      );

      editorMock.getJSON.mockReturnValue({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Edited body' }] }],
      });

      const { getByTestId } = renderWithRouter(<NotebookContent searchQuery="" />);

      await vi.waitFor(() => {
        expect(apiMock.getNotebookPages).toHaveBeenCalled();
        expect(editorMock.on).toHaveBeenCalledWith('update', expect.any(Function));
      });

      const updateHandler = getUpdateHandler();
      expect(updateHandler).toBeDefined();

      // Trigger an edit and let the 350ms autosave debounce elapse — this is
      // when persistNotebookDraft actually fires and the request starts.
      await act(async () => {
        updateHandler?.();
        await vi.advanceTimersByTimeAsync(400);
      });

      expect(apiMock.updateNotebookPage).toHaveBeenCalledTimes(1);

      // The request is still pending (we haven't resolved it yet) — the
      // indicator must show "Saving…" and must NOT show "Saved" prematurely.
      const saveStateEl = getByTestId('notebook-save-state');
      expect(saveStateEl.textContent).toContain('Saving');
      expect(saveStateEl.textContent).not.toContain('Saved');

      // Now let the backend respond.
      await act(async () => {
        resolveSave?.({ updatedAt: '2026-03-28T10:05:00.000Z' });
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(getByTestId('notebook-save-state').textContent).toContain('Saved');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not reset the editor (and lose the cursor) after its own successful autosave, but still resyncs on a genuine page switch', async () => {
    vi.useFakeTimers();
    try {
      apiMock.getNotebookPages.mockResolvedValue([
        makePage({
          id: 'note-1',
          title: 'Note One',
          contentJson: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Original one' }] }],
          },
        }),
        makePage({
          id: 'note-2',
          title: 'Note Two',
          contentJson: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Original two' }] }],
          },
        }),
      ]);
      apiMock.updateNotebookPage.mockResolvedValue({ updatedAt: '2026-03-28T10:05:00.000Z' });

      editorMock.getJSON.mockReturnValue({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Edited one' }] }],
      });

      const { getByText } = renderWithRouter(<NotebookContent searchQuery="" />);

      await vi.waitFor(() => {
        expect(apiMock.getNotebookPages).toHaveBeenCalled();
        expect(editorMock.on).toHaveBeenCalledWith('update', expect.any(Function));
      });

      // Initial mount syncs note-1's content into the editor at least once.
      const initialSyncCalls = editorMock.commands.setContent.mock.calls.length;
      expect(initialSyncCalls).toBeGreaterThan(0);

      const updateHandler = getUpdateHandler();
      await act(async () => {
        updateHandler?.();
        await vi.advanceTimersByTimeAsync(400);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(apiMock.updateNotebookPage).toHaveBeenCalledTimes(1);
      // The successful autosave bumped activePage.updatedAt (to advance the
      // optimistic-lock token for the next save), but the editor already
      // shows this exact content — setContent must NOT be called again, or
      // the user's cursor would jump to the start of the document every
      // time an autosave lands while they keep typing.
      expect(editorMock.commands.setContent.mock.calls.length).toBe(initialSyncCalls);

      // Switching to a different note is a GENUINE change — it must resync.
      await act(async () => {
        getByText('Note Two').click();
      });
      expect(editorMock.commands.setContent.mock.calls.length).toBeGreaterThan(initialSyncCalls);
      const afterSwitchToTwoCalls = editorMock.commands.setContent.mock.calls.length;

      // Switching BACK to note-1 must also resync — it must not be silently
      // skipped just because note-1's updatedAt still matches its own last
      // self-save marker from before the switch (the editor currently shows
      // note-2's content and must be reloaded).
      await act(async () => {
        getByText('Note One').click();
      });
      expect(editorMock.commands.setContent.mock.calls.length).toBeGreaterThan(afterSwitchToTwoCalls);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows an explicit Save failed state (not a silent swallow) on a generic save error, and recovers on the next edit', async () => {
    vi.useFakeTimers();
    try {
      apiMock.getNotebookPages.mockResolvedValue([makePage({ id: 'note-1', title: 'Note 1' })]);
      // A generic (non-409) failure — network/5xx — must land in the 'error'
      // branch of persistNotebookDraft's catch, not be mistaken for a conflict.
      apiMock.updateNotebookPage.mockRejectedValueOnce(new Error('Network error'));

      editorMock.getJSON.mockReturnValue({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Edited body' }] }],
      });

      const { getByTestId, queryByText } = renderWithRouter(<NotebookContent searchQuery="" />);

      await vi.waitFor(() => {
        expect(apiMock.getNotebookPages).toHaveBeenCalled();
        expect(editorMock.on).toHaveBeenCalledWith('update', expect.any(Function));
      });

      const updateHandler = getUpdateHandler();

      await act(async () => {
        updateHandler?.();
        await vi.advanceTimersByTimeAsync(400);
        // Flush the rejected-promise microtask chain under fake timers.
        await Promise.resolve();
        await Promise.resolve();
      });

      const saveStateEl = getByTestId('notebook-save-state');
      expect(saveStateEl.textContent).toContain('Save failed');
      expect(saveStateEl.textContent).not.toContain('Saved');
      // A generic error must never be confused with a conflict — no
      // Reload/Save-mine-anyway (those are conflict-only recovery actions).
      // NOTE: this used to also assert `getByRole('alert')` throws (no alert
      // role anywhere), which held back when the conflict banner was the
      // only thing that could ever set role="alert". NotebookRightRail.tsx
      // now legitimately gives the save-status element itself
      // `role="alert"` on saveState === 'error' too (a11y: a real save
      // failure is announce-worthy) — a second, correct use of the role,
      // not a regression — so a blanket "no alert" check would now fail on
      // the very save-failed banner this test is asserting exists. Scoped
      // the check to what actually distinguishes "conflict" from "generic
      // error": the conflict-only recovery actions.
      expect(queryByText('Reload')).toBeNull();
      expect(queryByText('Save mine anyway')).toBeNull();

      // Retry: the next successful save must clear the error state, proving
      // 'error' isn't a sticky dead-end the user can't recover from.
      apiMock.updateNotebookPage.mockResolvedValueOnce({
        updatedAt: '2026-03-28T10:06:00.000Z',
      });
      await act(async () => {
        updateHandler?.();
        await vi.advanceTimersByTimeAsync(400);
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(getByTestId('notebook-save-state').textContent).toContain('Saved');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows a persistent conflict banner with Reload/retry, and never overwrites the edit silently', async () => {
    vi.useFakeTimers();
    try {
      apiMock.getNotebookPages.mockResolvedValue([makePage({ id: 'note-1', title: 'Note 1' })]);

      const serverPage = makePage({
        id: 'note-1',
        title: 'Server-side edit',
        contentJson: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Someone else changed this' }] }],
        },
        contentText: 'Someone else changed this',
        updatedAt: '2026-03-28T10:10:00.000Z',
      });

      // Matches the REAL contract: `handleResponse` (baseClient.ts) sets
      // `err.data` to the full parsed response body, and the v8 conflict
      // route (server/src/routes/v8/my-work.routes.ts) replies with
      // `{ error, code, data: freshRow, meta }` — the fresh row is nested one
      // level deeper than `err.data`. A flat `data: serverPage` here would
      // silently hide the real "reads err.data as the row itself" bug.
      apiMock.updateNotebookPage.mockRejectedValue({
        status: 409,
        code: 'NOTEBOOK_PAGE_CONFLICT',
        data: {
          error: 'Page was modified elsewhere',
          code: 'NOTEBOOK_PAGE_CONFLICT',
          data: serverPage,
          meta: { version: 'v8' },
        },
      });

      const localContent = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'My local edit' }] }],
      };
      editorMock.getJSON.mockReturnValue(localContent);

      const { getByTestId, getByRole, getByText } = renderWithRouter(<NotebookContent searchQuery="" />);

      await vi.waitFor(() => {
        expect(apiMock.getNotebookPages).toHaveBeenCalled();
        expect(editorMock.on).toHaveBeenCalledWith('update', expect.any(Function));
      });

      const updateHandler = getUpdateHandler();
      expect(updateHandler).toBeDefined();

      await act(async () => {
        updateHandler?.();
        await vi.advanceTimersByTimeAsync(400);
        // Flush the rejected-promise microtask chain under fake timers.
        await Promise.resolve();
        await Promise.resolve();
      });

      const banner = getByRole('alert');
      expect(banner.textContent).toContain(
        'This page was changed elsewhere. Your edits were not overwritten.'
      );
      expect(getByText('Reload')).toBeTruthy();
      expect(getByText('Save mine anyway')).toBeTruthy();

      // The locally-edited content must NOT have been silently overwritten —
      // setContent should not have been called with the server's content.
      expect(editorMock.commands.setContent).not.toHaveBeenCalledWith(
        serverPage.contentJson,
        expect.anything()
      );

      // The save-state pill itself must not simultaneously claim "Saved".
      expect(getByTestId('notebook-save-state').textContent).not.toContain('Saved');
    } finally {
      vi.useRealTimers();
    }
  });

  it('Reload in the conflict banner loads the fresh server content', async () => {
    vi.useFakeTimers();
    try {
      apiMock.getNotebookPages.mockResolvedValue([makePage({ id: 'note-1', title: 'Note 1' })]);

      const serverPage = makePage({
        id: 'note-1',
        title: 'Server-side edit',
        contentJson: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Someone else changed this' }] }],
        },
        contentText: 'Someone else changed this',
        updatedAt: '2026-03-28T10:10:00.000Z',
      });

      // Matches the REAL contract: `handleResponse` (baseClient.ts) sets
      // `err.data` to the full parsed response body, and the v8 conflict
      // route (server/src/routes/v8/my-work.routes.ts) replies with
      // `{ error, code, data: freshRow, meta }` — the fresh row is nested one
      // level deeper than `err.data`. A flat `data: serverPage` here would
      // silently hide the real "reads err.data as the row itself" bug.
      apiMock.updateNotebookPage.mockRejectedValue({
        status: 409,
        code: 'NOTEBOOK_PAGE_CONFLICT',
        data: {
          error: 'Page was modified elsewhere',
          code: 'NOTEBOOK_PAGE_CONFLICT',
          data: serverPage,
          meta: { version: 'v8' },
        },
      });

      editorMock.getJSON.mockReturnValue({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'My local edit' }] }],
      });

      const { getByRole, getByText, getByDisplayValue } = renderWithRouter(
        <NotebookContent searchQuery="" />
      );

      await vi.waitFor(() => {
        expect(apiMock.getNotebookPages).toHaveBeenCalled();
        expect(editorMock.on).toHaveBeenCalledWith('update', expect.any(Function));
      });

      const updateHandler = getUpdateHandler();

      await act(async () => {
        updateHandler?.();
        await vi.advanceTimersByTimeAsync(400);
        await Promise.resolve();
        await Promise.resolve();
      });

      // Conflict banner is up.
      getByRole('alert');
      editorMock.commands.setContent.mockClear();

      await act(async () => {
        getByText('Reload').click();
      });

      // handleReloadFromConflict merges the fresh server page into `pages`,
      // which bumps activePage.updatedAt and re-triggers the "sync editor
      // with fresher server content" effect (NotebookContent.tsx ~1094-1118).
      expect(editorMock.commands.setContent).toHaveBeenCalledWith(serverPage.contentJson, {
        emitUpdate: false,
      });
      // The title input is driven by the same effect (setTitle(activePage.title)).
      expect(getByDisplayValue('Server-side edit')).toBeTruthy();

      // Conflict banner must be gone — handleReloadFromConflict resets saveState.
      expect(() => getByRole('alert')).toThrow();
    } finally {
      vi.useRealTimers();
    }
  });

  // DEC-26 (FAZA 2, fixed — see git history for the prior PRODUCT_DO_DECYZJA
  // note this replaced): own pages now render "You" (i18n key
  // notebook.rightRail.ownerYou, PL "Ty"/EN "You") instead of the current
  // user's own real name, which used to show even on your own note. A
  // foreign page shows the REAL owner name the server now resolves
  // (server/src/routes/v8/my-work.routes.ts buildNotebookSelectFields —
  // ownerDisplayName, COALESCE(first+last name, email)) via
  // activePage.ownerDisplayName, simulated here the same way every other
  // server field is simulated in this suite: on the mocked getNotebookPages
  // response. The generic "Owner identity unavailable" copy
  // (NotebookRightRail.tsx) is reserved for the true no-data case — a page
  // whose owner is known but whose name the server could not resolve
  // (ownerDisplayName omitted) — asserted separately below so that state
  // stays distinguishable from both "You" and a real name, not collapsed
  // into either.
  it('shows the owner as You for your own page and Another user for someone else\'s', async () => {
    apiMock.getNotebookPages.mockResolvedValue([
      makePage({ id: 'note-mine', title: 'Mine', ownerUserId: 'user-1' }),
      makePage({
        id: 'note-theirs',
        title: 'Theirs',
        ownerUserId: 'user-2',
        ownerDisplayName: 'Another user',
      }),
    ]);

    const { getByTestId, getByText } = renderWithRouter(<NotebookContent searchQuery="" />);

    await waitFor(() => {
      expect(apiMock.getNotebookPages).toHaveBeenCalled();
    });

    // Auto-select lands on the first page ('note-mine', owned by 'user-1',
    // which matches the mocked currentUser.id) — NotebookContent.tsx
    // fetchPages: setActiveId((prev) => prev || arr?.[0]?.id || null).
    await waitFor(() => {
      expect(getByTestId('notebook-owner-state').textContent).toContain('You');
    });
    // Own page must never show the current user's own real name.
    expect(getByTestId('notebook-owner-state').textContent).not.toContain('Piotr');

    await act(async () => {
      getByText('Theirs').click();
    });

    await waitFor(() => {
      expect(getByTestId('notebook-owner-state').textContent).toContain('Another user');
    });
  });

  it('falls back to the honest "unavailable" state when the owner is known but unnamed', async () => {
    apiMock.getNotebookPages.mockResolvedValue([
      makePage({
        id: 'note-unnamed-owner',
        title: 'Unnamed owner',
        ownerUserId: 'user-3',
        // No ownerDisplayName — simulates the server being unable to resolve
        // a name for a real, known owner (e.g. deleted account).
      }),
    ]);

    const { getByTestId } = renderWithRouter(<NotebookContent searchQuery="" />);

    await waitFor(() => {
      expect(getByTestId('notebook-owner-state').textContent).toContain(
        'Owner identity unavailable'
      );
    });
    const text = getByTestId('notebook-owner-state').textContent;
    expect(text).not.toContain('You');
    expect(text).not.toContain('Another user');
  });

  // L-03 (Consolidated right rail): the old inline status strip showed one
  // dynamic prose string ("Private" / "Shared with project"). The current,
  // accepted rail design (NotebookRightRail.ownerContract.test.ts locks in
  // its structure) instead renders a Private/Project TOGGLE BUTTON PAIR —
  // both labels ("Private", "Project") are always present in the DOM; only
  // aria-pressed changes with the active page's visibility. A textContent
  // substring check against a container can never distinguish that (both
  // words are always there), so this test's original assertion technique
  // was structurally incompatible with the new UI, not just using stale
  // copy. Rewritten to assert the real signal: which button carries
  // aria-pressed="true" for the active page. The underlying capability
  // (visibility read + toggle) is unchanged and still verified elsewhere by
  // 'toggles visibility' (M04) style tests.
  it('shows Private vs Project visibility honestly via aria-pressed', async () => {
    apiMock.getNotebookPages.mockResolvedValue([
      makePage({ id: 'note-private', title: 'Private note', visibility: 'private' }),
      makePage({ id: 'note-shared', title: 'Shared note', visibility: 'project', projectId: 'proj-1' }),
    ]);

    const { getByRole, getByText } = renderWithRouter(<NotebookContent searchQuery="" />);

    await waitFor(() => {
      expect(apiMock.getNotebookPages).toHaveBeenCalled();
    });

    // Auto-select lands on 'note-private' first.
    await waitFor(() => {
      expect(getByRole('button', { name: 'Private' })).toHaveAttribute('aria-pressed', 'true');
      expect(getByRole('button', { name: 'Project' })).toHaveAttribute('aria-pressed', 'false');
    });

    await act(async () => {
      getByText('Shared note').click();
    });

    await waitFor(() => {
      expect(getByRole('button', { name: 'Private' })).toHaveAttribute('aria-pressed', 'false');
      expect(getByRole('button', { name: 'Project' })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('on mobile, only the page list is shown until a note is opened, then only the editor, with a working back button', async () => {
    mobileMock.mockReturnValue(true);
    apiMock.getNotebookPages.mockResolvedValue([
      makePage({ id: 'note-1', title: 'First page' }),
      makePage({ id: 'note-2', title: 'Second page' }),
    ]);

    const { getByText, getByTestId, queryByTestId, queryByText, getByLabelText } =
      renderWithRouter(<NotebookContent searchQuery="" />);

    // Before the page list has loaded (activePage is still null), the sidebar
    // is the only panel mounted on mobile — the editor container is not
    // mounted at all (NotebookContent.tsx: `{(!isMobile || !mobileShowList) && (...)}`).
    expect(queryByTestId('editor-content')).toBeNull();
    expect(getByTestId('notebook-new-page-button')).toBeTruthy();

    // NotebookContent auto-selects the first fetched page
    // (fetchPages: setActiveId((prev) => prev || arr?.[0]?.id || null)), and a
    // dedicated effect (`if (isMobile && activePage) setMobileShowList(false)`)
    // switches mobile straight to that page's editor as soon as it loads —
    // there is no persistent "nothing open yet" list-only state once the
    // notebook has any existing pages. This test exercises what actually
    // happens once that settles, plus the manual list<->editor toggle.
    await waitFor(() => {
      expect(getByTestId('editor-content')).toBeTruthy();
    });
    expect(queryByText('First page')).toBeNull(); // list is hidden now
    const backButton = getByLabelText('All notes');
    expect(backButton).toBeTruthy();

    // Back button returns to the list WITHOUT changing which page is active.
    await act(async () => {
      backButton.click();
    });
    expect(queryByTestId('editor-content')).toBeNull();
    expect(getByText('First page')).toBeTruthy();
    expect(getByText('Second page')).toBeTruthy();
    expect(queryByText('All notes')).toBeNull();

    // Opening a different page from the list shows its editor and hides the list.
    await act(async () => {
      getByText('Second page').click();
    });
    await waitFor(() => {
      expect(getByTestId('editor-content')).toBeTruthy();
    });
    expect(queryByText('Second page')).toBeNull();
    expect(getByLabelText('All notes')).toBeTruthy();

    // Back again returns to the list.
    await act(async () => {
      getByLabelText('All notes').click();
    });
    expect(queryByTestId('editor-content')).toBeNull();
    expect(getByText('First page')).toBeTruthy();
    expect(getByText('Second page')).toBeTruthy();
  });

  it('on desktop, list and editor render together regardless of mobile-only chrome', async () => {
    mobileMock.mockReturnValue(false);
    apiMock.getNotebookPages.mockResolvedValue([
      makePage({ id: 'note-1', title: 'First page' }),
      makePage({ id: 'note-2', title: 'Second page' }),
    ]);

    const { getByText, getAllByText, getByTestId, queryByLabelText, queryByText } =
      renderWithRouter(<NotebookContent searchQuery="" />);

    await waitFor(() => {
      expect(apiMock.getNotebookPages).toHaveBeenCalled();
    });

    // Both the page list and the editor area are present simultaneously —
    // desktop never hides either behind the mobile toggle.
    await waitFor(() => {
      expect(getByTestId('editor-content')).toBeTruthy();
    });
    // DEC-69: the SPEC-A right rail (desktop-only) now also shows the active
    // page's title in its own header, alongside the sidebar list item — so
    // "First page" (the active page) legitimately appears twice on screen.
    // "Second page" (not active) still appears exactly once, in the list.
    expect(getAllByText('First page').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Second page')).toBeTruthy();

    // The mobile-only back-to-list chrome must not be present on desktop.
    expect(queryByLabelText('All notes')).toBeNull();
    expect(queryByText('All notes')).toBeNull();

    // Switching the active page keeps both panels mounted.
    await act(async () => {
      getByText('Second page').click();
    });
    await waitFor(() => {
      expect(apiMock.getNotebookPages).toHaveBeenCalled();
    });
    // "Second page" is now the active page, so — same rail-header reason as
    // above — it legitimately renders twice (sidebar + rail header).
    expect(getByText('First page')).toBeTruthy();
    expect(getAllByText('Second page').length).toBeGreaterThanOrEqual(1);
    expect(getByTestId('editor-content')).toBeTruthy();
    expect(queryByLabelText('All notes')).toBeNull();
  });
});
