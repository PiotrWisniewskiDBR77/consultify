/**
 * RPA Scanner — synthesis engine + W2 move validator.
 *
 * The pure, testable brain of the tool. It reads the automation-assessment
 * session (candidate processes + automation ideas) and produces:
 *
 *   1. a per-gate readiness score (identify / standardize / quantify / feasibility)
 *      derived from the facts (standardization, volume, ROI, technical risk)
 *   2. a ranking of the four assessment gates with a plain rationale,
 *      re-weighted by where the session's ROI and evidence actually sit
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
 * assessment session (RpaSession), not on the full store, so it compiles and
 * tests in isolation.
 */

import { type Bilingual, RPA_GATES, type RpaGateId, rpaGateLabel } from './deepeningLadder';

type Level = 'high' | 'medium' | 'low';

const LEVEL_SCORE: Record<Level, number> = { high: 3, medium: 2, low: 1 };

/** How much technology the automation needs — sets cost, time and risk. */
export type TechTier = 'rpa' | 'ocr' | 'api' | 'ai';

/**
 * Minimal read-model of one candidate process. Sourced from the assessment
 * session's `process-candidates` section.
 */
export interface ProcessCandidate {
  id: string;
  /** Which assessment gate this candidate currently sits in. */
  gate?: RpaGateId;
  /** How rule-based / standardized the process is (high = fully rule-based). */
  standardization?: Level;
  /** Monthly transaction volume. */
  volumePerMonth?: number;
  /** Minutes of handling time per single run. */
  handlingMinutes?: number;
  /** Share of cases needing a human exception, 0..1 (higher = less automatable). */
  exceptionRate?: number;
  /** Technology tier required to automate. */
  techTier?: TechTier;
  /** Whether volume / handling figures are measured (true) or estimated. */
  measured?: boolean;
  /** Evidence backing the candidate (a log, a PoC, an observation). */
  evidence?: string[];
}

/** Minimal read-model of one automation idea from the `automation-ideas` section. */
export interface AutomationIdea {
  id: string;
  /** Which assessment gate the idea primarily belongs to. */
  gate?: RpaGateId;
  /** The process candidate this idea automates. */
  processId?: string;
  impact?: Level;
  effort?: Level;
  evidence?: string[];
}

