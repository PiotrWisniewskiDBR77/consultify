/**
 * EventDerivedOutputBridge — the freeze -> Output bridge A8 flagged as
 * missing (`MethodSessionService.transition()` wrote `method_snapshots` but
 * never called `MethodOutputService.freezeOutput`). A6/COORD, 2026-08-13.
 *
 * WHY EVENT-DERIVED, NOT METHOD-SPECIFIC: `MethodSessionService` (the
 * kernel) is deliberately DRD/SIRI/ADMA-agnostic — see its header comment.
 * This bridge honours that: it builds the `AssessmentOutput` purely from the
 * append-only `method_events` log (ANSWER_CONFIRMED for the achieved level,
 * EVIDENCE_ATTACHED for supporting evidence, DECISION_APPROVED with
 * `subject: 'target_level'` for the target), never from a re-imported DRD
 * pack. That also sidesteps the cross-boundary import constraint documented
 * at the top of `MethodOutputService.ts` (server/tsconfig `rootDir: "."`
 * rejects a relative import into the repo-root `src/` tree — TS6059).
 *
 * ★ DISCLOSED SIMPLIFICATION (vertical-slice scope, not hidden): a real
 * Output's `businessMeaning`/`recommendation`/`riskOrOpportunity` come from
 * an assessor's review narrative or a reviewed Teresa draft. This bridge has
 * neither at its disposal (the kernel does not know what "business meaning"
 * means for any method) — it synthesises short, deterministic, clearly
 * templated strings from the real event data (unit id, level, evidence
 * count) instead of inventing prose. That is recorded in `limitations`
 * (a REQUIRED, non-empty field — see `validateFreezeInput`), not hidden.
 * Likewise `aggregation.byGroup` is left empty here: axis/pillar grouping
 * (DRD's 7-axis mean, `drdAdapter.aggregate`) is a per-method rule and
 * happens client-side before display — reproducing it here would be exactly
 * the "if (method === 'drd')" branch the kernel is built to avoid.
 */

import { genId, nowIso } from '../db.js';
import type { MethodEventStore } from '../MethodEventStore.js';
import type { MethodOutputBridge } from '../MethodSessionService.js';
import type { EvidenceLocatorInput, FreezeOutputInput, OutputFindingInput } from './MethodOutputService.js';
import type { MethodOutputService } from './MethodOutputService.js';
import type { MethodEvent } from '../contracts/index.js';

interface UnitAccumulator {
  unitId: string;
  currentLevel: number | null;
  targetLevel: number | null;
  evidence: EvidenceLocatorInput[];
  answerEventIds: string[];
  lastAnswerText: string | null;
}

function unitBucket(map: Map<string, UnitAccumulator>, unitId: string): UnitAccumulator {
  let bucket = map.get(unitId);
  if (!bucket) {
    bucket = {
      unitId,
      currentLevel: null,
      targetLevel: null,
      evidence: [],
      answerEventIds: [],
      lastAnswerText: null,
    };
    map.set(unitId, bucket);
  }
  return bucket;
}

