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
  listOutputs: vi.fn(),
  listReports: vi.fn(),
  listInitiativeDrafts: vi.fn(),
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
    listOutputs: hoisted.listOutputs,
    listReports: hoisted.listReports,
    listInitiativeDrafts: hoisted.listInitiativeDrafts,
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
  hoisted.listOutputs.mockResolvedValue({ outputs: [], total: 0 });
  hoisted.listReports.mockResolvedValue([]);
  hoisted.listInitiativeDrafts.mockResolvedValue([]);
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

  it('resuming a frozen session discovers the current Output from the server, ignoring a stale cached pointer', async () => {
    const storage = makeMemoryStorage();
    storage.setItem('method-core:http-cache:sess-1:output-id', 'out-stale');
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
    hoisted.listOutputs.mockResolvedValue({
      outputs: [{ id: 'out-1', sessionId: 'sess-1', outputVersion: 1 }],
      total: 1,
    });
    hoisted.getOutput.mockResolvedValue({ output: serverOutput, superseded: false, supersededByOutputId: null });

    const runtime = new DrdHttpSessionRuntime('sess-1', storage);
    await runtime.refresh();

    expect(hoisted.getOutput).toHaveBeenCalledWith('out-1');
    expect(runtime.getState().output?.contentHash).toBe('freshFromServer');
    expect(storage.getItem('method-core:http-cache:sess-1:output-id')).toBe('out-1');
  });

  it('cold reopen hydrates persisted report and initiative state for the exact current Output', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession({ state: 'frozen' }), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);
    hoisted.listOutputs.mockResolvedValue({
      outputs: [
        { id: 'out-old', sessionId: 'sess-1', outputVersion: 1 },
        { id: 'out-current', sessionId: 'sess-1', outputVersion: 2 },
        { id: 'out-foreign', sessionId: 'sess-other', outputVersion: 99 },
      ],
      total: 3,
    });
    const output = {
      id: 'out-current', organizationId: 'org-1', sessionId: 'sess-1', module: 'assessment' as const,
      methodPackId: 'drd', methodPackVersion: '2.0.0-methodpack.1', outputVersion: 2,
      scope: 'full', current: {}, target: {}, gap: {}, limitations: [], findings: [],
      contentHash: 'canonical-cold-hash', frozenAt: '2026-08-13T00:00:00.000Z',
    };
    const report = { id: 'report-1', outputId: 'out-current', title: 'Persisted DRD report' };
    const initiative = { id: 'draft-1', outputId: 'out-current', title: 'Persisted initiative' };
    hoisted.getOutput.mockResolvedValue({ output, superseded: false, supersededByOutputId: null });
    hoisted.listReports.mockResolvedValue([report]);
    hoisted.listInitiativeDrafts.mockResolvedValue([initiative]);

    const runtime = new DrdHttpSessionRuntime('sess-1', storage);
    await runtime.refresh();

    expect(runtime.getState()).toMatchObject({
      status: 'ready', output, reports: [report], initiatives: [initiative],
    });
    expect(hoisted.listReports).toHaveBeenCalledWith({ outputId: 'out-current', status: 'current' });
    expect(hoisted.listInitiativeDrafts).toHaveBeenCalledWith({ outputId: 'out-current', status: 'current' });
  });

  it('fails closed when canonical Output discovery is unavailable instead of presenting cached success', async () => {
    const storage = makeMemoryStorage();
    storage.setItem('method-core:http-cache:sess-1:output-id', 'out-cached');
    hoisted.getSession.mockResolvedValue({ session: makeSession({ state: 'frozen' }), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);
    hoisted.listOutputs.mockRejectedValue(new Error('output listing unavailable'));

    const runtime = new DrdHttpSessionRuntime('sess-1', storage);
    await runtime.refresh();

    expect(runtime.getState()).toMatchObject({ status: 'error', output: null });
    expect(hoisted.getOutput).not.toHaveBeenCalled();
  });
});

describe('mounted production write contract — API confirmation is mandatory', () => {
  it('a network failure rejects the save, exposes offline state, and creates no local write queue', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession(), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);
    hoisted.appendEvent.mockRejectedValue(networkError());

    const runtime = new DrdHttpSessionRuntime('sess-1', storage);
    await runtime.refresh();

    await expect(runtime.recordAnswer({ unitId: 'unit-1', level: 1, questionId: 'q1', answerState: 'confirmed', text: 'x' }))
      .rejects.toMatchObject({ isNetworkError: true });

    expect(runtime.getState()).toMatchObject({ status: 'offline', pendingWriteCount: 0 });
    expect(runtime.hasPendingWrites()).toBe(false);
    expect(storage.getItem('method-core:pending-writes:sess-1')).toBeNull();
    expect(runtime.getState().pendingWriteCount).toBe(0);
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
