/**
 * F1/F3 — Client Reader comments panel (`ff_client_reader`).
 *
 * Deliberately NOT a reuse of `CommentThreadItem`/`DocumentCommentsPanel`
 * (the internal reviewer UI) — those components expose resolve / reopen /
 * author-only delete affordances the public share-link API does not (and
 * should not) support for an anonymous consumer. This is the MVP fallback
 * the task explicitly allows: **podgląd wątków + dodanie komentarza, bez
 * resolve** — a small, self-contained thread list + composer built directly
 * against `clientReaderApi`.
 *
 * Only rendered when the resolved `accessScope` is `'comment'` or `'edit'`
 * (the page decides that; this component assumes it is allowed to be here).
 */

import { MessageCircle } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import type { DocumentComment } from '../types';
import {
  ClientReaderApiError,
  createReaderSession,
  listSharedComments,
  postSharedComment,
  replySharedComment,
} from './clientReaderApi';

interface ThreadGroup {
  threadId: string;
  root: DocumentComment;
  replies: DocumentComment[];
}

function groupThreads(comments: DocumentComment[]): ThreadGroup[] {
  const roots = new Map<string, ThreadGroup>();
  const orphanReplies: DocumentComment[] = [];
  for (const c of comments) {
    if (!c.parentCommentId) {
      roots.set(c.commentId, { threadId: c.threadId, root: c, replies: [] });
    }
  }
  for (const c of comments) {
    if (c.parentCommentId) {
      const group = roots.get(c.threadId);
      if (group) group.replies.push(c);
      else orphanReplies.push(c);
    }
  }
  return Array.from(roots.values()).sort(
    (a, b) => new Date(a.root.createdAt).getTime() - new Date(b.root.createdAt).getTime()
  );
}

function formatAuthor(authorId: string): string {
  if (authorId.startsWith('share-link:')) return 'Czytelnik (link)';
  return authorId;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('pl-PL');
}

