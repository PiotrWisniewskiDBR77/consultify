/**
 * Automation Pipeline — synthesis engine + W2 move validator.
 *
 * The pure, testable brain of the tool. It reads the pipeline session (candidate
 * processes + automation moves) and produces the RDZEŃ (core) of the doctrine:
 *
 *   1. per-process TECHNOLOGY FIT — picks the right tier (RPA / IDP / IPA / agentic /
 *      redesign-first) from the process profile, NOT from an averaged score. The
 *      profile (rule-ness × data structure × judgment) decides the tier; getting
 *      this wrong is the doctrine's single most expensive error.
 *   2. per-process EFFORT × IMPACT quadrant — quick win / strategic bet / fill-in /
 *      question mark, on axes derived from FTE-hours + risk (impact) and tech tier +
 *      stability + TCO (effort).
 *   3. "AUTOMATING A BAD PROCESS" detection — high exception rate / low
 *      standardization → the process needs a REDESIGN before any technology; the
 *      engine forces `redesign-first` and never green-lights automating the chaos.
 *   4. hidden-volume / TCO QUANTIFICATION — the portfolio's total FTE-hours, the
 *      largest single (often unreported) block, and the share of volume trapped in
 *      not-ready processes.
 *   5. per-lever readiness SCORING (discover / profile / technology / prioritize /
 *      sequence) and a WAVE SEQUENCE (wave 0 quick wins → wave 1 scale + CoE →
 *      wave 2 strategic bets → redesign track), every move W2-validated
 *      (rationale / tradeOff / rejectedVariant).
 *
 * The W2 validator is the near-literal transfer of the SMED/Ansoff/SWOT
 * "move must justify itself" contract: a move is only VALID when all three
 * fields are present and non-trivial.
 *
 * This layer is self-contained: it depends only on a minimal read-model of the
 * pipeline session (AutomationPipelineSession), not on the full store, so it
 * compiles and tests in isolation.
 */

import {
  PIPELINE_LEVERS,
  pipelineLeverLabel,
  type Bilingual,
  type PipelineLeverId,
} from './deepeningLadder';

type Level = 'high' | 'medium' | 'low';

const LEVEL_SCORE: Record<Level, number> = { high: 3, medium: 2, low: 1 };

/**
 * Technology tier a process needs, along the doctrine's automation continuum
 * (section 4.2). Rising in cognitive complexity; `redesign-first` is the escape
 * hatch for processes not yet fit for ANY tier.
 */
export type TechTier = 'rpa' | 'idp' | 'ipa' | 'agentic' | 'redesign-first';

/** Structure of a process's input data — the primary driver of tech tier. */
export type DataStructure = 'system' | 'structured-doc' | 'unstructured-doc' | 'free-text';

/** The effort × impact quadrant a candidate lands in (doctrine section 4.4). */
export type Quadrant = 'quick-win' | 'strategic-bet' | 'fill-in' | 'question-mark';

/**
 * Minimal read-model of one candidate process/subprocess. Sourced from the
 * pipeline session's `process-candidates` section.
 */
export interface ProcessCandidate {
  id: string;
  /** Which pipeline lever this candidate currently sits in. */
  lever?: PipelineLeverId;
  /** How rule-based the decision is (high = fully explicit if-then rules). */
  ruleness?: Level;
  /** Structure of the input data (drives IDP vs RPA vs agentic). */
  dataStructure?: DataStructure;
  /** How stable the process and source-system UIs are (high = rarely changes). */
  stability?: Level;
  /** Monthly execution volume. */
  volumePerMonth?: number;
  /** Minutes of manual handling per single run. */
  handlingMinutes?: number;
  /** Share of cases off the dominant path, 0..1 (higher = less automatable). */
  exceptionRate?: number;
  /** Share of volume carried by the dominant path/variants, 0..1 (80/20 check). */
  pathConcentration?: number;
  /** Integration readiness: is an API available, or only a legacy UI? */
  apiAvailable?: boolean;
  /** Error/compliance risk of a human mistake here (raises impact via quality). */
  errorRisk?: Level;
  /** Whether a business owner is ready to take over bot governance. */
  ownerReady?: boolean;
  /** Whether volume/handling figures are measured (true) or estimated. */
  measured?: boolean;
  /** Source of the candidate — top-down request vs process/task mining. */
  source?: 'top-down' | 'process-mining' | 'task-mining';
  /** Evidence backing the candidate (a log, a PoC, an observation). */
  evidence?: string[];
}

