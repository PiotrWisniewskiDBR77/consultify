/**
 * SIRI Workspace View — pure, presentation-shape wiring between the SIRI
 * Method Pack / `siriAdapter` (this directory) and the shared, domain-agnostic
 * Method Workspace shell (`src/components/method-workspace/`, A5, shared with
 * A6/DRD). A7 mission, 2026-08-13.
 *
 * No React, no fetch, no persistence — every function here is a pure mapping
 * from a caller-supplied assessment state to the shell's presentational
 * types (`MethodNavigatorNode`, `MatrixRow`, …). The screen/harness (or a
 * future store) owns state; this module never does.
 *
 * ---------------------------------------------------------------------------
 * HONESTY NOTES (read before extending)
 * ---------------------------------------------------------------------------
 *  - 16 dimensions are the scored unit (compileSiriPack.ts header). The 3
 *    building blocks and 8 pillars are GROUPING ONLY — `buildSiriNavigatorNodes`
 *    below builds a strict 3 → 8 → 16 tree precisely so the UI can never
 *    present a pillar or building block as something a user assesses.
 *  - SIRI QBank v1 has ZERO per-dimension questions
 *    (`SIRI_QBANK_V1_COVERAGE.dimensionsWithDedicatedQuestions === 0`,
 *    compileSiriPack.ts). `buildSiriGenericQuestion` therefore returns a
 *    `MethodQuestion` with every help field empty — the shared shell's
 *    `QuestionHelpDisclosure` (A5) already renders an honest "Help content
 *    unavailable" for that exact shape. This file does not invent method
 *    content to paper over the gap.
 *  - Band selection: `proposeSiriBand()` only ever produces a PROPOSAL
 *    (`status: 'proposed'`). Confirming a Band is the separate
 *    `confirmSiriBand()`, whose `confirmedByActor` parameter is typed to
 *    `'participant' | 'approver'` — Teresa is not a valid value. This matches
 *    both ASSESSMENT_KB_SIRI.md §3 ("finalną decyzję Band podejmują
 *    uprawnieni uczestnicy/approver") and the kernel's own
 *    `TERESA_FORBIDDEN_EFFECTS` (`['approve_score', ...]`,
 *    `src/method-core/contracts/teresa.ts`) — this module adds no new rule,
 *    it just refuses to open a path the kernel already forbids.
 *  - `factory_observation` (ASSESSMENT_KB_SIRI.md §5, "Plant tour/observation
 *    może być osobnym Evidence Item") is a SIRI-owned UI/adapter-layer type,
 *    NOT an extension of the kernel's closed `EvidenceEventPayload.evidenceType`
 *    enum (`src/method-core/contracts/events.ts`, owned by Assessment/Core —
 *    zbiór kernela pozostaje ZAMKNIĘTY). Rozstrzygnięcie (Opus, właściciel
 *    kontraktu): `factory_observation` jest **podtypem** kernelowego
 *    `observation`, nie nowym bytem — mapuje je `toKernelEvidenceType()`
 *    poniżej. Kernel nie dostaje nowego wariantu, a UI i raport SIRI nadal
 *    odróżniają obchód hali od zwykłej demonstracji. Zapis eventów przez to
 *    mapowanie jest zdefiniowany; brakuje jeszcze samego callera perystencji.
 */

import type {
  EvidenceEventPayload,
  EvidenceStrength,
  MethodQuestion,
} from '@/method-core/contracts';
import { EVIDENCE_STRENGTHS } from '@/method-core/contracts';
import type {
  MatrixCellState,
  MatrixRow,
  MethodEvidenceState,
  MethodNavigatorNode,
} from '@/components/method-workspace/types';
import {
  SIRI_BUILDING_BLOCKS,
  SIRI_DIMENSIONS,
  SIRI_PRIORITISATION_AREAS,
  type SIRIBuildingBlock,
} from '@/services/siriStructure';

import { compileSiriPack, DEFAULT_MINIMUM_EVIDENCE_STRENGTH } from './compileSiriPack';
import { siriAdapter } from './siriAdapter';

// ---------------------------------------------------------------------------
// Bands
// ---------------------------------------------------------------------------

