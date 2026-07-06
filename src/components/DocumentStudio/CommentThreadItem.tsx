/**
 * Document Studio — single review thread card (B5, Epic E6 UI).
 *
 * Renders one `DocumentCommentThread`: root comment, anchor pill
 * (clickable when the anchor points at a section/block that exists in
 * the rendered document), status chip, replies, and the full lifecycle
 * actions — reply, resolve (with optional reason), reopen, and
 * author-only soft-delete.
 *
 * Zero crimson: neutral `c-*` tokens + amber (open) / emerald
 * (resolved) semantic accents, matching the panel's existing banners.
 */

import { CornerDownRight, FileText, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import Button from '@/components/ui/primitives/Button';

import type { DocumentComment, DocumentCommentThread } from './types';

export function formatCommentAuthor(authorId: string | undefined | null): string {
  const id = String(authorId || '').trim();
  if (!id) return '—';
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

const STATUS_CHIP_CLASS: Record<'open' | 'resolved', string> = {
  open: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  resolved: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
};

interface CommentThreadItemProps {
  thread: DocumentCommentThread;
  /** Current user id — enables author-only delete affordances. */
  currentUserId?: string;
  /** Human-readable anchor label ("Entire document" / section title). */
  anchorLabel: string;
  /** Whether clicking the anchor pill can navigate to the section. */
  anchorNavigable: boolean;
  /** Disables all actions while a mutation for this thread is in flight. */
  busy: boolean;
  onAnchorClick?: () => void;
  /** Handlers resolve to `true` on success (clears local inputs). */
  onReply: (body: string) => Promise<boolean>;
  onResolve: (reason?: string) => Promise<boolean>;
  onReopen: () => Promise<boolean>;
  onDelete: (commentId: string) => Promise<boolean>;
}

export function CommentThreadItem({
  thread,
  currentUserId,
  anchorLabel,
  anchorNavigable,
  busy,
  onAnchorClick,
  onReply,
  onResolve,
  onReopen,
  onDelete,
}: CommentThreadItemProps): React.ReactElement {
  const { t } = useTranslation();
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyDraft, setReplyDraft] = useState('');
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveReason, setResolveReason] = useState('');

  const isResolved = thread.status === 'resolved';
  const rootDeleted = Boolean(thread.root.deletedAt);
  const canDeleteRoot =
    !rootDeleted && Boolean(currentUserId) && thread.root.authorId === currentUserId;

  const submitReply = async (): Promise<void> => {
    if (!replyDraft.trim()) return;
    const ok = await onReply(replyDraft.trim());
    if (ok) {
      setReplyDraft('');
      setReplyOpen(false);
    }
  };

  const submitResolve = async (): Promise<void> => {
    const ok = await onResolve(resolveReason.trim() || undefined);
    if (ok) {
      setResolveReason('');
      setResolveOpen(false);
    }
  };

  const renderCommentBody = (comment: DocumentComment): React.ReactNode =>
    comment.deletedAt ? (
      <span className="italic text-c-text-secondary">
        {t('documentStudio.comments.deletedComment', 'Deleted comment')}
      </span>
    ) : (
      comment.body
    );

  return (
    <li
      className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3 text-xs"
      data-testid={`comment-thread-${thread.threadId}`}
    >
      {/* Header: anchor pill + status chip */}
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={anchorNavigable ? onAnchorClick : undefined}
          disabled={!anchorNavigable}
          title={
            anchorNavigable
              ? t('documentStudio.comments.anchorGoTo', 'Go to this place in the document')
              : undefined
          }
          className={`inline-flex max-w-[70%] items-center gap-1 rounded-full bg-c-surface-raised px-2 py-0.5 text-[10px] text-c-text-secondary ${
            anchorNavigable ? 'hover:text-c-text cursor-pointer' : 'cursor-default'
          }`}
          data-testid={`comment-anchor-${thread.threadId}`}
        >
          <FileText size={10} aria-hidden="true" />
          <span className="truncate">{anchorLabel}</span>
        </button>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CHIP_CLASS[thread.status]}`}
        >
          {isResolved
            ? t('documentStudio.comments.statusResolved', 'Resolved')
            : t('documentStudio.comments.statusOpen', 'Open')}
        </span>
      </div>

      {/* Root comment */}
      <div className="font-medium text-c-text">{renderCommentBody(thread.root)}</div>
      <div className="mt-1 flex items-center justify-between gap-2 text-c-text-secondary">
        <span>
          {formatCommentAuthor(thread.root.authorId)} · {formatTimestamp(thread.root.createdAt)}
        </span>
        {canDeleteRoot ? (
          <button
            type="button"
            onClick={() => void onDelete(thread.root.commentId)}
            disabled={busy}
            title={t('documentStudio.comments.delete', 'Delete')}
            aria-label={t('documentStudio.comments.delete', 'Delete')}
            className="rounded p-0.5 text-c-text-secondary hover:text-danger-600 dark:hover:text-danger-400 disabled:opacity-40"
            data-testid={`comment-delete-${thread.root.commentId}`}
          >
            <Trash2 size={12} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {/* Resolution note */}
      {isResolved ? (
        <div className="mt-2 rounded-md bg-emerald-500/10 px-2 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
          {t('documentStudio.comments.resolvedBy', {
            defaultValue: 'Resolved by {{author}}',
            author: formatCommentAuthor(thread.root.resolvedBy),
          })}
          {thread.root.resolveReason ? (
            <span className="text-c-text-secondary"> — {thread.root.resolveReason}</span>
          ) : null}
        </div>
      ) : null}

      {/* Replies */}
      {thread.replies.length > 0 ? (
        <ul className="mt-2 space-y-1.5 border-l border-c-border-subtle pl-2.5">
          {thread.replies.map((reply) => {
            const canDeleteReply =
              !reply.deletedAt && Boolean(currentUserId) && reply.authorId === currentUserId;
            return (
              <li key={reply.commentId} data-testid={`comment-reply-${reply.commentId}`}>
                <div className="text-c-text">{renderCommentBody(reply)}</div>
                <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-c-text-secondary">
                  <span>
                    {formatCommentAuthor(reply.authorId)} · {formatTimestamp(reply.createdAt)}
                  </span>
                  {canDeleteReply ? (
                    <button
                      type="button"
                      onClick={() => void onDelete(reply.commentId)}
                      disabled={busy}
                      title={t('documentStudio.comments.delete', 'Delete')}
                      aria-label={t('documentStudio.comments.delete', 'Delete')}
                      className="rounded p-0.5 text-c-text-secondary hover:text-danger-600 dark:hover:text-danger-400 disabled:opacity-40"
                      data-testid={`comment-delete-${reply.commentId}`}
                    >
                      <Trash2 size={11} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* Reply composer */}
      {replyOpen ? (
        <div className="mt-2">
          <textarea
            value={replyDraft}
            onChange={(event) => setReplyDraft(event.target.value)}
            placeholder={t('documentStudio.comments.replyPlaceholder', 'Write a reply…')}
            className="min-h-[56px] w-full resize-y rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-2.5 py-1.5 text-xs text-c-text outline-none focus:border-c-focus-solid focus:ring-2 focus:ring-c-focus"
            data-testid={`comment-reply-input-${thread.threadId}`}
          />
          <div className="mt-1.5 flex justify-end gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setReplyOpen(false);
                setReplyDraft('');
              }}
              disabled={busy}
            >
              {t('documentStudio.comments.cancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void submitReply()}
              disabled={busy || !replyDraft.trim()}
              data-testid={`comment-reply-send-${thread.threadId}`}
            >
              {t('documentStudio.comments.replySend', 'Send reply')}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Resolve composer (optional reason) */}
      {resolveOpen ? (
        <div className="mt-2">
          <input
            type="text"
            value={resolveReason}
            onChange={(event) => setResolveReason(event.target.value)}
            placeholder={t(
              'documentStudio.comments.resolveReasonPlaceholder',
              'Optional resolution reason…'
            )}
            className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-2.5 py-1.5 text-xs text-c-text outline-none focus:border-c-focus-solid focus:ring-2 focus:ring-c-focus"
            data-testid={`comment-resolve-reason-${thread.threadId}`}
          />
          <div className="mt-1.5 flex justify-end gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setResolveOpen(false);
                setResolveReason('');
              }}
              disabled={busy}
            >
              {t('documentStudio.comments.cancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void submitResolve()}
              disabled={busy}
              data-testid={`comment-resolve-confirm-${thread.threadId}`}
            >
              {t('documentStudio.comments.resolveConfirm', 'Confirm resolve')}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Action row */}
      {!replyOpen && !resolveOpen ? (
        <div className="mt-2 flex items-center gap-1.5">
          {!rootDeleted ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              icon={<CornerDownRight />}
              onClick={() => setReplyOpen(true)}
              disabled={busy}
              data-testid={`comment-reply-open-${thread.threadId}`}
            >
              {t('documentStudio.comments.reply', 'Reply')}
            </Button>
          ) : null}
          {isResolved ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void onReopen()}
              disabled={busy}
              data-testid={`comment-reopen-${thread.threadId}`}
            >
              {t('documentStudio.comments.reopen', 'Reopen')}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setResolveOpen(true)}
              disabled={busy || rootDeleted}
              data-testid={`comment-resolve-open-${thread.threadId}`}
            >
              {t('documentStudio.comments.resolve', 'Resolve')}
            </Button>
          )}
        </div>
      ) : null}
    </li>
  );
}

export default CommentThreadItem;