function getOrCreateFingerprint(token: string): string {
  const key = `client-reader-fp:${token}`;
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const fresh =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `fp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(key, fresh);
    return fresh;
  } catch {
    return `fp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function ReaderCommentsPanel({ token }: { token: string }): React.ReactElement {
  const [comments, setComments] = useState<DocumentComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [replyDraftFor, setReplyDraftFor] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const fingerprint = useMemo(() => getOrCreateFingerprint(token), [token]);

  const reload = async (): Promise<void> => {
    try {
      const res = await listSharedComments(token);
      setComments(res.comments);
      setError(null);
    } catch (e) {
      setError(e instanceof ClientReaderApiError ? e.code : 'load_failed');
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const ensureSession = async (): Promise<string> => {
    if (sessionToken) return sessionToken;
    const res = await createReaderSession(token, fingerprint);
    setSessionToken(res.session.editSessionToken);
    return res.session.editSessionToken;
  };

  const submitTopLevel = async (): Promise<void> => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      const editSessionToken = await ensureSession();
      await postSharedComment({
        token,
        editSessionToken,
        consumerFingerprint: fingerprint,
        body,
        anchor: { kind: 'document' },
      });
      setDraft('');
      await reload();
    } catch (e) {
      // Session may have expired mid-visit (30 min TTL) — mint a fresh one
      // and retry exactly once before surfacing an error.
      if (e instanceof ClientReaderApiError && e.code === 'share_link_edit_session_expired') {
        setSessionToken(null);
        try {
          const fresh = await createReaderSession(token, fingerprint);
          setSessionToken(fresh.session.editSessionToken);
          await postSharedComment({
            token,
            editSessionToken: fresh.session.editSessionToken,
            consumerFingerprint: fingerprint,
            body,
            anchor: { kind: 'document' },
          });
          setDraft('');
          await reload();
          setBusy(false);
          return;
        } catch {
          // fall through to generic error surface below
        }
      }
      setError(e instanceof ClientReaderApiError ? e.code : 'comment_failed');
    } finally {
      setBusy(false);
    }
  };

  const submitReply = async (parentCommentId: string): Promise<void> => {
    const body = replyDraft.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      const editSessionToken = await ensureSession();
      await replySharedComment({
        token,
        editSessionToken,
        consumerFingerprint: fingerprint,
        body,
        parentCommentId,
      });
      setReplyDraft('');
      setReplyDraftFor(null);
      await reload();
    } catch (e) {
      setError(e instanceof ClientReaderApiError ? e.code : 'reply_failed');
    } finally {
      setBusy(false);
    }
  };

  const threads = comments ? groupThreads(comments) : [];

  return (
    <section
      className="mt-10 border-t border-c-border-subtle pt-6"
      aria-label="Komentarze"
      data-testid="reader-comments-panel"
    >
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-c-text">
        <MessageCircle size={16} aria-hidden="true" />
        Komentarze {threads.length > 0 ? `(${threads.length})` : ''}
      </h2>

      {comments === null && !error ? (
        <div className="h-16 animate-pulse rounded-lg bg-c-surface-raised" />
      ) : null}

      {threads.length > 0 ? (
        <ul className="mb-5 space-y-3">
          {threads.map((thread) => (
            <li
              key={thread.threadId}
              className="rounded-lg border border-c-border-subtle bg-c-surface p-3 text-sm"
              data-testid={`reader-comment-thread-${thread.threadId}`}
            >
              <div className="text-c-text">{thread.root.body}</div>
              <div className="mt-1 text-xs text-c-text-secondary">
                {formatAuthor(thread.root.authorId)} · {formatTimestamp(thread.root.createdAt)}
              </div>

              {thread.replies.length > 0 ? (
                <ul className="mt-2 space-y-2 border-l border-c-border-subtle pl-3">
                  {thread.replies.map((reply) => (
                    <li key={reply.commentId}>
                      <div className="text-c-text">{reply.body}</div>
                      <div className="mt-0.5 text-xs text-c-text-secondary">
                        {formatAuthor(reply.authorId)} · {formatTimestamp(reply.createdAt)}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}

              {replyDraftFor === thread.root.commentId ? (
                <div className="mt-2">
                  <textarea
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    placeholder="Napisz odpowiedź…"
                    className="min-h-[52px] w-full resize-y rounded-lg border border-c-border-subtle bg-c-surface px-2.5 py-1.5 text-sm text-c-text outline-none focus:border-c-focus-solid focus:ring-2 focus:ring-c-focus"
                  />
                  <div className="mt-1.5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyDraftFor(null);
                        setReplyDraft('');
                      }}
                      className="rounded-md px-2.5 py-1 text-xs text-c-text-secondary hover:text-c-text"
                    >
                      Anuluj
                    </button>
                    <button
                      type="button"
                      onClick={() => void submitReply(thread.root.commentId)}
                      disabled={busy || !replyDraft.trim()}
                      className="rounded-md bg-c-text px-2.5 py-1 text-xs font-medium text-c-surface disabled:opacity-40"
                    >
                      Wyślij
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setReplyDraftFor(thread.root.commentId)}
                  className="mt-2 text-xs font-medium text-c-text-secondary hover:text-c-text"
                >
                  Odpowiedz
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : comments !== null && !error ? (
        <p className="mb-5 text-sm text-c-text-secondary">Brak komentarzy — bądź pierwszy.</p>
      ) : null}

      {error ? (
        <p className="mb-3 text-xs text-danger-600 dark:text-danger-400">
          Nie udało się wykonać akcji ({error}). Spróbuj ponownie.
        </p>
      ) : null}

      <div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Dodaj komentarz do całego dokumentu…"
          className="min-h-[72px] w-full resize-y rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 text-sm text-c-text outline-none focus:border-c-focus-solid focus:ring-2 focus:ring-c-focus"
          data-testid="reader-comment-input"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => void submitTopLevel()}
            disabled={busy || !draft.trim()}
            className="rounded-md bg-c-text px-3 py-1.5 text-sm font-medium text-c-surface disabled:opacity-40"
            data-testid="reader-comment-submit"
          >
            {busy ? 'Wysyłanie…' : 'Dodaj komentarz'}
          </button>
        </div>
      </div>
    </section>
  );
}

export default ReaderCommentsPanel;
