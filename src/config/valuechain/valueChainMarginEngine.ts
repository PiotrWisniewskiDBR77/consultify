/**
 * Value Chain (Porter) — margin engine (OXFORD O3, tool #4).
 *
 * Sibling of src/config/swot/swotTensionEngine.ts. Two disciplines transfer:
 *
 * 1. SYNTHESIS FROM THE ANSWERS, NOT FROM THE LLM. Just as SWOT derives SO/WO/ST/WT
 *    tensions deterministically from ACCEPTED items, this derives the margin map and
 *    the lever candidates deterministically from SCORED activities. The margin map
 *    (where value is created vs where it leaks) and the 2-3 lever activities (high
 *    cost x low maturity x value impact) are COMPUTED, with explicit activity links.
 *    The AI then narrates the lever on top of pairs that verifiably exist.
 *
 * 2. CONCLUSION_LAYER_STANDARD W2 ON MOVES. Every recommended move (improve /
 *    automate / outsource / integrate) carries rationale (which activities/levers
 *    justify it), a MANDATORY trade-off (what we defer and at what cost) and a
 *    rejected alternative. A recommendation without a trade-off is a list, not a
 *    decision. This block is a near-literal transfer of the SWOT move validator.
 */

import type {
  ValueActivity,
  ValueActivityId,
  ValueChainMove,
  ValueLever,
} from '@/store/useToolStore';

const SCORE_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 };
const MATURITY_GAP: Record<string, number> = { weak: 3, adequate: 2, strong: 1 };

export function isActiveActivity(a: Pick<ValueActivity, 'proposalStatus'>): boolean {
  return a.proposalStatus !== 'rejected' && a.proposalStatus !== 'rethinking';
}

/**
 * An activity is "scored" once the consultant has actually rated it (any field
 * moved off the neutral default OR carries drivers/evidence). Unscored activities
 * are excluded from the deterministic map so the engine reasons about what was
 * examined, not the empty scaffold.
 */
export function isScoredActivity(a: ValueActivity): boolean {
  const moved =
    a.costContribution !== 'medium' ||
    a.valueContribution !== 'medium' ||
    a.marginRole !== 'neutral' ||
    (a.maturity !== undefined && a.maturity !== 'adequate');
  const described = (a.drivers && a.drivers.length > 0) || (a.evidence && a.evidence.length > 0);
  return moved || Boolean(described);
}

// ---------------------------------------------------------------------------
// Margin map — where value is created vs where it leaks (computed, not narrated)
// ---------------------------------------------------------------------------

export type MarginPole = 'creator' | 'neutral' | 'drain';

export interface MarginMapEntry {
  activityId: ValueActivityId;
  kind: ValueActivity['kind'];
  pole: MarginPole;
  /** cost weight (1-3): higher = larger share of total cost. */
  cost: number;
  /** value weight (1-3): higher = more effect on willingness-to-pay. */
  value: number;
  /** maturity gap (1-3): higher = further from best-in-class. */
  maturityGap: number;
  /**
   * leverScore — how strong a candidate this activity is for a margin move.
   * DRAINS score on cost x maturity-gap (fix the leak); CREATORS score on
   * value x maturity-gap (invest to widen the moat). This is the doctrine
   * "high cost x low maturity x impact on value".
   */
  leverScore: number;
}

export interface MarginMap {
  entries: MarginMapEntry[];
  creators: ValueActivityId[];
  drains: ValueActivityId[];
  /** Total cost concentrated in drains vs creators — the leak vs the engine. */
  costInDrains: number;
  costInCreators: number;
}

