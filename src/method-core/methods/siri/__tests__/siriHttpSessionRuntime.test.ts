/**
 * @vitest-environment jsdom
 *
 * SiriHttpSessionRuntime — the HTTP source-of-truth path (S5, 2026-08-13).
 * Complements the pure-logic tests in `siriWorkspaceView.test.ts` /
 * `siriTierView.test.ts` (which this suite does NOT re-derive) with the
 * write-path/network-mechanics half of the CEL 9 test list:
 *
 *  - Band bez rationale odrzucony — BEFORE any network call (guard runs
 *    client-side; `appendEvent` must never be invoked).
 *  - no-leapfrog blokuje i komunikuje — same, for a blocked Band.
 *  - factory_observation zapisany jako osobny typ — the appended event's
 *    payload carries the kernel-mapped `evidenceType: 'observation'` AND a
 *    distinguishing `siriEvidenceItemType: 'factory_observation'` field.
 *  - freeze -> Output przez HTTP — `state.output` is populated ONLY from the
 *    `freeze()` response, never fabricated.
 *  - reopen z bazy — constructing a runtime against an EXISTING sessionId
 *    and calling `refresh()` pulls session/events straight from the server,
 *    never from any local seed.
 *
 * `@/method-core/api/methodCoreApi` is mocked at the module boundary, same
 * pattern as `drdHttpSessionRuntime.test.ts` — these tests exercise the REAL
 * `SiriHttpSessionRuntime` class against scripted HTTP responses.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MethodEvent, MethodSession } from '@/method-core/contracts';

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

const { SiriHttpSessionRuntime } = await import('../siriHttpSessionRuntime');

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
    id: 'siri-sess-1',
    organizationId: 'test-org-id',
    projectId: null,
    module: 'assessment',
    methodPackId: 'siri',
    methodPackVersion: '0.1.0-draft',
    state: 'active',
    domainStage: null,
    mode: 'guided_manual',
    ownerUserId: 'test-user-id',
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T00:00:00.000Z',
    version: 1,
    frozenSnapshotId: null,
    revisionOfSessionId: null,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<MethodEvent> = {}): MethodEvent {
  return {
    id: `ev-${Math.random().toString(36).slice(2)}`,
    type: 'DECISION_PROPOSED',
    organizationId: 'test-org-id',
    sessionId: 'siri-sess-1',
    actorKind: 'human',
    actorUserId: 'test-user-id',
    methodPackVersion: '0.1.0-draft',
    occurredAt: '2026-08-13T00:00:00.000Z',
    payload: {},
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('proposeBand — rationale required, never reaches the network without one', () => {
  it('rejects an empty rationale before calling appendEvent', async () => {
    const runtime = new SiriHttpSessionRuntime('siri-sess-1', makeMemoryStorage());
    const result = await runtime.proposeBand({ unitId: 'strategy_governance', level: 0, rationale: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe('guard_refused');
    expect(hoisted.appendEvent).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only rationale before calling appendEvent', async () => {
    const runtime = new SiriHttpSessionRuntime('siri-sess-1', makeMemoryStorage());
    const result = await runtime.proposeBand({ unitId: 'strategy_governance', level: 0, rationale: '   ' });
    expect(result.ok).toBe(false);
    expect(hoisted.appendEvent).not.toHaveBeenCalled();
  });
});

describe('proposeBand / confirmBand — no-leapfrog blocks and explains, never reaches the network', () => {
  it('Band 4 without Band 0-3 confirmed is refused with an explicit message', async () => {
    const runtime = new SiriHttpSessionRuntime('siri-sess-1', makeMemoryStorage());
    const result = await runtime.proposeBand({ unitId: 'vertical_integration', level: 4, rationale: 'Some rationale.' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('guard_refused');
      expect(result.message).toMatch(/Band 4/);
      expect(result.message).toMatch(/no-leapfrog/i);
    }
    expect(hoisted.appendEvent).not.toHaveBeenCalled();
  });

  it('confirmBand is refused the same way for a blocked level', async () => {
    const runtime = new SiriHttpSessionRuntime('siri-sess-1', makeMemoryStorage());
    const result = await runtime.confirmBand({
      unitId: 'vertical_integration',
      level: 3,
      rationale: 'Some rationale.',
      confirmedByActor: 'participant',
      confirmedByUserId: 'test-user-id',
    });
    expect(result.ok).toBe(false);
    expect(hoisted.appendEvent).not.toHaveBeenCalled();
  });
});

describe('proposeBand -> DECISION_PROPOSED, confirmBand -> DECISION_APPROVED', () => {
  it('an open Band 0 proposal appends a DECISION_PROPOSED event, subject current_level', async () => {
    hoisted.appendEvent.mockResolvedValue(makeEvent({ type: 'DECISION_PROPOSED', unitId: 'strategy_governance', level: 0 }));
    hoisted.getSession.mockResolvedValue({ session: makeSession(), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);

    const runtime = new SiriHttpSessionRuntime('siri-sess-1', makeMemoryStorage());
    const result = await runtime.proposeBand({ unitId: 'strategy_governance', level: 0, rationale: 'Widoczna dokumentacja.' });

    expect(result.ok).toBe(true);
    expect(hoisted.appendEvent).toHaveBeenCalledTimes(1);
    const [, request] = hoisted.appendEvent.mock.calls[0];
    expect(request.type).toBe('DECISION_PROPOSED');
    expect(request.unitId).toBe('strategy_governance');
    expect(request.level).toBe(0);
    expect(request.payload.subject).toBe('current_level');
    expect(request.payload.proposedValue).toBe(0);
    expect(request.payload.rationale).toBe('Widoczna dokumentacja.');
  });

  it('confirmBand appends an ANSWER_CONFIRMED event (matches the server freeze->Output bridge) and NEVER accepts actor "teresa" at the type level', async () => {
    hoisted.appendEvent.mockResolvedValue(makeEvent({ type: 'ANSWER_CONFIRMED', unitId: 'strategy_governance', level: 0 }));
    hoisted.getSession.mockResolvedValue({ session: makeSession(), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);

    const runtime = new SiriHttpSessionRuntime('siri-sess-1', makeMemoryStorage());
    const result = await runtime.confirmBand({
      unitId: 'strategy_governance',
      level: 0,
      rationale: 'Zespół potwierdził.',
      confirmedByActor: 'approver',
      confirmedByUserId: 'test-user-id',
    });

    expect(result.ok).toBe(true);
    const [, request] = hoisted.appendEvent.mock.calls[0];
    // ★ NOT DECISION_APPROVED — server/src/method-core/outputs/
    // EventDerivedOutputBridge.ts's deriveFindingsFromEvents() reads ONLY
    // ANSWER_CONFIRMED for a unit's current level (mirrors DRD's
    // recordAnswer()); a DECISION_APPROVED event here would be kernel-legal
    // but invisible to freeze -> Output.
    expect(request.type).toBe('ANSWER_CONFIRMED');
    expect(request.unitId).toBe('strategy_governance');
    expect(request.level).toBe(0);
    expect(request.payload.answerState).toBe('confirmed');
    expect(request.payload.confirmedByActor).toBe('approver');
  });
});

describe('recordEvidence — factory_observation stored as a distinct type', () => {
  it('maps to the kernel evidenceType "observation" but keeps siriEvidenceItemType distinct', async () => {
    hoisted.appendEvent.mockResolvedValue(makeEvent({ type: 'EVIDENCE_ATTACHED', unitId: 'strategy_governance', level: 0 }));
    hoisted.getSession.mockResolvedValue({ session: makeSession(), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);

    const runtime = new SiriHttpSessionRuntime('siri-sess-1', makeMemoryStorage());
    await runtime.recordEvidence({
      unitId: 'strategy_governance',
      level: 0,
      evidenceItemType: 'factory_observation',
      strength: 'E3',
      note: 'Obchód hali.',
    });

    const [, request] = hoisted.appendEvent.mock.calls[0];
    expect(request.type).toBe('EVIDENCE_ATTACHED');
    expect(request.payload.evidenceType).toBe('observation'); // kernel-closed enum
    expect(request.payload.siriEvidenceItemType).toBe('factory_observation'); // SIRI-owned subtype, kept distinct
    expect(request.payload.strength).toBe('E3');
  });

  it('a plain "demonstration" evidence item is NOT mislabeled as factory_observation', async () => {
    hoisted.appendEvent.mockResolvedValue(makeEvent({ type: 'EVIDENCE_ATTACHED' }));
    hoisted.getSession.mockResolvedValue({ session: makeSession(), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);

    const runtime = new SiriHttpSessionRuntime('siri-sess-1', makeMemoryStorage());
    await runtime.recordEvidence({ unitId: 'strategy_governance', level: 0, evidenceItemType: 'demonstration', strength: 'E2' });

    const [, request] = hoisted.appendEvent.mock.calls[0];
    expect(request.payload.evidenceType).toBe('demonstration');
    expect(request.payload.siriEvidenceItemType).toBe('demonstration');
  });
});

describe('freeze -> Output przez HTTP', () => {
  it('state.output is populated ONLY from the freeze() response', async () => {
    const frozenSession = makeSession({ state: 'frozen', frozenSnapshotId: 'snap-1' });
    const output = {
      id: 'output-1',
      organizationId: 'test-org-id',
      sessionId: 'siri-sess-1',
      module: 'assessment' as const,
      methodPackId: 'siri',
      methodPackVersion: '0.1.0-draft',
      outputVersion: 1,
      scope: 'full',
      current: { strategy_governance: 0 },
      target: {},
      gap: {},
      limitations: [],
      findings: [],
      contentHash: 'abc123',
      frozenAt: '2026-08-13T01:00:00.000Z',
    };
    hoisted.freeze.mockResolvedValue({ session: frozenSession, output, selfHealed: false });

    const runtime = new SiriHttpSessionRuntime('siri-sess-1', makeMemoryStorage());
    const res = await runtime.freeze();

    expect(res.output.id).toBe('output-1');
    expect(runtime.getState().output?.id).toBe('output-1');
    expect(runtime.getState().session?.state).toBe('frozen');
  });
});

describe('reopen z bazy — resuming an EXISTING session pulls straight from the server', () => {
  it('a runtime constructed against a known sessionId never invents session/events locally — refresh() is the only source', async () => {
    const serverSession = makeSession({ id: 'siri-sess-reopen', version: 7, state: 'active' });
    const serverEvents = [makeEvent({ id: 'ev-server-1', sessionId: 'siri-sess-reopen' })];
    hoisted.getSession.mockResolvedValue({ session: serverSession, roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue(serverEvents);

    const storage = makeMemoryStorage(); // deliberately empty — simulates a fresh browser/restart
    const runtime = new SiriHttpSessionRuntime('siri-sess-reopen', storage);

    expect(runtime.getState().status).toBe('loading');
    expect(runtime.getState().session).toBeNull(); // nothing fabricated before refresh()

    await runtime.refresh();

    expect(runtime.getState().status).toBe('ready');
    expect(runtime.getState().session?.id).toBe('siri-sess-reopen');
    expect(runtime.getState().session?.version).toBe(7);
    expect(runtime.getState().events).toHaveLength(1);
    expect(runtime.getState().events[0].id).toBe('ev-server-1');
    expect(hoisted.getSession).toHaveBeenCalledWith('siri-sess-reopen');
  });
});
