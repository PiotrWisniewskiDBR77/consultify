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

/** One row of `GET /api/method/sessions` — a `MethodSession` plus the one
 * field the list route enriches per-page (`hasFrozenOutput`, cheaper than a
 * second round-trip per row from the caller's side — see the route's doc
 * comment on why it's computed there instead of here). */
export interface MethodSessionListItem extends MethodSession {
  readonly hasFrozenOutput: boolean;
}

export interface ListSessionsParams {
  readonly methodPackId?: string;
  readonly projectId?: string;
  readonly ownerUserId?: string;
  readonly state?: MethodSessionState;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListSessionsResult {
  readonly sessions: readonly MethodSessionListItem[];
  readonly total: number | null;
}

/** `GET /api/method/sessions?methodPackId=&projectId=&ownerUserId=&state=&limit=&offset=`
 * — "pokaż moje sesje": every session in the org (or scoped), read straight
 * from `method_sessions`, never reconstructed from event replay (see
 * MethodSessionService.listForOrganization's doc comment). Rows come back
 * raw (no envelope, same camelCase shape as `getSession`'s `session`) —
 * mirrors `getSession`/`listEvents`'s minimal-parsing discipline rather than
 * `listOutputs`'s per-field defensive normalizer, since this is the SAME
 * session shape those two already trust unparsed. */
export async function listSessions(params: ListSessionsParams = {}): Promise<ListSessionsResult> {
  const qs = new URLSearchParams();
  if (params.methodPackId) qs.set('methodPackId', params.methodPackId);
  if (params.projectId) qs.set('projectId', params.projectId);
  if (params.ownerUserId) qs.set('ownerUserId', params.ownerUserId);
  if (params.state) qs.set('state', params.state);
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const body = await handle<{ sessions?: unknown; total?: unknown }>(
    fetchWithRetry(`${BASE}/sessions${suffix}`, { method: 'GET', headers: getHeaders() })
  );
  const sessions = Array.isArray(body.sessions) ? (body.sessions as MethodSessionListItem[]) : [];
  return { sessions, total: typeof body.total === 'number' ? body.total : null };
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

// ---------------------------------------------------------------------------
// P0D — Outputs / Reports / Presentations / Initiative Drafts LISTING +
// session lineage. Built against the parallel-team API contract described in
// the P0D brief (paths agreed, response shape documented as "envelope
// {success, data} OR raw — parse defensively"). AT THE TIME THIS WAS WRITTEN
// the corresponding `router.get(...)` handlers for these paths did not yet
// exist in `server/src/routes/method-core.routes.ts` (confirmed by reading
// the file — only `/outputs/:id`, `/outputs/:id/report`,
// `/outputs/:id/presentation` and `/outputs/:id/initiative-drafts` (POST)
// existed). Everything below is written to the AGREED contract and parses
// defensively (multiple plausible field names, envelope-or-raw), but has
// NOT been exercised against a live matching server from this package —
// say so plainly in any handoff, do not claim it as verified end-to-end.
// ---------------------------------------------------------------------------

/**
 * Unwraps the `{success, data}` envelope the contract says the server MAY
 * use, while also accepting a raw body (no envelope) — "parsuj defensywnie"
 * per the P0D brief. Never throws: an unrecognized shape falls through to
 * the caller's own defensive array/field extraction, which in turn falls
 * back to an empty, honestly-empty result rather than a crash.
 */
function unwrapData<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'data' in (body as Record<string, unknown>)) {
    const data = (body as Record<string, unknown>).data;
    if (data !== undefined) return data as T;
  }
  return body as T;
}

/** First array found under any of `keys` on `data`, else `data` itself if it
 * is already an array, else `[]`. Never fabricates rows. */
function extractArray<T>(data: unknown, keys: readonly string[]): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) return value as T[];
    }
  }
  return [];
}

function extractNumber(data: unknown, keys: readonly string[]): number | null {
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
    }
  }
  return null;
}

/** Supersession status shared by Outputs, Report/Presentation snapshots and
 * Initiative Drafts (server: `ReportSupersedenceStatus` / `DraftSupersedenceStatus`). */
export type MethodArtefactStatus = 'current' | 'superseded' | 'source_updated';

