/**
 * @vitest-environment jsdom
 *
 * Pure view-model derivation tests — no runtime, no DOM, just events in ->
 * cell/question shapes out. Covers three things directly named in the S6
 * brief that are easy to get subtly wrong in the DRD-specific glue code:
 *  - `dont_know` never contributes a confirmed level (never scored as zero);
 *  - evidence STRENGTH (E0-E4) is derived as its own value, independent of
 *    the evidenceState rollup;
 *  - a matrix cell beyond the current blocker comes back with the exact
 *    achieved=false/blocker=false/reviewRequired=false shape LiveMatrix's
 *    `isCellEngaged` gate relies on to render it as "unassessed", not as a
 *    problem.
 */
import { describe, expect, it } from 'vitest';

import type { MethodEvent } from '@/method-core/contracts';
import { DRD_METHOD_PACK_VERSION } from '@/method-core/methods/drd/compileDrdPack';
import { DRD_STRUCTURE } from '@/services/drdStructure';

import {
  buildMatrixRowsForAxis,
  confirmedLevelsFor,
  evidenceItemsFor,
  evidenceStrengthFor,
} from '../drdWorkspaceViewModel';

const AXIS = DRD_STRUCTURE[0];
const UNIT = AXIS.areas[0].id;

let seq = 0;
function makeEvent(overrides: Partial<MethodEvent> & { type: MethodEvent['type'] }): MethodEvent {
  seq += 1;
  return {
    id: `evt-${seq}`,
    organizationId: 'org-1',
    sessionId: 'session-1',
    unitId: UNIT,
    actorKind: 'human',
    actorUserId: 'user-1',
    methodPackVersion: DRD_METHOD_PACK_VERSION,
    occurredAt: '2026-08-13T00:00:00.000Z',
    payload: {},
    ...overrides,
  };
}

describe('confirmedLevelsFor — dont_know is never counted as a confirmed level (never scored as zero)', () => {
  it('an ANSWER_CONFIRMED event with answerState dont_know does not add the level to confirmedLevels', () => {
    // Confirmed levels come ONLY from progression/decision wiring elsewhere in
    // the runtime (recordAnswer only reaches ANSWER_CONFIRMED for real
    // confirmations) — but this guards the derivation itself: even if an
    // ANSWER_CONFIRMED event carried a dont_know payload, the level must not
    // silently read as "achieved" or "zero".
    const events: MethodEvent[] = [
      makeEvent({ type: 'ANSWER_CONFIRMED', level: 1, payload: { questionId: 'q-1', answerState: 'dont_know' } }),
    ];
    expect(confirmedLevelsFor(events, UNIT)).toEqual([]);
  });

  it('a genuinely confirmed level (answerState confirmed) IS counted', () => {
    const events: MethodEvent[] = [
      makeEvent({ type: 'ANSWER_CONFIRMED', level: 1, payload: { questionId: 'q-1', answerState: 'confirmed' } }),
    ];
    expect(confirmedLevelsFor(events, UNIT)).toEqual([1]);
  });
});

describe('evidenceStrengthFor — strength is its own axis, independent of evidenceState', () => {
  it('returns null when no evidence has been attached', () => {
    expect(evidenceStrengthFor([], UNIT)).toBeNull();
  });

  it('returns the single recorded strength', () => {
    const events: MethodEvent[] = [
      makeEvent({ type: 'EVIDENCE_ATTACHED', level: 1, payload: { evidenceId: 'ev-1', evidenceType: 'document', strength: 'E2' } }),
    ];
    expect(evidenceStrengthFor(events, UNIT)).toBe('E2');
  });

  it('returns the STRONGEST of several recorded strengths, not the first or last', () => {
    const events: MethodEvent[] = [
      makeEvent({ type: 'EVIDENCE_ATTACHED', level: 1, payload: { evidenceId: 'ev-1', evidenceType: 'document', strength: 'E1' } }),
      makeEvent({ type: 'EVIDENCE_ATTACHED', level: 2, payload: { evidenceId: 'ev-2', evidenceType: 'system_record', strength: 'E3' } }),
      makeEvent({ type: 'EVIDENCE_ATTACHED', level: 3, payload: { evidenceId: 'ev-3', evidenceType: 'observation', strength: 'E2' } }),
    ];
    expect(evidenceStrengthFor(events, UNIT)).toBe('E3');
  });
});

