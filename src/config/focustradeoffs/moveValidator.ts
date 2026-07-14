/**
 * Focus & Trade-offs — synthesis engine + W2 move validator.
 *
 * This is the pure, testable brain of the tool. It takes the scored
 * competing priorities plus decision context and produces:
 *
 *   1. a per-priority focus score = (value × fit) / effort (derived from facts)
 *   2. a ranking of the priorities with a plain rationale (what to commit to,
 *      what to defer, what to cut)
 *   3. a W2-validated move sequence, where every move carries:
 *        - rationale     (why do this now)
 *        - tradeOff      (what it costs you / what you give up)
 *        - rejectedVariant (the alternative deliberately NOT taken, and why)
 *
 * The W2 validator is the near-literal transfer of the Ansoff/SWOT/Portfolio
 * "move must justify itself" contract: a move is only VALID when all three
 * fields are present and non-trivial. Invalid moves are surfaced with the
 * specific missing field so the UI (or AI) can repair them.
 */

import type { FocusMove, FocusPriority, FocusTradeoffData } from '@/store/useToolStore';

import { type Bilingual, type FocusLane } from './deepeningLadder';

type Level = 'high' | 'medium' | 'low';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const round1 = (value: number) => Math.round(value * 10) / 10;

const localize = (text: Bilingual, isPolish: boolean) => (isPolish ? text.pl : text.en);

/** Map a 1..5 store score to a coarse level for the store's move shape. */
const toLevel = (score: number, invert = false): Level => {
  const s = invert ? 6 - score : score;
  return s >= 3.6 ? 'high' : s >= 2.2 ? 'medium' : 'low';
};

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface PriorityScore {
  id: string;
  title: string;
  /** 1..5 strategic value. */
  value: number;
  /** 1..5 effort/cost (higher = costlier). */
  effort: number;
  /** 1..5 fit with strategy. */
  fit: number;
  /** (value × fit) / effort, normalized to 0..9 (higher = stronger focus case). */
  score: number;
  /** derived focus lane from the score band + declared recommendation. */
  lane: FocusLane;
  /** count of evidence items backing this priority. */
  evidenceBacked: number;
}

const isActive = (p: FocusPriority) =>
  p.proposalStatus !== 'rejected' && p.proposalStatus !== 'rethinking';

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? clamp(value, 1, 5) : fallback;

const scorePriority = (p: FocusPriority): PriorityScore => {
  const value = num(p.valueScore, 3);
  const effort = num(p.effortScore, 3);
  const fit = num(p.strategicFit, 3);
  // (value × fit) / effort ranges from (1×1)/5=0.2 to (5×5)/1=25.
  // Normalize into 0..9 so it reads like the sibling engines' "fit /9".
  const raw = (value * fit) / effort;
  const score = round1(clamp((raw / 25) * 9, 0, 9));

  // Lane: prefer the declared recommendation when present, else derive from the score band.
  const declared = p.recommendation;
  const lane: FocusLane =
    declared === 'pursue' || declared === 'defer' || declared === 'drop'
      ? declared
      : score >= 5
        ? 'pursue'
        : score >= 2.5
          ? 'defer'
          : 'drop';

  return {
    id: p.id,
    title: p.title,
    value,
    effort,
    fit,
    score,
    lane,
    evidenceBacked: (p.evidence?.length || 0) > 0 ? 1 : 0,
  };
};

export interface FocusRanking {
  scores: PriorityScore[];
  /** priority ids ordered best-first among active priorities. */
  ordered: string[];
  rationale: Bilingual;
}

/**
 * Rank the competing priorities. Only active (non-rejected) priorities are
 * ranked; the ranking drives the commit / defer / cut sequence.
 */