export function computeMarginMap(
  activities: Partial<Record<ValueActivityId, ValueActivity>>
): MarginMap {
  const entries: MarginMapEntry[] = [];
  (Object.values(activities) as ValueActivity[])
    .filter((a): a is ValueActivity => Boolean(a) && isActiveActivity(a) && isScoredActivity(a))
    .forEach((a) => {
      const cost = SCORE_WEIGHT[a.costContribution] ?? 2;
      const value = SCORE_WEIGHT[a.valueContribution] ?? 2;
      const maturityGap = MATURITY_GAP[a.maturity ?? 'adequate'] ?? 2;
      const pole: MarginPole = a.marginRole;
      // Drains: the leak is proportional to cost tied up in a low-maturity activity.
      // Creators: the upside is proportional to value that better maturity would widen.
      const leverBase = pole === 'drain' ? cost : pole === 'creator' ? value : (cost + value) / 2;
      const leverScore = leverBase * maturityGap;
      entries.push({ activityId: a.id, kind: a.kind, pole, cost, value, maturityGap, leverScore });
    });

  const creators = entries.filter((e) => e.pole === 'creator').map((e) => e.activityId);
  const drains = entries.filter((e) => e.pole === 'drain').map((e) => e.activityId);
  const costInDrains = entries
    .filter((e) => e.pole === 'drain')
    .reduce((sum, e) => sum + e.cost, 0);
  const costInCreators = entries
    .filter((e) => e.pole === 'creator')
    .reduce((sum, e) => sum + e.cost, 0);

  return { entries, creators, drains, costInDrains, costInCreators };
}

// ---------------------------------------------------------------------------
// Lever candidates — the 2-3 activities where a margin move pays off most
// ---------------------------------------------------------------------------

export type LeverMoveType = ValueLever['leverType'];

export interface LeverCandidate {
  activityId: ValueActivityId;
  kind: ValueActivity['kind'];
  pole: MarginPole;
  leverScore: number;
  /**
   * Suggested lever type from the score shape — a starting hypothesis the AI can
   * confirm or override, never a hard rule:
   * - drain + high cost + weak maturity -> automate or outsource (cut the leak)
   * - creator + high value + weak maturity -> value-enhancement (widen the moat)
   * - support activity linked to several primaries -> linkage-optimization
   */
  suggestedLeverType: LeverMoveType;
  rationaleEn: string;
  rationalePl: string;
}

const suggestLeverType = (e: MarginMapEntry): LeverMoveType => {
  if (e.pole === 'drain') {
    // A costly, immature drain: automate if in-house-able, outsource if non-core.
    if (e.kind === 'support') return 'outsource';
    return e.cost >= 3 ? 'cost-reduction' : 'outsource';
  }
  if (e.pole === 'creator') {
    return 'value-enhancement';
  }
  // Neutral support activity that touches many primaries → optimize the linkage.
  return e.kind === 'support' ? 'linkage-optimization' : 'cost-reduction';
};

const leverRationale = (e: MarginMapEntry): { en: string; pl: string } => {
  const poleEn =
    e.pole === 'drain'
      ? 'erodes margin'
      : e.pole === 'creator'
        ? 'creates margin'
        : 'is neutral on margin';
  const polePl =
    e.pole === 'drain'
      ? 'wyciąga marżę'
      : e.pole === 'creator'
        ? 'tworzy marżę'
        : 'jest neutralne dla marży';
  const costEn = e.cost >= 3 ? 'high cost' : e.cost === 2 ? 'medium cost' : 'low cost';
  const costPl = e.cost >= 3 ? 'wysoki koszt' : e.cost === 2 ? 'średni koszt' : 'niski koszt';
  const matEn =
    e.maturityGap >= 3
      ? 'weak maturity'
      : e.maturityGap === 2
        ? 'adequate maturity'
        : 'strong maturity';
  const matPl =
    e.maturityGap >= 3
      ? 'słaba dojrzałość'
      : e.maturityGap === 2
        ? 'przeciętna dojrzałość'
        : 'wysoka dojrzałość';
  return {
    en: `${costEn} + ${matEn}; ${poleEn} — highest leverage sits here.`,
    pl: `${costPl} + ${matPl}; ${polePl} — tu jest największa dźwignia.`,
  };
};

/**
 * Rank scored activities by leverScore and return the top `max` as lever
 * candidates. These are the activities where "high cost x low maturity x value
 * impact" concentrate — the doctrine's 2-3 dźwignie. Ties broken by cost then
 * maturity gap so the most expensive, least mature activity wins.
 */
export function deriveLeverCandidates(
  activities: Partial<Record<ValueActivityId, ValueActivity>>,
  max = 3
): LeverCandidate[] {
  const map = computeMarginMap(activities);
  return [...map.entries]
    .sort((a, b) => b.leverScore - a.leverScore || b.cost - a.cost || b.maturityGap - a.maturityGap)
    .slice(0, max)
    .map((e) => {
      const r = leverRationale(e);
      return {
        activityId: e.activityId,
        kind: e.kind,
        pole: e.pole,
        leverScore: e.leverScore,
        suggestedLeverType: suggestLeverType(e),
        rationaleEn: r.en,
        rationalePl: r.pl,
      };
    });
}