/** Pure — exported so a unit test can assert the derivation without a DB. */
export function deriveFindingsFromEvents(events: readonly MethodEvent[]): {
  findings: OutputFindingInput[];
  current: Record<string, number | null>;
  target: Record<string, number | null>;
  gap: Record<string, number | null>;
} {
  const byUnit = new Map<string, UnitAccumulator>();

  for (const event of events) {
    if (!event.unitId) continue;
    const bucket = unitBucket(byUnit, event.unitId);

    if (event.type === 'ANSWER_CONFIRMED' && typeof event.level === 'number') {
      // Chronological order guaranteed by MethodEventStore.listBySession —
      // last confirmed level for the unit wins (an honest correction, not a
      // max()/min() guess).
      bucket.currentLevel = event.level;
      bucket.answerEventIds.push(event.id);
      const payload = event.payload as { text?: string } | undefined;
      if (payload?.text) bucket.lastAnswerText = payload.text;
    }

    if (event.type === 'EVIDENCE_ATTACHED') {
      const payload = event.payload as
        | { evidenceId?: string; evidenceType?: string; strength?: string }
        | undefined;
      if (payload?.evidenceId) {
        bucket.evidence.push({
          evidenceId: payload.evidenceId,
          evidenceType: payload.evidenceType ?? 'observation',
          strength: (payload.strength as EvidenceLocatorInput['strength']) ?? 'E1',
          locator: `method-event://${event.id}`,
        });
      }
    }

    if (
      event.type === 'DECISION_APPROVED' &&
      typeof event.level === 'number' &&
      (event.payload as { subject?: string } | undefined)?.subject === 'target_level'
    ) {
      bucket.targetLevel = event.level;
    }
  }

  const findings: OutputFindingInput[] = [];
  const current: Record<string, number | null> = {};
  const target: Record<string, number | null> = {};
  const gap: Record<string, number | null> = {};

  // Deterministic order — event Map iteration order is insertion order,
  // which is chronological here, but a hash/lineage-facing artefact must not
  // depend on iteration order incidentally matching insertion. Sort by unitId.
  const units = [...byUnit.values()].sort((a, b) => a.unitId.localeCompare(b.unitId));

  for (const u of units) {
    current[u.unitId] = u.currentLevel;
    target[u.unitId] = u.targetLevel;
    gap[u.unitId] =
      u.currentLevel !== null && u.targetLevel !== null ? u.targetLevel - u.currentLevel : null;

    // A finding requires >= 1 supporting evidence item (validateFreezeInput) —
    // units the respondent touched but never evidenced are surfaced in
    // `evidenceCompleteness`, not as a (rejected) zero-evidence finding.
    if (u.evidence.length === 0) continue;

    findings.push({
      unitId: u.unitId,
      unitName: u.unitId,
      currentLevel: u.currentLevel,
      targetLevel: u.targetLevel,
      gap: gap[u.unitId],
      supportingEvidence: u.evidence,
      contradictingEvidence: [],
      businessMeaning:
        u.currentLevel !== null
          ? `Jednostka ${u.unitId} potwierdzona na poziomie ${u.currentLevel} (${u.evidence.length} dowód/-ody w event-store).`
          : `Jednostka ${u.unitId}: dowody zebrane, poziom nie został jeszcze potwierdzony.`,
      rootCauseHypothesis: null,
      riskOrOpportunity:
        gap[u.unitId] !== null && (gap[u.unitId] as number) > 0
          ? `Luka ${gap[u.unitId]} poziomu/-ów do celu na jednostce ${u.unitId}.`
          : null,
      recommendation:
        gap[u.unitId] !== null && (gap[u.unitId] as number) > 0
          ? `Zaplanuj działania podnoszące jednostkę ${u.unitId} z poziomu ${u.currentLevel} do ${u.targetLevel}.`
          : `Utrzymaj obecny poziom jednostki ${u.unitId}.`,
      prerequisite: null,
      expectedOutcome:
        gap[u.unitId] !== null && (gap[u.unitId] as number) > 0
          ? `Zamknięcie luki na jednostce ${u.unitId}.`
          : `Stabilizacja jednostki ${u.unitId} na obecnym poziomie.`,
      kpiProposal: null,
      confidence: 'medium',
      priorityRationale:
        gap[u.unitId] !== null ? `Sortowanie wg wielkości luki (${gap[u.unitId]}).` : 'Brak wyliczonej luki.',
      sourceLocators: [...u.answerEventIds, ...u.evidence.map((e) => e.locator)],
    });
  }

  return { findings, current, target, gap };
}

export class EventDerivedOutputBridge implements MethodOutputBridge {
  constructor(
    private readonly events: MethodEventStore,
    private readonly outputs: MethodOutputService
  ) {}

  async onSessionFrozen(input: {
    readonly organizationId: string;
    readonly sessionId: string;
    readonly snapshotId: string;
    readonly module: 'assessment' | 'tools' | 'audits';
    readonly methodPackId: string;
    readonly methodPackVersion: string;
  }): Promise<void> {
    const events = await this.events.listBySession(input.organizationId, input.sessionId);
    const { findings, current, target, gap } = deriveFindingsFromEvents(events);

    const totalUnits = Object.keys(current).length;
    const unitsWithAcceptedEvidence = findings.length;

    const freezeInput: FreezeOutputInput = {
      organizationId: input.organizationId,
      sessionId: input.sessionId,
      snapshotId: input.snapshotId,
      module: input.module,
      methodPackId: input.methodPackId,
      methodPackVersion: input.methodPackVersion,
      scope: `Sesja ${input.sessionId} — ${input.methodPackId}@${input.methodPackVersion}, zamrożona z event-store.`,
      current,
      target,
      gap,
      aggregation: {
        byGroup: {},
        mappingVersion: 'event-derived-v1',
        rule:
          'EventDerivedOutputBridge nie liczy agregacji per-oś/pillar (metoda-specyficzna reguła) — ' +
          'to zostaje po stronie klienta (np. drdAdapter.aggregate) przed wyświetleniem.',
        excluded: {},
      },
      visualModel: { kind: 'matrix', dataRef: current },
      evidenceCompleteness: {
        totalUnits,
        unitsWithAcceptedEvidence,
        unitsMissingEvidence: totalUnits - unitsWithAcceptedEvidence,
        completenessRatio: totalUnits > 0 ? unitsWithAcceptedEvidence / totalUnits : 0,
      },
      limitations: [
        'Output wygenerowany automatycznie z event-store (EventDerivedOutputBridge, vertical-slice ' +
          'demo) — businessMeaning/recommendation to deterministyczne szablony z realnych danych ' +
          '(unit/level/evidence), NIE analiza LLM ani recenzja metodyka.',
        'aggregation.byGroup jest pusta — agregacja per-oś jest regułą metody i liczona jest client-side.',
      ],
      findings,
      prioritisationResult: null,
      revisionOfOutputId: null,
      sourceRevisionOfSessionId: null,
    };

    const output = await this.outputs.freezeOutput(freezeInput);

    await this.events.append({
      organizationId: input.organizationId,
      sessionId: input.sessionId,
      type: 'OUTPUT_CREATED',
      actorKind: 'system',
      actorUserId: null,
      methodPackVersion: input.methodPackVersion,
      idempotencyKey: `output-created:${output.id}`,
      payload: { outputId: output.id, outputVersion: output.outputVersion, contentHash: output.contentHash },
    });
  }
}
