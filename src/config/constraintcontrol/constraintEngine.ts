/**
 * Constraint Control — Theory-of-Constraints synthesis engine + W2 move validator.
 *
 * The pure, testable brain of the tool. It reads the constraint session (process
 * steps + candidate focusing moves + throughput-accounting figures) and produces:
 *
 *   1. LOCATION of the system constraint — read from the QUEUE and from
 *      capacity-vs-demand, NOT from "who looks busy" (the TOC cardinal rule)
 *   2. a Throughput-Accounting baseline (T / I / OE) with the derived decision
 *      ratios: Net Profit = T − OE, ROI = (T − OE) / I, Productivity = T/OE
 *   3. detection of a POLICY constraint — a rule/schedule/incentive that creates
 *      a queue with no physical capacity gap behind it (the default first hypothesis)
 *   4. a per-step focus-readiness score derived from the facts (queue, utilization,
 *      capacity gap, evidence), ranking the Five Focusing Steps
 *   5. a W2-validated move sequence in the disciplined TOC order
 *      (identify → exploit → subordinate → elevate), where every move carries:
 *        - rationale        (why do this now)
 *        - tradeOff         (what it costs you / what you give up)
 *        - rejectedVariant  (the alternative deliberately NOT taken, and why)
 *
 * The W2 validator is the near-literal transfer of the shared
 * "move must justify itself" contract from the Inventory/SMED engines.
 *
 * This layer is self-contained: it depends only on a minimal read-model of the
 * constraint session (ConstraintSession), not on the full store, so it compiles
 * and tests in isolation.
 */

import {
  FOCUS_STEPS,
  focusStepLabel,
  type Bilingual,
  type FocusStepId,
} from './deepeningLadder';

type Level = 'high' | 'medium' | 'low';

const LEVEL_SCORE: Record<Level, number> = { high: 3, medium: 2, low: 1 };

/**
 * Minimal read-model of one process step. Sourced from the tool's `steps`
 * section. The constraint is located by comparing `capacity` to `demand`
 * (capacity < demand → bottleneck) and by reading `queue` / `queueTrend`
 * (a growing or persistent queue in front of a step is the true signal).
 */
export interface ProcessStep {
  id: string;
  label?: string;
  /** Work units this step can process per unit of time (capacity rate). */
  capacity?: number;
  /** Work units the system must push through this step (demand rate). */
  demand?: number;
  /** Current queue / buffer sitting IN FRONT of this step (time or units). */
  queue?: number;
  /** How the queue is behaving over time — the cheapest diagnostic signal. */
  queueTrend?: 'growing' | 'stable' | 'shrinking';
  /** Reported utilization of the step, 0..1 (the FALSE signal if read alone). */
  utilization?: number;
  /** Whether this step's numbers are measured (true) or estimated/unknown. */
  measured?: boolean;
}

/** Minimal read-model of one focusing-move candidate from the `moves` section. */
export interface FocusMoveItem {
  id: string;
  /** Which of the Five Focusing Steps the move primarily belongs to. */
  step?: FocusStepId;
  impact?: Level;
  effort?: Level;
  /** Whether this move requires capital spend (only Elevate legitimately does). */
  capitalSpend?: boolean;
  /** Evidence backing the move (queue data, time audit, buffer penetration). */
  evidence?: string[];
}

/** Throughput-Accounting inputs for the whole system (money terms). */
export interface ThroughputInputs {
  /** Sales value the system generates in the period. */
  sales?: number;
  /** Totally Variable Cost tied directly to the sold work units. */
  totallyVariableCost?: number;
  /** Operating Expense — all money spent to turn I into T (salaries, rent, fixed). */
  operatingExpense?: number;
  /** Investment / Inventory — capital tied up in the system (WIP, tools, unfinished work). */
  investment?: number;
}