// ---------------------------------------------------------------------------
// Coverage check for the review gate
// ---------------------------------------------------------------------------

export interface MarginMapCoverage {
  scoredCount: number;
  primaryScored: number;
  supportScored: number;
  /** Activities left on the neutral default — the analysis has blind spots. */
  unscored: ValueActivityId[];
  /** True once >=1 creator AND >=1 drain exist: the map has a real gradient. */
  hasGradient: boolean;
}

const ALL_ACTIVITY_IDS: ValueActivityId[] = [
  'inboundLogistics',
  'operations',
  'outboundLogistics',
  'marketingSales',
  'service',
  'infrastructure',
  'hrManagement',
  'technology',
  'procurement',
];

export function computeMarginMapCoverage(
  activities: Partial<Record<ValueActivityId, ValueActivity>>
): MarginMapCoverage {
  const scored = (Object.values(activities) as ValueActivity[]).filter(
    (a): a is ValueActivity => Boolean(a) && isActiveActivity(a) && isScoredActivity(a)
  );
  const unscored = ALL_ACTIVITY_IDS.filter((id) => {
    const a = activities[id];
    return !a || !isScoredActivity(a);
  });
  const map = computeMarginMap(activities);
  return {
    scoredCount: scored.length,
    primaryScored: scored.filter((a) => a.kind === 'primary').length,
    supportScored: scored.filter((a) => a.kind === 'support').length,
    unscored,
    hasGradient: map.creators.length > 0 && map.drains.length > 0,
  };
}

// ---------------------------------------------------------------------------
// W2 move validation — rationale + trade-off + rejected alternative
// (near-literal transfer from swotTensionEngine.ts)
// ---------------------------------------------------------------------------

export interface ValueChainMoveTradeoff {
  /** What we choose to do (improve/automate/outsource/integrate). */
  chosen: string;
  /** What we defer/give up by choosing it. */
  deferred: string;
  /** At what cost (the price of the deferral, named). */
  cost: string;
}

export interface ValueChainMoveRejectedAlternative {
  option: string;
  reason: string;
}

export interface ValueChainMoveConclusionFields {
  tradeoff?: ValueChainMoveTradeoff;
  rejectedAlternative?: ValueChainMoveRejectedAlternative;
}

