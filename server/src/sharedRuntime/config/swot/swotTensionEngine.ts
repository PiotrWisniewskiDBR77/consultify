/** GENERATED MIRROR — run scripts/cleanup/sync-server-runtime-mirrors.mjs; do not edit directly. */
/**
 * Dynamic SWOT — tension engine (OXFORD O3 pilot).
 *
 * Enforces the audit gap "napięcia SO/WO/ST/WT nieegzekwowane":
 * tensions are COMPUTED from ACCEPTED items — deterministically, with explicit
 * item links — instead of arriving as free-floating AI prose. The AI then narrates
 * insight/whyNow on top of pairs that verifiably exist in the session.
 *
 * It also enforces CONCLUSION_LAYER_STANDARD W2 on recommended moves:
 * every move must carry rationale (which elements justify it), a trade-off
 * (what we defer and at what cost) and a rejected alternative with a reason.
 * A recommendation without a trade-off is a list, not a decision.
 */

import type { SWOTItem, SWOTMove, SWOTTension } from '../../types/swot.js';

export type SwotTensionType = 'SO' | 'WO' | 'ST' | 'WT';

export const TENSION_TYPE_TO_POSTURE: Record<
  SwotTensionType,
  { type: SWOTTension['type']; titleEn: string; titlePl: string }
> = {
  SO: { type: 'attack', titleEn: 'Attack opportunity', titlePl: 'Atakuj szansę' },
  WO: { type: 'repair', titleEn: 'Repair to capture', titlePl: 'Napraw, by sięgnąć' },
  ST: { type: 'defend', titleEn: 'Defend with strength', titlePl: 'Broń się siłą' },
  WT: { type: 'protect', titleEn: 'Protect the exposure', titlePl: 'Chroń ekspozycję' },
};

const IMPACT_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 };

export function isAcceptedSwotItem(item: Pick<SWOTItem, 'proposalStatus' | 'status'>): boolean {
  if (item.proposalStatus) {
    return item.proposalStatus === 'accepted';
  }
  // Items created directly by the user (no proposal flow) count when marked accepted
  // or carry no status at all (legacy user-entered items).
  return item.status === 'accepted' || item.status === undefined;
}

export interface DerivedTensionCandidate {
  type: SwotTensionType;
  posture: SWOTTension['type'];
  titleEn: string;
  titlePl: string;
  /** Exactly [internalItemId, externalItemId]. Both verified to exist and be accepted. */
  linkedItemIds: [string, string];
  /** impact-weighted priority (higher = more strategic weight). */
  weight: number;
}

const PAIRING: {
  type: SwotTensionType;
  internal: SWOTItem['quadrant'];
  external: SWOTItem['quadrant'];
}[] = [
  { type: 'SO', internal: 'strengths', external: 'opportunities' },
  { type: 'WO', internal: 'weaknesses', external: 'opportunities' },
  { type: 'ST', internal: 'strengths', external: 'threats' },
  { type: 'WT', internal: 'weaknesses', external: 'threats' },
];

/**
 * Derive tension candidates from ACCEPTED items only.
 * Every SO/WO/ST/WT pair is explicit and traceable: both linked ids exist in the
 * accepted set. Pairs are ranked by combined impact; per type the top `maxPerType`
 * survive so the session discusses the strongest tensions, not all N×M combinations.
 */
