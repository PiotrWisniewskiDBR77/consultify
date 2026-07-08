/**
 * Robotics Feasibility — synthesis engine (two-gate feasibility + verdict + W2 moves).
 *
 * The pure, testable brain of the tool. Unlike the pure lever-ranking engines
 * (inventory / RPA), this engine encodes the doctrine's DECISION SPINE literally:
 * per candidate operation it runs
 *
 *   Gate 1 — TECHNICAL feasibility (repeatability AND structured environment AND
 *            solvable gripping, read as a conjunction). Fail → STOP, do not price ROI.
 *   Gate 2 — ECONOMIC feasibility. CAPEX = hardware + integration overhead (20-40%
 *            of hardware, doctrine §4.2) + safety layer; annual net saving = labour
 *            + turnover + ergonomics saving − robot OPEX; PAYBACK = CAPEX / saving.
 *            Threshold: payback > 36 months is hard to defend without a strategic
 *            argument (doctrine §4.2 benchmark).
 *   Gate 3 — RISK & verdict. Combines the two gates with volume trend, product
 *            variability and a strategic override (ergonomics / chronic turnover)
 *            into one of four verdicts: GO / PILOT / HYBRID / NO-GO (doctrine §4.4).
 *
 * It also produces, in the family style:
 *   - a per-operation feasibility scoring (technical 0..3, economic payback, verdict)
 *   - a portfolio ranking of operations best-first (GO before PILOT before HYBRID)
 *   - a W2-validated move sequence, where every move carries rationale / tradeOff /
 *     rejectedVariant (the SMED "move must justify itself" contract).
 *
 * Self-contained: depends only on a minimal RoboticsSession read-model, so it
 * compiles and tests in isolation.
 */

import { type Bilingual } from './deepeningLadder';

