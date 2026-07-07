/**
 * DeckCommentsPanel — reviewer-thread right-rail panel for the DeckBuilder
 * (M19 Presentations). UX ported from the Word `DocumentCommentsPanel`:
 *   - composer scoped to the active slide (or the whole deck),
 *   - Open / Resolved / All filter with live counters,
 *   - per-thread reply / resolve / reopen / author-only delete,
 *   - anchor pill (deck vs. slide N) that jumps to the slide.
 *
 * Deck had NO comment system before; this is the FE half of the full stack.
 * Colours use c-* tokens only (crimson-safe) so it works dark + light.
 */

import { MessageSquare } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import Button from '@/components/ui/primitives/Button';
import { tokenService } from '@/services/tokenService';

import {
  addDeckComment,
  type DeckCommentCounts,
  type DeckCommentThread,
  deleteDeckComment,
  listDeckComments,
  setDeckCommentResolved,
} from './deckCommentsApi';

type ThreadFilter = 'all' | 'open' | 'resolved';

export interface DeckSlideRef {
  id: string;
  title: string;
  index: number;
}

interface DeckCommentsPanelProps {
  deckId: string;
  /** Slides for anchor labels + slide navigation. */
  slides: DeckSlideRef[];
  /** The slide new comments anchor to (the active slide). */
  activeSlideId?: string | null;
  /** Jump to a slide when its anchor pill is clicked. */
  onJumpToSlide?: (slideId: string) => void;
  /** Fires whenever fresh counts arrive (rail badge). */
  onCountsChanged?: (counts: DeckCommentCounts) => void;
  /** Override for tests; defaults to the id decoded from the JWT. */
  currentUserId?: string;
}

function resolveCurrentUserIdFromToken(): string | undefined {
  try {
    const token = tokenService.getToken();
    if (!token) return undefined;
    return tokenService.decodeToken(token)?.id;
  } catch {
    return undefined;
  }
}

function formatWhen(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return '';
  }
}