/** The minimal constraint session shape the engine reads. */
export interface ConstraintSession {
  steps: ProcessStep[];
  moves: FocusMoveItem[];
  throughput?: ThroughputInputs;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const round2 = (value: number) => Math.round(value * 100) / 100;
const asLevel = (value: unknown, fallback: Level = 'medium'): Level =>
  value === 'high' || value === 'medium' || value === 'low' ? value : fallback;
const localize = (text: Bilingual, isPolish: boolean) => (isPolish ? text.pl : text.en);

// ---------------------------------------------------------------------------
// Constraint localization — read the QUEUE, not the busyness
// ---------------------------------------------------------------------------

export interface ConstraintLocation {
  /** Id of the step identified as the system constraint (or null when undecidable). */
  constraintStepId: string | null;
  label: Bilingual;
  /** Capacity of the constraint step. */
  capacity: number;
  /** Demand on the constraint step. */
  demand: number;
  /** demand − capacity; > 0 means capacity is short of demand (a real bottleneck). */
  capacityGap: number;
  /** Queue sitting in front of the constraint. */
  queue: number;
  queueTrend: ProcessStep['queueTrend'];
  /**
   * Confidence in the localization: 'queue' (queue evidence agrees), 'capacity'
   * (capacity<demand but queue evidence thin), or 'weak' (guessed on utilization).
   */
  basis: 'queue' | 'capacity' | 'weak';
  /**
   * A step that LOOKS like the constraint by utilization but is not (queue not
   * growing) — the classic false-positive worth naming to the board.
   */
  falseBusyStepId: string | null;
}

/** Score a step for "how much of a constraint is it" — queue-weighted, not utilization-weighted. */
const constraintPressure = (s: ProcessStep): number => {
  const gap = (s.demand ?? 0) - (s.capacity ?? 0);
  const trendWeight = s.queueTrend === 'growing' ? 2 : s.queueTrend === 'stable' ? 1 : 0;
  // Queue and its trend dominate; the capacity gap confirms. Utilization is
  // deliberately NOT part of the pressure — a busy step is not a constraint.
  return (s.queue ?? 0) * 1 + trendWeight * 1 + Math.max(0, gap) * 0.5;
};

/**
 * Locate the system constraint. The rule (doctrine §5): read the QUEUE, not the
 * busyness. The step with the largest, growing queue AND/OR capacity below
 * demand is the constraint; a "100% busy" step whose queue is not growing is
 * flagged as a false-busy resource, not the constraint.
 */
export function locateConstraint(session: ConstraintSession): ConstraintLocation {
  const steps = session.steps;
  const empty: ConstraintLocation = {
    constraintStepId: null,
    label: { pl: 'Nie zlokalizowano', en: 'Not located' },
    capacity: 0,
    demand: 0,
    capacityGap: 0,
    queue: 0,
    queueTrend: undefined,
    basis: 'weak',
    falseBusyStepId: null,
  };
  if (steps.length === 0) return empty;

  const ranked = [...steps].sort((a, b) => constraintPressure(b) - constraintPressure(a));
  const top = ranked[0];
  if (constraintPressure(top) <= 0) {
    // No queue signal and no capacity gap anywhere — fall back to the tightest
    // capacity-vs-demand step, but mark the basis as weak.
    const byGap = [...steps].sort(
      (a, b) => (b.demand ?? 0) - (b.capacity ?? 0) - ((a.demand ?? 0) - (a.capacity ?? 0))
    );
    const t = byGap[0];
    const gap = (t.demand ?? 0) - (t.capacity ?? 0);
    return {
      ...empty,
      constraintStepId: gap > 0 ? t.id : null,
      label: { pl: t.label ?? t.id, en: t.label ?? t.id },
      capacity: t.capacity ?? 0,
      demand: t.demand ?? 0,
      capacityGap: round1(gap),
      queue: t.queue ?? 0,
      queueTrend: t.queueTrend,
      basis: gap > 0 ? 'capacity' : 'weak',
      falseBusyStepId: null,
    };
  }

  const gap = (top.demand ?? 0) - (top.capacity ?? 0);
  const hasQueueEvidence = (top.queue ?? 0) > 0 || top.queueTrend === 'growing';
  const basis: ConstraintLocation['basis'] = hasQueueEvidence
    ? 'queue'
    : gap > 0
      ? 'capacity'
      : 'weak';

  // A false-busy step: high utilization but not the constraint (its queue is not
  // growing and it is not the top-pressure step).
  const falseBusy =
    steps.find(
      (s) =>
        s.id !== top.id && (s.utilization ?? 0) >= 0.9 && s.queueTrend !== 'growing' && (s.queue ?? 0) === 0
    ) ?? null;

  return {
    constraintStepId: top.id,
    label: { pl: top.label ?? top.id, en: top.label ?? top.id },
    capacity: top.capacity ?? 0,
    demand: top.demand ?? 0,
    capacityGap: round1(gap),
    queue: top.queue ?? 0,
    queueTrend: top.queueTrend,
    basis,
    falseBusyStepId: falseBusy ? falseBusy.id : null,
  };
}

// ---------------------------------------------------------------------------
// Throughput Accounting (T / I / OE)
// ---------------------------------------------------------------------------

/** The system-level money facts TOC decisions are judged by. */
export interface ThroughputAccounting {
  /** T = Sales − Totally Variable Cost. */
  throughput: number;
  /** I = capital tied up in the system. */
  investment: number;
  /** OE = operating expense. */
  operatingExpense: number;
  /** Net Profit = T − OE. */
  netProfit: number;
  /** ROI = (T − OE) / I (null when I is 0/unknown). */
  roi: number | null;
  /** Productivity = T / OE (null when OE is 0/unknown). */
  productivity: number | null;
  /** Investment turns = T / I (null when I is 0/unknown). */
  investmentTurns: number | null;
  /** Whether enough figures are present to compute a meaningful T. */
  hasData: boolean;
}

export function computeThroughputAccounting(session: ConstraintSession): ThroughputAccounting {
  const t = session.throughput ?? {};
  const sales = t.sales ?? 0;
  const tvc = t.totallyVariableCost ?? 0;
  const oe = t.operatingExpense ?? 0;
  const inv = t.investment ?? 0;
  const throughput = sales - tvc;
  const netProfit = throughput - oe;
  const hasData = sales > 0 || tvc > 0 || oe > 0 || inv > 0;
  return {
    throughput: round1(throughput),
    investment: round1(inv),
    operatingExpense: round1(oe),
    netProfit: round1(netProfit),
    roi: inv > 0 ? round2(netProfit / inv) : null,
    productivity: oe > 0 ? round2(throughput / oe) : null,
    investmentTurns: inv > 0 ? round2(throughput / inv) : null,
    hasData,
  };
}

// ---------------------------------------------------------------------------
// Baseline (system-level facts, incl. policy-constraint detection)
// ---------------------------------------------------------------------------

export interface ConstraintBaseline {
  stepCount: number;
  /** Share of steps whose numbers are measured, 0..1. */
  measuredRatio: number;
  /** Number of steps whose queue is growing — the WIP/lead-time warning count. */
  growingQueueCount: number;
  location: ConstraintLocation;
  accounting: ThroughputAccounting;
  /**
   * Policy-constraint signal: the constraint has NO real physical capacity gap
   * (capacity >= demand) yet still carries a growing queue — meaning a rule /
   * schedule / incentive, not a missing resource, is throttling throughput.
   */
  policyConstraintLikely: boolean;
  /** Number of candidate moves attributed to the 'policy' step. */
  policyMoveCount: number;
}

export function computeBaseline(session: ConstraintSession): ConstraintBaseline {
  const steps = session.steps;
  const measured = steps.filter((s) => s.measured).length;
  const growingQueueCount = steps.filter((s) => s.queueTrend === 'growing').length;
  const location = locateConstraint(session);
  const accounting = computeThroughputAccounting(session);

  // Policy constraint: a queue exists (growing or > 0) but capacity is NOT below
  // demand at the constraint — the physical resource can keep up, so a policy is
  // the throttle. Also true when the session explicitly carries policy moves.
  const policyMoveCount = session.moves.filter((m) => m.step === 'policy').length;
  const queuePresent =
    location.queueTrend === 'growing' || location.queue > 0 || growingQueueCount > 0;
  const noPhysicalGap = location.capacityGap <= 0;
  const policyConstraintLikely =
    (queuePresent && noPhysicalGap && location.constraintStepId !== null) || policyMoveCount > 0;

  return {
    stepCount: steps.length,
    measuredRatio: steps.length > 0 ? round1(measured / steps.length) : 0,
    growingQueueCount,
    location,
    accounting,
    policyConstraintLikely,
    policyMoveCount,
  };
}

// ---------------------------------------------------------------------------
// Scoring — rank the Five Focusing Steps
// ---------------------------------------------------------------------------

export interface FocusStepScore {
  step: FocusStepId;
  label: Bilingual;
  /** Focusing-move candidates attributed to this step. */
  moveCount: number;
  /** Mean impact of this step's moves, 1..3. */
  attractiveness: number;
  /** Ease of pulling it off (low effort + evidence), 1..3. */
  feasibility: number;
  /** attractiveness × feasibility, 1..9, with the TOC discipline bias applied. */
  score: number;
  /** Count of moves carrying at least one evidence item. */
  evidenceBacked: number;
}

/**
 * Discipline bias: the Five Focusing Steps have a MANDATORY order. Exploit and
 * Subordinate (free throughput) outrank Elevate (capital); Elevate before
 * 1-3 are exhausted is the classic error, so it is penalized. Policy is boosted
 * because a policy constraint is the doctrine's default first hypothesis and the
 * cheapest, highest-leverage fix.
 */
const DISCIPLINE_BIAS: Record<FocusStepId, number> = {
  identify: 0.3,
  exploit: 0.5,
  subordinate: 0.3,
  elevate: -0.6,
  policy: 0.4,
};

const scoreStep = (step: FocusStepId, session: ConstraintSession): FocusStepScore => {
  const label = focusStepLabel(step);
  const moves = session.moves.filter((m) => m.step === step);

  if (moves.length === 0) {
    return { step, label, moveCount: 0, attractiveness: 0, feasibility: 0, score: 0, evidenceBacked: 0 };
  }

  const impactAvg = moves.reduce((sum, m) => sum + LEVEL_SCORE[asLevel(m.impact)], 0) / moves.length;
  const effortAvg = moves.reduce((sum, m) => sum + LEVEL_SCORE[asLevel(m.effort)], 0) / moves.length;
  const evidenceBacked = moves.filter((m) => (m.evidence?.length || 0) > 0).length;
  const evidenceRatio = evidenceBacked / moves.length;

  const effortEase = 4 - effortAvg; // 1..3, low effort scores high
  const feasibility = clamp(round1(effortEase * 0.6 + evidenceRatio * 2 * 0.4 + 0.4), 0.5, 3);
  const attractiveness = round1(impactAvg);
  const score = clamp(round1(attractiveness * feasibility + DISCIPLINE_BIAS[step]), 0, 9);

  return { step, label, moveCount: moves.length, attractiveness, feasibility, score, evidenceBacked };
};

export interface FocusRanking {
  scores: FocusStepScore[];
  /** steps ordered best-first among those with at least one move. */
  ordered: FocusStepId[];
  rationale: Bilingual;
}

/**
 * Rank the Five Focusing Steps. Only steps with move candidates are ranked;
 * empty steps are reported with score 0 but excluded from `ordered`. Ties break
 * toward the canonical POOGI order (identify → exploit → subordinate → elevate →
 * policy) so the sequence never recommends Elevate before Exploit is exhausted.
 */
export function rankFocusSteps(session: ConstraintSession): FocusRanking {
  const scores = FOCUS_STEPS.map((step) => scoreStep(step, session));
  const orderIndex = (s: FocusStepId) => FOCUS_STEPS.indexOf(s);

  const ordered = scores
    .filter((s) => s.moveCount > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return orderIndex(a.step) - orderIndex(b.step);
    })
    .map((s) => s.step);

