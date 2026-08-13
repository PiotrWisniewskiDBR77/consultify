/**
 * SIRI Method Adapter — implements `MethodAdapter` (src/method-core/contracts/methodPack.ts)
 * for the Smart Industry Readiness Index, 16-Dimensions-as-source-of-truth.
 *
 * Every method-specific rule below is traced to a source. Where the licensed
 * source does not specify a rule, this file says so explicitly instead of
 * inventing one (`EVIDENCE_MISSING` / "PENDING OWNER APPROVAL" markers).
 */

import type {
  AggregationInput,
  AggregationResult,
  EvidenceStrength,
  MethodAdapter,
  MethodPack,
  PrioritisationInput,
  PrioritisationResult,
  ProgressionInput,
  ProgressionResult,
  ScoringInput,
  ScoringResult,
} from '../../contracts';
import { EVIDENCE_STRENGTHS } from '../../contracts';
import {
  SIRI_DIMENSIONS,
  SIRI_PRIORITISATION_AREAS,
  type SIRIBuildingBlock,
} from '@/services/siriStructure';
import {
  buildDefaultInputs,
  DEFAULT_SIRI_PM_WEIGHTS,
  rankByImpactValue,
  type SIRIPrioritisationInput,
  type SIRIPrioritisationWeights,
} from '@/services/siriPrioritisation';
import {
  compileSiriPackOnly,
  DEFAULT_MINIMUM_EVIDENCE_STRENGTH,
  SIRI_METHOD_PACK_ID,
  SIRI_METHOD_PACK_VERSION,
} from './compileSiriPack';

// ---------------------------------------------------------------------------
// resolveOpenLevels — no-leapfrog progression
// ---------------------------------------------------------------------------
// Source: knowledge/SIRI/[SIRI Assessor Training] Module 5.pdf §3.7 "Band
// Scoring of the 16 Dimensions": "The participants should not be allowed to
// score a higher Band if the current state does not substantiate attributes
// of the preceding Band (i.e. no leapfrogging from Band 0 to Band 2)."

const BAND_SCALE = [0, 1, 2, 3, 4, 5] as const;

function resolveOpenLevels(input: ProgressionInput): ProgressionResult {
  const confirmed = new Set(input.confirmedLevels);

  let currentLevel: number | null = null;
  for (const band of BAND_SCALE) {
    if (confirmed.has(band)) {
      currentLevel = band;
    } else {
      break;
    }
  }

  const blockedAtLevel =
    currentLevel === null ? 0 : currentLevel < 5 ? currentLevel + 1 : null;

  const openLevels: number[] = [];
  if (currentLevel !== null) {
    for (let band = 0; band <= currentLevel; band++) openLevels.push(band);
  }
  if (blockedAtLevel !== null) openLevels.push(blockedAtLevel);

  const floor = currentLevel ?? -1;
  const aboveGapLevels = [...confirmed]
    .filter((band) => band > floor && band !== blockedAtLevel)
    .sort((a, b) => a - b);

  return { currentLevel, blockedAtLevel, openLevels, aboveGapLevels };
}

// ---------------------------------------------------------------------------
// computeScore — deterministic 80:20 rule, zero LLM
// ---------------------------------------------------------------------------
// Source: Module 5.pdf §3.7, Table 5.4 "Band Scoring Guidelines" (p.22):
//   Band 0: if only SOME of the attributes are achieved
//   Band 1: if 80% or more of the attributes are achieved
//   Band N (N>=2): if Band N-1 is achieved AND 80%+ of Band N's attributes
//                  are substantiated
// Combined with the no-leapfrog rule above: scoring walks bands 0..5 in
// order and stops at the first band whose own 80% threshold (or, for Band 0,
// "some attributes") is not met, or whose evidence is below the pack's
// minimum evidence strength for that unit/level (compileSiriPack.ts).
//
// "brak dowodu pozostaje jawny" (ASSESSMENT_KB_SIRI.md §3): a unit with NO
// answers at all is never silently scored as Band 0 — it surfaces as
// `needs_evidence` with `proposedLevel: null`.

interface SiriBandTally {
  readonly satisfied: number;
  readonly total: number;
}

function isBandTally(value: unknown): value is SiriBandTally {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as SiriBandTally).satisfied === 'number' &&
    typeof (value as SiriBandTally).total === 'number'
  );
}

function evidenceRank(strength: EvidenceStrength): number {
  return EVIDENCE_STRENGTHS.indexOf(strength);
}

function meetsMinimumEvidence(strength: EvidenceStrength | undefined): boolean {
  if (!strength) return false;
  return evidenceRank(strength) >= evidenceRank(DEFAULT_MINIMUM_EVIDENCE_STRENGTH);
}