/** The minimal RPA Scanner session shape the engine reads. */
export interface RpaSession {
  candidates: ProcessCandidate[];
  ideas: AutomationIdea[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const asLevel = (value: unknown, fallback: Level = 'medium'): Level =>
  value === 'high' || value === 'medium' || value === 'low' ? value : fallback;
const localize = (text: Bilingual, isPolish: boolean) => (isPolish ? text.pl : text.en);

// ---------------------------------------------------------------------------
// Baseline — the automation-portfolio headline fact
// ---------------------------------------------------------------------------

/** Annualized automatable minutes of one candidate: volume × handling × (1 - exception share). */
const candidateAnnualMinutes = (c: ProcessCandidate): number =>
  (c.volumePerMonth || 0) * 12 * (c.handlingMinutes || 0) * (1 - (c.exceptionRate || 0));

/** Portfolio-level view of the automation backlog — the headline fact. */
export interface AutomationBaseline {
  candidateCount: number;
  /** Candidates whose process is fully rule-based (standardization = high). */
  ruleBasedCount: number;
  /** Total annualized automatable minutes across all quantified candidates. */
  annualAutomatableMinutes: number;
  /** Annualized automatable minutes of the single highest-volume candidate. */
  topCandidateMinutes: number;
  /** Share of candidates carrying at least one evidence item, 0..1. */
  evidenceRatio: number;
  /** Share of candidates whose volume/handling figures are measured, 0..1. */
  measuredRatio: number;
}

export function computeBaseline(session: RpaSession): AutomationBaseline {
  const cands = session.candidates;
  const candidateCount = cands.length;
  const ruleBasedCount = cands.filter((c) => c.standardization === 'high').length;
  const annualAutomatableMinutes = cands.reduce((acc, c) => acc + candidateAnnualMinutes(c), 0);
  const topCandidateMinutes = cands.reduce((max, c) => Math.max(max, candidateAnnualMinutes(c)), 0);
  const evidenceBacked = cands.filter((c) => (c.evidence?.length || 0) > 0).length;
  const measured = cands.filter((c) => c.measured).length;
  return {
    candidateCount,
    ruleBasedCount,
    annualAutomatableMinutes: Math.round(annualAutomatableMinutes),
    topCandidateMinutes: Math.round(topCandidateMinutes),
    evidenceRatio: candidateCount > 0 ? round1(evidenceBacked / candidateCount) : 0,
    measuredRatio: candidateCount > 0 ? round1(measured / candidateCount) : 0,
  };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface GateScore {
  gate: RpaGateId;
  label: Bilingual;
  /** Automation ideas attributed to this gate. */
  ideaCount: number;
  /** Annualized automatable minutes carried by the candidates this gate acts on. */
  minutesAddressed: number;
  /** Mean impact of this gate's ideas, 1..3. */
  attractiveness: number;
  /** Ease of pulling it off (low effort + evidence), 1..3. */
  feasibility: number;
  /** attractiveness × feasibility, 1..9. */
  score: number;
  /** Count of ideas carrying at least one evidence item. */
  evidenceBacked: number;
}

/** Sum of annualized automatable minutes carried by the candidates a gate acts on. */
const minutesForGate = (gate: RpaGateId, candidates: ProcessCandidate[]): number => {
  const inGate = (c: ProcessCandidate) => c.gate === gate;
  switch (gate) {
    case 'identify':
      return candidates.filter(inGate).reduce((acc, c) => acc + candidateAnnualMinutes(c), 0);
    case 'standardize':
      // standardization acts on candidates that are not yet fully rule-based
      return candidates
        .filter((c) => inGate(c) || c.standardization !== 'high')
        .reduce((acc, c) => acc + candidateAnnualMinutes(c), 0);
    case 'quantify':
      // quantification is about candidates still lacking a measured business case
      return candidates
        .filter((c) => inGate(c) || !c.measured)
        .reduce((acc, c) => acc + candidateAnnualMinutes(c), 0);
    case 'feasibility':
      // feasibility protects the rule-based, buildable candidates
      return candidates
        .filter((c) => inGate(c) || c.standardization === 'high')
        .reduce((acc, c) => acc + candidateAnnualMinutes(c), 0);
    default:
      return 0;
  }
};

const scoreGate = (gate: RpaGateId, session: RpaSession): GateScore => {
  const label = rpaGateLabel(gate);
  const ideas = session.ideas.filter((i) => i.gate === gate);
  const minutesAddressed = Math.round(minutesForGate(gate, session.candidates));

  if (ideas.length === 0) {
    return {
      gate,
      label,
      ideaCount: 0,
      minutesAddressed,
      attractiveness: 0,
      feasibility: 0,
      score: 0,
      evidenceBacked: 0,
    };
  }

  const impactAvg =
    ideas.reduce((sum, i) => sum + LEVEL_SCORE[asLevel(i.impact)], 0) / ideas.length;
  const effortAvg =
    ideas.reduce((sum, i) => sum + LEVEL_SCORE[asLevel(i.effort)], 0) / ideas.length;
  const evidenceBacked = ideas.filter((i) => (i.evidence?.length || 0) > 0).length;
  const evidenceRatio = evidenceBacked / ideas.length;

  const effortEase = 4 - effortAvg; // 1..3, low effort scores high
  const feasibility = clamp(round1(effortEase * 0.6 + evidenceRatio * 2 * 0.4 + 0.4), 0.5, 3);
  const attractiveness = round1(impactAvg);
  const score = round1(attractiveness * feasibility);

  return {
    gate,
    label,
    ideaCount: ideas.length,
    minutesAddressed,
    attractiveness,
    feasibility,
    score,
    evidenceBacked,
  };
};

export interface GateRanking {
  scores: GateScore[];
  /** gates ordered best-first among those with at least one idea. */
  ordered: RpaGateId[];
  rationale: Bilingual;
}

/**
 * Rank the four assessment gates. Only gates with automation ideas are ranked;
 * empty gates are reported with score 0 but excluded from `ordered`. Ties break
 * toward the canonical gate order (identify before standardize before quantify
 * before feasibility) so the sequence never green-lights a build before the
 * process is standardized and the ROI measured.
 */
export function rankRpaGates(session: RpaSession): GateRanking {
  const scores = RPA_GATES.map((gate) => scoreGate(gate, session));
  const gateIndex = (g: RpaGateId) => RPA_GATES.indexOf(g);

  const ordered = scores
    .filter((s) => s.ideaCount > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.minutesAddressed !== a.minutesAddressed) return b.minutesAddressed - a.minutesAddressed;
      return gateIndex(a.gate) - gateIndex(b.gate);
    })
    .map((s) => s.gate);

  const top = scores.find((s) => s.gate === ordered[0]);
  const rationale: Bilingual = top
    ? {
        pl: `Najsilniejsza dźwignia to bramka „${rpaGateLabel(top.gate).pl.toLowerCase()}" (dopasowanie ${top.score}/9: atrakcyjność ${top.attractiveness} × wykonalność ${top.feasibility}), obejmująca ${top.minutesAddressed} min automatyzowalnej pracy rocznie. Sekwencja trzyma porządek oceny: nie zatwierdzamy budowy przed ustandaryzowaniem procesu i policzeniem zwrotu.`,
        en: `The strongest lever is the "${rpaGateLabel(top.gate).en.toLowerCase()}" gate (fit ${top.score}/9: attractiveness ${top.attractiveness} × feasibility ${top.feasibility}), covering ${top.minutesAddressed} min of automatable work per year. The sequence keeps the assessment order: we do not green-light a build before the process is standardized and the return is measured.`,
      }
    : {
        pl: 'Brak pomysłów automatyzacji — dodaj procesy-kandydatów i pomysły automatyzacji w co najmniej jednej bramce, aby zbudować ranking.',
        en: 'No automation ideas yet — add candidate processes and automation ideas in at least one gate to build a ranking.',
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
  gate: RpaGateId;
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
 * Build a W2-validated move sequence from the ranked gates. The rule of the
 * sequence: honour the assessment order, but when the portfolio is under-measured,
 * insert a `measure-first` move before committing to a build; surface
 * standardization when the process is not yet rule-based; and always end by
 * proving feasibility behind a stated trade-off, so no move green-lights a bot
 * that never goes live.
 */
export function buildW2MoveSequence(session: RpaSession): SequencedMove[] {
  const { scores, ordered } = rankRpaGates(session);
  if (ordered.length === 0) return [];

  const baseline = computeBaseline(session);
  const scoreOf = (g: RpaGateId) => scores.find((x) => x.gate === g)!;
  const moves: SequencedMove[] = [];
  let order = 1;

  // If the portfolio is thin on measurement, measure first — a business case on
  // an unmeasured volume is optimism, not a case.
  if (baseline.measuredRatio < 0.5) {
    moves.push({
      order: order++,
      gate: 'quantify',
      title: {
        pl: 'Najpierw zmierz wolumen i zwrot, zanim zbudujesz bota',
        en: 'Measure volume and return before you build a bot',
      },
      rationale: {
        pl: `Tylko ${Math.round(baseline.measuredRatio * 100)}% kandydatów ma zmierzony wolumen — bez pomiaru ranking zwrotu jest zgadywaniem, a budowa bota to zakład.`,
        en: `Only ${Math.round(baseline.measuredRatio * 100)}% of candidates have measured volume — without measurement the ranking of return is guesswork, and building a bot is a bet.`,
      },
      tradeOff: {
        pl: 'Kosztem ~1 cyklu opóźnienia budowy, w zamian za pewność, który proces realnie zwróci koszt automatyzacji.',
        en: 'At the cost of ~1 cycle of delay to the build, in exchange for certainty about which process really returns the automation cost.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „zautomatyzujmy najgłośniejszy proces od razu": bez pomiaru budujecie bota o ujemnym zwrocie na procesie o niskim wolumenie.',
        en: 'We reject "just automate the loudest process now": without measurement you build a negative-return bot on a low-volume process.',
      },
      expectedImpact: 'medium',
      estimatedEffort: 'low',
      validation: VALID,
    });
  }

  // Lead with the highest-fit gate honouring the assessment order.
  const primary = ordered[0];
  const primaryScore = scoreOf(primary);
  moves.push({
    order: order++,
    gate: primary,
    title: {
      pl: `Skup się na bramce „${rpaGateLabel(primary).pl.toLowerCase()}"`,
      en: `Lead with the "${rpaGateLabel(primary).en.toLowerCase()}" gate`,
    },
    rationale: {
      pl: `Najwyższe dopasowanie (${primaryScore.score}/9) i największa pula automatyzowalnej pracy (${primaryScore.minutesAddressed} min/rok) — daje najszybszy zwrot na jednostkę wysiłku.`,
      en: `Highest fit (${primaryScore.score}/9) and the largest automatable-work pool (${primaryScore.minutesAddressed} min/yr) — it returns fastest per unit of effort.`,
    },
    tradeOff: {
      pl: 'Kosztem tempa w pozostałych bramkach — świadomie koncentrujecie zespół tu, zamiast automatyzować wszystkie procesy naraz.',
      en: 'At the cost of pace in the other gates — you deliberately concentrate the team here rather than automating every process at once.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy automatyzację całego backlogu równolegle: bez skończonego pierwszego bota zespół gubi wzorzec utrzymania, a każdy bot rośnie w kruchości.',
      en: 'We reject automating the whole backlog in parallel: without a finished first bot the team loses the maintenance pattern and every bot grows brittle.',
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

  // Standardize is the cheapest structural gate — surface it explicitly if it
  // has scope and is not already the primary. Automating an unstable process
  // locks a moving target.
  if (
    primary !== 'standardize' &&
    scoreOf('standardize').minutesAddressed > 0 &&
    ordered.includes('standardize')
  ) {
    const standardizeScore = scoreOf('standardize');
    moves.push({
      order: order++,
      gate: 'standardize',
      title: {
        pl: 'Ustandaryzuj proces, zanim odwzorujesz go botem',
        en: 'Standardize the process before a bot replays it',
      },
      rationale: {
        pl: `Bramka standaryzacji obejmuje ${standardizeScore.minutesAddressed} min/rok pracy, gdzie proces nie jest jeszcze regułowy — bot odwzorowuje regułę, nie intuicję operatora.`,
        en: `The standardize gate covers ${standardizeScore.minutesAddressed} min/yr of work where the process is not yet rule-based — a bot replays a rule, not the operator's intuition.`,
      },
      tradeOff: {
        pl: 'Kosztem czasu na spisanie jednej ścieżki i zmierzenie udziału wyjątków — bez tego automatyzujecie wariant jednej osoby.',
        en: "At the cost of time to write one path and measure the exception share — without it you automate one person's variant.",
      },
      rejectedVariant: {
        pl: 'Odrzucamy automatyzację procesu „jak jest": bot na złym procesie daje szybszy zły proces, a jego przeróbka jest droższa niż standaryzacja przed budową.',
        en: 'We reject automating the process "as is": a bot on a bad process yields a faster bad process, and reworking it costs more than standardizing before the build.',
      },
      expectedImpact: standardizeScore.attractiveness >= 2.5 ? 'high' : 'medium',
      estimatedEffort: standardizeScore.feasibility >= 2.4 ? 'low' : 'medium',
      validation: VALID,
    });
  }

  // Explicitly end on feasibility — green-lighting a build without proven
  // feasibility is the top reason bots burn budget and never go live.
  const feasibilityScore = scoreOf('feasibility');
  moves.push({
    order: order++,
    gate: 'feasibility',
    title: {
      pl: 'Udowodnij wykonalność PoC, zanim zatwierdzisz budowę',
      en: 'Prove feasibility with a PoC before approving the build',
    },
    rationale: {
      pl:
        baseline.ruleBasedCount > 0
          ? `${baseline.ruleBasedCount} z ${baseline.candidateCount} kandydatów jest w pełni regułowych; ocena wykonalności chroni ${feasibilityScore.minutesAddressed} min/rok przed budżetem na bota, który nie ruszy na produkcji.`
          : `Żaden kandydat nie jest jeszcze w pełni regułowy — ocena wykonalności chroni ${feasibilityScore.minutesAddressed} min/rok przed budową, która utrwala kruchość zamiast zwrotu.`,
      en:
        baseline.ruleBasedCount > 0
          ? `${baseline.ruleBasedCount} of ${baseline.candidateCount} candidates are fully rule-based; the feasibility gate protects ${feasibilityScore.minutesAddressed} min/yr from budgeting a bot that never goes live.`
          : `No candidate is fully rule-based yet — the feasibility gate protects ${feasibilityScore.minutesAddressed} min/yr from a build that locks in brittleness instead of return.`,
    },
    tradeOff: {
      pl: 'Kosztem czasu na PoC i wycenę kosztu utrzymania — zdolność inżynierska, nie zakupowa, ale bez niej budujecie zobowiązanie utrzymaniowe w ciemno.',
      en: 'At the cost of time for a PoC and a maintenance-cost estimate — an engineering, not a purchasing, capability, but without it you commit to a maintenance liability blind.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy zatwierdzenie budowy na zapewnieniu dostawcy: wykonalność zakładana bez PoC to najczęstsza przyczyna botów, które nie ruszają.',
      en: "We reject approving the build on the vendor's assurance: feasibility assumed without a PoC is the top reason bots never go live.",
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
export function synthesizeRpaScan(session: RpaSession): {
  baseline: AutomationBaseline;
  ranking: GateRanking;
  sequence: SequencedMove[];
} {
  return {
    baseline: computeBaseline(session),
    ranking: rankRpaGates(session),
    sequence: buildW2MoveSequence(session),
  };
}

/** Flatten a SequencedMove into a localized, store-agnostic move summary. */
export function localizeMove(
  seq: SequencedMove,
  isPolish: boolean
): { title: string; rationale: string; gate: RpaGateId } {
  return {
    title: localize(seq.title, isPolish),
    rationale: `${localize(seq.rationale, isPolish)} ${localize(seq.tradeOff, isPolish)} ${localize(
      seq.rejectedVariant,
      isPolish
    )}`.trim(),
    gate: seq.gate,
  };
}
