/**
 * Decision Engine — Decision Quality synthesis engine.
 *
 * The pure, testable brain of the tool. It reads a decision session (the frame,
 * a MECE set of alternatives, weighted criteria, ranged uncertainties and named
 * assumptions) and produces:
 *
 *   1. a weighted alternatives × criteria matrix, with a recommended option
 *   2. a six-link Decision-Quality score (frame / alternatives / information /
 *      values / reasoning / commitment) and the diagnosis of the WEAKEST link —
 *      because a decision is only as good as its weakest link (SDG)
 *   3. a sensitivity / tornado analysis: for each uncertainty, how far it can
 *      swing the score, and specifically WHICH uncertainty flips the
 *      recommendation to a different option (the real decision driver)
 *   4. structural diagnostics: false binarity (only 2 alternatives, one a straw
 *      man), the hidden criterion (declared vs. revealed), and the fact/value
 *      split of any weight dispute
 *   5. a disciplined move sequence to raise the weakest link before committing
 *
 * This layer is self-contained: it depends only on a minimal read-model of the
 * decision session (DecisionSession), not on the full store, so it compiles and
 * tests in isolation. All amounts and scores are derived from the session facts;
 * the engine never invents an option, a weight or an uncertainty.
 */

import {
  DECISION_ELEMENTS,
  DECISION_QUALITY_LINKS,
  decisionElementLabel,
  decisionLinkLabel,
  type Bilingual,
  type DecisionElementId,
  type DecisionLinkId,
} from './deepeningLadder';

type Level = 'high' | 'medium' | 'low';

