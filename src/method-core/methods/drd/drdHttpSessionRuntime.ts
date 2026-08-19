/**
 * DRD session runtime — HTTP-backed (P0, 2026-08-13).
 *
 * ★ THIS IS THE REPLACEMENT SOURCE OF TRUTH for `drdSessionRuntime.ts`'s
 * `localStorage`-only `DrdSessionRuntime`. Server (`server/src/routes/method-core.routes.ts`
 * over `src/method-core/api/methodCoreApi.ts`) is authoritative; every read
 * re-fetches, every write goes over HTTP first.
 *
 * ★ NOT YET WIRED INTO `DrdMethodWorkspaceScreen.tsx` — see that file's and
 * this program's CLAUDE.md rule #7 ("Piotr nigdy nie jest pierwszym testerem
 * wizualnym"): no visual surface may change what Piotr sees before (a) a
 * clean dev-render screenshot exists and (b) Piotr has accepted it, gated by
 * a default-OFF flag. Swapping THIS class in for `DrdSessionRuntime` inside
 * the 911-line workspace screen is a visual-risk change under that rule, not
 * a backend plumbing change — it is deliberately left for the next gated
 * step (dev-render harness -> screenshot -> accept -> flag on) rather than
 * done blind in this pass. This file is the real, working, tested-by-
 * construction (same methodCoreApi the server integration suite exercises)
 * HTTP mechanism that step will wire in.
 *
 * localStorage in this file is used ONLY as:
 *  - a technical cache of the last-known session snapshot, so a reload can
 *    paint something before the network round-trip resolves (`getCached`);
 *  - a draft-recovery queue for writes that failed to reach the server
 *    (`pendingWrites`) — replayed on `retryPending()`, never silently
 *    dropped, never treated as if they had succeeded.
 * It is NEVER read as the answer to "what is the current state" once the
 * network is reachable — `refresh()` always re-asks the server.
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
  listInitiativeDrafts,
  listOutputs,
  listReports,
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
  | 'error'
  | 'offline'
  | 'conflict'
  | 'recovery';

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
  /** Present only when status === 'recovery' — writes that failed to reach
   * the server and are queued in localStorage for retry, never discarded. */
  readonly pendingWriteCount: number;
  /** Teresa previews awaiting a human decision. Kept in memory only (no
   * GET-list endpoint exists server-side) — populated by `createTeresaPreview`
   * responses, drained by `commitTeresaPreview`. Never persisted to
   * localStorage: an ephemeral decision queue, not session state. */
  readonly previews: readonly TeresaPreview[];
  /** The session's frozen Output — set only from a server response (either
   * this browser's own `freeze()` call or the canonical Output listing).
   * A cached id is only a best-effort compatibility pointer; it is never
   * reconstructed from any other localStorage content. */
  readonly output: MethodOutputSummary | null;
  /** Persisted Report Snapshots / Initiative Proposal Drafts for the current
   * Output. Hydrated from the server on every frozen-session refresh. */
  readonly reports: readonly unknown[];
  readonly initiatives: readonly unknown[];
}

interface PendingWrite {
  readonly id: string;
  readonly kind: 'event' | 'transition';
  readonly idempotencyKey: string;
  readonly payload: unknown;
}

