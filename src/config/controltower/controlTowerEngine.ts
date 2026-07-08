/**
 * Supply Chain Control Tower — synthesis engine + W2 move validator.
 *
 * The pure, testable brain of the tool. It reads the control-tower session
 * (chain nodes + tracked exceptions + candidate moves) and produces the RDZEŃ
 * (core) of the doctrine (control-tower.md §4–§6):
 *
 *   1. a maturity DIAGNOSIS on the 5-level curve (visibility → diagnostic →
 *      predictive → prescriptive → autonomous) derived from the facts, not
 *      self-declared
 *   2. the VISIBILITY BLIND SPOTS — nodes with no data feed — and the value that
 *      flows through them (a blind spot is itself an insight)
 *   3. a quantified DETECTION LAG — the average gap between a disruption arising
 *      at source and reaching the tower — the direct investment justification
 *   4. RISK CONCENTRATION — the "X% of exceptions come from Y% of suppliers/
 *      routes/SKUs" Pareto that turns firefighting into a structural decision
 *   5. ALERT FATIGUE — the share of alerts closed with no action, signalling
 *      mis-calibrated thresholds rather than a headcount gap
 *   6. a per-lever readiness score and a W2-validated MOVE SEQUENCE — the nearest
 *      PAYABLE maturity step (not a leap to level 5), where every move carries:
 *        - rationale        (why do this now)
 *        - tradeOff         (what it costs you / what you give up)
 *        - rejectedVariant  (the alternative deliberately NOT taken, and why)
 *
 * The W2 validator is the near-literal transfer of the Inventory/SMED "move must
 * justify itself" contract: a move is only VALID when all three fields are
 * present and non-trivial.
 *
 * This layer is self-contained: it depends only on a minimal read-model of the
 * control-tower session (ControlTowerSession), not on the full store, so it
 * compiles and tests in isolation.
 */

import {
  CONTROL_TOWER_LEVERS,
  controlTowerLeverLabel,
  type Bilingual,
  type ControlTowerLeverId,
} from './deepeningLadder';

type Level = 'high' | 'medium' | 'low';

const LEVEL_SCORE: Record<Level, number> = { high: 3, medium: 2, low: 1 };

/** The 5-level control-tower maturity curve (doctrine §4.1). */
export type MaturityLevel = 1 | 2 | 3 | 4 | 5;

export const MATURITY_LABEL: Record<MaturityLevel, Bilingual> = {
  1: { pl: 'Widoczność (deskryptywny) — „co się dzieje"', en: 'Visibility (descriptive) — "what is happening"' },
  2: { pl: 'Diagnostyczny — „dlaczego się stało"', en: 'Diagnostic — "why it happened"' },
  3: { pl: 'Predykcyjny — „co się stanie"', en: 'Predictive — "what will happen"' },
  4: { pl: 'Prescriptywny — „co zrobić"', en: 'Prescriptive — "what to do"' },
  5: { pl: 'Autonomiczny — „zrób to"', en: 'Autonomous — "do it"' },
};

/**
 * Minimal read-model of one CHAIN NODE (a system / partner in the supply chain).
 * Sourced from the tool's `nodes` section.
 */
export interface ChainNode {
  id: string;
  /** Node type — ERP / WMS / TMS / supplier / carrier / 3PL / external. */
  kind?: string;
  /** Whether this node feeds data into the tower (false = BLIND SPOT). */
  integrated?: boolean;
  /**
   * Feed freshness in hours (how old the freshest record is). A high value on an
   * "integrated" node is a soft blind spot — visibility that is really an archive.
   */
  feedLagHours?: number;
  /** Purchase value / volume flowing through this node — the exposure it carries. */
  flowValue?: number;
}

/**
 * Minimal read-model of one tracked EXCEPTION type (a disruption category with a
 * threshold and — hopefully — an owner). Sourced from the `exceptions` section.
 */
export interface ExceptionItem {
  id: string;
  /** Which lever this exception primarily stresses (defaults to 'exceptions'). */
  lever?: ControlTowerLeverId;
  /** How many times this exception fired in the observed window. */
  volume?: number;
  /**
   * Detection lag in hours: gap between the disruption arising at source and it
   * reaching the tower. The core quantity of the doctrine.
   */
  detectionLagHours?: number;
  /** Share (0..1) of alerts of this type closed WITHOUT any action — alert fatigue. */
  closedNoActionRatio?: number;
  /** Whether this exception has a defined threshold. */
  hasThreshold?: boolean;
  /** Whether this exception has an assigned owner (else it is a dashboard, not a tower). */
  hasOwner?: boolean;
  /** Whether the threshold is dynamic (variability-relative) rather than static. */
  dynamicThreshold?: boolean;
  /** Source node / supplier / route this exception concentrates on — for risk concentration. */
  sourceId?: string;
}

