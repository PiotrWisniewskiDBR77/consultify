/**
 * Ansoff Growth Paths — synthesis engine + W2 move validator.
 *
 * This is the pure, testable brain of the tool. It takes the accepted
 * growth options (per Ansoff quadrant) plus mission context and produces:
 *
 *   1. a per-path score = attractiveness × feasibility (derived from facts)
 *   2. a ranking of the four paths with a plain rationale
 *   3. a W2-validated move sequence, where every move carries:
 *        - rationale     (why do this now)
 *        - tradeOff      (what it costs you / what you give up)
 *        - rejectedVariant (the alternative deliberately NOT taken, and why)
 *
 * The W2 validator is the near-literal transfer of the SWOT/Portfolio
 * "move must justify itself" contract: a move is only VALID when all three
 * fields are present and non-trivial. Invalid moves are surfaced with the
 * specific missing field so the UI (or AI) can repair them.
 */

import type {
  GrowthMove,
  GrowthPathItem,
  GrowthPathsData,
  GrowthQuadrantId,
} from '@/store/useToolStore';

import { ANSOFF_QUADRANTS, type Bilingual } from './deepeningLadder';

type Level = 'high' | 'medium' | 'low';

const LEVEL_SCORE: Record<Level, number> = { high: 3, medium: 2, low: 1 };

/** Baseline Ansoff risk by quadrant (penetration safest, diversification riskiest). */
const QUADRANT_BASE_RISK: Record<GrowthQuadrantId, number> = {
  marketPenetration: 1,
  marketDevelopment: 2,
  productDevelopment: 2,
  diversification: 3,
};

const QUADRANT_LABEL: Record<GrowthQuadrantId, Bilingual> = {
  marketPenetration: { pl: 'Penetracja rynku', en: 'Market penetration' },
  marketDevelopment: { pl: 'Rozwój rynku', en: 'Market development' },
  productDevelopment: { pl: 'Rozwój produktu', en: 'Product development' },
  diversification: { pl: 'Dywersyfikacja', en: 'Diversification' },
};

const DEFAULT_CATEGORY_BY_QUADRANT: Record<GrowthQuadrantId, GrowthMove['category']> = {
  marketPenetration: 'scale-core',
  marketDevelopment: 'enter-market',
  productDevelopment: 'build-product',
  diversification: 'diversify',
};

const asLevel = (value: unknown, fallback: Level = 'medium'): Level =>
  value === 'high' || value === 'medium' || value === 'low' ? value : fallback;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const round1 = (value: number) => Math.round(value * 10) / 10;

const localize = (text: Bilingual, isPolish: boolean) => (isPolish ? text.pl : text.en);

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface PathScore {
  quadrant: GrowthQuadrantId;
  label: Bilingual;
  optionCount: number;
  /** Mean impact of accepted options in this quadrant, 1..3. */
  attractiveness: number;
  /** Derived from effort + evidence + Ansoff base risk, 1..3 (higher = easier to pull off). */
  feasibility: number;
  /** attractiveness × feasibility, 1..9. */
  score: number;
  /** 1..3 residual risk after evidence, higher = riskier. */
  risk: number;
  /** Count of options carrying at least one evidence item. */
  evidenceBacked: number;
}