  const top = scores.find((s) => s.step === ordered[0]);
  const rationale: Bilingual = top
    ? {
        pl: `Najsilniejszy krok fokusujący to „${focusStepLabel(top.step).pl.toLowerCase()}" (dopasowanie ${top.score}/9: atrakcyjność ${top.attractiveness} × wykonalność ${top.feasibility}). Sekwencja trzyma dyscyplinę TOC: Exploit i Subordinate (darmowa przepustowość) przed Elevate (kapitał).`,
        en: `The strongest focusing step is "${focusStepLabel(top.step).en.toLowerCase()}" (fit ${top.score}/9: attractiveness ${top.attractiveness} × feasibility ${top.feasibility}). The sequence keeps TOC discipline: Exploit and Subordinate (free throughput) before Elevate (capital).`,
      }
    : {
        pl: 'Brak kandydatów na ruchy — dodaj kroki procesu i ruchy w co najmniej jednym kroku fokusującym, aby zbudować ranking.',
        en: 'No move candidates yet — add process steps and moves in at least one focusing step to build a ranking.',
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
  step: FocusStepId;
  title: Bilingual;
  rationale: Bilingual;
  tradeOff: Bilingual;
  rejectedVariant: Bilingual;
  expectedImpact: Level;
  estimatedEffort: Level;
  /**
   * Every synthesized move is self-validated through the REAL W2 validator
   * (validateW2Move), run over the move's own generated content in BOTH
   * languages — not a hardcoded "always valid" flag. If a builder ever emits a
   * thin/missing justification, the UI sees it here instead of trusting a constant.
   */
  validation: W2ValidationResult;
}

/** Merge two W2 results (e.g. PL + EN pass): a field is missing/weak if it is in either. */
const mergeW2 = (a: W2ValidationResult, b: W2ValidationResult): W2ValidationResult => {
  const missing = Array.from(new Set([...a.missing, ...b.missing]));
  const weak = Array.from(new Set([...a.weak, ...b.weak])).filter((f) => !missing.includes(f));
  return { valid: missing.length === 0 && weak.length === 0, missing, weak };
};

/**
 * Attach a REAL validation to a drafted move by running validateW2Move over its
 * own generated rationale / trade-off / rejected variant in both PL and EN. This
 * is what makes validateW2Move a live guard for the auto-generated sequence
 * (previously it was bypassed with a hardcoded `VALID` constant).
 */
const withValidation = (draft: Omit<SequencedMove, 'validation'>): SequencedMove => ({
  ...draft,
  validation: mergeW2(
    validateW2Move({
      rationale: draft.rationale.pl,
      tradeOff: draft.tradeOff.pl,
      rejectedVariant: draft.rejectedVariant.pl,
    }),
    validateW2Move({
      rationale: draft.rationale.en,
      tradeOff: draft.tradeOff.en,
      rejectedVariant: draft.rejectedVariant.en,
    })
  ),
});

/**
 * Build a W2-validated move sequence from the located constraint and ranked
 * steps. The rule of the sequence is the Five Focusing Steps in order:
 *
 *   1. IDENTIFY   — when the constraint is not yet located on queue evidence,
 *                   locate it first; you cannot exploit what you cannot see.
 *   2. EXPLOIT    — squeeze the located constraint WITHOUT capital: protect its
 *                   time, gate quality before it, sequence by criticality.
 *   3. SUBORDINATE— slow everything else to the constraint's drum; a rope caps
 *                   WIP. Surfaced whenever queues are growing upstream.
 *   4. POLICY     — when a policy constraint is likely (queue with no physical
 *                   gap), change the rule before spending — cheaper than Elevate.
 *   5. ELEVATE    — only after 1-4, and only against a real capacity gap, invest.
 */
export function buildW2MoveSequence(session: ConstraintSession): SequencedMove[] {
  const baseline = computeBaseline(session);
  const { location, accounting } = baseline;
  const moves: Array<Omit<SequencedMove, 'validation'>> = [];
  let order = 1;

  const hasSteps = session.steps.length > 0;
  if (!hasSteps && session.moves.length === 0) return [];

  const constraintName = localize(location.label, true); // used only for interpolation length checks
  void constraintName;

  // 1. IDENTIFY — when the localization does not yet rest on queue evidence.
  if (!hasSteps || location.constraintStepId === null || location.basis !== 'queue') {
    moves.push({
      order: order++,
      step: 'identify',
      title: {
        pl: 'Najpierw zlokalizuj constraint z kolejek, nie z zajętości',
        en: 'Locate the constraint from queues first, not from busyness',
      },
      rationale: {
        pl:
          location.basis === 'capacity'
            ? `Lokalizacja opiera się na luce capacity–demand (${location.capacityGap}), ale bez dowodu z kolejki. Zasób „100% zajęty" bywa fałszywym constraintem — potwierdź rosnącą kolejką PRZED krokiem, nim ruszysz Exploit.`
            : `Brak twardego dowodu z kolejki, gdzie leży ograniczenie. Zasób „zajęty" nie jest constraintem — dowodem jest kolejka rosnąca PRZED krokiem i reszta systemu czekająca NA NIEGO.`,
        en:
          location.basis === 'capacity'
            ? `The location rests on a capacity–demand gap (${location.capacityGap}) but without queue evidence. A "100% busy" resource is often a false constraint — confirm with a growing queue BEFORE the step before starting Exploit.`
            : `There is no hard queue evidence for where the constraint sits. A "busy" resource is not the constraint — the evidence is a growing queue BEFORE the step and the rest of the system waiting ON IT.`,
      },
      tradeOff: {
        pl: 'Kosztem ~1 cyklu pomiaru kolejek, w zamian za pewność, że wysiłek Exploit trafi w realne ograniczenie, a nie w zasób, który tylko wygląda na zajęty.',
        en: 'At the cost of ~1 cycle of queue measurement, in exchange for certainty the Exploit effort hits the real constraint, not a resource that only looks busy.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „usprawnijmy najbardziej obciążony zespół od razu": usprawnienie poza constraintem nie zwiększa przepustowości — to iluzja, która przenosi koszt i puchnie WIP.',
        en: 'We reject "just improve the most loaded team now": improvement off the constraint does not raise throughput — it is an illusion that shifts cost and swells WIP.',
      },
      expectedImpact: 'high',
      estimatedEffort: 'low',
    });
  }

  // 2. EXPLOIT — squeeze the located constraint with zero CAPEX. Always present
  //    when we have a constraint, because free throughput comes before spend.
  if (location.constraintStepId !== null || session.moves.some((m) => m.step === 'exploit')) {
    const name = localize(location.label, false);
    const namePl = localize(location.label, true);
    moves.push({
      order: order++,
      step: 'exploit',
      title: {
        pl: `Wykorzystaj constraint „${namePl}" do maksimum bez CAPEX`,
        en: `Exploit the constraint "${name}" to the maximum without CAPEX`,
      },
      rationale: {
        pl: `Ograniczeniem systemu jest „${namePl}". Każda godzina stracona tam jest godziną straconą dla CAŁEJ organizacji — bez odzysku. Większość ograniczeń pracuje poniżej 50% realnego potencjału: usuń przestoje, poprawki i spotkania, postaw bramę jakości TUŻ PRZED nim.`,
        en: `The system constraint is "${name}". Every hour lost there is an hour lost for the WHOLE organization — with no recovery. Most constraints run below 50% of real potential: remove downtime, rework and meetings, and put a quality gate JUST BEFORE it.`,
      },
      tradeOff: {
        pl: 'Kosztem dyscypliny organizacyjnej — chronienia bloków czasu constraintu i egzekwowania kolejności zadań, co bywa niepopularne u zespołów przyzwyczajonych do wolnego dostępu.',
        en: 'At the cost of organizational discipline — protecting the constraint\'s time blocks and enforcing task order, which is unpopular with teams used to free access.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy od razu Elevate (etat/maszyna): to najdroższy sposób na kupienie wyniku, który 20-30% ukrytej wydajności w Exploit daje za darmo.',
        en: 'We reject jumping to Elevate (headcount/machine): it is the most expensive way to buy a result that 20-30% of hidden Exploit capacity yields for free.',
      },
      expectedImpact: 'high',
      estimatedEffort: 'low',
    });
  }

  // 3. SUBORDINATE — slow everything else to the drum. Surfaced when queues are
  //    growing upstream (WIP swelling) or we located a constraint at all.
  if (baseline.growingQueueCount > 0 || location.constraintStepId !== null) {
    moves.push({
      order: order++,
      step: 'subordinate',
      title: {
        pl: 'Podporządkuj resztę systemu rytmowi constraintu (Drum-Buffer-Rope)',
        en: 'Subordinate the rest of the system to the constraint\'s drum (Drum-Buffer-Rope)',
      },
      rationale: {
        pl: `${baseline.growingQueueCount} krok(ów) ma rosnącą kolejkę — zespoły przed constraintem produkują szybciej, niż potrafi on wchłonąć, co puchnie WIP i psuje priorytety. Bufor chroni constraint, lina (rope) uwalnia pracę w jego tempie: nic nie wchodzi szybciej, niż wchłonie.`,
        en: `${baseline.growingQueueCount} step(s) show a growing queue — pre-constraint teams produce faster than it can absorb, swelling WIP and breaking priorities. The buffer protects the constraint, the rope releases work at its pace: nothing enters faster than it absorbs.`,
      },
      tradeOff: {
        pl: 'Kosztem widocznego „marnowania potencjału" zespołów niebędących ograniczeniem — muszą czasem czekać, co jest trudne politycznie, choć ich nadprodukcja i tak nie zwiększa T systemu.',
        en: 'At the cost of visibly "wasting" non-constraint teams\' capacity — they must sometimes wait, which is politically hard, though their overproduction does not raise system T anyway.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „niech każdy pracuje pełną mocą": lokalna efektywność każdego działu z osobna NIE SUMUJE się do przepustowości — w systemie zależnym pogarsza ją przez WIP i lead time.',
        en: 'We reject "let everyone run at full capacity": each department\'s local efficiency does NOT sum to throughput — in a dependent system it worsens it through WIP and lead time.',
      },
      expectedImpact: baseline.growingQueueCount > 0 ? 'high' : 'medium',
      estimatedEffort: 'medium',
    });
  }

  // 4. POLICY — when a policy constraint is likely, change the rule before spend.
  if (baseline.policyConstraintLikely) {
    moves.push({
      order: order++,
      step: 'policy',
      title: {
        pl: 'Rozbrój ograniczenie polityki, zanim wydasz na moc',
        en: 'Disarm the policy constraint before spending on capacity',
      },
      rationale: {
        pl: `Kolejka rośnie, choć fizyczna przepustowość constraintu nadąża (luka capacity–demand ${location.capacityGap} ≤ 0) — to znak, że ogranicza polityka (kolejność zatwierdzeń, reguła zakupowa, harmonogram, premiowanie), nie brak zasobu. Zmiana polityki jest tańsza i szybsza niż Elevate, a często daje większy efekt na przepustowość.`,
        en: `The queue grows although the constraint's physical capacity keeps up (capacity–demand gap ${location.capacityGap} ≤ 0) — a sign a policy throttles it (approval order, purchasing rule, schedule, incentive), not a missing resource. A policy change is cheaper and faster than Elevate, and often yields a larger throughput effect.`,
      },
      tradeOff: {
        pl: 'Kosztem konfrontacji z „tak się u nas zawsze robi" i pracy nad ukrytym założeniem (Evaporating Cloud) — trudniejszej niż zakup, bo dotyka nawyków i władzy, nie budżetu.',
        en: 'At the cost of confronting "this is how we\'ve always done it" and working the hidden assumption (Evaporating Cloud) — harder than a purchase because it touches habits and power, not budget.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy założenie, że skoro jest kolejka, to „brakuje ludzi/maszyn": dokupienie mocy przy policy constraincie zwiększa OE i I bez zmiany T — płacicie za problem, którego nie było w zasobie.',
        en: 'We reject assuming that a queue means "we lack people/machines": buying capacity against a policy constraint raises OE and I without changing T — you pay for a problem that was never in the resource.',
      },
      expectedImpact: 'high',
      estimatedEffort: 'low',
    });
  }

  // 5. ELEVATE — only after 1-4, and only against a real, persistent capacity gap.
  const realGap = location.capacityGap > 0 && !baseline.policyConstraintLikely;
  const roiLine = accounting.hasData
    ? true
    : false;
  moves.push({
    order: order++,
    step: 'elevate',
    title: {
      pl: 'Podnieś przepustowość constraintu dopiero po wyczerpaniu kroków 1-4',
      en: 'Elevate the constraint\'s capacity only after steps 1-4 are exhausted',
    },
    rationale: {
      pl: realGap
        ? `Luka capacity–demand (${location.capacityGap}) jest realna i nie znika po Exploit/Subordinate — dopiero teraz inwestycja (etat, maszyna, outsourcing fragmentu Review) jest uzasadniona. Oceń ją przez zmianę T/I/OE CAŁEGO systemu${roiLine ? ` (dziś Zysk netto = T − OE = ${accounting.netProfit}${accounting.roi !== null ? `, ROI = ${accounting.roi}` : ''})` : ''}, nie przez koszt lokalny.`
        : `Elevate trzymamy na końcu i warunkowo: dopóki luka capacity–demand nie jest realna i trwała po Exploit/Subordinate, dokupienie mocy zwiększa OE i I bez zmiany T${roiLine ? ` (Zysk netto = T − OE = ${accounting.netProfit})` : ''}. To najdroższy i najwolniejszy krok — uruchamiany tylko, gdy 1-4 wyczerpane.`,
      en: realGap
        ? `The capacity–demand gap (${location.capacityGap}) is real and persists after Exploit/Subordinate — only now is investment (headcount, machine, outsourcing part of Review) justified. Judge it by the change in system T/I/OE${roiLine ? ` (today Net Profit = T − OE = ${accounting.netProfit}${accounting.roi !== null ? `, ROI = ${accounting.roi}` : ''})` : ''}, not by local cost.`
        : `We keep Elevate last and conditional: until the capacity–demand gap is real and persistent after Exploit/Subordinate, buying capacity raises OE and I without changing T${roiLine ? ` (Net Profit = T − OE = ${accounting.netProfit})` : ''}. It is the most expensive and slowest step — triggered only when 1-4 are exhausted.`,
    },
    tradeOff: {
      pl: 'Kosztem trwałego wzrostu kosztów operacyjnych (OE) i związanego kapitału (I) — który zwraca się tylko, jeśli realnie podnosi Throughput całego systemu, a nie wygląd raportu jednego działu.',
      en: 'At the cost of a permanent rise in operating expense (OE) and tied-up capital (I) — which pays back only if it genuinely lifts whole-system Throughput, not one department\'s report.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy Elevate jako pierwszy ruch: przeskok do inwestycji z pominięciem Exploit/Subordinate to kupowanie za pieniądze wyniku dostępnego za darmo — i utrwalenie starej polityki, która po przesunięciu constraintu staje się inercją.',
      en: 'We reject Elevate as the first move: jumping to investment past Exploit/Subordinate buys with money a result available for free — and cements an old policy that becomes inertia once the constraint moves.',
    },
    expectedImpact: realGap ? 'medium' : 'low',
    estimatedEffort: 'high',
  });

  return moves.map(withValidation);
}

/**
 * One-shot synthesis: baseline (location + T/I/OE + policy signal) + ranking +
 * W2 sequence, ready for the UI or the AI fallback. Pure and deterministic.
 */
export function synthesizeConstraintPlan(session: ConstraintSession): {
  baseline: ConstraintBaseline;
  ranking: FocusRanking;
  sequence: SequencedMove[];
} {
  return {
    baseline: computeBaseline(session),
    ranking: rankFocusSteps(session),
    sequence: buildW2MoveSequence(session),
  };
}

/** Flatten a SequencedMove into a localized, store-agnostic move summary. */
export function localizeMove(
  seq: SequencedMove,
  isPolish: boolean
): { title: string; rationale: string; step: FocusStepId } {
  return {
    title: localize(seq.title, isPolish),
    rationale: `${localize(seq.rationale, isPolish)} ${localize(seq.tradeOff, isPolish)} ${localize(
      seq.rejectedVariant,
      isPolish
    )}`.trim(),
    step: seq.step,
  };
}
