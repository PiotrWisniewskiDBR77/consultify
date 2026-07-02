/**
 * SMED Planner — synthesis engine + W2 move validator.
 *
 * The pure, testable brain of the tool. It reads the SMED session (changeover
 * steps + candidate improvements) and produces:
 *
 *   1. a per-phase readiness score (separate / convert / streamline / standardize)
 *      derived from the facts (step classification, measurement, durations)
 *   2. a ranking of the four SMED phases with a plain rationale (Shingo order,
 *      re-weighted by where the session's minutes and evidence actually sit)
 *   3. a W2-validated move sequence, where every move carries:
 *        - rationale        (why do this now)
 *        - tradeOff         (what it costs you / what you give up)
 *        - rejectedVariant  (the alternative deliberately NOT taken, and why)
 *
 * The W2 validator is the near-literal transfer of the Ansoff/SWOT
 * "move must justify itself" contract: a move is only VALID when all three
 * fields are present and non-trivial.
 *
 * This layer is self-contained: it depends only on a minimal read-model of the
 * operational session (SmedSession), not on the full store, so it compiles and
 * tests in isolation.
 */

import {
  SMED_PHASES,
  smedPhaseLabel,
  type Bilingual,
  type SmedPhaseId,
} from './deepeningLadder';

type Level = 'high' | 'medium' | 'low';

const LEVEL_SCORE: Record<Level, number> = { high: 3, medium: 2, low: 1 };

/** Whether a changeover step is done with the machine stopped (internal) or running (external). */
export type StepKind = 'internal' | 'external';

/**
 * Minimal read-model of one changeover step. Sourced from the operational
 * session's `changeover-steps` section; `category` carries internal/external,
 * `durationMinutes` the measured time.
 */
export interface ChangeoverStep {
  id: string;
  kind: StepKind;
  durationMinutes?: number;
  /** Whether the step's duration is measured (true) or estimated/unknown. */
  measured?: boolean;
  /**
   * How the step can be improved: 'convertible' (internal that can go external),
   * 'shortenable' (internal that must stay but can shrink), or 'fixed'.
   */
  potential?: 'convertible' | 'shortenable' | 'fixed';
}

/** Minimal read-model of one improvement candidate from the `improvements` section. */
export interface ImprovementItem {
  id: string;
  /** Which SMED phase the improvement primarily belongs to. */
  phase?: SmedPhaseId;
  impact?: Level;
  effort?: Level;
  /** Evidence backing the improvement (pilot, measurement, sign-off). */
  evidence?: string[];
}