function computeScore(input: ScoringInput): ScoringResult {
  const satisfiedAttributes: string[] = [];
  const unsatisfiedAttributes: string[] = [];
  const missingEvidence: string[] = [];
  let currentLevel: number | null = null;

  for (const band of BAND_SCALE) {
    const key = String(band);
    const tally = input.answers[key];

    if (!isBandTally(tally)) {
      missingEvidence.push(`level:${band}:no_answer`);
      break; // no-leapfrog: cannot evaluate — and cannot proceed past — a band with no data
    }

    const ratio = tally.total > 0 ? tally.satisfied / tally.total : 0;
    const thresholdMet = band === 0 ? tally.satisfied > 0 : ratio >= 0.8;

    const strength = input.evidence[key];
    const evidenceOk = meetsMinimumEvidence(strength);
    if (!evidenceOk) {
      missingEvidence.push(`level:${band}:evidence_below_${DEFAULT_MINIMUM_EVIDENCE_STRENGTH}`);
    }

    if (thresholdMet && evidenceOk) {
      currentLevel = band;
      satisfiedAttributes.push(`level:${band}`);
    } else {
      unsatisfiedAttributes.push(`level:${band}`);
      break; // no-leapfrog: stop at the first unmet band
    }
  }

  const noDataAtAll = satisfiedAttributes.length === 0 && unsatisfiedAttributes.length === 0;

  if (noDataAtAll) {
    return {
      proposedLevel: null,
      satisfiedAttributes,
      unsatisfiedAttributes,
      missingEvidence,
      contradictions: [],
      verdict: 'needs_evidence',
    };
  }

  return {
    proposedLevel: currentLevel,
    satisfiedAttributes,
    unsatisfiedAttributes,
    missingEvidence,
    // Contradiction detection is not implemented: no deterministic rule for it
    // was found in the licensed source. Left empty rather than fabricated.
    contradictions: [],
    verdict: 'scored',
  };
}

// ---------------------------------------------------------------------------
// aggregate — 16D -> 8 pillars, explicit + versioned, NOT silently averaged
// ---------------------------------------------------------------------------
// The licensed sources (SIRI-PM Whitepaper.pdf, Assessor Training Module 2/5)
// score and report at the 16-dimension level; none of them define a rollup
// formula from the 16 Dimensions to the 8 Pillars. ASSESSMENT_KB_SIRI.md §7
// lists this explicitly as an open gap ("zdefiniować jawne 16D → 8 pillars
// aggregation"). Per the task instruction, this adapter uses a plainly named
// DEFAULT rule and reports that it needs Method Owner approval — it must not
// be mistaken for a canon-sourced weighting.

export const SIRI_AGGREGATION_MAPPING_VERSION =
  'siri-16to8-unweighted-mean-v1-PENDING-OWNER-APPROVAL';

const SIRI_AGGREGATION_RULE =
  'Unweighted arithmetic mean of the known (non-null/non-missing) 16D unit ' +
  'levels within each parent 8-pillar group, rounded to 1 decimal place. ' +
  'NOT sourced from SIRI canon — the licensed Assessment Matrix scores only ' +
  'at the 16-dimension level and defines no 8-pillar rollup formula. This is ' +
  'a Consultify default pending explicit Method Owner sign-off ' +
  '(ASSESSMENT_KB_SIRI.md §7).';

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function aggregate(input: AggregationInput): AggregationResult {
  const byPillarValues = new Map<string, number[]>();
  const excluded: Record<string, string> = {};

  for (const area of SIRI_PRIORITISATION_AREAS) {
    const level = input.unitLevels[area.id];
    if (level === null || level === undefined) {
      excluded[area.id] = 'unknown';
      continue;
    }
    const bucket = byPillarValues.get(area.dimension) ?? [];
    bucket.push(level);
    byPillarValues.set(area.dimension, bucket);
  }

  const byGroup: Record<string, number | null> = {};
  for (const pillar of SIRI_DIMENSIONS) {
    const values = byPillarValues.get(pillar.id) ?? [];
    byGroup[pillar.id] =
      values.length > 0 ? round1(values.reduce((sum, v) => sum + v, 0) / values.length) : null;
  }

  // Only one mapping version is implemented in this draft pack. The caller's
  // requested `input.mappingVersion` is intentionally not echoed back
  // unmodified — the adapter always reports the version it actually used.
  return {
    byGroup,
    mappingVersion: SIRI_AGGREGATION_MAPPING_VERSION,
    rule: SIRI_AGGREGATION_RULE,
    excluded,
  };
}

