/**
 * Narrative Engine — synthesis engine + W2 move validator.
 *
 * This is the pure, testable brain of the tool. It takes the scored message
 * pillars plus audience/core-message context and produces:
 *
 *   1. a per-pillar narrative score = resonance × proof strength (derived from facts)
 *   2. a ranking of the pillars with a plain rationale (what opens, what proves,
 *      what gets reframed or cut)
 *   3. a W2-validated delivery-move sequence, where every move carries:
 *        - rationale     (why do this now)
 *        - tradeOff      (what it costs you / what you give up)
 *        - rejectedVariant (the alternative deliberately NOT taken, and why)
 *
 * The W2 validator is the near-literal transfer of the Ansoff/SWOT/Portfolio
 * "move must justify itself" contract: a move is only VALID when all three
 * fields are present and non-trivial. Invalid moves are surfaced with the
 * specific missing field so the UI (or AI) can repair them.
 */

import type { NarrativeMove, NarrativePillar, NarrativeEngineData } from '@/store/useToolStore';

import { type Bilingual, type ResonanceBand } from './deepeningLadder';

type Level = 'high' | 'medium' | 'low';

const LEVEL_SCORE: Record<Level, number> = { high: 3, medium: 2, low: 1 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const round1 = (value: number) => Math.round(value * 10) / 10;

const localize = (text: Bilingual, isPolish: boolean) => (isPolish ? text.pl : text.en);

const asBand = (value: unknown): ResonanceBand =>
  value === 'high' || value === 'medium' || value === 'low' ? value : 'medium';

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface PillarScore {
  id: string;
  title: string;
  /** 1..3 audience resonance. */
  resonance: number;
  /** 1..3 proof strength derived from proof-point count. */
  proofStrength: number;
  /** resonance × proofStrength, 1..9 (higher = stronger pillar). */
  score: number;
  band: ResonanceBand;
  /** count of proof points backing this pillar. */
  proofCount: number;
}

const isActive = (p: NarrativePillar) =>
  p.proposalStatus !== 'rejected' && p.proposalStatus !== 'rethinking';

const proofStrengthFrom = (count: number): number => (count >= 2 ? 3 : count === 1 ? 2 : 1);

const scorePillar = (p: NarrativePillar): PillarScore => {
  const band = asBand(p.audienceResonance);
  const resonance = LEVEL_SCORE[band];
  const proofCount = (p.proofPoints?.filter((pp) => pp && pp.trim()).length || 0);
  const proofStrength = proofStrengthFrom(proofCount);
  const score = round1(resonance * proofStrength);

  return {
    id: p.id,
    title: p.title,
    resonance,
    proofStrength,
    score,
    band,
    proofCount,
  };
};

export interface NarrativeRanking {
  scores: PillarScore[];
  /** pillar ids ordered best-first among active pillars. */
  ordered: string[];
  rationale: Bilingual;
}

/**
 * Rank the message pillars. Only active (non-rejected) pillars are ranked; the
 * ranking drives the open / prove / reframe / cut delivery sequence.
 */
export function rankPillars(data: NarrativeEngineData): NarrativeRanking {
  const active = (data.pillars || []).filter(isActive);
  const scores = active.map(scorePillar);

  const ordered = [...scores]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // tie-break: higher resonance wins, then more proof
      if (a.resonance !== b.resonance) return b.resonance - a.resonance;
      return b.proofCount - a.proofCount;
    })
    .map((s) => s.id);

  const top = scores.find((s) => s.id === ordered[0]);
  const bottom = ordered.length > 1 ? scores.find((s) => s.id === ordered[ordered.length - 1]) : undefined;

  const rationale: Bilingual = top
    ? {
        pl: bottom
          ? `Najsilniejszy filar to „${top.title}" (siła ${top.score}/9: rezonans ${top.resonance} × dowód ${top.proofStrength}). Najsłabszy — „${bottom.title}" (${bottom.score}/9), więc to on jest kandydatem do przeramowania lub cięcia.`
          : `Najsilniejszy filar to „${top.title}" (siła ${top.score}/9: rezonans ${top.resonance} × dowód ${top.proofStrength}).`,
        en: bottom
          ? `The strongest pillar is "${top.title}" (strength ${top.score}/9: resonance ${top.resonance} × proof ${top.proofStrength}). The weakest is "${bottom.title}" (${bottom.score}/9), so it is the candidate to reframe or cut.`
          : `The strongest pillar is "${top.title}" (strength ${top.score}/9: resonance ${top.resonance} × proof ${top.proofStrength}).`,
      }
    : {
        pl: 'Brak aktywnych filarów — dodaj filary przekazu, aby zbudować ranking i łuk narracji.',
        en: 'No active pillars yet — add message pillars to build a ranking and a narrative arc.',
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
  /** what the move costs / what you give up. */
  tradeOff?: string;
  /** the alternative deliberately NOT taken, and why. */
  rejectedVariant?: string;
}

