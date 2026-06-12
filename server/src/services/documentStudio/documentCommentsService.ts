/**
 * Consultify Document Studio — Comments service (Epic E6).
 *
 * Owns the per-artifact comment registry and thread aggregation that
 * powers the reviewer mode in the editor canvas. Mirrors the
 * lifecycle / snapshot service shape:
 *   - synchronous in-process Map cache,
 *   - in-memory write-through DAO with an idempotent hydration
 *     promise per organization,
 *   - audit pump injected by the studio service so comment events
 *     land in the same per-artifact audit timeline as proposals,
 *     QA decisions, lifecycle transitions, and snapshots.
 *
 * Tenant safety: every read / write accepts and validates
 * `organizationId`; cross-tenant reads return `null` / `[]`
 * deny-by-default; cross-tenant writes throw `unknown_comment` so
 * existence is not leaked.
 *
 * Slice E6.1 lands the data plane (create / reply / resolve /
 * reopen / delete / list). Slice E6.2 layers thread aggregation +
 * section counts on top. Slice E6.3 wires routes.
 */

import {
  loadCommentsForOrg as daoLoadCommentsForOrg,
  persistComment as daoPersistComment,
} from './documentCommentsRegistryDao.js';
import type {
  DocumentAuditEntry,
  DocumentComment,
  DocumentCommentAnchor,
  DocumentCommentSectionCounts,
  DocumentCommentStatus,
  DocumentCommentThread,
} from './documentStudioTypes.js';

// =============================================================================
// Errors
// =============================================================================

export type DocumentCommentErrorCode =
  | 'invalid_input'
  | 'unknown_comment'
  | 'unknown_thread'
  | 'comment_already_resolved'
  | 'comment_not_resolved'
  | 'comment_deleted'
  | 'reply_to_reply_forbidden'
  | 'forbidden';

export class DocumentCommentError extends Error {
  readonly code: DocumentCommentErrorCode;
  constructor(code: DocumentCommentErrorCode, message: string) {
    super(message);
    this.name = 'DocumentCommentError';
    this.code = code;
  }
}

// =============================================================================
// In-process registry + write-through
// =============================================================================

/** Per-artifact list of comments in insertion order (live cache). */
const commentStore = new Map<string, DocumentComment[]>();
/** commentId → comment fast-lookup. */
const commentIndex = new Map<string, DocumentComment>();

const hydratedOrgs = new Set<string>();
const hydrationInflight = new Map<string, Promise<void>>();

function key(organizationId: string, artifactId: string): string {
  return `${organizationId}::${artifactId}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}`;
}

function cloneComment(comment: DocumentComment): DocumentComment {
  return {
    ...comment,
    anchor: { ...comment.anchor } as DocumentCommentAnchor,
  };
}

async function persistComment(comment: DocumentComment): Promise<{ ok: boolean }> {
  return daoPersistComment(comment);
}

async function loadCommentsForOrg(organizationId: string): Promise<DocumentComment[]> {
  return daoLoadCommentsForOrg(organizationId);
}

async function ensureHydrated(organizationId: string): Promise<void> {
  if (hydratedOrgs.has(organizationId)) return;
  const inflight = hydrationInflight.get(organizationId);
  if (inflight) return inflight;
  const promise = (async () => {
    try {
      const comments = await loadCommentsForOrg(organizationId);
      for (const comment of comments) {
        const k = key(comment.organizationId, comment.artifactId);
        const list = commentStore.get(k) ?? [];
        list.push(comment);
        commentStore.set(k, list);
        commentIndex.set(comment.commentId, comment);
      }
      // Stable createdAt-asc order so per-artifact reads are
      // chronological after a cold start.
      for (const list of commentStore.values()) {
        list.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
      }
    } catch {
      // best-effort hydration
    }
    hydratedOrgs.add(organizationId);
  })();
  hydrationInflight.set(organizationId, promise);
  try {
    await promise;
  } finally {
    hydrationInflight.delete(organizationId);
  }
}