const LEVEL_SCORE: Record<Level, number> = { high: 3, medium: 2, low: 1 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const round2 = (value: number) => Math.round(value * 100) / 100;
const localize = (text: Bilingual, isPolish: boolean) => (isPolish ? text.pl : text.en);
const asLevel = (value: unknown, fallback: Level = 'medium'): Level =>
  value === 'high' || value === 'medium' || value === 'low' ? value : fallback;

// ---------------------------------------------------------------------------
// Read-model — the minimal decision session shape the engine reads
// ---------------------------------------------------------------------------

/** The decision as framed: the question, the decision-maker and the horizon. */
export interface DecisionFrame {
  /** The decision question, ideally phrased as an open "how best to…" not a binary. */
  question: string;
  decisionMaker?: string;
  horizon?: string;
  /** Whether the frame is stated as a binary "do X / don't". */
  binary?: boolean;
  /** True if the operating line that will execute is represented in the room. */
  implementersPresent?: boolean;
  /** Reversibility: one-way (irreversible, high formalism) vs two-way door. */
  reversibility?: 'one-way' | 'two-way';
}

/** One candidate alternative in the MECE option set. */
export interface Alternative {
  id: string;
  label?: string;
  /** Per-criterion raw score, keyed by criterion id, on a 1..5 scale. */
  scores?: Record<string, number>;
  /** Whether this option is only present to lose (a straw man). */
  strawman?: boolean;
  /** Whether the option is doable with existing capabilities. */
  doable?: boolean;
  /** Whether this is a cheap diagnostic / real-option / deferred variant. */
  realOption?: boolean;
  /** Estimated cost to run this alternative (used for real-option framing). */
  cost?: number;
}

/** One decision criterion (a value the decision-maker cares about) with a weight. */
export interface Criterion {
  id: string;
  label?: string;
  /** Relative weight; weights are normalized to sum to 1 by the engine. */
  weight?: number;
  /** True if this criterion is declared formally (ROI, risk) rather than revealed. */
  declared?: boolean;
  /** True if the criterion is contested in the team. */
  contested?: boolean;
  /**
   * Nature of a contest, when present: 'fact' (what will happen) or 'value'
   * (what we care about) — the two disputes that get confused into one.
   */
  disputeKind?: 'fact' | 'value';
}

/** One uncertainty, given as a low/base/high range rather than a point number. */
export interface Uncertainty {
  id: string;
  label?: string;
  /** How much this uncertainty, at its low end, shifts the leading option's score. */
  low?: number;
  base?: number;
  /** How much this uncertainty, at its high end, shifts the leading option's score. */
  high?: number;
  /** Which criterion this uncertainty primarily perturbs (for tornado attribution). */
  criterion?: string;
  /** True if this is a single point estimate masquerading as certainty. */
  pointEstimate?: boolean;
}

/** One named assumption an alternative silently stands on. */
export interface Assumption {
  id: string;
  label?: string;
  /** Which alternative it underpins. */
  alternative?: string;
  /** Whether it was surfaced by a pre-mortem (past-tense failure walk-back). */
  fromPremortem?: boolean;
  /** Whether it is anchored to the first number / prior decision (a bias flag). */
  anchored?: boolean;
}

/** The minimal decision session shape the engine reads. */
export interface DecisionSession {
  frame: DecisionFrame;
  alternatives: Alternative[];
  criteria: Criterion[];
  uncertainties: Uncertainty[];
  assumptions: Assumption[];
  /** True if implementers have confirmed real buy-in (commitment / link 6). */
  commitmentConfirmed?: boolean;
}

// ---------------------------------------------------------------------------
// Weighted alternatives × criteria matrix
// ---------------------------------------------------------------------------

/** Normalized weights per criterion id (sum to 1); empty weights split evenly. */
export function normalizedWeights(criteria: Criterion[]): Record<string, number> {
  const active = criteria.filter((c) => (c.weight ?? 0) > 0);
  const total = active.reduce((acc, c) => acc + (c.weight ?? 0), 0);
  const weights: Record<string, number> = {};
  if (total > 0) {
    criteria.forEach((c) => {
      weights[c.id] = (c.weight ?? 0) / total;
    });
  } else if (criteria.length > 0) {
    // No weights given — split evenly so the matrix still ranks options.
    const even = 1 / criteria.length;
    criteria.forEach((c) => {
      weights[c.id] = even;
    });
  }
  return weights;
}

export interface AlternativeScore {
  id: string;
  label: string;
  /** Weighted total across all criteria, 0..5. */
  weightedScore: number;
  strawman: boolean;
  doable: boolean;
  realOption: boolean;
}

export interface DecisionMatrix {
  alternatives: AlternativeScore[];
  /** Alternatives ordered best-first (straw men and non-doable sink to the bottom). */
  ranked: AlternativeScore[];
  /** The recommended alternative id (top of the ranking), or null if none scored. */
  recommendedId: string | null;
  /** Margin between the top and the runner-up (how decisive the lead is). */
  margin: number;
  weights: Record<string, number>;
}

const scoreAlternative = (
  alt: Alternative,
  criteria: Criterion[],
  weights: Record<string, number>
): number => {
  if (criteria.length === 0) return 0;
  let acc = 0;
  criteria.forEach((c) => {
    const raw = clamp(alt.scores?.[c.id] ?? 0, 0, 5);
    acc += raw * (weights[c.id] ?? 0);
  });
  return round2(acc);
};

/**
 * Build the weighted alternatives × criteria matrix. Straw-man options and
 * options flagged non-doable are ranked but pushed below real, doable options
 * with the same score, so the recommendation never lands on a fiction.
 */
export function buildMatrix(session: DecisionSession): DecisionMatrix {
  const weights = normalizedWeights(session.criteria);
  const alternatives: AlternativeScore[] = session.alternatives.map((alt) => ({
    id: alt.id,
    label: alt.label ?? alt.id,
    weightedScore: scoreAlternative(alt, session.criteria, weights),
    strawman: alt.strawman === true,
    doable: alt.doable !== false,
    realOption: alt.realOption === true,
  }));

  const penalty = (a: AlternativeScore) => (a.strawman ? 2 : 0) + (a.doable ? 0 : 1);
  const ranked = [...alternatives].sort((a, b) => {
    const pa = penalty(a);
    const pb = penalty(b);
    if (pa !== pb) return pa - pb; // real & doable first
    return b.weightedScore - a.weightedScore;
  });

  const recommendedId = ranked.length > 0 ? ranked[0].id : null;
  const margin =
    ranked.length >= 2 ? round2(ranked[0].weightedScore - ranked[1].weightedScore) : ranked.length === 1 ? ranked[0].weightedScore : 0;

  return { alternatives, ranked, recommendedId, margin, weights };
}

// ---------------------------------------------------------------------------
// Sensitivity / tornado analysis — which uncertainty flips the recommendation
// ---------------------------------------------------------------------------

export interface TornadoBar {
  id: string;
  label: string;
  criterion?: string;
  /** Downside swing on the leading option's score at the uncertainty's low end. */
  low: number;
  /** Upside swing at the high end. */
  high: number;
  /** Total span |high - low| — the ranking key of the tornado. */
  span: number;
  /**
   * Whether moving this uncertainty across its range flips the recommendation to
   * a DIFFERENT option (given the current margin). This is the real decision
   * driver — the variable to measure before deciding, not after.
   */
  flipsRecommendation: boolean;
}

export interface SensitivityAnalysis {
  bars: TornadoBar[];
  /** The single widest-impact uncertainty (top of the tornado), or null. */
  topDriver: TornadoBar | null;
  /** The uncertainties that, alone, flip the recommendation. */
  flippers: TornadoBar[];
  /**
   * Recommendation robustness: 'robust' when nothing in the realistic range
   * flips it, 'fragile' when a single uncertainty does.
   */
  robustness: 'robust' | 'fragile';
}

/**
 * Sensitivity analysis (tornado). For each uncertainty we read the swing it
 * imposes on the leading option's weighted score (low/high vs base). An
 * uncertainty flips the recommendation when its downside swing exceeds the
 * current margin over the runner-up — i.e. it can drag the leader below the
 * second option. The recommendation is 'fragile' if any single uncertainty flips
 * it, 'robust' if none does.
 */
export function analyzeSensitivity(session: DecisionSession, matrix?: DecisionMatrix): SensitivityAnalysis {
  const m = matrix ?? buildMatrix(session);
  const margin = m.margin;

  const bars: TornadoBar[] = session.uncertainties.map((u) => {
    const base = u.base ?? 0;
    const low = round2((u.low ?? base) - base);
    const high = round2((u.high ?? base) - base);
    const span = round2(Math.abs(high - low));
    // The uncertainty flips the recommendation if its worst downside on the
    // leader is larger than the leader's margin over the runner-up.
    const worstDown = Math.min(low, high, 0);
    const flipsRecommendation = m.ranked.length >= 2 && Math.abs(worstDown) > margin;
    return {
      id: u.id,
      label: u.label ?? u.id,
      criterion: u.criterion,
      low,
      high,
      span,
      flipsRecommendation,
    };
  });

  bars.sort((a, b) => b.span - a.span);
  const flippers = bars.filter((b) => b.flipsRecommendation);
  return {
    bars,
    topDriver: bars.length > 0 ? bars[0] : null,
    flippers,
    robustness: flippers.length > 0 ? 'fragile' : 'robust',
  };
}

// ---------------------------------------------------------------------------
// Six-link Decision Quality scoring + weakest-link diagnosis
// ---------------------------------------------------------------------------

export interface LinkScore {
  link: DecisionLinkId;
  label: Bilingual;
  /** 0..100 quality of this link, derived from the session facts. */
  score: number;
  /** One-line reason this link scored as it did. */
  reason: Bilingual;
}

const pct = (value: number) => Math.round(clamp(value, 0, 1) * 100);

/**
 * Score each of the six Decision-Quality links from the session facts.
 * Deterministic and range-bounded (0..100). The scoring is intentionally
 * conservative: an empty element scores low, not neutral, because an unstated
 * link is a weak link, not an average one.
 */
export function scoreLinks(session: DecisionSession): LinkScore[] {
  const { frame, alternatives, criteria, uncertainties, assumptions } = session;
  const realAlts = alternatives.filter((a) => !a.strawman);
  const weightedCriteria = criteria.filter((c) => (c.weight ?? 0) > 0);
  const rangedUncertainties = uncertainties.filter(
    (u) => !u.pointEstimate && (u.low !== undefined || u.high !== undefined)
  );
  const premortemAssumptions = assumptions.filter((a) => a.fromPremortem);

  // 1. Frame — has a question, is not a naked binary, has decision-maker & horizon.
  let frameQ = 0;
  if (frame.question && frame.question.trim().length >= 8) frameQ += 0.4;
  if (frame.binary !== true) frameQ += 0.25;
  if (frame.decisionMaker) frameQ += 0.15;
  if (frame.horizon) frameQ += 0.2;

  // 2. Alternatives — ≥3 real (non-straw) alternatives, MECE proxy.
  const altQ = clamp(realAlts.length / 3, 0, 1) * (alternatives.some((a) => a.strawman) ? 0.7 : 1);

  // A validated pre-mortem lifts information quality (Klein: the past-tense walk-
  // back surfaces ~30% more valid objections than a standard risk review — doctrine
  // §4.2), so genuine pre-mortem assumptions raise both the information and the
  // reasoning links rather than sitting inert.
  const premortemBoost = clamp(premortemAssumptions.length * 0.08, 0, 0.2);

  // 3. Information — uncertainties given as ranges rather than point estimates,
  //    lifted by any pre-mortem-sourced objections.
  const infoBase =
    uncertainties.length === 0
      ? 0.2
      : clamp(rangedUncertainties.length / Math.max(uncertainties.length, 1), 0, 1);
  const infoQ = clamp(infoBase + premortemBoost, 0, 1);

  // 4. Values — criteria carry explicit weights and the trade-off is named.
  const valuesQ =
    criteria.length === 0
      ? 0
      : clamp(weightedCriteria.length / criteria.length, 0, 1) * clamp(criteria.length / 3, 0.4, 1);

  // 5. Reasoning — the matrix produces a decisive AND robust recommendation. A
  //    wide margin on a FRAGILE recommendation (one uncertainty flips it) is not
  //    sound reasoning, so robustness discounts the score; a pre-mortem lifts it.
  const matrix = buildMatrix(session);
  const sensitivity = analyzeSensitivity(session, matrix);
  const robustnessPenalty = sensitivity.robustness === 'fragile' ? 0.2 : 0;
  const reasoningQ =
    matrix.recommendedId === null
      ? 0.1
      : clamp(
          0.5 +
            matrix.margin * 0.4 +
            (criteria.length >= 2 ? 0.2 : 0) +
            (premortemAssumptions.length > 0 ? 0.1 : 0) -
            robustnessPenalty,
          0,
          1
        );

  // 6. Commitment — implementers present + confirmed buy-in.
  let commitQ = 0;
  if (frame.implementersPresent) commitQ += 0.5;
  if (session.commitmentConfirmed) commitQ += 0.5;

  const reason = (pl: string, en: string): Bilingual => ({ pl, en });

  return [
    {
      link: 'frame',
      label: decisionLinkLabel('frame'),
      score: pct(frameQ),
      reason: reason(
        frame.binary === true
          ? 'Rama jest binarna — ryzyko fałszywego wyboru; brakuje szerszego pytania i/lub decydenta/horyzontu.'
          : 'Pytanie postawione; sprawdź, czy zakres i decydent są jednoznaczne.',
        frame.binary === true
          ? 'The frame is binary — risk of a false choice; a broader question and/or decision-maker/horizon is missing.'
          : 'Question stated; verify scope and decision-maker are unambiguous.'
      ),
    },
    {
      link: 'alternatives',
      label: decisionLinkLabel('alternatives'),
      score: pct(altQ),
      reason: reason(
        realAlts.length < 3
          ? `Tylko ${realAlts.length} realnych alternatyw — poniżej progu 3; wygeneruj opcję hybrydową/odroczoną/pilotażową.`
          : `${realAlts.length} realnych alternatyw${alternatives.some((a) => a.strawman) ? ', ale wykryto opcję słomianą' : ''}.`,
        realAlts.length < 3
          ? `Only ${realAlts.length} real alternatives — below the threshold of 3; generate a hybrid/deferred/pilot option.`
          : `${realAlts.length} real alternatives${alternatives.some((a) => a.strawman) ? ', but a straw-man option was detected' : ''}.`
      ),
    },
    {
      link: 'information',
      label: decisionLinkLabel('information'),
      score: pct(infoQ),
      reason: reason(
        rangedUncertainties.length < uncertainties.length
          ? 'Część niepewności to szacunki punktowe — zamień na zakresy low/base/high.'
          : 'Kluczowe niepewności podane jako zakresy — dobra podstawa analizy wrażliwości.',
        rangedUncertainties.length < uncertainties.length
          ? 'Some uncertainties are point estimates — convert them to low/base/high ranges.'
          : 'Key uncertainties given as ranges — a sound basis for sensitivity analysis.'
      ),
    },
    {
      link: 'values',
      label: decisionLinkLabel('values'),
      score: pct(valuesQ),
      reason: reason(
        weightedCriteria.length < criteria.length || criteria.length < 2
          ? 'Wagi kryteriów niepełne lub jest ich za mało — trade-off nie jest jawny.'
          : 'Kryteria zważone i trade-off nazwany.',
        weightedCriteria.length < criteria.length || criteria.length < 2
          ? 'Criteria weights incomplete or too few criteria — the trade-off is not explicit.'
          : 'Criteria weighted and the trade-off named.'
      ),
    },
    {
      link: 'reasoning',
      label: decisionLinkLabel('reasoning'),
      score: pct(reasoningQ),
      reason: reason(
        matrix.recommendedId === null
          ? 'Macierz nie wskazuje rekomendacji — brak wystarczających danych o opcjach lub kryteriach.'
          : sensitivity.robustness === 'fragile'
            ? `Rekomendacja jest (przewaga ${matrix.margin}), ale KRUCHA — pojedyncza niepewność ją odwraca; szeroka marża nie oznacza solidnego rozumowania.`
            : matrix.margin < 0.3
              ? `Rekomendacja jest, ale przewaga nad drugą opcją jest wąska (${matrix.margin}) — decyzja krucha.`
              : `Rekomendacja z wyraźną, solidną przewagą (${matrix.margin}).`,
        matrix.recommendedId === null
          ? 'The matrix yields no recommendation — insufficient data on options or criteria.'
          : sensitivity.robustness === 'fragile'
            ? `A recommendation exists (margin ${matrix.margin}), but it is FRAGILE — a single uncertainty flips it; a wide margin is not sound reasoning here.`
            : matrix.margin < 0.3
              ? `A recommendation exists, but its margin over the runner-up is narrow (${matrix.margin}) — a fragile decision.`
              : `A recommendation with a clear, robust margin (${matrix.margin}).`
      ),
    },
    {
      link: 'commitment',
      label: decisionLinkLabel('commitment'),
      score: pct(commitQ),
      reason: reason(
        commitQ < 0.5
          ? 'Ogniwo commitment jest puste — linia operacyjna nie jest przy stole lub buy-in niepotwierdzony; to i tak nie zostanie wykonane.'
          : 'Wykonawcy obecni i zaangażowanie potwierdzone.',
        commitQ < 0.5
          ? 'The commitment link is empty — the operating line is not at the table or buy-in is unconfirmed; this will not get executed.'
          : 'Implementers present and buy-in confirmed.'
      ),
    },
  ];
}

export interface WeakestLink {
  link: DecisionLinkId;
  label: Bilingual;
  score: number;
  reason: Bilingual;
  /** The disciplined next action that raises this specific link. */
  remedy: Bilingual;
}

const LINK_REMEDY: Record<DecisionLinkId, Bilingual> = {
  frame: {
    pl: 'Przeramuj decyzję: zapisz właściwe pytanie (nie binarne), wskaż decydenta i horyzont, posadź przy stole wykonawców.',
    en: 'Re-frame the decision: write the right (non-binary) question, name the decision-maker and horizon, seat the implementers at the table.',
  },
  alternatives: {
    pl: 'Wygeneruj co najmniej trzecią, realną alternatywę (hybrydową / odroczoną / pilotażową) i usuń opcję słomianą.',
    en: 'Generate at least a third real alternative (hybrid / deferred / pilot) and remove the straw-man option.',
  },
  information: {
    pl: 'Zamień szacunki punktowe na zakresy low/base/high i zbuduj tornado kluczowych niepewności.',
    en: 'Convert point estimates into low/base/high ranges and build a tornado of the key uncertainties.',
  },
  values: {
    pl: 'Nadaj kryteriom wagi sumujące się do 100% i nazwij trade-off wprost (co oddajesz za co).',
    en: 'Assign criteria weights summing to 100% and name the trade-off explicitly (what you give for what).',
  },
  reasoning: {
    pl: 'Domierz zmienną, która przełącza rekomendację, zanim zdecydujesz — zamień decyzję jednorazową w warunkową z checkpointem.',
    en: 'Measure the variable that flips the recommendation before deciding — turn the one-off decision into a conditional one with a checkpoint.',
  },
  commitment: {
    pl: 'Potwierdź realne zaangażowanie linii operacyjnej i zasoby — nie „zgoda w sali", tylko sprawdzalny buy-in.',
    en: 'Confirm the operating line\'s real commitment and resources — not "agreement in the room" but a checkable buy-in.',
  },
};

/**
 * Diagnose the weakest link: the chain is only as good as its weakest link, so
 * the precise fix is "raise link X", not "rethink the decision". Ties break
 * toward the earlier link in the canonical order (a weak frame invalidates
 * everything below it, so it is fixed first).
 */
export function weakestLink(session: DecisionSession): WeakestLink {
  const scores = scoreLinks(session);
  const orderIndex = (l: DecisionLinkId) => DECISION_QUALITY_LINKS.indexOf(l);
  const weakest = [...scores].sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return orderIndex(a.link) - orderIndex(b.link);
  })[0];
  return {
    link: weakest.link,
    label: weakest.label,
    score: weakest.score,
    reason: weakest.reason,
    remedy: LINK_REMEDY[weakest.link],
  };
}