export interface W2ValidationResult {
  valid: boolean;
  missing: W2Field[];
  /** fields present but too thin to count as a real justification. */
  weak: W2Field[];
}

const MIN_JUSTIFICATION_LEN = 12;

const isThin = (value?: string) => !value || value.trim().length < MIN_JUSTIFICATION_LEN;

/**
 * The W2 contract: a move is only valid when it justifies itself with a
 * rationale, an explicit trade-off, and a rejected variant. Near-literal
 * transfer of the Ansoff/SWOT/Portfolio move governance.
 */
export function validateW2Move(move: W2MoveInput): W2ValidationResult {
  const missing: W2Field[] = [];
  const weak: W2Field[] = [];

  (['rationale', 'tradeOff', 'rejectedVariant'] as W2Field[]).forEach((field) => {
    const value = move[field];
    if (!value || !value.trim()) {
      missing.push(field);
    } else if (isThin(value)) {
      weak.push(field);
    }
  });

  return { valid: missing.length === 0 && weak.length === 0, missing, weak };
}

export interface SequencedMove {
  order: number;
  pillarId: string;
  category: NarrativeMove['category'];
  title: Bilingual;
  rationale: Bilingual;
  tradeOff: Bilingual;
  rejectedVariant: Bilingual;
  expectedImpact: Level;
  estimatedEffort: Level;
  riskLevel: Level;
  /** Every synthesized move is self-validated so the UI never renders an unjustified move. */
  validation: W2ValidationResult;
}

/**
 * Build a W2-validated delivery-move sequence from the ranked pillars. The rule
 * of the sequence: OPEN with the strongest pillar; PROVE the strongest pillar
 * that lacks a proof point; REFRAME a mid pillar rather than defend it; and CUT
 * the weakest pillar to reclaim audience attention.
 */
