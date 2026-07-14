/**
 * Portfolio Priority — matrix + sequencing engine (OXFORD O3, tool #5).
 *
 * Pattern mirror of src/config/swot/swotTensionEngine.ts. Where SWOT derives
 * SO/WO/ST/WT tensions deterministically from accepted items, Portfolio Priority
 * derives, deterministically and traceably from ACCEPTED elements:
 *
 *   1. the 2x2 QUADRANT (value x feasibility): quick-win / big-bet / fill-in /
 *      money-pit — computed, never free-floating AI prose;
 *   2. a portfolio SEQUENCE that respects DEPENDENCIES (element A before B) and a
 *      BUDGET CAP (you cannot fund everything at once);
 *   3. the CONCLUSION_LAYER W2 gate on recommended moves — rationale anchored in
 *      element ids, a mandatory trade-off (chosen / deferred / cost) and a rejected
 *      alternative. "Everything at once = resource dilution" is the canonical
 *      rejected variant.
 *
 * The AI narrates on TOP of this deterministic spine; it does not get to invent
 * the quadrant, the order, or a move without a trade-off.
 */

import type { PortfolioDependency } from './portfolioValueStaircase';

export type PortfolioQuadrant = 'quick-win' | 'big-bet' | 'fill-in' | 'money-pit';

export const QUADRANT_META: Record<
  PortfolioQuadrant,
  { titleEn: string; titlePl: string; stanceEn: string; stancePl: string; order: number }
> = {
  // order = default funding preference when nothing else separates elements.
  'quick-win': {
    titleEn: 'Quick win',
    titlePl: 'Szybka wygrana',
    stanceEn: 'High value, easy to deliver — do now, self-funds the rest.',
    stancePl: 'Wysoka wartość, łatwa realizacja — rób teraz, finansuje resztę.',
    order: 0,
  },
  'big-bet': {
    titleEn: 'Big bet',
    titlePl: 'Duży zakład',
    stanceEn: 'High value, hard to deliver — sequence deliberately, protect the budget.',
    stancePl: 'Wysoka wartość, trudna realizacja — układaj świadomie, chroń budżet.',
    order: 1,
  },
  'fill-in': {
    titleEn: 'Fill-in',
    titlePl: 'Wypełniacz',
    stanceEn: 'Low value, easy — do only with spare capacity, never crowd out a big bet.',
    stancePl: 'Niska wartość, łatwe — tylko z wolną mocą, nigdy kosztem dużego zakładu.',
    order: 2,
  },
  'money-pit': {
    titleEn: 'Money pit',
    titlePl: 'Studnia bez dna',
    stanceEn: 'Low value, hard — default is to stop or radically reshape.',
    stancePl: 'Niska wartość, trudne — domyślnie zatrzymaj lub przemodeluj.',
    order: 3,
  },
};

/** Value/feasibility 1..5; midpoint 3 splits high vs low. Configurable threshold. */
export const AXIS_MIDPOINT = 3;

export function classifyQuadrant(
  valueScore: number,
  feasibilityScore: number,
  midpoint = AXIS_MIDPOINT
): PortfolioQuadrant {
  const highValue = valueScore >= midpoint;
  const highFeasibility = feasibilityScore >= midpoint;
  if (highValue && highFeasibility) return 'quick-win';
  if (highValue && !highFeasibility) return 'big-bet';
  if (!highValue && highFeasibility) return 'fill-in';
  return 'money-pit';
}

// ---------------------------------------------------------------------------
// Elements + acceptance filter
// ---------------------------------------------------------------------------

export interface PortfolioElement {
  id: string;
  title: string;
  valueScore: number; // 1..5
  feasibilityScore: number; // 1..5
  /** Relative cost/effort footprint consumed against the budget cap. Default 1. */
  cost?: number;
  dependencies?: PortfolioDependency[];
  proposalStatus?: string;
  status?: string;
}

export function isAcceptedElement(
  el: Pick<PortfolioElement, 'proposalStatus' | 'status'>
): boolean {
  if (el.proposalStatus) return el.proposalStatus === 'accepted';
  // Legacy user-entered elements (no proposal flow) count unless explicitly un-accepted.
  return el.status === 'accepted' || el.status === undefined;
}

export interface ClassifiedElement extends PortfolioElement {
  quadrant: PortfolioQuadrant;
}

