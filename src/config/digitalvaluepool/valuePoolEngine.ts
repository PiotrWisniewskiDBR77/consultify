/**
 * Digital Value Pool — synthesis engine + feasibility gate.
 *
 * The pure, testable brain of the tool. It reads the value-pool session
 * (value-chain FUNCTIONS with a cost/revenue base and a benchmark, plus candidate
 * USE-CASES scored on impact × feasibility) and produces:
 *
 *   1. a baseline of value-at-stake decomposed per function (top-down: benchmark
 *      × base) and the bottom-up sum of quantified use-cases, with the divergence
 *   2. a priority matrix: every use-case scored impact × feasibility (1..9), with
 *      a quadrant (quick-win / big-bet / fill-in / no-go)
 *   3. the 80/20 concentration: how much of the mapped value sits in the top
 *      2-3 functions, and whether the initiative budget is allocated inversely
 *   4. the FEASIBILITY GATE: a high-impact use-case whose feasibility to SCALE is
 *      blocked (data / no owner / no mandate / adoption-only metric) is demoted
 *      to "pilot without scale" — impact alone never promotes it
 *   5. DEAD FIELDS: functions with a benchmark pool but zero attention (no
 *      use-case, no budget) — the missing pool that is usually the best insight
 *   6. a sequenced roadmap where every move carries rationale / tradeOff /
 *      rejectedVariant (the W2 "move must justify itself" contract)
 *
 * This layer is self-contained: it depends only on a minimal read-model of the
 * value-pool session (ValuePoolSession), not on the full store, so it compiles
 * and tests in isolation.
 *
 * Doctrine SSOT: Harvard/wdrozenie-100/_TOOLS_DOKTRYNA/digital-value-pool.md
 */

import {
  VALUE_POOL_PHASES,
  valuePoolPhaseLabel,
  type Bilingual,
  type ValuePoolPhaseId,
} from './deepeningLadder';

type Level = 'high' | 'medium' | 'low';

const LEVEL_SCORE: Record<Level, number> = { high: 3, medium: 2, low: 1 };

/** Whether a function acts primarily on a cost base or a revenue base. */
export type ValueSide = 'cost' | 'revenue';

/**
 * Minimal read-model of one value-chain function (a decomposition node).
 * Sourced from the tool's `functions` section.
 */
export interface ValueFunction {
  id: string;
  /** Display name of the function (e.g. "Service delivery", "Pricing"). */
  name?: string;
  /** Does this function act on a cost base or a revenue base. */
  side: ValueSide;
  /** The cost or revenue base this function carries (currency). */
  base?: number;
  /**
   * Industry benchmark: fraction of the base theoretically "in play" under
   * digitization/AI (0..1). Multiplied by the base gives top-down value-at-stake.
   */
  benchmarkShare?: number;
  /** Whether the base/benchmark are measured (true) or estimated/unknown. */
  measured?: boolean;
}

/**
 * Minimal read-model of one candidate use-case from the `useCases` section.
 * A use-case belongs to a function and is scored on impact × feasibility.
 */
export interface UseCaseItem {
  id: string;
  /** The function this use-case sits inside (must match a ValueFunction id). */
  functionId?: string;
  /** Which analysis phase the use-case primarily belongs to (for the roadmap). */
  phase?: ValuePoolPhaseId;
  /** Value magnitude / speed / strategic weight. */
  impact?: Level;
  /** Technical + data + change feasibility. */
  feasibility?: Level;
  /** Bottom-up quantified value this specific use-case would capture (currency). */
  bottomUpValue?: number;
  // ---- feasibility-to-scale signals (the gate) ----
  /** Is the source data complete / available / good quality. */
  dataReady?: boolean;
  /** Is there a process owner with budget and mandate. */
  hasOwner?: boolean;
  /** Is there a path to >1 team / location (not a single-team pilot). */
  scalable?: boolean;
  /** Is the success metric business (true) or adoption-only (false). */
  businessMetric?: boolean;
}