export function DeckCommentsPanel({
  deckId,
  slides,
  activeSlideId,
  onJumpToSlide,
  onCountsChanged,
  currentUserId,
}: DeckCommentsPanelProps): React.ReactElement {
  const { t } = useTranslation();
  const [threads, setThreads] = useState<DeckCommentThread[]>([]);
  const [counts, setCounts] = useState<DeckCommentCounts | null>(null);
  const [filter, setFilter] = useState<ThreadFilter>('all');
  const [draft, setDraft] = useState('');
  const [anchorToSlide, setAnchorToSlide] = useState(true);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyThreadId, setBusyThreadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const userId = currentUserId ?? resolveCurrentUserIdFromToken();

  const slideMeta = useMemo(() => {
    const map = new Map<string, DeckSlideRef>();
    for (const s of slides) map.set(s.id, s);
    return map;
  }, [slides]);

  const onCountsChangedRef = useRef(onCountsChanged);
  onCountsChangedRef.current = onCountsChanged;

  const refresh = useCallback(
    async (opts: { silent?: boolean } = {}): Promise<void> => {
      if (!deckId) return;
      if (!opts.silent) setLoading(true);
      setError(null);
      try {
        const { threads: nextThreads, counts: nextCounts } = await listDeckComments(deckId);
        setThreads(nextThreads);
        setCounts(nextCounts);
        if (nextCounts) onCountsChangedRef.current?.(nextCounts);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t('presentations.comments.loadFailed', 'Failed to load comments')
        );
      } finally {
        if (!opts.silent) setLoading(false);
      }
    },
    [deckId, t]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submit = async (): Promise<void> => {
    if (!draft.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await addDeckComment(deckId, {
        body: draft.trim(),
        slideId: anchorToSlide && activeSlideId ? activeSlideId : null,
      });
      setDraft('');
      toast.success(t('presentations.comments.added', 'Comment added'));
      await refresh({ silent: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('presentations.comments.addFailed', 'Failed to add comment')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const runThreadAction = useCallback(
    async (
      threadId: string,
      action: () => Promise<unknown>,
      successMessage: string,
      failureMessage: string
    ): Promise<void> => {
      setBusyThreadId(threadId);
      try {
        await action();
        toast.success(successMessage);
        await refresh({ silent: true });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : failureMessage);
      } finally {
        setBusyThreadId(null);
      }
    },
    [refresh]
  );

  const anchorLabelFor = useCallback(
    (thread: DeckCommentThread): { label: string; slideId: string | null } => {
      if (thread.anchor.kind === 'slide') {
        const meta = slideMeta.get(thread.anchor.slideId);
        const label = meta
          ? t('presentations.comments.anchorSlide', {
              defaultValue: 'Slide {{n}}: {{title}}',
              n: meta.index + 1,
              title: meta.title || t('presentations.comments.untitledSlide', 'Untitled'),
            })
          : t('presentations.comments.anchorSlideUnknown', 'Slide (removed)');
        return { label, slideId: thread.anchor.slideId };
      }
      return {
        label: t('presentations.comments.anchorDeck', 'Entire deck'),
        slideId: null,
      };
    },
    [slideMeta, t]
  );

  const visibleThreads = useMemo(
    () => (filter === 'all' ? threads : threads.filter((thr) => (filter === 'resolved' ? thr.resolved : !thr.resolved))),
    [filter, threads]
  );

  const filterOptions: Array<{ id: ThreadFilter; label: string; count: number }> = [
    { id: 'all', label: t('presentations.comments.filterAll', 'All'), count: threads.length },
    {
      id: 'open',
      label: t('presentations.comments.filterOpen', 'Open'),
      count: counts?.totalOpen ?? threads.filter((thr) => !thr.resolved).length,
    },
    {
      id: 'resolved',
      label: t('presentations.comments.filterResolved', 'Resolved'),
      count: counts?.totalResolved ?? threads.filter((thr) => thr.resolved).length,
    },
  ];

  const activeSlideMeta = activeSlideId ? slideMeta.get(activeSlideId) : undefined;

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4" data-testid="deck-comments-panel">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-c-text">
            <MessageSquare className="h-4 w-4 text-c-text-secondary" />
            {t('presentations.comments.title', 'Comments')}
          </h3>
          <p className="text-xs text-c-text-secondary">
            {t(
              'presentations.comments.subtitle',
              'Review threads for this deck. Anchor a comment to the current slide or the whole deck.'
            )}
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={() => void refresh()} disabled={loading}>
          {loading
            ? t('presentations.comments.loading', 'Loading…')
            : t('presentations.comments.refresh', 'Refresh')}
        </Button>
      </div>

      {/* Composer */}
      <div className="mb-3 rounded-lg border border-c-border-subtle bg-c-surface p-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t('presentations.comments.composerPlaceholder', 'Add a review comment…')}
          className="min-h-[72px] w-full resize-y rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 text-sm text-c-text outline-none focus:border-c-focus-solid focus:ring-2 focus:ring-c-focus"
          data-testid="deck-comments-composer"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-c-text-secondary">
            <input
              type="checkbox"
              checked={anchorToSlide && Boolean(activeSlideId)}
              disabled={!activeSlideId}
              onChange={(e) => setAnchorToSlide(e.target.checked)}
              className="h-3.5 w-3.5 accent-c-focus-solid"
            />
            {activeSlideMeta
              ? t('presentations.comments.anchorToSlide', {
                  defaultValue: 'Anchor to slide {{n}}',
                  n: activeSlideMeta.index + 1,
                })
              : t('presentations.comments.anchorToDeck', 'Deck-level')}
          </label>
          <Button
            type="button"
            size="sm"
            onClick={() => void submit()}
            disabled={submitting || !draft.trim()}
          >
            {submitting
              ? t('presentations.comments.adding', 'Adding…')
              : t('presentations.comments.addComment', 'Comment')}
          </Button>
        </div>
      </div>

      {/* Open / Resolved filter */}
      <div
        className="mb-3 flex items-center gap-1 rounded-lg border border-c-border-subtle bg-c-surface p-1"
        role="tablist"
        aria-label={t('presentations.comments.filterLabel', 'Filter threads')}
      >
        {filterOptions.map((option) => {
          const active = filter === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(option.id)}
              className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                active ? 'bg-c-surface-raised text-c-text' : 'text-c-text-secondary hover:text-c-text'
              }`}
              data-testid={`deck-comments-filter-${option.id}`}
            >
              {option.label} · {option.count}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="mb-3 rounded-lg border border-c-danger/30 bg-c-danger/10 p-3 text-xs text-c-danger">
          {error}
        </div>
      ) : null}

      {!loading && visibleThreads.length === 0 ? (
        <div className="rounded-lg border border-c-border-subtle bg-c-surface p-3 text-xs text-c-text-secondary">
          {threads.length === 0
            ? t('presentations.comments.empty', 'No comments yet.')
            : t('presentations.comments.emptyFilter', 'No threads match this filter.')}
        </div>
      ) : null}

      <ul className="space-y-2">
        {visibleThreads.map((thread) => {
          const { label, slideId } = anchorLabelFor(thread);
          const busy = busyThreadId === thread.threadId;
          const canDeleteRoot = userId && thread.root.author === userId && !thread.root.deletedAt;
          return (
            <li
              key={thread.threadId}
              className="rounded-lg border border-c-border-subtle bg-c-surface p-3"
              data-testid="deck-comment-thread"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => (slideId ? onJumpToSlide?.(slideId) : undefined)}
                  disabled={!slideId}
                  className={`truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    slideId
                      ? 'bg-c-info/15 text-c-info hover:bg-c-info/25'
                      : 'bg-c-surface-raised text-c-text-secondary'
                  }`}
                >
                  {label}
                </button>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    thread.resolved
                      ? 'bg-c-success/15 text-c-success'
                      : 'bg-c-surface-raised text-c-text-secondary'
                  }`}
                >
                  {thread.resolved
                    ? t('presentations.comments.resolvedBadge', 'Resolved')
                    : t('presentations.comments.openBadge', 'Open')}
                </span>
              </div>

              {/* Root */}
              <div className="text-sm text-c-text">
                {thread.root.deletedAt ? (
                  <em className="text-c-text-secondary">
                    {t('presentations.comments.deletedBody', '(comment deleted)')}
                  </em>
                ) : (
                  thread.root.body
                )}
              </div>
              <div className="mt-0.5 text-[10px] text-c-text-secondary">
                {formatWhen(thread.root.createdAt)}
              </div>

              {/* Replies */}
              {thread.replies.length > 0 ? (
                <ul className="mt-2 space-y-1.5 border-l border-c-border-subtle pl-3">
                  {thread.replies.map((reply) => (
                    <li key={reply.id} className="text-xs text-c-text">
                      {reply.deletedAt ? (
                        <em className="text-c-text-secondary">
                          {t('presentations.comments.deletedBody', '(comment deleted)')}
                        </em>
                      ) : (
                        reply.body
                      )}
                      <span className="ml-1 text-[10px] text-c-text-secondary">
                        {formatWhen(reply.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {/* Reply composer */}
              <div className="mt-2 flex items-center gap-1.5">
                <input
                  type="text"
                  value={replyDraft[thread.threadId] ?? ''}
                  onChange={(e) =>
                    setReplyDraft((prev) => ({ ...prev, [thread.threadId]: e.target.value }))
                  }
                  placeholder={t('presentations.comments.replyPlaceholder', 'Reply…')}
                  className="flex-1 rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-xs text-c-text outline-none focus:border-c-focus-solid"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy || !(replyDraft[thread.threadId] ?? '').trim()}
                  onClick={() =>
                    void runThreadAction(
                      thread.threadId,
                      async () => {
                        await addDeckComment(deckId, {
                          body: (replyDraft[thread.threadId] ?? '').trim(),
                          parentCommentId: thread.root.id,
                        });
                        setReplyDraft((prev) => ({ ...prev, [thread.threadId]: '' }));
                      },
                      t('presentations.comments.replyAdded', 'Reply added'),
                      t('presentations.comments.replyFailed', 'Failed to add reply')
                    )
                  }
                >
                  {t('presentations.comments.reply', 'Reply')}
                </Button>
              </div>

              {/* Thread actions */}
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void runThreadAction(
                      thread.threadId,
                      () => setDeckCommentResolved(deckId, thread.root.id, !thread.resolved),
                      thread.resolved
                        ? t('presentations.comments.reopened', 'Thread reopened')
                        : t('presentations.comments.resolvedToast', 'Thread resolved'),
                      t('presentations.comments.resolveFailed', 'Action failed')
                    )
                  }
                  className="text-[11px] font-medium text-c-info hover:underline disabled:opacity-50"
                >
                  {thread.resolved
                    ? t('presentations.comments.reopen', 'Reopen')
                    : t('presentations.comments.resolve', 'Resolve')}
                </button>
                {canDeleteRoot ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void runThreadAction(
                        thread.threadId,
                        () => deleteDeckComment(deckId, thread.root.id),
                        t('presentations.comments.deleted', 'Comment deleted'),
                        t('presentations.comments.deleteFailed', 'Failed to delete comment')
                      )
                    }
                    className="text-[11px] font-medium text-c-text-secondary hover:text-c-danger disabled:opacity-50"
                  >
                    {t('presentations.comments.delete', 'Delete')}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default DeckCommentsPanel;
