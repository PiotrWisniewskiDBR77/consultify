/**
 * Deck Comments service (M19 Presentations) — full reviewer-thread lifecycle
 * for a presentation deck.
 *
 * Deck had NO comment system; this is the port of the proven Word Epic E6
 * pattern (`documentStudio/documentCommentsService.ts` +
 * `documentCommentsRegistryDao.ts`) to the deck domain:
 *   - in-process Map cache with lazy per-org hydration from Postgres,
 *   - best-effort write-through DAO (never throws; degrades to `{ ok:false }`),
 *   - flat 2-level threading (root sets `threadId = commentId`; replies inherit),
 *   - thread-wide resolve / reopen, author-only soft-delete.
 *
 * Anchor granularity for a deck is the SLIDE (Word anchors document/section/
 * block). Anchor = `{ kind:'deck' }` (deck-level) or `{ kind:'slide', slideId }`.
 *
 * Tenant safety: every read/write validates `organizationId`; cross-tenant
 * reads return `null` / `[]`; cross-tenant writes throw `unknown_comment` so
 * existence is not leaked. Deck existence is enforced in the route layer.
 *
 * Backing table: `deck_comments` (migration 789).
 */

import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// =============================================================================
// Types
// =============================================================================

export type DeckCommentAnchor = { kind: 'deck' } | { kind: 'slide'; slideId: string };

export interface DeckComment {
  id: string;
  threadId: string;
  deckId: string;
  organizationId: string;
  slideId: string | null;
  parentCommentId?: string;
  anchor: DeckCommentAnchor;
  author: string;
  body: string;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
  reopenedBy?: string;
  reopenedAt?: string;
  deletedBy?: string;
  deletedAt?: string;
}

export interface DeckCommentThread {
  threadId: string;
  deckId: string;
  organizationId: string;
  anchor: DeckCommentAnchor;
  resolved: boolean;
  root: DeckComment;
  replies: DeckComment[];
  createdAt: string;
  updatedAt: string;
}

export type DeckCommentErrorCode =
  | 'invalid_input'
  | 'unknown_comment'
  | 'comment_deleted'
  | 'reply_to_reply_forbidden'
  | 'forbidden';

export class DeckCommentError extends Error {
  readonly code: DeckCommentErrorCode;
  constructor(code: DeckCommentErrorCode, message: string) {
    super(message);
    this.name = 'DeckCommentError';
    this.code = code;
  }
}

// =============================================================================
// In-process registry + write-through
// =============================================================================

/** Per-deck list of comments in insertion order (live cache). */
const commentStore = new Map<string, DeckComment[]>();
/** commentId → comment fast-lookup. */
const commentIndex = new Map<string, DeckComment>();

const hydratedOrgs = new Set<string>();
const hydrationInflight = new Map<string, Promise<void>>();

function key(organizationId: string, deckId: string): string {
  return `${organizationId}::${deckId}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}`;
}

function cloneComment(c: DeckComment): DeckComment {
  return { ...c, anchor: { ...c.anchor } as DeckCommentAnchor };
}

// =============================================================================
// DAO (Postgres, best-effort write-through)
// =============================================================================

interface CommentRow {
  id: string;
  thread_id: string;
  deck_id: string;
  organization_id: string;
  slide_id?: string | null;
  parent_comment_id?: string | null;
  anchor: unknown;
  author: string;
  body: string;
  resolved: unknown;
  created_at: string | Date;
  updated_at: string | Date;
  resolved_by?: string | null;
  resolved_at?: string | null;
  reopened_by?: string | null;
  reopened_at?: string | null;
  deleted_by?: string | null;
  deleted_at?: string | null;
}

function parseAnchor(raw: unknown, slideId: string | null): DeckCommentAnchor {
  let obj: any = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      obj = null;
    }
  }
  if (obj && typeof obj === 'object' && obj.kind === 'slide' && typeof obj.slideId === 'string') {
    return { kind: 'slide', slideId: obj.slideId };
  }
  if (slideId) return { kind: 'slide', slideId };
  return { kind: 'deck' };
}