/**
 * One row of the org-wide (or session/project-scoped) Outputs list —
 * `GET /api/method/outputs`. Deliberately a SUBSET of `MethodOutputSummary`'s
 * sibling server type (`MethodOutputRecord`): only fields a list row plus its
 * preview card can honestly show without a second fetch. `null`/absent
 * fields stay `null` — nothing here is a fabricated default; see
 * `normalizeOutputListItem` below.
 */
export interface MethodOutputListItem {
  readonly id: string;
  readonly organizationId: string | null;
  readonly sessionId: string | null;
  readonly module: string | null;
  readonly methodPackId: string | null;
  readonly methodPackVersion: string | null;
  readonly outputVersion: number | null;
  readonly revisionOfOutputId: string | null;
  readonly scope: string | null;
  readonly limitationsCount: number | null;
  readonly findingsCount: number | null;
  readonly contentHash: string | null;
  readonly frozenAt: string | null;
  readonly createdAt: string | null;
  readonly demoBypassActive: boolean;
  /** Present when the list endpoint itself resolves supersession per row
   * (mirrors `GET /outputs/:id`'s `isSuperseded`/`supersededByOutputId`).
   * `null` means the list row did not carry this — callers needing a
   * guaranteed answer should fall back to `getOutput`/`listOutputRevisions`. */
  readonly isSuperseded: boolean | null;
  readonly supersededByOutputId: string | null;
}

function toNullableStr(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s : null;
}

function toNullableNum(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeOutputListItem(row: unknown): MethodOutputListItem | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = toNullableStr(r.id);
  if (!id) return null;
  const findings = Array.isArray(r.findings) ? r.findings.length : null;
  const limitations = Array.isArray(r.limitations) ? r.limitations.length : null;
  // ★ CONTRACT FIX (2026-08-13, T2): the REAL `GET /api/method/outputs` row
  // (MethodOutputService.listForOrganization / MethodOutputListItem, server
  // side) carries per-row supersession as `status: 'current' | 'superseded'`
  // — it never sends a literal `isSuperseded` boolean. Reading only
  // `r.isSuperseded` left this field ALWAYS `null`, which silently degraded
  // AssessmentOutputsTab to its page-scoped `revisionOfOutputId` fallback
  // heuristic (correct only within one fetched page — see that file's
  // `isRowSuperseded` doc comment) instead of the server's authoritative,
  // org-wide answer. Prefer a real `status` string when present; accept a
  // literal `isSuperseded` boolean too (defensive, in case a future/other
  // server build sends that shape instead) — never fabricate a value when
  // neither is present.
  const statusRaw = toNullableStr(r.status);
  const isSupersededFromStatus =
    statusRaw === 'superseded' ? true : statusRaw === 'current' ? false : null;
  return {
    id,
    organizationId: toNullableStr(r.organizationId),
    sessionId: toNullableStr(r.sessionId),
    module: toNullableStr(r.module),
    methodPackId: toNullableStr(r.methodPackId),
    methodPackVersion: toNullableStr(r.methodPackVersion),
    outputVersion: toNullableNum(r.outputVersion),
    revisionOfOutputId: toNullableStr(r.revisionOfOutputId),
    scope: toNullableStr(r.scope),
    limitationsCount: toNullableNum(r.limitationsCount) ?? limitations,
    findingsCount: toNullableNum(r.findingsCount) ?? findings,
    contentHash: toNullableStr(r.contentHash),
    frozenAt: toNullableStr(r.frozenAt),
    createdAt: toNullableStr(r.createdAt),
    demoBypassActive: r.demoBypassActive === true,
    isSuperseded: typeof r.isSuperseded === 'boolean' ? r.isSuperseded : isSupersededFromStatus,
    supersededByOutputId: toNullableStr(r.supersededByOutputId),
  };
}

