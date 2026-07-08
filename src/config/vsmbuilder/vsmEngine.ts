/**
 * VSM Builder — deterministic synthesis engine + W2 move validator.
 *
 * The pure, testable brain of the tool. It reads the VSM session (process steps
 * with time boxes + candidate kaizen moves) and produces:
 *
 *   1. a baseline of the value stream — the CORE VSM math from the doctrine:
 *        - PCE = value-add time / total lead time  (doctrine §5.1)
 *        - the TRUE constraint located by queue/WIP & uptime, not the longest
 *          step (doctrine §5.2)
 *        - the 7-muda / value-add split and the pure-waste share (doctrine §5.5)
 *        - the hidden rework factory from %C&A < 100% (doctrine §5.4)
 *   2. a per-lever readiness score (flow / bottleneck / waste / rework) derived
 *      from the facts (step coverage, measurement, impact, evidence)
 *   3. a ranking of the four levers with a plain rationale, in a disciplined
 *      order (you cannot locate a constraint before the flow is mapped)
 *   4. a W2-validated kaizen move sequence, where every move carries:
 *        - rationale        (why do this now)
 *        - tradeOff         (what it costs you / what you give up)
 *        - rejectedVariant  (the alternative deliberately NOT taken, and why)
 *
 * The W2 validator is the near-literal transfer of the Inventory/SMED/Ansoff
 * "move must justify itself" contract: a move is only VALID when all three
 * fields are present and non-trivial.
 *
 * This layer is self-contained: it depends only on a minimal read-model of the
 * VSM session (VsmSession), not on the full store, so it compiles and tests in
 * isolation.
 */

import {
  VSM_LEVERS,
  vsmLeverLabel,
  type Bilingual,
  type VsmLeverId,
} from './deepeningLadder';

type Level = 'high' | 'medium' | 'low';

const LEVEL_SCORE: Record<Level, number> = { high: 3, medium: 2, low: 1 };

/** Value classification of the time inside a process step (doctrine §4 krok 2). */
export type StepValueType = 'value-add' | 'necessary-nva' | 'pure-waste';

/** The 7 (+1) muda categories of the Toyota Production System (doctrine §4). */
export type MudaType =
  | 'overproduction'
  | 'waiting'
  | 'transport'
  | 'over-processing'
  | 'inventory'
  | 'motion'
  | 'defects'
  | 'unused-talent';

/** Bilingual labels for the 7 (+1) muda, so the waste insight can name the type. */
export const MUDA_LABEL: Record<MudaType, Bilingual> = {
  overproduction: { pl: 'nadprodukcja', en: 'overproduction' },
  waiting: { pl: 'oczekiwanie', en: 'waiting' },
  transport: { pl: 'transport', en: 'transport' },
  'over-processing': { pl: 'nadmierne przetwarzanie', en: 'over-processing' },
  inventory: { pl: 'zapas', en: 'inventory' },
  motion: { pl: 'ruch', en: 'motion' },
  defects: { pl: 'wady/przeróbki', en: 'defects' },
  'unused-talent': { pl: 'niewykorzystany potencjał ludzi', en: 'unused talent' },
};

export const mudaLabel = (muda: MudaType): Bilingual => MUDA_LABEL[muda];

/**
 * Minimal read-model of one process step (a process box + its data box).
 * Sourced from the tool's `steps` section. Times are in a single consistent
 * unit chosen by the session (e.g. minutes) — the engine only takes ratios and
 * sums, so it is unit-agnostic as long as C/T and L/T share a unit.
 */
export interface ProcessStep {
  id: string;
  /** Cycle Time — actual hands-on work time on one unit. */
  cycleTime?: number;
  /** Lead Time — time from a unit entering the step to leaving it, queue included. */
  leadTime?: number;
  /** WIP / queue waiting BEFORE this step (units or days) — the constraint signal. */
  wipBefore?: number;
  /** Resource availability 0..1 (fraction of time the resource can work this step). */
  uptime?: number;
  /** % Complete & Accurate 0..1 — share of units passing on with no correction. */
  completeAccurate?: number;
  /** FTE assigned to this step. */
  fte?: number;
  /** How the step's time is classified against value. */
  valueType?: StepValueType;
  /** For non-value steps, which muda it is (informational; drives insight text). */
  muda?: MudaType;
  /** Whether the step's numbers are measured on gemba (true) or estimated. */
  measured?: boolean;
}