type Level = 'high' | 'medium' | 'low';
const LEVEL_SCORE: Record<Level, number> = { high: 3, medium: 2, low: 1 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const asLevel = (value: unknown, fallback: Level = 'medium'): Level =>
  value === 'high' || value === 'medium' || value === 'low' ? value : fallback;
const localize = (text: Bilingual, isPolish: boolean) => (isPolish ? text.pl : text.en);

// ---------------------------------------------------------------------------
// Doctrine constants (§4.2 / §4.4) — the tunable knobs of the business case.
// ---------------------------------------------------------------------------

/** Payback above this many months is "hard to defend without a strategic argument". */
export const PAYBACK_THRESHOLD_MONTHS = 36;
/** Integration is budgeted as 20-40% of hardware price; midpoint used as default. */
export const INTEGRATION_OVERHEAD_MIN = 0.2;
export const INTEGRATION_OVERHEAD_MAX = 0.4;
export const INTEGRATION_OVERHEAD_DEFAULT = 0.3;
/**
 * Net productive hours per FTE per year (industrial standard ~1800 after holidays,
 * absence and breaks). Converts freed cycle-time (seconds × annual volume) into an
 * FTE-equivalent labour saving — the throughput path of doctrine §4.2/§7.
 */
export const PRODUCTIVE_HOURS_PER_FTE = 1800;

// ---------------------------------------------------------------------------
// Read-model
// ---------------------------------------------------------------------------

export type VolumeTrend = 'rising' | 'stable' | 'falling';
/** Physical safety regime — decides integration cost and layout flexibility. */
export type SafetyRegime = 'fenced' | 'cobot' | 'unknown';

/**
 * Minimal read-model of one candidate operation, sourced from the tool's
 * `operations` section. Numbers are optional; the engine degrades gracefully and
 * reports what is missing rather than throwing.
 */
export interface OperationCandidate {
  id: string;
  label?: string;
  // --- Gate 1: technical feasibility (read as a conjunction) ---
  /** How repeatable / structured the task is (high = same sequence every cycle). */
  repeatability?: Level;
  /** How structured the environment is (high = fixed part pose, stable lighting). */
  structuredEnv?: Level;
  /** How solvable the grip is in a reasonable budget (high = rigid, regular object). */
  gripSolvability?: Level;
  /** Whether the base process is stabilized (an unstable process = automate chaos). */
  processStable?: boolean;

  // --- Gate 2: economic feasibility ---
  /** Number of shifts staffing the operation (1/2/3) — drives labour saving and payback sensitivity. */
  shifts?: number;
  /** FTE freed (reduced or reassigned) by automating this operation. */
  fteReduced?: number;
  /** Fully-burdened annual cost of one FTE at this station. */
  annualCostPerFte?: number;
  /** Manual cycle time per unit, seconds — the throughput saving numerator (doctrine §4.2/§7). */
  cycleTimeManualSec?: number;
  /** Robot/cobot cycle time per unit, seconds — the realistic takt on the full mix, not the supplier's ideal-variant claim. */
  cycleTimeRobotSec?: number;
  /** Units per year through the operation — converts per-unit cycle-time saving into annual freed labour hours. */
  annualVolume?: number;
  /** Robot/cobot hardware price (base + end-effector), excl. integration. */
  hardwareCost?: number;
  /** Explicit safety-layer CAPEX (fencing/sensors/contact monitoring), if separated. */
  safetyCost?: number;
  /** Integration overhead as a fraction of hardware (0.2..0.4); defaults to 0.3. */
  integrationOverhead?: number;
  /** New annual robot OPEX (service, energy, software, supervising operator). */
  robotOpexAnnual?: number;
  /** Extra annual saving from reduced turnover/recruitment (rarely in the P&L). */
  turnoverSavingAnnual?: number;
  /** Extra annual saving from reduced ergonomic absence/injury. */
  ergonomicsSavingAnnual?: number;

  // --- Gate 3: risk / strategy ---
  /** Volume trend over the amortization horizon — outweighs current volume. */
  volumeTrend?: VolumeTrend;
  /** Product variability through the operation (high = many variants, frequent change). */
  variability?: Level;
  /** Share of volume covered by the 2-3 top variants, 0..1 — drives HYBRID split. */
  topVariantShare?: number;
  /** Safety regime — cobot (shared space) demands recurring conformity re-assessment. */
  safetyRegime?: SafetyRegime;
  /** Strategic pressure beyond ROI (ergonomics risk, chronic turnover, labour shortage). */
  strategicPressure?: Level;
  /** Whether the numbers are measured (true) or estimated. */
  measured?: boolean;
}

/** The minimal robotics-feasibility session shape the engine reads. */
export interface RoboticsSession {
  operations: OperationCandidate[];
}

// ---------------------------------------------------------------------------
// Gate 1 — technical feasibility (conjunction, doctrine §4.1 / §5)
// ---------------------------------------------------------------------------

export type TechnicalBlocker = 'repeatability' | 'structuredEnv' | 'gripSolvability' | 'processStable';

export interface TechnicalGate {
  /** Conjunction score 0..3: min of the three technical criteria (weakest link). */
  score: number;
  /** True when all three criteria clear the bar AND the base process is stable. */
  passes: boolean;
  /** Which criteria drag the conjunction down (score < 2, unstable process, OR absent proof). */
  blockers: TechnicalBlocker[];
  /**
   * Which technical criteria are ABSENT (no evidence supplied). The gate is a hard
   * STOP requiring proof (doctrine §4.1): a missing criterion is treated as a
   * blocker that must be MEASURED before the gate can pass, not silently assumed
   * "medium". Callers surface these as "measure before proceeding".
   */
  unmeasured: TechnicalBlocker[];
}

/**
 * Technical feasibility is a CONJUNCTION, not an average: repeatability AND
 * structured environment AND solvable gripping. Missing ONE raises cost/risk
 * non-proportionally, so we take the MIN (weakest link), not the mean. An
 * unstable base process fails the gate outright (automating chaos = faster chaos).
 */
export function evaluateTechnicalGate(op: OperationCandidate): TechnicalGate {
  // The three technical criteria are read as a CONJUNCTION (min = weakest link).
  // Crucially, an ABSENT criterion is NOT assumed "medium" — the gate is a hard
  // STOP requiring proof (doctrine §4.1), so a missing field floors the score to 0
  // and is flagged as a blocker that must be measured before the gate can pass.
  const criteria: Array<{ key: TechnicalBlocker; level?: Level }> = [
    { key: 'repeatability', level: op.repeatability },
    { key: 'structuredEnv', level: op.structuredEnv },
    { key: 'gripSolvability', level: op.gripSolvability },
  ];

  const blockers: TechnicalBlocker[] = [];
  const unmeasured: TechnicalBlocker[] = [];
  let score = 3;
  for (const c of criteria) {
    if (c.level === undefined) {
      unmeasured.push(c.key);
      blockers.push(c.key);
      score = 0; // no evidence = weakest-link floor; the gate cannot clear on assumption
    } else {
      const s = LEVEL_SCORE[c.level];
      score = Math.min(score, s);
      if (s < 2) blockers.push(c.key);
    }
  }

  // processStable defaults to true only when explicitly true; undefined is treated
  // as "unknown but not blocking" so an unfilled field never fabricates a blocker.
  const stableUnknownOk = op.processStable !== false;
  if (op.processStable === false) blockers.push('processStable');

  // Passes when the weakest technical link is at least "medium" (2), NOTHING is
  // unmeasured, and the process is not explicitly unstable.
  const passes = score >= 2 && unmeasured.length === 0 && stableUnknownOk;
  return { score, passes, blockers, unmeasured };
}

// ---------------------------------------------------------------------------
// Gate 2 — economic feasibility (CAPEX / saving / payback, doctrine §4.2)
// ---------------------------------------------------------------------------

export interface EconomicGate {
  /** hardware + integration overhead + safety layer. */
  capex: number;
  /** Integration overhead amount (the line clients systematically omit). */
  integrationCost: number;
  /** Labour saving actually used (FTE-headcount model, or the cycle-time path as fallback). */
  labourSaving: number;
  /** Labour saving implied by freed cycle-time × annual volume (throughput path, §7). 0 when cycle-time data absent. */
  cycleTimeLabourSaving: number;
  /** True when the labour saving was derived from cycle-time × volume rather than the FTE-headcount model. */
  cycleTimeBased: boolean;
  /** Labour + turnover + ergonomics − robot OPEX (the true annual net). */
  annualNetSaving: number;
  /** Shift count assumed for the saving (>= 1) — drives payback sensitivity. */
  shifts: number;
  /** CAPEX / annualNetSaving, in months. Infinity when saving <= 0. */
  paybackMonths: number;
  /** Payback in months if the operation ran a SINGLE shift — grounds the "≈ shifts× at 1 shift" insight. Infinity when saving <= 0. */
  paybackMonthsSingleShift: number;
  /** ROI = annualNetSaving / capex (annual). 0 when capex <= 0. */
  roi: number;
  /** True when paybackMonths <= PAYBACK_THRESHOLD_MONTHS. */
  withinThreshold: boolean;
  /** True when the numbers needed to price the case are present. */
  priced: boolean;
}

/**
 * Build the economic gate. CAPEX makes the integration line EXPLICIT (doctrine's
 * #1 under-estimation: clients price the catalogue robot and omit the 20-40%
 * integration add-on, so real payback comes out 1.5-2x the pitch). Net saving
 * layers the soft-but-real turnover/ergonomics savings on top of direct labour,
 * minus the robot's own new OPEX.
 */
export function evaluateEconomicGate(op: OperationCandidate): EconomicGate {
  const hardware = op.hardwareCost || 0;
  const overhead = clamp(
    op.integrationOverhead ?? INTEGRATION_OVERHEAD_DEFAULT,
    INTEGRATION_OVERHEAD_MIN,
    INTEGRATION_OVERHEAD_MAX
  );
  const integrationCost = round1(hardware * overhead);
  const safety = op.safetyCost || 0;
  const capex = round1(hardware + integrationCost + safety);

  const annualCostPerFte = op.annualCostPerFte || 0;
  const fteLabourSaving = round1((op.fteReduced || 0) * annualCostPerFte);

  // Cycle-time / throughput path (doctrine §7): freed seconds per unit × annual
  // volume → freed FTE-equivalent hours → labour value. A complementary basis for
  // the saving when headcount reduction is not stated directly, and a cross-check
  // when it is. Only counts when the robot is faster (manual > robot).
  const manualSec = op.cycleTimeManualSec || 0;
  const robotSec = op.cycleTimeRobotSec || 0;
  const annualVolume = op.annualVolume || 0;
  const hasCycleData = manualSec > 0 && annualVolume > 0 && manualSec > robotSec;
  const cycleTimeLabourSaving = hasCycleData
    ? round1((((manualSec - robotSec) * annualVolume) / 3600 / PRODUCTIVE_HOURS_PER_FTE) * annualCostPerFte)
    : 0;

  // Prefer the direct FTE-headcount model; fall back to the cycle-time-derived
  // saving so the labour numerator is never silently zero when only throughput
  // data was captured (the axis the doctrine calls "the numerator of the saving").
  const cycleTimeBased = fteLabourSaving <= 0 && cycleTimeLabourSaving > 0;
  const labourSaving = cycleTimeBased ? cycleTimeLabourSaving : fteLabourSaving;

  const annualNetSaving = round1(
    labourSaving +
      (op.turnoverSavingAnnual || 0) +
      (op.ergonomicsSavingAnnual || 0) -
      (op.robotOpexAnnual || 0)
  );

  // Shift count drives payback sensitivity: the same robot displaces labour on
  // every shift it runs, so at a single shift the annual saving is ≈ 1/shifts of
  // the multi-shift saving and the payback is ≈ shifts× longer (doctrine §6, insight #1).
  const shifts = op.shifts && op.shifts > 0 ? op.shifts : 1;
  const perShiftNetSaving = annualNetSaving / shifts;

  const paybackMonths = annualNetSaving > 0 ? round1((capex / annualNetSaving) * 12) : Infinity;
  const paybackMonthsSingleShift = perShiftNetSaving > 0 ? round1((capex / perShiftNetSaving) * 12) : Infinity;
  const roi = capex > 0 ? round1(annualNetSaving / capex) : 0;
  const priced =
    hardware > 0 &&
    (((op.fteReduced || 0) > 0 && annualCostPerFte > 0) || hasCycleData);

  return {
    capex,
    integrationCost,
    labourSaving,
    cycleTimeLabourSaving,
    cycleTimeBased,
    annualNetSaving,
    shifts,
    paybackMonths,
    paybackMonthsSingleShift,
    roi,
    withinThreshold: paybackMonths <= PAYBACK_THRESHOLD_MONTHS,
    priced,
  };
}

// ---------------------------------------------------------------------------
// Gate 3 — verdict (doctrine §4.4)
// ---------------------------------------------------------------------------

export type Verdict = 'go' | 'pilot' | 'hybrid' | 'no-go';

export interface OperationFeasibility {
  id: string;
  label: string;
  technical: TechnicalGate;
  economic: EconomicGate;
  verdict: Verdict;
  /** Machine-readable reasons feeding the verdict — used by prompts and UI. */
  drivers: {
    technicalBlocked: boolean;
    paybackWithinThreshold: boolean;
    volumeFalling: boolean;
    highVariability: boolean;
    hybridSplittable: boolean;
    strategicOverride: boolean;
    cobotChangeRisk: boolean;
    /** True when the case would otherwise be GO but rests on unmeasured data → PILOT (doctrine §4.4). */
    measurementUncertain: boolean;
  };
  rationale: Bilingual;
}

const HYBRID_SHARE_FLOOR = 0.5; // top variants must cover at least half the volume to carry a hybrid core

/**
 * Turn the two priced gates + risk facts into one of four verdicts, per doctrine §4.4:
 *
 *   NO-GO   — technical gate blocked and unfixable in budget, OR volume falling so
 *             amortization cannot be covered regardless of payback.
 *   HYBRID  — high product variability blocks full automation, but a handful of
 *             high-volume variants can carry a robotized core (human keeps the tail).
 *   PILOT   — technical feasibility probable but a key parameter is uncertain, OR
 *             payback is just over threshold yet a strategic argument (ergonomics /
 *             chronic turnover / labour shortage) justifies buying the hard data.
 *   GO      — technical gate clean, payback within threshold, volume not falling.
 */
export function decideVerdict(op: OperationCandidate): OperationFeasibility {
  const technical = evaluateTechnicalGate(op);
  const economic = evaluateEconomicGate(op);
  const label = op.label || op.id;

  const volumeFalling = op.volumeTrend === 'falling';
  const variabilityLevel = asLevel(op.variability, 'low');
  const highVariability = variabilityLevel === 'high';
  const hybridSplittable = (op.topVariantShare || 0) >= HYBRID_SHARE_FLOOR;
  const strategicOverride = asLevel(op.strategicPressure, 'low') === 'high';
  // Cobot regime + any non-trivial variability (medium OR high) means every variant
  // change is a safety event needing recurring conformity re-assessment (§4.5/§5).
  // Read AFTER the high-variability branches below, so at the PILOT gate it fires on
  // the moderate-variability cobot case — the branch that was previously dead.
  const cobotChangeRisk = op.safetyRegime === 'cobot' && variabilityLevel !== 'low';
  // A case is uncertain when its numbers are not measured — feasibility probable but
  // a key parameter (real cycle time, grip reliability) unproven.
  const measured = op.measured === true;

  let verdict: Verdict;

  if (!technical.passes) {
    // Technical gate blocked. High variability with a splittable core → HYBRID,
    // otherwise NO-GO (do not price ROI on a blocked technical gate).
    verdict = highVariability && hybridSplittable ? 'hybrid' : 'no-go';
  } else if (volumeFalling) {
    // Falling volume: even a good payback fails to cover amortization — the
    // "arithmetically correct but strategically wrong" trap the tool exists to catch.
    verdict = 'no-go';
  } else if (highVariability && !hybridSplittable) {
    // High variability with no dominant variant core — full automation not defensible.
    verdict = 'no-go';
  } else if (highVariability && hybridSplittable) {
    // High variability but a dominant variant core carries a robotized subset.
    verdict = 'hybrid';
  } else if (economic.withinThreshold) {
    // Clean technical gate + payback in threshold + volume not falling. GO only when
    // the case rests on MEASURED data; an unmeasured key parameter (real cycle time,
    // grip reliability) makes feasibility probable-but-uncertain → PILOT to earn the
    // hard data before full CAPEX (doctrine §4.4).
    verdict = measured ? 'go' : 'pilot';
  } else if (strategicOverride || cobotChangeRisk) {
    // Payback over threshold but a strategic argument (ergonomics / chronic turnover)
    // OR a cobot variant-change risk justifies a PILOT to generate the hard data
    // before full CAPEX.
    verdict = 'pilot';
  } else {
    // Over threshold, no strategic override, nothing splittable — not defensible now.
    verdict = 'no-go';
  }

  const rationale = buildVerdictRationale(verdict, {
    label,
    technical,
    economic,
    volumeFalling,
    highVariability,
    hybridSplittable,
    strategicOverride,
    cobotChangeRisk,
  });

  return {
    id: op.id,
    label,
    technical,
    economic,
    verdict,
    drivers: {
      technicalBlocked: !technical.passes,
      paybackWithinThreshold: economic.withinThreshold,
      volumeFalling,
      highVariability,
      hybridSplittable,
      strategicOverride,
      cobotChangeRisk,
      measurementUncertain: verdict === 'pilot' && economic.withinThreshold && !measured,
    },
    rationale,
  };
}

interface RationaleFacts {
  label: string;
  technical: TechnicalGate;
  economic: EconomicGate;
  volumeFalling: boolean;
  highVariability: boolean;
  hybridSplittable: boolean;
  strategicOverride: boolean;
  cobotChangeRisk: boolean;
}

const pb = (e: EconomicGate) => (Number.isFinite(e.paybackMonths) ? `${e.paybackMonths} mies` : 'brak zwrotu');
const pbEn = (e: EconomicGate) => (Number.isFinite(e.paybackMonths) ? `${e.paybackMonths} mo` : 'no return');

function buildVerdictRationale(verdict: Verdict, f: RationaleFacts): Bilingual {
  switch (verdict) {
    case 'go':
      return {
        pl: `Operacja „${f.label}": bramka techniczna czysta (najsłabsze ogniwo ${f.technical.score}/3), payback ${pb(f.economic)} w progu ${PAYBACK_THRESHOLD_MONTHS} mies, wolumen niemalejący — silny kandydat GO.`,
        en: `Operation "${f.label}": technical gate clean (weakest link ${f.technical.score}/3), payback ${pbEn(f.economic)} within the ${PAYBACK_THRESHOLD_MONTHS}-mo threshold, volume not falling — a strong GO candidate.`,
      };
    case 'pilot':
      // Two roads to PILOT: (a) payback IS within threshold but the case rests on
      // unmeasured data (feasibility probable but uncertain); (b) payback is over
      // threshold yet a strategic argument or a cobot variant-change risk justifies
      // buying the hard data first.
      if (f.economic.withinThreshold) {
        return {
          pl: `Operacja „${f.label}": bramka techniczna czysta, payback ${pb(f.economic)} w progu ${PAYBACK_THRESHOLD_MONTHS} mies, ALE kluczowe parametry są niezmierzone — feasibility prawdopodobna, lecz niepewna: PILOT, by zdobyć twarde dane (realny cycle time, niezawodność chwytu) przed pełnym CAPEX.`,
          en: `Operation "${f.label}": technical gate clean, payback ${pbEn(f.economic)} within the ${PAYBACK_THRESHOLD_MONTHS}-mo threshold, BUT key parameters are unmeasured — feasibility probable yet uncertain: a PILOT earns the hard data (real cycle time, grip reliability) before full CAPEX.`,
        };
      }
      return {
        pl: `Operacja „${f.label}": bramka techniczna zaliczona, ale payback ${pb(f.economic)} przekracza próg ${PAYBACK_THRESHOLD_MONTHS} mies; ${f.strategicOverride ? 'argument strategiczny (ergonomia/rotacja) uzasadnia' : 'ryzyko zmiany chwytaka w cobocie (powtarzalna re-ocena zgodności przy zmianie wariantu) uzasadnia'} PILOT — po to, by zdobyć twarde dane przed pełnym CAPEX.`,
        en: `Operation "${f.label}": technical gate passed, but payback ${pbEn(f.economic)} exceeds the ${PAYBACK_THRESHOLD_MONTHS}-mo threshold; ${f.strategicOverride ? 'a strategic argument (ergonomics/turnover) justifies' : 'the cobot gripper-change risk (recurring conformity re-assessment on every variant change) justifies'} a PILOT — to earn hard data before full CAPEX.`,
      };
    case 'hybrid':
      return {
        pl: `Operacja „${f.label}": wysoka zmienność produktu blokuje pełną automatyzację, ale warianty wysokowolumenowe niosą rdzeń — rekomendacja HYBRYDA: robot bierze rdzeń, człowiek zostaje na ogonie niestandardowym. To nie porażka, to często optymalny wynik ekonomiczny.`,
        en: `Operation "${f.label}": high product variability blocks full automation, but high-volume variants carry a core — HYBRID recommendation: the robot takes the core, the human keeps the non-standard tail. Not a failure — often the optimal economic outcome.`,
      };
    case 'no-go':
    default:
      if (f.volumeFalling) {
        return {
          pl: `Operacja „${f.label}": nawet przy payback ${pb(f.economic)} odradzamy CAPEX — malejący trend wolumenu nie pokrywa się z horyzontem amortyzacji robota. Decyzja poprawna arytmetycznie, ale strategicznie zła.`,
          en: `Operation "${f.label}": even at payback ${pbEn(f.economic)} we advise against the CAPEX — the falling volume trend does not match the robot's amortization horizon. Arithmetically correct, strategically wrong.`,
        };
      }
      if (f.technical.blockers.length > 0) {
        return {
          pl: `Operacja „${f.label}": bramka techniczna nie przechodzi (najsłabsze ogniwo ${f.technical.score}/3) — brak przejścia bramki technicznej to STOP, nie idziemy do ROI. Najpierw usuńcie ${f.technical.blockers.join(', ')}.`,
          en: `Operation "${f.label}": technical gate does not pass (weakest link ${f.technical.score}/3) — no technical pass is a STOP, we do not price ROI. First resolve ${f.technical.blockers.join(', ')}.`,
        };
      }
      return {
        pl: `Operacja „${f.label}": payback ${pb(f.economic)} poza progiem ${PAYBACK_THRESHOLD_MONTHS} mies bez argumentu strategicznego i bez rdzenia do hybrydy — NO-GO obecnie.`,
        en: `Operation "${f.label}": payback ${pbEn(f.economic)} beyond the ${PAYBACK_THRESHOLD_MONTHS}-mo threshold with no strategic argument and no hybrid core — NO-GO for now.`,
      };
  }
}

// ---------------------------------------------------------------------------
// Portfolio baseline + ranking
// ---------------------------------------------------------------------------

export interface RoboticsBaseline {
  operationCount: number;
  /** Operations that clear the technical gate. */
  technicallyFeasibleCount: number;
  /** Operations whose payback is within threshold. */
  withinThresholdCount: number;
  /** Verdict tally across the portfolio. */
  verdicts: Record<Verdict, number>;
  /** Total CAPEX implied by all GO/PILOT/HYBRID operations. */
  totalCapexInScope: number;
  /** Total annual net saving across GO/PILOT/HYBRID operations. */
  totalAnnualSaving: number;
  /** Share of operations whose numbers are measured, 0..1. */
  measuredRatio: number;
}

const VERDICT_RANK: Record<Verdict, number> = { go: 0, pilot: 1, hybrid: 2, 'no-go': 3 };

export function computeBaseline(session: RoboticsSession): RoboticsBaseline {
  const feas = session.operations.map(decideVerdict);
  const verdicts: Record<Verdict, number> = { go: 0, pilot: 0, hybrid: 0, 'no-go': 0 };
  let totalCapexInScope = 0;
  let totalAnnualSaving = 0;
  feas.forEach((f) => {
    verdicts[f.verdict] += 1;
    if (f.verdict !== 'no-go') {
      totalCapexInScope += f.economic.capex;
      totalAnnualSaving += f.economic.annualNetSaving;
    }
  });
  const measured = session.operations.filter((o) => o.measured).length;
  return {
    operationCount: session.operations.length,
    technicallyFeasibleCount: feas.filter((f) => f.technical.passes).length,
    withinThresholdCount: feas.filter((f) => f.economic.withinThreshold).length,
    verdicts,
    totalCapexInScope: round1(totalCapexInScope),
    totalAnnualSaving: round1(totalAnnualSaving),
    measuredRatio: session.operations.length > 0 ? round1(measured / session.operations.length) : 0,
  };
}

export interface RoboticsRanking {
  feasibilities: OperationFeasibility[];
  /** Operation ids ordered best-first (GO before PILOT before HYBRID before NO-GO). */
  ordered: string[];
  rationale: Bilingual;
}

/**
 * Rank operations best-first. Verdict rank dominates (GO < PILOT < HYBRID < NO-GO);
 * within a verdict, shorter payback ranks first; ties break toward lower CAPEX
 * (cheaper proof-of-value first).
 */
export function rankOperations(session: RoboticsSession): RoboticsRanking {
  const feasibilities = session.operations.map(decideVerdict);
  const ordered = [...feasibilities]
    .sort((a, b) => {
      if (VERDICT_RANK[a.verdict] !== VERDICT_RANK[b.verdict])
        return VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict];
      const pa = Number.isFinite(a.economic.paybackMonths) ? a.economic.paybackMonths : Infinity;
      const pbk = Number.isFinite(b.economic.paybackMonths) ? b.economic.paybackMonths : Infinity;
      if (pa !== pbk) return pa - pbk;
      return a.economic.capex - b.economic.capex;
    })
    .map((f) => f.id);

  const top = feasibilities.find((f) => f.id === ordered[0]);
  const rationale: Bilingual = top
    ? {
        pl: `Najsilniejszy kandydat to „${top.label}" (${top.verdict.toUpperCase()}, payback ${pb(top.economic)}). Kolejność trzyma dyscyplinę: technika PRZED ekonomią, GO przed pilotem przed hybrydą — nie liczymy ROI operacji, która nie przeszła bramki technicznej.`,
        en: `The strongest candidate is "${top.label}" (${top.verdict.toUpperCase()}, payback ${pbEn(top.economic)}). The order keeps discipline: technical BEFORE economic, GO before pilot before hybrid — we do not price ROI on an operation that failed the technical gate.`,
      }
    : {
        pl: 'Brak operacji do oceny — dodaj co najmniej jedną operację-kandydata, aby zbudować ranking feasibility.',
        en: 'No operations to assess yet — add at least one candidate operation to build the feasibility ranking.',
      };

  return { feasibilities, ordered, rationale };
}

