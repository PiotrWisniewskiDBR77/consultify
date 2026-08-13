/**
 * Shared Method Kernel — browser HTTP client (P0, 2026-08-13).
 *
 * Talks to `server/src/routes/method-core.routes.ts` (`/api/method/...`).
 * This is the ONLY place in the UI layer that should build a request to
 * that router — callers (the DRD session runtime, the workspace screen)
 * import functions/types from here, never `fetch`/`fetchWithRetry` directly.
 *
 * Reuses this repo's existing fetch plumbing (`fetchWithRetry`/`getHeaders`
 * from `src/services/api/baseClient.ts` — auth header injection, 401 retry,
 * in-flight GET de-dupe, hard timeout) rather than inventing a second HTTP
 * stack. Response parsing is intentionally its OWN small `handleResponse`
 * (not `src/services/apiUtils.ts`'s, which only preserves `.status`/`.code`
 * on error) because callers here need the FULL error body — `currentVersion`
 * on a 409, `requiredRole` on a 403, `refusal` on a 422 — to drive the
 * required loading/error/offline/recovery/409-conflict UI states.
 */

import { fetchWithRetry, getHeaders } from '@/services/api/baseClient';
import type {
  MethodActorKind,
  MethodEvent,
  MethodEventType,
  MethodProcessRole,
  MethodSession,
  MethodSessionState,
  TeresaCapabilityId,
  TeresaCommitRefusal,
  TeresaPreview,
  TeresaProposedChange,
  TeresaQualityVerdict,
  TeresaStatement,
} from '@/method-core/contracts';

const BASE = '/api/method';

// ---------------------------------------------------------------------------
// Error type — callers branch on `.status` and `.body`, never re-parse JSON.
// ---------------------------------------------------------------------------

export class MethodCoreApiError extends Error {
  readonly status: number;
  readonly body: Record<string, unknown>;
  /** True for network-level failures (fetch itself rejected/timed out) —
   * this is the signal the UI's `offline` state is built on. */
  readonly isNetworkError: boolean;

  constructor(message: string, status: number, body: Record<string, unknown>, isNetworkError = false) {
    super(message);
    this.name = 'MethodCoreApiError';
    this.status = status;
    this.body = body;
    this.isNetworkError = isNetworkError;
  }
}

export function isVersionConflict(err: unknown): err is MethodCoreApiError & { body: { currentVersion: number } } {
  return err instanceof MethodCoreApiError && err.status === 409 && err.body.error === 'version_conflict';
}

export function isAuthError(err: unknown): boolean {
  return err instanceof MethodCoreApiError && (err.status === 401 || err.status === 403);
}

export function isOfflineError(err: unknown): boolean {
  return err instanceof MethodCoreApiError && err.isNetworkError;
}

async function handle<T>(promise: Promise<Response>): Promise<T> {
  let res: Response;
  try {
    res = await promise;
  } catch (err) {
    // fetchWithRetry's own AbortController fires on timeout; a rejected
    // fetch this far out is a real connectivity failure, not a 4xx/5xx.
    throw new MethodCoreApiError(
      err instanceof Error ? err.message : 'Network request failed',
      0,
      {},
      true
    );
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok) {
    throw new MethodCoreApiError(
      typeof body.error === 'string' ? body.error : `Request failed with ${res.status}`,
      res.status,
      body
    );
  }
  return body as T;
}

function idempotencyHeader(key: string): Record<string, string> {
  return { 'Idempotency-Key': key };
}

/** Generates a fresh idempotency key. Callers that retry a FAILED request
 * (network error / timeout) should reuse the SAME key on retry — generating
 * a new one only on the first attempt is the caller's responsibility (the
 * DRD runtime does this; see its retry queue). */
export function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ---------------------------------------------------------------------------
// Packs (Library)
// ---------------------------------------------------------------------------

export interface MethodPackSummary {
  readonly id: string;
  readonly organizationId: string;
  readonly packId: string;
  readonly version: string;
  readonly name: string;
  readonly readiness: string;
  readonly createdAt: string;
}