export interface ValueChainMoveIssue {
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

type MoveForValidation = Pick<
  ValueChainMove,
  'rationale' | 'linkedActivityIds' | 'linkedLeverIds'
> &
  ValueChainMoveConclusionFields;

/**
 * CONCLUSION_LAYER W2 gate for a recommended move:
 * 1. rationale present AND anchored in existing session elements (activities or levers),
 * 2. mandatory trade-off with all three parts (chosen / deferred / cost),
 * 3. a rejected alternative with a reason ("no decision was made" otherwise).
 *
 * For a value-chain move this bites hard: "outsource X" without naming what
 * control you give up (the deferred) and the dependency you take on (the cost)
 * is exactly the recommendation that gets a client burned.
 */
export function validateValueChainMove(
  move: MoveForValidation,
  session: { activityIds: Set<string>; leverIds: Set<string> }
): ValueChainMoveIssue[] {
  const issues: ValueChainMoveIssue[] = [];

  if (!move.rationale?.trim()) {
    issues.push({
      code: 'missing-rationale',
      messageEn: 'Move has no rationale — which activities or levers justify it?',
      messagePl: 'Ruch nie ma uzasadnienia — które ogniwa lub dźwignie go uzasadniają?',
    });
  }

  const links = [...(move.linkedActivityIds || []), ...(move.linkedLeverIds || [])];
  if (links.length === 0) {
    issues.push({
      code: 'unlinked-rationale',
      messageEn: 'Move is linked to no activities or levers — its rationale is untraceable.',
      messagePl:
        'Ruch nie jest powiązany z żadnym ogniwem ani dźwignią — uzasadnienie jest niesprawdzalne.',
    });
  } else {
    const dangling = [
      ...(move.linkedActivityIds || []).filter((id) => !session.activityIds.has(id)),
      ...(move.linkedLeverIds || []).filter((id) => !session.leverIds.has(id)),
    ];
    if (dangling.length > 0) {
      issues.push({
        code: 'dangling-links',
        messageEn: `Move references elements that do not exist in the session: ${dangling.join(', ')}.`,
        messagePl: `Ruch odwołuje się do elementów, których nie ma w sesji: ${dangling.join(', ')}.`,
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
        'Trade-off is incomplete — it must name what is chosen, what is deferred, and at what cost.',
      messagePl:
        'Trade-off jest niekompletny — musi nazywać co wybieramy, co odkładamy i kosztem czego.',
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
        'Move names no rejected alternative — which option (improve vs automate vs outsource vs integrate) was considered and why was it dropped?',
      messagePl:
        'Ruch nie wskazuje odrzuconego wariantu — jaka opcja (usprawnij vs zautomatyzuj vs outsourcuj vs zintegruj) była rozważana i dlaczego odpadła?',
    });
  }

  return issues;
}

export interface ValueChainMoveSetVerdict {
  ok: boolean;
  perMove: { title: string; issues: ValueChainMoveIssue[] }[];
}

/** Validate all active moves of a session in one pass (review gate input). */
export function validateValueChainMoveSet(
  moves: (MoveForValidation & { title: string; proposalStatus?: string })[],
  activities: Pick<ValueActivity, 'id'>[],
  levers: Pick<ValueLever, 'id'>[]
): ValueChainMoveSetVerdict {
  const session = {
    activityIds: new Set(activities.map((a) => a.id)),
    leverIds: new Set(levers.map((l) => l.id)),
  };
  const relevant = moves.filter(
    (m) => m.proposalStatus !== 'rejected' && m.proposalStatus !== 'rethinking'
  );
  const perMove = relevant.map((move) => ({
    title: move.title,
    issues: validateValueChainMove(move, session),
  }));
  return { ok: perMove.every((m) => m.issues.length === 0), perMove };
}

/** Prompt block teaching the model the W2 move contract (PL/EN aware). */
export function buildValueChainMovePromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `KAŻDY rekomendowany ruch realizuje wariant W2 CONCLUSION_LAYER_STANDARD:
- Ruch to jedna z czterech decyzji o ogniwie: USPRAWNIJ / ZAUTOMATYZUJ / OUTSOURCUJ / ZINTEGRUJ — nazwij którą i dlaczego akurat ją.
- "rationale": dlaczego ten ruch — z odwołaniem do KONKRETNYCH ogniw/dźwigni; "linkedActivityIds"/"linkedLeverIds" muszą wskazywać istniejące id.
- "tradeoff": {"chosen":"co wybieramy","deferred":"co odkładamy","cost":"kosztem czego"} — OBOWIĄZKOWY. Outsourcing bez nazwania utraconej kontroli i przyjętej zależności to pułapka.
- "rejectedAlternative": {"option":"rozważany wariant","reason":"dlaczego odrzucony"} — OBOWIĄZKOWY.
- "firstStep": czasownik + artefakt + rola odpowiedzialna (nie „firma powinna").
- Maks. 3-5 ruchów, skupionych na 2-3 ogniwach-dźwigniach z mapy marży; kolejność uzasadniona (impact × effort, warunki wstępne nazwane wprost).`;
  }
  return `EVERY recommended move implements variant W2 of CONCLUSION_LAYER_STANDARD:
- A move is one of four decisions about an activity: IMPROVE / AUTOMATE / OUTSOURCE / INTEGRATE — name which and why that one.
- "rationale": why this move — referencing SPECIFIC activities/levers; "linkedActivityIds"/"linkedLeverIds" must point at existing ids.
- "tradeoff": {"chosen":"what we choose","deferred":"what we defer","cost":"at what cost"} — MANDATORY. Outsourcing without naming the control given up and the dependency taken on is a trap.
- "rejectedAlternative": {"option":"considered option","reason":"why rejected"} — MANDATORY.
- "firstStep": verb + artifact + accountable role (never "the firm should").
- Max 3-5 moves, focused on the 2-3 lever activities from the margin map; ordering justified (impact × effort, prerequisites named explicitly).`;
}
