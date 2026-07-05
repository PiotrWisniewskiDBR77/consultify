/**
 * Document Studio — Comments / review-threads right-rail panel (B5).
 *
 * Full Epic E6 thread lifecycle on top of the existing backend:
 *   - document-level composer (as before),
 *   - reply / resolve (optional reason) / reopen / author-only soft-delete,
 *   - Open / Resolved / All filter with live counters (counts endpoint),
 *   - anchor pills: section- and block-anchored threads show the section
 *     title and, when the section is rendered in the editor, clicking the
 *     pill scrolls to it (block anchors navigate to their parent section —
 *     blocks carry no DOM id, and we deliberately avoid building a bridge).
 *
 * The parent panel receives count updates through `onCountsChanged` to
 * badge the right-rail Comments tool with the open-thread total.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import Button from '@/components/ui/primitives/Button';
import { tokenService } from '@/services/tokenService';

import {
  createDocumentStudioComment,
  deleteDocumentStudioComment,
  getDocumentStudioCommentCounts,
  getDocumentStudioCommentThreads,
  reopenDocumentStudioComment,
  replyToDocumentStudioComment,
  resolveDocumentStudioComment,
} from './api';
import { CommentThreadItem } from './CommentThreadItem';
import type {
  DocumentCommentAnchor,
  DocumentCommentSectionCounts,
  DocumentCommentThread,
  DocumentSection,
} from './types';

type ThreadFilter = 'all' | 'open' | 'resolved';

function resolveCurrentUserIdFromToken(): string | undefined {
  try {
    const token = tokenService.getToken();
    if (!token) return undefined;
    return tokenService.decodeToken(token)?.id;
  } catch {
    return undefined;
  }
}

/**
 * Scroll the rendered section heading (`[data-section-id]`, emitted by
 * `DocSectionNode`) into view and flash a short outline highlight. Block
 * anchors fall back to their parent section. Returns `false` when the
 * section is not present in the DOM.
 */
export function scrollToSectionAnchor(sectionId: string): boolean {
  if (typeof document === 'undefined' || !sectionId) return false;
  const el = document.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(sectionId)}"]`);
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const prevOutline = el.style.outline;
  const prevOffset = el.style.outlineOffset;
  el.style.outline = '2px solid var(--c-focus-solid, #3b82f6)';
  el.style.outlineOffset = '4px';
  window.setTimeout(() => {
    el.style.outline = prevOutline;
    el.style.outlineOffset = prevOffset;
  }, 1600);
  return true;
}

interface DocumentCommentsPanelProps {
  artifactId: string;
  /** Document sections — used to label section/block anchors. */
  sections: DocumentSection[];
  /** Override for tests; defaults to the id decoded from the JWT. */
  currentUserId?: string;
  /** Fires whenever fresh counts arrive (rail badge). */
  onCountsChanged?: (counts: DocumentCommentSectionCounts) => void;
}

