/**
 * DRD session runtime — HTTP-backed (P0, 2026-08-13; offline/recovery state
 * machine extended by S3, CEL 4, 2026-08-13).
 *
 * ★ THIS IS THE REPLACEMENT SOURCE OF TRUTH for `drdSessionRuntime.ts`'s
 * `localStorage`-only `DrdSessionRuntime`. Server (`server/src/routes/method-core.routes.ts`
 * over `src/method-core/api/methodCoreApi.ts`) is authoritative; every read
 * re-fetches, every write goes over HTTP first.
 *
 * ★ NOT YET WIRED INTO the LIVE `DrdMethodWorkspaceScreen.tsx` shell as the
 * default (flag `drdHttpSourceOfTruthV1`, default OFF) — see that file's and
 * this program's CLAUDE.md rule #7 ("Piotr nigdy nie jest pierwszym testerem
 * wizualnym").
 *
 * localStorage in this file is used ONLY as:
 *  - a technical cache of the last-known session snapshot (`getCached`), so
 *    a reload can paint something before the network round-trip resolves —
 *    NEVER reported as the final answer to "what is the current state" (see
 *    `refresh()`, which always re-asks the server and always wins);
 *  - a small revision POINTER (`sessionId` + `revision`), used only to
 *    compare against a freshly-fetched server revision during reconnection
 *    (never used to paint content by itself);
 *  - a draft-recovery queue for writes that failed to reach the server
 *    (`pendingWrites`) — replayed only on an explicit `retryPending()` call,
 *    never automatically, never silently dropped without a visible notice.
 *
 * ---------------------------------------------------------------------------
 * Eight visible states (CEL 4 — see `DrdSourceIndicator`/`deriveDrdSourceKind`
 * for the exact mapping the UI renders):
 *
 *   SERVER · SAVING · SAVED · OFFLINE · RECOVERY_DRAFT · CONFLICT ·
 *   RECONNECTING · RECOVERED
 *
 * Hard rules enforced HERE (not just documented):
 *  1. RECOVERY_DRAFT is derived ONLY from "a local write the server has not
 *     confirmed exists" (`pendingWriteCount > 0`) — never from merely being
 *     offline with nothing queued (that is plain OFFLINE), and never once a
 *     write is confirmed (queue drains to 0 -> SERVER/RECOVERED).
 *  2. Zero silent overwrite of the server. A version conflict (409, or a
 *     locally-queued CONFIRMED write whose base revision the server has
 *     since moved past) always stops, keeps the write queued, and requires
 *     an explicit human decision (`retryPending()` again after the caller
 *     resolves it, or `discardPendingAndReloadServer()`).
 *  3. An older local revision never overwrites a newer server one. Applied
 *     literally to DRAFT (disposable) writes queued during `retryPending()`:
 *     if the server moved past a queued draft's base revision, the draft is
 *     dropped and the user is informed (`staleDraftNotices`) — never applied
 *     over newer server content, never silently vanished either.
 *  4. localStorage never holds anything MORE than: (a) a best-effort content
 *     cache for pre-refresh painting, (b) the sessionId+revision pointer,
 *     (c) the pending-write queue. No other "source of truth" lives there.
 */

import type {
  MethodEvent,
  MethodEventType,
  MethodProcessRole,
  MethodSession,
  MethodSessionState,
  TeresaPreview,
} from '@/method-core/contracts';

import {
  appendEvent,
  createInitiativeDraft,
  createReport,
  createSession as apiCreateSession,
  freeze as apiFreeze,
  getOutput,
  getSession,
  isOfflineError,
  isVersionConflict,
  listEvents,
  MethodCoreApiError,
  newIdempotencyKey,
  teresaCommit,
  teresaPreview,
  transition as apiTransition,
  type CreateInitiativeDraftRequest,
  type CreateReportRequest,
  type CreateSessionRequest,
  type FreezeResponse,
  type MethodOutputSummary,
  type TeresaCommitOutcome,
  type TeresaCommitRequestInput,
  type TeresaPreviewRequest,
} from '@/method-core/api/methodCoreApi';

export type DrdHttpRuntimeStatus =
  | 'loading'
  | 'ready'
  | 'saving'
  | 'saved'
  | 'error'
  | 'offline'
  | 'recovery'
  | 'reconnecting'
  | 'conflict'
  | 'recovered';