export interface ListOutputsParams {
  readonly sessionId?: string;
  readonly projectId?: string;
  /** Server-side supersession filter (`GET /outputs` accepts
   * `?status=current|superseded` — see method-core.routes.ts). Omitted by
   * default (returns both). */
  readonly status?: 'current' | 'superseded';
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListOutputsResult {
  readonly outputs: readonly MethodOutputListItem[];
  readonly total: number | null;
}

/** `GET /api/method/outputs?sessionId=&projectId=&status=&limit=&offset=` —
 * the org-wide (or scoped) Outputs list. This is the ONLY correct data
 * source for an "Outputs" list screen — never `/api/artifacts` (a
 * different, unrelated registry) and never a client-side reconstruction
 * from a live session's in-memory state. */
export async function listOutputs(params: ListOutputsParams = {}): Promise<ListOutputsResult> {
  const qs = new URLSearchParams();
  if (params.sessionId) qs.set('sessionId', params.sessionId);
  if (params.projectId) qs.set('projectId', params.projectId);
  if (params.status) qs.set('status', params.status);
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const body = await handle<unknown>(
    fetchWithRetry(`${BASE}/outputs${suffix}`, { method: 'GET', headers: getHeaders() })
  );
  const data = unwrapData<unknown>(body);
  const rawRows = extractArray<unknown>(data, ['outputs', 'items', 'results']);
  const outputs = rawRows
    .map(normalizeOutputListItem)
    .filter((o): o is MethodOutputListItem => o !== null);
  return { outputs, total: extractNumber(data, ['total', 'count']) };
}

/** One entry in an Output's revision chain — `GET /outputs/:id/revisions`. */
export interface MethodOutputRevisionSummary {
  readonly id: string;
  readonly outputVersion: number | null;
  readonly status: MethodArtefactStatus | null;
  readonly supersededByOutputId: string | null;
  readonly frozenAt: string | null;
  readonly contentHash: string | null;
}

function normalizeRevision(row: unknown): MethodOutputRevisionSummary | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = toNullableStr(r.id);
  if (!id) return null;
  const statusRaw = toNullableStr(r.status);
  const status: MethodArtefactStatus | null =
    statusRaw === 'current' || statusRaw === 'superseded' || statusRaw === 'source_updated'
      ? statusRaw
      : null;
  return {
    id,
    outputVersion: toNullableNum(r.outputVersion),
    status,
    supersededByOutputId: toNullableStr(r.supersededByOutputId),
    frozenAt: toNullableStr(r.frozenAt),
    contentHash: toNullableStr(r.contentHash),
  };
}

/** `GET /api/method/outputs/:id/revisions` — the full revision chain for one
 * Output's lineage, current vs superseded distinguished per row. */
export async function listOutputRevisions(
  outputId: string
): Promise<readonly MethodOutputRevisionSummary[]> {
  const body = await handle<unknown>(
    fetchWithRetry(`${BASE}/outputs/${outputId}/revisions`, { method: 'GET', headers: getHeaders() })
  );
  const data = unwrapData<unknown>(body);
  const rows = extractArray<unknown>(data, ['revisions', 'items']);
  return rows.map(normalizeRevision).filter((r): r is MethodOutputRevisionSummary => r !== null);
}

/** Shared shape for a Report OR Presentation snapshot row (server:
 * `MethodReportSnapshotRecord`, `kind` distinguishes the two — SAME
 * immutable-snapshot discipline, same table). */
export interface MethodArtefactSnapshotSummary {
  readonly id: string;
  readonly organizationId: string | null;
  readonly outputId: string | null;
  readonly sessionId: string | null;
  readonly title: string | null;
  readonly contentHash: string | null;
  readonly status: MethodArtefactStatus | null;
  readonly supersededByOutputId: string | null;
  readonly supersededAt: string | null;
  readonly createdAt: string | null;
  readonly kind: 'report' | 'presentation' | null;
  readonly demoBypassActive: boolean;
}

export interface MethodArtefactSnapshotDetail extends MethodArtefactSnapshotSummary {
  /** Structured content as persisted server-side — never an image (screenshot
   * ban, server-enforced). Shape is per-artefact and not further typed here. */
  readonly content: unknown;
}

function normalizeArtefactSnapshot(row: unknown): MethodArtefactSnapshotSummary | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = toNullableStr(r.id);
  if (!id) return null;
  const statusRaw = toNullableStr(r.status);
  const status: MethodArtefactStatus | null =
    statusRaw === 'current' || statusRaw === 'superseded' || statusRaw === 'source_updated'
      ? statusRaw
      : null;
  const kindRaw = toNullableStr(r.kind);
  const kind: 'report' | 'presentation' | null =
    kindRaw === 'report' || kindRaw === 'presentation' ? kindRaw : null;
  return {
    id,
    organizationId: toNullableStr(r.organizationId),
    outputId: toNullableStr(r.outputId),
    sessionId: toNullableStr(r.sessionId),
    title: toNullableStr(r.title),
    contentHash: toNullableStr(r.contentHash),
    status,
    supersededByOutputId: toNullableStr(r.supersededByOutputId),
    supersededAt: toNullableStr(r.supersededAt),
    createdAt: toNullableStr(r.createdAt),
    kind,
    demoBypassActive: r.demoBypassActive === true,
  };
}

