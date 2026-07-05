/**
 * B5 — coverage for DocumentCommentsPanel (Epic E6 comment-thread UI).
 *
 * The B5 branch shipped DocumentCommentsPanel.tsx + CommentThreadItem.tsx
 * without a component test. This backfills coverage for the thread
 * lifecycle exposed through the panel:
 *   - render of thread list from getDocumentStudioCommentThreads/-Counts;
 *   - reply (adds a reply to a thread);
 *   - resolve with an optional reason;
 *   - reopen a previously-resolved thread;
 *   - author-only soft-delete of a comment;
 *   - Open/Resolved/All filter;
 *   - live counters (filter tab labels + section header counts).
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Local i18n mock (overrides the global setup mock) — the component relies
// on `{{name}}` interpolation (i18next convention) for several strings
// (filter counts are rendered via plain JS, not t()), so a defaultValue
// passthrough with double-brace interpolation is enough here.
// `t` MUST be a stable reference across renders: DocumentCommentsPanel's
// `refresh` useCallback depends on `t`, and an unstable `t` would re-run the
// mount effect on every render (infinite refetch loop).
function stableT(key: string, arg?: string | Record<string, unknown>): string {
  const opts: Record<string, unknown> = typeof arg === 'string' ? { defaultValue: arg } : (arg ?? {});
  const template = typeof opts.defaultValue === 'string' ? (opts.defaultValue as string) : key;
  return template.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(opts[name] ?? ''));
}

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({ t: stableT }),
}));

const apiMocks = vi.hoisted(() => ({
  getDocumentStudioCommentThreads: vi.fn(),
  getDocumentStudioCommentCounts: vi.fn(),
  createDocumentStudioComment: vi.fn(),
  replyToDocumentStudioComment: vi.fn(),
  resolveDocumentStudioComment: vi.fn(),
  reopenDocumentStudioComment: vi.fn(),
  deleteDocumentStudioComment: vi.fn(),
}));

vi.mock('../../../src/components/DocumentStudio/api', () => apiMocks);

vi.mock('react-hot-toast', () => {
  const toast = { success: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() };
  return { toast, default: toast };
});

// Imported after the mocks above are registered.
/* eslint-disable import/first */
import { DocumentCommentsPanel } from '../../../src/components/DocumentStudio/DocumentCommentsPanel';
import type {
  DocumentCommentSectionCounts,
  DocumentCommentThread,
  DocumentSection,
} from '../../../src/components/DocumentStudio/types';
/* eslint-enable import/first */

const SECTIONS: DocumentSection[] = [
  {
    sectionId: 'sec-1',
    orderIndex: 0,
    level: 1,
    title: 'Executive summary',
    blocks: [],
    sourceRefs: [],
  },
] as unknown as DocumentSection[];