// ---------------------------------------------------------------------------
// W2 move validator + sequence
// ---------------------------------------------------------------------------

export type W2Field = 'rationale' | 'tradeOff' | 'rejectedVariant';

export interface W2MoveInput {
  title?: string;
  rationale?: string;
  tradeOff?: string;
  rejectedVariant?: string;
}

export interface W2ValidationResult {
  valid: boolean;
  missing: W2Field[];
  weak: W2Field[];
}

const MIN_JUSTIFICATION_LEN = 12;
const isThin = (value?: string) => !value || value.trim().length < MIN_JUSTIFICATION_LEN;

/**
 * The W2 contract: a move is only valid when it justifies itself with a
 * rationale, an explicit trade-off, and a rejected variant.
 */
export function validateW2Move(move: W2MoveInput): W2ValidationResult {
  const missing: W2Field[] = [];
  const weak: W2Field[] = [];
  (['rationale', 'tradeOff', 'rejectedVariant'] as W2Field[]).forEach((field) => {
    const value = move[field];
    if (!value || !value.trim()) missing.push(field);
    else if (isThin(value)) weak.push(field);
  });
  return { valid: missing.length === 0 && weak.length === 0, missing, weak };
}

export interface SequencedMove {
  order: number;
  /** The operation this move acts on. */
  operationId: string;
  verdict: Verdict;
  title: Bilingual;
  rationale: Bilingual;
  tradeOff: Bilingual;
  rejectedVariant: Bilingual;
  expectedImpact: Level;
  estimatedEffort: Level;
  /** Every synthesized move is self-validated so the UI never renders an unjustified move. */
  validation: W2ValidationResult;
}

