/**
 * Pain Explorer — synthesis engine + W2 move validator.
 *
 * The pure, testable brain of the tool. It reads the pain-discovery session
 * (pain points + candidate solutions) and produces:
 *
 *   1. a per-stage readiness score (detect / qualify / measure / diagnose)
 *      derived from the facts (severity, evidence, quantified cost, root depth)
 *   2. a ranking of the four pain-discovery stages with a plain rationale,
 *      re-weighted by where the session's cost and evidence actually sit
 *   3. a W2-validated move sequence, where every move carries:
 *        - rationale        (why do this now)
 *        - tradeOff         (what it costs you / what you give up)
 *        - rejectedVariant  (the alternative deliberately NOT taken, and why)
 *
 * The W2 validator is the near-literal transfer of the SMED/Ansoff/SWOT
 * "move must justify itself" contract: a move is only VALID when all three
 * fields are present and non-trivial.
 *
 * This layer is self-contained: it depends only on a minimal read-model of the
 * discovery session (PainSession), not on the full store, so it compiles and
 * tests in isolation.
 */

import { type Bilingual, PAIN_STAGES, type PainStageId, painStageLabel } from './deepeningLadder';

type Level = 'high' | 'medium' | 'low';

const LEVEL_SCORE: Record<Level, number> = { high: 3, medium: 2, low: 1 };

/** How a pain relates to the underlying process: a real root or a downstream symptom. */
export type PainNature = 'root' | 'symptom';

/**
 * Minimal read-model of one discovered pain point. Sourced from the discovery
 * session's `pain-points` section.
 */
export interface PainPoint {
  id: string;
  /** Which discovery stage this pain currently sits in. */
  stage?: PainStageId;
  /** How badly it hurts — blocks flow (high) vs slows it (low). */
  severity?: Level;
  /** How often it recurs. */
  frequency?: Level;
  /** Number of people the pain touches per occurrence. */
  reach?: number;
  /** Minutes lost per single occurrence. */
  minutesPerOccurrence?: number;
  /** Occurrences per year (used with minutes to compute annual cost). */
  occurrencesPerYear?: number;
  /** Whether the pain is a removable root or a downstream symptom. */
  nature?: PainNature;
  /** Whether the cost figures are measured (true) or estimated/unknown. */
  measured?: boolean;
  /** Evidence backing the pain (a log, an independent report, an observation). */
  evidence?: string[];
}

/** Minimal read-model of one candidate solution from the `solutions` section. */
export interface SolutionCandidate {
  id: string;
  /** Which discovery stage the solution primarily belongs to. */
  stage?: PainStageId;
  /** The pain point this solution addresses. */
  painId?: string;
  impact?: Level;
  effort?: Level;
  evidence?: string[];
}