// ---------------------------------------------------------------------------
// Structural diagnostics — false binarity, hidden criterion, fact/value split
// ---------------------------------------------------------------------------

export interface FalseBinarity {
  detected: boolean;
  /** True when there are exactly 2 alternatives and one looks like a straw man. */
  strawManPresent: boolean;
  message: Bilingual;
}

/**
 * Detect a false binary: only two alternatives on the table, especially when one
 * is a straw-man "status quo nobody wants". The remedy is not more analysis —
 * it is a third option (hybrid, deferred, pilot).
 */
export function detectFalseBinarity(session: DecisionSession): FalseBinarity {
  const alts = session.alternatives;
  const strawManPresent = alts.some((a) => a.strawman);
  const detected = alts.length <= 2 || (alts.length === 2 && strawManPresent) || session.frame.binary === true;
  return {
    detected,
    strawManPresent,
    message: detected
      ? {
          pl: 'To wygląda na fałszywą binarność: na stole są tylko dwie opcje' + (strawManPresent ? ' (jedna słomiana)' : '') + '. Test: czy istnieje wersja hybrydowa, odroczona lub pilotażowa, której nikt nie rozważył?',
          en: 'This looks like a false binary: only two options are on the table' + (strawManPresent ? ' (one a straw man)' : '') + '. Test: is there a hybrid, deferred or pilot version nobody considered?',
        }
      : {
          pl: 'Zestaw alternatyw wychodzi poza binarność — dobrze.',
          en: 'The alternative set goes beyond a binary — good.',
        },
  };
}