/** UI-facing mirror of `DrdSourceKind` minus `DEMO_LOCAL` (that value only
 * exists on the legacy localStorage-only runtime, which this file has no
 * knowledge of). Kept here — not imported from the component — so this
 * module stays framework-agnostic (no React dependency) and remains the
 * single place that decides the mapping; `DrdSourceIndicator.tsx` imports
 * this TYPE (type-only, zero runtime coupling) and widens it with
 * `DEMO_LOCAL` for its own use. */
export type DrdVisibleSourceState =
  | 'SERVER'
  | 'SAVING'
  | 'SAVED'
  | 'OFFLINE'
  | 'RECOVERY_DRAFT'
  | 'CONFLICT'
  | 'RECONNECTING'
  | 'RECOVERED';

/** Human-readable summary of a version conflict — never a full structural
 * diff (no such engine exists for arbitrary event payloads), but always
 * enough for a person to see WHAT is in dispute before deciding, per hard
 * rule #2. Populated only while `status === 'conflict'`. */
export interface DrdConflictDetail {
  readonly localBaseVersion: number;
  readonly serverVersion: number;
  /** One-line description of the local write(s) that could not be applied. */
  readonly localSummary: string;
  readonly serverSummary: string | null;
}

export interface DrdHttpRuntimeState {
  readonly status: DrdHttpRuntimeStatus;
  readonly session: MethodSession | null;
  readonly roles: readonly MethodProcessRole[];
  readonly events: readonly MethodEvent[];
  readonly error: string | null;
  /** Present only when status === 'conflict' — the version the server has
   * right now, so the UI can show "server has vN, you have vM" and offer a
   * refresh instead of silently overwriting. */
  readonly serverVersion: number | null;
  /** Present only when status === 'conflict' — see `DrdConflictDetail`. */
  readonly conflictDetail: DrdConflictDetail | null;
  /** Writes that failed to reach the server and are queued in localStorage
   * for retry, never discarded except by an explicit human choice. */
  readonly pendingWriteCount: number;
  /** Informational notices for DRAFT writes that were dropped during
   * `retryPending()` because the server had already moved past their base
   * revision (hard rule #3 — "server wins" applies ONLY to disposable
   * drafts, and is always surfaced, never silent). The UI is expected to
   * show and then clear these (`acknowledgeStaleDraftNotices()`). */
  readonly staleDraftNotices: readonly string[];
  /** Teresa previews awaiting a human decision. Kept in memory only (no
   * GET-list endpoint exists server-side) — populated by `createTeresaPreview`
   * responses, drained by `commitTeresaPreview`. Never persisted to
   * localStorage: an ephemeral decision queue, not session state. */
  readonly previews: readonly TeresaPreview[];
  /** The session's frozen Output — set only from a server response (either
   * this browser's own `freeze()` call, or a `getOutput()` re-fetch keyed
   * off a locally cached output id — see `outputIdCacheKey`). Never
   * reconstructed from any other localStorage content. */
  readonly output: MethodOutputSummary | null;
  /** Report Snapshots / Initiative Proposal Drafts created THIS session
   * (in-memory only — no GET-list endpoint exists server-side; a page
   * reload loses this list even though the records exist on the server,
   * a known gap tracked in the P0C report, not a silent fabrication). */
  readonly reports: readonly unknown[];
  readonly initiatives: readonly unknown[];
}

/** The single place that decides which of the eight visible states a given
 * runtime snapshot maps to. Every UI call site (`DrdHttpMethodWorkspaceScreen`)
 * MUST go through this function instead of re-deriving the mapping ad hoc —
 * that ad-hoc duplication is exactly what caused the pre-S3 bug where a
 * frozen session with an uncached Output pointer was mislabeled
 * RECOVERY_DRAFT even though the server plainly had confirmed data. */