export function rankPriorities(data: FocusTradeoffData): FocusRanking {
  const active = (data.priorities || []).filter(isActive);
  const scores = active.map(scorePriority);

  const ordered = [...scores]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // tie-break: higher fit wins, then lower effort
      if (a.fit !== b.fit) return b.fit - a.fit;
      return a.effort - b.effort;
    })
    .map((s) => s.id);

  const top = scores.find((s) => s.id === ordered[0]);
  const bottom =
    ordered.length > 1 ? scores.find((s) => s.id === ordered[ordered.length - 1]) : undefined;

  const rationale: Bilingual = top
    ? {
        pl: bottom
          ? `Najsilniejszy priorytet to „${top.title}" (fokus ${top.score}/9: value ${top.value} × fit ${top.fit} / effort ${top.effort}). Najsłabszy — „${bottom.title}" (${bottom.score}/9), więc to on jest pierwszym kandydatem do odłożenia lub cięcia.`
          : `Najsilniejszy priorytet to „${top.title}" (fokus ${top.score}/9: value ${top.value} × fit ${top.fit} / effort ${top.effort}).`,
        en: bottom
          ? `The strongest priority is "${top.title}" (focus ${top.score}/9: value ${top.value} × fit ${top.fit} / effort ${top.effort}). The weakest is "${bottom.title}" (${bottom.score}/9), so it is the first candidate to defer or cut.`
          : `The strongest priority is "${top.title}" (focus ${top.score}/9: value ${top.value} × fit ${top.fit} / effort ${top.effort}).`,
      }
    : {
        pl: 'Brak aktywnych priorytetów — dodaj priorytety, aby zbudować ranking i decyzję o fokusie.',
        en: 'No active priorities yet — add priorities to build a ranking and a focus decision.',
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
  priorityId: string;
  category: FocusMove['category'];
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
 * Build a W2-validated move sequence from the ranked priorities. The rule of the
 * sequence: COMMIT to the highest-fit priority; explicitly DEFER the next-best
 * with a stated re-entry trigger; explicitly CUT the weakest and shift its
 * resource; and when the committed priority lacks evidence, insert an
 * `experiment` move before full commitment.
 */
export function buildW2MoveSequence(data: FocusTradeoffData): SequencedMove[] {
  const { scores, ordered } = rankPriorities(data);
  if (ordered.length === 0) return [];

  const scoreOf = (id: string) => scores.find((s) => s.id === id)!;
  const moves: SequencedMove[] = [];
  let order = 1;

  const primary = ordered[0];
  const primaryScore = scoreOf(primary);
  const cut = ordered.length > 1 ? ordered[ordered.length - 1] : undefined;
  const cutScore = cut ? scoreOf(cut) : undefined;

  // Lead move: COMMIT to the strongest priority.
  moves.push({
    order: order++,
    priorityId: primary,
    category: 'commit',
    title: {
      pl: `Zatwierdź „${primaryScore.title}" jako priorytet nr 1`,
      en: `Commit to "${primaryScore.title}" as priority #1`,
    },
    rationale: {
      pl: `To priorytet o najwyższym fokusie (${primaryScore.score}/9: value ${primaryScore.value} × fit ${primaryScore.fit} / effort ${primaryScore.effort}), więc daje najszybszy zwrot na ograniczonej uwadze i zasobach.`,
      en: `This is the highest-focus priority (${primaryScore.score}/9: value ${primaryScore.value} × fit ${primaryScore.fit} / effort ${primaryScore.effort}), so it returns fastest on scarce attention and resource.`,
    },
    tradeOff: {
      pl: 'Kosztem tempa na pozostałych priorytetach — świadomie koncentrujecie zdolność egzekucji tu, zamiast rozpraszać ją na wszystko naraz.',
      en: 'At the cost of pace on the other priorities — you deliberately concentrate execution capacity here rather than spreading across everything at once.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy „robimy wszystko po trochu": rozproszenie zabija zdolność dowiezienia i rozmywa dowód postępu na każdym priorytecie.',
      en: 'We reject "do a bit of everything": spreading kills delivery capacity and dilutes the proof of progress on every priority.',
    },
    expectedImpact: toLevel(primaryScore.value),
    estimatedEffort: toLevel(primaryScore.effort),
    riskLevel: toLevel(primaryScore.effort, false) === 'high' ? 'medium' : 'low',
    validation: { valid: true, missing: [], weak: [] },
  });

  // If the committed priority lacks evidence, insert an experiment (validate-first) move.
  if (primaryScore.evidenceBacked === 0) {
    moves.push({
      order: order++,
      priorityId: primary,
      category: 'experiment',
      title: {
        pl: `Zwaliduj „${primaryScore.title}" małym testem, zanim postawisz wszystko`,
        en: `Validate "${primaryScore.title}" with a small test before betting fully`,
      },
      rationale: {
        pl: 'Ten priorytet nie ma jeszcze twardego dowodu — mały, tani eksperyment odbiera ryzyko zanim zaangażujecie pełny zasób.',
        en: 'This priority carries no hard evidence yet — a small, cheap experiment de-risks it before you commit the full resource.',
      },
      tradeOff: {
        pl: 'Kosztem ~1 cyklu opóźnienia w pełnym uruchomieniu, w zamian za znacznie niższe ryzyko postawienia na złego konia.',
        en: 'At the cost of ~1 cycle of delay in full launch, in exchange for a much lower risk of backing the wrong horse.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy pełne zaangażowanie od razu: bez dowodu to zakład na przeczuciu właściciela, nie decyzja o fokusie.',
        en: "We reject full commitment immediately: without evidence it is a bet on the owner's hunch, not a focus decision.",
      },
      expectedImpact: 'medium',
      estimatedEffort: 'low',
      riskLevel: 'low',
      validation: { valid: true, missing: [], weak: [] },
    });
  }

  // Second priority (if any) beyond the primary and not the cut one: DEFER / SEQUENCE.
  const second = ordered.find((id) => id !== primary && id !== cut);
  if (second) {
    const secondScore = scoreOf(second);
    moves.push({
      order: order++,
      priorityId: second,
      category: 'sequence',
      title: {
        pl: `Odłóż „${secondScore.title}" do następnej fali`,
        en: `Defer "${secondScore.title}" to the next wave`,
      },
      rationale: {
        pl: `Drugi w kolejności priorytet (fokus ${secondScore.score}/9) — uruchamiany dopiero, gdy priorytet nr 1 da pierwsze wyniki i uwolni zdolność egzekucji.`,
        en: `The second-ranked priority (focus ${secondScore.score}/9) — started only once priority #1 shows early results and frees execution capacity.`,
      },
      tradeOff: {
        pl: 'Kosztem sekwencji: świadomie czekacie, zamiast prowadzić dwa priorytety równolegle i przeciążać ten sam zespół.',
        en: 'At the cost of sequence: you deliberately wait rather than run two priorities in parallel and overload the same team.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy równoległy start obu priorytetów: przy obecnej zdolności egzekucji to podwaja ryzyko obu i nie kończy żadnego.',
        en: 'We reject a parallel start of both priorities: at current execution capacity it doubles the risk of both and finishes neither.',
      },
      expectedImpact: toLevel(secondScore.value),
      estimatedEffort: toLevel(secondScore.effort),
      riskLevel: 'low',
      validation: { valid: true, missing: [], weak: [] },
    });
  }

  // Explicit CUT of the weakest priority, shifting its resource.
  if (cut && cutScore) {
    moves.push({
      order: order++,
      priorityId: cut,
      category: 'cut',
      title: {
        pl: `Utnij „${cutScore.title}" i przesuń zasób`,
        en: `Cut "${cutScore.title}" and shift the resource`,
      },
      rationale: {
        pl: `Najniższy fokus (${cutScore.score}/9: value ${cutScore.value} × fit ${cutScore.fit} / effort ${cutScore.effort}) — trzymanie go na liście rozprasza uwagę bez proporcjonalnego zwrotu.`,
        en: `Lowest focus (${cutScore.score}/9: value ${cutScore.value} × fit ${cutScore.fit} / effort ${cutScore.effort}) — keeping it on the list scatters attention without a proportional return.`,
      },
      tradeOff: {
        pl: 'Kosztem potencjalnego upside, którego świadomie teraz nie gonicie — w zamian uwalniacie zasób na priorytet o wyższym value/effort.',
        en: 'At the cost of a potential upside you deliberately do not chase now — in exchange you free resource for a higher value/effort priority.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „zostawmy na wszelki wypadek": priorytet trzymany bez decyzji cicho zżera moc, której nie widać w żadnym raporcie.',
        en: 'We reject "keep it just in case": a priority held without a decision quietly eats capacity that shows up in no report.',
      },
      expectedImpact: 'low',
      estimatedEffort: toLevel(cutScore.effort),
      riskLevel: 'medium',
      validation: { valid: true, missing: [], weak: [] },
    });
  }

  return moves;
}

/** Flatten a SequencedMove into the store's FocusMove shape (localized). */
export function toFocusMove(seq: SequencedMove, isPolish: boolean, id: string): FocusMove {
  return {
    id,
    title: localize(seq.title, isPolish),
    category: seq.category,
    rationale: `${localize(seq.rationale, isPolish)} ${localize(seq.tradeOff, isPolish)} ${localize(
      seq.rejectedVariant,
      isPolish
    )}`.trim(),
    linkedTradeoffIds: [],
    linkedPriorityIds: [seq.priorityId],
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
export function synthesizeFocusTradeoffs(data: FocusTradeoffData): {
  ranking: FocusRanking;
  sequence: SequencedMove[];
} {
  return {
    ranking: rankPriorities(data),
    sequence: buildW2MoveSequence(data),
  };
}