/** Minimal read-model of one automation move/idea from the `moves` section. */
export interface AutomationMoveItem {
  id: string;
  /** Which pipeline lever the move primarily belongs to. */
  lever?: PipelineLeverId;
  /** The process candidate this move acts on. */
  processId?: string;
  impact?: Level;
  effort?: Level;
  evidence?: string[];
}

/** The minimal Automation Pipeline session shape the engine reads. */
export interface AutomationPipelineSession {
  candidates: ProcessCandidate[];
  moves: AutomationMoveItem[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const asLevel = (value: unknown, fallback: Level = 'medium'): Level =>
  value === 'high' || value === 'medium' || value === 'low' ? value : fallback;
const localize = (text: Bilingual, isPolish: boolean) => (isPolish ? text.pl : text.en);

/** Annualized manual minutes of one candidate: volume × 12 × handling. */
const candidateAnnualMinutes = (c: ProcessCandidate): number =>
  (c.volumePerMonth || 0) * 12 * (c.handlingMinutes || 0);

/** Annualized minutes actually automatable (main path only, exceptions excluded). */
const candidateAutomatableMinutes = (c: ProcessCandidate): number =>
  candidateAnnualMinutes(c) * (1 - (c.exceptionRate || 0));

const minutesToFteHours = (minutes: number): number => round1(minutes / 60);

// ---------------------------------------------------------------------------
// Per-process technology selection (doctrine 4.2 — the continuum, not a score)
// ---------------------------------------------------------------------------

const EXCEPTION_REDESIGN_THRESHOLD = 0.3; // >30% exceptions => process is immature
const PATH_CONCENTRATION_FLOOR = 0.5; // <50% on the dominant path => no dominant path

/**
 * True when the process is "chaos, not a candidate": a high exception rate or a
 * missing dominant path (optionally compounded by low stability) means the
 * process must be REDESIGNED before any technology is applied. Automating it
 * only speeds up error production (doctrine section 5, top-priority trap).
 */
export function needsRedesignFirst(c: ProcessCandidate): boolean {
  const highExceptions = (c.exceptionRate ?? 0) > EXCEPTION_REDESIGN_THRESHOLD;
  const noDominantPath =
    c.pathConcentration !== undefined && c.pathConcentration < PATH_CONCENTRATION_FLOOR;
  const lowStandardization = c.ruleness === 'low' && (c.stability ?? 'medium') === 'low';
  return highExceptions || noDominantPath || lowStandardization;
}

/**
 * Select the technology tier from the process PROFILE, not an averaged score.
 * Order of decision (doctrine 4.2):
 *   - redesign-first if the process is chaos (see needsRedesignFirst)
 *   - agentic  when the decision needs judgment over free text / broad non-determinism
 *   - idp      when data is documents (structured/unstructured) but the post-extraction
 *              decision is rule-based
 *   - ipa      when there is a rule-based spine AND a bounded judgment/classification step
 *   - rpa      when data is systemic/structured, rules are fully explicit, process stable
 */
export function selectTechTier(c: ProcessCandidate): TechTier {
  if (needsRedesignFirst(c)) return 'redesign-first';

  const rules = c.ruleness ?? 'medium';
  const data = c.dataStructure ?? 'system';

  // Free-text judgment or non-deterministic decision => an AI agent, not RPA/IDP.
  if (data === 'free-text' || rules === 'low') return 'agentic';

  // Documents drive IDP; if there is also a judgment component, it is IPA.
  const isDocument = data === 'structured-doc' || data === 'unstructured-doc';
  if (isDocument) {
    return rules === 'medium' ? 'ipa' : 'idp';
  }

  // System/structured data. A bounded judgment step (medium rule-ness) => IPA.
  if (rules === 'medium') return 'ipa';

  // Fully rule-based, structured/system data => classic RPA.
  return 'rpa';
}

/** Build/maintenance effort weight of a tech tier, 1..5 (higher = more effort). */
const TECH_EFFORT_WEIGHT: Record<TechTier, number> = {
  rpa: 2,
  idp: 3,
  ipa: 4,
  agentic: 5,
  'redesign-first': 5,
};

const TECH_LABEL: Record<TechTier, Bilingual> = {
  rpa: { pl: 'RPA klasyczne', en: 'Classic RPA' },
  idp: { pl: 'IDP (przetwarzanie dokumentów)', en: 'IDP (document processing)' },
  ipa: { pl: 'IPA (RPA + AI/ML)', en: 'IPA (RPA + AI/ML)' },
  agentic: { pl: 'Agent AI (AI-native)', en: 'AI agent (AI-native)' },
  'redesign-first': { pl: 'Najpierw redesign procesu', en: 'Redesign the process first' },
};

export const techTierLabel = (tier: TechTier): Bilingual => TECH_LABEL[tier];

// ---------------------------------------------------------------------------
// Per-process effort × impact → quadrant (doctrine 4.4)
// ---------------------------------------------------------------------------

export interface ProcessAssessment {
  id: string;
  techTier: TechTier;
  techLabel: Bilingual;
  /** Annualized automatable FTE-hours (main path, exceptions excluded). */
  automatableFteHours: number;
  /** Impact score 1..5 (FTE-hours + error-risk quality lift). */
  impact: number;
  /** Effort score 1..5 (tech tier + integration + stability/TCO). */
  effort: number;
  quadrant: Quadrant;
  /** True when the process must be redesigned before any automation. */
  redesignFirst: boolean;
  /** True when volume/handling is measured rather than estimated. */
  measured: boolean;
  /** True when a governance owner is ready. */
  ownerReady: boolean;
  rationale: Bilingual;
}

/**
 * Impact 1..5: dominated by annualized FTE-hours (the primary business case),
 * lifted by error/compliance risk (processes where automation also buys quality,
 * not just cost) — doctrine 4.4 impact axis.
 */
const impactScore = (c: ProcessCandidate, portfolioMaxHours: number): number => {
  const hours = minutesToFteHours(candidateAutomatableMinutes(c));
  const volumeScore = portfolioMaxHours > 0 ? clamp((hours / portfolioMaxHours) * 4 + 1, 1, 5) : 1;
  const riskLift = c.errorRisk === 'high' ? 1 : c.errorRisk === 'medium' ? 0.5 : 0;
  return clamp(round1(volumeScore + riskLift), 1, 5);
};

/**
 * Effort 1..5: tech tier weight (build complexity) + integration penalty (UI
 * scraping over API) + stability penalty (unstable UI = high maintenance TCO,
 * not just dev-time) — doctrine 4.4 effort axis + the TCO trap in section 5.
 */
const effortScore = (c: ProcessCandidate, tier: TechTier): number => {
  let e = TECH_EFFORT_WEIGHT[tier];
  if (c.apiAvailable === false) e += 1; // UI scraping is costlier and more brittle
  if ((c.stability ?? 'medium') === 'low') e += 1; // low stability => high ongoing TCO
  return clamp(round1(e), 1, 5);
};

const IMPACT_HIGH_CUTOFF = 3;
const EFFORT_HIGH_CUTOFF = 3.5;

const toQuadrant = (impact: number, effort: number): Quadrant => {
  const highImpact = impact >= IMPACT_HIGH_CUTOFF;
  const highEffort = effort >= EFFORT_HIGH_CUTOFF;
  if (highImpact && !highEffort) return 'quick-win';
  if (highImpact && highEffort) return 'strategic-bet';
  if (!highImpact && !highEffort) return 'fill-in';
  return 'question-mark';
};

export const QUADRANT_LABEL: Record<Quadrant, Bilingual> = {
  'quick-win': { pl: 'Quick win', en: 'Quick win' },
  'strategic-bet': { pl: 'Strategiczny zakład', en: 'Strategic bet' },
  'fill-in': { pl: 'Wypełniacz', en: 'Fill-in' },
  'question-mark': { pl: 'Znak zapytania', en: 'Question mark' },
};

/** Assess a single candidate: tech tier + effort × impact + quadrant + rationale. */
export function assessProcess(c: ProcessCandidate, portfolioMaxHours: number): ProcessAssessment {
  const redesignFirst = needsRedesignFirst(c);
  const techTier = selectTechTier(c);
  const automatableFteHours = minutesToFteHours(candidateAutomatableMinutes(c));
  const impact = impactScore(c, portfolioMaxHours);
  const effort = effortScore(c, techTier);
  // A redesign-first process is a question mark by construction: you cannot
  // automate it as-is regardless of its apparent volume.
  const quadrant = redesignFirst ? 'question-mark' : toQuadrant(impact, effort);

  const rationale: Bilingual = redesignFirst
    ? {
        pl: `Wysoki udział wyjątków / brak dominującej ścieżki — to automatyzacja chaosu. Najpierw redesign procesu (${automatableFteHours} FTE-h/rok pozornego impactu jest niedostępne bez standaryzacji).`,
        en: `High exception share / no dominant path — this is automating chaos. Redesign the process first (${automatableFteHours} FTE-h/yr of apparent impact is unreachable without standardization).`,
      }
    : {
        pl: `${localize(techTierLabel(techTier), true)} · impact ${impact}/5 (${automatableFteHours} FTE-h/rok) × effort ${effort}/5 → ${localize(QUADRANT_LABEL[quadrant], true)}.`,
        en: `${localize(techTierLabel(techTier), false)} · impact ${impact}/5 (${automatableFteHours} FTE-h/yr) × effort ${effort}/5 → ${localize(QUADRANT_LABEL[quadrant], false)}.`,
      };

  return {
    id: c.id,
    techTier,
    techLabel: techTierLabel(techTier),
    automatableFteHours,
    impact,
    effort,
    quadrant,
    redesignFirst,
    measured: !!c.measured,
    ownerReady: !!c.ownerReady,
    rationale,
  };
}

// ---------------------------------------------------------------------------
// Portfolio baseline — hidden volume / TCO / not-ready share
// ---------------------------------------------------------------------------

export interface PipelineBaseline {
  candidateCount: number;
  /** Total annualized manual FTE-hours across the whole register. */
  totalFteHours: number;
  /** Annualized automatable FTE-hours (main path only). */
  automatableFteHours: number;
  /** FTE-hours of the single largest candidate — the hidden-volume headline. */
  topCandidateFteHours: number;
  /** id of that largest candidate. */
  topCandidateId: string | null;
  /** FTE-hours trapped in redesign-first (not technically ready) processes. */
  notReadyFteHours: number;
  /** Share of automatable FTE-hours sitting in not-ready processes, 0..1. */
  notReadyShare: number;
  /** Count of candidates by technology tier. */
  tierCounts: Record<TechTier, number>;
  /** Count of candidates in each effort×impact quadrant. */
  quadrantCounts: Record<Quadrant, number>;
  /** Share of candidates whose figures are measured, 0..1. */
  measuredRatio: number;
  /** Share of candidates sourced from process/task mining (vs top-down), 0..1. */
  miningRatio: number;
  /** Per-process assessments, in input order. */
  assessments: ProcessAssessment[];
}

const emptyTierCounts = (): Record<TechTier, number> => ({
  rpa: 0,
  idp: 0,
  ipa: 0,
  agentic: 0,
  'redesign-first': 0,
});

const emptyQuadrantCounts = (): Record<Quadrant, number> => ({
  'quick-win': 0,
  'strategic-bet': 0,
  'fill-in': 0,
  'question-mark': 0,
});

export function computeBaseline(session: AutomationPipelineSession): PipelineBaseline {
  const cands = session.candidates;
  const candidateCount = cands.length;

  const portfolioMaxHours = cands.reduce(
    (max, c) => Math.max(max, minutesToFteHours(candidateAutomatableMinutes(c))),
    0
  );

  const assessments = cands.map((c) => assessProcess(c, portfolioMaxHours));

  const totalFteHours = round1(
    cands.reduce((acc, c) => acc + minutesToFteHours(candidateAnnualMinutes(c)), 0)
  );
  const automatableFteHours = round1(assessments.reduce((acc, a) => acc + a.automatableFteHours, 0));

  let topCandidateFteHours = 0;
  let topCandidateId: string | null = null;
  assessments.forEach((a) => {
    if (a.automatableFteHours > topCandidateFteHours) {
      topCandidateFteHours = a.automatableFteHours;
      topCandidateId = a.id;
    }
  });

  const notReadyFteHours = round1(
    assessments.filter((a) => a.redesignFirst).reduce((acc, a) => acc + a.automatableFteHours, 0)
  );

  const tierCounts = emptyTierCounts();
  const quadrantCounts = emptyQuadrantCounts();
  assessments.forEach((a) => {
    tierCounts[a.techTier] += 1;
    quadrantCounts[a.quadrant] += 1;
  });

  const measured = cands.filter((c) => c.measured).length;
  const mined = cands.filter((c) => c.source === 'process-mining' || c.source === 'task-mining')
    .length;

  return {
    candidateCount,
    totalFteHours,
    automatableFteHours,
    topCandidateFteHours,
    topCandidateId,
    notReadyFteHours,
    notReadyShare: automatableFteHours > 0 ? round1(notReadyFteHours / automatableFteHours) : 0,
    tierCounts,
    quadrantCounts,
    measuredRatio: candidateCount > 0 ? round1(measured / candidateCount) : 0,
    miningRatio: candidateCount > 0 ? round1(mined / candidateCount) : 0,
    assessments,
  };
}

// ---------------------------------------------------------------------------
// Per-lever scoring
// ---------------------------------------------------------------------------

export interface LeverScore {
  lever: PipelineLeverId;
  label: Bilingual;
  /** Automation moves attributed to this lever. */
  moveCount: number;
  /** Annualized automatable FTE-hours the candidates this lever acts on carry. */
  fteHoursAddressed: number;
  /** Mean impact of this lever's moves, 1..3. */
  attractiveness: number;
  /** Ease of pulling it off (low effort + evidence), 1..3. */
  feasibility: number;
  /** attractiveness × feasibility, 1..9. */
  score: number;
  /** Count of moves carrying at least one evidence item. */
  evidenceBacked: number;
}

/** FTE-hours a lever acts on, derived from the candidate assessments. */
const fteHoursForLever = (
  lever: PipelineLeverId,
  baseline: PipelineBaseline
): number => {
  const a = baseline.assessments;
  switch (lever) {
    case 'discover':
      // discovery governs the whole register
      return round1(a.reduce((acc, x) => acc + x.automatableFteHours, 0));
    case 'profile':
      // profiling matters most for not-ready (redesign-first) processes
      return round1(a.filter((x) => x.redesignFirst).reduce((acc, x) => acc + x.automatableFteHours, 0));
    case 'technology':
      // technology fit acts on everything that is technically buildable
      return round1(a.filter((x) => !x.redesignFirst).reduce((acc, x) => acc + x.automatableFteHours, 0));
    case 'prioritize':
      // prioritization is about the quick wins + strategic bets pool
      return round1(
        a
          .filter((x) => x.quadrant === 'quick-win' || x.quadrant === 'strategic-bet')
          .reduce((acc, x) => acc + x.automatableFteHours, 0)
      );
    case 'sequence':
      // sequencing protects the quick-win pool that must ship first
      return round1(
        a.filter((x) => x.quadrant === 'quick-win').reduce((acc, x) => acc + x.automatableFteHours, 0)
      );
    default:
      return 0;
  }
};

const scoreLever = (
  lever: PipelineLeverId,
  session: AutomationPipelineSession,
  baseline: PipelineBaseline
): LeverScore => {
  const label = pipelineLeverLabel(lever);
  const moves = session.moves.filter((m) => m.lever === lever);
  const fteHoursAddressed = fteHoursForLever(lever, baseline);

  if (moves.length === 0) {
    return {
      lever,
      label,
      moveCount: 0,
      fteHoursAddressed,
      attractiveness: 0,
      feasibility: 0,
      score: 0,
      evidenceBacked: 0,
    };
  }

  const impactAvg = moves.reduce((sum, m) => sum + LEVEL_SCORE[asLevel(m.impact)], 0) / moves.length;
  const effortAvg = moves.reduce((sum, m) => sum + LEVEL_SCORE[asLevel(m.effort)], 0) / moves.length;
  const evidenceBacked = moves.filter((m) => (m.evidence?.length || 0) > 0).length;
  const evidenceRatio = evidenceBacked / moves.length;

  const effortEase = 4 - effortAvg; // 1..3, low effort scores high
  const feasibility = clamp(round1(effortEase * 0.6 + evidenceRatio * 2 * 0.4 + 0.4), 0.5, 3);
  const attractiveness = round1(impactAvg);
  const score = round1(attractiveness * feasibility);

  return {
    lever,
    label,
    moveCount: moves.length,
    fteHoursAddressed,
    attractiveness,
    feasibility,
    score,
    evidenceBacked,
  };
};

export interface LeverRanking {
  scores: LeverScore[];
  /** levers ordered best-first among those with at least one move. */
  ordered: PipelineLeverId[];
  rationale: Bilingual;
}

/**
 * Rank the five pipeline levers. Only levers with move candidates are ranked;
 * empty levers are reported with score 0 but excluded from `ordered`. Ties break
 * toward the canonical order (discover → profile → technology → prioritize →
 * sequence) so the sequence never green-lights a build before the candidate is
 * discovered, profiled and its technology chosen.
 */
export function rankLevers(session: AutomationPipelineSession): LeverRanking {
  const baseline = computeBaseline(session);
  const scores = PIPELINE_LEVERS.map((lever) => scoreLever(lever, session, baseline));
  const orderIndex = (l: PipelineLeverId) => PIPELINE_LEVERS.indexOf(l);

  const ordered = scores
    .filter((s) => s.moveCount > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.fteHoursAddressed !== a.fteHoursAddressed) return b.fteHoursAddressed - a.fteHoursAddressed;
      return orderIndex(a.lever) - orderIndex(b.lever);
    })
    .map((s) => s.lever);