/** Minimal read-model of one kaizen-move candidate from the `moves` section. */
export interface KaizenMoveItem {
  id: string;
  /** Which VSM lever the move primarily belongs to. */
  lever?: VsmLeverId;
  impact?: Level;
  effort?: Level;
  /** Evidence backing the move (gemba measurement, follow-one-piece, data pull). */
  evidence?: string[];
}

/** The minimal VSM session shape the engine reads. */
export interface VsmSession {
  steps: ProcessStep[];
  moves: KaizenMoveItem[];
  /** Optional framing: customer demand in the period (drives takt time). */
  demand?: number;
  /** Optional framing: monthly volume of units flowing (drives the hidden-factory cost). */
  monthlyVolume?: number;
  /**
   * Optional framing: available working time in the period, same unit as C/T
   * (e.g. minutes). With `demand`, yields takt time = availableTime / demand
   * (doctrine §3.3).
   */
  availableTime?: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const round2 = (value: number) => Math.round(value * 100) / 100;
/** 4-dp fraction — keeps sub-percent PCE precision (1.6% must not collapse to 2%). */
const round4 = (value: number) => Math.round(value * 10000) / 10000;

/**
 * Render a 0..1 fraction as a percent string with up to one decimal, so a PCE
 * of 0.0159 reads "1.6" (the doctrine's flagship number) rather than "2".
 */
export const formatPcePercent = (fraction: number): string => {
  const value = Math.round(fraction * 1000) / 10;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};
const asLevel = (value: unknown, fallback: Level = 'medium'): Level =>
  value === 'high' || value === 'medium' || value === 'low' ? value : fallback;
const localize = (text: Bilingual, isPolish: boolean) => (isPolish ? text.pl : text.en);

/** Value-add time of a step: its C/T only when the step adds value. */
const valueAddTime = (s: ProcessStep): number =>
  s.valueType === 'value-add' ? s.cycleTime || 0 : 0;

/** Effective lead time contribution of a step: its L/T, falling back to C/T. */
const stepLeadTime = (s: ProcessStep): number =>
  typeof s.leadTime === 'number' ? s.leadTime : s.cycleTime || 0;

// ---------------------------------------------------------------------------
// Baseline — the core VSM math (PCE, constraint, waste, hidden factory)
// ---------------------------------------------------------------------------

/** The located constraint and why it is the constraint (queue-first, not longest-step). */
export interface ConstraintFinding {
  stepId: string | null;
  /** WIP piled up before the constraint (the primary visual signal). */
  wipBefore: number;
  /** The constraint's uptime, if known. */
  uptime?: number;
  /** Share of the whole stream's lead time that sits in this one step, 0..1. */
  leadTimeShare: number;
  /**
   * The step with the LONGEST cycle time — the intuitive "culprit". Surfaced so
   * the engine can point out when the real constraint differs from it.
   */
  longestCycleStepId: string | null;
  /** True when the true constraint is NOT the longest-C/T step (the classic trap). */
  differsFromIntuition: boolean;
}

/** The hidden rework factory: cost of %C&A < 100% (doctrine §5.4). */
export interface HiddenFactory {
  /** Worst-offending step (lowest %C&A among measured steps). */
  worstStepId: string | null;
  /** That step's return rate, 1 − %C&A, 0..1. */
  worstReturnRate: number;
  /**
   * Rework units per month = sum over steps of (1 − %C&A) × monthlyVolume.
   * Only computed when a monthlyVolume is supplied; otherwise 0.
   */
  reworkUnitsPerMonth: number;
  /**
   * Rework cost proxy in FTE-time units/month = sum of (1 − %C&A) × volume × C/T.
   * Same unit as C/T (e.g. minutes) × units; 0 when volume unknown.
   */
  reworkTimePerMonth: number;
}

/** The headline value-stream facts: efficiency, constraint, waste and rework. */
export interface VsmBaseline {
  stepCount: number;
  /** Sum of value-add time (VA steps' C/T). */
  valueAddTime: number;
  /** Total lead time of the stream (sum of per-step L/T). */
  totalLeadTime: number;
  /** Process Cycle Efficiency = valueAddTime / totalLeadTime, 0..1. */
  pce: number;
  /** Human band for the PCE per doctrine §5.1 thresholds. */
  pceBand: 'untransformed' | 'managed' | 'lean' | 'world-class' | 'unknown';
  /** Share of steps that are pure waste, 0..1. */
  pureWasteShare: number;
  /** Number of steps classified as pure waste. */
  pureWasteCount: number;
  /** Total lead time sitting in pure-waste steps. */
  pureWasteLeadTime: number;
  /** Share of steps whose numbers are measured on gemba, 0..1. */
  measuredRatio: number;
  /**
   * Takt time = availableTime / demand (same unit as C/T), or null when the
   * demand/available-time framing is not supplied (doctrine §3.3).
   */
  taktTime: number | null;
  /**
   * Steps whose cycle time exceeds takt time — they cannot keep pace with
   * demand on their own (empty when takt is unknown or every step is under it).
   */
  overTaktStepIds: string[];
  /** Count of pure-waste steps per muda type (doctrine §4 krok 2 — the 7 muda). */
  wasteByMuda: Partial<Record<MudaType, number>>;
  /** The most frequent muda among the pure-waste steps, or null when none tagged. */
  dominantMuda: MudaType | null;
  /** The located constraint. */
  constraint: ConstraintFinding;
  /** The hidden rework factory. */
  hiddenFactory: HiddenFactory;
}

/** Map a PCE fraction to the doctrine §5.1 band. */
const pceBandOf = (pce: number, hasData: boolean): VsmBaseline['pceBand'] => {
  if (!hasData) return 'unknown';
  if (pce > 0.4) return 'world-class';
  if (pce > 0.25) return 'lean';
  if (pce >= 0.1) return 'managed';
  return 'untransformed';
};

/** Locate the TRUE constraint: max WIP-before first, then lowest uptime (doctrine §5.2). */
const locateConstraint = (steps: ProcessStep[], totalLeadTime: number): ConstraintFinding => {
  const longest = steps.reduce<ProcessStep | null>(
    (best, s) => ((s.cycleTime || 0) > (best?.cycleTime || 0) ? s : best),
    null
  );

  if (steps.length === 0) {
    return {
      stepId: null,
      wipBefore: 0,
      leadTimeShare: 0,
      longestCycleStepId: null,
      differsFromIntuition: false,
    };
  }

  // Primary signal: largest queue/WIP before the step. Tie-break: lowest uptime.
  const anyWip = steps.some((s) => (s.wipBefore || 0) > 0);
  let constraint: ProcessStep;
  if (anyWip) {
    constraint = steps.reduce((best, s) =>
      (s.wipBefore || 0) > (best.wipBefore || 0) ? s : best
    );
  } else {
    // No WIP data: fall back to the lowest-uptime step (the resource least
    // available relative to demand), then the longest L/T.
    const anyUptime = steps.some((s) => typeof s.uptime === 'number');
    constraint = anyUptime
      ? steps.reduce((best, s) =>
          (s.uptime ?? 1) < (best.uptime ?? 1) ? s : best
        )
      : steps.reduce((best, s) => (stepLeadTime(s) > stepLeadTime(best) ? s : best));
  }

  const leadTimeShare =
    totalLeadTime > 0 ? round2(stepLeadTime(constraint) / totalLeadTime) : 0;

  return {
    stepId: constraint.id,
    wipBefore: constraint.wipBefore || 0,
    uptime: constraint.uptime,
    leadTimeShare,
    longestCycleStepId: longest?.id ?? null,
    differsFromIntuition: !!longest && longest.id !== constraint.id,
  };
};

/** Compute the hidden rework factory from %C&A across the stream (doctrine §5.4). */
const computeHiddenFactory = (steps: ProcessStep[], monthlyVolume?: number): HiddenFactory => {
  const withCA = steps.filter((s) => typeof s.completeAccurate === 'number');
  if (withCA.length === 0) {
    return { worstStepId: null, worstReturnRate: 0, reworkUnitsPerMonth: 0, reworkTimePerMonth: 0 };
  }

  const worst = withCA.reduce((w, s) =>
    (s.completeAccurate ?? 1) < (w.completeAccurate ?? 1) ? s : w
  );
  const worstReturnRate = round2(1 - (worst.completeAccurate ?? 1));

  const volume = monthlyVolume && monthlyVolume > 0 ? monthlyVolume : 0;
  const reworkUnitsPerMonth = volume
    ? round1(withCA.reduce((acc, s) => acc + (1 - (s.completeAccurate ?? 1)) * volume, 0))
    : 0;
  const reworkTimePerMonth = volume
    ? round1(
        withCA.reduce(
          (acc, s) => acc + (1 - (s.completeAccurate ?? 1)) * volume * (s.cycleTime || 0),
          0
        )
      )
    : 0;

  return { worstStepId: worst.id, worstReturnRate, reworkUnitsPerMonth, reworkTimePerMonth };
};

export function computeBaseline(session: VsmSession): VsmBaseline {
  const steps = session.steps;
  const valueAdd = steps.reduce((acc, s) => acc + valueAddTime(s), 0);
  const totalLeadTime = steps.reduce((acc, s) => acc + stepLeadTime(s), 0);
  const hasTiming = totalLeadTime > 0;
  const pce = hasTiming ? round4(valueAdd / totalLeadTime) : 0;

  const pureWasteSteps = steps.filter((s) => s.valueType === 'pure-waste');
  const pureWasteLeadTime = pureWasteSteps.reduce((acc, s) => acc + stepLeadTime(s), 0);
  const measured = steps.filter((s) => s.measured).length;

  // Takt time = available working time / customer demand (doctrine §3.3). Steps
  // whose C/T exceeds takt cannot keep pace with demand by themselves.
  const taktTime =
    session.demand && session.demand > 0 && session.availableTime && session.availableTime > 0
      ? round1(session.availableTime / session.demand)
      : null;
  const overTaktStepIds =
    taktTime !== null ? steps.filter((s) => (s.cycleTime || 0) > taktTime).map((s) => s.id) : [];

  // 7-muda breakdown of the pure-waste steps (doctrine §4 krok 2).
  const wasteByMuda: Partial<Record<MudaType, number>> = {};
  for (const s of pureWasteSteps) {
    if (s.muda) wasteByMuda[s.muda] = (wasteByMuda[s.muda] || 0) + 1;
  }
  let dominantMuda: MudaType | null = null;
  let dominantCount = 0;
  (Object.entries(wasteByMuda) as [MudaType, number][]).forEach(([muda, count]) => {
    if (count > dominantCount) {
      dominantCount = count;
      dominantMuda = muda;
    }
  });

  return {
    stepCount: steps.length,
    valueAddTime: round1(valueAdd),
    totalLeadTime: round1(totalLeadTime),
    pce,
    pceBand: pceBandOf(pce, hasTiming),
    pureWasteShare: steps.length > 0 ? round2(pureWasteSteps.length / steps.length) : 0,
    pureWasteCount: pureWasteSteps.length,
    pureWasteLeadTime: round1(pureWasteLeadTime),
    measuredRatio: steps.length > 0 ? round1(measured / steps.length) : 0,
    taktTime,
    overTaktStepIds,
    wasteByMuda,
    dominantMuda,
    constraint: locateConstraint(steps, totalLeadTime),
    hiddenFactory: computeHiddenFactory(steps, session.monthlyVolume),
  };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface LeverScore {
  lever: VsmLeverId;
  label: Bilingual;
  /** Kaizen-move candidates attributed to this lever. */
  moveCount: number;
  /** Lead time (or rework/waste exposure) this lever can act on. */
  leadTimeInScope: number;
  /** Mean impact of this lever's moves, 1..3. */
  attractiveness: number;
  /** Ease of pulling it off (low effort + evidence), 1..3. */
  feasibility: number;
  /** attractiveness × feasibility, 1..9. */
  score: number;
  /** Count of moves carrying at least one evidence item. */
  evidenceBacked: number;
}

/** Lead time (or waste/rework exposure) a lever can act on, from the step facts. */
const leadTimeForLever = (
  lever: VsmLeverId,
  session: VsmSession,
  baseline: VsmBaseline
): number => {
  switch (lever) {
    case 'flow':
      // mapping/timing governs the whole stream
      return baseline.totalLeadTime;
    case 'bottleneck':
      // the constraint lever acts on the lead time trapped in the constraint step
      return round1(baseline.totalLeadTime * baseline.constraint.leadTimeShare);
    case 'waste':
      // waste elimination acts on the lead time held in pure-waste steps
      return baseline.pureWasteLeadTime;
    case 'rework':
      // rework acts on the hidden-factory time; fall back to worst-step lead time
      return baseline.hiddenFactory.reworkTimePerMonth > 0
        ? baseline.hiddenFactory.reworkTimePerMonth
        : round1(baseline.totalLeadTime * baseline.hiddenFactory.worstReturnRate);
    default:
      return 0;
  }
};

const scoreLever = (
  lever: VsmLeverId,
  session: VsmSession,
  baseline: VsmBaseline
): LeverScore => {
  const label = vsmLeverLabel(lever);
  const moves = session.moves.filter((m) => m.lever === lever);
  const leadTimeInScope = round1(leadTimeForLever(lever, session, baseline));

  if (moves.length === 0) {
    return {
      lever,
      label,
      moveCount: 0,
      leadTimeInScope,
      attractiveness: 0,
      feasibility: 0,
      score: 0,
      evidenceBacked: 0,
    };
  }

  const impactAvg = moves.reduce((sum, m) => sum + LEVEL_SCORE[asLevel(m.impact)], 0) / moves.length;
  const effortAvg = moves.reduce((sum, m) => sum + LEVEL_SCORE[asLevel(m.effort)], 0) / moves.length;
  const evidenceBacked = moves.filter((m) => (m.evidence?.length || 0) > 0).length;
  const evidenceRatio = evidenceBacked / moves.length;

  const effortEase = 4 - effortAvg; // 1..3, low effort scores high
  const feasibility = clamp(round1(effortEase * 0.6 + evidenceRatio * 2 * 0.4 + 0.4), 0.5, 3);
  const attractiveness = round1(impactAvg);
  const score = round1(attractiveness * feasibility);

  return {
    lever,
    label,
    moveCount: moves.length,
    leadTimeInScope,
    attractiveness,
    feasibility,
    score,
    evidenceBacked,
  };
};

export interface LeverRanking {
  scores: LeverScore[];
  /** levers ordered best-first among those with at least one move. */
  ordered: VsmLeverId[];
  rationale: Bilingual;
}

/**
 * Rank the four VSM levers. Only levers with move candidates are ranked; empty
 * levers are reported with score 0 but excluded from `ordered`. Ties break
 * toward the canonical order (flow before bottleneck before waste before
 * rework) so the sequence never recommends locating a constraint before the
 * flow that should reveal it has been mapped.
 */
export function rankLevers(session: VsmSession): LeverRanking {
  const baseline = computeBaseline(session);
  const scores = VSM_LEVERS.map((lever) => scoreLever(lever, session, baseline));
  const orderIndex = (l: VsmLeverId) => VSM_LEVERS.indexOf(l);

  const ordered = scores
    .filter((s) => s.moveCount > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.leadTimeInScope !== a.leadTimeInScope) return b.leadTimeInScope - a.leadTimeInScope;
      return orderIndex(a.lever) - orderIndex(b.lever);
    })
    .map((s) => s.lever);