export function buildW2MoveSequence(data: NarrativeEngineData): SequencedMove[] {
  const { scores, ordered } = rankPillars(data);
  if (ordered.length === 0) return [];

  const scoreOf = (id: string) => scores.find((s) => s.id === id)!;
  const moves: SequencedMove[] = [];
  let order = 1;

  const primary = ordered[0];
  const primaryScore = scoreOf(primary);
  const cut = ordered.length > 1 ? ordered[ordered.length - 1] : undefined;
  const cutScore = cut ? scoreOf(cut) : undefined;

  // Lead move: OPEN with the strongest pillar.
  moves.push({
    order: order++,
    pillarId: primary,
    category: 'open',
    title: {
      pl: `Otwórz narrację filarem „${primaryScore.title}"`,
      en: `Open the narrative with "${primaryScore.title}"`,
    },
    rationale: {
      pl: `To najsilniejszy filar (${primaryScore.score}/9: rezonans ${primaryScore.resonance} × dowód ${primaryScore.proofStrength}), więc kupuje uwagę odbiorcy w pierwszych sekundach, gdy zapada decyzja o słuchaniu.`,
      en: `This is the strongest pillar (${primaryScore.score}/9: resonance ${primaryScore.resonance} × proof ${primaryScore.proofStrength}), so it buys audience attention in the first seconds, when the decision to listen is made.`,
    },
    tradeOff: {
      pl: 'Kosztem napięcia dramaturgicznego — zaczynając od najmocniejszej tezy, świadomie rezygnujecie z budowania powolnego crescendo.',
      en: 'At the cost of dramatic build-up — by leading with the strongest claim you deliberately give up a slow crescendo.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy otwarcie od kontekstu i tła: zanim dojdziecie do tezy, odbiorca zdąży odpłynąć i już jej nie usłyszy.',
      en: 'We reject opening with context and background: by the time you reach the claim, the audience has drifted and will not hear it.',
    },
    expectedImpact: primaryScore.band,
    estimatedEffort: 'low',
    riskLevel: 'low',
    validation: { valid: true, missing: [], weak: [] },
  });

  // If the lead pillar lacks a proof point, insert a PROVE move before delivery.
  if (primaryScore.proofCount === 0) {
    moves.push({
      order: order++,
      pillarId: primary,
      category: 'prove',
      title: {
        pl: `Dowieść „${primaryScore.title}" jednym twardym proof pointem`,
        en: `Prove "${primaryScore.title}" with one hard proof point`,
      },
      rationale: {
        pl: 'Ten filar prowadzi narrację, ale nie ma jeszcze dowodu — bez proof pointa najmocniejsza teza brzmi jak slogan i traci wiarygodność.',
        en: 'This pillar leads the narrative but carries no proof yet — without a proof point the strongest claim sounds like a slogan and loses credibility.',
      },
      tradeOff: {
        pl: 'Kosztem czasu na zebranie dowodu (dane, przykład, referencja), w zamian za tezę, która przetrwa trudne pytanie.',
        en: 'At the cost of time to gather the proof (data, example, reference), in exchange for a claim that survives a hard question.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy wygłoszenie tezy bez dowodu: pierwsze „a skąd to wiecie?" rozbija całą narrację zbudowaną na tym filarze.',
        en: 'We reject stating the claim without proof: the first "how do you know?" shatters the entire narrative built on this pillar.',
      },
      expectedImpact: 'high',
      estimatedEffort: 'medium',
      riskLevel: 'low',
      validation: { valid: true, missing: [], weak: [] },
    });
  }

  // Second pillar (if any) beyond the primary and not the cut one: REFRAME / build.
  const second = ordered.find((id) => id !== primary && id !== cut);
  if (second) {
    const secondScore = scoreOf(second);
    moves.push({
      order: order++,
      pillarId: second,
      category: 'reframe',
      title: {
        pl: `Przeramuj „${secondScore.title}", żeby wsparł tezę główną`,
        en: `Reframe "${secondScore.title}" to support the lead claim`,
      },
      rationale: {
        pl: `Filar średniej siły (${secondScore.score}/9) wnosi najwięcej jako wsparcie tezy głównej, a nie jako osobna scena walcząca o uwagę.`,
        en: `A mid-strength pillar (${secondScore.score}/9) contributes most as support for the lead claim, not as a separate stage fighting for attention.`,
      },
      tradeOff: {
        pl: 'Kosztem samodzielności tego filara — świadomie podporządkowujecie go narracji głównej, zamiast dawać mu własny akt.',
        en: 'At the cost of this pillar’s independence — you deliberately subordinate it to the main narrative rather than give it its own act.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy prowadzenie go jako równorzędnej tezy: dwie konkurujące osie rozmywają punkt kulminacyjny i osłabiają obie.',
        en: 'We reject running it as a co-equal claim: two competing axes dilute the climax and weaken both.',
      },
      expectedImpact: secondScore.band,
      estimatedEffort: 'medium',
      riskLevel: 'low',
      validation: { valid: true, missing: [], weak: [] },
    });
  }

  // Explicit CUT of the weakest pillar, reclaiming attention.
  if (cut && cutScore) {
    moves.push({
      order: order++,
      pillarId: cut,
      category: 'reframe',
      title: {
        pl: `Utnij „${cutScore.title}" i odzyskaj uwagę na kulminację`,
        en: `Cut "${cutScore.title}" and reclaim attention for the climax`,
      },
      rationale: {
        pl: `Najsłabszy filar (${cutScore.score}/9: rezonans ${cutScore.resonance} × dowód ${cutScore.proofStrength}) zjada uwagę odbiorcy bez proporcjonalnego zwrotu i rozmywa mocniejsze tezy.`,
        en: `The weakest pillar (${cutScore.score}/9: resonance ${cutScore.resonance} × proof ${cutScore.proofStrength}) eats audience attention without a proportional return and dilutes the stronger claims.`,
      },
      tradeOff: {
        pl: 'Kosztem jednej myśli, którą warto ocalić jako proof point gdzie indziej — w zamian narracja zyskuje ostrość i skupienie.',
        en: 'At the cost of one idea worth saving as a proof point elsewhere — in exchange the narrative gains sharpness and focus.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „zostawmy dla kompletności": kompletność nie jest celem narracji; zapamiętanie tezy głównej jest.',
        en: 'We reject "keep it for completeness": completeness is not the goal of a narrative; remembering the lead claim is.',
      },
      expectedImpact: 'low',
      estimatedEffort: 'low',
      riskLevel: 'medium',
      validation: { valid: true, missing: [], weak: [] },
    });
  }

  return moves;
}

/** Flatten a SequencedMove into the store's NarrativeMove shape (localized). */
export function toNarrativeMove(seq: SequencedMove, isPolish: boolean, id: string): NarrativeMove {
  return {
    id,
    title: localize(seq.title, isPolish),
    category: seq.category,
    rationale: `${localize(seq.rationale, isPolish)} ${localize(seq.tradeOff, isPolish)} ${localize(
      seq.rejectedVariant,
      isPolish
    )}`.trim(),
    linkedThreadIds: [],
    linkedPillarIds: [seq.pillarId],
    expectedImpact: seq.expectedImpact,
    estimatedEffort: seq.estimatedEffort,
    riskLevel: seq.riskLevel,
    confidence: seq.validation.valid ? 4 : 2,
    firstStep: '',
    proposalStatus: 'ai-proposed',
  };
}

/**
 * One-shot synthesis: ranking + W2 sequence, ready for the UI or the AI
 * fallback. Pure and deterministic.
 */
export function synthesizeNarrative(data: NarrativeEngineData): {
  ranking: NarrativeRanking;
  sequence: SequencedMove[];
} {
  return {
    ranking: rankPillars(data),
    sequence: buildW2MoveSequence(data),
  };
}
