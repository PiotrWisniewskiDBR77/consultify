/**
 * DRD MethodAdapter — the ONLY place DRD-specific progression/scoring/
 * aggregation rules live. The kernel (src/method-core/contracts) holds no
 * `if (method === 'drd')` branch; this file is what it calls instead.
 *
 * Canon:
 *  - ASSESSMENT_EVIDENCE_AND_SCORING_CONTRACT.md (whole document)
 *  - ASSESSMENT_METHOD_PACK_CONTRACT.md §4-6
 *  - task brief mechanics: "przejście od najprostszego poziomu W GÓRĘ",
 *    "pierwszy niespełniony poziom ZATRZYMUJE formalny current level",
 *    "aboveGap NIE podnosi automatycznie currentLevel".
 */

import type {
  AggregationInput,
  AggregationResult,
  EvidenceStrength,
  MethodAdapter,
  MethodLevel,
  MethodPack,
  MethodUnit,
  ProgressionInput,
  ProgressionResult,
  ScoringInput,
  ScoringResult,
} from '../../contracts';

import { compileDrdPack, DRD_AGGREGATION_VERSION, DRD_METHOD_PACK_ID } from './compileDrdPack';

// ---------------------------------------------------------------------------
// Evidence strength ordering (E0 < E1 < E2 < E3 < E4)
// ---------------------------------------------------------------------------

const EVIDENCE_RANK: Record<EvidenceStrength, number> = {
  E0: 0,
  E1: 1,
  E2: 2,
  E3: 3,
  E4: 4,
};

function meetsMinimumEvidence(actual: EvidenceStrength | undefined, minimum: EvidenceStrength): boolean {
  if (!actual) return false;
  return EVIDENCE_RANK[actual] >= EVIDENCE_RANK[minimum];
}

// ---------------------------------------------------------------------------
// Answer shape accepted by computeScore(). `ScoringInput.answers` is typed as
// `Record<string, unknown>` by the kernel contract (method-agnostic); DRD's
// own shape is documented and validated defensively here — never trusted
// blindly, never thrown on for malformed input (falls back to "missing").
// ---------------------------------------------------------------------------

export type DrdAnswerState = 'confirmed' | 'partial' | 'no' | 'dont_know' | 'no_evidence' | 'not_applicable';

export interface DrdAnswerRecord {
  readonly state: DrdAnswerState;
  readonly justification?: string;
}

