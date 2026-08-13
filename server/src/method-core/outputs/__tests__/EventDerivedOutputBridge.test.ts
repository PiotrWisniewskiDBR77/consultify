/**
 * EventDerivedOutputBridge — the freeze -> Output bridge (A6, 2026-08-13).
 *
 * Covers vertical-slice test requirement 5 ("freeze tworzy AssessmentOutput
 * — most działa") end-to-end through the REAL `MethodSessionService`, not a
 * stub: append real kernel events, drive the real transition matrix up to
 * `frozen`, and assert a real `method_outputs` row (+ findings) exists
 * afterwards, built from those exact events.
 *
 * Also covers the pure derivation (`deriveFindingsFromEvents`) in isolation,
 * and proves a session with `outputBridge` omitted keeps the pre-A6
 * behaviour (snapshot only, no Output — never silently created either).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KernelTestDbHandle } from '../../__tests__/kernelTestDb.js';
import type { MethodEvent } from '../../contracts/index.js';

let testDb: KernelTestDbHandle;

vi.mock('../../../utils/DbPromise.js', async () => {
  const { createKernelTestDb } = await import('../../__tests__/kernelTestDb.js');
  testDb = createKernelTestDb();
  return { ...testDb, default: testDb };
});

const { MethodEventStore } = await import('../../MethodEventStore.js');
const { MethodSessionService } = await import('../../MethodSessionService.js');
const { MethodOutputService } = await import('../MethodOutputService.js');
const { EventDerivedOutputBridge, deriveFindingsFromEvents } = await import(
  '../EventDerivedOutputBridge.js'
);
import type { PackReadinessLookup } from '../../MethodSessionService.js';

const organizationId = 'org-1';

function makeEvent(overrides: Partial<MethodEvent> = {}): MethodEvent {
  return {
    id: overrides.id ?? `ev-${Math.random().toString(36).slice(2)}`,
    type: 'ANSWER_CONFIRMED',
    organizationId,
    sessionId: 'session-1',
    unitId: '1A',
    level: 3,
    actorKind: 'human',
    actorUserId: 'user-1',
    methodPackVersion: '1.0.0',
    occurredAt: '2026-08-13T10:00:00.000Z',
    payload: {},
    ...overrides,
  };
}

describe('deriveFindingsFromEvents (pure)', () => {
  it('builds a finding only for units that have >=1 EVIDENCE_ATTACHED event', () => {
    const events: MethodEvent[] = [
      makeEvent({ id: 'e1', type: 'ANSWER_CONFIRMED', unitId: '1A', level: 2 }),
      makeEvent({
        id: 'e2',
        type: 'EVIDENCE_ATTACHED',
        unitId: '1A',
        payload: { evidenceId: 'ev-1', evidenceType: 'document', strength: 'E2' },
      }),
      // 1B has an answer but NO evidence -> current/target recorded, no finding.
      makeEvent({ id: 'e3', type: 'ANSWER_CONFIRMED', unitId: '1B', level: 1 }),
      makeEvent({
        id: 'e4',
        type: 'DECISION_APPROVED',
        unitId: '1A',
        level: 4,
        payload: { decisionId: 'd-1', subject: 'target_level', rationale: 'demo target' },
      }),
    ];

    const { findings, current, target, gap } = deriveFindingsFromEvents(events);

    expect(current).toEqual({ '1A': 2, '1B': 1 });
    expect(target).toEqual({ '1A': 4, '1B': null });
    expect(gap).toEqual({ '1A': 2, '1B': null });

    expect(findings).toHaveLength(1);
    expect(findings[0].unitId).toBe('1A');
    expect(findings[0].supportingEvidence).toHaveLength(1);
    expect(findings[0].supportingEvidence[0].evidenceId).toBe('ev-1');
    expect(findings[0].businessMeaning.length).toBeGreaterThan(0);
    expect(findings[0].recommendation.length).toBeGreaterThan(0);
  });

  it('later ANSWER_CONFIRMED for the same unit overwrites the level (last-write-wins, chronological)', () => {
    const events: MethodEvent[] = [
      makeEvent({ id: 'e1', type: 'ANSWER_CONFIRMED', unitId: '1A', level: 2 }),
      makeEvent({ id: 'e2', type: 'ANSWER_CONFIRMED', unitId: '1A', level: 3 }),
      makeEvent({
        id: 'e3',
        type: 'EVIDENCE_ATTACHED',
        unitId: '1A',
        payload: { evidenceId: 'ev-1', evidenceType: 'document', strength: 'E2' },
      }),
    ];
    const { current } = deriveFindingsFromEvents(events);
    expect(current['1A']).toBe(3);
  });
});

describe('EventDerivedOutputBridge (wired into MethodSessionService.transition)', () => {
  let events: InstanceType<typeof MethodEventStore>;
  let outputs: InstanceType<typeof MethodOutputService>;
  const packs: PackReadinessLookup = { async getReadiness() { return { canStart: true }; } };

  beforeEach(() => {
    testDb.reset();
    events = new MethodEventStore();
    outputs = new MethodOutputService();
  });

  async function driveToInReview(service: InstanceType<typeof MethodSessionService>) {
    const created = await service.createSession({
      organizationId,
      projectId: null,
      module: 'assessment',
      methodPackId: 'drd',
      methodPackVersion: '1.0.0',
      ownerUserId: 'owner-1',
      mode: 'guided_manual',
    });
    if (!created.ok) throw new Error('setup: createSession failed');
    const session = created.session;
    await service.assignRole(organizationId, session.id, 'owner-1', 'owner');
    await service.assignRole(organizationId, session.id, 'owner-1', 'lead_assessor');

    await events.append({
      organizationId,
      sessionId: session.id,
      type: 'ANSWER_CONFIRMED',
      unitId: '1A',
      level: 3,
      actorKind: 'human',
      actorUserId: 'owner-1',
      methodPackVersion: '1.0.0',
      payload: { questionId: 'q-1', answerState: 'confirmed' },
    });
    await events.append({
      organizationId,
      sessionId: session.id,
      type: 'EVIDENCE_ATTACHED',
      unitId: '1A',
      actorKind: 'human',
      actorUserId: 'owner-1',
      methodPackVersion: '1.0.0',
      payload: { evidenceId: 'ev-1', evidenceType: 'document', strength: 'E2' },
    });

    const toPrepared = await service.transition({
      sessionId: session.id,
      to: 'prepared',
      actorKind: 'human',
      actorUserId: 'owner-1',
      idempotencyKey: `${session.id}-prep`,
    });
    if (!toPrepared.ok) throw new Error('setup: draft->prepared failed: ' + JSON.stringify(toPrepared));

    const toActive = await service.transition({
      sessionId: session.id,
      to: 'active',
      actorKind: 'human',
      actorUserId: 'owner-1',
      idempotencyKey: `${session.id}-active`,
    });
    if (!toActive.ok) throw new Error('setup: prepared->active failed: ' + JSON.stringify(toActive));

    const toReview = await service.transition({
      sessionId: session.id,
      to: 'in_review',
      actorKind: 'human',
      actorUserId: 'owner-1',
      idempotencyKey: `${session.id}-review`,
    });
    if (!toReview.ok) throw new Error('setup: active->in_review failed: ' + JSON.stringify(toReview));
    return session;
  }

  it('requirement 5: freeze with the bridge wired creates a real AssessmentOutput (method_outputs row + findings)', async () => {
    const bridge = new EventDerivedOutputBridge(events, outputs);
    const service = new MethodSessionService(packs, events, bridge);
    const session = await driveToInReview(service);
    await service.assignRole(organizationId, session.id, 'approver-1', 'approver');

    const result = await service.transition({
      sessionId: session.id,
      to: 'frozen',
      actorKind: 'human',
      actorUserId: 'approver-1',
      idempotencyKey: `${session.id}-freeze`,
    });
    expect(result.ok).toBe(true);

    const outputRows = testDb.getRows('method_outputs');
    expect(outputRows).toHaveLength(1);
    expect(outputRows[0].session_id).toBe(session.id);

    const findingRows = testDb.getRows('method_findings');
    expect(findingRows).toHaveLength(1);
    expect(findingRows[0].unit_id).toBe('1A');

    // The bridge also appends an OUTPUT_CREATED event into the SAME store.
    const allEvents = await events.listBySession(organizationId, session.id);
    const outputCreated = allEvents.find((e) => e.type === 'OUTPUT_CREATED');
    expect(outputCreated).toBeTruthy();
    expect((outputCreated!.payload as any).outputId).toBe(outputRows[0].id);
  });

  it('freeze without a bridge wired keeps pre-A6 behaviour: snapshot only, no Output created', async () => {
    const service = new MethodSessionService(packs, events); // no 3rd arg
    const session = await driveToInReview(service);
    await service.assignRole(organizationId, session.id, 'approver-1', 'approver');

    const result = await service.transition({
      sessionId: session.id,
      to: 'frozen',
      actorKind: 'human',
      actorUserId: 'approver-1',
      idempotencyKey: `${session.id}-freeze`,
    });
    expect(result.ok).toBe(true);
    expect(testDb.getRows('method_snapshots')).toHaveLength(1);
    expect(testDb.getRows('method_outputs')).toHaveLength(0);
  });

  it('a bridge that throws fails the whole freeze — no half-frozen state silently accepted', async () => {
    const throwingBridge = {
      async onSessionFrozen(): Promise<void> {
        throw new Error('boom: downstream Output rejected the data');
      },
    };
    const service = new MethodSessionService(packs, events, throwingBridge);
    const session = await driveToInReview(service);
    await service.assignRole(organizationId, session.id, 'approver-1', 'approver');

    await expect(
      service.transition({
        sessionId: session.id,
        to: 'frozen',
        actorKind: 'human',
        actorUserId: 'approver-1',
        idempotencyKey: `${session.id}-freeze`,
      })
    ).rejects.toThrow(/boom/);
  });
});