function toIso(v: string | Date): string {
  return v instanceof Date ? v.toISOString() : String(v);
}

function toBool(v: unknown): boolean {
  return v === true || v === 't' || v === 'true' || v === 1 || v === '1';
}

function rowToComment(row: CommentRow): DeckComment {
  const slideId = row.slide_id ?? null;
  return {
    id: row.id,
    threadId: row.thread_id,
    deckId: row.deck_id,
    organizationId: row.organization_id,
    slideId,
    parentCommentId: row.parent_comment_id ?? undefined,
    anchor: parseAnchor(row.anchor, slideId),
    author: row.author,
    body: row.body,
    resolved: toBool(row.resolved),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    resolvedBy: row.resolved_by ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    reopenedBy: row.reopened_by ?? undefined,
    reopenedAt: row.reopened_at ?? undefined,
    deletedBy: row.deleted_by ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
  };
}

async function daoLoadForOrg(organizationId: string): Promise<DeckComment[]> {
  if (!organizationId) return [];
  try {
    const rows = (await dbAll(
      `SELECT * FROM deck_comments WHERE organization_id = ? ORDER BY created_at ASC`,
      [organizationId]
    )) as CommentRow[];
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.map(rowToComment);
  } catch (err) {
    logger.warn('[DeckComments][Dao] loadForOrg failed', {
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

async function daoPersist(c: DeckComment, options: { throwOnError?: boolean } = {}): Promise<void> {
  if (!c.id || !c.deckId || !c.organizationId) return;
  try {
    await dbRun(
      `INSERT INTO deck_comments (
         id, thread_id, deck_id, organization_id, slide_id, parent_comment_id,
         anchor, author, body, resolved, created_at, updated_at,
         resolved_by, resolved_at, reopened_by, reopened_at, deleted_by, deleted_at
       ) VALUES (
         ?, ?, ?, ?, ?, ?,
         ?::jsonb, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?
       )
       ON CONFLICT (id) DO UPDATE SET
         body        = EXCLUDED.body,
         resolved    = EXCLUDED.resolved,
         updated_at  = EXCLUDED.updated_at,
         resolved_by = EXCLUDED.resolved_by,
         resolved_at = EXCLUDED.resolved_at,
         reopened_by = EXCLUDED.reopened_by,
         reopened_at = EXCLUDED.reopened_at,
         deleted_by  = EXCLUDED.deleted_by,
         deleted_at  = EXCLUDED.deleted_at`,
      [
        c.id,
        c.threadId,
        c.deckId,
        c.organizationId,
        c.slideId ?? null,
        c.parentCommentId ?? null,
        JSON.stringify(c.anchor),
        c.author,
        c.body,
        c.resolved,
        c.createdAt,
        c.updatedAt,
        c.resolvedBy ?? null,
        c.resolvedAt ?? null,
        c.reopenedBy ?? null,
        c.reopenedAt ?? null,
        c.deletedBy ?? null,
        c.deletedAt ?? null,
      ]
    );
  } catch (err) {
    logger.warn('[DeckComments][Dao] persist failed', {
      id: c.id,
      organizationId: c.organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    if (options.throwOnError) throw err;
  }
}

/**
 * Wait until a comment mutation is visible in the shared database.
 *
 * Normal writes remain write-through for backwards compatibility, but HTTP
 * mutation routes await this function before reporting success. Otherwise a
 * following GET routed to another application instance can legitimately see
 * zero threads while the UI has already shown "Comment added".
 */
export async function persistDeckCommentNow(comment: DeckComment): Promise<void> {
  await daoPersist(comment, { throwOnError: true });
}

// =============================================================================
// Hydration
// =============================================================================

async function ensureHydrated(organizationId: string): Promise<void> {
  if (hydratedOrgs.has(organizationId)) return;
  const inflight = hydrationInflight.get(organizationId);
  if (inflight) return inflight;
  const promise = (async () => {
    try {
      const comments = await daoLoadForOrg(organizationId);
      for (const c of comments) {
        const k = key(c.organizationId, c.deckId);
        const list = commentStore.get(k) ?? [];
        list.push(c);
        commentStore.set(k, list);
        commentIndex.set(c.id, c);
      }
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

/** Merge the latest persisted rows into this process' cache (multi-instance safe). */
export async function refreshDeckCommentsFromPersistence(organizationId: string): Promise<void> {
  const comments = await daoLoadForOrg(organizationId);
  for (const c of comments) {
    const k = key(c.organizationId, c.deckId);
    const list = commentStore.get(k) ?? [];
    const idx = list.findIndex((existing) => existing.id === c.id);
    if (idx >= 0) list[idx] = c;
    else list.push(c);
    list.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
    commentStore.set(k, list);
    commentIndex.set(c.id, c);
  }
  hydratedOrgs.add(organizationId);
}

export async function ensureDeckCommentsHydrated(organizationId: string): Promise<void> {
  return ensureHydrated(organizationId);
}

// =============================================================================
// Internal helpers
// =============================================================================

function validateBody(body: unknown): asserts body is string {
  if (typeof body !== 'string')
    throw new DeckCommentError('invalid_input', 'body must be a string');
  const trimmed = body.trim();
  if (trimmed.length === 0) throw new DeckCommentError('invalid_input', 'body must not be empty');
  if (trimmed.length > 10_000)
    throw new DeckCommentError('invalid_input', 'body exceeds 10000 chars');
}

function getStored(commentId: string, organizationId: string): DeckComment {
  const c = commentIndex.get(commentId);
  if (!c || c.organizationId !== organizationId) {
    throw new DeckCommentError(
      'unknown_comment',
      `comment ${commentId} not found in organization ${organizationId}`
    );
  }
  return c;
}

function writeComment(c: DeckComment): void {
  const k = key(c.organizationId, c.deckId);
  const list = commentStore.get(k) ?? [];
  const idx = list.findIndex((x) => x.id === c.id);
  if (idx >= 0) list[idx] = c;
  else list.push(c);
  commentStore.set(k, list);
  commentIndex.set(c.id, c);
  void daoPersist(c);
}

function threadComments(threadId: string, organizationId: string): DeckComment[] {
  const out: DeckComment[] = [];
  for (const c of commentIndex.values()) {
    if (c.threadId === threadId && c.organizationId === organizationId) out.push(c);
  }
  out.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  return out;
}

// =============================================================================
// Public surface
// =============================================================================

export interface CreateDeckCommentParams {
  organizationId: string;
  deckId: string;
  author: string;
  body: string;
  slideId?: string | null;
}

export function createDeckComment(params: CreateDeckCommentParams): DeckComment {
  if (!params.organizationId)
    throw new DeckCommentError('invalid_input', 'organizationId is required');
  if (!params.deckId) throw new DeckCommentError('invalid_input', 'deckId is required');
  if (!params.author) throw new DeckCommentError('invalid_input', 'author is required');
  validateBody(params.body);

  const slideId =
    typeof params.slideId === 'string' && params.slideId.trim().length > 0
      ? params.slideId.trim()
      : null;
  const anchor: DeckCommentAnchor = slideId ? { kind: 'slide', slideId } : { kind: 'deck' };

  const id = makeId('deckcmt');
  const now = nowIso();
  const comment: DeckComment = {
    id,
    threadId: id,
    deckId: params.deckId,
    organizationId: params.organizationId,
    slideId,
    parentCommentId: undefined,
    anchor,
    author: params.author,
    body: params.body.trim(),
    resolved: false,
    createdAt: now,
    updatedAt: now,
  };
  writeComment(comment);
  return cloneComment(comment);
}

export interface ReplyToDeckCommentParams {
  organizationId: string;
  deckId: string;
  author: string;
  parentCommentId: string;
  body: string;
}

export function replyToDeckComment(params: ReplyToDeckCommentParams): DeckComment {
  if (!params.organizationId)
    throw new DeckCommentError('invalid_input', 'organizationId is required');
  if (!params.deckId) throw new DeckCommentError('invalid_input', 'deckId is required');
  if (!params.author) throw new DeckCommentError('invalid_input', 'author is required');
  if (!params.parentCommentId)
    throw new DeckCommentError('invalid_input', 'parentCommentId is required');
  validateBody(params.body);

  const parent = getStored(params.parentCommentId, params.organizationId);
  if (parent.deckId !== params.deckId) {
    throw new DeckCommentError('forbidden', 'parent comment belongs to a different deck');
  }
  if (parent.deletedAt) throw new DeckCommentError('comment_deleted', 'parent comment was deleted');
  if (parent.parentCommentId !== undefined) {
    throw new DeckCommentError(
      'reply_to_reply_forbidden',
      'replies can only target the root of a thread'
    );
  }

  const id = makeId('deckcmt');
  const now = nowIso();
  const reply: DeckComment = {
    id,
    threadId: parent.threadId,
    deckId: parent.deckId,
    organizationId: parent.organizationId,
    slideId: parent.slideId,
    parentCommentId: parent.id,
    anchor: parent.anchor,
    author: params.author,
    body: params.body.trim(),
    resolved: parent.resolved,
    createdAt: now,
    updatedAt: now,
  };
  writeComment(reply);
  // Bump root updatedAt so thread sorting reflects activity.
  writeComment({ ...parent, updatedAt: now });
  return cloneComment(reply);
}

export interface ResolveDeckCommentParams {
  organizationId: string;
  deckId: string;
  userId: string;
  commentId: string;
  resolved: boolean;
}

/**
 * Set resolved state thread-wide (resolve when `resolved=true`, reopen when
 * `false`). `commentId` may target the root or any reply. Idempotent.
 */
export function setDeckCommentResolved(params: ResolveDeckCommentParams): DeckComment {
  if (!params.organizationId)
    throw new DeckCommentError('invalid_input', 'organizationId is required');
  if (!params.deckId) throw new DeckCommentError('invalid_input', 'deckId is required');
  if (!params.userId) throw new DeckCommentError('invalid_input', 'userId is required');
  if (!params.commentId) throw new DeckCommentError('invalid_input', 'commentId is required');

  const target = getStored(params.commentId, params.organizationId);
  if (target.deckId !== params.deckId) {
    throw new DeckCommentError('forbidden', 'comment belongs to a different deck');
  }
  if (target.deletedAt) throw new DeckCommentError('comment_deleted', 'comment was deleted');

  const now = nowIso();
  const comments = threadComments(target.threadId, params.organizationId);
  let root: DeckComment | null = null;
  for (const c of comments) {
    if (c.deletedAt) continue;
    const next: DeckComment = params.resolved
      ? {
          ...c,
          resolved: true,
          resolvedBy: params.userId,
          resolvedAt: now,
          reopenedBy: undefined,
          reopenedAt: undefined,
          updatedAt: now,
        }
      : {
          ...c,
          resolved: false,
          resolvedBy: undefined,
          resolvedAt: undefined,
          reopenedBy: params.userId,
          reopenedAt: now,
          updatedAt: now,
        };
    writeComment(next);
    if (c.parentCommentId === undefined) root = next;
  }
  if (!root) {
    const candidate = commentIndex.get(target.threadId);
    root = candidate ? cloneComment(candidate) : cloneComment(target);
  }
  return cloneComment(root);
}

export interface DeleteDeckCommentParams {
  organizationId: string;
  deckId: string;
  userId: string;
  commentId: string;
}

/** Author-only soft-delete. The row stays; body is blanked, deletedAt stamped. */
export function deleteDeckComment(params: DeleteDeckCommentParams): DeckComment {
  if (!params.organizationId)
    throw new DeckCommentError('invalid_input', 'organizationId is required');
  if (!params.deckId) throw new DeckCommentError('invalid_input', 'deckId is required');
  if (!params.userId) throw new DeckCommentError('invalid_input', 'userId is required');
  if (!params.commentId) throw new DeckCommentError('invalid_input', 'commentId is required');

  const target = getStored(params.commentId, params.organizationId);
  if (target.deckId !== params.deckId) {
    throw new DeckCommentError('forbidden', 'comment belongs to a different deck');
  }
  if (target.author !== params.userId) {
    throw new DeckCommentError('forbidden', 'only the author can delete this comment');
  }
  if (target.deletedAt) return cloneComment(target);

  const now = nowIso();
  const next: DeckComment = {
    ...target,
    body: '',
    deletedBy: params.userId,
    deletedAt: now,
    updatedAt: now,
  };
  writeComment(next);
  return cloneComment(next);
}

// =============================================================================
// Read surface
// =============================================================================

export interface ListDeckCommentsOptions {
  /** Filter by resolved state. */
  resolved?: boolean;
  /** Hide soft-deleted comments. Default true. */
  hideDeleted?: boolean;
  /** Filter to a single slide's threads. */
  slideId?: string;
}

/** Grouped thread view for the deck. Most-recent activity first. */
export function listDeckCommentThreads(
  deckId: string,
  organizationId: string,
  options: ListDeckCommentsOptions = {}
): DeckCommentThread[] {
  if (!deckId || !organizationId) return [];
  const list = commentStore.get(key(organizationId, deckId)) ?? [];
  if (list.length === 0) return [];

  const groups = new Map<string, DeckComment[]>();
  for (const c of list) {
    const bucket = groups.get(c.threadId) ?? [];
    bucket.push(c);
    groups.set(c.threadId, bucket);
  }

  const hideDeleted = options.hideDeleted !== false;
  const out: DeckCommentThread[] = [];
  for (const [threadId, comments] of groups.entries()) {
    comments.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
    let root = comments.find((c) => c.parentCommentId === undefined);
    if (!root) root = comments[0]!;
    const replies = comments.filter((c) => c.id !== root!.id);

    if (hideDeleted && root.deletedAt && replies.length === 0) continue;
    if (typeof options.resolved === 'boolean' && root.resolved !== options.resolved) continue;
    if (options.slideId) {
      if (root.anchor.kind !== 'slide' || root.anchor.slideId !== options.slideId) continue;
    }

    let updatedAt = root.updatedAt;
    for (const c of comments) if (c.updatedAt > updatedAt) updatedAt = c.updatedAt;

    out.push({
      threadId,
      deckId,
      organizationId,
      anchor: root.anchor,
      resolved: root.resolved,
      root: cloneComment(root),
      replies: replies.map(cloneComment),
      createdAt: root.createdAt,
      updatedAt,
    });
  }
  out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  return out;
}

export interface DeckCommentCounts {
  deckId: string;
  organizationId: string;
  totalOpen: number;
  totalResolved: number;
  perSlide: Record<string, { open: number; resolved: number }>;
}

export function getDeckCommentCounts(deckId: string, organizationId: string): DeckCommentCounts {
  const counts: DeckCommentCounts = {
    deckId,
    organizationId,
    totalOpen: 0,
    totalResolved: 0,
    perSlide: {},
  };
  if (!deckId || !organizationId) return counts;
  const threads = listDeckCommentThreads(deckId, organizationId);
  for (const t of threads) {
    const bucket = t.resolved ? 'resolved' : 'open';
    if (bucket === 'open') counts.totalOpen += 1;
    else counts.totalResolved += 1;
    if (t.anchor.kind === 'slide') {
      const s = counts.perSlide[t.anchor.slideId] ?? { open: 0, resolved: 0 };
      s[bucket] += 1;
      counts.perSlide[t.anchor.slideId] = s;
    }
  }
  return counts;
}

// =============================================================================
// Test-only helpers
// =============================================================================

/** @internal */
export function __resetDeckCommentsForTests(): void {
  commentStore.clear();
  commentIndex.clear();
  hydratedOrgs.clear();
  hydrationInflight.clear();
}