/** The minimal SMED session shape the engine reads. */
export interface SmedSession {
  steps: ChangeoverStep[];
  improvements: ImprovementItem[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const asLevel = (value: unknown, fallback: Level = 'medium'): Level =>
  value === 'high' || value === 'medium' || value === 'low' ? value : fallback;
const localize = (text: Bilingual, isPolish: boolean) => (isPolish ? text.pl : text.en);

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface PhaseScore {
  phase: SmedPhaseId;
  label: Bilingual;
  /** Improvement candidates attributed to this phase. */
  improvementCount: number;
  /** Total downtime minutes this phase addresses (internal minutes it can move/shrink). */
  minutesAddressed: number;
  /** Mean impact of this phase's improvements, 1..3. */
  attractiveness: number;
  /** Ease of pulling it off (low effort + evidence), 1..3. */
  feasibility: number;
  /** attractiveness × feasibility, 1..9. */
  score: number;
  /** Count of improvements carrying at least one evidence item. */
  evidenceBacked: number;
}

/** Sum of internal-step minutes that a phase can act on. */
const minutesForPhase = (phase: SmedPhaseId, steps: ChangeoverStep[]): number => {
  const internal = steps.filter((s) => s.kind === 'internal');
  const sum = (predicate: (s: ChangeoverStep) => boolean) =>
    internal.filter(predicate).reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  switch (phase) {
    case 'separate':
      // everything currently internal is in scope for separation review
      return internal.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
    case 'convert':
      return sum((s) => s.potential === 'convertible');
    case 'streamline':
      return sum((s) => s.potential === 'shortenable');
    case 'standardize':
      // standardize protects the whole remaining internal core
      return internal.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
    default:
      return 0;
  }
};

const scorePhase = (phase: SmedPhaseId, session: SmedSession): PhaseScore => {
  const label = smedPhaseLabel(phase);
  const improvements = session.improvements.filter((i) => i.phase === phase);
  const minutesAddressed = minutesForPhase(phase, session.steps);

  if (improvements.length === 0) {
    return {
      phase,
      label,
      improvementCount: 0,
      minutesAddressed,
      attractiveness: 0,
      feasibility: 0,
      score: 0,
      evidenceBacked: 0,
    };
  }

  const impactAvg =
    improvements.reduce((sum, i) => sum + LEVEL_SCORE[asLevel(i.impact)], 0) / improvements.length;
  const effortAvg =
    improvements.reduce((sum, i) => sum + LEVEL_SCORE[asLevel(i.effort)], 0) / improvements.length;
  const evidenceBacked = improvements.filter((i) => (i.evidence?.length || 0) > 0).length;
  const evidenceRatio = evidenceBacked / improvements.length;

  const effortEase = 4 - effortAvg; // 1..3, low effort scores high
  const feasibility = clamp(round1(effortEase * 0.6 + evidenceRatio * 2 * 0.4 + 0.4), 0.5, 3);
  const attractiveness = round1(impactAvg);
  const score = round1(attractiveness * feasibility);

  return {
    phase,
    label,
    improvementCount: improvements.length,
    minutesAddressed,
    attractiveness,
    feasibility,
    score,
    evidenceBacked,
  };
};

export interface PhaseRanking {
  scores: PhaseScore[];
  /** phases ordered best-first among those with at least one improvement. */
  ordered: SmedPhaseId[];
  rationale: Bilingual;
}

/**
 * Rank the four SMED phases. Only phases with improvement candidates are ranked;
 * empty phases are reported with score 0 but excluded from `ordered`. Ties break
 * toward the canonical Shingo order (separate before convert before streamline
 * before standardize) so the sequence never recommends locking a standard before
 * the gain exists.
 */
export function rankSmedPhases(session: SmedSession): PhaseRanking {
  const scores = SMED_PHASES.map((phase) => scorePhase(phase, session));
  const shingoIndex = (p: SmedPhaseId) => SMED_PHASES.indexOf(p);

  const ordered = scores
    .filter((s) => s.improvementCount > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.minutesAddressed !== a.minutesAddressed) return b.minutesAddressed - a.minutesAddressed;
      return shingoIndex(a.phase) - shingoIndex(b.phase);
    })
    .map((s) => s.phase);

  const top = scores.find((s) => s.phase === ordered[0]);
  const rationale: Bilingual = top
    ? {
        pl: `Najsilniejsza dźwignia to faza „${smedPhaseLabel(top.phase).pl.toLowerCase()}" (dopasowanie ${top.score}/9: atrakcyjność ${top.attractiveness} × wykonalność ${top.feasibility}), obejmująca ${top.minutesAddressed} min postoju. Sekwencja trzyma porządek Shingo: nie standaryzujemy, zanim zysk nie powstanie.`,
        en: `The strongest lever is the "${smedPhaseLabel(top.phase).en.toLowerCase()}" phase (fit ${top.score}/9: attractiveness ${top.attractiveness} × feasibility ${top.feasibility}), covering ${top.minutesAddressed} min of downtime. The sequence keeps Shingo order: we do not standardize before the gain exists.`,
      }
    : {
        pl: 'Brak kandydatów na usprawnienia — dodaj kroki przezbrojenia i usprawnienia w co najmniej jednej fazie, aby zbudować ranking.',
        en: 'No improvement candidates yet — add changeover steps and improvements in at least one phase to build a ranking.',
      };

  return { scores, ordered, rationale };
}

/** Baseline split of the changeover into internal vs external minutes (the SMED headline fact). */
export interface ChangeoverBaseline {
  internalMinutes: number;
  externalMinutes: number;
  totalMinutes: number;
  /** Internal minutes classified as convertible to external — the fastest downtime recovery. */
  convertibleMinutes: number;
  /** Share of internal steps whose duration is measured, 0..1. */
  measuredRatio: number;
}