export async function ensureDocumentCommentsHydrated(organizationId: string): Promise<void> {
  return ensureHydrated(organizationId);
}

// =============================================================================
// Audit pump
// =============================================================================

type AuditPump = (entry: DocumentAuditEntry) => void;
let auditPump: AuditPump | null = null;

export function registerDocumentCommentsAuditPump(pump: AuditPump): void {
  auditPump = pump;
}

function recordAudit(entry: DocumentAuditEntry): void {
  if (!auditPump) return;
  auditPump(entry);
}

// =============================================================================
// Internal helpers
// =============================================================================

function validateBody(body: unknown): asserts body is string {
  if (typeof body !== 'string') {
    throw new DocumentCommentError('invalid_input', 'body must be a string');
  }
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    throw new DocumentCommentError('invalid_input', 'body must not be empty');
  }
  if (trimmed.length > 10_000) {
    throw new DocumentCommentError('invalid_input', 'body exceeds 10000 chars');
  }
}

function validateAnchor(anchor: unknown): asserts anchor is DocumentCommentAnchor {
  if (!anchor || typeof anchor !== 'object') {
    throw new DocumentCommentError('invalid_input', 'anchor is required');
  }
  const a = anchor as { kind?: unknown; sectionId?: unknown; blockId?: unknown };
  if (a.kind === 'document') return;
  if (a.kind === 'section') {
    if (typeof a.sectionId !== 'string' || a.sectionId.trim().length === 0) {
      throw new DocumentCommentError('invalid_input', 'anchor.sectionId is required');
    }
    return;
  }
  if (a.kind === 'block') {
    if (typeof a.sectionId !== 'string' || a.sectionId.trim().length === 0) {
      throw new DocumentCommentError('invalid_input', 'anchor.sectionId is required');
    }
    if (typeof a.blockId !== 'string' || a.blockId.trim().length === 0) {
      throw new DocumentCommentError('invalid_input', 'anchor.blockId is required');
    }
    return;
  }
  throw new DocumentCommentError(
    'invalid_input',
    `anchor.kind must be one of: document, section, block (got ${String(a.kind)})`
  );
}

function getStoredComment(commentId: string, organizationId: string): DocumentComment {
  const comment = commentIndex.get(commentId);
  if (!comment || comment.organizationId !== organizationId) {
    throw new DocumentCommentError(
      'unknown_comment',
      `comment ${commentId} not found in organization ${organizationId}`
    );
  }
  return comment;
}

function writeComment(comment: DocumentComment): void {
  const k = key(comment.organizationId, comment.artifactId);
  const list = commentStore.get(k) ?? [];
  const idx = list.findIndex((c) => c.commentId === comment.commentId);
  if (idx >= 0) list[idx] = comment;
  else list.push(comment);
  commentStore.set(k, list);
  commentIndex.set(comment.commentId, comment);
  void persistComment(comment).catch(() => undefined);
}

function getThreadComments(threadId: string, organizationId: string): DocumentComment[] {
  // Intentional: scan the whole index — comment counts per artifact
  // are bounded in practice (UX defers to pagination at thread level).
  // The wave5 swap will turn this into an indexed query.
  const out: DocumentComment[] = [];
  for (const c of commentIndex.values()) {
    if (c.threadId === threadId && c.organizationId === organizationId) out.push(c);
  }
  out.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  return out;
}

// =============================================================================
// Public surface — Slice E6.1 (data plane)
// =============================================================================

export interface CreateDocumentCommentParams {
  organizationId: string;
  artifactId: string;
  authorId: string;
  body: string;
  anchor: DocumentCommentAnchor;
}

/**
 * Create a top-level comment (root of a new thread). Sets `threadId
 * = commentId` on the root so subsequent replies can group by it
 * without a separate thread row.
 */