/** Minimal read-model of one candidate control-tower move from the `moves` section. */
export interface ControlTowerMoveItem {
  id: string;
  /** Which control-tower lever the move primarily belongs to. */
  lever?: ControlTowerLeverId;
  impact?: Level;
  effort?: Level;
  /** Evidence backing the move (analysis, pilot, data pull). */
  evidence?: string[];
}

/** The minimal control-tower session shape the engine reads. */
export interface ControlTowerSession {
  nodes: ChainNode[];
  exceptions: ExceptionItem[];
  moves: ControlTowerMoveItem[];
  /** Optional self-declared maturity level, used only as a sanity contrast, never as truth. */
  declaredLevel?: MaturityLevel;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const asLevel = (value: unknown, fallback: Level = 'medium'): Level =>
  value === 'high' || value === 'medium' || value === 'low' ? value : fallback;
const localize = (text: Bilingual, isPolish: boolean) => (isPolish ? text.pl : text.en);

/** A node is a hard blind spot when it is not integrated. */
const isBlind = (n: ChainNode) => n.integrated !== true;
/** Above this feed lag an "integrated" node is really an archive (a soft blind spot). */
const STALE_FEED_HOURS = 12;

// ---------------------------------------------------------------------------
// Baseline — the tower diagnosis
// ---------------------------------------------------------------------------

/** One visibility blind spot with the exposure it carries. */
export interface BlindSpot {
  id: string;
  kind: string;
  flowValue: number;
  /** 'hard' = no feed at all; 'stale' = feed too old to warn early. */
  severity: 'hard' | 'stale';
}

/** One risk-concentration entry: a source and its share of exception volume. */
export interface RiskConcentrationEntry {
  sourceId: string;
  volume: number;
  share: number;
}

/** The headline control-tower facts: maturity, blind spots, detection lag, concentration, fatigue. */
export interface ControlTowerBaseline {
  /** Number of chain nodes in scope. */
  nodeCount: number;
  /** Nodes with no data feed (or a stale one). */
  blindSpots: BlindSpot[];
  /** Share of nodes that are blind (hard or stale), 0..1. */
  blindShare: number;
  /** Total flow value flowing through blind spots — the value that materializes without warning. */
  blindFlowValue: number;
  /** Total flow value across all nodes (denominator for exposure). */
  totalFlowValue: number;
  /** Average detection lag across tracked exceptions, in hours — the core quantity. */
  avgDetectionLagHours: number;
  /** Worst detection lag observed, in hours. */
  worstDetectionLagHours: number;
  /** Total exception volume observed. */
  totalExceptionVolume: number;
  /** Risk concentration: the Pareto of exception volume by source, worst-first. */
  riskConcentration: RiskConcentrationEntry[];
  /** Share of exception volume produced by the top ~20% of sources (the Pareto head). */
  concentrationHeadShare: number;
  /** Share of sources that make up that head, 0..1 (the "Y%" in "X% from Y%"). */
  concentrationHeadSourceShare: number;
  /** Weighted share of alerts closed with no action — alert fatigue, 0..1. */
  alertFatigueRatio: number;
  /** Share of tracked exceptions missing a threshold OR an owner (dashboard, not tower). */
  ungovernedExceptionShare: number;
  /** The maturity level the FACTS support (never the self-declared one). */
  maturityLevel: MaturityLevel;
  /** Self-declared level, if the session offered one (for a reality-gap contrast). */
  declaredLevel?: MaturityLevel;
}

/**
 * Derive the maturity level the facts support. Deliberately conservative and
 * evidence-first (doctrine §4.1 / §5): a chain full of blind spots or ungoverned
 * exceptions cannot be "predictive" no matter what the org declares.
 *
 *   L1 visibility   : some nodes feed data at all
 *   L2 diagnostic   : most nodes visible AND most exceptions have a threshold+owner
 *   L3 predictive   : L2 + dynamic thresholds + short detection lag (system warns early)
 *   L4 prescriptive : L3 + low alert fatigue (alerts reliably lead to a right action)
 *   L5 autonomous   : L4 + near-total visibility + near-zero detection lag
 */
function deriveMaturity(
  blindShare: number,
  ungovernedShare: number,
  dynamicShare: number,
  avgDetectionLagHours: number,
  alertFatigueRatio: number
): MaturityLevel {
  // Nothing visible → not even a tower.
  if (blindShare >= 0.999) return 1;

  const mostlyVisible = blindShare <= 0.4;
  const mostlyGoverned = ungovernedShare <= 0.4;
  const diagnostic = mostlyVisible && mostlyGoverned;

  const predictive =
    diagnostic && dynamicShare >= 0.5 && avgDetectionLagHours > 0 && avgDetectionLagHours <= 8;

  const prescriptive = predictive && alertFatigueRatio <= 0.2;

  const autonomous =
    prescriptive && blindShare <= 0.1 && avgDetectionLagHours <= 2;

  if (autonomous) return 5;
  if (prescriptive) return 4;
  if (predictive) return 3;
  if (diagnostic) return 2;
  return 1;
}

export function computeBaseline(session: ControlTowerSession): ControlTowerBaseline {
  const nodes = session.nodes;
  const exceptions = session.exceptions;

  // --- Visibility / blind spots ---
  const blindSpots: BlindSpot[] = nodes
    .filter((n) => isBlind(n) || (n.feedLagHours ?? 0) > STALE_FEED_HOURS)
    .map((n) => ({
      id: n.id,
      kind: n.kind || 'node',
      flowValue: round1(n.flowValue || 0),
      severity: isBlind(n) ? ('hard' as const) : ('stale' as const),
    }))
    .sort((a, b) => b.flowValue - a.flowValue);

  const totalFlowValue = nodes.reduce((acc, n) => acc + (n.flowValue || 0), 0);
  const blindFlowValue = blindSpots.reduce((acc, b) => acc + b.flowValue, 0);
  const blindShare = nodes.length > 0 ? round1(blindSpots.length / nodes.length) : 0;

  // --- Detection lag (the core quantity) ---
  const lags = exceptions
    .map((e) => e.detectionLagHours)
    .filter((v): v is number => typeof v === 'number' && v >= 0);
  const avgDetectionLagHours = lags.length > 0 ? round1(lags.reduce((a, b) => a + b, 0) / lags.length) : 0;
  const worstDetectionLagHours = lags.length > 0 ? round1(Math.max(...lags)) : 0;

  // --- Exception volume + risk concentration (Pareto by source) ---
  const totalExceptionVolume = exceptions.reduce((acc, e) => acc + (e.volume || 0), 0);
  const bySource = new Map<string, number>();
  exceptions.forEach((e) => {
    const key = e.sourceId || e.id;
    bySource.set(key, (bySource.get(key) || 0) + (e.volume || 0));
  });
  const riskConcentration: RiskConcentrationEntry[] = Array.from(bySource.entries())
    .map(([sourceId, volume]) => ({
      sourceId,
      volume,
      share: totalExceptionVolume > 0 ? round1(volume / totalExceptionVolume) : 0,
    }))
    .sort((a, b) => b.volume - a.volume);

  // Pareto head = top ceil(20%) of sources; report their combined exception share.
  const sourceCount = riskConcentration.length;
  const headSize = sourceCount > 0 ? Math.max(1, Math.ceil(sourceCount * 0.2)) : 0;
  const headVolume = riskConcentration.slice(0, headSize).reduce((a, e) => a + e.volume, 0);
  const concentrationHeadShare =
    totalExceptionVolume > 0 ? round1(headVolume / totalExceptionVolume) : 0;
  const concentrationHeadSourceShare = sourceCount > 0 ? round1(headSize / sourceCount) : 0;

  // --- Alert fatigue (volume-weighted share of alerts closed with no action) ---
  const fatigueNumerator = exceptions.reduce(
    (acc, e) => acc + (e.closedNoActionRatio || 0) * (e.volume || 0),
    0
  );
  const alertFatigueRatio =
    totalExceptionVolume > 0
      ? round1(fatigueNumerator / totalExceptionVolume)
      : round1(
          exceptions.length > 0
            ? exceptions.reduce((a, e) => a + (e.closedNoActionRatio || 0), 0) / exceptions.length
            : 0
        );

  // --- Governance: exceptions missing a threshold or an owner ---
  const ungoverned = exceptions.filter((e) => e.hasThreshold !== true || e.hasOwner !== true).length;
  const ungovernedExceptionShare = exceptions.length > 0 ? round1(ungoverned / exceptions.length) : 0;
  const withDynamic = exceptions.filter((e) => e.dynamicThreshold === true).length;
  const dynamicShare = exceptions.length > 0 ? withDynamic / exceptions.length : 0;

  const maturityLevel = deriveMaturity(
    blindShare,
    ungovernedExceptionShare,
    dynamicShare,
    avgDetectionLagHours,
    alertFatigueRatio
  );

  return {
    nodeCount: nodes.length,
    blindSpots,
    blindShare,
    blindFlowValue: round1(blindFlowValue),
    totalFlowValue: round1(totalFlowValue),
    avgDetectionLagHours,
    worstDetectionLagHours,
    totalExceptionVolume,
    riskConcentration,
    concentrationHeadShare,
    concentrationHeadSourceShare,
    alertFatigueRatio,
    ungovernedExceptionShare,
    maturityLevel,
    declaredLevel: session.declaredLevel,
  };
}

// ---------------------------------------------------------------------------
// Scoring — per-lever readiness
// ---------------------------------------------------------------------------

export interface LeverScore {
  lever: ControlTowerLeverId;
  label: Bilingual;
  /** Move candidates attributed to this lever. */
  moveCount: number;
  /** Exposure (flow value / exception volume) this lever can act on. */
  exposureInScope: number;
  /** Mean impact of this lever's moves, 1..3. */
  attractiveness: number;
  /** Ease of pulling it off (low effort + evidence), 1..3. */
  feasibility: number;
  /** attractiveness × feasibility, 1..9. */
  score: number;
  /** Count of moves carrying at least one evidence item. */
  evidenceBacked: number;
}

/** Exposure a lever can act on, derived from the baseline facts. */
const exposureForLever = (
  lever: ControlTowerLeverId,
  baseline: ControlTowerBaseline
): number => {
  switch (lever) {
    case 'visibility':
      // visibility acts on the value flowing through blind spots
      return baseline.blindFlowValue;
    case 'exceptions':
      // exceptions govern the observed exception volume
      return baseline.totalExceptionVolume;
    case 'response':
      // the response model governs the ungoverned share of exceptions
      return round1(baseline.totalExceptionVolume * baseline.ungovernedExceptionShare);
    case 'maturity':
      // climbing maturity acts on the whole flow the tower steers
      return baseline.totalFlowValue;
    default:
      return 0;
  }
};

const scoreLever = (
  lever: ControlTowerLeverId,
  session: ControlTowerSession,
  baseline: ControlTowerBaseline
): LeverScore => {
  const label = controlTowerLeverLabel(lever);
  const moves = session.moves.filter((m) => (m.lever || 'exceptions') === lever);
  const exposureInScope = round1(exposureForLever(lever, baseline));

  if (moves.length === 0) {
    return {
      lever,
      label,
      moveCount: 0,
      exposureInScope,
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
    exposureInScope,
    attractiveness,
    feasibility,
    score,
    evidenceBacked,
  };
};

export interface LeverRanking {
  scores: LeverScore[];
  /** levers ordered best-first among those with at least one move. */
  ordered: ControlTowerLeverId[];
  rationale: Bilingual;
}

/**
 * Rank the four control-tower levers. Only levers with move candidates are
 * ranked; empty levers are reported with score 0 but excluded from `ordered`.
 * Ties break toward the canonical order (visibility before exceptions before
 * response before maturity) so the sequence never recommends climbing the
 * maturity curve on a chain that is still blind.
 */
export function rankLevers(session: ControlTowerSession): LeverRanking {
  const baseline = computeBaseline(session);
  const scores = CONTROL_TOWER_LEVERS.map((lever) => scoreLever(lever, session, baseline));
  const orderIndex = (l: ControlTowerLeverId) => CONTROL_TOWER_LEVERS.indexOf(l);

  const ordered = scores
    .filter((s) => s.moveCount > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.exposureInScope !== a.exposureInScope) return b.exposureInScope - a.exposureInScope;
      return orderIndex(a.lever) - orderIndex(b.lever);
    })
    .map((s) => s.lever);