/** Classify every ACCEPTED element into the 2x2. Deterministic and traceable. */
export function classifyPortfolio(
  elements: PortfolioElement[],
  midpoint = AXIS_MIDPOINT
): ClassifiedElement[] {
  return elements.filter(isAcceptedElement).map((el) => ({
    ...el,
    quadrant: classifyQuadrant(el.valueScore, el.feasibilityScore, midpoint),
  }));
}

export interface QuadrantDistribution {
  'quick-win': ClassifiedElement[];
  'big-bet': ClassifiedElement[];
  'fill-in': ClassifiedElement[];
  'money-pit': ClassifiedElement[];
}

export function groupByQuadrant(classified: ClassifiedElement[]): QuadrantDistribution {
  const dist: QuadrantDistribution = {
    'quick-win': [],
    'big-bet': [],
    'fill-in': [],
    'money-pit': [],
  };
  classified.forEach((el) => dist[el.quadrant].push(el));
  return dist;
}

// ---------------------------------------------------------------------------
// Dependency-aware, budget-capped sequencing
// ---------------------------------------------------------------------------

export interface SequenceEntry {
  elementId: string;
  title: string;
  quadrant: PortfolioQuadrant;
  /** Cumulative cost after funding this element. */
  cumulativeCost: number;
  /** Elements that had to ship first (hard deps) for this to be fundable. */
  unlockedBy: string[];
}

export interface PortfolioSequence {
  /** Funded, in delivery order. */
  funded: SequenceEntry[];
  /** Deferred because the budget cap was hit — the honest "we can't do it all". */
  deferred: { elementId: string; title: string; quadrant: PortfolioQuadrant; reason: string }[];
  /** Elements that can never be funded here because a HARD dep is missing/deferred. */
  blocked: { elementId: string; title: string; reason: string }[];
  /** Circular hard-dependency chains detected (unschedulable as-is). */
  cycles: string[][];
}

const QUADRANT_SORT: PortfolioQuadrant[] = ['quick-win', 'big-bet', 'fill-in', 'money-pit'];

/**
 * Produce a portfolio delivery sequence.
 *
 * Ordering doctrine:
 *   - respect HARD dependencies (A before B) via topological ordering,
 *   - among ready elements prefer higher value, then quadrant priority
 *     (quick-win > big-bet > fill-in > money-pit), then lower cost,
 *   - stop funding once the cumulative cost exceeds `budgetCap`; everything past
 *     the cap is DEFERRED with a named reason (opportunity cost is explicit),
 *   - money-pits are never auto-funded (default stance = stop), only surfaced.
 *
 * `budgetCap = Infinity` disables the cap (pure dependency ordering).
 */
