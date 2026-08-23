/**
 * M01-011 — Canvas save status and conflict recovery.
 *
 * Two defects this covers:
 *
 * 1. The save state machine existed but its label was rendered only inside the
 *    diagnostics popover, so an open document never showed whether it was saved,
 *    and nothing was announced to assistive tech.
 *
 * 2. A 409 CANVAS_DRAFT_CONFLICT was "handled" by re-reading the server's
 *    updatedAt and immediately re-saving the local content under it — silently
 *    destroying whatever the other writer had saved.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkCanvasDocumentPanel } from '../../../src/components/AIChat/WorkCanvasDocumentPanel';

const SERVER_VERSION = {
  id: 'draft-1',
  draftId: 'draft-1',
  title: 'Their title',
  contentMd: '# Their content',
  updatedAt: '2026-08-04T10:05:00.000Z',
  saveState: 'saved',
  lifecycleState: 'draft',
  markdownProjectionStatus: 'synced',
};

beforeEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
  window.localStorage.setItem('workCanvas.viewMode.v2', 'document');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Saves succeed; the panel reports when and stays quiet about conflicts. */
function wireSavingFetch() {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.startsWith('/api/work-canvas/drafts') && (init?.method === 'POST' || init?.method === 'PUT')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { ...SERVER_VERSION, title: 'Company Work Note' } }),
      } as Response;
    }
    return { ok: true, status: 200, json: async () => ({ data: SERVER_VERSION }) } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function wireDeferredSaveFetch() {
  let resolveWrite: ((value: Response) => void) | null = null;
  const writePromise = new Promise<Response>((resolve) => {
    resolveWrite = resolve;
  });
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const isWrite = init?.method === 'POST' || init?.method === 'PUT';
    if (String(url).startsWith('/api/work-canvas/drafts') && isWrite) return writePromise;
    return { ok: true, status: 200, json: async () => ({ data: ORIGINAL_VERSION }) } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return {
    resolveWrite: () =>
      resolveWrite?.({
        ok: true,
        status: 200,
        json: async () => ({ data: { ...ORIGINAL_VERSION, updatedAt: '2026-08-04T10:10:00.000Z' } }),
      } as Response),
  };
}

function wireFailureThenSuccessFetch() {
  let writes = 0;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const isWrite = init?.method === 'POST' || init?.method === 'PUT';
    if (String(url).startsWith('/api/work-canvas/drafts') && isWrite) {
      writes += 1;
      if (writes === 1) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: 'temporary storage failure' }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { ...ORIGINAL_VERSION, updatedAt: '2026-08-04T10:11:00.000Z' } }),
      } as Response;
    }
    return { ok: true, status: 200, json: async () => ({ data: ORIGINAL_VERSION }) } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** First write is rejected as a conflict; the GET returns the other version. */
function wireConflictFetch() {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.startsWith('/api/work-canvas/drafts') && (init?.method === 'POST' || init?.method === 'PUT')) {
      return {
        ok: false,
        status: 409,
        json: async () => ({ code: 'CANVAS_DRAFT_CONFLICT', error: 'Draft changed' }),
      } as Response;
    }
    return { ok: true, status: 200, json: async () => ({ data: SERVER_VERSION }) } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function writeCount(fetchMock: ReturnType<typeof vi.fn>): number {
  return fetchMock.mock.calls.filter(
    ([, init]) => init?.method === 'POST' || init?.method === 'PUT'
  ).length;
}

function writeCalls(fetchMock: ReturnType<typeof vi.fn>): RequestInit[] {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method === 'POST' || init?.method === 'PUT')
    .map(([, init]) => init as RequestInit);
}

/** Body of the n-th write (0-based), parsed. */
function writeBody(fetchMock: ReturnType<typeof vi.fn>, index: number): any {
  const init = writeCalls(fetchMock)[index];
  return JSON.parse(String(init?.body ?? '{}'));
}

