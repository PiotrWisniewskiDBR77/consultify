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
import { DEMO_BYPASS_NOTICE } from '../demoBypass.js';
import { resolveResponseLanguage, type ResponseLanguage } from '../../services/ai/responseLanguage.js';
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

/**
 * ZDANIA ZNALEZISK — język klienta, dwa warianty (fala J2, 14.09).
 *
 * `businessMeaning` / `riskOrOpportunity` / `recommendation` /
 * `expectedOutcome` / `priorityRationale` są DRUKOWANE w raporcie z oceny
 * i w prezentacji, czyli czyta je klient. Do 14.09 były wyłącznie po polsku
 * (niezależnie od języka konta) i mówiły o „event-store" — czyli o naszym
 * magazynie zdarzeń, a nie o jego firmie. Nazwy klas, plików i magazynów
 * nie należą do dokumentu dla zarządu.
 */
const TEKSTY_ZNALEZISK: Record<
  ResponseLanguage,
  {
    potwierdzone: (unit: string, poziom: number, dowody: number) => string;
    bezPoziomu: (unit: string) => string;
    luka: (unit: string, luka: number) => string;
    rekomendacjaLuka: (unit: string, z: number | null, doPoziomu: number | null) => string;
    rekomendacjaUtrzymaj: (unit: string) => string;
    wynikLuka: (unit: string) => string;
    wynikUtrzymanie: (unit: string) => string;
    priorytetLuka: (luka: number) => string;
    priorytetBrakLuki: string;
  }
> = {
  pl: {
    potwierdzone: (unit, poziom, dowody) =>
      `Obszar ${unit} potwierdzony na poziomie ${poziom}, poparty dowodami (${dowody}).`,
    bezPoziomu: (unit) =>
      `Obszar ${unit}: dowody zebrane, poziom nie został jeszcze potwierdzony.`,
    luka: (unit, luka) => `Luka ${luka} poziomu/-ów do celu na obszarze ${unit}.`,
    rekomendacjaLuka: (unit, z, doPoziomu) =>
      `Zaplanuj działania podnoszące obszar ${unit} z poziomu ${z} do ${doPoziomu}.`,
    rekomendacjaUtrzymaj: (unit) => `Utrzymaj obecny poziom obszaru ${unit}.`,
    wynikLuka: (unit) => `Zamknięcie luki na obszarze ${unit}.`,
    wynikUtrzymanie: (unit) => `Stabilizacja obszaru ${unit} na obecnym poziomie.`,
    priorytetLuka: (luka) => `Kolejność wynika z wielkości luki (${luka}).`,
    priorytetBrakLuki: 'Brak wyliczonej luki.',
  },
  en: {
    potwierdzone: (unit, poziom, dowody) =>
      `Area ${unit} confirmed at level ${poziom}, supported by evidence (${dowody}).`,
    bezPoziomu: (unit) => `Area ${unit}: evidence collected, the level is not confirmed yet.`,
    luka: (unit, luka) => `A gap of ${luka} level(s) to the target in area ${unit}.`,
    rekomendacjaLuka: (unit, z, doPoziomu) =>
      `Plan the actions that take area ${unit} from level ${z} to ${doPoziomu}.`,
    rekomendacjaUtrzymaj: (unit) => `Keep area ${unit} at its current level.`,
    wynikLuka: (unit) => `The gap in area ${unit} is closed.`,
    wynikUtrzymanie: (unit) => `Area ${unit} stays stable at its current level.`,
    priorytetLuka: (luka) => `The order follows the size of the gap (${luka}).`,
    priorytetBrakLuki: 'No gap has been calculated.',
  },
};

/** Pure — exported so a unit test can assert the derivation without a DB. */
export function deriveFindingsFromEvents(
  events: readonly MethodEvent[],
  jezyk: ResponseLanguage = 'en'
): {
  findings: OutputFindingInput[];
  current: Record<string, number | null>;
  target: Record<string, number | null>;
  gap: Record<string, number | null>;
} {
  const teksty = TEKSTY_ZNALEZISK[jezyk];
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
          ? teksty.potwierdzone(u.unitId, u.currentLevel, u.evidence.length)
          : teksty.bezPoziomu(u.unitId),
      rootCauseHypothesis: null,
      riskOrOpportunity:
        gap[u.unitId] !== null && (gap[u.unitId] as number) > 0
          ? teksty.luka(u.unitId, gap[u.unitId] as number)
          : null,
      recommendation:
        gap[u.unitId] !== null && (gap[u.unitId] as number) > 0
          ? teksty.rekomendacjaLuka(u.unitId, u.currentLevel, u.targetLevel)
          : teksty.rekomendacjaUtrzymaj(u.unitId),
      prerequisite: null,
      expectedOutcome:
        gap[u.unitId] !== null && (gap[u.unitId] as number) > 0
          ? teksty.wynikLuka(u.unitId)
          : teksty.wynikUtrzymanie(u.unitId),
      kpiProposal: null,
      confidence: 'medium',
      priorityRationale:
        gap[u.unitId] !== null
          ? teksty.priorytetLuka(gap[u.unitId] as number)
          : teksty.priorytetBrakLuki,
      sourceLocators: [...u.answerEventIds, ...u.evidence.map((e) => e.locator)],
    });
  }

  return { findings, current, target, gap };
}