export function sequencePortfolio(
  elements: PortfolioElement[],
  opts: { budgetCap?: number; midpoint?: number; fundMoneyPits?: boolean } = {}
): PortfolioSequence {
  const budgetCap = opts.budgetCap ?? Infinity;
  const fundMoneyPits = opts.fundMoneyPits ?? false;
  const classified = classifyPortfolio(elements, opts.midpoint);
  const byId = new Map(classified.map((e) => [e.id, e]));
  const acceptedIds = new Set(byId.keys());

  const funded: SequenceEntry[] = [];
  const fundedIds = new Set<string>();
  const deferred: PortfolioSequence['deferred'] = [];
  const blocked: PortfolioSequence['blocked'] = [];
  const cycles: string[][] = [];

  const hardDeps = (el: ClassifiedElement) =>
    (el.dependencies || [])
      .filter((d) => d.kind === 'hard' && acceptedIds.has(d.dependsOnElementId))
      .map((d) => d.dependsOnElementId);

  // Detect cycles among accepted hard deps (DFS).
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = [];
  const dfs = (id: string) => {
    color.set(id, GRAY);
    stack.push(id);
    const el = byId.get(id);
    if (el) {
      for (const dep of hardDeps(el)) {
        const c = color.get(dep) ?? WHITE;
        if (c === WHITE) dfs(dep);
        else if (c === GRAY) {
          const start = stack.indexOf(dep);
          if (start >= 0) cycles.push(stack.slice(start).concat(dep));
        }
      }
    }
    color.set(id, BLACK);
    stack.pop();
  };
  for (const id of acceptedIds) if ((color.get(id) ?? WHITE) === WHITE) dfs(id);
  const inCycle = new Set(cycles.flat());

  let cumulative = 0;
  const remaining = classified.filter(
    (e) => !inCycle.has(e.id) && (fundMoneyPits || e.quadrant !== 'money-pit')
  );

  // Greedy topological funding.
  let progress = true;
  while (progress && remaining.length > fundedIds.size) {
    progress = false;
    const ready = remaining
      .filter((e) => !fundedIds.has(e.id))
      .filter((e) => hardDeps(e).every((d) => fundedIds.has(d)));

    if (ready.length === 0) break;

    ready.sort((a, b) => {
      if (b.valueScore !== a.valueScore) return b.valueScore - a.valueScore;
      const qa = QUADRANT_SORT.indexOf(a.quadrant);
      const qb = QUADRANT_SORT.indexOf(b.quadrant);
      if (qa !== qb) return qa - qb;
      return (a.cost ?? 1) - (b.cost ?? 1);
    });

    const next = ready[0];
    const cost = next.cost ?? 1;
    if (cumulative + cost > budgetCap) {
      // Budget hit — defer this and everything still gated behind it or lower-ranked.
      break;
    }
    cumulative += cost;
    fundedIds.add(next.id);
    funded.push({
      elementId: next.id,
      title: next.title,
      quadrant: next.quadrant,
      cumulativeCost: cumulative,
      unlockedBy: hardDeps(next),
    });
    progress = true;
  }

  // Whatever accepted, non-cycle, non-money-pit element was not funded is deferred,
  // unless it is blocked by an unfunded hard dependency.
  for (const el of remaining) {
    if (fundedIds.has(el.id)) continue;
    const unmetHard = hardDeps(el).filter((d) => !fundedIds.has(d));
    if (unmetHard.length > 0) {
      blocked.push({
        elementId: el.id,
        title: el.title,
        reason: `hard dependency not funded: ${unmetHard.join(', ')}`,
      });
    } else {
      deferred.push({
        elementId: el.id,
        title: el.title,
        quadrant: el.quadrant,
        reason: 'budget cap reached — deferred to protect focus (opportunity cost accepted)',
      });
    }
  }

  return { funded, deferred, blocked, cycles };
}

// ---------------------------------------------------------------------------
// W2 move validation — rationale + trade-off + rejected alternative
// ---------------------------------------------------------------------------

export interface PortfolioMoveTradeoff {
  chosen: string;
  deferred: string;
  cost: string;
}

export interface PortfolioMoveRejectedAlternative {
  option: string;
  reason: string;
}

export interface PortfolioMoveConclusionFields {
  tradeoff?: PortfolioMoveTradeoff;
  rejectedAlternative?: PortfolioMoveRejectedAlternative;
}

export interface PortfolioMoveIssue {
  code:
    | 'missing-rationale'
    | 'unlinked-rationale'
    | 'dangling-links'
    | 'missing-tradeoff'
    | 'incomplete-tradeoff'
    | 'missing-rejected-alternative';
  messageEn: string;
  messagePl: string;
}

type MoveForValidation = {
  rationale?: string;
  linkedItemIds?: string[];
} & PortfolioMoveConclusionFields;

/**
 * CONCLUSION_LAYER W2 gate for a recommended portfolio move:
 * 1. rationale present AND anchored in existing element ids,
 * 2. mandatory trade-off with all three parts (chosen / deferred / cost),
 * 3. a rejected alternative with a reason. The canonical one for portfolios is
 *    "fund everything at once" -> "resource dilution"; the gate does not mandate
 *    that exact text but does require SOME named rejected option.
 */
