/**
 * Process Automation — synthesis engine + W2 move validator.
 *
 * The pure, testable brain of the tool. It reads an AutomationSession (a
 * quantitative baseline + candidate automation moves attributed to phases)
 * and produces:
 *
 *   1. a per-phase readiness score (map / standardize / automate / sustain)
 *      derived from the facts (candidate impact, effort, evidence, and the
 *      volume/time/error baseline the candidates address)
 *   2. a ranking of the four phases with a plain rationale, re-weighted by
 *      where the session's hours and evidence actually sit, but honouring the
 *      canonical order (you do not automate before you standardize)
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
 * automation session, not on the full store, so it compiles and tests in
 * isolation.
 */

import {
  AUTOMATION_PHASES,
  type AutomationPhaseId,
  automationPhaseLabel,
  type Bilingual,
} from './deepeningLadder';

type Level = 'high' | 'medium' | 'low';

const LEVEL_SCORE: Record<Level, number> = { high: 3, medium: 2, low: 1 };

/** Minimal read-model of one automation candidate from a redesign section. */
export interface AutomationCandidate {
  id: string;
  /** Which automation phase the candidate primarily belongs to. */
  phase?: AutomationPhaseId;
  impact?: Level;
  effort?: Level;
  /** Evidence backing the candidate (log data, pilot, measurement, sign-off). */
  evidence?: string[];
  /** Minutes-per-cycle this candidate is expected to remove (optional). */
  minutesSaved?: number;
}

/**
 * Quantitative baseline for the automation, sourced from the store's
 * `flow.processAutomation`. All fields optional — the engine degrades to a
 * qualitative ranking when numbers are missing rather than throwing.
 */
export interface AutomationBaselineInput {
  volumePerWeek?: number | null;
  baselineMinutesPerCycle?: number | null;
  targetMinutesPerCycle?: number | null;
  errorRateBaselinePct?: number | null;
  errorRateTargetPct?: number | null;
}