export function createDocumentComment(params: CreateDocumentCommentParams): DocumentComment {
  if (!params.organizationId)
    throw new DocumentCommentError('invalid_input', 'organizationId is required');
  if (!params.artifactId) throw new DocumentCommentError('invalid_input', 'artifactId is required');
  if (!params.authorId) throw new DocumentCommentError('invalid_input', 'authorId is required');
  validateBody(params.body);
  validateAnchor(params.anchor);

  const commentId = makeId('comment');
  const now = nowIso();
  const comment: DocumentComment = {
    commentId,
    threadId: commentId,
    artifactId: params.artifactId,
    organizationId: params.organizationId,
    parentCommentId: undefined,
    anchor: params.anchor,
    authorId: params.authorId,
    body: params.body.trim(),
    status: 'open',
    createdAt: now,
    updatedAt: now,
  };
  writeComment(comment);

  recordAudit({
    auditId: makeId('document-audit'),
    artifactId: params.artifactId,
    organizationId: params.organizationId,
    action: 'comment_added',
    actorId: params.authorId,
    occurredAt: now,
    details: {
      commentId,
      threadId: commentId,
      anchor: params.anchor,
    },
  });

  return cloneComment(comment);
}

export interface ReplyToDocumentCommentParams {
  organizationId: string;
  artifactId: string;
  authorId: string;
  parentCommentId: string;
  body: string;
}

/**
 * Reply to an existing comment. Replies inherit the parent's anchor
 * and threadId. Disallows replying to another reply (flat thread
 * model in MVP) so the UI tree stays exactly two levels deep.
 *
 * Throws:
 *   - 'invalid_input'           — missing/empty field.
 *   - 'unknown_comment'         — parent not found in tenant.
 *   - 'comment_deleted'         — parent was soft-deleted.
 *   - 'reply_to_reply_forbidden'— parent is itself a reply.
 *   - 'forbidden'               — parent's artifactId differs from
 *                                 the params.artifactId (tenant-safe
 *                                 cross-artifact guard).
 */
export function replyToDocumentComment(params: ReplyToDocumentCommentParams): DocumentComment {
  if (!params.organizationId)
    throw new DocumentCommentError('invalid_input', 'organizationId is required');
  if (!params.artifactId) throw new DocumentCommentError('invalid_input', 'artifactId is required');
  if (!params.authorId) throw new DocumentCommentError('invalid_input', 'authorId is required');
  if (!params.parentCommentId)
    throw new DocumentCommentError('invalid_input', 'parentCommentId is required');
  validateBody(params.body);

  const parent = getStoredComment(params.parentCommentId, params.organizationId);
  if (parent.artifactId !== params.artifactId) {
    throw new DocumentCommentError('forbidden', `parent comment belongs to a different artifact`);
  }
  if (parent.deletedAt) {
    throw new DocumentCommentError('comment_deleted', `parent comment was deleted`);
  }
  if (parent.parentCommentId !== undefined) {
    throw new DocumentCommentError(
      'reply_to_reply_forbidden',
      `replies can only target the root of a thread`
    );
  }

  const commentId = makeId('comment');
  const now = nowIso();
  const reply: DocumentComment = {
    commentId,
    threadId: parent.threadId,
    artifactId: parent.artifactId,
    organizationId: parent.organizationId,
    parentCommentId: parent.commentId,
    anchor: parent.anchor,
    authorId: params.authorId,
    body: params.body.trim(),
    status: 'open',
    createdAt: now,
    updatedAt: now,
  };
  writeComment(reply);

  // Bump the root's updatedAt so thread sorting reflects activity.
  const updatedRoot: DocumentComment = { ...parent, updatedAt: now };
  writeComment(updatedRoot);

  recordAudit({
    auditId: makeId('document-audit'),
    artifactId: parent.artifactId,
    organizationId: parent.organizationId,
    action: 'comment_replied',
    actorId: params.authorId,
    occurredAt: now,
    details: {
      commentId,
      threadId: parent.threadId,
      parentCommentId: parent.commentId,
    },
  });

  return cloneComment(reply);
}

