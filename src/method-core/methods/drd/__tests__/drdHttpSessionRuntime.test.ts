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
    expect(runtime.getState().status).toBe('ready');
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
