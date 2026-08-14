/**
 * MethodEventStore — append-only event store.
 *
 * Covers kernel test requirements:
 *  4. same idempotencyKey appended twice -> ONE row in method_events.
 *  10. an event carrying `supersedes` does NOT delete/replace its
 *      predecessor — both remain in the store.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createKernelTestDb, type KernelTestDbHandle } from './kernelTestDb.js';

let testDb: KernelTestDbHandle;

vi.mock('../../utils/DbPromise.js', async () => {
  const { createKernelTestDb } = await import('./kernelTestDb.js');
  testDb = createKernelTestDb();
  return { ...testDb, default: testDb };
});

const { MethodEventStore } = await import('../MethodEventStore.js');

describe('MethodEventStore', () => {
  const organizationId = 'org-1';
  const sessionId = 'session-1';

  beforeEach(() => {
    testDb.reset();
  });

  function baseEvent(overrides: Partial<Parameters<InstanceType<typeof MethodEventStore>['append']>[0]> = {}) {
    return {
      organizationId,
      sessionId,
      type: 'ANSWER_DRAFTED' as const,
      actorKind: 'human' as const,
      actorUserId: 'user-1',
      methodPackVersion: '1.0.0',
      payload: { questionId: 'q1', answerState: 'confirmed' as const },
      ...overrides,
    };
  }

  it('appends a plain event with no idempotency key', async () => {
    const store = new MethodEventStore();
    const event = await store.append(baseEvent());
    expect(event.id).toBeTruthy();
    expect(event.sessionId).toBe(sessionId);
    expect(testDb.getRows('method_events')).toHaveLength(1);
  });

  it('same idempotencyKey appended twice resolves to ONE row', async () => {
    const store = new MethodEventStore();
    const first = await store.append(baseEvent({ idempotencyKey: 'idem-1' }));
    const second = await store.append(
      baseEvent({ idempotencyKey: 'idem-1', payload: { questionId: 'q1', answerState: 'partial' } })
    );

    expect(second.id).toBe(first.id);
    // The second call's differing payload must NOT have overwritten the
    // first — append is a resolve-to-existing-row operation, not an upsert.
    expect(second.payload).toEqual(first.payload);
    expect(testDb.getRows('method_events')).toHaveLength(1);
  });

  it('the same idempotencyKey is independent per session', async () => {
    const store = new MethodEventStore();
    await store.append(baseEvent({ idempotencyKey: 'shared-key' }));
    await store.append(baseEvent({ sessionId: 'session-2', idempotencyKey: 'shared-key' }));
    expect(testDb.getRows('method_events')).toHaveLength(2);
  });

  it('a correcting event with `supersedes` does not delete its predecessor', async () => {
    const store = new MethodEventStore();
    const original = await store.append(
      baseEvent({ type: 'DECISION_APPROVED', payload: { decisionId: 'd1', subject: 'current_level', rationale: 'first pass' } })
    );
    const correction = await store.append(
      baseEvent({
        type: 'DECISION_APPROVED',
        supersedes: original.id,
        payload: { decisionId: 'd1', subject: 'current_level', rationale: 'corrected' },
      })
    );

    const all = await store.listBySession(organizationId, sessionId);
    expect(all.map((e) => e.id)).toEqual(expect.arrayContaining([original.id, correction.id]));
    expect(all).toHaveLength(2);
    expect(correction.supersedes).toBe(original.id);

    // The store never mutates the original in place.
    const originalRow = testDb.getRows('method_events').find((r) => r.id === original.id);
    expect(originalRow?.supersedes).toBeNull();
  });

  it('listBySession returns events in chronological order and only for that session', async () => {
    const store = new MethodEventStore();
    const e1 = await store.append(baseEvent({ occurredAt: '2026-08-13T10:00:00.000Z' }));
    const e2 = await store.append(baseEvent({ occurredAt: '2026-08-13T09:00:00.000Z' }));
    await store.append(baseEvent({ sessionId: 'other-session' }));

    const events = await store.listBySession(organizationId, sessionId);
    expect(events.map((e) => e.id)).toEqual([e2.id, e1.id]);
  });
});