// ---------------------------------------------------------------------------
// prioritise — TIER / Prioritisation Matrix, thin adapter over the EXISTING
// engine (src/services/siriPrioritisation.ts). Do NOT duplicate the formula
// here — call the existing calculateImpactValue()/rankByImpactValue().
// ---------------------------------------------------------------------------
// Formula verified against knowledge/SIRI/SIRI-PM Whitepaper.pdf pp.17-20,
// 27-29, 35-37: IV(dim_i) = Wc*[DORc*CostProfile]_i + Wk*[DORk*TopKPIs]_i +
// Wp*[BIC-AMS]_i — matches src/services/siriPrioritisation.ts structurally.
// See SIRI_PM_ENGINE_VERIFICATION below for the two confirmed discrepancies
// (normalisation step + default weights) that were found while verifying.

/**
 * Whitepaper p.29, Figure 12 "Weightage Distribution according to Planning
 * Horizon" — verbatim table. NOT the same as the engine's
 * `DEFAULT_SIRI_PM_WEIGHTS` (0.3/0.3/0.4), which matches none of these three
 * presets — see `SIRI_PM_ENGINE_VERIFICATION.defaultWeightsMatchAnyPlanningHorizonPreset`.
 */
export const SIRI_PM_PLANNING_HORIZON_WEIGHTS: Record<
  'strategic' | 'tactical' | 'operational',
  SIRIPrioritisationWeights
> = {
  strategic: { cost: 0.3, kpi: 0.4, proximity: 0.3 },
  tactical: { cost: 0.45, kpi: 0.3, proximity: 0.25 },
  operational: { cost: 0.6, kpi: 0.2, proximity: 0.2 },
};

/**
 * Findings from reading knowledge/SIRI/SIRI-PM Whitepaper.pdf in full
 * (pp.17-20, 27-29, 35-37) against src/services/siriPrioritisation.ts.
 * Exported so tests and the mission report can assert on them directly
 * instead of restating them as prose.
 */
export const SIRI_PM_ENGINE_VERIFICATION = {
  /** Three weighted terms (cost, kpi, proximity) — Whitepaper p.17 Figure 8. */
  formulaStructureMatchesWhitepaper: true,
  /**
   * Whitepaper p.36 Step 6 requires normalising each of the three factors
   * (dividing by that factor's column Total across all 16 dimensions)
   * BEFORE applying weights in Step 7. `calculateImpactValue()` in
   * siriPrioritisation.ts applies weights directly to the raw
   * DOR*value terms — the normalisation step is not implemented.
   */
  normalisationStepImplemented: false,
  /**
   * `DEFAULT_SIRI_PM_WEIGHTS` = {cost:0.3, kpi:0.3, proximity:0.4} matches
   * none of the three canonical planning-horizon presets (Whitepaper p.29,
   * Figure 12: strategic 30/40/30, tactical 45/30/25, operational 60/20/20).
   */
  defaultWeightsMatchAnyPlanningHorizonPreset: false,
  /**
   * Whitepaper pp.38-39 publish full per-dimension Degree-of-Relevance
   * lookup tables (10 cost categories x 16 dims, 14 KPI categories x 16
   * dims — proprietary numeric IP, deliberately not transcribed here).
   * siriPrioritisation.ts instead takes a single scalar `costRelevance` /
   * `kpiImportance` per area — the official DOR tables are not encoded
   * anywhere in the codebase.
   */
  dorLookupTablesImplemented: false,
  /** Confirmed by reading the file: SIRI_PRIORITISATION_AREAS has 16 entries. */
  engineOperatesOnDimensionCount: 16 as const,
} as const;

interface SiriPrioritisationParameters {
  readonly sessionState?: unknown;
  readonly frozenSnapshotId?: unknown;
  readonly planningHorizon?: unknown;
  readonly defaultBIC?: unknown;
  readonly industryBenchmark?: Readonly<Record<string, number>>;
  readonly areaInputs?: Readonly<Record<string, Partial<SIRIPrioritisationInput>>>;
}