export const SIRI_BAND_SCALE = [0, 1, 2, 3, 4, 5] as const;
export type SiriBand = (typeof SIRI_BAND_SCALE)[number];

// ---------------------------------------------------------------------------
// Assessment state — the minimal shape this module needs per 16D unit.
// Owned by the caller (screen/harness in this slice); never persisted here.
// ---------------------------------------------------------------------------

export interface SiriUnitAssessmentState {
  readonly unitId: string;
  /** Bands CONFIRMED so far — only `confirmSiriBand()` may add to this. */
  readonly confirmedLevels: readonly number[];
  readonly evidenceByLevel: Readonly<Record<number, EvidenceStrength>>;
  readonly targetLevel: number | null;
}

export function emptySiriUnitState(unitId: string): SiriUnitAssessmentState {
  return { unitId, confirmedLevels: [], evidenceByLevel: {}, targetLevel: null };
}

function evidenceRank(strength: EvidenceStrength): number {
  return EVIDENCE_STRENGTHS.indexOf(strength);
}

function evidenceCellState(strength: EvidenceStrength | undefined): MethodEvidenceState {
  if (!strength) return 'missing';
  const rank = evidenceRank(strength);
  if (rank >= evidenceRank('E3')) return 'complete';
  if (rank >= evidenceRank(DEFAULT_MINIMUM_EVIDENCE_STRENGTH)) return 'weak';
  return 'missing';
}

function evidenceStateForUnit(state: SiriUnitAssessmentState): MethodEvidenceState {
  if (state.confirmedLevels.length === 0) return 'missing';
  const top = Math.max(...state.confirmedLevels);
  return evidenceCellState(state.evidenceByLevel[top]);
}

// ---------------------------------------------------------------------------
// Navigator — 3 building blocks -> 8 pillars -> 16 dimensions, no orphans.
// ---------------------------------------------------------------------------

export function siriBuildingBlockNodeId(block: SIRIBuildingBlock): string {
  return `block:${block}`;
}

export function siriPillarNodeId(pillarId: string): string {
  return `pillar:${pillarId}`;
}

export function buildSiriNavigatorNodes(
  states: ReadonlyMap<string, SiriUnitAssessmentState>
): MethodNavigatorNode[] {
  const nodes: MethodNavigatorNode[] = [];

  (Object.keys(SIRI_BUILDING_BLOCKS) as SIRIBuildingBlock[]).forEach((blockId, i) => {
    nodes.push({
      unitId: siriBuildingBlockNodeId(blockId),
      name: SIRI_BUILDING_BLOCKS[blockId].name,
      parentId: null,
      order: i,
      currentLevel: null,
      targetLevel: null,
      evidenceState: 'missing',
      gap: null,
      openQuestionCount: 0,
    });
  });

  SIRI_DIMENSIONS.forEach((pillar, i) => {
    nodes.push({
      unitId: siriPillarNodeId(pillar.id),
      name: pillar.name,
      parentId: siriBuildingBlockNodeId(pillar.buildingBlock),
      order: i,
      currentLevel: null,
      targetLevel: null,
      evidenceState: 'missing',
      gap: null,
      openQuestionCount: 0,
    });
  });

  SIRI_PRIORITISATION_AREAS.forEach((area, i) => {
    const state = states.get(area.id) ?? emptySiriUnitState(area.id);
    const resolved = siriAdapter.resolveOpenLevels({
      unitId: area.id,
      confirmedLevels: state.confirmedLevels,
      evidenceByLevel: state.evidenceByLevel,
    });
    const currentLevel = resolved.currentLevel;
    const target = state.targetLevel;
    nodes.push({
      unitId: area.id,
      name: area.name,
      parentId: siriPillarNodeId(area.dimension),
      order: i,
      currentLevel,
      targetLevel: target,
      evidenceState: evidenceStateForUnit(state),
      gap: target !== null && currentLevel !== null ? target - currentLevel : null,
      // SIRI QBank v1 has ZERO dedicated questions per dimension — an honest
      // zero, not a stand-in (SIRI_QBANK_V1_COVERAGE.dimensionsWithDedicatedQuestions).
      openQuestionCount: 0,
    });
  });

  return nodes;
}