/**
 * ZDANIA ZAMRAŻANE W OUTPUCIE — dwa warianty językowe, nie jeden.
 *
 * `scope` i `limitations` są jedynymi polami zamrożonego Outputu, które
 * użytkownik czyta jako PROZĘ (raport oceny drukuje je dosłownie: rozdział
 * „Ograniczenia i założenia" i stopka „Ocena"). Do 2026-09 były zaszyte po
 * polsku niezależnie od języka konta — użytkownik EN dostawał polskie zdania
 * w dokumencie dla zarządu (program spójności językowej, PLAN.md §2.5/§2.8).
 *
 * Wariant wybiera `resolveResponseLanguage` — ten sam mechanizm, którego
 * używa reszta serwera; przy braku deklaracji języka wypada 'en', bo taka
 * jest reguła programu dla wersji angielskiej („zero innego języka").
 * Tekst, nie kod błędu: te pola są ZAMRAŻANE na stałe w rekordzie, więc
 * zamiana ich na kody unieważniłaby odczyt Outputów już zamrożonych.
 */
const TEKSTY_OUTPUTU: Record<
  ResponseLanguage,
  {
    scope: (sessionId: string, packId: string, packVersion: string) => string;
    aggregationRule: string;
    limitationTemplates: string;
    limitationAggregation: string;
    limitationDemoBypass: string;
  }
> = {
  pl: {
    scope: (sessionId, packId, packVersion) =>
      `Zakres: sesja ${sessionId}, metodyka ${packId} ${packVersion}, stan zamrożony.`,
    aggregationRule:
      'Podsumowania per oś liczone są według reguł metodyki w chwili prezentacji wyniku; ' +
      'ten zapis przechowuje poziomy per obszar.',
    limitationTemplates:
      'Ograniczenia: ten wynik powstał w sposób deterministyczny z potwierdzonych odpowiedzi ' +
      'i załączonych dowodów — nie jest analizą AI ani recenzją metodyka.',
    limitationAggregation:
      'Podsumowania per oś liczone są według reguł metodyki przy prezentacji wyniku; ' +
      'zamrożony zapis przechowuje poziomy per obszar.',
    limitationDemoBypass:
      ' Ten Output pochodzi z sesji utworzonej przez demo bypass — NIE jest wynikiem ' +
      'produkcyjnym i nie może zostać zatwierdzony jako released/pilot przez ten mechanizm.',
  },
  en: {
    scope: (sessionId, packId, packVersion) =>
      `Scope: session ${sessionId}, method pack ${packId} ${packVersion}, frozen snapshot.`,
    aggregationRule:
      'Per-axis summaries follow the method rules and are calculated when the result is ' +
      'presented; this record stores the per-area levels.',
    limitationTemplates:
      'Limitations: this result is derived deterministically from the confirmed answers and the ' +
      'attached evidence — it is not an AI analysis nor a methodologist review.',
    limitationAggregation:
      'Per-axis summaries follow the method rules and are calculated when the result is ' +
      'presented; the frozen record stores the per-area levels.',
    limitationDemoBypass:
      ' This Output comes from a session created through the demo bypass — it is NOT a production ' +
      'result and cannot be approved as released/pilot through this mechanism.',
  },
};

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
    readonly demoBypassActive: boolean;
    readonly revisionOfSessionId: string | null;
    /** `users.language` osoby zamrażającej; brak → 'en' (PLAN.md §2.1). */
    readonly language?: string | null;
  }): Promise<void> {
    const jezyk = resolveResponseLanguage({ requested: input.language ?? null, samples: [] });
    const teksty = TEKSTY_OUTPUTU[jezyk];
    const events = await this.events.listBySession(input.organizationId, input.sessionId);
    const { findings, current, target, gap } = deriveFindingsFromEvents(events, jezyk);

    const totalUnits = Object.keys(current).length;
    const unitsWithAcceptedEvidence = findings.length;

    // Reopen (frozen -> active -> frozen again) lineage: this session is a
    // revision of `revisionOfSessionId` iff that field is set. Link the new
    // Output to the LATEST Output already frozen for the session it reopened
    // — `listOutputsBySession` returns newest-first (output_version DESC) —
    // so `MethodOutputService.freezeOutput` can compute a real
    // `outputVersion = previous + 1` instead of always defaulting to 1, and
    // "corrected revision, old Output untouched" is a genuine INSERT-only
    // chain, not just two unrelated rows that happen to share a method pack.
    let revisionOfOutputId: string | null = null;
    if (input.revisionOfSessionId) {
      const priorOutputs = await this.outputs.listOutputsBySession(
        input.organizationId,
        input.revisionOfSessionId
      );
      revisionOfOutputId = priorOutputs[0]?.id ?? null;
    }

    const freezeInput: FreezeOutputInput = {
      organizationId: input.organizationId,
      sessionId: input.sessionId,
      snapshotId: input.snapshotId,
      module: input.module,
      methodPackId: input.methodPackId,
      methodPackVersion: input.methodPackVersion,
      scope: teksty.scope(input.sessionId, input.methodPackId, input.methodPackVersion),
      current,
      target,
      gap,
      aggregation: {
        byGroup: {},
        mappingVersion: 'event-derived-v1',
        rule: teksty.aggregationRule,
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
        teksty.limitationTemplates,
        teksty.limitationAggregation,
        // ★ Explicit, visible demonstration marker (CLAUDE.md rule #7) — only
        // appended when the SOURCE SESSION was actually created through the
        // demo bypass (server/src/method-core/demoBypass.ts). A production
        // session's Output never carries this string. `demoBypassActive` on
        // the record itself (see MethodOutputService) is the machine-
        // readable form of the same fact; this is the human-readable one,
        // and both are required by `validateFreezeInput`'s non-empty
        // `limitations` rule anyway — an honest Output always states what it
        // does not cover, and "this came from the demo bypass" is exactly
        // that kind of disclosure.
        ...(input.demoBypassActive ? [DEMO_BYPASS_NOTICE + teksty.limitationDemoBypass] : []),
      ],
      findings,
      prioritisationResult: null,
      revisionOfOutputId,
      sourceRevisionOfSessionId: input.revisionOfSessionId,
      demoBypassActive: input.demoBypassActive,
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
