/**
 * F1/F3 — Client Reader public API client (`ff_client_reader`).
 *
 * Talks to the UNAUTHENTICATED share-link surface on
 * `/api/document-studio/share-links/*` (server/src/routes/document-studio.routes.ts,
 * `documentShareLinkPublicRoutes`). Deliberately plain `fetch` — no bearer
 * token, no `baseClient` helpers — mirroring the existing public reader
 * (`PublicViewPage` → `tablePlatform.api.ts#getSharedViewData`). An
 * anonymous visitor has no session to attach.
 *
 * Every call sends only the opaque share-link `token` (never an
 * organizationId/artifactId the FE might otherwise have cached) — the
 * server resolves tenant + artifact from the token server-side.
 */

import type { DocumentComment } from '../types';

const BASE = '/api/document-studio/share-links';

export class ClientReaderApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number, message?: string) {
    super(message || code);
    this.name = 'ClientReaderApiError';
    this.code = code;
    this.status = status;
  }
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ClientReaderApiError(
      (payload as { error?: string })?.error || 'request_failed',
      res.status,
      (payload as { message?: string })?.message
    );
  }
  return payload as T;
}

export type ReaderAccessScope = 'read' | 'comment' | 'download' | 'edit';

export interface ReaderBlock {
  blockId: string;
  type: string;
  content: unknown;
  isAssumption: boolean;
}

export interface ReaderSection {
  sectionId: string;
  title: string;
  level: number;
  kind: string;
  blocks: ReaderBlock[];
}

export interface ReaderDocument {
  title: string;
  documentType: string;
  language: string;
  sections: ReaderSection[];
}

export interface GetSharedDocumentResult {
  shareLinkId: string;
  accessScope: ReaderAccessScope;
  artifactId: string;
  document: ReaderDocument;
}

/** Resolves the token + returns the whitelisted read-only document projection. */
export function getSharedDocument(token: string): Promise<GetSharedDocumentResult> {
  return postJson<GetSharedDocumentResult>('/document', { token });
}

/** Lists existing comment threads (comment/edit scope only — 403 otherwise). */
export function listSharedComments(token: string): Promise<{ comments: DocumentComment[] }> {
  return postJson('/comments/list', { token });
}

export interface EditSession {
  shareLinkId: string;
  artifactId: string;
  editSessionToken: string;
  expiresAt: string;
}

/** Mints the anonymous-actor session required before posting a comment/reply. */
export function createReaderSession(
  token: string,
  consumerFingerprint: string
): Promise<{ session: EditSession }> {
  return postJson('/edit-session', { token, consumerFingerprint });
}

export function postSharedComment(params: {
  token: string;
  editSessionToken: string;
  consumerFingerprint: string;
  body: string;
  anchor: { kind: 'document' } | { kind: 'section'; sectionId: string };
}): Promise<{ comment: DocumentComment }> {
  const { token, editSessionToken, consumerFingerprint, body, anchor } = params;
  return postJson('/comments', { token, editSessionToken, consumerFingerprint, body, anchor });
}

export function replySharedComment(params: {
  token: string;
  editSessionToken: string;
  consumerFingerprint: string;
  body: string;
  parentCommentId: string;
}): Promise<{ comment: DocumentComment }> {
  const { token, editSessionToken, consumerFingerprint, body, parentCommentId } = params;
  return postJson(`/comments/${encodeURIComponent(parentCommentId)}/reply`, {
    token,
    editSessionToken,
    consumerFingerprint,
    body,
  });
}