export function deriveDrdSourceKind(state: DrdHttpRuntimeState): DrdVisibleSourceState {
  switch (state.status) {
    case 'saving':
      return 'SAVING';
    case 'saved':
      return 'SAVED';
    case 'reconnecting':
      return 'RECONNECTING';
    case 'conflict':
      return 'CONFLICT';
    case 'recovered':
      return 'RECOVERED';
    case 'ready':
    case 'offline':
    case 'recovery':
      // ★ Hard rule #1: RECOVERY_DRAFT exists ONLY to say "there is an
      // unsaved local write on screen right now" — checked FIRST and
      // independently of `status`, so a bare `refresh()` that happens to
      // succeed while writes are still queued (GET works, the queued POST
      // hasn't been retried yet) can never flip the badge to SERVER and
      // hide the fact that local-only content still exists. Being
      // offline/reconnected/ready with an EMPTY queue is not a draft of
      // anything — that's SERVER (if `ready`) or OFFLINE otherwise.
      if (state.pendingWriteCount > 0) return 'RECOVERY_DRAFT';
      return state.status === 'ready' ? 'SERVER' : 'OFFLINE';
    case 'loading':
    case 'error':
    default:
      // No fresh confirmation exists yet (bootstrap) or a non-offline,
      // non-conflict failure happened (e.g. a transient 500). If we still
      // hold a session that WAS previously confirmed by the server, that is
      // the more honest label than implying an unsaved draft exists when
      // nothing was actually edited; the error itself is surfaced
      // separately (see ErrorRetryView / the inline error banner), never by
      // repurposing this badge.
      if (state.pendingWriteCount > 0) return 'RECOVERY_DRAFT';
      return state.session ? 'SERVER' : 'OFFLINE';
  }
}

interface PendingWrite {
  readonly id: string;
  readonly kind: 'event' | 'transition';
  readonly idempotencyKey: string;
  readonly payload: unknown;
  /** The session `version` this write was queued against — the pointer hard
   * rule #3 is checked against. */
  readonly baseVersion: number;
  /** True for a disposable autosave (`ANSWER_DRAFTED`) — see hard rule #3:
   * only draft writes are ever dropped on "server moved on" without a human
   * decision; a CONFIRMED write always escalates to CONFLICT instead. */
  readonly isDraftOnly: boolean;
  /** One-line human description used both in `staleDraftNotices` and in
   * `DrdConflictDetail.localSummary` — computed once at queue time so a
   * page reload can still describe a queued write without re-deriving it
   * from raw event payload shapes. */
  readonly describeLocal: string;
}

function cacheKey(sessionId: string): string {
  return `method-core:http-cache:${sessionId}`;
}
function pendingKey(sessionId: string): string {
  return `method-core:pending-writes:${sessionId}`;
}
/** ★ Hard rule #4 — the ONLY other thing localStorage is allowed to hold
 * beyond the content cache and the pending-write queue: a `{sessionId,
 * revision}` pointer, never full content, used purely so a reconnect can
 * ask "did the server move past what I last knew, independently of the
 * pending queue's own per-item baseVersion" — see `reconnect()`. */
function revisionPointerKey(sessionId: string): string {
  return `method-core:http-cache:${sessionId}:revision`;
}
/** Caches ONLY the Output's server-assigned id (a pointer), never its
 * content — `refresh()` always re-fetches the actual Output via
 * `getOutput(id)` before anything renders it. Exists because the server has
 * no "list outputs by session" endpoint the browser can call; without this
 * pointer a page reload on an already-frozen session cannot rediscover
 * which Output belongs to it (documented gap — see this file's class-level
 * comment on `reports`/`initiatives` for the same limitation). */
function outputIdCacheKey(sessionId: string): string {
  return `method-core:http-cache:${sessionId}:output-id`;
}

function readPending(storage: Storage, sessionId: string): PendingWrite[] {
  try {
    const raw = storage.getItem(pendingKey(sessionId));
    return raw ? (JSON.parse(raw) as PendingWrite[]) : [];
  } catch {
    return [];
  }
}
function writePending(storage: Storage, sessionId: string, items: PendingWrite[]): void {
  storage.setItem(pendingKey(sessionId), JSON.stringify(items));
}