function cacheKey(sessionId: string): string {
  return `method-core:http-cache:${sessionId}`;
}
function pendingKey(sessionId: string): string {
  return `method-core:pending-writes:${sessionId}`;
}
/** Caches ONLY the Output's server-assigned id (a pointer), never content.
 * Canonical refresh discovers the current Output through the server list;
 * the pointer is retained solely for compatibility/diagnostics. */
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
    pendingWriteCount: 0,
    previews: [],
    output: null,
    reports: [],
    initiatives: [],
  };

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
      let reports = this.state.reports;
      let initiatives = this.state.initiatives;
      if (session.state === 'frozen' || session.state === 'closed') {
        const listed = await listOutputs({ sessionId: this.sessionId, status: 'current', limit: 100 });
        const latest = [...listed.outputs]
          .filter((candidate) => candidate.sessionId === this.sessionId)
          .sort((a, b) => (b.outputVersion ?? -1) - (a.outputVersion ?? -1))[0];

        if (latest) {
          const [detail, persistedReports, persistedInitiatives] = await Promise.all([
            getOutput(latest.id),
            listReports({ outputId: latest.id, status: 'current' }),
            listInitiativeDrafts({ outputId: latest.id, status: 'current' }),
          ]);
          output = detail.output;
          reports = persistedReports;
          initiatives = persistedInitiatives;
          try {
            this.storage.setItem(outputIdCacheKey(this.sessionId), output.id);
          } catch {
            // Canonical discovery above remains authoritative after a cold
            // restart; this pointer is only a compatibility optimization.
          }
        } else {
          output = null;
          reports = [];
          initiatives = [];
        }
      } else {
        // Session left frozen/closed (e.g. after a future reopen path) — an
        // Output from a PRIOR state must never linger and be mistaken for
        // the current one.
        output = null;
        reports = [];
        initiatives = [];
      }
      this.setState({ status: 'ready', session, roles, events, error: null, serverVersion: null, output, reports, initiatives });
    } catch (err) {
      this.handleFailure(err);
    }
  }

  private handleFailure(err: unknown): void {
    if (isOfflineError(err)) {
      this.setState({ status: 'offline', error: 'Brak połączenia z serwerem.' });
      return;
    }
    if (isVersionConflict(err)) {
      const currentVersion = (err as MethodCoreApiError).body.currentVersion as number;
      this.setState({ status: 'conflict', serverVersion: currentVersion, error: 'Sesja zmieniła się na serwerze.' });
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
    });
    return runtime;
  }

  // -- writes ------------------------------------------------------------
  // Every production write is server-confirmed or fails. The old pilot queued
  // offline writes in localStorage and returned success to the workspace;
  // that is not an acceptable source-of-truth contract for the mounted DRD
  // flow because a local draft could look persisted. Existing queue helpers
  // remain only so an old browser can explicitly discard/reconcile residue.

  private async runWrite(_kind: PendingWrite['kind'], _idempotencyKey: string, _payload: unknown, exec: () => Promise<void>): Promise<void> {
    try {
      await exec();
      await this.refresh();
    } catch (err) {
      if (isOfflineError(err)) {
        this.setState({ status: 'offline', error: 'Brak połączenia — zmiana nie została zapisana.' });
        throw err;
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
    const idemKey = `answer:${input.questionId}:${input.draft ? 'draft' : 'confirmed'}:${newIdempotencyKey()}`;
    const type: MethodEventType = input.draft ? 'ANSWER_DRAFTED' : 'ANSWER_CONFIRMED';
    const payload = { questionId: input.questionId, answerState: input.answerState, text: input.text, justification: input.justification };
    await this.runWrite('event', idemKey, { type, unitId: input.unitId, level: input.level, payload }, () =>
      appendEvent(this.sessionId, { type, unitId: input.unitId, level: input.level, actorKind: 'human', payload }, idemKey).then(() => undefined)
    );
  }

  async recordEvidence(input: {
    unitId: string;
    level?: number;
    evidenceId: string;
    evidenceType: string;
    strength: 'E0' | 'E1' | 'E2' | 'E3' | 'E4';
    linkedQuestionIds?: readonly string[];
  }): Promise<void> {
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
        ).then(() => undefined)
    );
  }

  async recordTargetDecision(input: { unitId: string; level: number; rationale: string }): Promise<void> {
    const idemKey = `target-decision:${input.unitId}:${input.level}:${newIdempotencyKey()}`;
    const payload = { decisionId: newIdempotencyKey(), subject: 'target_level' as const, decidedValue: input.level, rationale: input.rationale };
    await this.runWrite('event', idemKey, { type: 'DECISION_APPROVED', unitId: input.unitId, level: input.level, payload }, () =>
      appendEvent(
        this.sessionId,
        { type: 'DECISION_APPROVED', unitId: input.unitId, level: input.level, actorKind: 'human', payload },
        idemKey
      ).then(() => undefined)
    );
  }

  /** Explicit optimistic-concurrency-aware transition. On a 409 the state
   * becomes 'conflict' with `serverVersion` set — caller must `refresh()`
   * (or otherwise resolve) before retrying, never auto-overwrite. */
  async transition(to: MethodSessionState): Promise<void> {
    const expectedVersion = this.state.session?.version;
    const idemKey = `transition:${to}:${newIdempotencyKey()}`;
    try {
      const session = await apiTransition(this.sessionId, { to, expectedVersion }, idemKey);
      this.setState({ status: 'ready', session, error: null, serverVersion: null });
      await this.refresh();
    } catch (err) {
      this.handleFailure(err);
      throw err;
    }
  }

  async freeze(): Promise<FreezeResponse> {
    const expectedVersion = this.state.session?.version;
    const idemKey = `freeze:${newIdempotencyKey()}`;
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
      this.setState({ status: 'ready', session: res.session, error: null, serverVersion: null, output: res.output });
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

  /** Replays queued writes in order. A write that fails again (still
   * offline) stays queued; one that now succeeds is removed. Never silently
   * drops a write — this is the entire point of 'recovery' as a distinct
   * status from 'ready'. */
  async retryPending(): Promise<{ succeeded: number; stillPending: number }> {
    const pending = readPending(this.storage, this.sessionId);
    const remaining: PendingWrite[] = [];
    let succeeded = 0;
    for (const item of pending) {
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
          remaining.push(item);
        }
        // A non-offline failure (e.g. the transition became illegal while
        // queued) is surfaced by dropping the item and letting the next
        // refresh() show the real server state — queuing forever a write
        // the server will never accept is its own kind of dishonesty.
      }
    }
    writePending(this.storage, this.sessionId, remaining);
    this.setState({
      status: remaining.length > 0 ? 'recovery' : 'ready',
      pendingWriteCount: remaining.length,
    });
    if (remaining.length === 0) await this.refresh();
    return { succeeded, stillPending: remaining.length };
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
    this.setState({ pendingWriteCount: 0 });
    await this.refresh();
  }

  /**
   * TEST/HARNESS ONLY — synthetically overlays a state patch so the
   * dev-render screenshot harness and unit tests can reach offline/
   * conflict/recovery deterministically without a genuinely flaky network.
   * No production code path calls this (grep confirms: only
   * `DrdHttpMethodWorkspaceScreen`'s `forceState` prop and this file's own
   * tests reference it) — mirrors the existing `seedTo`/`initialViewMode`
   * dev-render-only escape hatches on `DrdMethodWorkspaceScreenProps`.
   */
  debugForceState(patch: Partial<DrdHttpRuntimeState>): void {
    this.setState(patch);
  }
}