export interface HiddenCriterion {
  detected: boolean;
  /** Ids of criteria that steer the choice but were not formally declared. */
  revealedIds: string[];
  message: Bilingual;
}

/**
 * Detect a hidden criterion: a criterion that is not formally declared yet
 * carries real weight in the choice. Naming it is often the most valuable moment
 * of the session — it is where a stuck discussion unsticks.
 */
export function detectHiddenCriterion(session: DecisionSession): HiddenCriterion {
  const revealed = session.criteria.filter((c) => c.declared === false && (c.weight ?? 0) > 0);
  const detected = revealed.length > 0;
  const names = revealed.map((c) => c.label ?? c.id).join(', ');
  return {
    detected,
    revealedIds: revealed.map((c) => c.id),
    message: detected
      ? {
          pl: `Wykryto ukryte kryterium (${names}): waży w wyborze, choć nie zostało zadeklarowane wprost. Nazwanie go zwykle kończy jałowe rundy dyskusji.`,
          en: `Hidden criterion detected (${names}): it carries weight in the choice though it was never formally declared. Naming it usually ends the fruitless rounds of discussion.`,
        }
      : {
          pl: 'Nie wykryto ukrytego kryterium — deklarowane kryteria pokrywają realne wybory.',
          en: 'No hidden criterion detected — the declared criteria cover the real choices.',
        },
  };
}