function prioritise(input: PrioritisationInput): PrioritisationResult {
  const params = (input.parameters ?? {}) as SiriPrioritisationParameters;

  // TWARDY ZAKAZ: only a frozen session snapshot may reach prioritisation.
  // `PrioritisationInput.frozenUnitLevels` is already named for this by the
  // kernel contract; this adapter additionally requires an explicit
  // frozen-session marker in `parameters` so an unfrozen/proposal caller
  // cannot silently satisfy the type shape. Rejection = throw, because
  // `PrioritisationResult` has no error variant to return instead.
  if (params.sessionState !== 'frozen' || !params.frozenSnapshotId) {
    throw new Error(
      'SIRI prioritise() rejected: requires a frozen session snapshot ' +
        '(parameters.sessionState === "frozen" and a truthy parameters.frozenSnapshotId). ' +
        `Received sessionState=${JSON.stringify(params.sessionState)}, ` +
        `frozenSnapshotId=${JSON.stringify(params.frozenSnapshotId)}.`
    );
  }

  const planningHorizon = params.planningHorizon;
  if (
    planningHorizon !== 'strategic' &&
    planningHorizon !== 'tactical' &&
    planningHorizon !== 'operational'
  ) {
    throw new Error(
      'SIRI prioritise() rejected: parameters.planningHorizon must be one of ' +
        '"strategic" | "tactical" | "operational" (Whitepaper p.29, Figure 12). ' +
        `Received: ${JSON.stringify(planningHorizon)}.`
    );
  }
  const weights = SIRI_PM_PLANNING_HORIZON_WEIGHTS[planningHorizon];

  const scores: Record<string, number> = {};
  for (const [unitId, level] of Object.entries(input.frozenUnitLevels)) {
    scores[unitId] = level;
  }

  const defaultBIC = typeof params.defaultBIC === 'number' ? params.defaultBIC : undefined;
  const baseInputs = buildDefaultInputs(
    scores,
    defaultBIC !== undefined ? { defaultBIC } : undefined
  );

  const industryBenchmark = params.industryBenchmark ?? {};
  const areaInputsOverride = params.areaInputs ?? {};

  const inputs: SIRIPrioritisationInput[] = baseInputs.map((base) => {
    const override = areaInputsOverride[base.areaId] ?? {};
    const bic = industryBenchmark[base.areaId] ?? override.bic ?? base.bic;
    return { ...base, ...override, bic };
  });

  // Thin call into the EXISTING engine — formula lives in siriPrioritisation.ts.
  const ranked = rankByImpactValue(inputs, weights);

  // Whitepaper p.17 & p.37 Step 8: "the Prioritisation Matrix will recommend
  // at least one SIRI Dimension — the one with the highest Impact Value —
  // from each building block", then one more from the remaining 13 with the
  // next-highest Impact Value overall.
  const buildingBlockByAreaId = new Map<string, SIRIBuildingBlock>(
    SIRI_PRIORITISATION_AREAS.map((area) => [area.id, area.buildingBlock])
  );

  const guaranteedFocusByBlock = new Map<SIRIBuildingBlock, string>();
  for (const r of ranked) {
    const block = buildingBlockByAreaId.get(r.areaId);
    if (block && !guaranteedFocusByBlock.has(block)) {
      guaranteedFocusByBlock.set(block, r.areaId);
    }
  }
  const guaranteedFocusIds = new Set(guaranteedFocusByBlock.values());

  const bonusFocus = ranked.find((r) => !guaranteedFocusIds.has(r.areaId));
  const focusIds = new Set(guaranteedFocusIds);
  if (bonusFocus) focusIds.add(bonusFocus.areaId);

  const rationaleByUnitId: Record<string, string> = {};
  for (const r of ranked) {
    const block = buildingBlockByAreaId.get(r.areaId);
    let reason = `Not selected as a focus dimension (Impact Value=${r.impactValue}, rank ${r.rank}/16).`;
    if (guaranteedFocusByBlock.get(block as SIRIBuildingBlock) === r.areaId) {
      reason =
        `SELECTED_FOCUS: highest Impact Value in Building Block ${block} ` +
        `(Impact Value=${r.impactValue}, rank ${r.rank}/16) — Whitepaper p.37 Step 8a.`;
    } else if (bonusFocus?.areaId === r.areaId) {
      reason =
        `SELECTED_FOCUS: highest Impact Value among the remaining 13 dimensions ` +
        `(Impact Value=${r.impactValue}, rank ${r.rank}/16) — Whitepaper p.37 Step 8b.`;
    }
    rationaleByUnitId[r.areaId] = reason + ` Gap to Best-in-Class benchmark: ${r.gapToBIC}.`;
  }

  return {
    rankedUnitIds: ranked.map((r) => r.areaId),
    rationaleByUnitId,
    parametersVersion: `siri-pm-v1:${planningHorizon}`,
  };
}

// ---------------------------------------------------------------------------
// Adapter export
// ---------------------------------------------------------------------------

export const siriAdapter: MethodAdapter = {
  methodPackId: SIRI_METHOD_PACK_ID,

  async loadPack(version: string): Promise<MethodPack> {
    if (version !== SIRI_METHOD_PACK_VERSION) {
      throw new Error(
        `SIRI loadPack(): unknown pack version "${version}" — only ` +
          `"${SIRI_METHOD_PACK_VERSION}" is compiled in this build.`
      );
    }
    return compileSiriPackOnly();
  },

  resolveOpenLevels,
  computeScore,
  aggregate,
  prioritise,
};

export default siriAdapter;

// Re-export DEFAULT_SIRI_PM_WEIGHTS for tests that want to assert the
// discrepancy against SIRI_PM_PLANNING_HORIZON_WEIGHTS without a second
// import path.
export { DEFAULT_SIRI_PM_WEIGHTS };