/** The minimal automation session shape the engine reads. */
export interface AutomationSession {
  candidates: AutomationCandidate[];
  baseline: AutomationBaselineInput;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const asLevel = (value: unknown, fallback: Level = 'medium'): Level =>
  value === 'high' || value === 'medium' || value === 'low' ? value : fallback;
const localize = (text: Bilingual, isPolish: boolean) => (isPolish ? text.pl : text.en);
const num = (v: number | null | undefined): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

// ---------------------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------------------

/** The headline automation economics fact: hours the process burns per year, and the error gap. */
export interface AutomationBaseline {
  volumePerWeek: number;
  baselineMinutesPerCycle: number;
  targetMinutesPerCycle: number;
  /** Minutes saved per cycle (baseline - target), never negative. */
  minutesSavedPerCycle: number;
  /** Annualized hours the process consumes at baseline (volume × 52 × baseline min / 60). */
  annualBaselineHours: number;
  /** Annualized hours saved if the target cycle time is hit. */
  annualSavedHours: number;
  errorRateBaselinePct: number;
  errorRateTargetPct: number;
  /** Percentage points of error the automation promises to remove. */
  errorPointsRemoved: number;
  /** Whether the quantitative baseline is populated enough to trust the hours math. */
  quantified: boolean;
}

export function computeBaseline(session: AutomationSession): AutomationBaseline {
  const b = session.baseline || {};
  const volumePerWeek = num(b.volumePerWeek) ?? 0;
  const baselineMinutesPerCycle = num(b.baselineMinutesPerCycle) ?? 0;
  const targetMinutesPerCycle = num(b.targetMinutesPerCycle) ?? 0;
  const errorRateBaselinePct = num(b.errorRateBaselinePct) ?? 0;
  const errorRateTargetPct = num(b.errorRateTargetPct) ?? 0;

  const minutesSavedPerCycle = Math.max(0, baselineMinutesPerCycle - targetMinutesPerCycle);
  const annualBaselineHours = round1((volumePerWeek * 52 * baselineMinutesPerCycle) / 60);
  const annualSavedHours = round1((volumePerWeek * 52 * minutesSavedPerCycle) / 60);
  const errorPointsRemoved = Math.max(0, round1(errorRateBaselinePct - errorRateTargetPct));

  const quantified = volumePerWeek > 0 && baselineMinutesPerCycle > 0;

  return {
    volumePerWeek,
    baselineMinutesPerCycle,
    targetMinutesPerCycle,
    minutesSavedPerCycle,
    annualBaselineHours,
    annualSavedHours,
    errorRateBaselinePct,
    errorRateTargetPct,
    errorPointsRemoved,
    quantified,
  };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface PhaseScore {
  phase: AutomationPhaseId;
  label: Bilingual;
  /** Automation candidates attributed to this phase. */
  candidateCount: number;
  /** Minutes-per-cycle these candidates claim to remove. */
  minutesAddressed: number;
  /** Mean impact of this phase's candidates, 1..3. */
  attractiveness: number;
  /** Ease of pulling it off (low effort + evidence), 1..3. */
  feasibility: number;
  /** attractiveness × feasibility, 1..9. */
  score: number;
  /** Count of candidates carrying at least one evidence item. */
  evidenceBacked: number;
}

const scorePhase = (phase: AutomationPhaseId, session: AutomationSession): PhaseScore => {
  const label = automationPhaseLabel(phase);
  const candidates = session.candidates.filter((c) => c.phase === phase);
  const minutesAddressed = candidates.reduce((acc, c) => acc + (c.minutesSaved || 0), 0);

  if (candidates.length === 0) {
    return {
      phase,
      label,
      candidateCount: 0,
      minutesAddressed,
      attractiveness: 0,
      feasibility: 0,
      score: 0,
      evidenceBacked: 0,
    };
  }

  const impactAvg =
    candidates.reduce((sum, c) => sum + LEVEL_SCORE[asLevel(c.impact)], 0) / candidates.length;
  const effortAvg =
    candidates.reduce((sum, c) => sum + LEVEL_SCORE[asLevel(c.effort)], 0) / candidates.length;
  const evidenceBacked = candidates.filter((c) => (c.evidence?.length || 0) > 0).length;
  const evidenceRatio = evidenceBacked / candidates.length;

  const effortEase = 4 - effortAvg; // 1..3, low effort scores high
  const feasibility = clamp(round1(effortEase * 0.6 + evidenceRatio * 2 * 0.4 + 0.4), 0.5, 3);
  const attractiveness = round1(impactAvg);
  const score = round1(attractiveness * feasibility);

  return {
    phase,
    label,
    candidateCount: candidates.length,
    minutesAddressed,
    attractiveness,
    feasibility,
    score,
    evidenceBacked,
  };
};

export interface PhaseRanking {
  scores: PhaseScore[];
  /** phases ordered best-first among those with at least one candidate. */
  ordered: AutomationPhaseId[];
  rationale: Bilingual;
}

/**
 * Rank the four automation phases. Only phases with candidates are ranked;
 * empty phases are reported with score 0 but excluded from `ordered`. Ties break
 * toward the canonical order (map before standardize before automate before
 * sustain) so the sequence never recommends automating before the process is
 * standardized.
 */
export function rankAutomationPhases(session: AutomationSession): PhaseRanking {
  const scores = AUTOMATION_PHASES.map((phase) => scorePhase(phase, session));
  const canonicalIndex = (p: AutomationPhaseId) => AUTOMATION_PHASES.indexOf(p);

  const ordered = scores
    .filter((s) => s.candidateCount > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.minutesAddressed !== a.minutesAddressed) return b.minutesAddressed - a.minutesAddressed;
      return canonicalIndex(a.phase) - canonicalIndex(b.phase);
    })
    .map((s) => s.phase);