const scoreQuadrant = (quadrant: GrowthQuadrantId, options: GrowthPathItem[]): PathScore => {
  const label = QUADRANT_LABEL[quadrant];
  if (options.length === 0) {
    return {
      quadrant,
      label,
      optionCount: 0,
      attractiveness: 0,
      feasibility: 0,
      score: 0,
      risk: QUADRANT_BASE_RISK[quadrant],
      evidenceBacked: 0,
    };
  }

  const impactAvg =
    options.reduce((sum, opt) => sum + LEVEL_SCORE[asLevel(opt.impact)], 0) / options.length;
  const effortAvg =
    options.reduce((sum, opt) => sum + LEVEL_SCORE[asLevel(opt.effort)], 0) / options.length;
  const evidenceBacked = options.filter((opt) => (opt.evidence?.length || 0) > 0).length;
  const evidenceRatio = evidenceBacked / options.length;

  // Feasibility: low effort is easier, evidence increases confidence, base Ansoff risk drags it down.
  // effort is 1..3 where 3=high effort -> invert to 4-effort so low effort scores high.
  const effortEase = 4 - effortAvg; // 1..3
  const baseRisk = QUADRANT_BASE_RISK[quadrant]; // 1..3
  const feasibilityRaw = effortEase * 0.6 + evidenceRatio * 2 * 0.4 + (4 - baseRisk) * 0.2;
  const feasibility = clamp(round1(feasibilityRaw), 0.5, 3);

  const optionRiskAvg =
    options.reduce((sum, opt) => sum + LEVEL_SCORE[asLevel(opt.riskLevel, 'medium')], 0) /
    options.length;
  // Residual risk blends declared option risk with Ansoff base risk, reduced by evidence.
  const risk = clamp(
    round1((optionRiskAvg * 0.5 + baseRisk * 0.5) * (1 - evidenceRatio * 0.3)),
    1,
    3
  );

  const attractiveness = round1(impactAvg);
  const score = round1(attractiveness * feasibility);

  return {
    quadrant,
    label,
    optionCount: options.length,
    attractiveness,
    feasibility,
    score,
    risk,
    evidenceBacked,
  };
};

export interface PathRanking {
  scores: PathScore[];
  /** quadrants ordered best-first among those with at least one option. */
  ordered: GrowthQuadrantId[];
  rationale: Bilingual;
}

/**
 * Rank the four Ansoff paths. Only quadrants with accepted options are ranked;
 * empty quadrants are reported with score 0 but excluded from `ordered`.
 */
export function rankGrowthPaths(data: GrowthPathsData): PathRanking {
  const scores = ANSOFF_QUADRANTS.map((quadrant) =>
    scoreQuadrant(quadrant, data.quadrants?.[quadrant] || [])
  );

  const ordered = scores
    .filter((s) => s.optionCount > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // tie-break: lower risk wins, then higher attractiveness
      if (a.risk !== b.risk) return a.risk - b.risk;
      return b.attractiveness - a.attractiveness;
    })
    .map((s) => s.quadrant);

  const top = scores.find((s) => s.quadrant === ordered[0]);
  const bottom =
    ordered.length > 1 ? scores.find((s) => s.quadrant === ordered[ordered.length - 1]) : undefined;

  const rationale: Bilingual = top
    ? {
        pl: bottom
          ? `Najsilniejsza ścieżka to ${QUADRANT_LABEL[top.quadrant].pl.toLowerCase()} (dopasowanie ${top.score}/9: atrakcyjność ${top.attractiveness} × wykonalność ${top.feasibility}). Najsłabsza — ${QUADRANT_LABEL[bottom.quadrant].pl.toLowerCase()} (${bottom.score}/9, ryzyko ${bottom.risk}/3), więc ją odraczamy.`
          : `Najsilniejsza ścieżka to ${QUADRANT_LABEL[top.quadrant].pl.toLowerCase()} (dopasowanie ${top.score}/9: atrakcyjność ${top.attractiveness} × wykonalność ${top.feasibility}).`,
        en: bottom
          ? `The strongest path is ${QUADRANT_LABEL[top.quadrant].en.toLowerCase()} (fit ${top.score}/9: attractiveness ${top.attractiveness} × feasibility ${top.feasibility}). The weakest is ${QUADRANT_LABEL[bottom.quadrant].en.toLowerCase()} (${bottom.score}/9, risk ${bottom.risk}/3), so we defer it.`
          : `The strongest path is ${QUADRANT_LABEL[top.quadrant].en.toLowerCase()} (fit ${top.score}/9: attractiveness ${top.attractiveness} × feasibility ${top.feasibility}).`,
      }
    : {
        pl: 'Brak zaakceptowanych opcji wzrostu — dodaj opcje w co najmniej jednej ćwiartce, aby zbudować ranking.',
        en: 'No accepted growth options yet — add options in at least one quadrant to build a ranking.',
      };

  return { scores, ordered, rationale };
}

