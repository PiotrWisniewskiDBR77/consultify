/**
 * Inventory Autopilot — synthesis engine + W2 move validator.
 *
 * The pure, testable brain of the tool. It reads the inventory session (SKU
 * segments + candidate policy moves) and produces:
 *
 *   1. a baseline of the working capital tied up and where it sits (fast vs tail)
 *   2. a per-lever readiness score (classify / service / replenish / deadstock)
 *      derived from the facts (SKU coverage, measurement, impact, evidence)
 *   3. a ranking of the four levers with a plain rationale, in a disciplined
 *      order (you cannot set a policy before you have classified)
 *   4. a W2-validated move sequence, where every move carries:
 *        - rationale        (why do this now)
 *        - tradeOff         (what it costs you / what you give up)
 *        - rejectedVariant  (the alternative deliberately NOT taken, and why)
 *
 * The W2 validator is the near-literal transfer of the SMED/Ansoff/SWOT
 * "move must justify itself" contract: a move is only VALID when all three
 * fields are present and non-trivial.
 *
 * This layer is self-contained: it depends only on a minimal read-model of the
 * inventory session (InventorySession), not on the full store, so it compiles
 * and tests in isolation.
 */

import {
  INVENTORY_LEVERS,
  inventoryLeverLabel,
  type Bilingual,
  type InventoryLeverId,
} from './deepeningLadder';

type Level = 'high' | 'medium' | 'low';

const LEVEL_SCORE: Record<Level, number> = { high: 3, medium: 2, low: 1 };

/** ABC value class of a SKU segment. */
export type ValueClass = 'A' | 'B' | 'C';
/** XYZ demand-variability class of a SKU segment. */
export type VariabilityClass = 'X' | 'Y' | 'Z';

/**
 * Minimal read-model of one SKU segment. Sourced from the tool's `skus`
 * section; `category` carries the ABC class, `threshold` the XYZ class, and
 * the value/turnover fields carry the money the segment ties up and moves.
 */
export interface SkuSegment {
  id: string;
  valueClass: ValueClass;
  variabilityClass: VariabilityClass;
  /** Inventory value (capital) this segment ties up. */
  stockValue?: number;
  /** Annual turnover (sales value) this segment generates. */
  annualTurnover?: number;
  /** Whether this segment sits below its service-level target (a stock-out risk). */
  belowService?: boolean;
  /** Whether the segment is flagged as dead / obsolete stock. */
  dead?: boolean;
  /** Whether the segment's numbers are measured (true) or estimated/unknown. */
  measured?: boolean;
}

/** Minimal read-model of one policy-move candidate from the `moves` section. */
export interface PolicyMoveItem {
  id: string;
  /** Which inventory lever the move primarily belongs to. */
  lever?: InventoryLeverId;
  impact?: Level;
  effort?: Level;
  /** Evidence backing the move (analysis, pilot, data pull). */
  evidence?: string[];
}