export interface DisputeSplit {
  factDisputes: string[];
  valueDisputes: string[];
  message: Bilingual;
}

/**
 * Split contested weights into fact disputes (resolved with data) vs value
 * disputes (resolved with an explicit conversation about preferences). Confusing
 * the two produces endless rounds; separating them is often the whole fix.
 */
export function splitDisputes(session: DecisionSession): DisputeSplit {
  const contested = session.criteria.filter((c) => c.contested);
  const factDisputes = contested.filter((c) => c.disputeKind === 'fact').map((c) => c.label ?? c.id);
  const valueDisputes = contested.filter((c) => c.disputeKind === 'value').map((c) => c.label ?? c.id);
  const hasFact = factDisputes.length > 0;
  const hasValue = valueDisputes.length > 0;
  return {
    factDisputes,
    valueDisputes,
    message: {
      pl:
        !hasFact && !hasValue
          ? 'Brak spornych wag — spór nie kręci się o kryteria.'
          : `Spór o fakty: ${hasFact ? factDisputes.join(', ') : 'brak'} — rozstrzyga go domiar danych. Spór o wartości: ${hasValue ? valueDisputes.join(', ') : 'brak'} — rozstrzyga go jawna rozmowa o preferencjach, nie więcej danych.`,
      en:
        !hasFact && !hasValue
          ? 'No contested weights — the dispute is not about the criteria.'
          : `Fact dispute: ${hasFact ? factDisputes.join(', ') : 'none'} — settled by measuring. Value dispute: ${hasValue ? valueDisputes.join(', ') : 'none'} — settled by an explicit conversation about preferences, not more data.`,
    },
  };
}

// ---------------------------------------------------------------------------
// Weight-profile sensitivity — recommendation under 2-3 weight profiles
// ---------------------------------------------------------------------------

export interface WeightProfile {
  id: 'base' | 'emphasis' | 'deemphasis';
  label: Bilingual;
  weights: Record<string, number>;
  recommendedId: string | null;
  recommendedLabel: string | null;
  margin: number;
}

export interface WeightProfileComparison {
  /** True when at least one criterion carries a contested weight. */
  contested: boolean;
  /** Labels of the contested criteria whose weights drove the alternative profiles. */
  contestedCriteria: string[];
  /** Base profile + (when contested) an emphasis and a de-emphasis profile. */
  profiles: WeightProfile[];
  /**
   * True when the recommended option actually CHANGES across the profiles — i.e.
   * the weight dispute is decision-relevant, not cosmetic. This is the signal
   * that the team must resolve the value dispute before committing.
   */
  recommendationVaries: boolean;
  message: Bilingual;
}

const matrixWithCriterionWeights = (
  session: DecisionSession,
  transform: (c: Criterion) => number
): DecisionMatrix =>
  buildMatrix({
    ...session,
    criteria: session.criteria.map((c) => ({ ...c, weight: transform(c) })),
  });

const profileFrom = (id: WeightProfile['id'], label: Bilingual, m: DecisionMatrix): WeightProfile => {
  const top = m.ranked.find((a) => a.id === m.recommendedId) ?? null;
  return {
    id,
    label,
    weights: m.weights,
    recommendedId: m.recommendedId,
    recommendedLabel: top ? top.label : null,
    margin: m.margin,
  };
};

/**
 * Compute the recommendation under 2-3 weight profiles when a criterion's weight
 * is contested. The doctrine (§4.2/§5, and DECISION_PROPOSAL_BANK.criteria's
 * "show the recommendation under 2-3 weight profiles, do not silently average")
 * requires surfacing whether the weight dispute actually changes the answer — the
 * base profile plus one that emphasises the contested criteria and one that
 * de-emphasises them. When the recommended option is stable across all three, the
 * dispute is cosmetic; when it flips, the value dispute must be settled first.
 */
