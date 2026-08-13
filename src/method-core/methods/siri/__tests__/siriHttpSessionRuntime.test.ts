/**
 * @vitest-environment jsdom
 *
 * SiriHttpSessionRuntime — proves parity with `DrdHttpSessionRuntime`
 * (`src/method-core/methods/drd/__tests__/drdHttpSessionRuntime.test.ts`):
 * same offline queue, same 409-conflict discipline, same "Output only from
 * a server response" guarantee, same `@/method-core/api/methodCoreApi`
 * boundary — the ONLY difference is `methodPackId: 'siri'` on the session
 * fixtures. `@/method-core/api/methodCoreApi` is mocked at the module
 * boundary so these tests exercise the REAL `SiriHttpSessionRuntime` class
 * against scripted HTTP responses — never a stand-in runtime.
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
const { SiriHttpSessionRuntime } = await import('../siriHttpSessionRuntime');
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
    id: 'sess-siri-1',
    organizationId: 'org-1',
    projectId: null,
    module: 'assessment',
    methodPackId: 'siri',
    methodPackVersion: '0.1.0-draft',
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

describe('SiriHttpSessionRuntime — same kernel, same endpoints as DRD', () => {
  it('create() passes methodPackId="siri" straight through to the generic createSession() API call', async () => {
    hoisted.createSession.mockResolvedValue({ session: makeSession(), idempotentReplay: false });
    const storage = makeMemoryStorage();

    await SiriHttpSessionRuntime.create(
      { module: 'assessment', methodPackId: 'siri', methodPackVersion: '0.1.0-draft', mode: 'guided_manual', projectId: null },
      storage
    );

    expect(hoisted.createSession).toHaveBeenCalledTimes(1);
    const [input] = hoisted.createSession.mock.calls[0];
    expect(input.methodPackId).toBe('siri');
  });
});

describe('an OLDER cached revision never survives refresh() (parity with DRD requirement 6)', () => {
  it('server v5 replaces a locally-cached v2 once refresh() resolves', async () => {
    const storage = makeMemoryStorage();
    storage.setItem('method-core:http-cache:sess-siri-1', JSON.stringify(makeSession({ version: 2 })));

    hoisted.getSession.mockResolvedValue({ session: makeSession({ version: 5 }), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);

    const runtime = new SiriHttpSessionRuntime('sess-siri-1', storage);
    expect(runtime.getState().session?.version).toBe(2);
    expect(runtime.getState().status).toBe('loading');

    await runtime.refresh();

    expect(runtime.getState().status).toBe('ready');
    expect(runtime.getState().session?.version).toBe(5);
  });
});

describe('frozen Output only ever comes from a server response (parity with DRD requirement 8)', () => {
  it('a frozen session with NO cached output pointer never fabricates Output content', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession({ state: 'frozen' }), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);

    const runtime = new SiriHttpSessionRuntime('sess-siri-1', storage);
    await runtime.refresh();

    expect(runtime.getState().session?.state).toBe('frozen');
    expect(runtime.getState().output).toBeNull();
    expect(hoisted.getOutput).not.toHaveBeenCalled();
  });

  it('freeze() populates Output ONLY from its own response, and caches just the id (a pointer) — this is the ONLY point TIER may run from', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession(), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);
    const serverOutput = {
      id: 'out-siri-1',
      organizationId: 'org-1',
      sessionId: 'sess-siri-1',
      module: 'assessment' as const,
      methodPackId: 'siri',
      methodPackVersion: '0.1.0-draft',
      outputVersion: 1,
      scope: 'full',
      current: { vertical_integration: 3 },
      target: {},
      gap: {},
      limitations: [],
      findings: [],
      contentHash: 'abc123',
      frozenAt: '2026-08-13T00:00:00.000Z',
    };
    hoisted.freeze.mockResolvedValue({ session: makeSession({ state: 'frozen', version: 2 }), output: serverOutput, selfHealed: false });

    const runtime = new SiriHttpSessionRuntime('sess-siri-1', storage);
    await runtime.refresh();
    const res = await runtime.freeze();

    expect(res.output.id).toBe('out-siri-1');
    expect(runtime.getState().output).toEqual(serverOutput);
    expect(storage.getItem('method-core:http-cache:sess-siri-1:output-id')).toBe('out-siri-1');
    expect(storage.getItem('method-core:http-cache:sess-siri-1:output-id')).not.toContain('contentHash');
  });
});

describe('offline write queue and reconnect reconciliation (parity with DRD requirements 4/5)', () => {
  it('a network failure on recordAnswer queues the write and flips status to recovery — never silently dropped', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession(), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);
    hoisted.appendEvent.mockRejectedValue(networkError());

    const runtime = new SiriHttpSessionRuntime('sess-siri-1', storage);
    await runtime.refresh();

    await runtime.recordAnswer({ unitId: 'vertical_integration', level: 1, questionId: 'q1', answerState: 'confirmed', text: 'x' });

    expect(runtime.getState().status).toBe('recovery');
    expect(runtime.getState().pendingWriteCount).toBe(1);
    expect(runtime.hasPendingWrites()).toBe(true);
    const raw = storage.getItem('method-core:pending-writes:sess-siri-1');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toHaveLength(1);
  });

  it('reconnecting never auto-flushes the queue — retryPending() must be called explicitly', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession(), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);
    hoisted.appendEvent.mockRejectedValue(networkError());

    const runtime = new SiriHttpSessionRuntime('sess-siri-1', storage);
    await runtime.refresh();
    await runtime.recordAnswer({ unitId: 'vertical_integration', level: 1, questionId: 'q1', answerState: 'confirmed', text: 'x' });
    expect(runtime.getState().status).toBe('recovery');

    hoisted.appendEvent.mockClear();
    await runtime.refresh();
    expect(runtime.getState().pendingWriteCount).toBe(1);
    expect(hoisted.appendEvent).not.toHaveBeenCalled();

    hoisted.appendEvent.mockResolvedValue({ id: 'evt-1', type: 'ANSWER_CONFIRMED' });
    const result = await runtime.retryPending();
    expect(result).toEqual({ succeeded: 1, stillPending: 0 });
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

    const runtime = new SiriHttpSessionRuntime('sess-siri-1', storage);
    await runtime.refresh();

    await expect(runtime.transition('in_review')).rejects.toThrow();
    expect(runtime.getState().status).toBe('conflict');
    expect(runtime.getState().serverVersion).toBe(7);
    expect(runtime.getState().session?.version).toBe(3);

    hoisted.getSession.mockResolvedValue({ session: makeSession({ version: 7 }), roles: ['owner'] });
    await runtime.refresh();
    expect(runtime.getState().status).toBe('ready');
    expect(runtime.getState().session?.version).toBe(7);
  });
});
