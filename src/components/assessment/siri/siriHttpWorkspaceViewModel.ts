/**
 * Pure event -> `SiriUnitAssessmentState` derivation for the SIRI HTTP
 * workspace screen (S5, 2026-08-13).
 *
 * Mirrors `src/components/assessment/drd/drdWorkspaceViewModel.ts`'s role —
 * the ONLY place that reads a `MethodEvent[]` list and turns it into the
 * shapes `siriWorkspaceView.ts` (`buildSiriNavigatorNodes`,
 * `buildSiriMatrixRows`, `checkSiriLeapfrog`, …) already knows how to render.
 * No React, no fetch — this file is deliberately runtime-agnostic so both the
 * live screen and its tests can call it against a plain `MethodEvent[]`.
 *
 * SIRI's Band lifecycle maps onto the closed kernel event set as documented
 * in `siriHttpSessionRuntime.ts`'s header:
 *   DECISION_PROPOSED (subject: 'current_level')  -> assessor proposal
 *   DECISION_APPROVED (subject: 'current_level')  -> participant/approver confirmation
 *   DECISION_APPROVED (subject: 'target_level')   -> target Band
 *   EVIDENCE_ATTACHED                             -> Evidence Item (strength E0..E4)
 */
import type { TableColumn } from '@/components/standard/StandardTable';
import type { DecisionEventPayload, EvidenceEventPayload, EvidenceStrength, MethodEvent } from '@/method-core/contracts';
import { SIRI_PRIORITISATION_AREAS } from '@/services/siriStructure';
import { emptySiriUnitState, type SiriUnitAssessmentState } from '@/method-core/methods/siri/siriWorkspaceView';

// Output current/target/gap rollup — fixed-schema record list (TRIADA case 1).
export const SIRI_OUTPUT_UNIT_COLUMNS: TableColumn[] = [
  { id: 'unitId', label: 'Wymiar (16D)' },
  { id: 'current', label: 'Current' },
  { id: 'target', label: 'Target' },
  { id: 'gap', label: 'Gap' },
];

export function siriUnitStatesFromEvents(events: readonly MethodEvent[]): Map<string, SiriUnitAssessmentState> {
  const states = new Map<string, SiriUnitAssessmentState>();
  for (const area of SIRI_PRIORITISATION_AREAS) {
    states.set(area.id, emptySiriUnitState(area.id));
  }

  for (const e of events) {
    if (!e.unitId || !states.has(e.unitId)) continue;
    const current = states.get(e.unitId)!;

    // ★ Confirmed Bands come from ANSWER_CONFIRMED, not
    // DECISION_APPROVED(subject:'current_level') — matches
    // `siriHttpSessionRuntime.ts`'s `confirmBand()` and the server's
    // `EventDerivedOutputBridge`, which reads ONLY ANSWER_CONFIRMED for a
    // unit's current level (mirrors DRD's own recordAnswer()).
    if (e.type === 'ANSWER_CONFIRMED' && typeof e.level === 'number') {
      const nextConfirmed = Array.from(new Set([...current.confirmedLevels, e.level])).sort((a, b) => a - b);
      states.set(e.unitId, { ...current, confirmedLevels: nextConfirmed });
    }

    if (e.type === 'DECISION_APPROVED') {
      const payload = e.payload as Partial<DecisionEventPayload>;
      if (payload.subject === 'target_level' && typeof payload.decidedValue === 'number') {
        states.set(e.unitId, { ...states.get(e.unitId)!, targetLevel: payload.decidedValue });
      }
    }

    if (e.type === 'EVIDENCE_ATTACHED' && typeof e.level === 'number') {
      const payload = e.payload as Partial<EvidenceEventPayload>;
      if (payload.strength) {
        states.set(e.unitId, {
          ...states.get(e.unitId)!,
          evidenceByLevel: { ...states.get(e.unitId)!.evidenceByLevel, [e.level]: payload.strength as EvidenceStrength },
        });
      }
    }
  }

  return states;
}

/** Latest still-open assessor proposal per unit (DECISION_PROPOSED with no
 * later DECISION_APPROVED for the same level) — shown as a "pending
 * confirmation" hint, never treated as a confirmed Band. */
export function siriProposedLevelFor(events: readonly MethodEvent[], unitId: string): { level: number; rationale: string } | null {
  let proposed: { level: number; rationale: string } | null = null;
  for (const e of events) {
    if (e.unitId !== unitId) continue;
    if (e.type === 'DECISION_PROPOSED') {
      const payload = e.payload as Partial<DecisionEventPayload>;
      if (payload.subject === 'current_level' && typeof payload.proposedValue === 'number') {
        proposed = { level: payload.proposedValue, rationale: payload.rationale ?? '' };
      }
    }
    if (e.type === 'DECISION_APPROVED') {
      const payload = e.payload as Partial<DecisionEventPayload>;
      if (payload.subject === 'current_level' && proposed && payload.decidedValue === proposed.level) {
        proposed = null; // confirmed — no longer "pending"
      }
    }
  }
  return proposed;
}

export function siriEvidenceEventsFor(events: readonly MethodEvent[], unitId: string): MethodEvent[] {
  return events.filter((e) => e.type === 'EVIDENCE_ATTACHED' && e.unitId === unitId);
}

export function siriConfirmedUnitCount(events: readonly MethodEvent[]): number {
  const states = siriUnitStatesFromEvents(events);
  let count = 0;
  for (const state of states.values()) {
    if (state.confirmedLevels.length > 0) count++;
  }
  return count;
}