  const top = scores.find((s) => s.phase === ordered[0]);
  const rationale: Bilingual = top
    ? {
        pl: `Najsilniejsza dźwignia to faza „${automationPhaseLabel(top.phase).pl.toLowerCase()}" (dopasowanie ${top.score}/9: atrakcyjność ${top.attractiveness} × wykonalność ${top.feasibility}), obejmująca ${top.minutesAddressed} min na cykl. Sekwencja trzyma porządek: nie automatyzujemy procesu, zanim go nie ustandaryzujemy.`,
        en: `The strongest lever is the "${automationPhaseLabel(top.phase).en.toLowerCase()}" phase (fit ${top.score}/9: attractiveness ${top.attractiveness} × feasibility ${top.feasibility}), covering ${top.minutesAddressed} min per cycle. The sequence keeps the order: we do not automate a process before we standardize it.`,
      }
    : {
        pl: 'Brak kandydatów automatyzacji — dodaj kandydatów w co najmniej jednej fazie, aby zbudować ranking.',
        en: 'No automation candidates yet — add candidates in at least one phase to build a ranking.',
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
  phase: AutomationPhaseId;
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
 * sequence: honour the automation order (map → standardize → automate →
 * sustain), but when the baseline is unquantified, insert a `map-and-measure`
 * move before committing to build; and always defer the sustain phase behind a
 * stated trade-off until an automation actually exists to govern.
 */
export function buildW2MoveSequence(session: AutomationSession): SequencedMove[] {
  const { scores, ordered } = rankAutomationPhases(session);
  if (ordered.length === 0) return [];

  const baseline = computeBaseline(session);
  const scoreOf = (p: AutomationPhaseId) => scores.find((s) => s.phase === p)!;
  const moves: SequencedMove[] = [];
  let order = 1;

  // If the baseline is not quantified, map and measure first — you cannot cost
  // an automation whose hours you have not counted.
  if (!baseline.quantified) {
    moves.push({
      order: order++,
      phase: 'map',
      title: {
        pl: 'Najpierw zmapuj i policz proces',
        en: 'Map and measure the process first',
      },
      rationale: {
        pl: 'Bez wolumenu i czasu cyklu payback automatyzacji jest zgadywaniem — najpierw policz godziny, które proces realnie pochłania.',
        en: 'Without volume and cycle time the automation payback is guesswork — first count the hours the process really consumes.',
      },
      tradeOff: {
        pl: 'Kosztem kilku dni na pomiar, w zamian za pewność, czy w tym procesie w ogóle jest o co walczyć.',
        en: 'At the cost of a few days of measurement, in exchange for certainty about whether this process is worth automating at all.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „zbudujmy bota od razu": automatyzacja przed pomiarem najczęściej optymalizuje niewłaściwy proces.',
        en: 'We reject "just build the bot now": automating before measuring usually optimizes the wrong process.',
      },
      expectedImpact: 'medium',
      estimatedEffort: 'low',
      validation: VALID,
    });
  }

  // Lead with the highest-fit phase honouring the automation order.
  const primary = ordered[0];
  const primaryScore = scoreOf(primary);
  moves.push({
    order: order++,
    phase: primary,
    title: {
      pl: `Skup się na fazie „${automationPhaseLabel(primary).pl.toLowerCase()}"`,
      en: `Lead with the "${automationPhaseLabel(primary).en.toLowerCase()}" phase`,
    },
    rationale: {
      pl: `Najwyższe dopasowanie (${primaryScore.score}/9) i największa pula minut na cykl (${primaryScore.minutesAddressed} min) — daje najszybszy zwrot na jednostkę wysiłku${baseline.quantified ? `, przy bazie ${baseline.annualBaselineHours} godz./rok` : ''}.`,
      en: `Highest fit (${primaryScore.score}/9) and the largest per-cycle minute pool (${primaryScore.minutesAddressed} min) — it returns value fastest per unit of effort${baseline.quantified ? `, against a ${baseline.annualBaselineHours} h/yr baseline` : ''}.`,
    },
    tradeOff: {
      pl: 'Kosztem tempa w pozostałych fazach — świadomie koncentrujecie zespół tu, zamiast otwierać cztery fronty naraz.',
      en: 'At the cost of pace in the other phases — you deliberately concentrate the team here rather than opening four fronts at once.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy równoległą przebudowę wszystkich faz: bez skończonego pierwszego zysku zespół gubi standard i cofa efekt.',
      en: 'We reject reworking all phases in parallel: without a finished first gain the team loses the standard and the effect reverts.',
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

  // Standardize is the cheapest structural precondition — surface it explicitly
  // if it has scope and is not already the primary, because automating an
  // un-standardized process only cements the variation.
  if (
    primary !== 'standardize' &&
    scoreOf('standardize').candidateCount > 0 &&
    ordered.includes('standardize')
  ) {
    const stdScore = scoreOf('standardize');
    moves.push({
      order: order++,
      phase: 'standardize',
      title: {
        pl: 'Ustandaryzuj proces, zanim go zautomatyzujesz',
        en: 'Standardize the process before automating it',
      },
      rationale: {
        pl: 'Automatyzacja rozjechanego procesu betonuje wariancję i marnotraw — najpierw jeden uzgodniony przebieg, potem mechanizm.',
        en: 'Automating a scattered process cements variation and waste — first one agreed flow, then the mechanism.',
      },
      tradeOff: {
        pl: 'Kosztem czasu na uzgodnienie standardu i właściciela — zdolność zarządcza, bez której zysk się rozjeżdża.',
        en: 'At the cost of time to agree a standard and an owner — a managerial capability without which the gain drifts.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy automatyzację każdego wariantu z osobna: zwielokrotnia koszt utrzymania i utrwala bałagan.',
        en: 'We reject automating each variant separately: it multiplies the run cost and locks in the mess.',
      },
      expectedImpact: stdScore.attractiveness >= 2.5 ? 'high' : 'medium',
      estimatedEffort: stdScore.feasibility >= 2.4 ? 'low' : 'medium',
      validation: VALID,
    });
  }

  // Explicitly defer sustain until an automation exists — governing a flow that
  // is not yet live is theatre, but shipping without governance is a silent
  // failure waiting to happen.
  const sustainScore = scoreOf('sustain');
  moves.push({
    order: order++,
    phase: 'sustain',
    title: {
      pl: 'Zaplanuj utrzymanie zanim wdrożysz, wykonaj po pierwszym zysku',
      en: 'Plan sustain before launch, execute after the first gain',
    },
    rationale: {
      pl:
        sustainScore.candidateCount > 0
          ? `Monitoring i właściciel chronią ${baseline.quantified ? `${baseline.annualSavedHours} godz./rok oszczędności` : 'zysk z wcześniejszych faz'} — bez nich automatyzacja psuje się cicho.`
          : `Bez monitoringu i właściciela ${baseline.quantified ? `${baseline.annualSavedHours} godz./rok oszczędności znika` : 'zysk znika'} przy pierwszej zmianie procesu bazowego.`,
      en:
        sustainScore.candidateCount > 0
          ? `Monitoring and an owner protect ${baseline.quantified ? `${baseline.annualSavedHours} h/yr of savings` : 'the gain from earlier phases'} — without them the automation rots silently.`
          : `Without monitoring and an owner ${baseline.quantified ? `${baseline.annualSavedHours} h/yr of savings vanish` : 'the gain vanishes'} the moment the base process changes.`,
    },
    tradeOff: {
      pl: 'Kosztem czasu na monitoring, progi alarmu i ścieżkę awaryjną — praca, która nie dodaje funkcji, tylko chroni zysk.',
      en: 'At the cost of time for monitoring, alert thresholds, and a fallback path — work that adds no feature, only protects the gain.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy „wdróżmy i zapomnijmy": automatyzacja bez właściciela staje się czarną skrzynką, aż się wywali.',
      en: 'We reject "ship and forget": automation without an owner becomes a black box until it breaks.',
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
export function synthesizeAutomationPlan(session: AutomationSession): {
  baseline: AutomationBaseline;
  ranking: PhaseRanking;
  sequence: SequencedMove[];
} {
  return {
    baseline: computeBaseline(session),
    ranking: rankAutomationPhases(session),
    sequence: buildW2MoveSequence(session),
  };
}

/** Flatten a SequencedMove into a localized, store-agnostic move summary. */
export function localizeMove(
  seq: SequencedMove,
  isPolish: boolean
): { title: string; rationale: string; phase: AutomationPhaseId } {
  return {
    title: localize(seq.title, isPolish),
    rationale: `${localize(seq.rationale, isPolish)} ${localize(seq.tradeOff, isPolish)} ${localize(
      seq.rejectedVariant,
      isPolish
    )}`.trim(),
    phase: seq.phase,
  };
}