  const top = scores.find((s) => s.lever === ordered[0]);
  const rationale: Bilingual = top
    ? {
        pl: `Najsilniejsza dźwignia to „${pipelineLeverLabel(top.lever).pl.toLowerCase()}" (dopasowanie ${top.score}/9: atrakcyjność ${top.attractiveness} × wykonalność ${top.feasibility}), obejmująca ${top.fteHoursAddressed} FTE-h/rok. Sekwencja trzyma porządek: nie zatwierdzamy budowy przed odkryciem, sprofilowaniem i doborem technologii do procesu.`,
        en: `The strongest lever is "${pipelineLeverLabel(top.lever).en.toLowerCase()}" (fit ${top.score}/9: attractiveness ${top.attractiveness} × feasibility ${top.feasibility}), covering ${top.fteHoursAddressed} FTE-h/yr. The sequence keeps order: we do not green-light a build before the process is discovered, profiled and matched to a technology.`,
      }
    : {
        pl: 'Brak kandydatów na ruchy — dodaj procesy-kandydatów i pomysły automatyzacji w co najmniej jednej dźwigni, aby zbudować ranking.',
        en: 'No move candidates yet — add candidate processes and automation moves in at least one lever to build a ranking.',
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

// ---------------------------------------------------------------------------
// Pipeline wave sequence (W2-validated)
// ---------------------------------------------------------------------------

/** Which wave of the pipeline a move belongs to (doctrine 4.5). */
export type PipelineWave = 'wave-0' | 'wave-1' | 'wave-2' | 'redesign-track';

export const WAVE_LABEL: Record<PipelineWave, Bilingual> = {
  'wave-0': { pl: 'Fala 0 — dowód koncepcji (<90 dni)', en: 'Wave 0 — proof of concept (<90 days)' },
  'wave-1': { pl: 'Fala 1 — skalowanie + Center of Excellence', en: 'Wave 1 — scale + Center of Excellence' },
  'wave-2': { pl: 'Fala 2 — strategiczne zakłady (z etapami)', en: 'Wave 2 — strategic bets (staged)' },
  'redesign-track': {
    pl: 'Tor równoległy — redesign procesu przed automatyzacją',
    en: 'Parallel track — redesign the process before automation',
  },
};

export interface SequencedMove {
  order: number;
  wave: PipelineWave;
  lever: PipelineLeverId;
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
 * Build the W2-validated pipeline WAVE sequence from the assessed portfolio.
 * The rule of the sequence (doctrine 4.5 + 5):
 *   - if the register is thin on measurement OR built only top-down, the first
 *     move is to SEE the real pipeline (measure / process-mine) — a case on an
 *     estimated volume is optimism, not a case;
 *   - a REDESIGN track runs in parallel for every not-ready process — never fold
 *     "automate the chaos" into a wave;
 *   - wave 0 leads with quick wins (fastest first live effect, builds credibility);
 *   - wave 1 scales the remaining quick wins + stands up the CoE;
 *   - wave 2 takes strategic bets, staged (human-in-the-loop → full automation),
 *     never big-bang.
 */
export function buildW2MoveSequence(session: AutomationPipelineSession): SequencedMove[] {
  const baseline = computeBaseline(session);
  if (baseline.candidateCount === 0) return [];

  const moves: SequencedMove[] = [];
  let order = 1;

  const quickWins = baseline.assessments.filter((a) => a.quadrant === 'quick-win');
  const strategicBets = baseline.assessments.filter((a) => a.quadrant === 'strategic-bet');
  const redesign = baseline.assessments.filter((a) => a.redesignFirst);

  // --- Visibility first: measure / process-mine before committing budget. ---
  if (baseline.measuredRatio < 0.5 || baseline.miningRatio < 0.5) {
    moves.push({
      order: order++,
      wave: 'wave-0',
      lever: 'discover',
      title: {
        pl: 'Najpierw zobacz prawdziwy pipeline (pomiar + process mining)',
        en: 'See the real pipeline first (measurement + process mining)',
      },
      rationale: {
        pl: `Tylko ${Math.round(baseline.measuredRatio * 100)}% kandydatów jest zmierzonych, a ${Math.round(baseline.miningRatio * 100)}% pochodzi z miningu — reszta to zgłoszenia top-down. Bez logów nie widzicie prawdziwego wolumenu, tylko to, co zgłoszono głośno.`,
        en: `Only ${Math.round(baseline.measuredRatio * 100)}% of candidates are measured and ${Math.round(baseline.miningRatio * 100)}% come from mining — the rest are top-down requests. Without logs you do not see the real volume, only what was reported loudly.`,
      },
      tradeOff: {
        pl: 'Kosztem ~1 cyklu na pobranie logów i task mining, w zamian za ranking oparty na faktycznym wolumenie, nie na politycznej głośności.',
        en: 'At the cost of ~1 cycle to pull logs and run task mining, in exchange for a ranking based on real volume, not political loudness.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „zautomatyzujmy najgłośniejszy proces od razu": bez pomiaru budujecie bota o ujemnym zwrocie na procesie o niskim realnym wolumenie.',
        en: 'We reject "just automate the loudest process now": without measurement you build a negative-return bot on a process with low real volume.',
      },
      expectedImpact: 'medium',
      estimatedEffort: 'low',
      validation: VALID,
    });
  }

  // --- Redesign track: never automate a bad process. Runs in parallel. ---
  if (redesign.length > 0) {
    moves.push({
      order: order++,
      wave: 'redesign-track',
      lever: 'profile',
      title: {
        pl: 'Oddziel procesy do redesignu od pipeline\'u automatyzacji',
        en: 'Split the redesign-first processes out of the automation pipeline',
      },
      rationale: {
        pl: `${redesign.length} z ${baseline.candidateCount} procesów (${baseline.notReadyFteHours} FTE-h/rok, ${Math.round(baseline.notReadyShare * 100)}% wolumenu) ma wysoki % wyjątków lub brak dominującej ścieżki — to automatyzacja chaosu. Najpierw redesign, potem bot.`,
        en: `${redesign.length} of ${baseline.candidateCount} processes (${baseline.notReadyFteHours} FTE-h/yr, ${Math.round(baseline.notReadyShare * 100)}% of volume) have a high exception rate or no dominant path — this is automating chaos. Redesign first, then a bot.`,
      },
      tradeOff: {
        pl: 'Kosztem opóźnienia pozornie wysokiego impactu tych procesów, w zamian za uniknięcie bota, który utrwala bałagan w kodzie i wymaga przebudowy co kwartał.',
        en: 'At the cost of delaying these processes\' apparently high impact, in exchange for avoiding a bot that cements the mess in code and needs reworking every quarter.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy automatyzację procesu „jak jest": bot wiernie odtwarzający wadliwy proces tylko przyspiesza produkcję błędów w skali — marnotrawstwo w nowym ubraniu.',
        en: 'We reject automating the process "as is": a bot faithfully replaying a flawed process only speeds up error production at scale — waste in new clothing.',
      },
      expectedImpact: 'high',
      estimatedEffort: 'medium',
      validation: VALID,
    });
  }

  // --- Wave 0: lead with the strongest quick win (fastest first live effect). ---
  if (quickWins.length > 0) {
    const top = quickWins.reduce((best, a) =>
      a.automatableFteHours > best.automatableFteHours ? a : best
    );
    moves.push({
      order: order++,
      wave: 'wave-0',
      lever: 'sequence',
      title: {
        pl: `Fala 0: dowieź quick win „${top.id}" (${localize(top.techLabel, true)})`,
        en: `Wave 0: ship quick win "${top.id}" (${localize(top.techLabel, false)})`,
      },
      rationale: {
        pl: `Najsilniejszy quick win: ${top.automatableFteHours} FTE-h/rok, impact ${top.impact}/5 przy effort ${top.effort}/5, technologia ${localize(top.techLabel, true)}. Pierwszy żywy efekt w <90 dni buduje wiarygodność programu.`,
        en: `The strongest quick win: ${top.automatableFteHours} FTE-h/yr, impact ${top.impact}/5 at effort ${top.effort}/5, technology ${localize(top.techLabel, false)}. A first live result in <90 days builds the program's credibility.`,
      },
      tradeOff: {
        pl: 'Kosztem tempa w większych zakładach — świadomie zaczynacie od małego, pewnego efektu, zamiast otwierać wszystkie fronty naraz.',
        en: 'At the cost of pace on the bigger bets — you deliberately start with a small, sure result rather than opening every front at once.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy start od strategic betu „bo najważniejszy": program traci wiarygodność, zanim dowiezie pierwszy efekt, i grzęźnie na pilotażu.',
        en: 'We reject starting with a strategic bet "because it is most important": the program loses credibility before delivering the first result and gets stuck in the pilot.',
      },
      expectedImpact: top.impact >= 4 ? 'high' : 'medium',
      estimatedEffort: top.effort <= 2.5 ? 'low' : 'medium',
      validation: VALID,
    });
  }

  // --- Wave 1: scale the remaining quick wins + build the CoE. ---
  if (quickWins.length > 1) {
    const restHours = round1(
      quickWins.reduce((acc, a) => acc + a.automatableFteHours, 0) -
        quickWins.reduce((best, a) => (a.automatableFteHours > best.automatableFteHours ? a : best))
          .automatableFteHours
    );
    moves.push({
      order: order++,
      wave: 'wave-1',
      lever: 'prioritize',
      title: {
        pl: 'Fala 1: skaluj pozostałe quick winy i zbuduj Center of Excellence',
        en: 'Wave 1: scale the remaining quick wins and build the Center of Excellence',
      },
      rationale: {
        pl: `Pozostałe ${quickWins.length - 1} quick winy (${restHours} FTE-h/rok) dowozicie równolegle ze standardami i governance botów — to zamienia serię wdrożeń w skalowalny program.`,
        en: `The remaining ${quickWins.length - 1} quick wins (${restHours} FTE-h/yr) ship alongside standards and bot governance — this turns a series of deployments into a scalable program.`,
      },
      tradeOff: {
        pl: 'Kosztem czasu na budowę CoE, który nie dowozi bezpośrednio FTE-godzin, ale bez niego każdy kolejny bot rośnie w kruchości szybciej, niż zespół zdąży go utrzymać.',
        en: 'At the cost of time to build the CoE, which does not directly deliver FTE-hours, but without it every next bot grows brittle faster than the team can maintain it.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy dalsze ad-hoc wdrożenia bez governance: program utyka na 5-10 botach, bo każdy kolejny wymaga osobnej politycznej bitwy o priorytet.',
        en: 'We reject continuing ad-hoc deployments without governance: the program stalls at 5-10 bots because each next one needs its own political priority battle.',
      },
      expectedImpact: 'medium',
      estimatedEffort: 'medium',
      validation: VALID,
    });
  }

  // --- Wave 2: strategic bets, staged (human-in-the-loop first). ---
  if (strategicBets.length > 0) {
    const top = strategicBets.reduce((best, a) =>
      a.automatableFteHours > best.automatableFteHours ? a : best
    );
    moves.push({
      order: order++,
      wave: 'wave-2',
      lever: 'technology',
      title: {
        pl: `Fala 2: strategiczny zakład „${top.id}" etapami (człowiek w pętli → auto)`,
        en: `Wave 2: strategic bet "${top.id}" staged (human-in-the-loop → auto)`,
      },
      rationale: {
        pl: `Największy strategic bet: ${top.automatableFteHours} FTE-h/rok, technologia ${localize(top.techLabel, true)} (impact ${top.impact}/5, effort ${top.effort}/5). Wymaga sponsora zarządu i rozbicia na kamienie — najpierw z człowiekiem w pętli, potem pełna automatyzacja po walidacji trafności.`,
        en: `The largest strategic bet: ${top.automatableFteHours} FTE-h/yr, technology ${localize(top.techLabel, false)} (impact ${top.impact}/5, effort ${top.effort}/5). It needs a board sponsor and milestones — human-in-the-loop first, then full automation after accuracy validation.`,
      },
      tradeOff: {
        pl: 'Kosztem dłuższego czasu do pełnego efektu i pilotażu z człowiekiem, w zamian za kontrolę ryzyka doboru technologii, zanim padnie pełny budżet.',
        en: 'At the cost of a longer time to full effect and a human-in-the-loop pilot, in exchange for controlling the technology-choice risk before the full budget is committed.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „big bang" pełnej automatyzacji od razu: zakład bez etapów zakłada trafność bez dowodu, a przebudowa w połowie projektu jest droższa niż etapowanie.',
        en: 'We reject a full-automation "big bang" at once: a bet with no stages assumes accuracy without proof, and reworking mid-project costs more than staging.',
      },
      expectedImpact: 'high',
      estimatedEffort: 'high',
      validation: VALID,
    });
  }

  return moves;
}

/**
 * One-shot synthesis: baseline (tech tiers + quadrants + hidden volume) + lever
 * ranking + W2 wave sequence, ready for the UI or the AI fallback. Pure and
 * deterministic.
 */
export function synthesizeAutomationPipeline(session: AutomationPipelineSession): {
  baseline: PipelineBaseline;
  ranking: LeverRanking;
  sequence: SequencedMove[];
} {
  return {
    baseline: computeBaseline(session),
    ranking: rankLevers(session),
    sequence: buildW2MoveSequence(session),
  };
}

/** Flatten a SequencedMove into a localized, store-agnostic move summary. */
export function localizeMove(
  seq: SequencedMove,
  isPolish: boolean
): { title: string; rationale: string; wave: PipelineWave; lever: PipelineLeverId } {
  return {
    title: localize(seq.title, isPolish),
    rationale: `${localize(seq.rationale, isPolish)} ${localize(seq.tradeOff, isPolish)} ${localize(
      seq.rejectedVariant,
      isPolish
    )}`.trim(),
    wave: seq.wave,
    lever: seq.lever,
  };
}