// ---------------------------------------------------------------------------
// Live Matrix — 16 rows x Bands 0..5
// ---------------------------------------------------------------------------

export function buildSiriMatrixRows(states: ReadonlyMap<string, SiriUnitAssessmentState>): MatrixRow[] {
  return SIRI_PRIORITISATION_AREAS.map((area) => {
    const state = states.get(area.id) ?? emptySiriUnitState(area.id);
    const resolved = siriAdapter.resolveOpenLevels({
      unitId: area.id,
      confirmedLevels: state.confirmedLevels,
      evidenceByLevel: state.evidenceByLevel,
    });

    const levels: MatrixCellState[] = SIRI_BAND_SCALE.map((level) => {
      const achieved = resolved.currentLevel !== null && level <= resolved.currentLevel;
      const isNextOpen = level === resolved.blockedAtLevel;
      const isAboveGap = resolved.aboveGapLevels.includes(level);
      return {
        unitId: area.id,
        level,
        achieved,
        // "proposed" = the next band a proposal would target (first open gap).
        proposed: isNextOpen,
        target: state.targetLevel === level,
        answerState: achieved ? 'confirmed' : isAboveGap ? 'partial' : 'unresolved',
        evidenceState: evidenceCellState(state.evidenceByLevel[level]),
        aiProposalPending: false,
        reviewRequired: isAboveGap,
        // Practices observed ABOVE the no-leapfrog gap are a blocker signal —
        // recorded and visible, never silently promoted (ProgressionResult.aboveGapLevels).
        blocker: isAboveGap,
      };
    });

    return { unitId: area.id, unitName: area.name, levels };
  });
}

// ---------------------------------------------------------------------------
// No-leapfrog — explicit, user-facing refusal (never a silent block)
// ---------------------------------------------------------------------------

export interface SiriLeapfrogCheck {
  readonly allowed: boolean;
  readonly openLevels: readonly number[];
  readonly blockedAtLevel: number | null;
  readonly message: string | null;
}

export function checkSiriLeapfrog(
  state: SiriUnitAssessmentState,
  requestedLevel: number
): SiriLeapfrogCheck {
  const resolved = siriAdapter.resolveOpenLevels({
    unitId: state.unitId,
    confirmedLevels: state.confirmedLevels,
    evidenceByLevel: state.evidenceByLevel,
  });
  const allowed = resolved.openLevels.includes(requestedLevel);
  return {
    allowed,
    openLevels: resolved.openLevels,
    blockedAtLevel: resolved.blockedAtLevel,
    message: allowed
      ? null
      : `Band ${requestedLevel} jest zablokowany (no-leapfrog, Module 5 §3.7). ` +
        `Najpierw wymaga potwierdzenia Band ${resolved.blockedAtLevel ?? '?'} — ` +
        `obecnie otwarte poziomy: ${resolved.openLevels.join(', ') || 'brak'}.`,
  };
}

// ---------------------------------------------------------------------------
// Evidence items — E0..E4 + `factory_observation` as its own type
// ---------------------------------------------------------------------------

export const SIRI_EVIDENCE_ITEM_TYPES = [
  'document',
  'system_record',
  'metric',
  'demonstration',
  'interview_statement',
  'media',
  'external_source',
  /**
   * ASSESSMENT_KB_SIRI.md §5: "Plant tour/observation może być osobnym
   * Evidence Item." Kept distinct from generic 'demonstration'/'document' so
   * a shop-floor walkthrough is never silently folded into a text note.
   */
  'factory_observation',
] as const;
export type SiriEvidenceItemType = (typeof SIRI_EVIDENCE_ITEM_TYPES)[number];

export interface SiriEvidenceItem {
  readonly evidenceItemId: string;
  readonly unitId: string;
  readonly level: number;
  readonly type: SiriEvidenceItemType;
  readonly strength: EvidenceStrength;
  readonly note: string;
  readonly recordedAt: string;
}

export function isSiriFactoryObservation(item: Pick<SiriEvidenceItem, 'type'>): boolean {
  return item.type === 'factory_observation';
}