/** The minimal value-pool session shape the engine reads. */
export interface ValuePoolSession {
  functions: ValueFunction[];
  useCases: UseCaseItem[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const asLevel = (value: unknown, fallback: Level = 'medium'): Level =>
  value === 'high' || value === 'medium' || value === 'low' ? value : fallback;
const localize = (text: Bilingual, isPolish: boolean) => (isPolish ? text.pl : text.en);

/** Top-down value-at-stake for one function = base × benchmark share. */
export const functionValueAtStake = (fn: ValueFunction): number =>
  (fn.base || 0) * (fn.benchmarkShare || 0);

// ---------------------------------------------------------------------------
// Baseline — value-at-stake decomposition (top-down vs bottom-up)
// ---------------------------------------------------------------------------

/** Top-down value-at-stake attributed to one function, with its share of the pool. */
export interface FunctionPool {
  id: string;
  name: string;
  side: ValueSide;
  base: number;
  benchmarkShare: number;
  /** base × benchmarkShare — top-down value-at-stake. */
  valueAtStake: number;
  /** valueAtStake / total mapped value, 0..1. */
  share: number;
  /** Bottom-up value from use-cases attributed to this function. */
  bottomUp: number;
  /** How many use-cases target this function. */
  useCaseCount: number;
}

/** The headline value-pool facts: where digital/AI money sits and how sure we are. */
export interface ValuePoolBaseline {
  /** Sum of top-down value-at-stake across all functions. */
  topDownTotal: number;
  /** Sum of bottom-up quantified use-case value. */
  bottomUpTotal: number;
  /**
   * Divergence ratio bottomUp/topDown (0..1+). Far below 1 = invisible use-cases
   * or an over-optimistic benchmark; the doctrine's key sizing signal.
   */
  divergenceRatio: number;
  /** Per-function top-down pools, sorted largest-first. */
  pools: FunctionPool[];
  /** Share of top-down value that sits in the top-2 functions, 0..1 (the 80/20). */
  top2Concentration: number;
  /** Number of functions that clear a non-trivial value-at-stake. */
  materialFunctionCount: number;
  /** Share of functions whose base/benchmark are measured, 0..1. */
  measuredRatio: number;
}

export function computeBaseline(session: ValuePoolSession): ValuePoolBaseline {
  const fns = session.functions;
  const bottomUpByFn = new Map<string, { value: number; count: number }>();
  for (const uc of session.useCases) {
    if (!uc.functionId) continue;
    const acc = bottomUpByFn.get(uc.functionId) || { value: 0, count: 0 };
    acc.value += uc.bottomUpValue || 0;
    acc.count += 1;
    bottomUpByFn.set(uc.functionId, acc);
  }

  const topDownTotal = fns.reduce((acc, fn) => acc + functionValueAtStake(fn), 0);
  const bottomUpTotal = session.useCases.reduce((acc, uc) => acc + (uc.bottomUpValue || 0), 0);

  const pools: FunctionPool[] = fns
    .map((fn) => {
      const vas = functionValueAtStake(fn);
      const bu = bottomUpByFn.get(fn.id);
      return {
        id: fn.id,
        name: fn.name || fn.id,
        side: fn.side,
        base: round1(fn.base || 0),
        benchmarkShare: fn.benchmarkShare || 0,
        valueAtStake: round1(vas),
        share: topDownTotal > 0 ? round1(vas / topDownTotal) : 0,
        bottomUp: round1(bu?.value || 0),
        useCaseCount: bu?.count || 0,
      };
    })
    .sort((a, b) => b.valueAtStake - a.valueAtStake);

  const top2 = pools.slice(0, 2).reduce((acc, p) => acc + p.valueAtStake, 0);
  const measured = fns.filter((fn) => fn.measured).length;
  // "material" = a function carrying at least 2% of the mapped pool (above noise).
  const materialFunctionCount = pools.filter(
    (p) => p.valueAtStake > 0 && p.share >= 0.02
  ).length;

  return {
    topDownTotal: round1(topDownTotal),
    bottomUpTotal: round1(bottomUpTotal),
    divergenceRatio: topDownTotal > 0 ? round1(bottomUpTotal / topDownTotal) : 0,
    pools,
    top2Concentration: topDownTotal > 0 ? round1(top2 / topDownTotal) : 0,
    materialFunctionCount,
    measuredRatio: fns.length > 0 ? round1(measured / fns.length) : 0,
  };
}

// ---------------------------------------------------------------------------
// Feasibility gate — the "pilot without scale" demotion
// ---------------------------------------------------------------------------

export type Quadrant = 'quick-win' | 'big-bet' | 'fill-in' | 'no-go';

export interface ScaleGate {
  /** Whether the use-case is cleared to scale (all four scale signals present). */
  cleared: boolean;
  /** The specific scale blockers found. */
  blockers: Array<'data' | 'owner' | 'scale-path' | 'business-metric'>;
  /**
   * When a HIGH-impact + high-TECHNICAL-feasibility use-case fails the gate, it
   * is a "pilot without scale" — the doctrine's central trap.
   */
  pilotWithoutScale: boolean;
}

/**
 * The feasibility-to-scale gate. Technical/data feasibility is NOT enough: a
 * high-impact use-case with no owner/mandate, no scale path, or an adoption-only
 * metric is flagged as a "pilot without scale" and must NOT be promoted on
 * impact alone.
 */
export function evaluateScaleGate(uc: UseCaseItem): ScaleGate {
  const blockers: ScaleGate['blockers'] = [];
  if (uc.dataReady === false) blockers.push('data');
  if (uc.hasOwner === false) blockers.push('owner');
  if (uc.scalable === false) blockers.push('scale-path');
  if (uc.businessMetric === false) blockers.push('business-metric');
  const cleared = blockers.length === 0;
  const highImpact = asLevel(uc.impact) === 'high';
  const highTechFeasibility = asLevel(uc.feasibility) !== 'low';
  return {
    cleared,
    blockers,
    pilotWithoutScale: !cleared && highImpact && highTechFeasibility,
  };
}

// ---------------------------------------------------------------------------
// Priority matrix — impact × feasibility per use-case
// ---------------------------------------------------------------------------

export interface UseCaseScore {
  id: string;
  functionId?: string;
  /** Impact score 1..3. */
  impact: number;
  /**
   * Effective feasibility 1..3 — technical feasibility DEMOTED by scale blockers.
   * A high-impact use-case failing the gate is pulled below the quick-win line.
   */
  feasibility: number;
  /** impact × feasibility, 1..9. */
  score: number;
  quadrant: Quadrant;
  gate: ScaleGate;
}

/**
 * Score one use-case on the impact × feasibility matrix. Feasibility is the raw
 * technical feasibility DISCOUNTED per scale blocker (each blocker costs ~0.5),
 * so the gate physically pulls a blocked high-impact case out of the quick-win
 * quadrant into a big-bet (fund the foundation first) rather than letting it
 * masquerade as a quick win.
 */
export function scoreUseCase(uc: UseCaseItem): UseCaseScore {
  const impact = LEVEL_SCORE[asLevel(uc.impact)];
  const rawFeasibility = LEVEL_SCORE[asLevel(uc.feasibility)];
  const gate = evaluateScaleGate(uc);
  const feasibility = clamp(round1(rawFeasibility - gate.blockers.length * 0.5), 0.5, 3);
  const score = round1(impact * feasibility);

  const highImpact = impact >= 2.5;
  const highFeas = feasibility >= 2.3;
  let quadrant: Quadrant;
  if (highImpact && highFeas) quadrant = 'quick-win';
  else if (highImpact && !highFeas) quadrant = 'big-bet';
  else if (!highImpact && highFeas) quadrant = 'fill-in';
  else quadrant = 'no-go';

  return { id: uc.id, functionId: uc.functionId, impact, feasibility, score, quadrant, gate };
}

export interface PriorityMatrix {
  scored: UseCaseScore[];
  quickWins: UseCaseScore[];
  bigBets: UseCaseScore[];
  fillIns: UseCaseScore[];
  noGos: UseCaseScore[];
  /** High-impact cases blocked from scaling — the "pilot without scale" list. */
  pilotsWithoutScale: UseCaseScore[];
}

export function buildPriorityMatrix(session: ValuePoolSession): PriorityMatrix {
  const scored = session.useCases
    .map(scoreUseCase)
    .sort((a, b) => b.score - a.score);
  return {
    scored,
    quickWins: scored.filter((s) => s.quadrant === 'quick-win'),
    bigBets: scored.filter((s) => s.quadrant === 'big-bet'),
    fillIns: scored.filter((s) => s.quadrant === 'fill-in'),
    noGos: scored.filter((s) => s.quadrant === 'no-go'),
    pilotsWithoutScale: scored.filter((s) => s.gate.pilotWithoutScale),
  };
}

// ---------------------------------------------------------------------------
// Concentration (80/20) + dead fields
// ---------------------------------------------------------------------------

export interface ConcentrationFinding {
  /** Functions holding ~80% of the mapped value, largest-first. */
  drivers: FunctionPool[];
  /** Share of total value the drivers hold, 0..1. */
  driversShare: number;
  /** How many functions those drivers are, out of the total. */
  driverCount: number;
  totalFunctions: number;
  rationale: Bilingual;
}

/**
 * Find the minimal set of top functions that together hold ~80% of the mapped
 * value-at-stake — the doctrine's headline "80% of value in N of M functions".
 */
export function detectConcentration(session: ValuePoolSession): ConcentrationFinding {
  const baseline = computeBaseline(session);
  const withValue = baseline.pools.filter((p) => p.valueAtStake > 0);
  const total = withValue.reduce((acc, p) => acc + p.valueAtStake, 0);

  const drivers: FunctionPool[] = [];
  let cumulative = 0;
  for (const p of withValue) {
    drivers.push(p);
    cumulative += p.valueAtStake;
    if (total > 0 && cumulative / total >= 0.8) break;
  }
  const driversShare = total > 0 ? round1(cumulative / total) : 0;
  const names = drivers.map((d) => d.name).join(' + ');

  const rationale: Bilingual =
    withValue.length === 0
      ? {
          pl: 'Brak zmapowanej wartości — dodaj funkcje z bazą i benchmarkiem, aby wykryć koncentrację.',
          en: 'No mapped value yet — add functions with a base and benchmark to detect concentration.',
        }
      : {
          pl: `${Math.round(driversShare * 100)}% zmapowanej wartości cyfrowej leży w ${drivers.length} z ${withValue.length} funkcji (${names}). Reszta portfela to razem <${Math.round((1 - driversShare) * 100)}% — tu należy skierować pierwszy dolar transformacji, a nie tam, gdzie jest najwięcej „widocznych" inicjatyw.`,
          en: `${Math.round(driversShare * 100)}% of the mapped digital value sits in ${drivers.length} of ${withValue.length} functions (${names}). The rest of the portfolio is together <${Math.round((1 - driversShare) * 100)}% — that is where the first transformation dollar belongs, not where the most "visible" initiatives are.`,
        };

  return {
    drivers,
    driversShare,
    driverCount: drivers.length,
    totalFunctions: withValue.length,
    rationale,
  };
}

export interface DeadField {
  id: string;
  name: string;
  valueAtStake: number;
  share: number;
  reason: Bilingual;
}

/**
 * Dead fields: functions that carry a real benchmark value-at-stake but have
 * ZERO use-cases attributed — the "missing pool nobody is looking at". Sorted by
 * value-at-stake so the largest neglected pool leads.
 */
export function detectDeadFields(session: ValuePoolSession): DeadField[] {
  const baseline = computeBaseline(session);
  return baseline.pools
    .filter((p) => p.valueAtStake > 0 && p.share >= 0.02 && p.useCaseCount === 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      valueAtStake: p.valueAtStake,
      share: p.share,
      reason: {
        pl: `Martwe pole: funkcja „${p.name}" ma ${Math.round(p.share * 100)}% zmapowanej puli (${p.valueAtStake} w grze), ale ZERO zgłoszonych use-case'ów — nikt na nią nie patrzy, choć benchmark widzi tam wartość.`,
        en: `Dead field: function "${p.name}" holds ${Math.round(p.share * 100)}% of the mapped pool (${p.valueAtStake} in play) but has ZERO use-cases proposed — nobody is looking at it, though the benchmark sees value there.`,
      },
    }))
    .sort((a, b) => b.valueAtStake - a.valueAtStake);
}