export interface ResolveDocumentCommentParams {
  organizationId: string;
  artifactId: string;
  userId: string;
  commentId: string;
  reason?: string;
}

/**
 * Mark the thread containing `commentId` as resolved. The action is
 * thread-wide: every comment in the thread (root + replies) is
 * stamped with `status: 'resolved'`. Idempotent — already-resolved
 * threads throw `comment_already_resolved` so callers can distinguish
 * a no-op from a real resolution.
 *
 * `commentId` may target the root or any reply; the service walks
 * to the root via `threadId`.
 */
export function resolveDocumentComment(params: ResolveDocumentCommentParams): DocumentComment {
  if (!params.organizationId)
    throw new DocumentCommentError('invalid_input', 'organizationId is required');
  if (!params.artifactId) throw new DocumentCommentError('invalid_input', 'artifactId is required');
  if (!params.userId) throw new DocumentCommentError('invalid_input', 'userId is required');
  if (!params.commentId) throw new DocumentCommentError('invalid_input', 'commentId is required');

  const target = getStoredComment(params.commentId, params.organizationId);
  if (target.artifactId !== params.artifactId) {
    throw new DocumentCommentError('forbidden', `comment belongs to a different artifact`);
  }
  if (target.deletedAt) {
    throw new DocumentCommentError('comment_deleted', `comment was deleted`);
  }
  if (target.status === 'resolved') {
    throw new DocumentCommentError(
      'comment_already_resolved',
      `thread ${target.threadId} is already resolved`
    );
  }

  const now = nowIso();
  const reason = params.reason?.trim() || undefined;
  const threadComments = getThreadComments(target.threadId, params.organizationId);
  let root: DocumentComment | null = null;
  for (const c of threadComments) {
    if (c.deletedAt) continue;
    const next: DocumentComment = {
      ...c,
      status: 'resolved',
      resolvedBy: params.userId,
      resolvedAt: now,
      resolveReason: reason,
      reopenedBy: undefined,
      reopenedAt: undefined,
      updatedAt: now,
    };
    writeComment(next);
    if (c.parentCommentId === undefined) root = next;
  }
  // Fallback when root is itself deleted but replies exist; we
  // recompute by direct lookup.
  if (!root) {
    const rootCandidate = commentIndex.get(target.threadId);
    root = rootCandidate ? cloneComment(rootCandidate) : cloneComment(target);
  }

  recordAudit({
    auditId: makeId('document-audit'),
    artifactId: target.artifactId,
    organizationId: target.organizationId,
    action: 'comment_resolved',
    actorId: params.userId,
    occurredAt: now,
    details: {
      threadId: target.threadId,
      rootCommentId: target.threadId,
      reason,
      resolvedFrom: params.commentId,
    },
  });

  return cloneComment(root);
}

export interface ReopenDocumentCommentParams {
  organizationId: string;
  artifactId: string;
  userId: string;
  commentId: string;
  reason?: string;
}

/**
 * Reopen a previously-resolved thread. Inverse of
 * `resolveDocumentComment` — clears `resolvedBy / resolvedAt /
 * resolveReason` and stamps `reopenedBy / reopenedAt` on every
 * comment in the thread. Throws `comment_not_resolved` on already-
 * open threads.
 */