/**
 * Mapowanie typu SIRI → zamknięty zbiór kernela (`EvidenceEventPayload.evidenceType`).
 *
 * Kernel celowo NIE dostaje nowego wariantu: jego zbiór jest zamknięty, a
 * znaczenie domenowe niesie adapter metody — dokładnie tak, jak opisuje
 * `SHARED_CONTRACT_MANIFEST.md` §4 („Jeśli Waszemu modułowi brakuje eventu —
 * nie dodawajcie własnego"). `factory_observation` jest **podtypem**
 * kernelowego `observation`, nie nowym bytem.
 *
 * Dzięki temu zapis do `method_events` jest jednoznaczny, a UI i raport SIRI
 * nadal odróżniają obchód hali od zwykłej demonstracji.
 */
export function toKernelEvidenceType(
  type: SiriEvidenceItemType
): EvidenceEventPayload['evidenceType'] {
  return type === 'factory_observation' ? 'observation' : type;
}

// ---------------------------------------------------------------------------
// Band proposal / confirmation — rationale required, assessor proposes only
// ---------------------------------------------------------------------------

export type SiriBandRefusalReason = 'missing_rationale' | 'leapfrog_blocked';

export interface SiriBandRefusal {
  readonly ok: false;
  readonly reason: SiriBandRefusalReason;
  readonly message: string;
  readonly blockedAtLevel?: number | null;
}

export interface SiriBandProposalInput {
  readonly state: SiriUnitAssessmentState;
  readonly level: number;
  readonly rationale: string;
}

export interface SiriBandProposalAccepted {
  readonly ok: true;
  readonly unitId: string;
  readonly level: number;
  readonly rationale: string;
  readonly status: 'proposed';
  readonly proposedBy: 'assessor';
}

export type SiriBandProposalResult = SiriBandProposalAccepted | SiriBandRefusal;

/**
 * Assessor PROPOSES a Band. Never confirms one — see `confirmSiriBand` below.
 * Canon: ASSESSMENT_KB_SIRI.md §3 "Assessor prowadzi, sugeruje i rekomenduje;
 * finalną decyzję Band podejmują uprawnieni uczestnicy/approver."
 */
export function proposeSiriBand(input: SiriBandProposalInput): SiriBandProposalResult {
  if (input.rationale.trim().length === 0) {
    return {
      ok: false,
      reason: 'missing_rationale',
      message:
        'Band nie może zostać zaproponowany bez uzasadnienia (rationale) — kanon wymaga ' +
        'informacji i evidence uzasadniających wybór (ASSESSMENT_KB_SIRI.md §3).',
    };
  }
  const leapfrog = checkSiriLeapfrog(input.state, input.level);
  if (!leapfrog.allowed) {
    return {
      ok: false,
      reason: 'leapfrog_blocked',
      message: leapfrog.message as string,
      blockedAtLevel: leapfrog.blockedAtLevel,
    };
  }
  return {
    ok: true,
    unitId: input.state.unitId,
    level: input.level,
    rationale: input.rationale.trim(),
    status: 'proposed',
    proposedBy: 'assessor',
  };
}

/**
 * Actors permitted to CONFIRM a Band. Deliberately excludes Teresa/AI — the
 * kernel's `TERESA_FORBIDDEN_EFFECTS` (`src/method-core/contracts/teresa.ts`)
 * already lists `'approve_score'`; this type keeps the SIRI call site from
 * ever offering that path in the first place.
 */
export type SiriBandConfirmingActor = 'participant' | 'approver';

const SIRI_BAND_CONFIRMING_ACTORS: readonly SiriBandConfirmingActor[] = ['participant', 'approver'];

/** Runtime guard mirroring the type above — usable where the caller only has a `string`. */
export function isValidSiriBandConfirmingActor(value: string): value is SiriBandConfirmingActor {
  return (SIRI_BAND_CONFIRMING_ACTORS as readonly string[]).includes(value);
}

export interface SiriBandConfirmInput {
  readonly state: SiriUnitAssessmentState;
  readonly level: number;
  readonly rationale: string;
  readonly confirmedByActor: SiriBandConfirmingActor;
  readonly confirmedByUserId: string;
}

export interface SiriBandConfirmed {
  readonly ok: true;
  readonly unitId: string;
  readonly level: number;
  readonly rationale: string;
  readonly status: 'confirmed';
  readonly confirmedByActor: SiriBandConfirmingActor;
  readonly confirmedByUserId: string;
  readonly nextConfirmedLevels: readonly number[];
}