export function compareWeightProfiles(session: DecisionSession): WeightProfileComparison {
  const base = buildMatrix(session);
  const baseProfile = profileFrom(
    'base',
    { pl: 'Wagi zadeklarowane', en: 'Declared weights' },
    base
  );

  const contestedCrit = session.criteria.filter((c) => c.contested && (c.weight ?? 0) > 0);
  const contestedIds = new Set(contestedCrit.map((c) => c.id));
  const contestedLabels = contestedCrit.map((c) => c.label ?? c.id);

  if (contestedCrit.length === 0) {
    return {
      contested: false,
      contestedCriteria: [],
      profiles: [baseProfile],
      recommendationVaries: false,
      message: {
        pl: 'Wagi kryteriów nie są sporne — rekomendacja nie zależy od profilu wag.',
        en: 'Criteria weights are not contested — the recommendation does not hinge on the weight profile.',
      },
    };
  }

  // Emphasis: double the weight of every contested criterion; de-emphasis: halve
  // it. buildMatrix renormalizes weights to sum to 1, so these are relative
  // re-weightings of the contested values against the rest.
  const emphasis = matrixWithCriterionWeights(session, (c) =>
    contestedIds.has(c.id) ? (c.weight ?? 0) * 2 : (c.weight ?? 0)
  );
  const deemphasis = matrixWithCriterionWeights(session, (c) =>
    contestedIds.has(c.id) ? (c.weight ?? 0) * 0.5 : (c.weight ?? 0)
  );

  const profiles: WeightProfile[] = [
    baseProfile,
    profileFrom(
      'emphasis',
      { pl: `Profil A: mocniejsza waga „${contestedLabels.join(', ')}"`, en: `Profile A: heavier weight on "${contestedLabels.join(', ')}"` },
      emphasis
    ),
    profileFrom(
      'deemphasis',
      { pl: `Profil B: słabsza waga „${contestedLabels.join(', ')}"`, en: `Profile B: lighter weight on "${contestedLabels.join(', ')}"` },
      deemphasis
    ),
  ];

  const distinct = new Set(profiles.map((p) => p.recommendedId).filter((id) => id !== null));
  const recommendationVaries = distinct.size > 1;

  return {
    contested: true,
    contestedCriteria: contestedLabels,
    profiles,
    recommendationVaries,
    message: {
      pl: recommendationVaries
        ? `Rekomendacja ZMIENIA się w zależności od wagi spornych kryteriów (${contestedLabels.join(', ')}): ${profiles.map((p) => `${p.label.pl} → ${p.recommendedLabel ?? 'brak'}`).join('; ')}. To spór o wartości, który trzeba rozstrzygnąć przed decyzją — nie uśredniaj po cichu.`
        : `Rekomendacja jest stabilna mimo sporu o wagi (${contestedLabels.join(', ')}) — wszystkie profile wskazują „${baseProfile.recommendedLabel ?? 'brak'}". Spór o wagi jest w tym wypadku kosmetyczny.`,
      en: recommendationVaries
        ? `The recommendation CHANGES with the weight of the contested criteria (${contestedLabels.join(', ')}): ${profiles.map((p) => `${p.label.en} → ${p.recommendedLabel ?? 'none'}`).join('; ')}. This is a value dispute to settle before deciding — do not silently average.`
        : `The recommendation is stable despite the weight dispute (${contestedLabels.join(', ')}) — every profile points to "${baseProfile.recommendedLabel ?? 'none'}". The weight dispute is cosmetic here.`,
    },
  };
}

// ---------------------------------------------------------------------------
// Move sequence — raise the weakest link before committing
// ---------------------------------------------------------------------------

export interface SequencedMove {
  order: number;
  link: DecisionLinkId;
  title: Bilingual;
  rationale: Bilingual;
  tradeOff: Bilingual;
  rejectedVariant: Bilingual;
  expectedImpact: Level;
  estimatedEffort: Level;
}

/**
 * Build the move sequence to raise decision quality. The sequence is disciplined:
 * fix the weakest link first (the chain breaks there), then — if the
 * recommendation is fragile — buy information on the flipping uncertainty before
 * committing, then convert the choice into a conditional decision with a
 * checkpoint rather than a one-shot bet.
 */