export function reopenDocumentComment(params: ReopenDocumentCommentParams): DocumentComment {
  if (!params.organizationId)
    throw new DocumentCommentError('invalid_input', 'organizationId is required');
  if (!params.artifactId) throw new DocumentCommentError('invalid_input', 'artifactId is required');
  if (!params.userId) throw new DocumentCommentError('invalid_input', 'userId is required');
  if (!params.commentId) throw new DocumentCommentError('invalid_input', 'commentId is required');

  const target = getStoredComment(params.commentId, params.organizationId);
  if (target.artifactId !== params.artifactId) {
    throw new DocumentCommentError('forbidden', `comment belongs to a different artifact`);
  }
  if (target.deletedAt) {
    throw new DocumentCommentError('comment_deleted', `comment was deleted`);
  }
  if (target.status === 'open') {
    throw new DocumentCommentError(
      'comment_not_resolved',
      `thread ${target.threadId} is already open`
    );
  }

  const now = nowIso();
  const reason = params.reason?.trim() || undefined;
  const threadComments = getThreadComments(target.threadId, params.organizationId);
  let root: DocumentComment | null = null;
  for (const c of threadComments) {
    if (c.deletedAt) continue;
    const next: DocumentComment = {
      ...c,
      status: 'open',
      resolvedBy: undefined,
      resolvedAt: undefined,
      resolveReason: undefined,
      reopenedBy: params.userId,
      reopenedAt: now,
      updatedAt: now,
    };
    writeComment(next);
    if (c.parentCommentId === undefined) root = next;
  }
  if (!root) {
    const rootCandidate = commentIndex.get(target.threadId);
    root = rootCandidate ? cloneComment(rootCandidate) : cloneComment(target);
  }

  recordAudit({
    auditId: makeId('document-audit'),
    artifactId: target.artifactId,
    organizationId: target.organizationId,
    action: 'comment_reopened',
    actorId: params.userId,
    occurredAt: now,
    details: {
      threadId: target.threadId,
      reopenedFrom: params.commentId,
      reason,
    },
  });

  return cloneComment(root);
}

export interface DeleteDocumentCommentParams {
  organizationId: string;
  artifactId: string;
  userId: string;
  commentId: string;
}

/**
 * Soft-delete a comment. The row stays in the timeline so the audit
 * trail is complete; `body` is replaced with `''` and `deletedAt`
 * is stamped. Author-only — the route layer enforces the role check.
 *
 * Soft-deleting the root keeps the thread navigable (replies can
 * still resolve / reopen), but `body` of the root reads as empty in
 * the listing. This mirrors how Notion / Linear handle deleted root
 * comments.
 */
export function deleteDocumentComment(params: DeleteDocumentCommentParams): DocumentComment {
  if (!params.organizationId)
    throw new DocumentCommentError('invalid_input', 'organizationId is required');
  if (!params.artifactId) throw new DocumentCommentError('invalid_input', 'artifactId is required');
  if (!params.userId) throw new DocumentCommentError('invalid_input', 'userId is required');
  if (!params.commentId) throw new DocumentCommentError('invalid_input', 'commentId is required');

  const target = getStoredComment(params.commentId, params.organizationId);
  if (target.artifactId !== params.artifactId) {
    throw new DocumentCommentError('forbidden', `comment belongs to a different artifact`);
  }
  if (target.authorId !== params.userId) {
    throw new DocumentCommentError('forbidden', `only the author can delete this comment`);
  }
  if (target.deletedAt) {
    // Idempotent: re-deleting returns the existing soft-deleted row.
    return cloneComment(target);
  }

  const now = nowIso();
  const next: DocumentComment = {
    ...target,
    body: '',
    deletedBy: params.userId,
    deletedAt: now,
    updatedAt: now,
  };
  writeComment(next);

  recordAudit({
    auditId: makeId('document-audit'),
    artifactId: target.artifactId,
    organizationId: target.organizationId,
    action: 'comment_deleted',
    actorId: params.userId,
    occurredAt: now,
    details: {
      commentId: target.commentId,
      threadId: target.threadId,
    },
  });

  return cloneComment(next);
}

// =============================================================================
// Read surface
// =============================================================================