export function validatePortfolioMove(
  move: MoveForValidation,
  session: { elementIds: Set<string> }
): PortfolioMoveIssue[] {
  const issues: PortfolioMoveIssue[] = [];

  if (!move.rationale?.trim()) {
    issues.push({
      code: 'missing-rationale',
      messageEn: 'Move has no rationale — which elements of the portfolio justify it?',
      messagePl: 'Ruch nie ma uzasadnienia — które elementy portfela go uzasadniają?',
    });
  }

  const links = move.linkedItemIds || [];
  if (links.length === 0) {
    issues.push({
      code: 'unlinked-rationale',
      messageEn: 'Move is linked to no portfolio elements — its rationale is untraceable.',
      messagePl:
        'Ruch nie jest powiązany z żadnym elementem portfela — uzasadnienie jest niesprawdzalne.',
    });
  } else {
    const dangling = links.filter((id) => !session.elementIds.has(id));
    if (dangling.length > 0) {
      issues.push({
        code: 'dangling-links',
        messageEn: `Move references elements that do not exist: ${dangling.join(', ')}.`,
        messagePl: `Ruch odwołuje się do elementów, których nie ma: ${dangling.join(', ')}.`,
      });
    }
  }

  if (!move.tradeoff) {
    issues.push({
      code: 'missing-tradeoff',
      messageEn:
        'Move has no trade-off — a recommendation without a trade-off is a list, not a decision (W2).',
      messagePl: 'Ruch nie ma trade-offu — rekomendacja bez trade-offu to lista, nie decyzja (W2).',
    });
  } else if (
    !move.tradeoff.chosen?.trim() ||
    !move.tradeoff.deferred?.trim() ||
    !move.tradeoff.cost?.trim()
  ) {
    issues.push({
      code: 'incomplete-tradeoff',
      messageEn:
        'Trade-off is incomplete — name what is funded, what is deferred, and at what cost.',
      messagePl:
        'Trade-off jest niekompletny — nazwij co finansujemy, co odkładamy i kosztem czego.',
    });
  }

  if (
    !move.rejectedAlternative ||
    !move.rejectedAlternative.option?.trim() ||
    !move.rejectedAlternative.reason?.trim()
  ) {
    issues.push({
      code: 'missing-rejected-alternative',
      messageEn:
        'Move names no rejected alternative — e.g. "fund everything at once" rejected because it dilutes resources.',
      messagePl:
        'Ruch nie wskazuje odrzuconego wariantu — np. „finansujemy wszystko naraz" odrzucone, bo rozmywa zasoby.',
    });
  }

  return issues;
}

export interface PortfolioMoveSetVerdict {
  ok: boolean;
  perMove: { title: string; issues: PortfolioMoveIssue[] }[];
}

export function validatePortfolioMoveSet(
  moves: (MoveForValidation & { title: string; proposalStatus?: string })[],
  elements: Pick<PortfolioElement, 'id'>[]
): PortfolioMoveSetVerdict {
  const session = { elementIds: new Set(elements.map((e) => e.id)) };
  const relevant = moves.filter(
    (m) => m.proposalStatus !== 'rejected' && m.proposalStatus !== 'rethinking'
  );
  const perMove = relevant.map((move) => ({
    title: move.title,
    issues: validatePortfolioMove(move, session),
  }));
  return { ok: perMove.every((m) => m.issues.length === 0), perMove };
}

/** Prompt block teaching the model the W2 move + sequencing contract (PL/EN aware). */
export function buildPortfolioMovePromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `Silnik liczy kwadrant 2x2 (quick-win / big-bet / fill-in / money-pit) i kolejność DETERMINISTYCZNIE z zaakceptowanych elementów — narrację dokładasz na wierzchu, nie zmyślasz kwadrantu ani kolejności.
KAŻDY rekomendowany ruch realizuje wariant W2 CONCLUSION_LAYER_STANDARD:
- "rationale": dlaczego — z odwołaniem do KONKRETNYCH id elementów; "linkedItemIds" muszą istnieć.
- "tradeoff": {"chosen":"co finansujemy","deferred":"co odkładamy","cost":"kosztem czego"} — OBOWIĄZKOWY.
- "rejectedAlternative": {"option":"...","reason":"..."} — OBOWIĄZKOWY; kanoniczny: „wszystko naraz" → „rozmycie zasobów".
- Kolejność portfela MUSI szanować zależności (A przed B) i budżet-cap; odłożone elementy nazwij wprost (koszt alternatywny jawny).`;
  }
  return `The engine computes the 2x2 quadrant (quick-win / big-bet / fill-in / money-pit) and the order DETERMINISTICALLY from accepted elements — you narrate on top, never invent the quadrant or the sequence.
EVERY recommended move implements variant W2 of CONCLUSION_LAYER_STANDARD:
- "rationale": why — referencing SPECIFIC element ids; "linkedItemIds" must exist.
- "tradeoff": {"chosen":"what we fund","deferred":"what we defer","cost":"at what cost"} — MANDATORY.
- "rejectedAlternative": {"option":"...","reason":"..."} — MANDATORY; canonical: "everything at once" -> "resource dilution".
- The portfolio order MUST respect dependencies (A before B) and the budget cap; name deferred elements explicitly (opportunity cost made visible).`;
}