const VALID: W2ValidationResult = { valid: true, missing: [], weak: [] };

/**
 * Build a W2-validated move sequence from the ranked operations. The rule of the
 * sequence: measurement first when the portfolio is unmeasured (a business case on
 * unmeasured cycle time/volume is optimism); then the leading GO/PILOT operation
 * as the first proof-of-value; then surface any HYBRID split explicitly; and
 * always make the integration line and safety re-assessment procedure explicit,
 * because both are the doctrine's systematically-omitted costs.
 */
export function buildW2MoveSequence(session: RoboticsSession): SequencedMove[] {
  const { feasibilities, ordered } = rankOperations(session);
  if (ordered.length === 0) return [];

  const baseline = computeBaseline(session);
  const feasOf = (id: string) => feasibilities.find((f) => f.id === id)!;
  const moves: SequencedMove[] = [];
  let order = 1;

  // 1. If the portfolio is thin on measurement, measure first.
  if (baseline.measuredRatio < 0.5) {
    const primaryId = ordered[0];
    moves.push({
      order: order++,
      operationId: primaryId,
      verdict: feasOf(primaryId).verdict,
      title: {
        pl: 'Najpierw zmierz cycle time, wolumen i koszt pracy — zanim liczysz ROI',
        en: 'Measure cycle time, volume and labour cost first — before pricing ROI',
      },
      rationale: {
        pl: `Tylko ${Math.round(baseline.measuredRatio * 100)}% operacji ma zmierzone dane — bez pomiaru payback jest zgadywaniem, a CAPEX na robota to zakład (60% projektów nie osiąga zakładanego ROI właśnie stąd).`,
        en: `Only ${Math.round(baseline.measuredRatio * 100)}% of operations have measured data — without measurement payback is guesswork and the robot CAPEX is a bet (60% of projects miss target ROI for exactly this reason).`,
      },
      tradeOff: {
        pl: 'Kosztem ~1 cyklu opóźnienia decyzji, w zamian za pewność, która operacja realnie zwróci koszt automatyzacji.',
        en: 'At the cost of ~1 cycle of delay to the decision, in exchange for certainty about which operation really returns the automation cost.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „zrobotyzujmy najbardziej męczące stanowisko od razu": bez pomiaru kupujecie robota o ujemnym zwrocie na operacji o niskim wolumenie lub wysokiej zmienności.',
        en: 'We reject "just robotize the most tiring station now": without measurement you buy a negative-return robot on a low-volume or high-variability operation.',
      },
      expectedImpact: 'medium',
      estimatedEffort: 'low',
      validation: VALID,
    });
  }

  // 2. Lead with the top-ranked operation (first proof-of-value).
  const leadId = ordered[0];
  const lead = feasOf(leadId);
  moves.push({
    order: order++,
    operationId: leadId,
    verdict: lead.verdict,
    title: {
      pl: `Zacznij od operacji „${lead.label}" (${lead.verdict.toUpperCase()})`,
      en: `Start with operation "${lead.label}" (${lead.verdict.toUpperCase()})`,
    },
    rationale: lead.rationale,
    tradeOff: {
      pl: 'Kosztem tempa na pozostałych operacjach — świadomie skupiacie budżet i inżynierię na jednym dowodzie wartości, zamiast automatyzować całą linię naraz.',
      en: 'At the cost of pace on the other operations — you deliberately concentrate budget and engineering on one proof-of-value rather than automating the whole line at once.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy równoległą automatyzację całej linii: to najczęstsza droga do przekroczenia budżetu i rozczarowania — bez skończonego pierwszego wdrożenia zespół nie zdobywa wzorca utrzymania.',
      en: 'We reject automating the whole line in parallel: the classic path to budget overrun and disappointment — without a finished first deployment the team never earns the maintenance pattern.',
    },
    expectedImpact: lead.economic.withinThreshold ? 'high' : 'medium',
    estimatedEffort: lead.technical.score >= 3 ? 'low' : lead.technical.score >= 2 ? 'medium' : 'high',
    validation: VALID,
  });

  // 3. Surface the highest-ranked HYBRID split explicitly, if one exists and is
  //    not already the lead — it is often the optimal economic outcome and goes
  //    straight to the initiative register as a bounded, credible project.
  const hybrid = feasibilities.find((f) => f.verdict === 'hybrid' && f.id !== leadId);
  if (hybrid) {
    moves.push({
      order: order++,
      operationId: hybrid.id,
      verdict: 'hybrid',
      title: {
        pl: `Zaprojektuj hybrydę na „${hybrid.label}" (robot rdzeń, człowiek ogon)`,
        en: `Design a hybrid on "${hybrid.label}" (robot core, human tail)`,
      },
      rationale: hybrid.rationale,
      tradeOff: {
        pl: 'Kosztem rezygnacji z pełnej automatyzacji linii — akceptujecie operatora na wariantach niestandardowych w zamian za wiarygodny, ograniczony zakres zamiast ryzykownego „wielkiego" projektu.',
        en: 'At the cost of foregoing full line automation — you accept an operator on non-standard variants in exchange for a credible, bounded scope instead of a risky "big" project.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy zakup uniwersalnego chwytaka + vision pod pełny miks: koszt elastyczności na całą zmienność zjada oszczędność z automatyzacji szybciej, niż ją tworzy.',
        en: 'We reject buying a universal gripper + vision for the full mix: the cost of flexibility across all variability eats the automation saving faster than it creates it.',
      },
      expectedImpact: 'high',
      estimatedEffort: 'medium',
      validation: VALID,
    });
  }

  // 4. Always make the integration line + safety re-assessment explicit — the two
  //    doctrine costs clients systematically omit, which turn a good pitch into a
  //    1.5-2x-longer real payback and a hidden compliance/accident risk.
  const cobotRisk = feasibilities.some((f) => f.drivers.cobotChangeRisk);
  moves.push({
    order: order++,
    operationId: leadId,
    verdict: lead.verdict,
    title: {
      pl: 'Wydziel integrację i re-ocenę bezpieczeństwa jako jawne linie business case',
      en: 'Break integration and safety re-assessment out as explicit business-case lines',
    },
    rationale: {
      pl: `Integracja to 20-40% ceny hardware\'u (tu doliczona) — pominięta wydłuża realny payback 1,5-2x względem pitchu dostawcy.${cobotRisk ? ' Reżim cobota + wysoka zmienność wymaga POWTARZALNEJ oceny zgodności przy każdej zmianie wariantu (ISO 10218:2025) — to koszt operacyjny i ryzyko wypadku, nie formalność.' : ''}`,
      en: `Integration is 20-40% of the hardware price (added here) — omitted, it lengthens real payback 1.5-2x versus the supplier pitch.${cobotRisk ? ' The cobot regime + high variability demands RECURRING conformity assessment on every variant change (ISO 10218:2025) — an operating cost and accident risk, not a formality.' : ''}`,
    },
    tradeOff: {
      pl: 'Kosztem wyższego, ale prawdziwego CAPEX na papierze — w zamian za business case, który się obroni po fakcie, a nie rozjedzie z rzeczywistością po podpisaniu kontraktu.',
      en: 'At the cost of a higher but truthful CAPEX on paper — in exchange for a business case that holds up after the fact rather than diverging from reality once the contract is signed.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy kalkulację z ceny katalogowej robota: zagregowany CAPEX bez linii „integracja" i „bezpieczeństwo" to najczęstsza przyczyna, że payback wychodzi dłuższy niż w ofercie.',
      en: 'We reject costing from the robot\'s catalogue price: an aggregated CAPEX without an "integration" and "safety" line is the top reason payback comes out longer than the quote.',
    },
    expectedImpact: 'medium',
    estimatedEffort: 'low',
    validation: VALID,
  });

  return moves;
}