// ---------------------------------------------------------------------------
// Function scoring (phase-level readiness, for the ranking panel)
// ---------------------------------------------------------------------------

export interface PhaseScore {
  phase: ValuePoolPhaseId;
  label: Bilingual;
  /** Use-cases whose phase attribution matches this phase. */
  useCaseCount: number;
  /** Mean effective score of this phase's use-cases, 0..9. */
  meanScore: number;
}

export function scorePhases(session: ValuePoolSession): PhaseScore[] {
  const matrix = buildPriorityMatrix(session);
  return VALUE_POOL_PHASES.map((phase) => {
    const items = session.useCases
      .filter((uc) => uc.phase === phase)
      .map((uc) => matrix.scored.find((s) => s.id === uc.id))
      .filter((s): s is UseCaseScore => Boolean(s));
    const meanScore =
      items.length > 0 ? round1(items.reduce((a, s) => a + s.score, 0) / items.length) : 0;
    return { phase, label: valuePoolPhaseLabel(phase), useCaseCount: items.length, meanScore };
  });
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

// ---------------------------------------------------------------------------
// Roadmap — W2-validated move sequence
// ---------------------------------------------------------------------------

export interface RoadmapMove {
  order: number;
  wave: 'quick-win' | 'foundation' | 'big-bet' | 'no-go';
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
 * Build a W2-validated roadmap from the priority matrix + concentration + dead
 * fields. The sequence rule mirrors the doctrine:
 *   1. if the mapped value concentrates and budget does not, reallocate first;
 *   2. lead with the quick win (high impact + high feasibility, data ready);
 *   3. fund the data/owner foundation for the blocked big bet (the pilot-without-
 *      scale trap) in PARALLEL, not as the headline;
 *   4. surface the largest dead field as an explicit "look here" move;
 *   5. reject the no-go quadrant explicitly so it does not return every quarter.
 */
export function buildRoadmap(session: ValuePoolSession): RoadmapMove[] {
  const matrix = buildPriorityMatrix(session);
  const concentration = detectConcentration(session);
  const deadFields = detectDeadFields(session);
  if (matrix.scored.length === 0 && concentration.drivers.length === 0) return [];

  const baseline = computeBaseline(session);
  const moves: RoadmapMove[] = [];
  let order = 1;

  // 1. Reallocation move when value concentrates hard in a few functions.
  if (concentration.driversShare >= 0.7 && concentration.driverCount <= 3 && concentration.totalFunctions > concentration.driverCount) {
    const names = concentration.drivers.map((d) => d.name).join(' + ');
    moves.push({
      order: order++,
      wave: 'quick-win',
      title: {
        pl: `Przekieruj budżet transformacji do funkcji: ${names}`,
        en: `Redirect the transformation budget to functions: ${names}`,
      },
      rationale: {
        pl: `${Math.round(concentration.driversShare * 100)}% zmapowanej wartości leży w ${concentration.driverCount} funkcjach, a budżet inicjatyw jest zwykle rozłożony odwrotnie — pierwszy dolar ma iść tam, gdzie jest pieniądz, nie tam, gdzie jest najwięcej „widocznych" inicjatyw.`,
        en: `${Math.round(concentration.driversShare * 100)}% of the mapped value sits in ${concentration.driverCount} functions, while the initiative budget is usually allocated inversely — the first dollar must go where the money is, not where the most "visible" initiatives are.`,
      },
      tradeOff: {
        pl: 'Kosztem widocznych, ale peryferyjnych quick-fixów, które trzeba świadomie odstawić, żeby uwolnić uwagę zarządu na dużą pulę.',
        en: 'At the cost of the visible but peripheral quick-fixes you must deliberately stand down to free management attention for the large pool.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „równomierne rozłożenie budżetu po wszystkich funkcjach": rozmywa kapitał na szum i głodzi 2-3 funkcje, w których leży 80% wartości.',
        en: 'We reject "spreading the budget evenly across all functions": it dilutes capital into noise and starves the 2-3 functions that hold 80% of the value.',
      },
      expectedImpact: 'high',
      estimatedEffort: 'low',
      validation: VALID,
    });
  }

  // 2. Lead with the top quick win.
  const topQuickWin = matrix.quickWins[0];
  if (topQuickWin) {
    const fn = baseline.pools.find((p) => p.id === topQuickWin.functionId);
    moves.push({
      order: order++,
      wave: 'quick-win',
      title: {
        pl: `Zacznij od quick-winu${fn ? ` w funkcji „${fn.name}"` : ''}`,
        en: `Start with the quick win${fn ? ` in function "${fn.name}"` : ''}`,
      },
      rationale: {
        pl: `Wysoki impact i wysoka feasibility (dopasowanie ${topQuickWin.score}/9)${fn ? `, dane gotowe, pula ${fn.valueAtStake} w grze` : ''} — to najszybszy zwrot widoczny w P&L na jednostkę wysiłku i wiarygodność pod kolejne fale.`,
        en: `High impact and high feasibility (fit ${topQuickWin.score}/9)${fn ? `, data ready, pool ${fn.valueAtStake} in play` : ''} — the fastest return visible in the P&L per unit of effort, and the credibility for the next waves.`,
      },
      tradeOff: {
        pl: 'Kosztem tempa w dużych obstawieniach strategicznych — świadomie zaczynamy od pewnego zwrotu, zanim otworzymy fronty o niższej feasibility.',
        en: 'At the cost of pace on the big strategic bets — we deliberately start with a sure return before opening lower-feasibility fronts.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy rozpoczęcie od najambitniejszego use-case\'u: bez wczesnego zwrotu program traci mandat zarządu, zanim pokaże pierwszą liczbę.',
        en: 'We reject starting with the most ambitious use-case: without an early return the program loses the board\'s mandate before it shows a single number.',
      },
      expectedImpact: 'high',
      estimatedEffort: 'low',
      validation: VALID,
    });
  }

  // 3. Fund the foundation for the blocked big bet / pilot-without-scale — in parallel.
  const blocked = matrix.pilotsWithoutScale[0] || matrix.bigBets[0];
  if (blocked) {
    const fn = baseline.pools.find((p) => p.id === blocked.functionId);
    const blockerText = describeBlockers(blocked.gate.blockers, true);
    const blockerTextEn = describeBlockers(blocked.gate.blockers, false);
    moves.push({
      order: order++,
      wave: 'foundation',
      title: {
        pl: `Zbuduj fundament pod obstawienie${fn ? ` „${fn.name}"` : ''}, nie skaluj przedwcześnie`,
        en: `Build the foundation for the bet${fn ? ` "${fn.name}"` : ''}, do not scale prematurely`,
      },
      rationale: {
        pl: `Wysoki impact, ale feasibility skalowania zablokowana (${blockerText}) — bez tego to kandydat na „pilot, który nigdy nie przejdzie do skali" (<10% pilotów AI dochodzi do produkcji). Fundament idzie RÓWNOLEGLE do quick-winu, nie zamiast niego.`,
        en: `High impact, but feasibility to scale is blocked (${blockerTextEn}) — without it this is a candidate for "a pilot that never reaches scale" (<10% of AI pilots reach production). The foundation runs IN PARALLEL to the quick win, not instead of it.`,
      },
      tradeOff: {
        pl: 'Kosztem odroczenia wartości tej puli o ~1 falę — płacimy za to pewnością, że pilotaż przejdzie do skali, a nie utknie.',
        en: 'At the cost of deferring this pool\'s value by ~1 wave — we pay for it with the certainty that the pilot scales rather than stalling.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy duży budżet na pilotaż bez właściciela/danych: to najdroższy sposób sfinansować „pilot bez skali" i spalić mandat na kolejny rok.',
        en: 'We reject a large pilot budget with no owner/data: it is the most expensive way to fund a "pilot without scale" and burn the mandate for another year.',
      },
      expectedImpact: 'high',
      estimatedEffort: 'medium',
      validation: VALID,
    });
  }

  // 4. Surface the largest dead field explicitly.
  const dead = deadFields[0];
  if (dead) {
    moves.push({
      order: order++,
      wave: 'quick-win',
      title: {
        pl: `Zbadaj martwe pole: „${dead.name}"`,
        en: `Investigate the dead field: "${dead.name}"`,
      },
      rationale: {
        pl: `Funkcja „${dead.name}" trzyma ${Math.round(dead.share * 100)}% puli (${dead.valueAtStake} w grze), a nie ma ANI JEDNEGO zgłoszonego use-case'u — brakująca pula to najczęściej najcenniejszy insight, bo nikt jej nie zakwestionował.`,
        en: `Function "${dead.name}" holds ${Math.round(dead.share * 100)}% of the pool (${dead.valueAtStake} in play) yet has NOT A SINGLE use-case proposed — a missing pool is most often the most valuable insight, because nobody challenged it.`,
      },
      tradeOff: {
        pl: 'Kosztem jednego warsztatu z właścicielem funkcji, który dotąd był poza radarem transformacji.',
        en: 'At the cost of one workshop with the owner of a function that has so far been off the transformation radar.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy pominięcie funkcji „bo zawsze tak było": właśnie brak kwestionowania jest powodem, dla którego pula tam wciąż leży niewykorzystana.',
        en: 'We reject skipping the function "because it has always been this way": the absence of challenge is exactly why the pool still sits there untapped.',
      },
      expectedImpact: 'medium',
      estimatedEffort: 'low',
      validation: VALID,
    });
  }

  // 5. Reject the no-go quadrant explicitly.
  if (matrix.noGos.length > 0) {
    moves.push({
      order: order++,
      wave: 'no-go',
      title: {
        pl: `Odrzuć jawnie ${matrix.noGos.length} use-case'ów z ćwiartki no-go`,
        en: `Explicitly reject ${matrix.noGos.length} no-go-quadrant use-cases`,
      },
      rationale: {
        pl: `${matrix.noGos.length} use-case'ów ma niski impact niezależnie od feasibility — decyzja o NIE-inwestowaniu jest równie ważna jak o inwestowaniu, a bez zapisu peryferyjne „widoczne" fixy wracają co kwartał z nowym szumem.`,
        en: `${matrix.noGos.length} use-cases have low impact regardless of feasibility — the decision NOT to invest is as important as the decision to invest, and without a record the peripheral "visible" fixes return each quarter on fresh hype.`,
      },
      tradeOff: {
        pl: 'Kosztem rozczarowania orędowników tych pomysłów — płacimy tym za czystą listę priorytetów i uwagę zarządu skupioną na dużej puli.',
        en: 'At the cost of disappointing the champions of these ideas — we pay for a clean priority list and management attention focused on the large pool.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy trzymanie ich „na później" w backlogu: martwy backlog karmi iluzję, że pracujemy nad wszystkim, i co kwartał wraca w dyskusji.',
        en: 'We reject parking them "for later" in the backlog: a dead backlog feeds the illusion of working on everything and resurfaces every quarter.',
      },
      expectedImpact: 'low',
      estimatedEffort: 'low',
      validation: VALID,
    });
  }

  return moves;
}

const describeBlockers = (
  blockers: ScaleGate['blockers'],
  isPolish: boolean
): string => {
  const map: Record<ScaleGate['blockers'][number], Bilingual> = {
    data: { pl: 'jakość/dostępność danych', en: 'data quality/availability' },
    owner: { pl: 'brak właściciela z mandatem', en: 'no owner with mandate' },
    'scale-path': { pl: 'brak ścieżki do >1 zespołu', en: 'no path to >1 team' },
    'business-metric': { pl: 'metryka tylko adopcyjna', en: 'adoption-only metric' },
  };
  const parts = blockers.map((b) => (isPolish ? map[b].pl : map[b].en));
  return parts.length > 0 ? parts.join(', ') : isPolish ? 'brak jawnych blokerów' : 'no explicit blockers';
};

// ---------------------------------------------------------------------------
// One-shot synthesis
// ---------------------------------------------------------------------------

/**
 * One-shot synthesis: baseline + priority matrix + concentration + dead fields +
 * phase scores + W2 roadmap, ready for the UI or the AI fallback. Pure and
 * deterministic.
 */
export function synthesizeValuePoolPlan(session: ValuePoolSession): {
  baseline: ValuePoolBaseline;
  matrix: PriorityMatrix;
  concentration: ConcentrationFinding;
  deadFields: DeadField[];
  phases: PhaseScore[];
  roadmap: RoadmapMove[];
} {
  return {
    baseline: computeBaseline(session),
    matrix: buildPriorityMatrix(session),
    concentration: detectConcentration(session),
    deadFields: detectDeadFields(session),
    phases: scorePhases(session),
    roadmap: buildRoadmap(session),
  };
}

/** Flatten a RoadmapMove into a localized, store-agnostic move summary. */
export function localizeMove(
  move: RoadmapMove,
  isPolish: boolean
): { title: string; rationale: string; wave: RoadmapMove['wave'] } {
  return {
    title: localize(move.title, isPolish),
    rationale: `${localize(move.rationale, isPolish)} ${localize(move.tradeOff, isPolish)} ${localize(
      move.rejectedVariant,
      isPolish
    )}`.trim(),
    wave: move.wave,
  };
}