// ---------------------------------------------------------------------------
// Coverage gap detection (OXFORD O3 discipline — "growth without a base")
// ---------------------------------------------------------------------------

export type GrowthPathGapKind = 'no-evidence' | 'unbalanced-risk' | 'no-options-anywhere';

export interface GrowthPathGap {
  quadrant: GrowthQuadrantId | null;
  kind: GrowthPathGapKind;
  message: Bilingual;
}

/**
 * Names the coverage gaps a growth portfolio must not silently carry:
 *   - a quadrant with accepted options but zero evidence behind any of them
 *     (a bet dressed as a plan)
 *   - a portfolio that has NO options in any of the three safer quadrants
 *     (penetration/development) yet bets everything on diversification — the
 *     riskiest quadrant with no stable base underneath it
 *   - an entirely empty session (nothing to rank at all)
 */
export function detectGrowthPathGaps(data: GrowthPathsData): GrowthPathGap[] {
  const gaps: GrowthPathGap[] = [];
  const { scores } = rankGrowthPaths(data);

  const anyOptions = scores.some((s) => s.optionCount > 0);
  if (!anyOptions) {
    gaps.push({
      quadrant: null,
      kind: 'no-options-anywhere',
      message: {
        pl: 'Brak zaakceptowanych opcji wzrostu w jakiejkolwiek ćwiartce — portfel wzrostu jest pusty.',
        en: 'No accepted growth options in any quadrant — the growth portfolio is empty.',
      },
    });
    return gaps;
  }

  scores.forEach((s) => {
    if (s.optionCount > 0 && s.evidenceBacked === 0) {
      gaps.push({
        quadrant: s.quadrant,
        kind: 'no-evidence',
        message: {
          pl: `„${QUADRANT_LABEL[s.quadrant].pl}" ma ${s.optionCount} opcji, ale ani jedna nie ma dowodu — to zakład ubrany w plan.`,
          en: `"${QUADRANT_LABEL[s.quadrant].en}" has ${s.optionCount} option(s) but not one carries evidence — a bet dressed as a plan.`,
        },
      });
    }
  });

  const safeQuadrants: GrowthQuadrantId[] = [
    'marketPenetration',
    'marketDevelopment',
    'productDevelopment',
  ];
  const safeAllEmpty = scores
    .filter((s) => safeQuadrants.includes(s.quadrant))
    .every((s) => s.optionCount === 0);
  const diversificationScore = scores.find((s) => s.quadrant === 'diversification')!;
  if (safeAllEmpty && diversificationScore.optionCount > 0) {
    gaps.push({
      quadrant: 'diversification',
      kind: 'unbalanced-risk',
      message: {
        pl: 'Penetracja, rozwój rynku i rozwój produktu są puste, a portfel opiera się wyłącznie na dywersyfikacji — najwyższym ryzyku bez stabilnej bazy pod spodem.',
        en: 'Penetration, market development and product development are all empty, and the portfolio rests entirely on diversification — the highest-risk quadrant with no stable base underneath it.',
      },
    });
  }

  return gaps;
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
 * transfer of the SWOT/Portfolio move governance.
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
  quadrant: GrowthQuadrantId;
  category: GrowthMove['category'];
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
 * Build a W2-validated move sequence from the ranked paths. The rule of the
 * sequence: start from the highest-fit, lowest-risk path; explicitly defer the
 * riskiest path with a stated trade-off; and when uncertainty is high (thin
 * evidence), insert a `validate-first` move before committing.
 */
export function buildW2MoveSequence(data: GrowthPathsData): SequencedMove[] {
  const { scores, ordered } = rankGrowthPaths(data);
  if (ordered.length === 0) return [];

  const scoreOf = (q: GrowthQuadrantId) => scores.find((s) => s.quadrant === q)!;
  const moves: SequencedMove[] = [];
  let order = 1;

  const primary = ordered[0];
  const primaryScore = scoreOf(primary);
  const deferred = ordered.length > 1 ? ordered[ordered.length - 1] : undefined;
  const deferredScore = deferred ? scoreOf(deferred) : undefined;

  // Lead move: commit to the strongest path.
  const evidenceRatio =
    primaryScore.optionCount > 0 ? primaryScore.evidenceBacked / primaryScore.optionCount : 0;

  moves.push({
    order: order++,
    quadrant: primary,
    category: DEFAULT_CATEGORY_BY_QUADRANT[primary],
    title: {
      pl: `Najpierw ${QUADRANT_LABEL[primary].pl.toLowerCase()}`,
      en: `Lead with ${QUADRANT_LABEL[primary].en.toLowerCase()}`,
    },
    rationale: {
      pl: `To ścieżka o najwyższym dopasowaniu (${primaryScore.score}/9) i najniższym realnym ryzyku (${primaryScore.risk}/3), więc daje najszybszy zwrot na uwadze i kapitale.`,
      en: `This is the highest-fit path (${primaryScore.score}/9) at the lowest real risk (${primaryScore.risk}/3), so it returns fastest on attention and capital.`,
    },
    tradeOff: {
      pl: 'Kosztem tempa na innych ścieżkach — świadomie koncentrujecie zasoby tu, a nie rozpraszacie ich na cztery ćwiartki naraz.',
      en: 'At the cost of pace on other paths — you deliberately concentrate resources here rather than spreading across all four boxes.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy „rośniemy wszędzie po trochu": rozproszenie zabija zdolność egzekucji i rozmywa dowód wzrostu.',
      en: 'We reject "grow everywhere a little": spreading kills execution capacity and dilutes the proof of growth.',
    },
    expectedImpact:
      primaryScore.attractiveness >= 2.5
        ? 'high'
        : primaryScore.attractiveness >= 1.7
          ? 'medium'
          : 'low',
    estimatedEffort:
      primaryScore.feasibility >= 2.4 ? 'low' : primaryScore.feasibility >= 1.6 ? 'medium' : 'high',
    riskLevel: primaryScore.risk <= 1.4 ? 'low' : primaryScore.risk <= 2.2 ? 'medium' : 'high',
    validation: { valid: true, missing: [], weak: [] },
  });

  // If the primary path is thin on evidence, insert a validate-first move.
  if (evidenceRatio < 0.5) {
    moves.push({
      order: order++,
      quadrant: primary,
      category: 'validate-first',
      title: {
        pl: `Zwaliduj ${QUADRANT_LABEL[primary].pl.toLowerCase()} zanim skalujesz`,
        en: `Validate ${QUADRANT_LABEL[primary].en.toLowerCase()} before scaling`,
      },
      rationale: {
        pl: `Tylko ${primaryScore.evidenceBacked}/${primaryScore.optionCount} opcji ma twardy dowód — mały, płatny test odbiera ryzyko zanim zaangażujecie budżet.`,
        en: `Only ${primaryScore.evidenceBacked}/${primaryScore.optionCount} options carry hard evidence — a small paid test de-risks before you commit budget.`,
      },
      tradeOff: {
        pl: 'Kosztem ~1 cyklu opóźnienia w pełnym uruchomieniu, w zamian za znacznie niższe ryzyko przepalenia.',
        en: 'At the cost of ~1 cycle of delay in full launch, in exchange for a much lower risk of burn.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy wejście na pełną skalę od razu: bez dowodu popytu to zakład, a nie ścieżka wzrostu.',
        en: 'We reject going full-scale immediately: without demand proof it is a bet, not a growth path.',
      },
      expectedImpact: 'medium',
      estimatedEffort: 'low',
      riskLevel: 'low',
      validation: { valid: true, missing: [], weak: [] },
    });
  }

  // Second path (if any) beyond the primary and not the deferred one.
  const second = ordered.find((q) => q !== primary && q !== deferred);
  if (second) {
    const secondScore = scoreOf(second);
    moves.push({
      order: order++,
      quadrant: second,
      category: DEFAULT_CATEGORY_BY_QUADRANT[second],
      title: {
        pl: `Następnie ${QUADRANT_LABEL[second].pl.toLowerCase()}`,
        en: `Then ${QUADRANT_LABEL[second].en.toLowerCase()}`,
      },
      rationale: {
        pl: `Druga w kolejności ścieżka (${secondScore.score}/9) — uruchamiana, gdy pierwsza da pierwsze wyniki i uwolni zdolność egzekucji.`,
        en: `The second-ranked path (${secondScore.score}/9) — started once the first shows early results and frees execution capacity.`,
      },
      tradeOff: {
        pl: 'Kosztem sekwencji: świadomie czekacie, zamiast prowadzić dwie ścieżki równolegle i przeciążać zespół.',
        en: 'At the cost of sequence: you deliberately wait rather than run two paths in parallel and overload the team.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy równoległy start obu ścieżek: przy obecnej zdolności egzekucji to podwaja ryzyko obu.',
        en: 'We reject a parallel start of both paths: at current execution capacity it doubles the risk of both.',
      },
      expectedImpact:
        secondScore.attractiveness >= 2.5
          ? 'high'
          : secondScore.attractiveness >= 1.7
            ? 'medium'
            : 'low',
      estimatedEffort:
        secondScore.feasibility >= 2.4 ? 'low' : secondScore.feasibility >= 1.6 ? 'medium' : 'high',
      riskLevel: secondScore.risk <= 1.4 ? 'low' : secondScore.risk <= 2.2 ? 'medium' : 'high',
      validation: { valid: true, missing: [], weak: [] },
    });
  }

  // Explicit defer of the riskiest / weakest path.
  if (deferred && deferredScore) {
    moves.push({
      order: order++,
      quadrant: deferred,
      category: deferred === 'diversification' ? 'diversify' : 'validate-first',
      title: {
        pl: `Odrocz ${QUADRANT_LABEL[deferred].pl.toLowerCase()}`,
        en: `Defer ${QUADRANT_LABEL[deferred].en.toLowerCase()}`,
      },
      rationale: {
        pl: `Najniższe dopasowanie (${deferredScore.score}/9) przy najwyższym ryzyku (${deferredScore.risk}/3) — bez stabilnego rdzenia ta ścieżka podwaja ryzyko zamiast je dzielić.`,
        en: `Lowest fit (${deferredScore.score}/9) at the highest risk (${deferredScore.risk}/3) — without a stable core this path doubles risk instead of splitting it.`,
      },
      tradeOff: {
        pl: 'Kosztem potencjalnego dużego upside, którego świadomie teraz nie gonicie, bo zdolności nie są gotowe.',
        en: 'At the cost of a potential large upside you deliberately do not chase now, because capabilities are not ready.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy wejście w tę ścieżkę „przy okazji": to najdroższy sposób, żeby nauczyć się, że rdzeń nie był gotowy.',
        en: 'We reject entering this path "on the side": it is the most expensive way to learn the core was not ready.',
      },
      expectedImpact: 'low',
      estimatedEffort: 'high',
      riskLevel: 'high',
      validation: { valid: true, missing: [], weak: [] },
    });
  }

  return moves;
}

/** Flatten a SequencedMove into the store's GrowthMove shape (localized). */
export function toGrowthMove(seq: SequencedMove, isPolish: boolean, id: string): GrowthMove {
  return {
    id,
    title: localize(seq.title, isPolish),
    category: seq.category,
    rationale: `${localize(seq.rationale, isPolish)} ${localize(seq.tradeOff, isPolish)} ${localize(
      seq.rejectedVariant,
      isPolish
    )}`.trim(),
    linkedOptionIds: [],
    linkedQuadrants: [seq.quadrant],
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
export function synthesizeGrowthPaths(data: GrowthPathsData): {
  ranking: PathRanking;
  sequence: SequencedMove[];
} {
  return {
    ranking: rankGrowthPaths(data),
    sequence: buildW2MoveSequence(data),
  };
}