  const top = scores.find((s) => s.lever === ordered[0]);
  const rationale: Bilingual = top
    ? {
        pl: `Najsilniejsza dźwignia to „${vsmLeverLabel(top.lever).pl.toLowerCase()}" (dopasowanie ${top.score}/9: atrakcyjność ${top.attractiveness} × wykonalność ${top.feasibility}), obejmująca ${top.leadTimeInScope} lead time. Sekwencja trzyma porządek: nie szukamy ograniczenia, zanim strumień nie jest zmapowany i zmierzony.`,
        en: `The strongest lever is "${vsmLeverLabel(top.lever).en.toLowerCase()}" (fit ${top.score}/9: attractiveness ${top.attractiveness} × feasibility ${top.feasibility}), covering ${top.leadTimeInScope} of lead time. The sequence keeps order: we do not hunt the constraint before the stream is mapped and timed.`,
      }
    : {
        pl: 'Brak kandydatów na ruchy — dodaj kroki procesu i ruchy kaizen w co najmniej jednej dźwigni, aby zbudować ranking.',
        en: 'No move candidates yet — add process steps and kaizen moves in at least one lever to build a ranking.',
      };

  return { scores, ordered, rationale };
}

// ---------------------------------------------------------------------------
// W2 move validator
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
  lever: VsmLeverId;
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