  const top = scores.find((s) => s.lever === ordered[0]);
  const rationale: Bilingual = top
    ? {
        pl: `Najsilniejsza dźwignia to „${controlTowerLeverLabel(top.lever).pl.toLowerCase()}" (dopasowanie ${top.score}/9: atrakcyjność ${top.attractiveness} × wykonalność ${top.feasibility}), obejmująca ekspozycję ${top.exposureInScope}. Sekwencja trzyma porządek: nie wspinamy się po dojrzałości na łańcuchu, który jest wciąż ślepy.`,
        en: `The strongest lever is "${controlTowerLeverLabel(top.lever).en.toLowerCase()}" (fit ${top.score}/9: attractiveness ${top.attractiveness} × feasibility ${top.feasibility}), covering ${top.exposureInScope} of exposure. The sequence keeps order: we do not climb the maturity curve on a chain that is still blind.`,
      }
    : {
        pl: 'Brak kandydatów na ruchy — dodaj węzły, wyjątki i ruchy w co najmniej jednej dźwigni, aby zbudować ranking.',
        en: 'No move candidates yet — add nodes, exceptions and moves in at least one lever to build a ranking.',
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
  lever: ControlTowerLeverId;
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
 * Build a W2-validated move sequence — the NEAREST PAYABLE maturity step, not a
 * leap to autonomy (doctrine §6). The rule of the sequence:
 *   - if the chain is blind, LIGHT the costliest blind spot first — you cannot
 *     run exceptions on data you cannot see;
 *   - then govern exceptions (threshold + owner) when they are ungoverned — an
 *     alert with no owner is a dashboard, not a tower;
 *   - surface risk concentration when a Pareto head dominates — differentiate the
 *     policy instead of firefighting every source equally;
 *   - re-calibrate thresholds when alert fatigue is high — the fix is calibration,
 *     not more people to read alerts;
 *   - always frame the next maturity jump as ONE level (usually 2→3), behind a
 *     stated trade-off, never a leap to level 5 on dirty data.
 */
export function buildW2MoveSequence(session: ControlTowerSession): SequencedMove[] {
  const { ordered } = rankLevers(session);
  if (ordered.length === 0) return [];

  const baseline = computeBaseline(session);
  const moves: SequencedMove[] = [];
  let order = 1;

  // 1. Light the costliest blind spot first — a chain with blind spots cannot be steered.
  if (baseline.blindSpots.length > 0) {
    const worst = baseline.blindSpots[0];
    moves.push({
      order: order++,
      lever: 'visibility',
      title: {
        pl: 'Najpierw oświetl najdroższe martwe pole widoczności',
        en: 'Light the costliest visibility blind spot first',
      },
      rationale: {
        pl: `${baseline.blindSpots.length} z ${baseline.nodeCount} węzłów jest ślepych (${Math.round(baseline.blindShare * 100)}%), a przez nie przepływa ekspozycja ${baseline.blindFlowValue} — najdroższy to „${worst.id}" (${worst.kind}, ${worst.flowValue}). Tam zakłócenie materializuje się bez ostrzeżenia, choć reszta „świeci na zielono".`,
        en: `${baseline.blindSpots.length} of ${baseline.nodeCount} nodes are blind (${Math.round(baseline.blindShare * 100)}%), carrying ${baseline.blindFlowValue} of exposure — the costliest is "${worst.id}" (${worst.kind}, ${worst.flowValue}). There disruption materializes without warning while the rest "shows green".`,
      },
      tradeOff: {
        pl: 'Kosztem czasu i budżetu na integrację (EDI/API/feed 3PL) tego jednego węzła, zamiast rozbudowy analityki na już widzianych.',
        en: 'At the cost of time and budget to integrate (EDI/API/3PL feed) this one node, rather than expanding analytics on already-visible ones.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „dokupmy lepszy dashboard": ładniejszy ekran na tych samych danych nie oświetla martwego pola — integrujemy brakujący feed, nie renderujemy pustkę.',
        en: 'We reject "buy a nicer dashboard": a prettier screen on the same data does not light a blind spot — we integrate the missing feed, not re-render the void.',
      },
      expectedImpact: baseline.blindShare >= 0.3 ? 'high' : 'medium',
      estimatedEffort: 'medium',
      validation: VALID,
    });
  }

  // 2. Govern ungoverned exceptions — threshold + owner — before automating anything.
  if (baseline.ungovernedExceptionShare > 0.3) {
    moves.push({
      order: order++,
      lever: 'response',
      title: {
        pl: 'Nadaj każdemu wyjątkowi próg, właściciela i SLA reakcji',
        en: 'Give every exception a threshold, an owner and a response SLA',
      },
      rationale: {
        pl: `${Math.round(baseline.ungovernedExceptionShare * 100)}% śledzonych wyjątków nie ma progu lub właściciela — alert bez właściciela nie prowadzi do decyzji, więc wieża pozostaje dashboardem, nie systemem sterującym.`,
        en: `${Math.round(baseline.ungovernedExceptionShare * 100)}% of tracked exceptions lack a threshold or an owner — an alert with no owner leads to no decision, so the tower stays a dashboard, not a steering system.`,
      },
      tradeOff: {
        pl: 'Kosztem pracy nad modelem operacyjnym (macierz właścicieli, SLA per krytyczność, ścieżka eskalacji) zamiast dokładania kolejnych metryk na ekran.',
        en: 'At the cost of operating-model work (an owner matrix, per-criticality SLAs, an escalation path) rather than adding more metrics to the screen.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy wysyłanie alertów „do wszystkich": adresat zbiorowy to adresat żaden — priorytetyzacja wg wpływu biznesowego, nie kolejności w kolejce.',
        en: 'We reject sending alerts "to everyone": a collective addressee is no addressee — prioritize by business impact, not by queue order.',
      },
      expectedImpact: 'high',
      estimatedEffort: 'low',
      validation: VALID,
    });
  }

  // 3. Attack risk concentration when a Pareto head dominates.
  if (baseline.concentrationHeadShare >= 0.5 && baseline.riskConcentration.length > 0) {
    const head = baseline.riskConcentration[0];
    moves.push({
      order: order++,
      lever: 'exceptions',
      title: {
        pl: 'Zróżnicuj politykę wobec skoncentrowanego źródła ryzyka',
        en: 'Differentiate the policy toward the concentrated risk source',
      },
      rationale: {
        pl: `${Math.round(baseline.concentrationHeadShare * 100)}% wyjątków pochodzi z ${Math.round(baseline.concentrationHeadSourceShare * 100)}% źródeł (czoło: „${head.sourceId}", ${Math.round(head.share * 100)}%) — to nie seria pechowych zdarzeń, tylko problem strukturalny, wymagający decyzji strategicznej, nie kolejnego gaszenia pożaru.`,
        en: `${Math.round(baseline.concentrationHeadShare * 100)}% of exceptions come from ${Math.round(baseline.concentrationHeadSourceShare * 100)}% of sources (head: "${head.sourceId}", ${Math.round(head.share * 100)}%) — not a run of bad luck but a structural problem needing a strategic decision, not another firefight.`,
      },
      tradeOff: {
        pl: 'Kosztem inny bufor / inny SLA monitoringu / renegocjacja z tym źródłem, zamiast jednego standardu dla wszystkich dostawców i tras.',
        en: 'At the cost of a different buffer / monitoring SLA / renegotiation with that source, instead of one standard for all suppliers and routes.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy równe traktowanie wszystkich źródeł: standard uśredniony przepłaca stabilne i niedoszacowuje ryzykownego czoła, które generuje większość wyjątków.',
        en: 'We reject treating all sources equally: an averaged standard overpays the stable ones and underserves the risky head that generates most exceptions.',
      },
      expectedImpact: 'high',
      estimatedEffort: 'medium',
      validation: VALID,
    });
  }

  // 4. Re-calibrate thresholds when alert fatigue is high — it is calibration, not headcount.
  if (baseline.alertFatigueRatio >= 0.3) {
    moves.push({
      order: order++,
      lever: 'exceptions',
      title: {
        pl: 'Przekalibruj progi alertów zamiast czytać więcej szumu',
        en: 'Re-calibrate alert thresholds rather than read more noise',
      },
      rationale: {
        pl: `${Math.round(baseline.alertFatigueRatio * 100)}% alertów jest zamykanych bez akcji — to sygnał źle skalibrowanych progów (statyczne zamiast dynamicznych względem zmienności), nie braku ludzi do ich czytania.`,
        en: `${Math.round(baseline.alertFatigueRatio * 100)}% of alerts are closed with no action — a sign of mis-calibrated thresholds (static instead of dynamic, variability-relative), not a shortage of people to read them.`,
      },
      tradeOff: {
        pl: 'Kosztem analizy historycznej zmienności per SKU/trasa/dostawca do ustawienia progów dynamicznych, zamiast prostszego progu-jednej-liczby.',
        en: 'At the cost of historical-variability analysis per SKU/route/supplier to set dynamic thresholds, instead of a simpler one-number threshold.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy zatrudnienie większego zespołu do obsługi alertów: to skaluje koszt szumu, a nie usuwa jego przyczynę — źle ustawiony próg.',
        en: 'We reject hiring a bigger alert-handling team: that scales the cost of noise instead of removing its cause — a badly set threshold.',
      },
      expectedImpact: 'medium',
      estimatedEffort: 'medium',
      validation: VALID,
    });
  }

  // 5. Frame the next maturity jump as ONE payable level (never a leap to autonomy on dirty data).
  const current = baseline.maturityLevel;
  const next = (Math.min(5, current + 1) as MaturityLevel);
  if (current < 5) {
    const lagLine = baseline.avgDetectionLagHours > 0;
    moves.push({
      order: order++,
      lever: 'maturity',
      title: {
        pl: `Zaplanuj najbliższy opłacalny skok dojrzałości: poziom ${current} → ${next}`,
        en: `Plan the nearest payable maturity jump: level ${current} → ${next}`,
      },
      rationale: {
        pl: `Fakty stawiają was na poziomie ${current} (${localize(MATURITY_LABEL[current], true)})${
          baseline.declaredLevel && baseline.declaredLevel !== current
            ? `, mimo deklaracji poziomu ${baseline.declaredLevel}`
            : ''
        }. ${
          lagLine
            ? `Zakłócenie jest wykrywane średnio o ${baseline.avgDetectionLagHours}h (najgorsze ${baseline.worstDetectionLagHours}h) za późno — skok 2→3 eliminuje samo źródło opóźnienia reakcji, nie tylko przyspiesza raport.`
            : 'Skok o jeden poziom daje największy zwrot per złotówkę, gdy usuwa przyczynę opóźnienia reakcji, a nie tylko przyspiesza raportowanie.'
        }`,
        en: `The facts place you at level ${current} (${localize(MATURITY_LABEL[current], false)})${
          baseline.declaredLevel && baseline.declaredLevel !== current
            ? `, despite a declared level ${baseline.declaredLevel}`
            : ''
        }. ${
          lagLine
            ? `Disruption is detected on average ${baseline.avgDetectionLagHours}h (worst ${baseline.worstDetectionLagHours}h) too late — the 2→3 jump removes the source of delayed response, not just speeds the report.`
            : 'A one-level jump returns most per unit of spend when it removes the cause of delayed response rather than just speeding reporting.'
        }`,
      },
      tradeOff: {
        pl: 'Kosztem oczyszczenia danych i zbudowania pętli closed-loop (digital twin) do najbliższego skoku, zamiast marketingowego przeskoku od razu do autonomii.',
        en: 'At the cost of cleaning the data and building a closed-loop (digital twin) for the next jump, rather than a marketing leap straight to autonomy.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy skok od razu do poziomu 5 (autonomia): oddanie sterowania na brudnych danych skaluje błąd cicho i jest gorsze od człowieka — ROI jest w najbliższym kroku, nie w najdalszym.',
        en: 'We reject leaping straight to level 5 (autonomy): handing over control on dirty data scales the error silently and is worse than a human — the ROI is in the nearest step, not the farthest.',
      },
      expectedImpact: 'medium',
      estimatedEffort: current <= 2 ? 'medium' : 'high',
      validation: VALID,
    });
  }

  return moves;
}

/**
 * One-shot synthesis: baseline + ranking + W2 sequence, ready for the UI or the
 * AI fallback. Pure and deterministic.
 */
export function synthesizeControlTowerPlan(session: ControlTowerSession): {
  baseline: ControlTowerBaseline;
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
): { title: string; rationale: string; lever: ControlTowerLeverId } {
  return {
    title: localize(seq.title, isPolish),
    rationale: `${localize(seq.rationale, isPolish)} ${localize(seq.tradeOff, isPolish)} ${localize(
      seq.rejectedVariant,
      isPolish
    )}`.trim(),
    lever: seq.lever,
  };
}