/**
 * One-shot synthesis: baseline + ranking + W2 sequence, ready for the UI or the
 * AI fallback. Pure and deterministic.
 */
export function synthesizeRoboticsFeasibility(session: RoboticsSession): {
  baseline: RoboticsBaseline;
  ranking: RoboticsRanking;
  sequence: SequencedMove[];
} {
  return {
    baseline: computeBaseline(session),
    ranking: rankOperations(session),
    sequence: buildW2MoveSequence(session),
  };
}

/** Flatten a SequencedMove into a localized, store-agnostic move summary. */
export function localizeMove(
  seq: SequencedMove,
  isPolish: boolean
): { title: string; rationale: string; operationId: string } {
  return {
    title: localize(seq.title, isPolish),
    rationale: `${localize(seq.rationale, isPolish)} ${localize(seq.tradeOff, isPolish)} ${localize(
      seq.rejectedVariant,
      isPolish
    )}`.trim(),
    operationId: seq.operationId,
  };
}

// ---------------------------------------------------------------------------
// Adapter: OperationalToolData sections -> RoboticsSession (defensive)
// ---------------------------------------------------------------------------

const asNumber = (raw: unknown): number | undefined =>
  typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;

const asLevelOpt = (raw: unknown): Level | undefined =>
  raw === 'high' || raw === 'medium' || raw === 'low' ? raw : undefined;

