/**
 * SIRI session runtime — HTTP-backed (S5, 2026-08-13).
 *
 * Mirrors `src/method-core/methods/drd/drdHttpSessionRuntime.ts` (same kernel
 * HTTP surface: `server/src/routes/method-core.routes.ts` over
 * `src/method-core/api/methodCoreApi.ts`). Server is the ONLY source of truth
 * for session/events/Output — every read re-fetches, every write goes over
 * HTTP first. `localStorage` here plays EXACTLY the two roles the DRD runtime
 * documents:
 *  - a technical read cache (`getCached` — paints something on reload before
 *    the network round-trip resolves);
 *  - a draft-recovery queue for writes that failed to reach the server
 *    (`pendingWrites` — replayed on `retryPending()`, never silently
 *    dropped).
 * It is NEVER read as the answer to "what is the current state" once the
 * network is reachable — `refresh()` always re-asks the server.
 *
 * ---------------------------------------------------------------------------
 * SIRI-SPECIFIC ON TOP OF THE SHARED KERNEL SURFACE
 * ---------------------------------------------------------------------------
 * The kernel event set (`METHOD_EVENT_TYPES`) is closed and method-agnostic.
 * SIRI's Band lifecycle maps onto it as follows (no new event type invented):
 *
 *   assessor PROPOSES a Band  -> DECISION_PROPOSED (subject: 'current_level')
 *   participant/approver
 *     CONFIRMS a Band         -> ANSWER_CONFIRMED (unitId, level) — NOT
 *                                 DECISION_APPROVED: `server/src/method-core/
 *                                 outputs/EventDerivedOutputBridge.ts` (the
 *                                 freeze -> Output bridge) reads ONLY
 *                                 ANSWER_CONFIRMED for a unit's current
 *                                 level, mirroring DRD's own
 *                                 `recordAnswer()`. The actor distinction
 *                                 (participant vs approver, never Teresa)
 *                                 travels in THIS event's own payload
 *                                 (`confirmedByActor`) instead.
 *   target Band decided       -> DECISION_APPROVED (subject: 'target_level')
 *   evidence attached         -> EVIDENCE_ATTACHED  (evidenceType mapped via
 *                                 `toKernelEvidenceType()` — `factory_observation`
 *                                 is a SIRI-owned SUBTYPE of the kernel's closed
 *                                 `observation`, carried as an extra
 *                                 `siriEvidenceItemType` payload field, never a
 *                                 new kernel enum value)
 *
 * Every propose/confirm call runs the SAME pure guard used everywhere else in
 * this pack (`proposeSiriBand`/`confirmSiriBand`, `siriWorkspaceView.ts`)
 * BEFORE issuing any HTTP write — a rationale-missing or leapfrog-blocked
 * request never reaches the network, so the UI shows the refusal
 * synchronously and no event is appended (mirrors the pure-function tests in
 * `__tests__/siriWorkspaceView.test.ts`, now enforced on the write path too).
 *
 * Canon: docs/program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/ASSESSMENT_KB_SIRI.md §3
 * ("Assessor prowadzi, sugeruje i rekomenduje; finalną decyzję Band podejmują
 * uprawnieni uczestnicy/approver") — Teresa is never a valid `confirmedByActor`
 * (see `SiriBandConfirmingActor`, `siriWorkspaceView.ts`); this runtime has no
 * method that lets a Teresa commit reach `confirmBand`.
 */