const pct = (fraction: number) => Math.round(fraction * 100);

/**
 * Build a W2-validated kaizen move sequence from the ranked levers. The rule of
 * the sequence (doctrine §4-§6): when the stream is under-measured, map/time
 * first — you cannot locate a constraint on a stream you have not timed; then
 * attack the TRUE constraint (not the longest step); surface the hidden rework
 * factory whenever %C&A exposes real returned work; and only then eliminate the
 * pure-waste steps, behind a stated trade-off about controls that must stay.
 */
export function buildW2MoveSequence(session: VsmSession): SequencedMove[] {
  const { scores, ordered } = rankLevers(session);
  if (ordered.length === 0) return [];

  const baseline = computeBaseline(session);
  const scoreOf = (l: VsmLeverId) => scores.find((s) => s.lever === l)!;
  const moves: SequencedMove[] = [];
  let order = 1;

  // If the stream is thin on measurement, map & time it first.
  if (baseline.measuredRatio < 0.5) {
    moves.push({
      order: order++,
      lever: 'flow',
      title: {
        pl: 'Najpierw zmapuj i zmierz strumień na gemba (current-state)',
        en: 'Map and time the stream on gemba first (current-state)',
      },
      rationale: {
        pl: `Tylko ${pct(baseline.measuredRatio)}% kroków jest zmierzonych — bez czasów z gemba (follow-one-piece) PCE i lokalizacja ograniczenia są zgadywaniem, a każdy kaizen optymalizuje krok wybrany intuicją, nie danymi.`,
        en: `Only ${pct(baseline.measuredRatio)}% of steps are measured — without gemba times (follow-one-piece) the PCE and constraint location are guesswork, and every kaizen optimizes a step chosen by intuition, not data.`,
      },
      tradeOff: {
        pl: 'Kosztem ~1 dnia warsztatu na miejscu i opóźnienia pierwszej interwencji, w zamian za pewność, gdzie realnie ginie lead time.',
        en: 'At the cost of ~1 day of on-site workshop and delaying the first intervention, in exchange for certainty about where lead time really vanishes.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „usprawnijmy od razu najgłośniejszy krok": mapa na szacunkach z pamięci to ilustracja, nie diagnostyka — bez liczb constraint bywa gdzie indziej niż intuicja.',
        en: 'We reject "just improve the loudest step now": a map built on remembered estimates is an illustration, not a diagnosis — without numbers the constraint is often elsewhere than intuition.',
      },
      expectedImpact: 'medium',
      estimatedEffort: 'low',
      validation: VALID,
    });
  }

  // Attack the true constraint — with an explicit correction of intuition when
  // the real constraint is not the longest-C/T step.
  const c = baseline.constraint;
  if (c.stepId) {
    moves.push({
      order: order++,
      lever: 'bottleneck',
      title: {
        pl: 'Udrożnij PRAWDZIWE ograniczenie, nie najdłuższy krok',
        en: 'Unblock the TRUE constraint, not the longest step',
      },
      rationale: c.differsFromIntuition
        ? {
            pl: `Ograniczenie to krok „${c.stepId}" — praca piętrzy się PRZED nim (WIP ${c.wipBefore}), a nie w kroku „${c.longestCycleStepId}", który tylko wygląda na winowajcę (najdłuższy czas pracy). W tym kroku siedzi ${pct(c.leadTimeShare)}% lead time strumienia.`,
            en: `The constraint is step "${c.stepId}" — work piles up BEFORE it (WIP ${c.wipBefore}), not in step "${c.longestCycleStepId}", which only looks like the culprit (longest work time). ${pct(c.leadTimeShare)}% of the stream's lead time sits in this step.`,
          }
        : {
            pl: `Ograniczenie to krok „${c.stepId}": największa kolejka przed wejściem (WIP ${c.wipBefore}) i ${pct(c.leadTimeShare)}% lead time strumienia — udrożnienie go skraca cały strumień, usprawnienie kroku obok nie zmienia przepustowości.`,
            en: `The constraint is step "${c.stepId}": the largest entry queue (WIP ${c.wipBefore}) and ${pct(c.leadTimeShare)}% of stream lead time — unblocking it shortens the whole stream, while improving a neighbouring step does not change throughput.`,
          },
      tradeOff: {
        pl: 'Kosztem skupienia zespołu na jednym kroku zamiast równoległej poprawy wszystkich — świadomie odkładacie pozostałe kroki, dopóki constraint nie ustąpi.',
        en: 'At the cost of focusing the team on one step instead of improving all in parallel — you deliberately defer the other steps until the constraint gives way.',
      },
      rejectedVariant: {
        pl: `Odrzucamy inwestycję w krok „${c.longestCycleStepId ?? 'najdłuższy'}" (drugą linię / więcej mocy): to optymalizacja nie-ograniczenia — koszt bez efektu na lead time, dopóki realny constraint nie zostanie ruszony.`,
        en: `We reject investing in step "${c.longestCycleStepId ?? 'the longest'}" (a second line / more capacity): that optimizes a non-constraint — cost with no effect on lead time until the real constraint is addressed.`,
      },
      expectedImpact: c.leadTimeShare >= 0.4 ? 'high' : c.leadTimeShare >= 0.2 ? 'medium' : 'low',
      estimatedEffort: 'medium',
      validation: VALID,
    });
  }

  // Surface the hidden rework factory whenever %C&A exposes real returned work.
  const hf = baseline.hiddenFactory;
  if (hf.worstStepId && hf.worstReturnRate > 0) {
    const costLine = hf.reworkTimePerMonth > 0;
    moves.push({
      order: order++,
      lever: 'rework',
      title: {
        pl: 'Domknij ukrytą fabrykę przeróbek u źródła błędu',
        en: 'Close the hidden rework factory at the source of the error',
      },
      rationale: {
        pl: `Krok „${hf.worstStepId}" przepuszcza ${pct(hf.worstReturnRate)}% pracy z powrotem do poprawki${costLine ? `, co kosztuje ~${hf.reworkTimePerMonth} jednostek-czasu/miesiąc` : ''} — koszt niewidoczny w raportach KPI, bo liczą output, nie zawroty.`,
        en: `Step "${hf.worstStepId}" sends ${pct(hf.worstReturnRate)}% of work back for correction${costLine ? `, costing ~${hf.reworkTimePerMonth} time-units/month` : ''} — a cost invisible in KPI reports, which count output, not returns.`,
      },
      tradeOff: {
        pl: 'Kosztem pracy nad walidacją u źródła (np. przy wprowadzaniu danych) zamiast dokładania kontroli na końcu — inwestycja z góry, żeby zlikwidować pętlę zwrotną.',
        en: 'At the cost of building validation at the source (e.g. at data entry) rather than adding an end-of-line inspection — an up-front investment to remove the return loop.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy dołożenie kolejnego kroku kontroli na końcu: wydłuża lead time i łapie błąd po fakcie, nie usuwając przyczyny — przeróbki wracają.',
        en: 'We reject adding another inspection step at the end: it lengthens lead time and catches the error after the fact without removing the cause — the rework returns.',
      },
      expectedImpact: hf.worstReturnRate >= 0.1 ? 'high' : 'medium',
      estimatedEffort: 'medium',
      validation: VALID,
    });
  }

  // Eliminate pure-waste steps — behind a stated trade-off about controls that
  // must stay, and only after the constraint and rework are addressed.
  const wasteScore = scoreOf('waste');
  moves.push({
    order: order++,
    lever: 'waste',
    title: {
      pl: 'Wyeliminuj kroki czystego marnotrawstwa (7 muda)',
      en: 'Eliminate the pure-waste steps (7 muda)',
    },
    rationale:
      baseline.pureWasteCount > 0
        ? {
            pl: `${baseline.pureWasteCount} z ${baseline.stepCount} kroków (${pct(baseline.pureWasteShare)}%) to czyste NVA trzymające ${baseline.pureWasteLeadTime} lead time${baseline.dominantMuda ? `, głównie ${mudaLabel(baseline.dominantMuda).pl}` : ''} — eliminacja podnosi PCE (dziś ${formatPcePercent(baseline.pce)}%) bez inwestycji kapitałowej.`,
            en: `${baseline.pureWasteCount} of ${baseline.stepCount} steps (${pct(baseline.pureWasteShare)}%) are pure NVA holding ${baseline.pureWasteLeadTime} of lead time${baseline.dominantMuda ? `, mostly ${mudaLabel(baseline.dominantMuda).en}` : ''} — eliminating them raises PCE (today ${formatPcePercent(baseline.pce)}%) with no capital spend.`,
          }
        : {
            pl: `Sklasyfikuj czas per krok na wartość dodaną / konieczne NVA / czyste muda — dopiero ta lista (przy PCE ${formatPcePercent(baseline.pce)}%) mówi, które kroki wolno wyciąć bez ryzyka.`,
            en: `Classify time per step into value-add / necessary NVA / pure muda — only that list (at PCE ${formatPcePercent(baseline.pce)}%) tells you which steps may be cut without risk.`,
          },
    tradeOff: {
      pl: 'Kosztem uwagi na to, by nie usunąć kontroli koniecznej (regulacja/ryzyko) — część NVA musi zostać, a jej cięcie tworzy przeróbki dalej w strumieniu.',
      en: 'At the cost of care not to remove a necessary control (regulation/risk) — some NVA must stay, and cutting it creates rework further downstream.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy hurtowe wycięcie wszystkich kroków bez wartości: podwójne zatwierdzenia bywają wymagane, a ślepe cięcie przenosi ryzyko na jakość i zgodność.',
      en: 'We reject cutting all non-value steps wholesale: double approvals are sometimes mandatory, and blind cutting shifts risk onto quality and compliance.',
    },
    expectedImpact:
      wasteScore.attractiveness >= 2.5 || baseline.pureWasteShare >= 0.3 ? 'high' : 'medium',
    estimatedEffort: 'low',
    validation: VALID,
  });

  // Each synthesized move is actually run through the W2 contract (not asserted):
  // a move is only marked valid when its rationale, trade-off and rejected
  // variant each carry substantial text, so the UI never renders an unjustified
  // move even if the copy above is later edited to be thin.
  moves.forEach((m) => {
    m.validation = validateW2Move({
      rationale: m.rationale.pl,
      tradeOff: m.tradeOff.pl,
      rejectedVariant: m.rejectedVariant.pl,
    });
  });

  return moves;
}

/**
 * One-shot synthesis: baseline + ranking + W2 sequence, ready for the UI or the
 * AI fallback. Pure and deterministic.
 */
export function synthesizeVsmPlan(session: VsmSession): {
  baseline: VsmBaseline;
  ranking: LeverRanking;
  sequence: SequencedMove[];
} {
  return {
    baseline: computeBaseline(session),
    ranking: rankLevers(session),
    sequence: buildW2MoveSequence(session),
  };
}

/** Flatten a SequencedMove into a localized, store-agnostic move summary. */
export function localizeMove(
  seq: SequencedMove,
  isPolish: boolean
): { title: string; rationale: string; lever: VsmLeverId } {
  return {
    title: localize(seq.title, isPolish),
    rationale: `${localize(seq.rationale, isPolish)} ${localize(seq.tradeOff, isPolish)} ${localize(
      seq.rejectedVariant,
      isPolish
    )}`.trim(),
    lever: seq.lever,
  };
}