const asTrend = (raw: unknown): VolumeTrend | undefined =>
  raw === 'rising' || raw === 'stable' || raw === 'falling' ? raw : undefined;

const asRegime = (raw: unknown): SafetyRegime | undefined =>
  raw === 'fenced' || raw === 'cobot' ? raw : raw === 'unknown' ? 'unknown' : undefined;

/** Coerce a raw share into 0..1; accepts a fraction or a 0..100 percentage. */
const asShare = (raw: unknown): number | undefined => {
  const n = asNumber(raw);
  if (n === undefined) return undefined;
  const share = n > 1 ? n / 100 : n;
  return Math.min(1, Math.max(0, share));
};

const truthyStable = (raw: unknown): boolean | undefined => {
  if (raw === true || (typeof raw === 'string' && /stable|stabil|yes|true/i.test(raw))) return true;
  if (raw === false || (typeof raw === 'string' && /unstable|niestabil|no|false/i.test(raw))) return false;
  return undefined;
};

/**
 * Extract a RoboticsSession from the operational tool's `sections`. Reads the
 * `operations` (or `candidates`) section defensively; unknown fields fall back to
 * undefined (never throw). All numeric business-case fields are optional so the
 * engine can price a partial case and report what is missing.
 */
export function toRoboticsSession(sections: Record<string, unknown[]> | undefined): RoboticsSession {
  const rawOps = ((sections?.['operations'] || sections?.['candidates'] || []) as unknown[]) as Array<
    Record<string, unknown>
  >;

  const operations: OperationCandidate[] = rawOps.map((item, idx) => {
    const op: OperationCandidate = {
      id: String(item.id ?? `op-${idx}`),
      label: typeof item.label === 'string' ? item.label : typeof item.title === 'string' ? (item.title as string) : undefined,
      repeatability: asLevelOpt(item.repeatability),
      structuredEnv: asLevelOpt(item.structuredEnv),
      gripSolvability: asLevelOpt(item.gripSolvability),
      processStable: truthyStable(item.processStable),
      shifts: asNumber(item.shifts),
      fteReduced: asNumber(item.fteReduced),
      annualCostPerFte: asNumber(item.annualCostPerFte),
      cycleTimeManualSec: asNumber(item.cycleTimeManualSec),
      cycleTimeRobotSec: asNumber(item.cycleTimeRobotSec),
      annualVolume: asNumber(item.annualVolume),
      hardwareCost: asNumber(item.hardwareCost),
      safetyCost: asNumber(item.safetyCost),
      integrationOverhead: asShare(item.integrationOverhead),
      robotOpexAnnual: asNumber(item.robotOpexAnnual),
      turnoverSavingAnnual: asNumber(item.turnoverSavingAnnual),
      ergonomicsSavingAnnual: asNumber(item.ergonomicsSavingAnnual),
      volumeTrend: asTrend(item.volumeTrend),
      variability: asLevelOpt(item.variability),
      topVariantShare: asShare(item.topVariantShare),
      safetyRegime: asRegime(item.safetyRegime),
      strategicPressure: asLevelOpt(item.strategicPressure),
    };
    // "measured" is derived: a case is measured when the numerator (fte × cost)
    // and denominator (hardware) inputs of the payback are present.
    op.measured =
      truthyStable(item.measured) ??
      ((op.fteReduced ?? 0) > 0 && (op.annualCostPerFte ?? 0) > 0 && (op.hardwareCost ?? 0) > 0);
    return op;
  });

  return { operations };
}