export interface ListArtefactSnapshotsParams {
  readonly outputId?: string;
  readonly sessionId?: string;
  /** Server-side supersession filter — `GET /reports`, `GET /presentations`
   * and `GET /initiative-drafts` all accept
   * `?status=current|superseded|source_updated` (see method-core.routes.ts'
   * shared `listArtefactSnapshots` handler and the initiative-drafts route).
   * Omitted by default (returns every status). */
  readonly status?: MethodArtefactStatus;
}

function buildQuery(params: ListArtefactSnapshotsParams): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, value);
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/** `GET /api/method/reports?outputId=&sessionId=&status=` — Report snapshots
 * (`kind === 'report'`). Org-wide when no filter is given. */
export async function listReports(
  params: ListArtefactSnapshotsParams = {}
): Promise<readonly MethodArtefactSnapshotSummary[]> {
  const body = await handle<unknown>(
    fetchWithRetry(`${BASE}/reports${buildQuery(params)}`, { method: 'GET', headers: getHeaders() })
  );
  const data = unwrapData<unknown>(body);
  const rows = extractArray<unknown>(data, ['reports', 'items']);
  return rows
    .map(normalizeArtefactSnapshot)
    .filter((r): r is MethodArtefactSnapshotSummary => r !== null);
}

/** `GET /api/method/reports/:id` — one Report snapshot, WITH its persisted
 * structured `content` (never reconstructed client-side). */
export async function getReportSnapshot(id: string): Promise<MethodArtefactSnapshotDetail | null> {
  const body = await handle<unknown>(
    fetchWithRetry(`${BASE}/reports/${id}`, { method: 'GET', headers: getHeaders() })
  );
  const data = unwrapData<unknown>(body);
  const row =
    data && typeof data === 'object' && 'report' in (data as Record<string, unknown>)
      ? (data as Record<string, unknown>).report
      : data;
  const summary = normalizeArtefactSnapshot(row);
  if (!summary) return null;
  const content = row && typeof row === 'object' ? (row as Record<string, unknown>).content : null;
  return { ...summary, content: content ?? null };
}

/** `GET /api/method/presentations?outputId=&status=` — same table/discipline as
 * Reports, filtered to `kind === 'presentation'` server-side. */
export async function listPresentations(
  params: ListArtefactSnapshotsParams = {}
): Promise<readonly MethodArtefactSnapshotSummary[]> {
  const body = await handle<unknown>(
    fetchWithRetry(`${BASE}/presentations${buildQuery(params)}`, {
      method: 'GET',
      headers: getHeaders(),
    })
  );
  const data = unwrapData<unknown>(body);
  const rows = extractArray<unknown>(data, ['presentations', 'items']);
  return rows
    .map(normalizeArtefactSnapshot)
    .filter((r): r is MethodArtefactSnapshotSummary => r !== null);
}

/** `GET /api/method/presentations/:id` — one Presentation snapshot + content. */
export async function getPresentationSnapshot(
  id: string
): Promise<MethodArtefactSnapshotDetail | null> {
  const body = await handle<unknown>(
    fetchWithRetry(`${BASE}/presentations/${id}`, { method: 'GET', headers: getHeaders() })
  );
  const data = unwrapData<unknown>(body);
  const row =
    data && typeof data === 'object' && 'presentation' in (data as Record<string, unknown>)
      ? (data as Record<string, unknown>).presentation
      : data;
  const summary = normalizeArtefactSnapshot(row);
  if (!summary) return null;
  const content = row && typeof row === 'object' ? (row as Record<string, unknown>).content : null;
  return { ...summary, content: content ?? null };
}

/** Initiative Proposal Draft row (server: `MethodInitiativeDraftRecord`).
 * ★ A DRAFT, not a Registered Initiative — "Register as Initiative" is a
 * separate human action in the Initiatives module, out of this API's reach. */