export async function listPacks(): Promise<MethodPackSummary[]> {
  const res = await handle<{ packs: MethodPackSummary[] }>(
    fetchWithRetry(`${BASE}/packs`, { method: 'GET', headers: getHeaders() })
  );
  return res.packs;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export interface CreateSessionRequest {
  readonly module: MethodSession['module'];
  readonly methodPackId: string;
  readonly methodPackVersion: string;
  readonly mode: MethodSession['mode'];
  readonly projectId?: string | null;
  /** Only takes effect when the server-side operator flag is also on AND
   * NODE_ENV is non-production — see server/src/method-core/demoBypass.ts.
   * Setting this true in prod code is inert, not a security hole. */
  readonly demoBypass?: boolean;
}

export interface CreateSessionResponse {
  readonly session: MethodSession;
  readonly idempotentReplay: boolean;
  readonly demoBypassActive?: boolean;
  readonly demoBypassNotice?: string;
}

export async function createSession(
  input: CreateSessionRequest,
  idempotencyKey: string
): Promise<CreateSessionResponse> {
  return handle<CreateSessionResponse>(
    fetchWithRetry(`${BASE}/sessions`, {
      method: 'POST',
      headers: { ...getHeaders(), ...idempotencyHeader(idempotencyKey) },
      body: JSON.stringify(input),
    })
  );
}

export async function getSession(
  sessionId: string
): Promise<{ session: MethodSession; roles: MethodProcessRole[] }> {
  return handle(fetchWithRetry(`${BASE}/sessions/${sessionId}`, { method: 'GET', headers: getHeaders() }));
}

export async function listEvents(sessionId: string): Promise<MethodEvent[]> {
  const res = await handle<{ events: MethodEvent[] }>(
    fetchWithRetry(`${BASE}/sessions/${sessionId}/events`, { method: 'GET', headers: getHeaders() })
  );
  return res.events;
}

export interface AppendEventRequest {
  readonly type: MethodEventType;
  readonly unitId?: string;
  readonly level?: number;
  readonly actorKind?: Extract<MethodActorKind, 'human' | 'teresa'>;
  readonly supersedes?: string;
  readonly payload: unknown;
}

export async function appendEvent(
  sessionId: string,
  input: AppendEventRequest,
  idempotencyKey: string
): Promise<MethodEvent> {
  const res = await handle<{ event: MethodEvent }>(
    fetchWithRetry(`${BASE}/sessions/${sessionId}/events`, {
      method: 'POST',
      headers: { ...getHeaders(), ...idempotencyHeader(idempotencyKey) },
      body: JSON.stringify(input),
    })
  );
  return res.event;
}

export interface TransitionRequest {
  readonly to: MethodSessionState;
  readonly rationale?: string;
  /** The session `version` the caller last observed. A mismatch on the
   * server refuses with 409 (see `isVersionConflict`) before writing anything. */
  readonly expectedVersion?: number;
}

export async function transition(
  sessionId: string,
  input: TransitionRequest,
  idempotencyKey: string
): Promise<MethodSession> {
  const res = await handle<{ session: MethodSession }>(
    fetchWithRetry(`${BASE}/sessions/${sessionId}/transition`, {
      method: 'POST',
      headers: { ...getHeaders(), ...idempotencyHeader(idempotencyKey) },
      body: JSON.stringify(input),
    })
  );
  return res.session;
}

// ---------------------------------------------------------------------------
// Teresa: Intent -> Preview -> Commit
// ---------------------------------------------------------------------------

export interface TeresaPreviewRequest {
  readonly capabilityId: TeresaCapabilityId;
  readonly unitId?: string;
  readonly level?: number;
  readonly questionId?: string;
  readonly utterance?: string;
  readonly invokedBy?: 'conversation' | 'local_action';
  readonly statements: readonly TeresaStatement[];
  readonly proposedChanges: readonly TeresaProposedChange[];
  readonly quality: TeresaQualityVerdict;
  readonly ttlMs?: number;
}

export async function teresaPreview(sessionId: string, input: TeresaPreviewRequest): Promise<TeresaPreview> {
  const res = await handle<{ preview: TeresaPreview }>(
    fetchWithRetry(`${BASE}/sessions/${sessionId}/teresa/preview`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(input),
    })
  );
  return res.preview;
}