/** The minimal inventory session shape the engine reads. */
export interface InventorySession {
  segments: SkuSegment[];
  moves: PolicyMoveItem[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const asLevel = (value: unknown, fallback: Level = 'medium'): Level =>
  value === 'high' || value === 'medium' || value === 'low' ? value : fallback;
const localize = (text: Bilingual, isPolish: boolean) => (isPolish ? text.pl : text.en);

// ---------------------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------------------

/** The headline inventory facts: where the working capital sits and what is at risk. */
export interface InventoryBaseline {
  totalStockValue: number;
  /** Capital tied up in class-C (marginal) segments — the primary release pool. */
  tailStockValue: number;
  /** Capital tied up in segments flagged dead/obsolete. */
  deadStockValue: number;
  /** Number of segments currently below their service-level target. */
  belowServiceCount: number;
  /** Share of segments whose numbers are measured, 0..1. */
  measuredRatio: number;
  /** Share of total stock value that sits in the class-C tail, 0..1. */
  tailShare: number;
}

export function computeBaseline(session: InventorySession): InventoryBaseline {
  const segs = session.segments;
  const totalStockValue = segs.reduce((acc, s) => acc + (s.stockValue || 0), 0);
  const tailStockValue = segs
    .filter((s) => s.valueClass === 'C')
    .reduce((acc, s) => acc + (s.stockValue || 0), 0);
  const deadStockValue = segs.filter((s) => s.dead).reduce((acc, s) => acc + (s.stockValue || 0), 0);
  const belowServiceCount = segs.filter((s) => s.belowService).length;
  const measured = segs.filter((s) => s.measured).length;
  return {
    totalStockValue: round1(totalStockValue),
    tailStockValue: round1(tailStockValue),
    deadStockValue: round1(deadStockValue),
    belowServiceCount,
    measuredRatio: segs.length > 0 ? round1(measured / segs.length) : 0,
    tailShare: totalStockValue > 0 ? round1(tailStockValue / totalStockValue) : 0,
  };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface LeverScore {
  lever: InventoryLeverId;
  label: Bilingual;
  /** Policy-move candidates attributed to this lever. */
  moveCount: number;
  /** Working capital (or lost sales exposure) this lever can act on. */
  capitalInScope: number;
  /** Mean impact of this lever's moves, 1..3. */
  attractiveness: number;
  /** Ease of pulling it off (low effort + evidence), 1..3. */
  feasibility: number;
  /** attractiveness × feasibility, 1..9. */
  score: number;
  /** Count of moves carrying at least one evidence item. */
  evidenceBacked: number;
}

/** Working capital a lever can act on, derived from the segment facts. */
const capitalForLever = (
  lever: InventoryLeverId,
  session: InventorySession,
  baseline: InventoryBaseline
): number => {
  switch (lever) {
    case 'classify':
      // classification governs the whole book
      return baseline.totalStockValue;
    case 'service':
      // service policy protects fast/critical segments and covers below-service exposure
      return session.segments
        .filter((s) => s.valueClass !== 'C' || s.belowService)
        .reduce((acc, s) => acc + (s.stockValue || 0), 0);
    case 'replenish':
      // replenishment logic governs the value classes with real turnover (A/B)
      return session.segments
        .filter((s) => s.valueClass !== 'C')
        .reduce((acc, s) => acc + (s.stockValue || 0), 0);
    case 'deadstock':
      return baseline.deadStockValue + baseline.tailStockValue;
    default:
      return 0;
  }
};

const scoreLever = (
  lever: InventoryLeverId,
  session: InventorySession,
  baseline: InventoryBaseline
): LeverScore => {
  const label = inventoryLeverLabel(lever);
  const moves = session.moves.filter((m) => m.lever === lever);
  const capitalInScope = round1(capitalForLever(lever, session, baseline));

  if (moves.length === 0) {
    return {
      lever,
      label,
      moveCount: 0,
      capitalInScope,
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
    capitalInScope,
    attractiveness,
    feasibility,
    score,
    evidenceBacked,
  };
};

export interface LeverRanking {
  scores: LeverScore[];
  /** levers ordered best-first among those with at least one move. */
  ordered: InventoryLeverId[];
  rationale: Bilingual;
}

/**
 * Rank the four inventory levers. Only levers with move candidates are ranked;
 * empty levers are reported with score 0 but excluded from `ordered`. Ties break
 * toward the canonical order (classify before service before replenish before
 * deadstock) so the sequence never recommends automating a policy before the
 * classification that should shape it exists.
 */
export function rankLevers(session: InventorySession): LeverRanking {
  const baseline = computeBaseline(session);
  const scores = INVENTORY_LEVERS.map((lever) => scoreLever(lever, session, baseline));
  const orderIndex = (l: InventoryLeverId) => INVENTORY_LEVERS.indexOf(l);

  const ordered = scores
    .filter((s) => s.moveCount > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.capitalInScope !== a.capitalInScope) return b.capitalInScope - a.capitalInScope;
      return orderIndex(a.lever) - orderIndex(b.lever);
    })
    .map((s) => s.lever);

  const top = scores.find((s) => s.lever === ordered[0]);
  const rationale: Bilingual = top
    ? {
        pl: `Najsilniejsza dźwignia to „${inventoryLeverLabel(top.lever).pl.toLowerCase()}" (dopasowanie ${top.score}/9: atrakcyjność ${top.attractiveness} × wykonalność ${top.feasibility}), obejmująca ${top.capitalInScope} kapitału. Sekwencja trzyma porządek: nie automatyzujemy polityki, zanim asortyment nie jest sklasyfikowany.`,
        en: `The strongest lever is "${inventoryLeverLabel(top.lever).en.toLowerCase()}" (fit ${top.score}/9: attractiveness ${top.attractiveness} × feasibility ${top.feasibility}), covering ${top.capitalInScope} of capital. The sequence keeps order: we do not automate a policy before the assortment is classified.`,
      }
    : {
        pl: 'Brak kandydatów na ruchy — dodaj segmenty SKU i ruchy w co najmniej jednej dźwigni, aby zbudować ranking.',
        en: 'No move candidates yet — add SKU segments and moves in at least one lever to build a ranking.',
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
  lever: InventoryLeverId;
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
 * Build a W2-validated move sequence from the ranked levers. The rule of the
 * sequence: when the book is under-measured, classify/measure first — you cannot
 * set a policy on stock you have not classified; lead with the highest-fit
 * lever; always surface the dead-stock cash release when it is real; and defer
 * the full autopilot behind a stated trade-off until the data is trusted.
 */
export function buildW2MoveSequence(session: InventorySession): SequencedMove[] {
  const { scores, ordered } = rankLevers(session);
  if (ordered.length === 0) return [];

  const baseline = computeBaseline(session);
  const scoreOf = (l: InventoryLeverId) => scores.find((s) => s.lever === l)!;
  const moves: SequencedMove[] = [];
  let order = 1;

  // If the book is thin on measurement, classify/measure first.
  if (baseline.measuredRatio < 0.5) {
    moves.push({
      order: order++,
      lever: 'classify',
      title: {
        pl: 'Najpierw sklasyfikuj i zmierz asortyment (ABC/XYZ)',
        en: 'Classify and measure the assortment first (ABC/XYZ)',
      },
      rationale: {
        pl: `Tylko ${Math.round(baseline.measuredRatio * 100)}% segmentów jest zmierzonych — bez klasyfikacji wartość × zmienność każda polityka optymalizuje średnią, a nie realny rozkład zapasu.`,
        en: `Only ${Math.round(baseline.measuredRatio * 100)}% of segments are measured — without a value × variability classification every policy optimizes an average, not the real inventory distribution.`,
      },
      tradeOff: {
        pl: 'Kosztem ~1 cyklu opóźnienia zmian w politykach, w zamian za pewność, gdzie realnie leży kapitał obrotowy.',
        en: 'At the cost of ~1 cycle of delay to policy changes, in exchange for certainty about where the working capital really sits.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „ustawmy nowe bufory od razu": polityka na niesklasyfikowanym asortymencie przepłaca ogon i głodzi bestsellery jednocześnie.',
        en: 'We reject "just set new buffers now": a policy on an unclassified assortment overpays the tail and starves the best-sellers at once.',
      },
      expectedImpact: 'medium',
      estimatedEffort: 'low',
      validation: VALID,
    });
  }

  // Lead with the highest-fit lever.
  const primary = ordered[0];
  const primaryScore = scoreOf(primary);
  moves.push({
    order: order++,
    lever: primary,
    title: {
      pl: `Skup się na dźwigni „${inventoryLeverLabel(primary).pl.toLowerCase()}"`,
      en: `Lead with the "${inventoryLeverLabel(primary).en.toLowerCase()}" lever`,
    },
    rationale: {
      pl: `Najwyższe dopasowanie (${primaryScore.score}/9) i największa pula kapitału (${primaryScore.capitalInScope}) — daje najszybszy zwrot na gotówce obrotowej i poziomie obsługi na jednostkę wysiłku.`,
      en: `Highest fit (${primaryScore.score}/9) and the largest capital pool (${primaryScore.capitalInScope}) — it returns fastest on working cash and service level per unit of effort.`,
    },
    tradeOff: {
      pl: 'Kosztem tempa w pozostałych dźwigniach — świadomie koncentrujecie planistów tu, zamiast otwierać cztery fronty naraz.',
      en: 'At the cost of pace in the other levers — you deliberately concentrate planners here rather than opening four fronts at once.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy równoległą przebudowę wszystkich polityk: bez skończonej pierwszej dźwigni zespół gubi standard i cofa efekt gotówkowy.',
      en: 'We reject reworking all policies in parallel: without a finished first lever the team loses the standard and the cash effect reverts.',
    },
    expectedImpact:
      primaryScore.attractiveness >= 2.5 ? 'high' : primaryScore.attractiveness >= 1.7 ? 'medium' : 'low',
    estimatedEffort:
      primaryScore.feasibility >= 2.4 ? 'low' : primaryScore.feasibility >= 1.6 ? 'medium' : 'high',
    validation: VALID,
  });

  // Dead-stock cash release is the fastest working-capital win — surface it
  // explicitly when there is real trapped cash and it is not already primary.
  if (primary !== 'deadstock' && baseline.deadStockValue + baseline.tailStockValue > 0) {
    const deadScore = scoreOf('deadstock');
    moves.push({
      order: order++,
      lever: 'deadstock',
      title: {
        pl: 'Uwolnij gotówkę z martwego i ogonowego zapasu',
        en: 'Release cash from dead and tail stock',
      },
      rationale: {
        pl: `${baseline.deadStockValue} kapitału leży w martwym zapasie, a ${baseline.tailStockValue} w ogonie klasy C (${Math.round(baseline.tailShare * 100)}% zapasu) — to najszybszy zastrzyk gotówki obrotowej bez ruszania obsługi klasy A.`,
        en: `${baseline.deadStockValue} of capital sits in dead stock and ${baseline.tailStockValue} in the class-C tail (${Math.round(baseline.tailShare * 100)}% of stock) — the fastest working-cash injection without touching class-A service.`,
      },
      tradeOff: {
        pl: 'Kosztem straty na rabatach wyprzedażowych i pracy przeglądu — uwolniony kapitał musi tę stratę przewyższyć.',
        en: 'At the cost of clearance-discount loss and review effort — the released capital must beat that loss.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy odpisanie wszystkiego hurtem: część pozycji jest sezonowa lub serwisowa i ich brak kosztuje więcej niż trzymanie.',
        en: 'We reject writing everything off wholesale: some items are seasonal or service parts whose absence costs more than holding them.',
      },
      expectedImpact: deadScore.moveCount > 0 && deadScore.attractiveness >= 2.5 ? 'high' : 'medium',
      estimatedEffort: 'low',
      validation: VALID,
    });
  }

  // Explicitly defer full replenishment automation until the data is trusted —
  // an autopilot on dirty data scales its errors silently.
  const replenishScore = scoreOf('replenish');
  moves.push({
    order: order++,
    lever: 'replenish',
    title: {
      pl: 'Oddaj sterowanie autopilotowi dopiero po zaufaniu danym',
      en: 'Hand control to the autopilot only after the data is trusted',
    },
    rationale: {
      pl:
        replenishScore.moveCount > 0
          ? `Autopilot uzupełniania obejmuje ${replenishScore.capitalInScope} kapitału klasy A/B, ale działa poprawnie tylko na czystych danych popytu i czasu dostawy — inaczej cicho skaluje błąd parametrów.`
          : `Autopilot uzupełniania obejmie kapitał klasy A/B (${replenishScore.capitalInScope}) po wcześniejszych dźwigniach — bez zaufanych danych zastępuje planistę gorszym, automatycznym błędem.`,
      en:
        replenishScore.moveCount > 0
          ? `The replenishment autopilot covers ${replenishScore.capitalInScope} of class-A/B capital, but only runs correctly on clean demand and lead-time data — otherwise it silently scales a parameter error.`
          : `The replenishment autopilot will cover class-A/B capital (${replenishScore.capitalInScope}) after the earlier levers — without trusted data it replaces the planner with a worse, automated error.`,
    },
    tradeOff: {
      pl: 'Kosztem czasu na oczyszczenie danych i pilotaż na stabilnej klasie AX, zanim rozszerzycie na zmienny ogon.',
      en: 'At the cost of time to clean the data and pilot on the stable AX class before extending to the volatile tail.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy włączenie automatu na całym asortymencie od razu: na brudnych danych autopilot jest gorszy od planisty, bo błąd rośnie niezauważony.',
      en: 'We reject switching the autopilot on across the whole assortment at once: on dirty data it is worse than a planner, because the error grows unnoticed.',
    },
    expectedImpact: 'medium',
    estimatedEffort: 'medium',
    validation: VALID,
  });

  return moves;
}

/**
 * One-shot synthesis: baseline + ranking + W2 sequence, ready for the UI or the
 * AI fallback. Pure and deterministic.
 */
export function synthesizeInventoryPlan(session: InventorySession): {
  baseline: InventoryBaseline;
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
): { title: string; rationale: string; lever: InventoryLeverId } {
  return {
    title: localize(seq.title, isPolish),
    rationale: `${localize(seq.rationale, isPolish)} ${localize(seq.tradeOff, isPolish)} ${localize(
      seq.rejectedVariant,
      isPolish
    )}`.trim(),
    lever: seq.lever,
  };
}