/**
 * Conflict then recovery, with DISTINCT tokens on the two sides.
 *
 * `ORIGINAL_VERSION.updatedAt` is what the panel hydrates with (and what the
 * first, rejected write carries). After the 409 the GET returns
 * `SERVER_VERSION` with a NEWER token — so a retry that re-sends the hydrated
 * token (the stale-closure defect) is detectable in the request body, not only
 * in the UI.
 */
const ORIGINAL_VERSION = {
  id: 'draft-1',
  draftId: 'draft-1',
  title: 'Company Work Note',
  contentMd: '# My content',
  updatedAt: '2026-08-04T09:00:00.000Z',
  saveState: 'saved',
  lifecycleState: 'draft',
  markdownProjectionStatus: 'synced',
};

/**
 * The mock ENFORCES optimistic concurrency the way the server does: a write
 * whose `baseUpdatedAt` is not the current server token is rejected with 409.
 * Without that, a retry carrying the stale token would "succeed" here and the
 * UI assertions below would be green on broken code.
 */
function wireConflictThenAcceptFetch() {
  let serverVersion: Record<string, unknown> = ORIGINAL_VERSION;
  let otherWriterLanded = false;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    const isWrite = init?.method === 'POST' || init?.method === 'PUT';
    if (u.startsWith('/api/work-canvas/drafts') && isWrite) {
      const body = JSON.parse(String(init?.body ?? '{}'));
      if (!otherWriterLanded) {
        // Someone else saved between our load and this write.
        otherWriterLanded = true;
        serverVersion = SERVER_VERSION;
        return {
          ok: false,
          status: 409,
          json: async () => ({ code: 'CANVAS_DRAFT_CONFLICT', error: 'Draft changed' }),
        } as Response;
      }
      if (body.baseUpdatedAt !== serverVersion.updatedAt) {
        return {
          ok: false,
          status: 409,
          json: async () => ({ code: 'CANVAS_DRAFT_CONFLICT', error: 'Draft changed' }),
        } as Response;
      }
      serverVersion = {
        ...SERVER_VERSION,
        title: body.title,
        contentMd: body.contentMd,
        updatedAt: '2026-08-04T10:09:00.000Z',
      };
      const saved = serverVersion;
      return { ok: true, status: 200, json: async () => ({ data: saved }) } as Response;
    }
    const current = serverVersion;
    return { ok: true, status: 200, json: async () => ({ data: current }) } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('M01-011 — Canvas save status', () => {
  it('shows the save state on the document, not only in diagnostics', async () => {
    wireSavingFetch();
    render(<WorkCanvasDocumentPanel conversationId="conv-1" initialDraftId="draft-1" />);

    const status = await screen.findByTestId('canvas-save-status');
    expect(status).toBeInTheDocument();
    // Announced, so the state is not silent for screen-reader users.
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('role', 'status');
  });

  it('reports when the document was last saved', async () => {
    wireSavingFetch();
    const user = userEvent.setup();
    render(<WorkCanvasDocumentPanel conversationId="conv-1" initialDraftId="draft-1" />);

    const title = await screen.findByLabelText('Canvas document title');
    await user.clear(title);
    await user.type(title, 'Edited title');
    await user.tab(); // blur triggers persistDraft

    await waitFor(() => expect(screen.getByTestId('canvas-last-saved-at')).toBeInTheDocument());
    expect(screen.getByTestId('canvas-save-status')).toHaveTextContent(/Saved/i);
  });

  it('shows unsaved then saving then saved without adding a second header row', async () => {
    const deferred = wireDeferredSaveFetch();
    const user = userEvent.setup();
    render(<WorkCanvasDocumentPanel conversationId="conv-1" initialDraftId="draft-1" />);

    const title = await screen.findByLabelText('Canvas document title');
    await waitFor(() => expect(title).toHaveValue(ORIGINAL_VERSION.title));
    await user.clear(title);
    await user.type(title, 'Client memo');
    expect(screen.getByTestId('canvas-save-status')).toHaveTextContent(/Unsaved changes/i);

    await user.tab();
    await waitFor(() => expect(screen.getByTestId('canvas-save-status')).toHaveTextContent(/Saving/i));
    expect(screen.getByTestId('canvas-header')).toHaveClass('h-[42px]', 'flex-nowrap');

    deferred.resolveWrite();
    await waitFor(() => expect(screen.getByTestId('canvas-save-status')).toHaveTextContent(/Saved/i));
  });

  it('keeps failed state visible and Retry uses the same save path to recover', async () => {
    const fetchMock = wireFailureThenSuccessFetch();
    const user = userEvent.setup();
    render(<WorkCanvasDocumentPanel conversationId="conv-1" initialDraftId="draft-1" />);

    const title = await screen.findByLabelText('Canvas document title');
    await waitFor(() => expect(title).toHaveValue(ORIGINAL_VERSION.title));
    await user.clear(title);
    await user.type(title, 'Retry this memo');
    await user.tab();

    await waitFor(() => expect(screen.getByTestId('canvas-save-status')).toHaveTextContent(/Save failed/i));
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(writeCount(fetchMock)).toBe(2));
    await waitFor(() => expect(screen.getByTestId('canvas-save-status')).toHaveTextContent(/Saved/i));
  });
});