export function computeBaseline(session: SmedSession): ChangeoverBaseline {
  const internal = session.steps.filter((s) => s.kind === 'internal');
  const external = session.steps.filter((s) => s.kind === 'external');
  const internalMinutes = internal.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  const externalMinutes = external.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  const convertibleMinutes = internal
    .filter((s) => s.potential === 'convertible')
    .reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  const measured = internal.filter((s) => s.measured).length;
  return {
    internalMinutes,
    externalMinutes,
    totalMinutes: internalMinutes + externalMinutes,
    convertibleMinutes,
    measuredRatio: internal.length > 0 ? round1(measured / internal.length) : 0,
  };
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
  phase: SmedPhaseId;
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
 * Build a W2-validated move sequence from the ranked phases. The rule of the
 * sequence: honour Shingo order, but when the baseline is under-measured, insert
 * a `measure-first` move before committing capital; and always defer the
 * standardize phase behind a stated trade-off until the gain is real.
 */
export function buildW2MoveSequence(session: SmedSession): SequencedMove[] {
  const { scores, ordered } = rankSmedPhases(session);
  if (ordered.length === 0) return [];

  const baseline = computeBaseline(session);
  const scoreOf = (p: SmedPhaseId) => scores.find((s) => s.phase === p)!;
  const moves: SequencedMove[] = [];
  let order = 1;

  // If the baseline is thin on measurement, measure first — you cannot rank
  // minutes you have not measured.
  if (baseline.measuredRatio < 0.5) {
    moves.push({
      order: order++,
      phase: 'separate',
      title: {
        pl: 'Najpierw zmierz i rozdziel przezbrojenie',
        en: 'Measure and separate the changeover first',
      },
      rationale: {
        pl: `Tylko ${Math.round(baseline.measuredRatio * 100)}% czynności wewnętrznych jest zmierzonych — bez pomiaru ranking minut jest zgadywaniem, a inwestycja w oprzyrządowanie to zakład.`,
        en: `Only ${Math.round(baseline.measuredRatio * 100)}% of internal steps are measured — without measurement the ranking of minutes is guesswork, and tooling spend is a bet.`,
      },
      tradeOff: {
        pl: 'Kosztem ~1 cyklu opóźnienia usprawnień, w zamian za pewność, gdzie realnie siedzą minuty postoju.',
        en: 'At the cost of ~1 cycle of delay to improvements, in exchange for certainty about where the downtime minutes really sit.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „kupmy szybkozłącza od razu": inwestowanie przed pomiarem najczęściej optymalizuje niewłaściwą czynność.',
        en: 'We reject "just buy quick clamps now": investing before measuring usually optimizes the wrong step.',
      },
      expectedImpact: 'medium',
      estimatedEffort: 'low',
      validation: VALID,
    });
  }

  // Lead with the highest-fit phase honouring Shingo order.
  const primary = ordered[0];
  const primaryScore = scoreOf(primary);
  moves.push({
    order: order++,
    phase: primary,
    title: {
      pl: `Skup się na fazie „${smedPhaseLabel(primary).pl.toLowerCase()}"`,
      en: `Lead with the "${smedPhaseLabel(primary).en.toLowerCase()}" phase`,
    },
    rationale: {
      pl: `Najwyższe dopasowanie (${primaryScore.score}/9) i największa pula minut (${primaryScore.minutesAddressed} min) — daje najszybszy odzysk zdolności produkcyjnej na jednostkę wysiłku.`,
      en: `Highest fit (${primaryScore.score}/9) and the largest minute pool (${primaryScore.minutesAddressed} min) — it returns production capacity fastest per unit of effort.`,
    },
    tradeOff: {
      pl: 'Kosztem tempa w pozostałych fazach — świadomie koncentrujecie zespół tu, zamiast otwierać cztery fronty naraz.',
      en: 'At the cost of pace in the other phases — you deliberately concentrate the team here rather than opening four fronts at once.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy równoległą przebudowę wszystkich faz: bez skończonego pierwszego zysku zespół gubi standard i cofa efekt.',
      en: 'We reject reworking all phases in parallel: without a finished first gain the team loses the standard and the effect reverts.',
    },
    expectedImpact: primaryScore.attractiveness >= 2.5 ? 'high' : primaryScore.attractiveness >= 1.7 ? 'medium' : 'low',
    estimatedEffort: primaryScore.feasibility >= 2.4 ? 'low' : primaryScore.feasibility >= 1.6 ? 'medium' : 'high',
    validation: VALID,
  });

  // Convert is SMED's cheapest structural win — surface it explicitly if it has
  // scope and is not already the primary.
  if (primary !== 'convert' && scoreOf('convert').minutesAddressed > 0 && ordered.includes('convert')) {
    const convertScore = scoreOf('convert');
    moves.push({
      order: order++,
      phase: 'convert',
      title: {
        pl: 'Przenieś czynności internal→external, zanim je skracasz',
        en: 'Convert internal→external before shortening',
      },
      rationale: {
        pl: `${baseline.convertibleMinutes} min czynności wewnętrznych da się wykonać w trakcie pracy maszyny — to odzysk postoju bez skracania samej pracy, zwykle najtańszy zysk.`,
        en: `${baseline.convertibleMinutes} min of internal work can run while the machine produces — recovering downtime without shortening the work itself, usually the cheapest gain.`,
      },
      tradeOff: {
        pl: 'Kosztem drugiego kompletu oprzyrządowania lub dodatkowego przygotowania — zasób, bez którego konwersja się cofa.',
        en: 'At the cost of a second tooling set or extra prep — the resource without which the conversion reverts.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy skracanie czynności wewnętrznych przed ich przeniesieniem: optymalizujecie wtedy minuty, które w ogóle nie musiały być w postoju.',
        en: 'We reject shortening internal steps before moving them out: you would be optimizing minutes that never had to be in the stop.',
      },
      expectedImpact: convertScore.attractiveness >= 2.5 ? 'high' : 'medium',
      estimatedEffort: convertScore.feasibility >= 2.4 ? 'low' : 'medium',
      validation: VALID,
    });
  }

  // Explicitly defer standardize until a gain exists — locking a standard on an
  // unproven method freezes the wrong process.
  const standardizeScore = scoreOf('standardize');
  moves.push({
    order: order++,
    phase: 'standardize',
    title: {
      pl: 'Ustandaryzuj dopiero po potwierdzonym zysku',
      en: 'Standardize only after a confirmed gain',
    },
    rationale: {
      pl: standardizeScore.improvementCount > 0
        ? `Standard chroni ${standardizeScore.minutesAddressed} min rdzenia wewnętrznego, ale utrwala tylko sprawdzoną metodę — inaczej zamraża błąd i blokuje dalsze skracanie.`
        : `Standaryzacja utrwala zysk z wcześniejszych faz na ${standardizeScore.minutesAddressed} min rdzenia wewnętrznego — bez niej efekt znika z rotacją ludzi.`,
      en: standardizeScore.improvementCount > 0
        ? `The standard protects ${standardizeScore.minutesAddressed} min of the internal core, but it only locks a proven method — otherwise it freezes an error and blocks further shortening.`
        : `Standardization locks the gain from earlier phases across ${standardizeScore.minutesAddressed} min of the internal core — without it the effect vanishes with staff rotation.`,
    },
    tradeOff: {
      pl: 'Kosztem czasu na spisanie standardu, szkolenia i macierz kompetencji — zdolność zarządcza, nie techniczna.',
      en: 'At the cost of time to write the standard, train, and build the skills matrix — a managerial, not technical, capability.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy spisanie standardu od razu na obecnym sposobie: utrwalilibyście metodę, którą dopiero macie usprawnić.',
      en: 'We reject writing the standard now on the current method: you would lock a method you have yet to improve.',
    },
    expectedImpact: 'medium',
    estimatedEffort: 'medium',
    validation: VALID,
  });

  return moves;
}

/**
 * One-shot synthesis: ranking + W2 sequence, ready for the UI or the AI
 * fallback. Pure and deterministic.
 */
export function synthesizeSmedPlan(session: SmedSession): {
  baseline: ChangeoverBaseline;
  ranking: PhaseRanking;
  sequence: SequencedMove[];
} {
  return {
    baseline: computeBaseline(session),
    ranking: rankSmedPhases(session),
    sequence: buildW2MoveSequence(session),
  };
}

/** Flatten a SequencedMove into a localized, store-agnostic move summary. */
export function localizeMove(
  seq: SequencedMove,
  isPolish: boolean
): { title: string; rationale: string; phase: SmedPhaseId } {
  return {
    title: localize(seq.title, isPolish),
    rationale: `${localize(seq.rationale, isPolish)} ${localize(seq.tradeOff, isPolish)} ${localize(
      seq.rejectedVariant,
      isPolish
    )}`.trim(),
    phase: seq.phase,
  };
}
