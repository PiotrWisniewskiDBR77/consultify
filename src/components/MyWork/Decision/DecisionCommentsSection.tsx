/**
 * MW-DEC-001 — real, persisted comment thread for one decision.
 *
 * Replaces the localStorage-faked comments in DecisionDetailView.tsx (hard-
 * coded `authorId: 'current-user'`, `authorName: 'Current User'` — see
 * MW-CORE-001_CURRENT_RUNTIME_MAP.md §4). Every comment here round-trips
 * through POST/DELETE /api/decisions/:id/comments[/:commentId]; the author
 * name is resolved from the real org user directory (`usersById`), never
 * hardcoded.
 *
 * Comments are NOT frozen when a decision is finalized (see
 * decisionCollaborationService.ts `assertDossierEditable` doc — discussion
 * continues after a decision is made), so this section renders the composer
 * regardless of `decision.status`.
 */
import { AlertTriangle, Send, Trash2 } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import decisionWorkspaceApi, { readDecisionApiError } from './decisionWorkspaceApi';
import type { DecisionCommentDTO, WorkspaceUserRef } from './types';
import { formatDateTime, getInitials, resolveUserName } from './workspaceHelpers';

export interface DecisionCommentsSectionProps {
  decisionId: string;
  comments: DecisionCommentDTO[];
  onCommentsChange: (next: DecisionCommentDTO[]) => void;
  usersById: Map<string, WorkspaceUserRef>;
  currentUserId?: string;
  isAdminLike: boolean;
}

export const DecisionCommentsSection: React.FC<DecisionCommentsSectionProps> = ({
  decisionId,
  comments,
  onCommentsChange,
  usersById,
  currentUserId,
  isAdminLike,
}) => {
  const { t } = useTranslation();

  // Draft-only UI state: the text the user is typing before it is actually
  // persisted. Cleared on a SUCCESSFUL post; kept intact on failure so the
  // user can retry without retyping. Never written to localStorage/
  // sessionStorage and never treated as if it were a saved comment.
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    const body = draft.trim();
    if (!body || submitting) return;
    setSubmitting(true);
    setPostError(null);
    try {
      const created = await decisionWorkspaceApi.postComment(decisionId, body);
      // Only now — after the server confirmed persistence — does the comment
      // enter the list and the draft get cleared.
      onCommentsChange([...comments, created]);
      setDraft('');
    } catch (err) {
      const apiErr = readDecisionApiError(err);
      if (apiErr.status === 404) {
        setPostError(
          t(
            'myWork.decisionWorkspace.comments.errorGone',
            'This decision no longer exists or you no longer have access to it.'
          )
        );
      } else {
        setPostError(
          t(
            'myWork.decisionWorkspace.comments.errorGeneric',
            'Could not post your comment. {{msg}}',
            {
              msg: apiErr.data?.error || apiErr.message || '',
            }
          )
        );
      }
      // Draft text is intentionally NOT cleared — the user can retry.
    } finally {
      setSubmitting(false);
    }
  }, [comments, decisionId, draft, onCommentsChange, submitting, t]);

  const handleDelete = useCallback(
    async (commentId: string) => {
      setDeletingId(commentId);
      setDeleteError(null);
      try {
        await decisionWorkspaceApi.deleteComment(decisionId, commentId);
        onCommentsChange(comments.filter((c) => c.id !== commentId));
      } catch (err) {
        const apiErr = readDecisionApiError(err);
        setDeleteError(
          apiErr.status === 403
            ? t(
                'myWork.decisionWorkspace.comments.deleteForbidden',
                'Only the comment author or an admin can delete this comment.'
              )
            : t('myWork.decisionWorkspace.comments.deleteFailed', 'Could not delete the comment.')
        );
      } finally {
        setDeletingId(null);
      }
    },
    [comments, decisionId, onCommentsChange, t]
  );

  return (
    <div className="space-y-3">
      {comments.length === 0 ? (
        <div className="text-xs text-c-text-muted italic py-1">
          {t('myWork.decisionWorkspace.comments.empty', 'No comments yet.')}
        </div>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => {
            const authorName = resolveUserName(
              usersById,
              c.authorId,
              t('myWork.decisionWorkspace.comments.unknownAuthor', 'Unknown user')
            );
            const canDelete = c.authorId === currentUserId || isAdminLike;
            return (
              <li key={c.id} className="flex gap-2.5">
                <div className="w-7 h-7 shrink-0 rounded-full border border-c-border-subtle bg-c-surface-raised flex items-center justify-center text-[11px] font-medium text-c-text-secondary">
                  {getInitials(authorName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-semibold text-c-text">{authorName}</span>
                    <span className="text-[10px] text-c-text-muted">
                      {formatDateTime(c.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-c-text-secondary whitespace-pre-wrap break-words">
                    {c.body}
                  </p>
                </div>
                {canDelete ? (
                  <button
                    onClick={() => void handleDelete(c.id)}
                    disabled={deletingId === c.id}
                    aria-label={t('myWork.decisionWorkspace.comments.delete', 'Delete comment')}
                    title={t('myWork.decisionWorkspace.comments.delete', 'Delete comment')}
                    className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-c-text-muted hover:text-danger-600 hover:bg-danger-500/10 disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  >
                    <Trash2 size={12} />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {deleteError ? (
        <div className="flex items-start gap-1.5 text-[11px] text-danger-600 dark:text-danger-400">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>{deleteError}</span>
        </div>
      ) : null}

      <div className="pt-1 space-y-1.5">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('myWork.decisionWorkspace.comments.placeholder', 'Add a comment…')}
          rows={2}
          className="w-full resize-none rounded-lg border border-c-border-subtle bg-c-surface px-2.5 py-2 text-xs text-c-text placeholder:text-c-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void handleSubmit();
            }
          }}
        />
        <div className="flex items-center justify-between gap-2">
          {postError ? (
            <div className="flex items-start gap-1.5 text-[11px] text-danger-600 dark:text-danger-400">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>{postError}</span>
            </div>
          ) : (
            <span />
          )}
          <button
            onClick={() => void handleSubmit()}
            disabled={!draft.trim() || submitting}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium bg-c-surface-raised border border-c-border-subtle text-c-text hover:bg-c-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <Send size={12} />
            {submitting
              ? t('myWork.decisionWorkspace.comments.sending', 'Sending…')
              : t('myWork.decisionWorkspace.comments.send', 'Send')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DecisionCommentsSection;
