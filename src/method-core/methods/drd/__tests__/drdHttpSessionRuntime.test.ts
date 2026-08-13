/**
 * @vitest-environment jsdom
 *
 * DrdHttpSessionRuntime — the HTTP source-of-truth path (P0C, 2026-08-13).
 * Covers the runtime-testable half of the P0C brief's 8 test requirements:
 *  6. localStorage with an OLDER revision never overwrites a newer server
 *     state once `refresh()` resolves.
 *  8. a frozen Output is only ever populated from a confirmed server
 *     response (never fabricated from any other localStorage content).
 *  + the offline write-queue mechanics behind requirement 4 (offline ->
 *    RECOVERY_DRAFT, writes queue) and requirement 5's "explicit
 *    reconciliation, never silent overwrite" at the runtime layer
 *    (`retryPending`/`discardPendingAndReloadServer` are the only two ways
 *    a queued write is ever resolved — both require an explicit caller).
 *
 * `@/method-core/api/methodCoreApi` is mocked at the module boundary so
 * these tests exercise the REAL `DrdHttpSessionRuntime` class against
 * scripted HTTP responses — never a stand-in runtime.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MethodSession } from '@/method-core/contracts';

const hoisted = vi.hoisted(() => ({
  getSession: vi.fn(),
  listEvents: vi.fn(),
  createSession: vi.fn(),
  appendEvent: vi.fn(),
  transition: vi.fn(),
  freeze: vi.fn(),
  getOutput: vi.fn(),
  teresaPreview: vi.fn(),
  teresaCommit: vi.fn(),
  createReport: vi.fn(),
  createInitiativeDraft: vi.fn(),
}));

vi.mock('@/method-core/api/methodCoreApi', async () => {
  const actual = await vi.importActual<typeof import('@/method-core/api/methodCoreApi')>(
    '@/method-core/api/methodCoreApi'
  );
  return {
    ...actual,
    getSession: hoisted.getSession,
    listEvents: hoisted.listEvents,
    createSession: hoisted.createSession,
    appendEvent: hoisted.appendEvent,
    transition: hoisted.transition,
    freeze: hoisted.freeze,
    getOutput: hoisted.getOutput,
    teresaPreview: hoisted.teresaPreview,
    teresaCommit: hoisted.teresaCommit,
    createReport: hoisted.createReport,
    createInitiativeDraft: hoisted.createInitiativeDraft,
  };
});

// Import AFTER the mock so the class picks up the mocked module functions.
const { DrdHttpSessionRuntime } = await import('../drdHttpSessionRuntime');
const { MethodCoreApiError } = await import('@/method-core/api/methodCoreApi');

function makeMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

function makeSession(overrides: Partial<MethodSession> = {}): MethodSession {
  return {
    id: 'sess-1',
    organizationId: 'org-1',
    projectId: null,
    module: 'assessment',
    methodPackId: 'drd',
    methodPackVersion: '2.0.0-methodpack.1',
    state: 'active',
    domainStage: null,
    mode: 'guided_manual',
    ownerUserId: 'user-1',
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T00:00:00.000Z',
    version: 1,
    frozenSnapshotId: null,
    revisionOfSessionId: null,
    ...overrides,
  };
}

const networkError = () => new MethodCoreApiError('Network request failed', 0, {}, true);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requirement 6 — an OLDER cached revision never survives refresh()', () => {
  it('server v5 replaces a locally-cached v2 once refresh() resolves', async () => {
    const storage = makeMemoryStorage();
    storage.setItem('method-core:http-cache:sess-1', JSON.stringify(makeSession({ version: 2 })));

    hoisted.getSession.mockResolvedValue({ session: makeSession({ version: 5 }), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);

    const runtime = new DrdHttpSessionRuntime('sess-1', storage);
    // Before refresh(), the cache is allowed to paint something (recovery
    // draft) — but it must never be reported as the final answer.
    expect(runtime.getState().session?.version).toBe(2);
    expect(runtime.getState().status).toBe('loading');

    await runtime.refresh();

    expect(runtime.getState().status).toBe('ready');
    expect(runtime.getState().session?.version).toBe(5);
  });
});

describe('requirement 8 — frozen Output only ever comes from a server response', () => {
  it('a frozen session with NO cached output pointer never fabricates Output content', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession({ state: 'frozen' }), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);

    const runtime = new DrdHttpSessionRuntime('sess-1', storage);
    await runtime.refresh();

    expect(runtime.getState().session?.state).toBe('frozen');
    expect(runtime.getState().output).toBeNull();
    expect(hoisted.getOutput).not.toHaveBeenCalled();
  });

  it('freeze() populates Output ONLY from its own response, and caches just the id (a pointer)', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession(), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);
    const serverOutput = {
      id: 'out-1',
      organizationId: 'org-1',
      sessionId: 'sess-1',
      module: 'assessment' as const,
      methodPackId: 'drd',
      methodPackVersion: '2.0.0-methodpack.1',
      outputVersion: 1,
      scope: 'full',
      current: {},
      target: {},
      gap: {},
      limitations: [],
      findings: [],
      contentHash: 'abc123',
      frozenAt: '2026-08-13T00:00:00.000Z',
    };
    hoisted.freeze.mockResolvedValue({ session: makeSession({ state: 'frozen', version: 2 }), output: serverOutput, selfHealed: false });

    const runtime = new DrdHttpSessionRuntime('sess-1', storage);
    await runtime.refresh();
    const res = await runtime.freeze();

    expect(res.output.id).toBe('out-1');
    expect(runtime.getState().output).toEqual(serverOutput);
    // Only the POINTER is cached, not the content — a second runtime bound
    // to the same storage must re-fetch via getOutput(), never read content
    // out of localStorage.
    expect(storage.getItem('method-core:http-cache:sess-1:output-id')).toBe('out-1');
    expect(storage.getItem('method-core:http-cache:sess-1:output-id')).not.toContain('contentHash');
  });

  it('resuming a frozen session with a cached output-id pointer re-fetches content from getOutput(), never from storage', async () => {
    const storage = makeMemoryStorage();
    storage.setItem('method-core:http-cache:sess-1:output-id', 'out-1');
    hoisted.getSession.mockResolvedValue({ session: makeSession({ state: 'frozen' }), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);
    const serverOutput = {
      id: 'out-1',
      organizationId: 'org-1',
      sessionId: 'sess-1',
      module: 'assessment' as const,
      methodPackId: 'drd',
      methodPackVersion: '2.0.0-methodpack.1',
      outputVersion: 1,
      scope: 'full',
      current: {},
      target: {},
      gap: {},
      limitations: [],
      findings: [],
      contentHash: 'freshFromServer',
      frozenAt: '2026-08-13T00:00:00.000Z',
    };
    hoisted.getOutput.mockResolvedValue({ output: serverOutput, superseded: false, supersededByOutputId: null });

    const runtime = new DrdHttpSessionRuntime('sess-1', storage);
    await runtime.refresh();

    expect(hoisted.getOutput).toHaveBeenCalledWith('out-1');
    expect(runtime.getState().output?.contentHash).toBe('freshFromServer');
  });
});

describe('offline write queue (requirement 4) and reconnect reconciliation (requirement 5)', () => {
  it('a network failure on recordAnswer queues the write and flips status to recovery — never silently dropped', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession(), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);
    hoisted.appendEvent.mockRejectedValue(networkError());

    const runtime = new DrdHttpSessionRuntime('sess-1', storage);
    await runtime.refresh();

    await runtime.recordAnswer({ unitId: 'unit-1', level: 1, questionId: 'q1', answerState: 'confirmed', text: 'x' });

    expect(runtime.getState().status).toBe('recovery');
    expect(runtime.getState().pendingWriteCount).toBe(1);
    expect(runtime.hasPendingWrites()).toBe(true);
    // The queue itself is real localStorage content — never lost.
    const raw = storage.getItem('method-core:pending-writes:sess-1');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toHaveLength(1);
  });

  it('reconnecting never auto-flushes the queue — retryPending() must be called explicitly', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession(), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);
    hoisted.appendEvent.mockRejectedValue(networkError());

    const runtime = new DrdHttpSessionRuntime('sess-1', storage);
    await runtime.refresh();
    await runtime.recordAnswer({ unitId: 'unit-1', level: 1, questionId: 'q1', answerState: 'confirmed', text: 'x' });
    expect(runtime.getState().status).toBe('recovery');

    // Simulate "connectivity is back" the ONLY way this runtime learns about
    // it passively — a refresh() that now succeeds. This must NOT, by
    // itself, flush or discard the queued write.
    hoisted.appendEvent.mockClear();
    await runtime.refresh();
    expect(runtime.getState().pendingWriteCount).toBe(1);
    expect(hoisted.appendEvent).not.toHaveBeenCalled();

    // Only an explicit retryPending() call resolves it.
    hoisted.appendEvent.mockResolvedValue({ id: 'evt-1', type: 'ANSWER_CONFIRMED' });
    const result = await runtime.retryPending();
    expect(result).toEqual({ succeeded: 1, stillPending: 0 });
    expect(runtime.getState().pendingWriteCount).toBe(0);
    // Po udanej rekoncyliacji runtime zatrzymuje się na `recovered` (baner
    // potwierdzenia) — do `ready` schodzi dopiero `acknowledgeRecovered()`.
    expect(runtime.getState().status).toBe('recovered');
  });

  it('discardPendingAndReloadServer() is the explicit "server wins" choice — drops the queue without attempting it', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession(), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);
    hoisted.appendEvent.mockRejectedValue(networkError());

    const runtime = new DrdHttpSessionRuntime('sess-1', storage);
    await runtime.refresh();
    await runtime.recordAnswer({ unitId: 'unit-1', level: 1, questionId: 'q1', answerState: 'confirmed', text: 'x' });
    expect(runtime.getState().pendingWriteCount).toBe(1);

    hoisted.appendEvent.mockClear();
    await runtime.discardPendingAndReloadServer();

    expect(hoisted.appendEvent).not.toHaveBeenCalled();
    expect(runtime.getState().pendingWriteCount).toBe(0);
    expect(runtime.getState().status).toBe('ready');
  });
});

describe('409 conflict — never silently overwritten', () => {
  it('a version_conflict on transition() flips status to conflict with the server version, and the caller must refresh() explicitly', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession({ version: 3 }), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);
    hoisted.transition.mockRejectedValue(new MethodCoreApiError('version_conflict', 409, { error: 'version_conflict', currentVersion: 7 }));

    const runtime = new DrdHttpSessionRuntime('sess-1', storage);
    await runtime.refresh();

    await expect(runtime.transition('in_review')).rejects.toThrow();
    expect(runtime.getState().status).toBe('conflict');
    expect(runtime.getState().serverVersion).toBe(7);
    // The session shown is still the last-known one — nothing was silently
    // replaced with a guess.
    expect(runtime.getState().session?.version).toBe(3);

    hoisted.getSession.mockResolvedValue({ session: makeSession({ version: 7 }), roles: ['owner'] });
    await runtime.refresh();
    expect(runtime.getState().status).toBe('ready');
    expect(runtime.getState().session?.version).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// CEL 4 (S3, 2026-08-13) — eight visible states + offline/recovery hard
// rules. `deriveDrdSourceKind` is the single function every UI call site
// must go through (see its own header) — testing it directly, against
// hand-built state snapshots, is faster and more precise than re-deriving
// the same coverage through a full mocked HTTP sequence for every state.
// ---------------------------------------------------------------------------
describe('CEL 4 — deriveDrdSourceKind: the eight visible states', () => {
  const base: import('../drdHttpSessionRuntime').DrdHttpRuntimeState = {
    status: 'ready',
    session: makeSession(),
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

  it('SERVER — ready, confirmed, nothing queued', async () => {
    const { deriveDrdSourceKind } = await import('../drdHttpSessionRuntime');
    expect(deriveDrdSourceKind({ ...base, status: 'ready', pendingWriteCount: 0 })).toBe('SERVER');
  });

  it('SAVING — a write is in flight', async () => {
    const { deriveDrdSourceKind } = await import('../drdHttpSessionRuntime');
    expect(deriveDrdSourceKind({ ...base, status: 'saving' })).toBe('SAVING');
  });

  it('SAVED — a write was just confirmed', async () => {
    const { deriveDrdSourceKind } = await import('../drdHttpSessionRuntime');
    expect(deriveDrdSourceKind({ ...base, status: 'saved' })).toBe('SAVED');
  });

  it('OFFLINE — disconnected, nothing queued yet', async () => {
    const { deriveDrdSourceKind } = await import('../drdHttpSessionRuntime');
    expect(deriveDrdSourceKind({ ...base, status: 'offline', pendingWriteCount: 0 })).toBe('OFFLINE');
  });

  it('RECOVERY_DRAFT — a local write exists that the server has not confirmed', async () => {
    const { deriveDrdSourceKind } = await import('../drdHttpSessionRuntime');
    expect(deriveDrdSourceKind({ ...base, status: 'offline', pendingWriteCount: 1 })).toBe('RECOVERY_DRAFT');
    expect(deriveDrdSourceKind({ ...base, status: 'recovery', pendingWriteCount: 1 })).toBe('RECOVERY_DRAFT');
  });

  it('CONFLICT — a version conflict is open', async () => {
    const { deriveDrdSourceKind } = await import('../drdHttpSessionRuntime');
    expect(deriveDrdSourceKind({ ...base, status: 'conflict', serverVersion: 9 })).toBe('CONFLICT');
  });

  it('RECONNECTING — connectivity just returned, checking the server', async () => {
    const { deriveDrdSourceKind } = await import('../drdHttpSessionRuntime');
    expect(deriveDrdSourceKind({ ...base, status: 'reconnecting', pendingWriteCount: 1 })).toBe('RECONNECTING');
  });

  it('RECOVERED — explicit reconciliation just completed', async () => {
    const { deriveDrdSourceKind } = await import('../drdHttpSessionRuntime');
    expect(deriveDrdSourceKind({ ...base, status: 'recovered', pendingWriteCount: 0 })).toBe('RECOVERED');
  });

  it('★ hard rule: RECOVERY_DRAFT is NEVER shown once the server is known to have the data — a frozen session with a merely-uncached local Output pointer is SERVER, not RECOVERY_DRAFT (the exact pre-S3 bug in FrozenOutputHttpView)', async () => {
    const { deriveDrdSourceKind } = await import('../drdHttpSessionRuntime');
    const frozenConfirmedNoLocalOutput = { ...base, status: 'ready' as const, session: makeSession({ state: 'frozen' }), output: null, pendingWriteCount: 0 };
    expect(deriveDrdSourceKind(frozenConfirmedNoLocalOutput)).toBe('SERVER');
  });

  it('★ hard rule: a queued write outlives a bare successful refresh() — status flips to ready but the badge still says RECOVERY_DRAFT while the queue is non-empty', async () => {
    const { deriveDrdSourceKind } = await import('../drdHttpSessionRuntime');
    // This is the shape `refresh()` alone produces if it happens to succeed
    // while a write is still queued (GET works, the queued POST has not
    // been retried yet) — status looks like plain 'ready', but the queue
    // says otherwise, and the queue must win.
    expect(deriveDrdSourceKind({ ...base, status: 'ready', pendingWriteCount: 1 })).toBe('RECOVERY_DRAFT');
  });
});

describe('CEL 4 scenario 1 — losing the API mid-work: OFFLINE, write lands in the queue', () => {
  it('a GET failure with nothing queued yet is OFFLINE, not RECOVERY_DRAFT', async () => {
    const { deriveDrdSourceKind } = await import('../drdHttpSessionRuntime');
    const storage = makeMemoryStorage();
    hoisted.getSession.mockRejectedValue(networkError());
    hoisted.listEvents.mockResolvedValue([]);

    const runtime = new DrdHttpSessionRuntime('sess-1', storage);
    await runtime.refresh();

    expect(runtime.getState().status).toBe('offline');
    expect(runtime.getState().pendingWriteCount).toBe(0);
    expect(deriveDrdSourceKind(runtime.getState())).toBe('OFFLINE');
  });
});

describe('CEL 4 scenario 2 — a local edit made offline becomes RECOVERY_DRAFT', () => {
  it('recordAnswer failing offline queues the write and the badge is RECOVERY_DRAFT', async () => {
    const { deriveDrdSourceKind } = await import('../drdHttpSessionRuntime');
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession(), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);
    hoisted.appendEvent.mockRejectedValue(networkError());

    const runtime = new DrdHttpSessionRuntime('sess-1', storage);
    await runtime.refresh();
    await runtime.recordAnswer({ unitId: 'unit-1', level: 1, questionId: 'q1', answerState: 'confirmed', text: 'x' });

    expect(runtime.getState().pendingWriteCount).toBe(1);
    expect(deriveDrdSourceKind(runtime.getState())).toBe('RECOVERY_DRAFT');
  });
});

describe('CEL 4 scenario 3 — reconnect: RECONNECTING → explicit reconciliation → RECOVERED', () => {
  it('reconnect() shows RECONNECTING while checking the server, then hands off to the explicit reconciliation state — never auto-applies', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession(), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);
    hoisted.appendEvent.mockRejectedValue(networkError());

    const runtime = new DrdHttpSessionRuntime('sess-1', storage);
    await runtime.refresh();
    await runtime.recordAnswer({ unitId: 'unit-1', level: 1, questionId: 'q1', answerState: 'confirmed', text: 'x' });
    expect(runtime.getState().pendingWriteCount).toBe(1);

    // Control exactly when getSession resolves so the transient
    // 'reconnecting' moment is observable, not just flashed through.
    let resolveGetSession: (v: unknown) => void = () => {};
    hoisted.getSession.mockReturnValue(new Promise((resolve) => (resolveGetSession = resolve)));
    hoisted.appendEvent.mockClear(); // clear the earlier (failed, queued) call before asserting "nothing auto-applied" below.

    const reconnectPromise = runtime.reconnect();
    expect(runtime.getState().status).toBe('reconnecting');

    resolveGetSession({ session: makeSession(), roles: ['owner'] });
    await reconnectPromise;

    // Back online, but STILL showing the explicit-reconciliation state —
    // nothing auto-applied.
    expect(runtime.getState().status).toBe('recovery');
    expect(hoisted.appendEvent).not.toHaveBeenCalled();
    expect(runtime.getState().pendingWriteCount).toBe(1);

    // The explicit human action.
    hoisted.appendEvent.mockResolvedValue({ id: 'evt-1', type: 'ANSWER_CONFIRMED' });
    const result = await runtime.retryPending();
    expect(result).toEqual({ succeeded: 1, stillPending: 0 });

    // ★ Do 2026-08-13 ta asercja brzmiała `toBe('ready')` — czyli test o
    // nazwie „…→ RECOVERED" ZATWIERDZAŁ brak stanu RECOVERED. Był zielony,
    // więc CEL 4 wyglądał na dowieziony w komplecie. `retryPending()`
    // ustawiał `recovered`, a następna linia `await this.refresh()`
    // nadpisywała to `loading`→`ready` w tym samym ticku JS, zanim React
    // cokolwiek wyrenderował. Użytkownik nigdy nie zobaczył potwierdzenia,
    // że jego zaległe zmiany zostały pogodzone z serwerem.
    expect(runtime.getState().status).toBe('recovered');
    // ...a stan MUSI przeżyć całe odświeżenie, nie tylko moment przypisania.
    expect(runtime.getState().session).not.toBeNull();
    expect(runtime.getState().pendingWriteCount).toBe(0);

    // Dopiero jawne potwierdzenie przez człowieka gasi baner.
    runtime.acknowledgeRecovered();
    expect(runtime.getState().status).toBe('ready');
  });

  it('★ RECOVERED przeżywa odświeżenie — regresja na nadpisanie statusu przez refresh()', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession(), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);
    hoisted.appendEvent.mockRejectedValue(networkError());

    const runtime = new DrdHttpSessionRuntime('sess-1', storage);
    await runtime.refresh();
    await runtime.recordAnswer({ unitId: 'unit-1', level: 1, questionId: 'q1', answerState: 'confirmed', text: 'x' });

    // Odświeżenie w trakcie rekoncyliacji jest WOLNE — gdyby refresh()
    // nadpisywał status, zobaczylibyśmy tu 'loading', a nie 'recovered'.
    let resolveGet: (v: unknown) => void = () => {};
    hoisted.appendEvent.mockResolvedValue({ id: 'evt-1', type: 'ANSWER_CONFIRMED' });
    hoisted.getSession.mockReturnValue(new Promise((resolve) => (resolveGet = resolve)));

    const retry = runtime.retryPending();
    await Promise.resolve();
    expect(runtime.getState().status).toBe('recovered');

    resolveGet({ session: makeSession(), roles: ['owner'] });
    await retry;
    expect(runtime.getState().status).toBe('recovered');
  });
});

describe('CEL 4 scenario 7 — retry kolejki: SAVING → SAVED', () => {
  it('a single online write is SAVING while in flight, then settles on SAVED (never a bare, un-refreshed guess)', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession(), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);

    let resolveAppend: (v: unknown) => void = () => {};
    hoisted.appendEvent.mockReturnValue(new Promise((resolve) => (resolveAppend = resolve)));

    const runtime = new DrdHttpSessionRuntime('sess-1', storage);
    await runtime.refresh();

    const writePromise = runtime.recordAnswer({ unitId: 'unit-1', level: 1, questionId: 'q1', answerState: 'confirmed', text: 'x' });
    // Observable synchronously — set as the very first act of runWrite,
    // before the network call even starts.
    expect(runtime.getState().status).toBe('saving');

    resolveAppend({ id: 'evt-1', type: 'ANSWER_CONFIRMED' });
    await writePromise;
    // ★ SAVED is set only AFTER `refresh()` re-confirms the write against
    // the server — never a pre-refresh guess — and is the write's final,
    // deterministically observable resting state (no timing race: it is
    // `runWrite`'s last synchronous act before the promise resolves).
    expect(runtime.getState().status).toBe('saved');
  });
});

describe('CEL 4 scenarios 4/5/6 — version conflicts during reconciliation never silently overwrite', () => {
  it('scenario 4 — an older local DRAFT loses to a newer server revision: dropped, user informed, reconciliation continues', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession(), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);
    hoisted.appendEvent.mockRejectedValue(networkError());

    const runtime = new DrdHttpSessionRuntime('sess-1', storage);
    await runtime.refresh();
    // A DRAFT autosave (disposable) — draft: true.
    await runtime.recordAnswer({ unitId: 'unit-1', level: 1, questionId: 'q1', answerState: 'partial', text: 'wersja robocza', draft: true });
    expect(runtime.getState().pendingWriteCount).toBe(1);

    hoisted.appendEvent.mockRejectedValue(new MethodCoreApiError('version_conflict', 409, { error: 'version_conflict', currentVersion: 5 }));
    const result = await runtime.retryPending();

    // Never silently vanished — the user is informed WHY it was dropped.
    expect(runtime.getState().staleDraftNotices.length).toBe(1);
    expect(runtime.getState().staleDraftNotices[0]).toMatch(/wersj[ęa] robocz/);
    // Server wins for a disposable draft: the queue is empty, reconciliation
    // considered this item resolved (not lost, not silently applied over
    // newer server content either).
    expect(result.stillPending).toBe(0);
    expect(runtime.getState().pendingWriteCount).toBe(0);
    expect(runtime.getState().status).not.toBe('conflict');
  });

  it('scenario 5 — a CONFIRMED write conflicts with a newer server revision: CONFLICT, diff, stopped for a human decision, nothing lost', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession({ version: 3 }), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);
    hoisted.appendEvent.mockRejectedValue(networkError());

    const runtime = new DrdHttpSessionRuntime('sess-1', storage);
    await runtime.refresh();
    // A CONFIRMED write — draft omitted (falsy), the deliberate, non-disposable case.
    await runtime.recordAnswer({ unitId: 'unit-1', level: 1, questionId: 'q1', answerState: 'confirmed', text: 'Odpowiedź ostateczna.' });
    expect(runtime.getState().pendingWriteCount).toBe(1);

    hoisted.appendEvent.mockRejectedValue(new MethodCoreApiError('version_conflict', 409, { error: 'version_conflict', currentVersion: 9 }));
    const result = await runtime.retryPending();

    expect(runtime.getState().status).toBe('conflict');
    expect(runtime.getState().serverVersion).toBe(9);
    // Nothing lost: the write is still queued, waiting for a human decision
    // (retryPending again, or discardPendingAndReloadServer).
    expect(result.stillPending).toBe(1);
    expect(runtime.getState().pendingWriteCount).toBe(1);
    // A real diff, not just two bare version numbers.
    expect(runtime.getState().conflictDetail).not.toBeNull();
    expect(runtime.getState().conflictDetail?.localSummary).toMatch(/q1/);
    expect(runtime.getState().conflictDetail?.serverVersion).toBe(9);
    expect(runtime.getState().conflictDetail?.localBaseVersion).toBe(3);
  });

  it('scenario 6 — a 409 straight from the server (not via the queue) is CONFLICT, never a silent overwrite', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession({ version: 4 }), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);
    hoisted.appendEvent.mockRejectedValue(new MethodCoreApiError('version_conflict', 409, { error: 'version_conflict', currentVersion: 11 }));

    const runtime = new DrdHttpSessionRuntime('sess-1', storage);
    await runtime.refresh();
    await expect(runtime.recordAnswer({ unitId: 'unit-1', level: 1, questionId: 'q1', answerState: 'confirmed', text: 'x' })).rejects.toThrow();

    expect(runtime.getState().status).toBe('conflict');
    expect(runtime.getState().serverVersion).toBe(11);
    // A live (non-queued) 409 never enters the retry queue — nothing to
    // silently overwrite because nothing was queued in the first place.
    expect(runtime.getState().pendingWriteCount).toBe(0);
  });
});

describe('CEL 4 scenario 8 — reopen after a restart: SERVER, data from the database', () => {
  it('a brand new runtime instance, on refresh(), reports SERVER with no pending writes', async () => {
    const { deriveDrdSourceKind } = await import('../drdHttpSessionRuntime');
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession({ version: 12 }), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);

    // Simulates a full page reload: a fresh runtime instance, same storage.
    const runtime = new DrdHttpSessionRuntime('sess-1', storage);
    await runtime.refresh();

    expect(runtime.getState().status).toBe('ready');
    expect(runtime.getState().pendingWriteCount).toBe(0);
    expect(deriveDrdSourceKind(runtime.getState())).toBe('SERVER');
    expect(runtime.getState().session?.version).toBe(12);
  });
});

describe('CEL 4 extra — the queue never loses a write', () => {
  it('three distinct offline writes all remain accounted for (queued, never vanished) across a partial retry', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession(), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);
    hoisted.appendEvent.mockRejectedValue(networkError());

    const runtime = new DrdHttpSessionRuntime('sess-1', storage);
    await runtime.refresh();
    await runtime.recordAnswer({ unitId: 'unit-1', level: 1, questionId: 'q1', answerState: 'confirmed', text: 'a' });
    await runtime.recordAnswer({ unitId: 'unit-1', level: 2, questionId: 'q2', answerState: 'confirmed', text: 'b' });
    await runtime.recordEvidence({ unitId: 'unit-1', evidenceId: 'ev-1', evidenceType: 'document', strength: 'E2' });
    expect(runtime.getState().pendingWriteCount).toBe(3);

    // Second item (q2) hits a real, non-offline, non-conflict failure (e.g.
    // the answer became invalid server-side) — must NOT vanish silently.
    let call = 0;
    hoisted.appendEvent.mockImplementation(() => {
      call += 1;
      if (call === 1) return Promise.resolve({ id: 'evt-1', type: 'ANSWER_CONFIRMED' });
      return Promise.reject(new MethodCoreApiError('invalid', 422, { error: 'now_invalid' }));
    });

    const result = await runtime.retryPending();
    // First succeeded, second failed non-fatally and stops the batch (per
    // the "never silently drop" rule) — the second AND third item (never
    // attempted) are both still accounted for in the queue.
    expect(result.succeeded).toBe(1);
    expect(result.stillPending).toBe(2);
    expect(runtime.getState().pendingWriteCount).toBe(2);

    const raw = storage.getItem('method-core:pending-writes:sess-1');
    expect(JSON.parse(raw!)).toHaveLength(2);
  });

  it('a full successful reconciliation drains the queue to zero and every item is accounted for as succeeded', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession(), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);
    hoisted.appendEvent.mockRejectedValue(networkError());

    const runtime = new DrdHttpSessionRuntime('sess-1', storage);
    await runtime.refresh();
    await runtime.recordAnswer({ unitId: 'unit-1', level: 1, questionId: 'q1', answerState: 'confirmed', text: 'a' });
    await runtime.recordEvidence({ unitId: 'unit-1', evidenceId: 'ev-1', evidenceType: 'document', strength: 'E2' });
    expect(runtime.getState().pendingWriteCount).toBe(2);

    hoisted.appendEvent.mockResolvedValue({ id: 'evt-x', type: 'ANSWER_CONFIRMED' });
    const result = await runtime.retryPending();

    expect(result.succeeded).toBe(2);
    expect(result.stillPending).toBe(0);
    expect(runtime.getState().pendingWriteCount).toBe(0);
    expect(runtime.hasPendingWrites()).toBe(false);
  });
});

describe('CEL 4 extra — parallel identical writes never duplicate the event (idempotency key)', () => {
  it('two concurrent recordAnswer() calls for the SAME logical answer collapse into one appendEvent call', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession(), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);
    hoisted.appendEvent.mockResolvedValue({ id: 'evt-1', type: 'ANSWER_CONFIRMED' });

    const runtime = new DrdHttpSessionRuntime('sess-1', storage);
    await runtime.refresh();

    const args = { unitId: 'unit-1', level: 1, questionId: 'q1', answerState: 'confirmed' as const, text: 'x' };
    await Promise.all([runtime.recordAnswer(args), runtime.recordAnswer(args)]);

    expect(hoisted.appendEvent).toHaveBeenCalledTimes(1);
  });

  it('two concurrent recordEvidence() calls for the SAME evidenceId collapse into one appendEvent call', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession(), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);
    hoisted.appendEvent.mockResolvedValue({ id: 'evt-1', type: 'EVIDENCE_ATTACHED' });

    const runtime = new DrdHttpSessionRuntime('sess-1', storage);
    await runtime.refresh();

    const args = { unitId: 'unit-1', evidenceId: 'ev-shared', evidenceType: 'document', strength: 'E2' as const };
    await Promise.all([runtime.recordEvidence(args), runtime.recordEvidence(args)]);

    expect(hoisted.appendEvent).toHaveBeenCalledTimes(1);
  });

  it('two DIFFERENT logical writes are NOT deduped — both reach the server', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession(), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);
    hoisted.appendEvent.mockResolvedValue({ id: 'evt-1', type: 'ANSWER_CONFIRMED' });

    const runtime = new DrdHttpSessionRuntime('sess-1', storage);
    await runtime.refresh();

    await Promise.all([
      runtime.recordAnswer({ unitId: 'unit-1', level: 1, questionId: 'q1', answerState: 'confirmed', text: 'x' }),
      runtime.recordAnswer({ unitId: 'unit-1', level: 1, questionId: 'q2', answerState: 'confirmed', text: 'y' }),
    ]);

    expect(hoisted.appendEvent).toHaveBeenCalledTimes(2);
  });
});