describe('buildMatrixRowsForAxis — cells beyond the blocker are shaped as "unassessed", not "problem"', () => {
  it('a level well beyond an untouched unit is achieved=false, blocker=false, reviewRequired=false', () => {
    const rows = buildMatrixRowsForAxis([], AXIS, new Set());
    const row = rows.find((r) => r.unitId === UNIT)!;
    const farLevel = row.levels[row.levels.length - 1];
    expect(farLevel.achieved).toBe(false);
    expect(farLevel.blocker).toBe(false);
    expect(farLevel.reviewRequired).toBe(false);
  });

  it('the first level of an untouched unit IS the blocker once any work exists elsewhere in the unit (workHasStarted)', () => {
    // aboveGap demo: confirm a level above 1 without confirming 1 first —
    // blockedAtLevel must be 1, and level 1 must read as the real blocker
    // (workHasStarted=true), never as merely "unassessed".
    const secondLevel = AXIS.areas[0].levels[1]?.level ?? 2;
    const events: MethodEvent[] = [
      makeEvent({ type: 'ANSWER_CONFIRMED', level: secondLevel, payload: { questionId: 'q-x', answerState: 'confirmed' } }),
    ];
    const rows = buildMatrixRowsForAxis(events, AXIS, new Set());
    const row = rows.find((r) => r.unitId === UNIT)!;
    const level1 = row.levels.find((c) => c.level === 1)!;
    expect(level1.blocker).toBe(true);
  });
});

describe('evidenceItemsFor — K-24a read-model rows (nazwa / data / kto, BEZ rozmiaru)', () => {
  it('projects name from payload.evidenceId, plus occurredAt + actorUserId + strength', () => {
    const events: MethodEvent[] = [
      makeEvent({
        type: 'EVIDENCE_ATTACHED',
        level: 1,
        actorUserId: 'anna.kowalska',
        occurredAt: '2026-08-13T09:30:00.000Z',
        payload: { evidenceId: 'polityka.pdf', evidenceType: 'document', strength: 'E2' },
      }),
    ];
    const items = evidenceItemsFor(events, UNIT);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: 'polityka.pdf',
      occurredAt: '2026-08-13T09:30:00.000Z',
      actorUserId: 'anna.kowalska',
      strength: 'E2',
    });
  });

  it('carries NO size field — the append-only registry never stores bytes (DEC-649)', () => {
    const events: MethodEvent[] = [
      makeEvent({ type: 'EVIDENCE_ATTACHED', level: 1, payload: { evidenceId: 'x.pdf', strength: 'E1' } }),
    ];
    const item = evidenceItemsFor(events, UNIT)[0];
    expect(Object.keys(item)).not.toContain('size');
    expect('size' in item).toBe(false);
  });

  it('falls back to the event id when payload.evidenceId is absent', () => {
    const events: MethodEvent[] = [
      makeEvent({ type: 'EVIDENCE_ATTACHED', level: 1, payload: {} }),
    ];
    const item = evidenceItemsFor(events, UNIT)[0];
    expect(item.name).toBe(item.eventId);
  });

  it('only projects EVIDENCE_ATTACHED events for the requested unit', () => {
    const events: MethodEvent[] = [
      makeEvent({ type: 'EVIDENCE_ATTACHED', unitId: UNIT, level: 1, payload: { evidenceId: 'a.pdf' } }),
      makeEvent({ type: 'EVIDENCE_ATTACHED', unitId: 'other-unit', level: 1, payload: { evidenceId: 'b.pdf' } }),
      makeEvent({ type: 'ANSWER_CONFIRMED', unitId: UNIT, level: 1, payload: { questionId: 'q', answerState: 'confirmed' } }),
    ];
    const items = evidenceItemsFor(events, UNIT);
    expect(items.map((i) => i.name)).toEqual(['a.pdf']);
  });

  it('returns an empty list when the unit has no evidence', () => {
    expect(evidenceItemsFor([], UNIT)).toEqual([]);
  });
});