function readRevisionPointer(storage: Storage, sessionId: string): number | null {
  try {
    const raw = storage.getItem(revisionPointerKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { sessionId: string; revision: number };
    return parsed.sessionId === sessionId ? parsed.revision : null;
  } catch {
    return null;
  }
}
function writeRevisionPointer(storage: Storage, sessionId: string, revision: number): void {
  try {
    storage.setItem(revisionPointerKey(sessionId), JSON.stringify({ sessionId, revision }));
  } catch {
    // Best-effort — losing this pointer only means a future reconnect falls
    // back to per-item baseVersion comparison, never a correctness bug.
  }
}

/**
 * One instance per session. Every public method is async and hits the
 * network; `state` is the last resolved snapshot for synchronous UI reads
 * between calls (React should still treat it as derived, not as its own
 * store — the component subscribes via `onChange`).
 */
export class DrdHttpSessionRuntime {
  private listeners = new Set<(state: DrdHttpRuntimeState) => void>();
  private state: DrdHttpRuntimeState = {
    status: 'loading',
    session: null,
    roles: [],
    events: [],
    error: null,
    serverVersion: null,
    conflictDetail: null,
    pendingWriteCount: 0,
    staleDraftNotices: [],
    previews: [],
    output: null,
    reports: [],
    initiatives: [],
  };

  /** In-flight de-dupe: two calls describing the SAME logical write (e.g. a
   * debounced autosave and a manual "Zapisz teraz" firing back-to-back)
   * collapse into ONE network request / ONE idempotency key instead of two
   * — the guarantee "parallel writes never duplicate the event" is enforced
   * HERE, structurally, rather than left to the server's idempotency-key
   * matching alone. */
  private inFlightWrites = new Map<string, Promise<void>>();

  constructor(
    public readonly sessionId: string,
    private readonly storage: Storage = window.localStorage
  ) {
    this.loadCache();
  }

  getState(): DrdHttpRuntimeState {
    return this.state;
  }

  onChange(listener: (state: DrdHttpRuntimeState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(patch: Partial<DrdHttpRuntimeState>): void {
    this.state = { ...this.state, ...patch };
    if (this.state.session) {
      try {
        this.storage.setItem(cacheKey(this.sessionId), JSON.stringify(this.state.session));
        writeRevisionPointer(this.storage, this.sessionId, this.state.session.version);
      } catch {
        // Cache is best-effort — a quota error here must never block a
        // successful network read from reaching the UI.
      }
    }
    for (const listener of this.listeners) listener(this.state);
  }

  private loadCache(): void {
    try {
      const raw = this.storage.getItem(cacheKey(this.sessionId));
      if (raw) {
        const cached = JSON.parse(raw) as MethodSession;
        this.state = { ...this.state, session: cached };
      }
    } catch {
      // Ignore a corrupt cache entry — refresh() below is the real source.
    }
    this.state = { ...this.state, pendingWriteCount: readPending(this.storage, this.sessionId).length };
  }

  /** Always re-asks the server. This is the ONLY method that resolves
   * status 'loading' -> 'ready' | 'error' | 'offline'. */
  async refresh(): Promise<void> {
    this.setState({ status: 'loading', error: null });
    try {
      const [{ session, roles }, events] = await Promise.all([
        getSession(this.sessionId),
        listEvents(this.sessionId),
      ]);
      let output = this.state.output;
      if (session.state === 'frozen' || session.state === 'closed') {
        const cachedOutputId = output?.id ?? this.readCachedOutputId();
        if (cachedOutputId && cachedOutputId !== output?.id) {
          try {
            const res = await getOutput(cachedOutputId);
            output = res.output;
          } catch {
            // Pointer stale/unreadable — leave whatever we had (possibly
            // null). The UI must show that gap honestly, never fabricate
            // Output content from anything else.
          }
        }
      } else {
        // Session left frozen/closed (e.g. after a future reopen path) — an
        // Output from a PRIOR state must never linger and be mistaken for
        // the current one.
        output = null;
      }
      this.setState({ status: 'ready', session, roles, events, error: null, serverVersion: null, conflictDetail: null, output });
    } catch (err) {
      this.handleFailure(err);
    }
  }

  private readCachedOutputId(): string | null {
    try {
      return this.storage.getItem(outputIdCacheKey(this.sessionId));
    } catch {
      return null;
    }
  }

  private handleFailure(err: unknown): void {
    if (isOfflineError(err)) {
      this.setState({ status: 'offline', error: 'Brak połączenia z serwerem.' });
      return;
    }
    if (isVersionConflict(err)) {
      const currentVersion = (err as MethodCoreApiError).body.currentVersion as number;
      const localBaseVersion = this.state.session?.version ?? 0;
      this.setState({
        status: 'conflict',
        serverVersion: currentVersion,
        error: 'Sesja zmieniła się na serwerze.',
        conflictDetail: {
          localBaseVersion,
          serverVersion: currentVersion,
          localSummary: 'Ostatnia akcja odrzucona przez serwer — opierała się o starszą wersję sesji.',
          serverSummary: null,
        },
      });
      return;
    }
    const message = err instanceof Error ? err.message : 'Nieznany błąd';
    this.setState({ status: 'error', error: message });
  }

  // -- creation (static, mirrors createDrdDemoSession) -----------------------

  static async create(
    input: CreateSessionRequest,
    storage: Storage = window.localStorage
  ): Promise<DrdHttpSessionRuntime> {
    const res = await apiCreateSession(input, newIdempotencyKey());
    const runtime = new DrdHttpSessionRuntime(res.session.id, storage);
    runtime.setState({
      status: 'ready',
      session: res.session,
      roles: [],
      events: [],
      error: null,
      serverVersion: null,
      conflictDetail: null,
    });
    return runtime;
  }

  // -- in-flight write de-dupe ------------------------------------------------

  private dedupedWrite(dedupeKey: string, run: () => Promise<void>): Promise<void> {
    const existing = this.inFlightWrites.get(dedupeKey);
    if (existing) return existing;
    const p = run().finally(() => {
      if (this.inFlightWrites.get(dedupeKey) === p) this.inFlightWrites.delete(dedupeKey);
    });
    this.inFlightWrites.set(dedupeKey, p);
    return p;
  }

  // -- writes ------------------------------------------------------------
  // Every write: try the network first. On a genuine offline failure, queue
  // it (status -> 'recovery') instead of losing it or pretending it landed.

  private async runWrite(
    kind: PendingWrite['kind'],
    idempotencyKey: string,
    payload: unknown,
    exec: () => Promise<void>,
    opts: { isDraftOnly: boolean; describeLocal: string }
  ): Promise<void> {
    this.setState({ status: 'saving' });
    try {
      await exec();
      // ★ `refresh()` FIRST — the badge must reflect real, re-fetched server
      // truth, never a guess made before the round trip that proves it. Only
      // once `refresh()` has actually landed on 'ready' do we decorate it
      // with the transient SAVED confirmation; if `refresh()` itself hit
      // offline/conflict/error, that outcome (already set by `refresh()`
      // internally) is the honest one to show, not a stale "saved".
      // This ordering also makes SAVED a real, race-free resting state: it
      // is the LAST synchronous write this method makes, so `await
      // recordAnswer(...)` always observes it deterministically — no
      // microtask-counting needed by a caller/test.
      await this.refresh();
      if (this.state.status === 'ready') this.setState({ status: 'saved' });
    } catch (err) {
      if (isOfflineError(err)) {
        const pending = readPending(this.storage, this.sessionId);
        pending.push({
          id: newIdempotencyKey(),
          kind,
          idempotencyKey,
          payload,
          baseVersion: this.state.session?.version ?? readRevisionPointer(this.storage, this.sessionId) ?? 0,
          isDraftOnly: opts.isDraftOnly,
          describeLocal: opts.describeLocal,
        });
        writePending(this.storage, this.sessionId, pending);
        this.setState({ status: 'recovery', pendingWriteCount: pending.length, error: 'Zapis w kolejce — offline.' });
        return;
      }
      this.handleFailure(err);
      throw err;
    }
  }

  async recordAnswer(input: {
    unitId: string;
    level: number;
    questionId: string;
    answerState: 'confirmed' | 'partial' | 'no' | 'dont_know' | 'no_evidence' | 'not_applicable';
    text?: string;
    justification?: string;
    draft?: boolean;
  }): Promise<void> {
    const dedupeKey = `answer:${input.unitId}:${input.level}:${input.questionId}:${input.draft ? 'draft' : 'confirmed'}`;
    return this.dedupedWrite(dedupeKey, async () => {
      const idemKey = `answer:${input.questionId}:${input.draft ? 'draft' : 'confirmed'}:${newIdempotencyKey()}`;
      const type: MethodEventType = input.draft ? 'ANSWER_DRAFTED' : 'ANSWER_CONFIRMED';
      const payload = { questionId: input.questionId, answerState: input.answerState, text: input.text, justification: input.justification };
      await this.runWrite(
        'event',
        idemKey,
        { type, unitId: input.unitId, level: input.level, payload },
        () => appendEvent(this.sessionId, { type, unitId: input.unitId, level: input.level, actorKind: 'human', payload }, idemKey).then(() => undefined),
        {
          isDraftOnly: Boolean(input.draft),
          describeLocal: `Odpowiedź ${input.questionId} (${input.answerState}${input.draft ? ', wersja robocza' : ''})`,
        }
      );
    });
  }

  async recordEvidence(input: {
    unitId: string;
    level?: number;
    evidenceId: string;
    evidenceType: string;
    strength: 'E0' | 'E1' | 'E2' | 'E3' | 'E4';
    linkedQuestionIds?: readonly string[];
  }): Promise<void> {
    const dedupeKey = `evidence:${input.evidenceId}`;
    return this.dedupedWrite(dedupeKey, async () => {
      const idemKey = `evidence:${input.evidenceId}`;
      const payload = {
        evidenceId: input.evidenceId,
        evidenceType: input.evidenceType,
        strength: input.strength,
        linkedQuestionIds: input.linkedQuestionIds ?? [],
      };
      await this.runWrite(
        'event',
        idemKey,
        { type: 'EVIDENCE_ATTACHED', unitId: input.unitId, level: input.level, payload },
        () =>
          appendEvent(
            this.sessionId,
            { type: 'EVIDENCE_ATTACHED', unitId: input.unitId, level: input.level, actorKind: 'human', payload },
            idemKey
          ).then(() => undefined),
        { isDraftOnly: false, describeLocal: `Dowód ${input.evidenceId} (${input.strength})` }
      );
    });
  }

  async recordTargetDecision(input: { unitId: string; level: number; rationale: string }): Promise<void> {
    const dedupeKey = `target-decision:${input.unitId}:${input.level}`;
    return this.dedupedWrite(dedupeKey, async () => {
      const idemKey = `target-decision:${input.unitId}:${input.level}:${newIdempotencyKey()}`;
      const payload = { decisionId: newIdempotencyKey(), subject: 'target_level' as const, decidedValue: input.level, rationale: input.rationale };
      await this.runWrite(
        'event',
        idemKey,
        { type: 'DECISION_APPROVED', unitId: input.unitId, level: input.level, payload },
        () =>
          appendEvent(
            this.sessionId,
            { type: 'DECISION_APPROVED', unitId: input.unitId, level: input.level, actorKind: 'human', payload },
            idemKey
          ).then(() => undefined),
        { isDraftOnly: false, describeLocal: `Decyzja o targecie ${input.unitId} → poziom ${input.level}` }
      );
    });
  }

  /** Explicit optimistic-concurrency-aware transition. On a 409 the state
   * becomes 'conflict' with `serverVersion` set — caller must `refresh()`
   * (or otherwise resolve) before retrying, never auto-overwrite. */
  async transition(to: MethodSessionState): Promise<void> {
    const expectedVersion = this.state.session?.version;
    const idemKey = `transition:${to}:${newIdempotencyKey()}`;
    this.setState({ status: 'saving' });
    try {
      const session = await apiTransition(this.sessionId, { to, expectedVersion }, idemKey);
      this.setState({ status: 'saved', session, error: null, serverVersion: null, conflictDetail: null });
      await this.refresh();
    } catch (err) {
      this.handleFailure(err);
      throw err;
    }
  }

  async freeze(): Promise<FreezeResponse> {
    const expectedVersion = this.state.session?.version;
    const idemKey = `freeze:${newIdempotencyKey()}`;
    this.setState({ status: 'saving' });
    try {
      const res = await apiFreeze(this.sessionId, idemKey, expectedVersion);
      // Pointer only — see `outputIdCacheKey`'s header comment. The Output
      // CONTENT below comes straight from this response, never from cache.
      try {
        this.storage.setItem(outputIdCacheKey(this.sessionId), res.output.id);
      } catch {
        // Best-effort — a reload losing the pointer is a documented gap,
        // not a correctness bug (never fabricates content either way).
      }
      this.setState({ status: 'saved', session: res.session, error: null, serverVersion: null, conflictDetail: null, output: res.output });
      return res;
    } catch (err) {
      this.handleFailure(err);
      throw err;
    }
  }

  async getFrozenOutput(outputId: string): Promise<MethodOutputSummary> {
    const res = await getOutput(outputId);
    return res.output;
  }

  // -- Report / Initiative Draft (require a loaded Output) ------------------

  async generateReport(input: CreateReportRequest): Promise<unknown> {
    if (!this.state.output) {
      throw new Error('drd-http-runtime: cannot generate a Report Snapshot without a loaded Output');
    }
    const report = await createReport(this.state.output.id, input);
    this.setState({ reports: [...this.state.reports, report] });
    return report;
  }

  async generateInitiativeDraft(input: CreateInitiativeDraftRequest): Promise<unknown> {
    if (!this.state.output) {
      throw new Error('drd-http-runtime: cannot generate an Initiative Proposal Draft without a loaded Output');
    }
    const draft = await createInitiativeDraft(this.state.output.id, input);
    this.setState({ initiatives: [...this.state.initiatives, draft] });
    return draft;
  }

  // -- Teresa --------------------------------------------------------------

  async createTeresaPreview(input: TeresaPreviewRequest): Promise<TeresaPreview> {
    const preview = await teresaPreview(this.sessionId, input);
    this.setState({ previews: [...this.state.previews, preview] });
    return preview;
  }

  async commitTeresaPreview(input: TeresaCommitRequestInput): Promise<TeresaCommitOutcome> {
    const outcome = await teresaCommit(this.sessionId, input, newIdempotencyKey());
    this.setState({ previews: this.state.previews.filter((p) => p.previewId !== input.previewId) });
    await this.refresh();
    return outcome;
  }

  // -- draft recovery --------------------------------------------------------

  hasPendingWrites(): boolean {
    return readPending(this.storage, this.sessionId).length > 0;
  }

  /** Call once connectivity is believed to be back (e.g. the "Spróbuj
   * połączyć ponownie" button). NEVER applies queued writes by itself —
   * only checks what the server currently has, so the explicit
   * reconciliation UI can present an informed choice (scenario: "przywrócenie
   * połączenia → RECONNECTING → jawna rekoncyliacja → RECOVERED"). */
  async reconnect(): Promise<void> {
    const pendingCount = readPending(this.storage, this.sessionId).length;
    if (pendingCount === 0) {
      // Nothing queued — a plain refresh is the whole story, no
      // reconciliation choice is needed.
      await this.refresh();
      return;
    }
    this.setState({ status: 'reconnecting', error: null });
    try {
      const { session, roles } = await getSession(this.sessionId);
      // Back online, but still showing local-only content until the human
      // explicitly applies or discards the queue — badge stays RECOVERY_DRAFT
      // (see deriveDrdSourceKind), not SERVER, until that happens.
      this.setState({ status: 'recovery', session, roles, pendingWriteCount: pendingCount, error: null });
    } catch (err) {
      this.handleFailure(err);
    }
  }

  /** Replays queued writes in order — the explicit reconciliation action
   * ("Zastosuj zaległe zmiany"). Never called automatically.
   *
   * On each item's outcome:
   *  - success: applied, removed from the queue;
   *  - offline again: stop here, keep this item + everything after it
   *    queued, nothing lost;
   *  - 409 on a DRAFT-only item: hard rule #3 — the server has moved past a
   *    disposable autosave; drop THIS item, record a visible notice, keep
   *    reconciling the rest;
   *  - 409 on a CONFIRMED item: hard rule #2 — genuine conflict, STOP
   *    immediately, keep this item + everything not yet processed queued,
   *    surface a diff via `conflictDetail`, require a human decision;
   *  - any other failure: never silently dropped — kept queued, surfaced as
   *    `error`.
   */
  async retryPending(): Promise<{ succeeded: number; stillPending: number }> {
    const pending = readPending(this.storage, this.sessionId);
    if (pending.length === 0) {
      this.setState({ status: 'ready', pendingWriteCount: 0 });
      await this.refresh();
      return { succeeded: 0, stillPending: 0 };
    }
    this.setState({ status: 'saving' });
    const staleDraftNotices: string[] = [...this.state.staleDraftNotices];
    let succeeded = 0;

    for (let i = 0; i < pending.length; i++) {
      const item = pending[i];
      try {
        if (item.kind === 'event') {
          const p = item.payload as { type: MethodEventType; unitId?: string; level?: number; payload: unknown };
          await appendEvent(this.sessionId, { type: p.type, unitId: p.unitId, level: p.level, actorKind: 'human', payload: p.payload }, item.idempotencyKey);
        } else {
          const p = item.payload as { type: MethodSessionState };
          await apiTransition(this.sessionId, { to: p.type }, item.idempotencyKey);
        }
        succeeded += 1;
      } catch (err) {
        if (isOfflineError(err)) {
          const remaining = pending.slice(i);
          writePending(this.storage, this.sessionId, remaining);
          this.setState({
            status: 'offline',
            pendingWriteCount: remaining.length,
            staleDraftNotices,
            error: 'Połączenie przerwane w trakcie stosowania zaległych zmian.',
          });
          return { succeeded, stillPending: remaining.length };
        }
        if (isVersionConflict(err)) {
          const currentVersion = (err as MethodCoreApiError).body.currentVersion as number;
          if (item.isDraftOnly) {
            // Hard rule #3: an older local revision never overwrites a
            // newer server one — but this applies ONLY to a disposable
            // draft. Drop it, inform the user, keep reconciling the rest.
            staleDraftNotices.push(`Pominięto nieaktualną wersję roboczą: ${item.describeLocal} (serwer ma już wersję ${currentVersion}).`);
            continue;
          }
          // Hard rule #2: a CONFIRMED write conflicts with a newer server
          // revision. Never overwrite — stop, keep everything not yet
          // processed queued, show a diff, wait for a human.
          const remaining = pending.slice(i);
          writePending(this.storage, this.sessionId, remaining);
          this.setState({
            status: 'conflict',
            serverVersion: currentVersion,
            pendingWriteCount: remaining.length,
            staleDraftNotices,
            conflictDetail: {
              localBaseVersion: item.baseVersion,
              serverVersion: currentVersion,
              localSummary: item.describeLocal,
              serverSummary: null,
            },
            error: 'Konflikt podczas stosowania zaległych zmian — serwer zmienił się od czasu utworzenia tej zmiany.',
          });
          return { succeeded, stillPending: remaining.length };
        }
        // Non-offline, non-conflict failure (e.g. a now-illegal transition).
        // Never silently drop it — surface the failure, keep the item
        // queued so a human sees it rather than making it vanish.
        const remaining = pending.slice(i);
        writePending(this.storage, this.sessionId, remaining);
        this.setState({
          status: 'recovery',
          pendingWriteCount: remaining.length,
          staleDraftNotices,
          error: `Zaległa zmiana odrzucona: ${err instanceof Error ? err.message : 'nieznany błąd'}.`,
        });
        return { succeeded, stillPending: remaining.length };
      }
    }

    writePending(this.storage, this.sessionId, []);
    this.setState({ status: 'recovered', pendingWriteCount: 0, staleDraftNotices, conflictDetail: null, error: null });
    await this.refresh();
    return { succeeded, stillPending: 0 };
  }

  /** Clears the transient "recovered" banner back to the plain SERVER state
   * without any further network call — `refresh()` already ran at the end
   * of a successful `retryPending()`, this only dismisses the notice. */
  acknowledgeRecovered(): void {
    if (this.state.status === 'recovered') this.setState({ status: 'ready' });
  }

  acknowledgeStaleDraftNotices(): void {
    if (this.state.staleDraftNotices.length > 0) this.setState({ staleDraftNotices: [] });
  }

  /**
   * Explicit reconciliation choice: "discard my queued local writes, the
   * server wins". The OPPOSITE of `retryPending()` — never called
   * automatically; only a direct user action (see the ReconciliationPanel
   * in `DrdHttpMethodWorkspaceScreen.tsx`) may drop queued writes without
   * attempting them first.
   */
  async discardPendingAndReloadServer(): Promise<void> {
    writePending(this.storage, this.sessionId, []);
    this.setState({ pendingWriteCount: 0, staleDraftNotices: [], conflictDetail: null });
    await this.refresh();
  }

  /**
   * TEST/HARNESS ONLY — synthetically overlays a state patch so the
   * dev-render screenshot harness and unit tests can reach any of the eight
   * visible states (and the underlying transient statuses) deterministically
   * without a genuinely flaky network. No production code path calls this
   * (grep confirms: only `DrdHttpMethodWorkspaceScreen`'s `forceState` prop
   * and this file's own tests reference it) — mirrors the existing
   * `seedTo`/`initialViewMode` dev-render-only escape hatches on
   * `DrdMethodWorkspaceScreenProps`.
   */
  debugForceState(patch: Partial<DrdHttpRuntimeState>): void {
    this.setState(patch);
  }
}