export interface ListDocumentCommentsOptions {
  /** Filter by lifecycle status. Defaults to listing both. */
  status?: DocumentCommentStatus;
  /** Hide soft-deleted comments. Default true. */
  hideDeleted?: boolean;
  /** Filter by anchor.kind. */
  anchorKind?: DocumentCommentAnchor['kind'];
  /** Filter by sectionId — matches anchor.sectionId on `'section'` and `'block'` anchors. */
  sectionId?: string;
  /** Filter by blockId — matches anchor.blockId on `'block'` anchors only. */
  blockId?: string;
}

export function listDocumentComments(
  artifactId: string,
  organizationId: string,
  options: ListDocumentCommentsOptions = {}
): DocumentComment[] {
  if (!artifactId || !organizationId) return [];
  const list = commentStore.get(key(organizationId, artifactId)) ?? [];
  const hideDeleted = options.hideDeleted !== false;
  const out: DocumentComment[] = [];
  for (const c of list) {
    if (hideDeleted && c.deletedAt) continue;
    if (options.status && c.status !== options.status) continue;
    if (options.anchorKind && c.anchor.kind !== options.anchorKind) continue;
    if (options.sectionId) {
      if (c.anchor.kind === 'document') continue;
      if ((c.anchor as { sectionId: string }).sectionId !== options.sectionId) continue;
    }
    if (options.blockId) {
      if (c.anchor.kind !== 'block') continue;
      if (c.anchor.blockId !== options.blockId) continue;
    }
    out.push(cloneComment(c));
  }
  return out;
}

export function getDocumentComment(
  commentId: string,
  organizationId: string
): DocumentComment | null {
  if (!commentId || !organizationId) return null;
  const c = commentIndex.get(commentId);
  if (!c) return null;
  if (c.organizationId !== organizationId) return null;
  return cloneComment(c);
}

// =============================================================================
// Slice E6.2 — Thread aggregation + per-section counts
// =============================================================================

export interface ListDocumentCommentThreadsOptions {
  /** Filter by thread status. Defaults to listing both. */
  status?: DocumentCommentStatus;
  /** Hide threads whose root is soft-deleted AND has no replies.
   *  Threads where the root is deleted but replies exist stay
   *  visible so reviewers can still resolve / reopen them. Default true. */
  hideOrphanedDeleted?: boolean;
  /** Anchor filters — same semantics as listDocumentComments. */
  anchorKind?: DocumentCommentAnchor['kind'];
  sectionId?: string;
  blockId?: string;
}

/**
 * Group raw comments into `DocumentCommentThread` rows for the
 * editor canvas. Threads are sorted by `updatedAt` desc so the
 * most-recent activity floats to the top — replies bump `updatedAt`
 * on the root in slice 6.1 specifically to make this work.
 *
 * Behavior contract:
 *   - One row per `threadId`.
 *   - `root` is the comment with `parentCommentId === undefined`,
 *     or — for orphaned threads where the root was hard-removed
 *     before slice 6.1 landed — the earliest-created comment in
 *     the thread (defensive fallback only; soft-delete keeps the
 *     row, so this only fires on legacy data).
 *   - `replies` is every other comment in the thread, sorted by
 *     `createdAt` asc.
 *   - `status` mirrors the root's status (resolution is
 *     thread-wide; replies always carry the same status as the root).
 *   - `anchor` mirrors the root's anchor.
 *   - Soft-deleted comments (root or reply) stay in the
 *     `replies` list so the audit timeline is faithful — UI hides
 *     the body via the `deletedAt` flag.
 *   - Filters apply to the THREAD (i.e. the root's properties);
 *     a thread anchored on `sec-A` matches `sectionId: 'sec-A'`
 *     regardless of whether any reply is itself anchored.
 */