function makeThread(overrides: Partial<DocumentCommentThread> = {}): DocumentCommentThread {
  return {
    threadId: 'thread-1',
    artifactId: 'art-1',
    organizationId: 'org-1',
    anchor: { kind: 'document' },
    status: 'open',
    root: {
      commentId: 'comment-1',
      threadId: 'thread-1',
      artifactId: 'art-1',
      organizationId: 'org-1',
      anchor: { kind: 'document' },
      authorId: 'user-1',
      body: 'Please double-check the revenue figure.',
      status: 'open',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    replies: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as DocumentCommentThread;
}

function makeCounts(overrides: Partial<DocumentCommentSectionCounts> = {}): DocumentCommentSectionCounts {
  return {
    artifactId: 'art-1',
    organizationId: 'org-1',
    totalOpen: 1,
    totalResolved: 0,
    perSection: {},
    perBlock: {},
    ...overrides,
  };
}

function renderPanel(currentUserId = 'user-1'): void {
  render(
    <DocumentCommentsPanel artifactId="art-1" sections={SECTIONS} currentUserId={currentUserId} />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.getDocumentStudioCommentThreads.mockResolvedValue([makeThread()]);
  apiMocks.getDocumentStudioCommentCounts.mockResolvedValue(makeCounts());
});

describe('DocumentCommentsPanel (B5)', () => {
  it('renders the thread list from the API on mount', async () => {
    renderPanel();

    expect(await screen.findByTestId('document-comments-panel')).toBeInTheDocument();
    expect(
      screen.getByText('Please double-check the revenue figure.')
    ).toBeInTheDocument();
    expect(apiMocks.getDocumentStudioCommentThreads).toHaveBeenCalledWith('art-1');
    expect(apiMocks.getDocumentStudioCommentCounts).toHaveBeenCalledWith('art-1');
  });

  it('renders an empty state when there are no threads', async () => {
    apiMocks.getDocumentStudioCommentThreads.mockResolvedValue([]);
    apiMocks.getDocumentStudioCommentCounts.mockResolvedValue(makeCounts({ totalOpen: 0 }));
    renderPanel();

    expect(await screen.findByText('No comments yet.')).toBeInTheDocument();
  });

  it('adds a reply to a thread', async () => {
    apiMocks.replyToDocumentStudioComment.mockResolvedValue({
      commentId: 'comment-2',
      threadId: 'thread-1',
      authorId: 'user-1',
      body: 'Confirmed, fixed in v3.',
      status: 'open',
      createdAt: '2026-01-01T00:05:00.000Z',
      updatedAt: '2026-01-01T00:05:00.000Z',
      anchor: { kind: 'document' },
      artifactId: 'art-1',
      organizationId: 'org-1',
    });
    // After the reply, refresh() re-fetches threads — return the thread with the reply attached.
    apiMocks.getDocumentStudioCommentThreads
      .mockResolvedValueOnce([makeThread()])
      .mockResolvedValueOnce([
        makeThread({
          replies: [
            {
              commentId: 'comment-2',
              threadId: 'thread-1',
              authorId: 'user-1',
              body: 'Confirmed, fixed in v3.',
              status: 'open',
              createdAt: '2026-01-01T00:05:00.000Z',
              updatedAt: '2026-01-01T00:05:00.000Z',
              anchor: { kind: 'document' },
              artifactId: 'art-1',
              organizationId: 'org-1',
            },
          ],
        }),
      ]);

    renderPanel();
    await screen.findByTestId('comment-thread-thread-1');

    fireEvent.click(screen.getByTestId('comment-reply-open-thread-1'));
    fireEvent.change(screen.getByTestId('comment-reply-input-thread-1'), {
      target: { value: 'Confirmed, fixed in v3.' },
    });
    fireEvent.click(screen.getByTestId('comment-reply-send-thread-1'));

    await waitFor(() =>
      expect(apiMocks.replyToDocumentStudioComment).toHaveBeenCalledWith(
        'art-1',
        'comment-1',
        'Confirmed, fixed in v3.'
      )
    );
    expect(await screen.findByText('Confirmed, fixed in v3.')).toBeInTheDocument();
  });

  it('resolves a thread with a reason', async () => {
    apiMocks.resolveDocumentStudioComment.mockResolvedValue({
      commentId: 'comment-1',
      status: 'resolved',
    });
    apiMocks.getDocumentStudioCommentThreads
      .mockResolvedValueOnce([makeThread()])
      .mockResolvedValueOnce([
        makeThread({
          status: 'resolved',
          root: {
            ...makeThread().root,
            status: 'resolved',
            resolvedBy: 'user-1',
            resolveReason: 'Figure verified against ledger.',
          },
        }),
      ]);
    apiMocks.getDocumentStudioCommentCounts
      .mockResolvedValueOnce(makeCounts({ totalOpen: 1, totalResolved: 0 }))
      .mockResolvedValueOnce(makeCounts({ totalOpen: 0, totalResolved: 1 }));

    renderPanel();
    await screen.findByTestId('comment-thread-thread-1');

    fireEvent.click(screen.getByTestId('comment-resolve-open-thread-1'));
    fireEvent.change(screen.getByTestId('comment-resolve-reason-thread-1'), {
      target: { value: 'Figure verified against ledger.' },
    });
    fireEvent.click(screen.getByTestId('comment-resolve-confirm-thread-1'));

    await waitFor(() =>
      expect(apiMocks.resolveDocumentStudioComment).toHaveBeenCalledWith(
        'art-1',
        'comment-1',
        'Figure verified against ledger.'
      )
    );
    expect(await screen.findByText(/Figure verified against ledger\./)).toBeInTheDocument();
  });

  it('reopens a previously-resolved thread', async () => {
    const resolvedThread = makeThread({
      status: 'resolved',
      root: { ...makeThread().root, status: 'resolved', resolvedBy: 'user-1' },
    });
    apiMocks.getDocumentStudioCommentThreads
      .mockResolvedValueOnce([resolvedThread])
      .mockResolvedValueOnce([makeThread({ status: 'open' })]);
    apiMocks.getDocumentStudioCommentCounts
      .mockResolvedValueOnce(makeCounts({ totalOpen: 0, totalResolved: 1 }))
      .mockResolvedValueOnce(makeCounts({ totalOpen: 1, totalResolved: 0 }));
    apiMocks.reopenDocumentStudioComment.mockResolvedValue({ commentId: 'comment-1', status: 'open' });

    renderPanel();
    await screen.findByTestId('comment-thread-thread-1');
    expect(screen.getByText('Resolved')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('comment-reopen-thread-1'));

    await waitFor(() =>
      expect(apiMocks.reopenDocumentStudioComment).toHaveBeenCalledWith('art-1', 'comment-1')
    );
    await waitFor(() => expect(screen.getByText('Open')).toBeInTheDocument());
  });

  it('soft-deletes a comment (author-only)', async () => {
    apiMocks.deleteDocumentStudioComment.mockResolvedValue({
      commentId: 'comment-1',
      deletedAt: '2026-01-01T00:10:00.000Z',
    });
    apiMocks.getDocumentStudioCommentThreads
      .mockResolvedValueOnce([makeThread()])
      .mockResolvedValueOnce([
        makeThread({
          root: { ...makeThread().root, deletedAt: '2026-01-01T00:10:00.000Z', body: '' },
        }),
      ]);

    renderPanel('user-1');
    await screen.findByTestId('comment-thread-thread-1');

    fireEvent.click(screen.getByTestId('comment-delete-comment-1'));

    await waitFor(() =>
      expect(apiMocks.deleteDocumentStudioComment).toHaveBeenCalledWith('art-1', 'comment-1')
    );
    expect(await screen.findByText('Deleted comment')).toBeInTheDocument();
  });

  it('does not offer delete to a non-author', async () => {
    renderPanel('someone-else');
    await screen.findByTestId('comment-thread-thread-1');

    expect(screen.queryByTestId('comment-delete-comment-1')).not.toBeInTheDocument();
  });

  it('filters threads by Open / Resolved / All', async () => {
    const openThread = makeThread({ threadId: 'thread-open', status: 'open' });
    const resolvedThread = makeThread({
      threadId: 'thread-resolved',
      status: 'resolved',
      root: {
        ...makeThread().root,
        commentId: 'comment-resolved',
        threadId: 'thread-resolved',
        body: 'Older resolved thread.',
        status: 'resolved',
      },
    });
    apiMocks.getDocumentStudioCommentThreads.mockResolvedValue([openThread, resolvedThread]);
    apiMocks.getDocumentStudioCommentCounts.mockResolvedValue(
      makeCounts({ totalOpen: 1, totalResolved: 1 })
    );

    renderPanel();
    await screen.findByTestId('comment-thread-thread-open');
    expect(screen.getByTestId('comment-thread-thread-resolved')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('comments-filter-open'));
    expect(screen.getByTestId('comment-thread-thread-open')).toBeInTheDocument();
    expect(screen.queryByTestId('comment-thread-thread-resolved')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('comments-filter-resolved'));
    expect(screen.queryByTestId('comment-thread-thread-open')).not.toBeInTheDocument();
    expect(screen.getByTestId('comment-thread-thread-resolved')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('comments-filter-all'));
    expect(screen.getByTestId('comment-thread-thread-open')).toBeInTheDocument();
    expect(screen.getByTestId('comment-thread-thread-resolved')).toBeInTheDocument();
  });

  it('shows live Open/Resolved counters from the counts endpoint', async () => {
    apiMocks.getDocumentStudioCommentThreads.mockResolvedValue([
      makeThread({ threadId: 'thread-open', status: 'open' }),
    ]);
    apiMocks.getDocumentStudioCommentCounts.mockResolvedValue(
      makeCounts({ totalOpen: 3, totalResolved: 5 })
    );

    renderPanel();
    await screen.findByTestId('comment-thread-thread-open');

    const allTab = screen.getByTestId('comments-filter-all');
    const openTab = screen.getByTestId('comments-filter-open');
    const resolvedTab = screen.getByTestId('comments-filter-resolved');

    // "All" counts rendered threads (not the server counts endpoint).
    expect(within(allTab).getByText(/· 1/)).toBeInTheDocument();
    // Open/Resolved counters come from the counts endpoint, independent of
    // how many threads happen to be loaded.
    expect(within(openTab).getByText(/· 3/)).toBeInTheDocument();
    expect(within(resolvedTab).getByText(/· 5/)).toBeInTheDocument();
  });
});