export function buildMoveSequence(session: DecisionSession): SequencedMove[] {
  const moves: SequencedMove[] = [];
  let order = 1;

  const weakest = weakestLink(session);
  const sensitivity = analyzeSensitivity(session);
  const falseBinary = detectFalseBinarity(session);
  const weightProfiles = compareWeightProfiles(session);

  // 1. Fix the weakest link — the chain is only as strong as this.
  moves.push({
    order: order++,
    link: weakest.link,
    title: {
      pl: `Wzmocnij najsłabsze ogniwo: „${decisionLinkLabel(weakest.link).pl.toLowerCase()}" (${weakest.score}/100)`,
      en: `Strengthen the weakest link: "${decisionLinkLabel(weakest.link).en.toLowerCase()}" (${weakest.score}/100)`,
    },
    rationale: {
      pl: `${weakest.reason.pl} ${weakest.remedy.pl}`,
      en: `${weakest.reason.en} ${weakest.remedy.en}`,
    },
    tradeOff: {
      pl: 'Kosztem opóźnienia decyzji o czas potrzebny na to jedno ogniwo — w zamian za to, że reszta analizy przestaje stać na najsłabszym punkcie.',
      en: 'At the cost of delaying the decision by the time this one link needs — in exchange for the rest of the analysis no longer resting on its weakest point.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy „przemyśl całość jeszcze raz": to rozmywa wysiłek; łańcuch pęka w jednym miejscu i tam kierujemy pracę.',
      en: 'We reject "rethink the whole thing": that diffuses the effort; the chain breaks in one place and that is where we direct the work.',
    },
    expectedImpact: weakest.score < 40 ? 'high' : 'medium',
    estimatedEffort: weakest.link === 'commitment' ? 'medium' : 'low',
  });

  // 2. If it is a false binary, force a third option before scoring.
  if (falseBinary.detected) {
    moves.push({
      order: order++,
      link: 'alternatives',
      title: {
        pl: 'Wygeneruj trzecią opcję i rozbij fałszywą binarność',
        en: 'Generate a third option and break the false binary',
      },
      rationale: {
        pl: falseBinary.message.pl,
        en: falseBinary.message.en,
      },
      tradeOff: {
        pl: 'Kosztem jednej dodatkowej rundy projektowania opcji — w zamian za pewność, że wybór jest realny, a nie rytualnym zatwierdzeniem faworyta.',
        en: 'At the cost of one extra round of option design — in exchange for certainty the choice is real, not a ritual rubber-stamp of the favourite.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy głosowanie nad dwiema opcjami od razu: to zamyka przestrzeń, zanim ktoś sprawdzi opcję hybrydową lub pilotażową.',
        en: 'We reject voting on the two options right away: it closes the space before anyone checks a hybrid or pilot option.',
      },
      expectedImpact: 'high',
      estimatedEffort: 'low',
    });
  }

  // 3. If the recommendation is fragile, buy information on the flipping driver.
  if (sensitivity.robustness === 'fragile' && sensitivity.flippers.length > 0) {
    const driver = sensitivity.flippers[0];
    moves.push({
      order: order++,
      link: 'information',
      title: {
        pl: `Domierz zmienną, która przełącza rekomendację: „${driver.label}"`,
        en: `Measure the variable that flips the recommendation: "${driver.label}"`,
      },
      rationale: {
        pl: `Rekomendacja jest krucha — odwraca się na zmiennej „${driver.label}" (rozpiętość wpływu ${driver.span}). To jest prawdziwy decision driver, nie temat dyskutowany najdłużej — domierz go tanim pilotażem PRZED decyzją.`,
        en: `The recommendation is fragile — it reverses on "${driver.label}" (impact span ${driver.span}). This is the real decision driver, not the topic debated the longest — measure it with a cheap pilot BEFORE deciding.`,
      },
      tradeOff: {
        pl: 'Kosztem ułamka ceny pełnej decyzji i ~60 dni — w zamian za to, że nie stawiacie całości na jedną, nierozstrzygniętą kartę.',
        en: 'At the cost of a fraction of the full decision price and ~60 days — in exchange for not betting the whole on one unresolved card.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy decyzję teraz na obecnych danych: przy tej kruchości to hazard, nie wybór — jeden ruch zmiennej cofa rekomendację.',
        en: 'We reject deciding now on current data: at this fragility that is a gamble, not a choice — one move of the variable reverses the recommendation.',
      },
      expectedImpact: 'high',
      estimatedEffort: 'medium',
    });
  }

  // 3b. If the recommendation changes under different weight profiles, the weight
  //     dispute is decision-relevant — settle the value dispute before scoring.
  if (weightProfiles.recommendationVaries) {
    moves.push({
      order: order++,
      link: 'values',
      title: {
        pl: `Rozstrzygnij spór o wagi kryteriów „${weightProfiles.contestedCriteria.join(', ')}" — rekomendacja od niego zależy`,
        en: `Settle the weight dispute over "${weightProfiles.contestedCriteria.join(', ')}" — the recommendation depends on it`,
      },
      rationale: {
        pl: weightProfiles.message.pl,
        en: weightProfiles.message.en,
      },
      tradeOff: {
        pl: 'Kosztem jawnej rozmowy o preferencjach (na czym naprawdę zależy) — w zamian za to, że rekomendacja przestaje zależeć od cichego, arbitralnego ustawienia wag.',
        en: 'At the cost of an explicit conversation about preferences (what we truly value) — in exchange for the recommendation no longer hinging on a silent, arbitrary weighting.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy uśrednienie spornych wag po cichu: to pozoruje zgodę i wybiera opcję, której przy jawnych wagach nikt by nie wybrał.',
        en: 'We reject silently averaging the contested weights: it fakes consensus and picks an option no one would choose under explicit weights.',
      },
      expectedImpact: 'high',
      estimatedEffort: 'low',
    });
  }

  // 4. Convert to a conditional decision with a checkpoint, not a one-shot bet.
  moves.push({
    order: order++,
    link: 'reasoning',
    title: {
      pl: 'Zamień decyzję jednorazową w sekwencję z checkpointem',
      en: 'Convert the one-off decision into a sequence with a checkpoint',
    },
    rationale: {
      pl: sensitivity.robustness === 'fragile'
        ? 'Skoro rekomendacja odwraca się na kluczowej niepewności, nie wybieraj dziś A czy B — kup informację tanim krokiem i wybierz, gdy niepewność się rozstrzygnie.'
        : 'Nawet przy solidnej rekomendacji zapisz warunek jej odwrócenia i checkpoint — to zabezpiecza wykonanie przed cichą eskalacją zaangażowania.',
      en: sensitivity.robustness === 'fragile'
        ? 'Since the recommendation reverses on a key uncertainty, do not choose A vs B today — buy information with a cheap step and choose when the uncertainty resolves.'
        : 'Even with a robust recommendation, record its reversal condition and a checkpoint — this guards execution against silent escalation of commitment.',
    },
    tradeOff: {
      pl: 'Kosztem tego, że decyzja nie jest „zamknięta" dziś — w zamian za realną opcję wyjścia, gdy założenie okaże się fałszywe.',
      en: 'At the cost of the decision not being "closed" today — in exchange for a real exit option when an assumption turns out false.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy twarde postawienie na jedną kartę: bez checkpointu sunk cost zamienia korektę w eskalację zaangażowania.',
      en: 'We reject betting everything on one card: without a checkpoint, sunk cost turns a correction into an escalation of commitment.',
    },
    expectedImpact: 'medium',
    estimatedEffort: 'low',
  });

  return moves;
}

// ---------------------------------------------------------------------------
// One-shot synthesis
// ---------------------------------------------------------------------------

export interface DecisionSynthesis {
  matrix: DecisionMatrix;
  links: LinkScore[];
  weakest: WeakestLink;
  sensitivity: SensitivityAnalysis;
  falseBinarity: FalseBinarity;
  hiddenCriterion: HiddenCriterion;
  disputes: DisputeSplit;
  /** Recommendation under alternative weight profiles when weights are contested. */
  weightProfiles: WeightProfileComparison;
  sequence: SequencedMove[];
  /** Overall Decision Quality — the MINIMUM link score (chain strength), 0..100. */
  overallQuality: number;
}

/**
 * One-shot synthesis: matrix + six-link score + weakest link + sensitivity +
 * structural diagnostics + move sequence. Pure and deterministic. Overall
 * quality is the minimum link score, not the average — a chain is only as good
 * as its weakest link.
 */