export interface MethodInitiativeDraftSummary {
  readonly id: string;
  readonly organizationId: string | null;
  readonly outputId: string | null;
  readonly sessionId: string | null;
  readonly title: string | null;
  readonly summary: string | null;
  readonly findingIds: readonly string[];
  readonly rationale: string | null;
  readonly expectedOutcome: string | null;
  readonly confidence: 'low' | 'medium' | 'high' | null;
  readonly status: MethodArtefactStatus | null;
  readonly supersededByOutputId: string | null;
  readonly supersededAt: string | null;
  readonly createdAt: string | null;
}

function normalizeInitiativeDraft(row: unknown): MethodInitiativeDraftSummary | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = toNullableStr(r.id);
  if (!id) return null;
  const statusRaw = toNullableStr(r.status);
  const status: MethodArtefactStatus | null =
    statusRaw === 'current' || statusRaw === 'superseded' || statusRaw === 'source_updated'
      ? statusRaw
      : null;
  const confidenceRaw = toNullableStr(r.confidence);
  const confidence: 'low' | 'medium' | 'high' | null =
    confidenceRaw === 'low' || confidenceRaw === 'medium' || confidenceRaw === 'high'
      ? confidenceRaw
      : null;
  return {
    id,
    organizationId: toNullableStr(r.organizationId),
    outputId: toNullableStr(r.outputId),
    sessionId: toNullableStr(r.sessionId),
    title: toNullableStr(r.title),
    summary: toNullableStr(r.summary),
    findingIds: Array.isArray(r.findingIds) ? r.findingIds.map((f) => String(f)) : [],
    rationale: toNullableStr(r.rationale),
    expectedOutcome: toNullableStr(r.expectedOutcome),
    confidence,
    status,
    supersededByOutputId: toNullableStr(r.supersededByOutputId),
    supersededAt: toNullableStr(r.supersededAt),
    createdAt: toNullableStr(r.createdAt),
  };
}

/** `GET /api/method/initiative-drafts?outputId=&status=` — Initiative Proposal
 * Drafts. Org-wide when no filter is given. */
export async function listInitiativeDrafts(
  params: ListArtefactSnapshotsParams = {}
): Promise<readonly MethodInitiativeDraftSummary[]> {
  const body = await handle<unknown>(
    fetchWithRetry(`${BASE}/initiative-drafts${buildQuery(params)}`, {
      method: 'GET',
      headers: getHeaders(),
    })
  );
  const data = unwrapData<unknown>(body);
  const rows = extractArray<unknown>(data, ['initiativeDrafts', 'drafts', 'items']);
  return rows
    .map(normalizeInitiativeDraft)
    .filter((d): d is MethodInitiativeDraftSummary => d !== null);
}

/** `GET /api/method/initiative-drafts/:id` — one draft, full detail. */
export async function getInitiativeDraft(id: string): Promise<MethodInitiativeDraftSummary | null> {
  const body = await handle<unknown>(
    fetchWithRetry(`${BASE}/initiative-drafts/${id}`, { method: 'GET', headers: getHeaders() })
  );
  const data = unwrapData<unknown>(body);
  const row =
    data && typeof data === 'object' && 'draft' in (data as Record<string, unknown>)
      ? (data as Record<string, unknown>).draft
      : data;
  return normalizeInitiativeDraft(row);
}

/**
 * `GET /api/method/sessions/:id/lineage` — "sesja → rewizje → Output →
 * Report/Presentation → Initiative Proposal". The brief describes this shape
 * in prose only (no field-level schema agreed yet), so this function
 * deliberately returns the envelope-unwrapped body AS-IS (`unknown`) rather
 * than guessing a schema and silently mis-normalizing it. Callers must parse
 * defensively — see `ArtifactLineagePanel`'s `normalizeLineage`, which tries
 * several plausible shapes and falls back to an honest "couldn't read this"
 * state rather than rendering fabricated structure.
 */
export async function getSessionLineage(sessionId: string): Promise<unknown> {
  const body = await handle<unknown>(
    fetchWithRetry(`${BASE}/sessions/${sessionId}/lineage`, { method: 'GET', headers: getHeaders() })
  );
  return unwrapData<unknown>(body);
}