function parseAnswer(raw: unknown): DrdAnswerRecord | null {
  if (typeof raw === 'string') {
    const validStates: DrdAnswerState[] = [
      'confirmed',
      'partial',
      'no',
      'dont_know',
      'no_evidence',
      'not_applicable',
    ];
    return validStates.includes(raw as DrdAnswerState) ? { state: raw as DrdAnswerState } : null;
  }
  if (raw && typeof raw === 'object' && 'state' in raw) {
    const obj = raw as { state?: unknown; justification?: unknown };
    if (typeof obj.state === 'string') {
      return {
        state: obj.state as DrdAnswerState,
        justification: typeof obj.justification === 'string' ? obj.justification : undefined,
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Pack access helpers
// ---------------------------------------------------------------------------

function getPack(): MethodPack {
  return compileDrdPack().pack;
}

function findUnit(pack: MethodPack, unitId: string): MethodUnit | undefined {
  return pack.units.find((u) => u.unitId === unitId);
}

function findLevel(pack: MethodPack, unitId: string, level: number): MethodLevel | undefined {
  return pack.levels.find((l) => l.unitId === unitId && l.level === level);
}

// ---------------------------------------------------------------------------
// resolveOpenLevels — cumulative ramp, no leapfrog, aboveGap recorded but
// never auto-promotes currentLevel.
// ---------------------------------------------------------------------------

function resolveOpenLevels(input: ProgressionInput): ProgressionResult {
  const pack = getPack();
  const unit = findUnit(pack, input.unitId);
  if (!unit) {
    return { currentLevel: null, blockedAtLevel: null, openLevels: [], aboveGapLevels: [] };
  }

  const scale = [...unit.levelScale].sort((a, b) => a - b);
  const confirmed = new Set(input.confirmedLevels);

  let currentLevel: number | null = null;
  let blockedAtLevel: number | null = null;

  for (const lvl of scale) {
    if (confirmed.has(lvl)) {
      // Only climbs while the ramp from the bottom is unbroken. Once a level
      // above the first gap is "confirmed" out of order, it does NOT touch
      // currentLevel — that's the aboveGap rule.
      if (blockedAtLevel === null) currentLevel = lvl;
    } else if (blockedAtLevel === null) {
      blockedAtLevel = lvl;
    }
  }

  const openLevels = blockedAtLevel === null ? [] : scale.filter((lvl) => lvl <= (blockedAtLevel as number));
  const aboveGapLevels =
    blockedAtLevel === null ? [] : scale.filter((lvl) => lvl > (blockedAtLevel as number) && confirmed.has(lvl));

  return { currentLevel, blockedAtLevel, openLevels, aboveGapLevels };
}

// ---------------------------------------------------------------------------
// computeScore — deterministic, zero LLM. Walks the same bottom-up ramp as
// resolveOpenLevels, but over RAW answers+evidence rather than already-
// decided "confirmedLevels". This is the machine PROPOSAL that later feeds a
// human Decision (which is what eventually becomes a `confirmedLevels` entry
// for resolveOpenLevels) — the two are deliberately separate pipeline stages
// per ASSESSMENT_EVIDENCE_AND_SCORING_CONTRACT.md §3-4.
// ---------------------------------------------------------------------------

function computeScore(input: ScoringInput): ScoringResult {
  const pack = getPack();
  const unit = findUnit(pack, input.unitId);
  if (!unit) {
    return {
      proposedLevel: null,
      satisfiedAttributes: [],
      unsatisfiedAttributes: [],
      missingEvidence: [],
      contradictions: [],
      verdict: 'unknown',
    };
  }

  const scale = [...unit.levelScale].sort((a, b) => a - b);
  const satisfiedAttributes: string[] = [];
  const unsatisfiedAttributes: string[] = [];
  const missingEvidence: string[] = [];
  const contradictions: string[] = [];

  let proposedLevel: number | null = null;
  let verdict: ScoringResult['verdict'] = 'unknown';
  let sawAnyAnswer = false;

  for (const lvl of scale) {
    const level = findLevel(pack, input.unitId, lvl);
    const questionIds = level?.validationQuestionIds ?? [];
    if (questionIds.length === 0) {
      // No question content compiled for this level — cannot score further.
      verdict = sawAnyAnswer ? 'needs_evidence' : verdict;
      break;
    }

    let levelBlockedByMissing = false;
    let levelHasExplicitNo = false;
    let levelBlockedByEvidence = false;
    let levelAllNotApplicable = true;

    for (const questionId of questionIds) {
      const rawAnswer = input.answers[questionId];
      const parsed = parseAnswer(rawAnswer);

      if (!parsed) {
        levelBlockedByMissing = true;
        levelAllNotApplicable = false;
        missingEvidence.push(questionId);
        continue;
      }
      sawAnyAnswer = true;

      if (parsed.state === 'not_applicable') {
        if (!parsed.justification) {
          // Canon: N/A requires justification. Missing one is a defect, not
          // a silent pass — flagged and treated as blocking, same as missing.
          contradictions.push(`${questionId}: not_applicable without justification`);
          levelBlockedByMissing = true;
        } else {
          satisfiedAttributes.push(questionId);
        }
        continue;
      }
      levelAllNotApplicable = false;

      if (parsed.state === 'dont_know' || parsed.state === 'no_evidence') {
        levelBlockedByMissing = true;
        missingEvidence.push(questionId);
        continue;
      }

      if (parsed.state === 'no') {
        levelHasExplicitNo = true;
        unsatisfiedAttributes.push(questionId);
        continue;
      }

      if (parsed.state === 'partial') {
        unsatisfiedAttributes.push(questionId);
        continue;
      }

      // parsed.state === 'confirmed' — now check evidence strength.
      const evidence = input.evidence[questionId];
      const minimum = level?.minimumEvidenceStrength ?? 'E2';
      if (!meetsMinimumEvidence(evidence, minimum)) {
        missingEvidence.push(questionId);
        if (evidence && EVIDENCE_RANK[evidence] > EVIDENCE_RANK[minimum]) {
          // Should not happen (meetsMinimumEvidence would have passed) —
          // defensive branch kept for clarity, unreachable in practice.
        }
        levelBlockedByEvidence = true;
        continue;
      }

      satisfiedAttributes.push(questionId);
    }

    if (levelAllNotApplicable && questionIds.length > 0) {
      // Every question at this level was explicitly marked N/A (with
      // justification, otherwise it would have been caught above).
      verdict = 'not_applicable';
      break;
    }

    if (levelBlockedByMissing || levelBlockedByEvidence) {
      verdict = 'needs_evidence';
      break;
    }

    if (levelHasExplicitNo) {
      // We have a definite, evidenced "no" — this is real information, not
      // a missing-evidence situation. Level is not satisfied; stop climbing.
      verdict = 'scored';
      break;
    }

    // Level fully satisfied — keep climbing.
    proposedLevel = lvl;
    verdict = 'scored';
  }

  if (!sawAnyAnswer) {
    // Canon: "brak dowodu = needs evidence, nie automatyczne zero."
    verdict = 'needs_evidence';
    proposedLevel = null;
  }

  return {
    proposedLevel,
    satisfiedAttributes,
    unsatisfiedAttributes,
    missingEvidence,
    contradictions,
    verdict,
  };
}

// ---------------------------------------------------------------------------
// aggregate — area → axis, explicit versioned rule, N/A excluded not imputed.
// ---------------------------------------------------------------------------

const DRD_AGGREGATION_RULE =
  'drd-axis-mean-v1: arithmetic mean of non-null unit levels within the same axis (unit.parentId), ' +
  'rounded to 1 decimal place (Math.round(x*10)/10). Units with a null level, or an id not found in ' +
  'the pack, are excluded from the mean and reported in `excluded` with a reason — never imputed.';

function aggregate(input: AggregationInput): AggregationResult {
  if (input.mappingVersion !== DRD_AGGREGATION_VERSION) {
    throw new Error(
      `${DRD_METHOD_PACK_ID} adapter: unsupported aggregation mappingVersion "${input.mappingVersion}". ` +
        `Supported: "${DRD_AGGREGATION_VERSION}".`
    );
  }

  const pack = getPack();
  const unitById = new Map(pack.units.map((u) => [u.unitId, u] as const));
  const byAxis = new Map<string, number[]>();
  const excluded: Record<string, string> = {};

  for (const [unitId, level] of Object.entries(input.unitLevels)) {
    const unit = unitById.get(unitId);
    if (!unit) {
      excluded[unitId] = 'unknown_unit_id';
      continue;
    }
    if (level === null || level === undefined) {
      excluded[unitId] = 'null_or_not_applicable_unit_level_excluded_not_imputed';
      continue;
    }
    const key = unit.parentId ?? 'unassigned';
    if (!byAxis.has(key)) byAxis.set(key, []);
    byAxis.get(key)!.push(level);
  }

  const byGroup: Record<string, number | null> = {};
  /**
   * Normalised twin of `byGroup` (COORD-11 / canon §6.1).
   *
   * Averaging raw levels WITHIN one axis is sound — every area of an axis shares
   * that axis' ladder. The trap is CROSS-axis: `byGroup` values carry different
   * units (1–7 vs 1–5 vs 1–6), so a radar or an overall built from them compares
   * incomparable numbers. `score_norm = (level − 1) / (Lmax − 1)` removes that.
   *
   * `byGroup` is left untouched on purpose — changing it would silently move
   * every existing Output's numbers. The normalised figure is added ALONGSIDE.
   */
  const byGroupNorm: Record<string, number | null> = {};
  const axisIds = new Set(pack.units.map((u) => u.parentId).filter((id): id is string => id !== null));
  /** Ladder length per axis, read from the pack — never assumed. */
  const axisLmax = new Map<string, number>();
  for (const unit of pack.units) {
    if (unit.parentId === null) continue;
    const lmax = Math.max(...unit.levelScale);
    const seen = axisLmax.get(unit.parentId);
    if (seen === undefined || lmax > seen) axisLmax.set(unit.parentId, lmax);
  }

  for (const key of axisIds) {
    const values = byAxis.get(key);
    if (!values || values.length === 0) {
      byGroup[key] = null;
      byGroupNorm[key] = null;
      continue;
    }
    byGroup[key] = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;

    const lmax = axisLmax.get(key);
    if (lmax === undefined || lmax <= 1) {
      byGroupNorm[key] = null;
      continue;
    }
    const norms = values.map((v) => (v - 1) / (lmax - 1));
    byGroupNorm[key] = Math.round((norms.reduce((a, b) => a + b, 0) / norms.length) * 10000) / 10000;
  }

  return {
    byGroup,
    byGroupNorm,
    mappingVersion: input.mappingVersion,
    rule: DRD_AGGREGATION_RULE,
    excluded,
  };
}

// ---------------------------------------------------------------------------
// Adapter export
// ---------------------------------------------------------------------------

export const drdAdapter: MethodAdapter = {
  methodPackId: DRD_METHOD_PACK_ID,

  async loadPack(version: string): Promise<MethodPack> {
    const { pack } = compileDrdPack();
    if (version !== pack.manifest.version) {
      throw new Error(
        `${DRD_METHOD_PACK_ID} adapter: requested pack version "${version}" does not match compiled ` +
          `version "${pack.manifest.version}". Pin the exact compiled version.`
      );
    }
    return pack;
  },

  resolveOpenLevels,
  computeScore,
  aggregate,
};

export default drdAdapter;