import type {
  DecisionEventPayload,
  EvidenceEventPayload,
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

import {
  checkSiriLeapfrog,
  confirmSiriBand,
  proposeSiriBand,
  toKernelEvidenceType,
  type SiriBandConfirmingActor,
  type SiriBandProposalResult,
  type SiriBandConfirmResult,
  type SiriEvidenceItemType,
  type SiriUnitAssessmentState,
} from './siriWorkspaceView';
import type { EvidenceStrength } from '@/method-core/contracts';

export type SiriHttpRuntimeStatus = 'loading' | 'ready' | 'error' | 'offline' | 'conflict' | 'recovery';

export interface SiriHttpRuntimeState {
  readonly status: SiriHttpRuntimeStatus;
  readonly session: MethodSession | null;
  readonly roles: readonly MethodProcessRole[];
  readonly events: readonly MethodEvent[];
  readonly error: string | null;
  readonly serverVersion: number | null;
  readonly pendingWriteCount: number;
  readonly previews: readonly TeresaPreview[];
  readonly output: MethodOutputSummary | null;
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
  return `siri-method-core:http-cache:${sessionId}`;
}
function pendingKey(sessionId: string): string {
  return `siri-method-core:pending-writes:${sessionId}`;
}
function outputIdCacheKey(sessionId: string): string {
  return `siri-method-core:http-cache:${sessionId}:output-id`;
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

/** Local, in-memory result shape for a rejected propose/confirm call that
 * never reached the network — kept distinct from a `MethodCoreApiError` so
 * the caller can tell "server refused" apart from "guard refused before we
 * even asked". */
export type SiriBandWriteRefusal =
  | { readonly ok: false; readonly kind: 'guard_refused'; readonly reason: string; readonly message: string }
  | { readonly ok: false; readonly kind: 'server_refused'; readonly message: string };

export interface SiriBandWriteAccepted {
  readonly ok: true;
  readonly event: MethodEvent;
}

export type SiriBandWriteResult = SiriBandWriteAccepted | SiriBandWriteRefusal;

export class SiriHttpSessionRuntime {
  private listeners = new Set<(state: SiriHttpRuntimeState) => void>();
  private state: SiriHttpRuntimeState = {
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

  getState(): SiriHttpRuntimeState {
    return this.state;
  }

  onChange(listener: (state: SiriHttpRuntimeState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(patch: Partial<SiriHttpRuntimeState>): void {
    this.state = { ...this.state, ...patch };
    if (this.state.session) {
      try {
        this.storage.setItem(cacheKey(this.sessionId), JSON.stringify(this.state.session));
      } catch {
        // best-effort cache only
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
      // corrupt cache entry — refresh() is the real source
    }
    this.state = { ...this.state, pendingWriteCount: readPending(this.storage, this.sessionId).length };
  }

  /** Always re-asks the server — the ONLY method resolving 'loading'. */
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
            // pointer stale/unreadable — leave as-is, never fabricate
          }
        }
      } else {
        output = null;
      }
      this.setState({ status: 'ready', session, roles, events, error: null, serverVersion: null, output });
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
      this.setState({ status: 'conflict', serverVersion: currentVersion, error: 'Sesja zmieniła się na serwerze.' });
      return;
    }
    const message = err instanceof Error ? err.message : 'Nieznany błąd';
    this.setState({ status: 'error', error: message });
  }

  // -- creation --------------------------------------------------------------

  static async create(
    input: CreateSessionRequest,
    storage: Storage = window.localStorage
  ): Promise<SiriHttpSessionRuntime> {
    const res = await apiCreateSession(input, newIdempotencyKey());
    const runtime = new SiriHttpSessionRuntime(res.session.id, storage);
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

  private async runWrite(
    kind: PendingWrite['kind'],
    idempotencyKey: string,
    payload: unknown,
    exec: () => Promise<void>
  ): Promise<void> {
    try {
      await exec();
      await this.refresh();
    } catch (err) {
      if (isOfflineError(err)) {
        const pending = readPending(this.storage, this.sessionId);
        pending.push({ id: newIdempotencyKey(), kind, idempotencyKey, payload });
        writePending(this.storage, this.sessionId, pending);
        this.setState({ status: 'recovery', pendingWriteCount: pending.length, error: 'Zapis w kolejce — offline.' });
        return;
      }
      this.handleFailure(err);
      throw err;
    }
  }

  /** Derives the current `SiriUnitAssessmentState` for one unit straight from
   * the last-known events — used ONLY to feed the pure no-leapfrog/rationale
   * guard before a write, never persisted itself.
   *
   * ★ Confirmed levels are read from `ANSWER_CONFIRMED` — NOT
   * `DECISION_APPROVED` — to match `server/src/method-core/outputs/
   * EventDerivedOutputBridge.ts`'s `deriveFindingsFromEvents()`, the ONLY
   * place that turns events into the frozen Output's `current` levels. That
   * bridge (S1/S2-owned, out of this file's reach) reads `ANSWER_CONFIRMED`
   * exclusively, mirroring `DrdHttpSessionRuntime.recordAnswer()` — a
   * `DECISION_APPROVED(subject:'current_level')` event is kernel-legal but
   * invisible to the freeze bridge, which would silently produce an
   * Output with every `current` level `null`. Confirmed the hard way: the
   * dev-render capture run for `06-tier.png`/`07-output-after-restart.png`
   * produced an Output with `current: {}` before this fix. */
  private stateForUnit(unitId: string): SiriUnitAssessmentState {
    const confirmed = new Set<number>();
    const evidenceByLevel: Record<number, EvidenceStrength> = {};
    let targetLevel: number | null = null;
    for (const e of this.state.events) {
      if (e.unitId !== unitId) continue;
      if (e.type === 'ANSWER_CONFIRMED' && typeof e.level === 'number') {
        confirmed.add(e.level);
      }
      if (e.type === 'DECISION_APPROVED') {
        const payload = e.payload as Partial<DecisionEventPayload>;
        if (payload.subject === 'target_level' && typeof payload.decidedValue === 'number') {
          targetLevel = payload.decidedValue;
        }
      }
      if (e.type === 'EVIDENCE_ATTACHED' && typeof e.level === 'number') {
        const payload = e.payload as Partial<EvidenceEventPayload>;
        if (payload.strength) evidenceByLevel[e.level] = payload.strength;
      }
    }
    return {
      unitId,
      confirmedLevels: [...confirmed].sort((a, b) => a - b),
      evidenceByLevel,
      targetLevel,
    };
  }

  /** Assessor PROPOSES a Band. Runs `proposeSiriBand()` (rationale +
   * no-leapfrog guard) BEFORE any network call — a refused proposal never
   * reaches the server and never appends an event. */
  async proposeBand(input: { unitId: string; level: number; rationale: string }): Promise<SiriBandWriteResult> {
    const state = this.stateForUnit(input.unitId);
    const guard: SiriBandProposalResult = proposeSiriBand({ state, level: input.level, rationale: input.rationale });
    if (!guard.ok) {
      return { ok: false, kind: 'guard_refused', reason: guard.reason, message: guard.message };
    }
    const idemKey = `siri-propose:${input.unitId}:${input.level}:${newIdempotencyKey()}`;
    const payload: Partial<DecisionEventPayload> & { decisionId: string } = {
      decisionId: newIdempotencyKey(),
      subject: 'current_level',
      proposedValue: input.level,
      rationale: guard.rationale,
    };
    let event: MethodEvent | null = null;
    try {
      event = await appendEvent(
        this.sessionId,
        { type: 'DECISION_PROPOSED', unitId: input.unitId, level: input.level, actorKind: 'human', payload },
        idemKey
      );
      await this.refresh();
    } catch (err) {
      if (isOfflineError(err)) {
        const pending = readPending(this.storage, this.sessionId);
        pending.push({
          id: newIdempotencyKey(),
          kind: 'event',
          idempotencyKey: idemKey,
          payload: { type: 'DECISION_PROPOSED', unitId: input.unitId, level: input.level, payload },
        });
        writePending(this.storage, this.sessionId, pending);
        this.setState({ status: 'recovery', pendingWriteCount: pending.length, error: 'Zapis w kolejce — offline.' });
        return { ok: false, kind: 'server_refused', message: 'Offline — zapis w kolejce.' };
      }
      this.handleFailure(err);
      return { ok: false, kind: 'server_refused', message: err instanceof Error ? err.message : 'Błąd serwera.' };
    }
    return { ok: true, event };
  }

  /** Participant/approver CONFIRMS a Band. Teresa is structurally excluded —
   * `confirmedByActor` is typed to `SiriBandConfirmingActor` ('participant' |
   * 'approver'), so this method has no call site that could pass 'teresa'.
   *
   * ★ Appends `ANSWER_CONFIRMED` (unitId, level), NOT `DECISION_APPROVED` —
   * see `stateForUnit()`'s comment above for why: the freeze -> Output
   * bridge (`EventDerivedOutputBridge.deriveFindingsFromEvents`) reads
   * ONLY `ANSWER_CONFIRMED` for a unit's current level. The
   * propose/confirm actor distinction this method's callers care about
   * (assessor proposes via `DECISION_PROPOSED` in `proposeBand()` above,
   * Teresa is excluded from confirming at all) is preserved in this event's
   * OWN payload via `confirmedByActor`/`confirmedByUserId` — no separate
   * decision event is needed for the Output bridge to see the level. */
  async confirmBand(input: {
    unitId: string;
    level: number;
    rationale: string;
    confirmedByActor: SiriBandConfirmingActor;
    confirmedByUserId: string;
  }): Promise<SiriBandWriteResult> {
    const state = this.stateForUnit(input.unitId);
    const guard: SiriBandConfirmResult = confirmSiriBand({
      state,
      level: input.level,
      rationale: input.rationale,
      confirmedByActor: input.confirmedByActor,
      confirmedByUserId: input.confirmedByUserId,
    });
    if (!guard.ok) {
      return { ok: false, kind: 'guard_refused', reason: guard.reason, message: guard.message };
    }
    const idemKey = `siri-confirm:${input.unitId}:${input.level}:${newIdempotencyKey()}`;
    const payload = {
      questionId: `siri-generic:${input.unitId}:${input.level}`,
      answerState: 'confirmed' as const,
      text: guard.rationale,
      confirmedByActor: input.confirmedByActor,
      confirmedByUserId: input.confirmedByUserId,
    };
    let event: MethodEvent | null = null;
    try {
      event = await appendEvent(
        this.sessionId,
        { type: 'ANSWER_CONFIRMED', unitId: input.unitId, level: input.level, actorKind: 'human', payload },
        idemKey
      );
      await this.refresh();
    } catch (err) {
      if (isOfflineError(err)) {
        const pending = readPending(this.storage, this.sessionId);
        pending.push({
          id: newIdempotencyKey(),
          kind: 'event',
          idempotencyKey: idemKey,
          payload: { type: 'ANSWER_CONFIRMED', unitId: input.unitId, level: input.level, payload },
        });
        writePending(this.storage, this.sessionId, pending);
        this.setState({ status: 'recovery', pendingWriteCount: pending.length, error: 'Zapis w kolejce — offline.' });
        return { ok: false, kind: 'server_refused', message: 'Offline — zapis w kolejce.' };
      }
      this.handleFailure(err);
      return { ok: false, kind: 'server_refused', message: err instanceof Error ? err.message : 'Błąd serwera.' };
    }
    return { ok: true, event };
  }

  async recordTargetDecision(input: { unitId: string; level: number; rationale: string }): Promise<void> {
    const idemKey = `siri-target:${input.unitId}:${input.level}:${newIdempotencyKey()}`;
    const payload = { decisionId: newIdempotencyKey(), subject: 'target_level' as const, decidedValue: input.level, rationale: input.rationale };
    await this.runWrite('event', idemKey, { type: 'DECISION_APPROVED', unitId: input.unitId, level: input.level, payload }, () =>
      appendEvent(
        this.sessionId,
        { type: 'DECISION_APPROVED', unitId: input.unitId, level: input.level, actorKind: 'human', payload },
        idemKey
      ).then(() => undefined)
    );
  }

  /** Records an Evidence Item. `itemType` is the SIRI-owned type (includes
   * `factory_observation`) — mapped to the kernel's closed `evidenceType`
   * enum via `toKernelEvidenceType()`; the SIRI-specific type is ALSO kept
   * verbatim in the payload (`siriEvidenceItemType`) so a factory walkthrough
   * stays distinguishable from a generic 'observation' after the round trip. */
  async recordEvidence(input: {
    unitId: string;
    level?: number;
    evidenceItemType: SiriEvidenceItemType;
    strength: EvidenceStrength;
    note?: string;
    linkedQuestionIds?: readonly string[];
  }): Promise<void> {
    const idemKey = `siri-evidence:${input.unitId}:${input.level ?? 'unscoped'}:${newIdempotencyKey()}`;
    const payload = {
      evidenceId: newIdempotencyKey(),
      evidenceType: toKernelEvidenceType(input.evidenceItemType),
      siriEvidenceItemType: input.evidenceItemType,
      strength: input.strength,
      note: input.note ?? '',
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

  /** Explicit optimistic-concurrency-aware transition — same contract as the
   * DRD runtime: a 409 becomes 'conflict', never an auto-overwrite. */
  async transition(to: MethodSessionState): Promise<void> {
    const expectedVersion = this.state.session?.version;
    const idemKey = `siri-transition:${to}:${newIdempotencyKey()}`;
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
    const idemKey = `siri-freeze:${newIdempotencyKey()}`;
    try {
      const res = await apiFreeze(this.sessionId, idemKey, expectedVersion);
      try {
        this.storage.setItem(outputIdCacheKey(this.sessionId), res.output.id);
      } catch {
        // best-effort — reload losing the pointer is a documented gap
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

  // -- Report / Initiative Draft ---------------------------------------------

  async generateReport(input: CreateReportRequest): Promise<unknown> {
    if (!this.state.output) {
      throw new Error('siri-http-runtime: cannot generate a Report Snapshot without a loaded Output');
    }
    const report = await createReport(this.state.output.id, input);
    this.setState({ reports: [...this.state.reports, report] });
    return report;
  }

  async generateInitiativeDraft(input: CreateInitiativeDraftRequest): Promise<unknown> {
    if (!this.state.output) {
      throw new Error('siri-http-runtime: cannot generate an Initiative Proposal Draft without a loaded Output');
    }
    const draft = await createInitiativeDraft(this.state.output.id, input);
    this.setState({ initiatives: [...this.state.initiatives, draft] });
    return draft;
  }

  // -- Teresa ------------------------------------------------------------
  // ★ Teresa may PROPOSE (via createTeresaPreview + a caller-side translation
  // into `proposeBand()`), but this class has NO method that lets a
  // committed Teresa preview reach `confirmBand()` — confirmation always
  // requires a separate, explicit `confirmBand()` call from the screen with
  // an actor of 'participant' | 'approver'.

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
        // a non-offline failure (e.g. transition became illegal while queued)
        // is surfaced by dropping the item — never queued forever.
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

  async discardPendingAndReloadServer(): Promise<void> {
    writePending(this.storage, this.sessionId, []);
    this.setState({ pendingWriteCount: 0 });
    await this.refresh();
  }

  /**
   * TEST/HARNESS ONLY — synthetically overlays a state patch, mirrors
   * `DrdHttpSessionRuntime.debugForceState`. No production code path calls
   * this.
   */
  debugForceState(patch: Partial<SiriHttpRuntimeState>): void {
    this.setState(patch);
  }
}

export default SiriHttpSessionRuntime;