/** The minimal Pain Explorer session shape the engine reads. */
export interface PainSession {
  pains: PainPoint[];
  solutions: SolutionCandidate[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const asLevel = (value: unknown, fallback: Level = 'medium'): Level =>
  value === 'high' || value === 'medium' || value === 'low' ? value : fallback;
const localize = (text: Bilingual, isPolish: boolean) => (isPolish ? text.pl : text.en);

// ---------------------------------------------------------------------------
// Baseline — the pain-portfolio headline fact
// ---------------------------------------------------------------------------

/** The annualized cost of one pain point: minutes × occurrences × people. */
const painAnnualMinutes = (pain: PainPoint): number =>
  (pain.minutesPerOccurrence || 0) * (pain.occurrencesPerYear || 0) * (pain.reach || 1);

/** Portfolio-level view of the discovered pain — the headline fact. */
export interface PainBaseline {
  painCount: number;
  /** Number of pains classified as removable roots (vs downstream symptoms). */
  rootCount: number;
  /** Total annualized minutes lost across all quantified pains. */
  annualMinutesLost: number;
  /** Annualized minutes carried by the single most expensive pain. */
  topPainMinutes: number;
  /** Share of pains carrying at least one evidence item, 0..1. */
  evidenceRatio: number;
  /** Share of pains whose cost figures are measured, 0..1. */
  measuredRatio: number;
}

export function computeBaseline(session: PainSession): PainBaseline {
  const pains = session.pains;
  const painCount = pains.length;
  const rootCount = pains.filter((p) => p.nature === 'root').length;
  const annualMinutesLost = pains.reduce((acc, p) => acc + painAnnualMinutes(p), 0);
  const topPainMinutes = pains.reduce((max, p) => Math.max(max, painAnnualMinutes(p)), 0);
  const evidenceBacked = pains.filter((p) => (p.evidence?.length || 0) > 0).length;
  const measured = pains.filter((p) => p.measured).length;
  return {
    painCount,
    rootCount,
    annualMinutesLost,
    topPainMinutes,
    evidenceRatio: painCount > 0 ? round1(evidenceBacked / painCount) : 0,
    measuredRatio: painCount > 0 ? round1(measured / painCount) : 0,
  };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface StageScore {
  stage: PainStageId;
  label: Bilingual;
  /** Solution candidates attributed to this stage. */
  solutionCount: number;
  /** Annualized minutes carried by the pains this stage acts on. */
  minutesAddressed: number;
  /** Mean impact of this stage's solutions, 1..3. */
  attractiveness: number;
  /** Ease of pulling it off (low effort + evidence), 1..3. */
  feasibility: number;
  /** attractiveness × feasibility, 1..9. */
  score: number;
  /** Count of solutions carrying at least one evidence item. */
  evidenceBacked: number;
}

/** Sum of annualized minutes carried by the pains a stage acts on. */
const minutesForStage = (stage: PainStageId, pains: PainPoint[]): number => {
  const inStage = (p: PainPoint) => p.stage === stage;
  switch (stage) {
    case 'detect':
    case 'qualify':
      // early stages act on every pain currently attributed to them
      return pains.filter(inStage).reduce((acc, p) => acc + painAnnualMinutes(p), 0);
    case 'measure':
      // measurement is about the pains still lacking a hard number
      return pains
        .filter((p) => inStage(p) || !p.measured)
        .reduce((acc, p) => acc + painAnnualMinutes(p), 0);
    case 'diagnose':
      // diagnosis protects the removable-root pains
      return pains
        .filter((p) => inStage(p) || p.nature === 'root')
        .reduce((acc, p) => acc + painAnnualMinutes(p), 0);
    default:
      return 0;
  }
};

const scoreStage = (stage: PainStageId, session: PainSession): StageScore => {
  const label = painStageLabel(stage);
  const solutions = session.solutions.filter((s) => s.stage === stage);
  const minutesAddressed = minutesForStage(stage, session.pains);

  if (solutions.length === 0) {
    return {
      stage,
      label,
      solutionCount: 0,
      minutesAddressed,
      attractiveness: 0,
      feasibility: 0,
      score: 0,
      evidenceBacked: 0,
    };
  }

  const impactAvg =
    solutions.reduce((sum, s) => sum + LEVEL_SCORE[asLevel(s.impact)], 0) / solutions.length;
  const effortAvg =
    solutions.reduce((sum, s) => sum + LEVEL_SCORE[asLevel(s.effort)], 0) / solutions.length;
  const evidenceBacked = solutions.filter((s) => (s.evidence?.length || 0) > 0).length;
  const evidenceRatio = evidenceBacked / solutions.length;

  const effortEase = 4 - effortAvg; // 1..3, low effort scores high
  const feasibility = clamp(round1(effortEase * 0.6 + evidenceRatio * 2 * 0.4 + 0.4), 0.5, 3);
  const attractiveness = round1(impactAvg);
  const score = round1(attractiveness * feasibility);

  return {
    stage,
    label,
    solutionCount: solutions.length,
    minutesAddressed,
    attractiveness,
    feasibility,
    score,
    evidenceBacked,
  };
};

export interface StageRanking {
  scores: StageScore[];
  /** stages ordered best-first among those with at least one solution. */
  ordered: PainStageId[];
  rationale: Bilingual;
}

/**
 * Rank the four pain-discovery stages. Only stages with solution candidates are
 * ranked; empty stages are reported with score 0 but excluded from `ordered`.
 * Ties break toward the canonical discovery order (detect before qualify before
 * measure before diagnose) so the sequence never diagnoses a pain it has not
 * yet measured.
 */
export function rankPainStages(session: PainSession): StageRanking {
  const scores = PAIN_STAGES.map((stage) => scoreStage(stage, session));
  const stageIndex = (s: PainStageId) => PAIN_STAGES.indexOf(s);

  const ordered = scores
    .filter((s) => s.solutionCount > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.minutesAddressed !== a.minutesAddressed) return b.minutesAddressed - a.minutesAddressed;
      return stageIndex(a.stage) - stageIndex(b.stage);
    })
    .map((s) => s.stage);

  const top = scores.find((s) => s.stage === ordered[0]);
  const rationale: Bilingual = top
    ? {
        pl: `Najsilniejsza dźwignia to etap „${painStageLabel(top.stage).pl.toLowerCase()}" (dopasowanie ${top.score}/9: atrakcyjność ${top.attractiveness} × wykonalność ${top.feasibility}), obejmujący ${top.minutesAddressed} min bólu rocznie. Sekwencja trzyma porządek odkrywania: nie diagnozujemy bólu, którego jeszcze nie zmierzyliśmy.`,
        en: `The strongest lever is the "${painStageLabel(top.stage).en.toLowerCase()}" stage (fit ${top.score}/9: attractiveness ${top.attractiveness} × feasibility ${top.feasibility}), covering ${top.minutesAddressed} min of pain per year. The sequence keeps the discovery order: we do not diagnose a pain we have not yet measured.`,
      }
    : {
        pl: 'Brak kandydatów na rozwiązania — dodaj bóle i propozycje rozwiązań w co najmniej jednym etapie, aby zbudować ranking.',
        en: 'No solution candidates yet — add pains and candidate solutions in at least one stage to build a ranking.',
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
  stage: PainStageId;
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
 * Build a W2-validated move sequence from the ranked stages. The rule of the
 * sequence: honour the discovery order, but when the portfolio is under-measured,
 * insert a `measure-first` move before committing to a fix; and always end by
 * diagnosing to a removable root behind a stated trade-off, so no move fixes a
 * symptom the client will keep paying for.
 */
export function buildW2MoveSequence(session: PainSession): SequencedMove[] {
  const { scores, ordered } = rankPainStages(session);
  if (ordered.length === 0) return [];

  const baseline = computeBaseline(session);
  const scoreOf = (s: PainStageId) => scores.find((x) => x.stage === s)!;
  const moves: SequencedMove[] = [];
  let order = 1;

  // If the portfolio is thin on measurement, measure first — you cannot rank
  // pain by a cost you have not measured.
  if (baseline.measuredRatio < 0.5) {
    moves.push({
      order: order++,
      stage: 'measure',
      title: {
        pl: 'Najpierw zmierz koszt bólu, zanim go rozwiążesz',
        en: 'Measure the pain cost before you fix it',
      },
      rationale: {
        pl: `Tylko ${Math.round(baseline.measuredRatio * 100)}% bólów ma zmierzony koszt — bez pomiaru ranking bólów jest zgadywaniem, a inwestycja w rozwiązanie to zakład.`,
        en: `Only ${Math.round(baseline.measuredRatio * 100)}% of pains have a measured cost — without measurement the ranking of pain is guesswork, and any fix spend is a bet.`,
      },
      tradeOff: {
        pl: 'Kosztem ~1 cyklu opóźnienia rozwiązań, w zamian za pewność, który ból realnie kosztuje najwięcej.',
        en: 'At the cost of ~1 cycle of delay to fixes, in exchange for certainty about which pain really costs the most.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „rozwiążmy najgłośniejszy ból od razu": bez pomiaru optymalizujecie ten, o którym najgłośniej mowa, nie ten, który najdroższy.',
        en: 'We reject "just fix the loudest pain now": without measurement you optimize the most-voiced pain, not the most costly one.',
      },
      expectedImpact: 'medium',
      estimatedEffort: 'low',
      validation: VALID,
    });
  }

  // Lead with the highest-fit stage honouring the discovery order.
  const primary = ordered[0];
  const primaryScore = scoreOf(primary);
  moves.push({
    order: order++,
    stage: primary,
    title: {
      pl: `Skup się na etapie „${painStageLabel(primary).pl.toLowerCase()}"`,
      en: `Lead with the "${painStageLabel(primary).en.toLowerCase()}" stage`,
    },
    rationale: {
      pl: `Najwyższe dopasowanie (${primaryScore.score}/9) i największa pula bólu (${primaryScore.minutesAddressed} min/rok) — daje najszybszy odzysk czasu na jednostkę wysiłku.`,
      en: `Highest fit (${primaryScore.score}/9) and the largest pain pool (${primaryScore.minutesAddressed} min/yr) — it returns time fastest per unit of effort.`,
    },
    tradeOff: {
      pl: 'Kosztem tempa w pozostałych etapach — świadomie koncentrujecie zespół tu, zamiast rozwiązywać wszystkie bóle naraz.',
      en: 'At the cost of pace in the other stages — you deliberately concentrate the team here rather than solving every pain at once.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy rozwiązywanie wszystkich bólów równolegle: bez skończonego pierwszego zysku zespół gubi wiarę, a żaden ból nie znika w całości.',
      en: 'We reject solving every pain in parallel: without a finished first win the team loses belief and no pain fully disappears.',
    },
    expectedImpact:
      primaryScore.attractiveness >= 2.5
        ? 'high'
        : primaryScore.attractiveness >= 1.7
          ? 'medium'
          : 'low',
    estimatedEffort:
      primaryScore.feasibility >= 2.4 ? 'low' : primaryScore.feasibility >= 1.6 ? 'medium' : 'high',
    validation: VALID,
  });

  // Qualify is the cheapest structural filter — surface it explicitly if it has
  // scope and is not already the primary. Solving before qualifying wastes effort
  // on symptoms.
  if (
    primary !== 'qualify' &&
    scoreOf('qualify').minutesAddressed > 0 &&
    ordered.includes('qualify')
  ) {
    const qualifyScore = scoreOf('qualify');
    moves.push({
      order: order++,
      stage: 'qualify',
      title: {
        pl: 'Zakwalifikuj ból: system czy objaw, zanim go rozwiążesz',
        en: 'Qualify the pain: system vs symptom before fixing',
      },
      rationale: {
        pl: `Etap kwalifikacji obejmuje ${qualifyScore.minutesAddressed} min bólu rocznie — oddziela problem systemu od objawu, dzięki czemu ruch trafia w źródło, nie w skutek.`,
        en: `The qualify stage covers ${qualifyScore.minutesAddressed} min of pain per year — it separates a system problem from a symptom, so the move hits the source, not the effect.`,
      },
      tradeOff: {
        pl: 'Kosztem czasu na potwierdzenie bólu w drugim, niezależnym źródle — bez tego rozwiązujecie preferencję jednej osoby.',
        en: "At the cost of time to confirm the pain in a second, independent source — without it you would be solving one person's preference.",
      },
      rejectedVariant: {
        pl: 'Odrzucamy rozwiązywanie objawu przed jego kwalifikacją: leczenie skutku bez procesu-źródła to gaszenie tego samego pożaru w kółko.',
        en: 'We reject fixing a symptom before qualifying it: treating the effect without the source process is fighting the same fire on repeat.',
      },
      expectedImpact: qualifyScore.attractiveness >= 2.5 ? 'high' : 'medium',
      estimatedEffort: qualifyScore.feasibility >= 2.4 ? 'low' : 'medium',
      validation: VALID,
    });
  }

  // Explicitly end on diagnose — a fix that does not reach a removable root
  // treats a symptom the client keeps paying for.
  const diagnoseScore = scoreOf('diagnose');
  moves.push({
    order: order++,
    stage: 'diagnose',
    title: {
      pl: 'Zdiagnozuj przyczynę źródłową, zanim utrwalisz rozwiązanie',
      en: 'Diagnose the root cause before locking a fix',
    },
    rationale: {
      pl:
        baseline.rootCount > 0
          ? `${baseline.rootCount} z ${baseline.painCount} bólów wskazano jako usuwalny root; diagnoza chroni ${diagnoseScore.minutesAddressed} min/rok przed leczeniem objawu, do którego ból wróci.`
          : `Żaden ból nie ma jeszcze nazwanej przyczyny źródłowej — diagnoza chroni ${diagnoseScore.minutesAddressed} min/rok przed rozwiązaniem, które leczy skutek, a ból wraca.`,
      en:
        baseline.rootCount > 0
          ? `${baseline.rootCount} of ${baseline.painCount} pains are flagged as a removable root; diagnosis protects ${diagnoseScore.minutesAddressed} min/yr from treating a symptom the pain will return to.`
          : `No pain has a named root cause yet — diagnosis protects ${diagnoseScore.minutesAddressed} min/yr from a fix that treats the effect while the pain returns.`,
    },
    tradeOff: {
      pl: 'Kosztem czasu na 5×dlaczego i nazwanie luki zdolności — zdolność analityczna, nie techniczna, ale bez niej ruch leczy skutek.',
      en: 'At the cost of time for 5-whys and naming the capability gap — an analytical, not technical, capability, but without it the move treats the effect.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy utrwalenie rozwiązania na pierwszym wyjaśnieniu: usprawnienie objawu, którego przyczyna trwa, tylko przesuwa ból w czasie.',
      en: 'We reject locking a fix on the first explanation: improving a symptom whose cause persists merely postpones the pain.',
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
export function synthesizePainPlan(session: PainSession): {
  baseline: PainBaseline;
  ranking: StageRanking;
  sequence: SequencedMove[];
} {
  return {
    baseline: computeBaseline(session),
    ranking: rankPainStages(session),
    sequence: buildW2MoveSequence(session),
  };
}

/** Flatten a SequencedMove into a localized, store-agnostic move summary. */
export function localizeMove(
  seq: SequencedMove,
  isPolish: boolean
): { title: string; rationale: string; stage: PainStageId } {
  return {
    title: localize(seq.title, isPolish),
    rationale: `${localize(seq.rationale, isPolish)} ${localize(seq.tradeOff, isPolish)} ${localize(
      seq.rejectedVariant,
      isPolish
    )}`.trim(),
    stage: seq.stage,
  };
}