export function deriveTensionCandidates(
  items: SWOTItem[],
  maxPerType = 2
): DerivedTensionCandidate[] {
  const accepted = items.filter(isAcceptedSwotItem);
  const byQuadrant = (quadrant: SWOTItem['quadrant']) =>
    accepted.filter((item) => item.quadrant === quadrant);

  const candidates: DerivedTensionCandidate[] = [];
  PAIRING.forEach(({ type, internal, external }) => {
    const posture = TENSION_TYPE_TO_POSTURE[type];
    const pairs: DerivedTensionCandidate[] = [];
    byQuadrant(internal).forEach((internalItem) => {
      byQuadrant(external).forEach((externalItem) => {
        pairs.push({
          type,
          posture: posture.type,
          titleEn: posture.titleEn,
          titlePl: posture.titlePl,
          linkedItemIds: [internalItem.id, externalItem.id],
          weight:
            (IMPACT_WEIGHT[internalItem.impact] || 2) + (IMPACT_WEIGHT[externalItem.impact] || 2),
        });
      });
    });
    pairs.sort((a, b) => b.weight - a.weight);
    candidates.push(...pairs.slice(0, maxPerType));
  });
  return candidates;
}

export interface TensionCoverage {
  covered: SwotTensionType[];
  /** Types that cannot be formed because a quadrant has no accepted items. */
  structurallyEmpty: SwotTensionType[];
  /** Types that COULD be formed from accepted items but no tension exists yet. */
  missing: SwotTensionType[];
}

/**
 * Coverage check used by the review gate: which tension types are represented,
 * which are impossible (no accepted items in a quadrant), and which are missing
 * despite the material being there — the last group blocks completion.
 */
export function computeTensionCoverage(
  items: SWOTItem[],
  tensions: Pick<SWOTTension, 'type' | 'proposalStatus'>[]
): TensionCoverage {
  const accepted = items.filter(isAcceptedSwotItem);
  const has = (quadrant: SWOTItem['quadrant']) =>
    accepted.some((item) => item.quadrant === quadrant);
  const activeTensions = tensions.filter(
    (t) => t.proposalStatus !== 'rejected' && t.proposalStatus !== 'rethinking'
  );
  const postureToType = new Map<SWOTTension['type'], SwotTensionType>(
    (
      Object.entries(TENSION_TYPE_TO_POSTURE) as [SwotTensionType, { type: SWOTTension['type'] }][]
    ).map(([tensionType, { type }]) => [type, tensionType])
  );
  const coveredSet = new Set<SwotTensionType>();
  activeTensions.forEach((t) => {
    const mapped = postureToType.get(t.type);
    if (mapped) coveredSet.add(mapped);
  });

  const covered: SwotTensionType[] = [];
  const structurallyEmpty: SwotTensionType[] = [];
  const missing: SwotTensionType[] = [];
  PAIRING.forEach(({ type, internal, external }) => {
    const formable = has(internal) && has(external);
    if (coveredSet.has(type)) covered.push(type);
    else if (!formable) structurallyEmpty.push(type);
    else missing.push(type);
  });
  return { covered, structurallyEmpty, missing };
}

// ---------------------------------------------------------------------------
// W2 move validation — rationale + trade-off + rejected alternative
// ---------------------------------------------------------------------------

export interface SwotMoveTradeoff {
  /** What we choose to do. */
  chosen: string;
  /** What we defer/give up by choosing it. */
  deferred: string;
  /** At what cost (the price of the deferral, named). */
  cost: string;
}

export interface SwotMoveRejectedAlternative {
  option: string;
  reason: string;
}

export interface SwotMoveConclusionFields {
  tradeoff?: SwotMoveTradeoff;
  rejectedAlternative?: SwotMoveRejectedAlternative;
}