export function listDocumentCommentThreads(
  artifactId: string,
  organizationId: string,
  options: ListDocumentCommentThreadsOptions = {}
): DocumentCommentThread[] {
  if (!artifactId || !organizationId) return [];
  const list = commentStore.get(key(organizationId, artifactId)) ?? [];
  if (list.length === 0) return [];

  const groups = new Map<string, DocumentComment[]>();
  for (const c of list) {
    const bucket = groups.get(c.threadId) ?? [];
    bucket.push(c);
    groups.set(c.threadId, bucket);
  }

  const out: DocumentCommentThread[] = [];
  const hideOrphanedDeleted = options.hideOrphanedDeleted !== false;

  for (const [threadId, comments] of groups.entries()) {
    comments.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
    let root = comments.find((c) => c.parentCommentId === undefined);
    if (!root) {
      // Defensive fallback for legacy data — should never happen
      // post-slice-6.1 because we never hard-delete the root.
      root = comments[0]!;
    }
    const replies = comments.filter((c) => c.commentId !== root!.commentId);

    if (hideOrphanedDeleted && root.deletedAt && replies.length === 0) continue;
    if (options.status && root.status !== options.status) continue;
    if (options.anchorKind && root.anchor.kind !== options.anchorKind) continue;
    if (options.sectionId) {
      if (root.anchor.kind === 'document') continue;
      if ((root.anchor as { sectionId: string }).sectionId !== options.sectionId) continue;
    }
    if (options.blockId) {
      if (root.anchor.kind !== 'block') continue;
      if (root.anchor.blockId !== options.blockId) continue;
    }

    // Thread-level updatedAt: max across all comments. The root's
    // updatedAt is bumped by replies in slice 6.1, so in practice
    // root.updatedAt is enough — but max() guards against races.
    let updatedAt = root.updatedAt;
    for (const c of comments) {
      if (c.updatedAt > updatedAt) updatedAt = c.updatedAt;
    }

    out.push({
      threadId,
      artifactId,
      organizationId,
      anchor: root.anchor,
      status: root.status,
      root: cloneComment(root),
      replies: replies.map((r) => cloneComment(r)),
      createdAt: root.createdAt,
      updatedAt,
    });
  }

  // Most-recent activity first.
  out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  return out;
}

/**
 * Compute per-section / per-block thread counts for the editor
 * canvas to render unresolved-thread badges. Only `'section'` and
 * `'block'` anchored threads contribute to `perSection` /
 * `perBlock` — `'document'` anchored threads are summed into the
 * top-level totals only. Soft-deleted-only threads (root deleted,
 * no replies) are excluded so the badge counts match what the user
 * actually sees in the rail.
 */
export function getDocumentCommentSectionCounts(
  artifactId: string,
  organizationId: string
): DocumentCommentSectionCounts {
  const counts: DocumentCommentSectionCounts = {
    artifactId,
    organizationId,
    totalOpen: 0,
    totalResolved: 0,
    perSection: {},
    perBlock: {},
  };
  if (!artifactId || !organizationId) return counts;

  const threads = listDocumentCommentThreads(artifactId, organizationId);
  for (const t of threads) {
    const bucket = t.status === 'open' ? 'open' : 'resolved';
    if (bucket === 'open') counts.totalOpen += 1;
    else counts.totalResolved += 1;

    if (t.anchor.kind === 'document') continue;
    const sectionId = (t.anchor as { sectionId: string }).sectionId;
    const sectionEntry = counts.perSection[sectionId] ?? { open: 0, resolved: 0 };
    sectionEntry[bucket] += 1;
    counts.perSection[sectionId] = sectionEntry;

    if (t.anchor.kind === 'block') {
      const blockId = t.anchor.blockId;
      const blockEntry = counts.perBlock[blockId] ?? { open: 0, resolved: 0 };
      blockEntry[bucket] += 1;
      counts.perBlock[blockId] = blockEntry;
    }
  }

  return counts;
}

// =============================================================================
// Test-only helpers
// =============================================================================

/** @internal */
export function __resetDocumentCommentsForTests(): void {
  commentStore.clear();
  commentIndex.clear();
  hydratedOrgs.clear();
  hydrationInflight.clear();
}