export function synthesizeDecision(session: DecisionSession): DecisionSynthesis {
  const matrix = buildMatrix(session);
  const links = scoreLinks(session);
  const overallQuality = links.length > 0 ? Math.min(...links.map((l) => l.score)) : 0;
  return {
    matrix,
    links,
    weakest: weakestLink(session),
    sensitivity: analyzeSensitivity(session, matrix),
    falseBinarity: detectFalseBinarity(session),
    hiddenCriterion: detectHiddenCriterion(session),
    disputes: splitDisputes(session),
    weightProfiles: compareWeightProfiles(session),
    sequence: buildMoveSequence(session),
    overallQuality,
  };
}

/** Flatten a SequencedMove into a localized, store-agnostic move summary. */
export function localizeMove(
  seq: SequencedMove,
  isPolish: boolean
): { title: string; rationale: string; link: DecisionLinkId } {
  return {
    title: localize(seq.title, isPolish),
    rationale: `${localize(seq.rationale, isPolish)} ${localize(seq.tradeOff, isPolish)} ${localize(
      seq.rejectedVariant,
      isPolish
    )}`.trim(),
    link: seq.link,
  };
}

// ---------------------------------------------------------------------------
// Adapter: OperationalToolData sections -> DecisionSession (defensive)
// ---------------------------------------------------------------------------

const asNumber = (raw: unknown): number | undefined =>
  typeof raw === 'number' && Number.isFinite(raw)
    ? raw
    : typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))
      ? Number(raw)
      : undefined;

const truthy = (raw: unknown): boolean =>
  raw === true || (typeof raw === 'string' && /^(true|yes|tak|1)$/i.test(raw.trim()));

const asText = (raw: unknown): string | undefined =>
  typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : undefined;

const asRecordNumber = (raw: unknown): Record<string, number> | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, number> = {};
  Object.entries(raw as Record<string, unknown>).forEach(([k, v]) => {
    const n = asNumber(v);
    if (n !== undefined) out[k] = n;
  });
  return Object.keys(out).length > 0 ? out : undefined;
};

/**
 * Extract a DecisionSession from the operational tool's `sections`. Reads a
 * `frame` (or `decision`) section (first row) plus `alternatives` (or `options`),
 * `criteria`, `uncertainties` and `assumptions` defensively; unknown fields fall
 * back to sane defaults rather than throwing.
 *
 * Convention on OperationalItem:
 *  - frame row: `question`/`title` → question; `owner` → decisionMaker;
 *    `frequency`/`horizon` → horizon; `binary`/`reversibility` flags.
 *  - alternative: `title`/`label` → label; `scores` map → per-criterion scores;
 *    `strawman`/`doable`/`realOption` flags; `target` → cost.
 *  - criterion: `title` → label; `target`/`weight` → weight; `declared`/
 *    `contested`/`disputeKind` flags.
 *  - uncertainty: `title` → label; `low`/`base`/`high` → range; `category` →
 *    criterion; `pointEstimate` flag.
 *  - assumption: `title` → label; `category` → alternative; `fromPremortem`/
 *    `anchored` flags.
 */
export function toDecisionSession(sections: Record<string, unknown[]> | undefined): DecisionSession {
  const rows = (key: string, alt?: string): Array<Record<string, unknown>> =>
    (((sections?.[key] || (alt ? sections?.[alt] : undefined) || []) as unknown[]) as Array<
      Record<string, unknown>
    >);

  const frameRow = rows('frame', 'decision')[0] ?? {};
  const frame: DecisionFrame = {
    question: asText(frameRow.question) ?? asText(frameRow.title) ?? '',
    decisionMaker: asText(frameRow.decisionMaker) ?? asText(frameRow.owner),
    horizon: asText(frameRow.horizon) ?? asText(frameRow.frequency),
    binary: truthy(frameRow.binary),
    implementersPresent: truthy(frameRow.implementersPresent),
    reversibility:
      frameRow.reversibility === 'one-way' || frameRow.reversibility === 'two-way'
        ? frameRow.reversibility
        : undefined,
  };

  const alternatives: Alternative[] = rows('alternatives', 'options').map((item, idx) => ({
    id: String(item.id ?? `alt-${idx}`),
    label: asText(item.label) ?? asText(item.title),
    scores: asRecordNumber(item.scores),
    strawman: truthy(item.strawman),
    doable: item.doable === undefined ? true : truthy(item.doable),
    realOption: truthy(item.realOption),
    cost: asNumber(item.cost) ?? asNumber(item.target),
  }));

  const criteria: Criterion[] = rows('criteria').map((item, idx) => ({
    id: String(item.id ?? `crit-${idx}`),
    label: asText(item.label) ?? asText(item.title),
    weight: asNumber(item.weight) ?? asNumber(item.target),
    declared: item.declared === undefined ? true : truthy(item.declared),
    contested: truthy(item.contested),
    disputeKind:
      item.disputeKind === 'fact' || item.disputeKind === 'value' ? item.disputeKind : undefined,
  }));

  const uncertainties: Uncertainty[] = rows('uncertainties', 'risks').map((item, idx) => ({
    id: String(item.id ?? `unc-${idx}`),
    label: asText(item.label) ?? asText(item.title),
    low: asNumber(item.low),
    base: asNumber(item.base),
    high: asNumber(item.high),
    criterion: asText(item.criterion) ?? asText(item.category),
    pointEstimate: truthy(item.pointEstimate),
  }));

  const assumptions: Assumption[] = rows('assumptions').map((item, idx) => ({
    id: String(item.id ?? `asm-${idx}`),
    label: asText(item.label) ?? asText(item.title),
    alternative: asText(item.alternative) ?? asText(item.category),
    fromPremortem: truthy(item.fromPremortem),
    anchored: truthy(item.anchored),
  }));

  return {
    frame,
    alternatives,
    criteria,
    uncertainties,
    assumptions,
    commitmentConfirmed: truthy(frameRow.commitmentConfirmed),
  };
}

export { DECISION_ELEMENTS, decisionElementLabel };
export type { DecisionElementId };
