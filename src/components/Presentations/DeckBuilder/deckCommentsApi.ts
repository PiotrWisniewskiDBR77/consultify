/**
 * Deck comments FE client (M19 Presentations, wzór Word DocumentStudio/api).
 *
 * Thin wrappers over `/api/presentations/decks/:deckId/comments` — the deck's
 * reviewer-thread endpoints (full stack ported from Word Epic E6). All calls go
 * through the shared `Api` transport (auth + org headers applied there).
 */

import { Api } from '@/services/api';

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
  reopenedBy?: string;
  deletedAt?: string;
}

export interface DeckCommentThread {
  threadId: string;
  deckId: string;
  anchor: DeckCommentAnchor;
  resolved: boolean;
  root: DeckComment;
  replies: DeckComment[];
  createdAt: string;
  updatedAt: string;
}

export interface DeckCommentCounts {
  deckId: string;
  totalOpen: number;
  totalResolved: number;
  perSlide: Record<string, { open: number; resolved: number }>;
}

interface CommentsListResponse {
  success?: boolean;
  data?: { threads?: DeckCommentThread[]; counts?: DeckCommentCounts };
}

/**
 * `Api` exposes an axios-compatible `response.data` through a Proxy. When the
 * server payload itself also has a `data` envelope, the Proxy getter masks that
 * own property. Read its descriptor so comment endpoints can consume the
 * server's `{ success, data: ... }` contract without changing the shared
 * transport semantics for the rest of the application.
 */
function responseEnvelopeData<T>(response: unknown): T | undefined {
  if (!response || (typeof response !== 'object' && typeof response !== 'function')) {
    return undefined;
  }
  const ownData = Object.getOwnPropertyDescriptor(response, 'data')?.value;
  if (ownData && typeof ownData === 'object') return ownData as T;
  return undefined;
}

function base(deckId: string): string {
  return `/presentations/decks/${encodeURIComponent(deckId)}/comments`;
}

export async function listDeckComments(
  deckId: string,
  opts: { slideId?: string; resolved?: boolean } = {}
): Promise<{ threads: DeckCommentThread[]; counts: DeckCommentCounts | null }> {
  const params = new URLSearchParams();
  if (opts.slideId) params.set('slideId', opts.slideId);
  if (typeof opts.resolved === 'boolean') params.set('resolved', String(opts.resolved));
  const qs = params.toString();
  const res = (await Api.get(`${base(deckId)}${qs ? `?${qs}` : ''}`)) as CommentsListResponse;
  const data = responseEnvelopeData<CommentsListResponse['data']>(res);
  return {
    threads: data?.threads ?? [],
    counts: data?.counts ?? null,
  };
}

export async function addDeckComment(
  deckId: string,
  payload: { body: string; slideId?: string | null; parentCommentId?: string }
): Promise<DeckComment | null> {
  const res = await Api.post(base(deckId), payload);
  return responseEnvelopeData<{ comment?: DeckComment }>(res)?.comment ?? null;
}

export async function setDeckCommentResolved(
  deckId: string,
  commentId: string,
  resolved: boolean
): Promise<DeckComment | null> {
  const res = await Api.patch(`${base(deckId)}/${encodeURIComponent(commentId)}`, {
    resolved,
  });
  return responseEnvelopeData<{ comment?: DeckComment }>(res)?.comment ?? null;
}

export async function deleteDeckComment(
  deckId: string,
  commentId: string
): Promise<DeckComment | null> {
  const res = await Api.delete(`${base(deckId)}/${encodeURIComponent(commentId)}`);
  return responseEnvelopeData<{ comment?: DeckComment }>(res)?.comment ?? null;
}