export type SiriBandConfirmResult = SiriBandConfirmed | SiriBandRefusal;

export function confirmSiriBand(input: SiriBandConfirmInput): SiriBandConfirmResult {
  if (input.rationale.trim().length === 0) {
    return {
      ok: false,
      reason: 'missing_rationale',
      message: 'Band nie może zostać potwierdzony bez uzasadnienia (rationale).',
    };
  }
  const leapfrog = checkSiriLeapfrog(input.state, input.level);
  if (!leapfrog.allowed) {
    return {
      ok: false,
      reason: 'leapfrog_blocked',
      message: leapfrog.message as string,
      blockedAtLevel: leapfrog.blockedAtLevel,
    };
  }
  const nextConfirmedLevels = Array.from(new Set([...input.state.confirmedLevels, input.level])).sort(
    (a, b) => a - b
  );
  return {
    ok: true,
    unitId: input.state.unitId,
    level: input.level,
    rationale: input.rationale.trim(),
    status: 'confirmed',
    confirmedByActor: input.confirmedByActor,
    confirmedByUserId: input.confirmedByUserId,
    nextConfirmedLevels,
  };
}

// ---------------------------------------------------------------------------
// Honest "no question content" wiring (SIRI QBank v1 = 0/16 dedicated)
// ---------------------------------------------------------------------------

/**
 * SIRI QBank v1 has ZERO dedicated per-dimension questions. This builds an
 * honestly-empty `MethodQuestion` so the shared shell's
 * `QuestionHelpDisclosure` (A5) renders "Help content unavailable" instead of
 * a fabricated explanation. `canonicalWording` carries a generic, clearly
 * sourced prompt — not licensed content, not invented method text.
 */
export function buildSiriGenericQuestion(unitId: string, level: number | null): MethodQuestion {
  const area = SIRI_PRIORITISATION_AREAS.find((a) => a.id === unitId);
  return {
    questionId: `siri-generic:${unitId}:${level ?? 'unscoped'}`,
    unitId,
    level,
    canonicalWording:
      `Opisz obecny stan wymiaru „${area?.name ?? unitId}” — SIRI QBank v1 nie ma pytania ` +
      'dedykowanego temu wymiarowi (ASSESSMENT_KB_SIRI.md §7, §4.Assessment Matrix pp.32-69 ' +
      'jest treścią licencjonowaną i nie została przepisana).',
    intent: '',
    plainLanguageExplanation: '',
    whyItMatters: '',
    glossaryRefs: [],
    positiveAnswerExample: '',
    partialAnswerExample: '',
    negativeAnswerExample: '',
    expectedEvidence: [],
    likelyRespondentRoles: [],
    followUpQuestionIds: [],
    commonMisunderstanding: '',
    allowedTeresaCapabilities: [],
    sourceRefs: ['knowledge/tool-kb/siri/qbank/v1/siri-qbank.en.md'],
  };
}

/**
 * Honest constant: every one of the 16 dimensions currently gets the empty
 * shape from `buildSiriGenericQuestion`. Kept as a function (not a bare
 * boolean) so a future pack upgrade with real per-dimension content only has
 * to change this one place — see `siriEvidenceMissingCount` for the measured
 * counterpart.
 */
export function siriUnitHasHelpContent(_unitId: string): boolean {
  return false;
}

export interface SiriEvidenceMissingSummary {
  readonly levelsMarkedEvidenceMissing: number;
  readonly levelsTotal: number;
  readonly dimensionsWithDedicatedQuestions: number;
  readonly dimensionsTotal: number;
}

/** Measured, not estimated — reads straight from `compileSiriPack()`'s report. */
export function siriEvidenceMissingCount(): SiriEvidenceMissingSummary {
  const { report } = compileSiriPack();
  return {
    levelsMarkedEvidenceMissing: report.coverage.levelsMarkedEvidenceMissing,
    levelsTotal: report.coverage.levelsTotal,
    dimensionsWithDedicatedQuestions: report.coverage.dimensionsWithDedicatedQuestions,
    dimensionsTotal: report.coverage.dimensionsTotal,
  };
}