describe('M01-011 — Canvas conflict recovery', () => {
  it('surfaces a conflict instead of silently overwriting the other version', async () => {
    const fetchMock = wireConflictFetch();
    const user = userEvent.setup();
    render(<WorkCanvasDocumentPanel conversationId="conv-1" initialDraftId="draft-1" />);

    const title = await screen.findByLabelText('Canvas document title');
    await user.clear(title);
    await user.type(title, 'My title');
    await user.tab();

    await waitFor(() => expect(screen.getByTestId('canvas-conflict-banner')).toBeInTheDocument());

    // The old code answered a 409 with a second write that clobbered the other
    // version. Exactly one write attempt may have been made.
    expect(writeCount(fetchMock)).toBe(1);
    expect(screen.getByTestId('canvas-save-status')).toHaveTextContent(/not saved|Changed elsewhere/i);
  });

  it('keeps the local edit in the editor while the conflict is unresolved', async () => {
    wireConflictFetch();
    const user = userEvent.setup();
    render(<WorkCanvasDocumentPanel conversationId="conv-1" initialDraftId="draft-1" />);

    const title = await screen.findByLabelText('Canvas document title');
    await user.clear(title);
    await user.type(title, 'My title');
    await user.tab();

    await screen.findByTestId('canvas-conflict-banner');
    // Nothing was discarded behind the user's back.
    expect(screen.getByLabelText('Canvas document title')).toHaveValue('My title');
  });

  it('offers both recovery choices', async () => {
    wireConflictFetch();
    const user = userEvent.setup();
    render(<WorkCanvasDocumentPanel conversationId="conv-1" initialDraftId="draft-1" />);

    const title = await screen.findByLabelText('Canvas document title');
    await user.clear(title);
    await user.type(title, 'My title');
    await user.tab();

    await screen.findByTestId('canvas-conflict-banner');
    expect(screen.getByTestId('canvas-conflict-keep-mine')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-conflict-load-theirs')).toBeInTheDocument();
  });

  it('loading the other version replaces the editor content on request', async () => {
    wireConflictFetch();
    const user = userEvent.setup();
    render(<WorkCanvasDocumentPanel conversationId="conv-1" initialDraftId="draft-1" />);

    const title = await screen.findByLabelText('Canvas document title');
    await user.clear(title);
    await user.type(title, 'My title');
    await user.tab();

    await screen.findByTestId('canvas-conflict-banner');
    await user.click(screen.getByTestId('canvas-conflict-load-theirs'));

    await waitFor(() =>
      expect(screen.getByLabelText('Canvas document title')).toHaveValue('Their title')
    );
    expect(screen.queryByTestId('canvas-conflict-banner')).not.toBeInTheDocument();
  });

  /**
   * DEFECT-1 — the retry used to go out through a `persistDraft` closure that
   * still held the PRE-conflict `updatedAt`, so it 409'd again forever. The
   * assertion is on the actual request body, because the UI looked identical
   * either way while the save silently never landed.
   */
  it('keeping mine retries with the conflict token, not the stale one', async () => {
    const fetchMock = wireConflictThenAcceptFetch();
    const user = userEvent.setup();
    render(<WorkCanvasDocumentPanel conversationId="conv-1" initialDraftId="draft-1" />);

    const title = await screen.findByLabelText('Canvas document title');
    await waitFor(() => expect(title).toHaveValue(ORIGINAL_VERSION.title));
    await user.clear(title);
    await user.type(title, 'My title');
    await user.tab();

    await screen.findByTestId('canvas-conflict-banner');
    // The rejected write carried the token the panel hydrated with.
    expect(writeBody(fetchMock, 0).baseUpdatedAt).toBe(ORIGINAL_VERSION.updatedAt);

    await user.click(screen.getByTestId('canvas-conflict-keep-mine'));

    await waitFor(() => expect(writeCount(fetchMock)).toBeGreaterThanOrEqual(2));
    const retry = writeBody(fetchMock, 1);
    // The token the server reported in the conflict, NOT the stale one.
    expect(retry.baseUpdatedAt).toBe(SERVER_VERSION.updatedAt);
    expect(retry.baseUpdatedAt).not.toBe(ORIGINAL_VERSION.updatedAt);
    // …carrying the LOCAL edit, which is the whole point of "keep mine".
    expect(retry.title).toBe('My title');
    expect(retry.contentMd).toBe(ORIGINAL_VERSION.contentMd);
    expect(retry.content).toBe(ORIGINAL_VERSION.contentMd);
  });

  it('reports the document as saved once keep-mine lands', async () => {
    wireConflictThenAcceptFetch();
    const user = userEvent.setup();
    render(<WorkCanvasDocumentPanel conversationId="conv-1" initialDraftId="draft-1" />);

    const title = await screen.findByLabelText('Canvas document title');
    await waitFor(() => expect(title).toHaveValue(ORIGINAL_VERSION.title));
    await user.clear(title);
    await user.type(title, 'My title');
    await user.tab();

    await screen.findByTestId('canvas-conflict-banner');
    await user.click(screen.getByTestId('canvas-conflict-keep-mine'));

    await waitFor(() =>
      expect(screen.queryByTestId('canvas-conflict-banner')).not.toBeInTheDocument()
    );
    await waitFor(() => expect(screen.getByTestId('canvas-last-saved-at')).toBeInTheDocument());
    expect(screen.getByTestId('canvas-save-status')).toHaveTextContent(/Saved/i);
    expect(screen.getByLabelText('Canvas document title')).toHaveValue('My title');
  });

  /**
   * DEFECT-2 — "load theirs" only wrote React state, so the live editor kept
   * showing the user's own text. Asserted in `md` mode, where the editor is a
   * real textarea whose value can be read back.
   */
  it('loading the other version puts the server title AND content in the editor', async () => {
    window.localStorage.setItem('workCanvas.viewMode.v2', 'md');
    wireConflictThenAcceptFetch();
    const user = userEvent.setup();
    render(<WorkCanvasDocumentPanel conversationId="conv-1" initialDraftId="draft-1" />);

    const editor = await screen.findByTestId('canvas-md-view');
    await waitFor(() => expect(editor).toHaveValue(ORIGINAL_VERSION.contentMd));

    const title = await screen.findByLabelText('Canvas document title');
    await user.clear(title);
    await user.type(title, 'My title');
    await user.tab();

    await screen.findByTestId('canvas-conflict-banner');
    await user.click(screen.getByTestId('canvas-conflict-load-theirs'));

    await waitFor(() =>
      expect(screen.getByLabelText('Canvas document title')).toHaveValue(SERVER_VERSION.title)
    );
    expect(screen.getByTestId('canvas-md-view')).toHaveValue(SERVER_VERSION.contentMd);
    expect(screen.queryByTestId('canvas-conflict-banner')).not.toBeInTheDocument();
    // Re-baselined: the panel must not consider the loaded version dirty.
    expect(screen.getByTestId('canvas-save-status')).toHaveTextContent(/Saved/i);
  });
});