export interface TeresaCommitRequestInput {
  readonly previewId: string;
  readonly decision: 'accept' | 'accept_with_edits' | 'reject' | 'rethink';
  readonly editedChanges?: readonly TeresaProposedChange[];
}

export type TeresaCommitOutcome =
  | { readonly ok: true; readonly eventIds: readonly string[] }
  | { readonly ok: false; readonly refusal: TeresaCommitRefusal };

export async function teresaCommit(
  sessionId: string,
  input: TeresaCommitRequestInput,
  idempotencyKey: string
): Promise<TeresaCommitOutcome> {
  try {
    const res = await handle<{ ok: true; eventIds: string[] }>(
      fetchWithRetry(`${BASE}/sessions/${sessionId}/teresa/commit`, {
        method: 'POST',
        headers: { ...getHeaders(), ...idempotencyHeader(idempotencyKey) },
        body: JSON.stringify(input),
      })
    );
    return res;
  } catch (err) {
    if (err instanceof MethodCoreApiError && typeof err.body.error === 'string') {
      return { ok: false, refusal: err.body.refusal as TeresaCommitRefusal };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Freeze -> Output
// ---------------------------------------------------------------------------

export interface FreezeResponse {
  readonly session: MethodSession;
  readonly output: MethodOutputSummary;
  readonly selfHealed: boolean;
}

export async function freeze(
  sessionId: string,
  idempotencyKey: string,
  expectedVersion?: number
): Promise<FreezeResponse> {
  return handle<FreezeResponse>(
    fetchWithRetry(`${BASE}/sessions/${sessionId}/freeze`, {
      method: 'POST',
      headers: { ...getHeaders(), ...idempotencyHeader(idempotencyKey) },
      body: JSON.stringify(expectedVersion !== undefined ? { expectedVersion } : {}),
    })
  );
}

// ---------------------------------------------------------------------------
// Outputs / Reports / Initiative Drafts
// ---------------------------------------------------------------------------

export interface MethodOutputFindingSummary {
  readonly id: string;
  readonly unitId: string;
  readonly unitName: string;
  readonly currentLevel: number | null;
  readonly targetLevel: number | null;
  readonly gap: number | null;
  readonly businessMeaning: string;
  readonly recommendation: string;
}

export interface MethodOutputSummary {
  readonly id: string;
  readonly organizationId: string;
  readonly sessionId: string;
  readonly module: 'assessment' | 'tools' | 'audits';
  readonly methodPackId: string;
  readonly methodPackVersion: string;
  readonly outputVersion: number;
  readonly scope: string;
  readonly current: Record<string, number | null>;
  readonly target: Record<string, number | null>;
  readonly gap: Record<string, number | null>;
  readonly limitations: readonly string[];
  readonly findings: readonly MethodOutputFindingSummary[];
  readonly contentHash: string;
  readonly frozenAt: string;
}

export async function getOutput(
  outputId: string
): Promise<{ output: MethodOutputSummary; superseded: boolean; supersededByOutputId: string | null }> {
  return handle(fetchWithRetry(`${BASE}/outputs/${outputId}`, { method: 'GET', headers: getHeaders() }));
}

export interface CreateReportRequest {
  readonly title: string;
  readonly content: unknown;
}

export async function createReport(outputId: string, input: CreateReportRequest): Promise<unknown> {
  const res = await handle<{ report: unknown }>(
    fetchWithRetry(`${BASE}/outputs/${outputId}/report`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(input),
    })
  );
  return res.report;
}

export interface CreateInitiativeDraftRequest {
  readonly title: string;
  readonly summary?: string;
  readonly findingIds: readonly string[];
  readonly rationale: string;
  readonly expectedOutcome: string;
  readonly kpiProposal?: unknown;
  readonly dependencies?: readonly unknown[];
  readonly risks?: readonly unknown[];
  readonly evidenceLinks?: readonly string[];
  readonly confidence: 'low' | 'medium' | 'high';
}

export async function createInitiativeDraft(outputId: string, input: CreateInitiativeDraftRequest): Promise<unknown> {
  const res = await handle<{ draft: unknown }>(
    fetchWithRetry(`${BASE}/outputs/${outputId}/initiative-drafts`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(input),
    })
  );
  return res.draft;
}