export interface SwotMoveIssue {
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

type MoveForValidation = Pick<SWOTMove, 'rationale' | 'linkedItemIds' | 'linkedTensionIds'> &
  SwotMoveConclusionFields;

/**
 * CONCLUSION_LAYER W2 gate for a recommended move:
 * 1. rationale present AND anchored in existing session elements (items or tensions),
 * 2. mandatory trade-off with all three parts (chosen / deferred / cost),
 * 3. a rejected alternative with a reason ("no decision was made" otherwise).
 */
export function validateRecommendedMove(
  move: MoveForValidation,
  session: { itemIds: Set<string>; tensionIds: Set<string> }
): SwotMoveIssue[] {
  const issues: SwotMoveIssue[] = [];

  if (!move.rationale?.trim()) {
    issues.push({
      code: 'missing-rationale',
      messageEn: 'Move has no rationale — which elements of the analysis justify it?',
      messagePl: 'Ruch nie ma uzasadnienia — które elementy analizy go uzasadniają?',
    });
  }

  const links = [...(move.linkedItemIds || []), ...(move.linkedTensionIds || [])];
  if (links.length === 0) {
    issues.push({
      code: 'unlinked-rationale',
      messageEn: 'Move is linked to no SWOT items or tensions — its rationale is untraceable.',
      messagePl:
        'Ruch nie jest powiązany z żadnym elementem SWOT ani napięciem — uzasadnienie jest niesprawdzalne.',
    });
  } else {
    const dangling = [
      ...(move.linkedItemIds || []).filter((id) => !session.itemIds.has(id)),
      ...(move.linkedTensionIds || []).filter((id) => !session.tensionIds.has(id)),
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
        'Move names no rejected alternative — which option was considered and why was it dropped?',
      messagePl:
        'Ruch nie wskazuje odrzuconego wariantu — jaka opcja była rozważana i dlaczego odpadła?',
    });
  }

  return issues;
}

export interface SwotMoveSetVerdict {
  ok: boolean;
  perMove: { title: string; issues: SwotMoveIssue[] }[];
}

/** Validate all accepted/pending moves of a session in one pass (review gate input). */
export function validateMoveSet(
  moves: (MoveForValidation & { title: string; proposalStatus?: string })[],
  items: Pick<SWOTItem, 'id'>[],
  tensions: Pick<SWOTTension, 'id'>[]
): SwotMoveSetVerdict {
  const session = {
    itemIds: new Set(items.map((i) => i.id)),
    tensionIds: new Set(tensions.map((t) => t.id)),
  };
  const relevant = moves.filter(
    (m) => m.proposalStatus !== 'rejected' && m.proposalStatus !== 'rethinking'
  );
  const perMove = relevant.map((move) => ({
    title: move.title,
    issues: validateRecommendedMove(move, session),
  }));
  return { ok: perMove.every((m) => m.issues.length === 0), perMove };
}

/** Prompt block teaching the model the W2 move contract (PL/EN aware). */
export function buildMoveConclusionPromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `KAŻDY rekomendowany ruch realizuje wariant W2 CONCLUSION_LAYER_STANDARD:
- "rationale": dlaczego ten ruch — z odwołaniem do KONKRETNYCH elementów sesji; "linkedItemIds"/"linkedTensionIds" muszą wskazywać istniejące id.
- "tradeoff": {"chosen":"co wybieramy","deferred":"co odkładamy","cost":"kosztem czego"} — OBOWIĄZKOWY; rekomendacja bez trade-offu to lista, nie decyzja.
- "rejectedAlternative": {"option":"rozważany wariant","reason":"dlaczego odrzucony"} — OBOWIĄZKOWY.
- "firstStep": czasownik + artefakt + rola odpowiedzialna (nie "organizacja powinna").
- Maks. 3-5 ruchów; kolejność uzasadniona (impact × effort, prerequisites nazwane wprost).`;
  }
  return `EVERY recommended move implements variant W2 of CONCLUSION_LAYER_STANDARD:
- "rationale": why this move — referencing SPECIFIC session elements; "linkedItemIds"/"linkedTensionIds" must point at existing ids.
- "tradeoff": {"chosen":"what we choose","deferred":"what we defer","cost":"at what cost"} — MANDATORY; a recommendation without a trade-off is a list, not a decision.
- "rejectedAlternative": {"option":"considered option","reason":"why rejected"} — MANDATORY.
- "firstStep": verb + artifact + accountable role (never "the organization should").
- Max 3-5 moves; ordering justified (impact × effort, prerequisites named explicitly).`;
}