export function DocumentCommentsPanel({
  artifactId,
  sections,
  currentUserId,
  onCountsChanged,
}: DocumentCommentsPanelProps): React.ReactElement {
  const { t } = useTranslation();
  const [threads, setThreads] = useState<DocumentCommentThread[]>([]);
  const [counts, setCounts] = useState<DocumentCommentSectionCounts | null>(null);
  const [filter, setFilter] = useState<ThreadFilter>('all');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyThreadId, setBusyThreadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const userId = currentUserId ?? resolveCurrentUserIdFromToken();

  const sectionTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const section of sections) map.set(section.sectionId, section.title);
    return map;
  }, [sections]);

  const onCountsChangedRef = useRef(onCountsChanged);
  onCountsChangedRef.current = onCountsChanged;

  const refresh = useCallback(
    async (opts: { silent?: boolean } = {}): Promise<void> => {
      if (!opts.silent) setLoading(true);
      setError(null);
      try {
        const [nextThreads, nextCounts] = await Promise.all([
          getDocumentStudioCommentThreads(artifactId),
          getDocumentStudioCommentCounts(artifactId),
        ]);
        setThreads(nextThreads);
        setCounts(nextCounts);
        onCountsChangedRef.current?.(nextCounts);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t('documentStudio.comments.loadFailed', 'Failed to load comments')
        );
      } finally {
        if (!opts.silent) setLoading(false);
      }
    },
    [artifactId, t]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submit = async (): Promise<void> => {
    if (!draft.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const nextThreads = await createDocumentStudioComment(artifactId, {
        body: draft.trim(),
        anchor: { kind: 'document' },
      });
      setThreads(nextThreads);
      setDraft('');
      toast.success(t('documentStudio.comments.added', 'Comment added'));
      void refresh({ silent: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documentStudio.comments.addFailed', 'Failed to add comment')
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
    ): Promise<boolean> => {
      setBusyThreadId(threadId);
      try {
        await action();
        toast.success(successMessage);
        await refresh({ silent: true });
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : failureMessage);
        return false;
      } finally {
        setBusyThreadId(null);
      }
    },
    [refresh]
  );

  const anchorLabelFor = useCallback(
    (anchor: DocumentCommentAnchor): { label: string; sectionId: string | null } => {
      if (anchor.kind === 'document') {
        return {
          label: t('documentStudio.comments.anchorDocument', 'Entire document'),
          sectionId: null,
        };
      }
      const title = sectionTitleById.get(anchor.sectionId);
      const sectionLabel =
        title ??
        t('documentStudio.comments.anchorUnknownSection', {
          defaultValue: 'Section {{id}}',
          id: anchor.sectionId.length > 8 ? `${anchor.sectionId.slice(0, 8)}…` : anchor.sectionId,
        });
      if (anchor.kind === 'block') {
        return {
          label: t('documentStudio.comments.anchorBlock', {
            defaultValue: 'Block in: {{section}}',
            section: sectionLabel,
          }),
          sectionId: anchor.sectionId,
        };
      }
      return {
        label: t('documentStudio.comments.anchorSection', {
          defaultValue: 'Section: {{section}}',
          section: sectionLabel,
        }),
        sectionId: anchor.sectionId,
      };
    },
    [sectionTitleById, t]
  );

  const visibleThreads = useMemo(
    () => (filter === 'all' ? threads : threads.filter((thread) => thread.status === filter)),
    [filter, threads]
  );

  const filterOptions: Array<{ id: ThreadFilter; label: string; count: number }> = [
    {
      id: 'all',
      label: t('documentStudio.comments.filterAll', 'All'),
      count: threads.length,
    },
    {
      id: 'open',
      label: t('documentStudio.comments.filterOpen', 'Open'),
      count: counts?.totalOpen ?? threads.filter((thread) => thread.status === 'open').length,
    },
    {
      id: 'resolved',
      label: t('documentStudio.comments.filterResolved', 'Resolved'),
      count:
        counts?.totalResolved ?? threads.filter((thread) => thread.status === 'resolved').length,
    },
  ];

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4" data-testid="document-comments-panel">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-c-text">
            {t('documentStudio.comments.title', 'Comments')}
          </h3>
          <p className="text-xs text-c-text-secondary">
            {t(
              'documentStudio.comments.subtitle',
              'Review threads for this document. Section and block anchors link back into the editor.'
            )}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading
            ? t('documentStudio.comments.loading', 'Loading…')
            : t('documentStudio.comments.refresh', 'Refresh')}
        </Button>
      </div>

      {/* Composer (document-level) */}
      <div className="mb-3 rounded-lg border border-c-border-subtle bg-c-surface p-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t(
            'documentStudio.comments.composerPlaceholder',
            'Add document-level review comment…'
          )}
          className="min-h-[80px] w-full resize-y rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 text-sm text-c-text outline-none focus:border-c-focus-solid focus:ring-2 focus:ring-c-focus"
          data-testid="document-comments-composer"
        />
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => void submit()}
            disabled={submitting || !draft.trim()}
          >
            {submitting
              ? t('documentStudio.comments.adding', 'Adding…')
              : t('documentStudio.comments.addComment', 'Add comment')}
          </Button>
        </div>
      </div>

      {/* Open / Resolved filter */}
      <div
        className="mb-3 flex items-center gap-1 rounded-lg border border-c-border-subtle bg-c-surface p-1"
        role="tablist"
        aria-label={t('documentStudio.comments.filterLabel', 'Filter threads')}
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
                active
                  ? 'bg-c-surface-raised text-c-text'
                  : 'text-c-text-secondary hover:text-c-text'
              }`}
              data-testid={`comments-filter-${option.id}`}
            >
              {option.label} · {option.count}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="mb-3 rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-xs text-danger-700 dark:text-danger-300">
          {error}
        </div>
      ) : null}

      {!loading && visibleThreads.length === 0 ? (
        <div className="rounded-lg border border-c-border-subtle bg-c-surface p-3 text-xs text-c-text-secondary">
          {threads.length === 0
            ? t('documentStudio.comments.empty', 'No comments yet.')
            : t('documentStudio.comments.emptyFilter', 'No threads match this filter.')}
        </div>
      ) : null}

      <ul className="space-y-2">
        {visibleThreads.map((thread) => {
          const { label, sectionId } = anchorLabelFor(thread.anchor);
          return (
            <CommentThreadItem
              key={thread.threadId}
              thread={thread}
              currentUserId={userId}
              anchorLabel={label}
              anchorNavigable={Boolean(sectionId)}
              busy={busyThreadId === thread.threadId}
              onAnchorClick={() => {
                if (sectionId && !scrollToSectionAnchor(sectionId)) {
                  toast(
                    t(
                      'documentStudio.comments.anchorNotFound',
                      'This section is not visible in the current view.'
                    )
                  );
                }
              }}
              onReply={(body) =>
                runThreadAction(
                  thread.threadId,
                  () => replyToDocumentStudioComment(artifactId, thread.root.commentId, body),
                  t('documentStudio.comments.replyAdded', 'Reply added'),
                  t('documentStudio.comments.replyFailed', 'Failed to add reply')
                )
              }
              onResolve={(reason) =>
                runThreadAction(
                  thread.threadId,
                  () => resolveDocumentStudioComment(artifactId, thread.root.commentId, reason),
                  t('documentStudio.comments.resolved', 'Thread resolved'),
                  t('documentStudio.comments.resolveFailed', 'Failed to resolve thread')
                )
              }
              onReopen={() =>
                runThreadAction(
                  thread.threadId,
                  () => reopenDocumentStudioComment(artifactId, thread.root.commentId),
                  t('documentStudio.comments.reopened', 'Thread reopened'),
                  t('documentStudio.comments.reopenFailed', 'Failed to reopen thread')
                )
              }
              onDelete={(commentId) =>
                runThreadAction(
                  thread.threadId,
                  () => deleteDocumentStudioComment(artifactId, commentId),
                  t('documentStudio.comments.deleted', 'Comment deleted'),
                  t('documentStudio.comments.deleteFailed', 'Failed to delete comment')
                )
              }
            />
          );
        })}
      </ul>
    </div>
  );
}

export default DocumentCommentsPanel;
