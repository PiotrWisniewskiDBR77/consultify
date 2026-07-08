/**
 * Integration Diagnostic — synthesis engine + W2 move validator.
 *
 * The pure, testable brain of the tool. It reads the integration session
 * (systems + integrations + manual bridges + candidate moves) and produces:
 *
 *   1. a topology baseline: point-to-point spaghetti vs hub. It computes the
 *      full-mesh potential n(n-1)/2, the actual point-to-point share, the
 *      linear hub target (n), the single-point-of-failure hub (the system the
 *      most integrations touch), and the Gartner-style maturity level.
 *   2. the re-keying cost of every manual bridge, quantified with the 1-10-100
 *      data-quality rule (prevention at source ~1, correction ~10, downstream
 *      impact ~100), rolled up into annual FTE-hours + error cost.
 *   3. the "which 10-15% carries 80% of the value" cut: the integrated share vs
 *      the MuleSoft benchmark (~27-29%), and the high-value integrations to lead.
 *   4. a per-lever readiness score (inventory / topology / bridges / apiled)
 *      derived from the facts, ranked in a disciplined order.
 *   5. a W2-validated move sequence following System→Process→Experience API
 *      dependency order, where every move carries:
 *        - rationale        (why do this now)
 *        - tradeOff         (what it costs you / what you give up)
 *        - rejectedVariant  (the alternative deliberately NOT taken, and why)
 *
 * The W2 validator is the near-literal transfer of the SMED/Inventory
 * "move must justify itself" contract: a move is only VALID when all three
 * fields are present and non-trivial.
 *
 * This layer is self-contained: it depends only on a minimal read-model of the
 * integration session (IntegrationSession), not on the full store, so it
 * compiles and tests in isolation.
 */

import {
  INTEGRATION_LEVERS,
  integrationLeverLabel,
  type Bilingual,
  type IntegrationLeverId,
} from './deepeningLadder';

type Level = 'high' | 'medium' | 'low';

const LEVEL_SCORE: Record<Level, number> = { high: 3, medium: 2, low: 1 };

/** How two systems exchange data. `manual` is a re-keying bridge, not an integration. */
export type IntegrationType = 'api' | 'file' | 'db' | 'manual' | 'none';
/** Cadence of the data flow. `batch`/`ondemand` hide latency as "no problem". */
export type IntegrationFrequency = 'realtime' | 'batch' | 'ondemand' | 'manual';

/**
 * Minimal read-model of one system in the application landscape. Sourced from
 * the tool's `systems` section.
 */
export interface SystemNode {
  id: string;
  /** Business/technical name of the system (ERP, CRM, WMS, ...). */
  name?: string;
  /** Whether the system is core (true) or satellite/helper (false/undefined). */
  core?: boolean;
  /** Whether it exposes a documented, reusable API (API-first readiness). */
  hasApi?: boolean;
  /** Whether it has a formal owner (business or technical). */
  owned?: boolean;
}

/**
 * Minimal read-model of one integration (edge) between two systems. Sourced
 * from the tool's `integrations` section.
 */
export interface IntegrationEdge {
  id: string;
  /** Source system id. */
  from?: string;
  /** Target system id. */
  to?: string;
  /** Mechanism: api/file/db count as real integrations; manual/none do not. */
  type?: IntegrationType;
  frequency?: IntegrationFrequency;
  /** Whether this edge is a direct point-to-point link (vs routed via a hub). */
  pointToPoint?: boolean;
  /** Whether it sits on a critical end-to-end business flow (order→invoice, ...). */
  critical?: boolean;
  /** Whether it is a single point of failure with no alternative path. */
  spof?: boolean;
  /** Whether it is documented. */
  documented?: boolean;
  /** Whether it is monitored (someone learns of a failure before a user reports it). */
  monitored?: boolean;
  /** Whether it reuses an existing System/Process API (vs built from scratch). */
  reusesApi?: boolean;
  /** Mean time to repair, in hours, when it fails. */
  mttrHours?: number;
}

/**
 * Minimal read-model of one manual bridge (re-keying) from the `bridges`
 * section — a human moving data between systems by hand.
 */
export interface ManualBridge {
  id: string;
  /** How many people perform the re-keying. */
  people?: number;
  /** Hours per month spent on it (per person). */
  hoursPerMonth?: number;
  /** Estimated error rate, 0..1 (e.g. 0.04 = 4%). */
  errorRate?: number;
  /** Whether it sits on a critical flow (order→invoice), raising 1-10-100 exposure. */
  critical?: boolean;
  /** Whether both endpoint systems already expose an API (automation is a quick win). */
  bothHaveApi?: boolean;
}

/** Minimal read-model of one candidate integration move from the `moves` section. */
export interface IntegrationMoveItem {
  id: string;
  /** Which integration lever the move primarily belongs to. */
  lever?: IntegrationLeverId;
  impact?: Level;
  effort?: Level;
  /** Evidence backing the move (inventory pull, incident log, pilot). */
  evidence?: string[];
}

/** The minimal integration session shape the engine reads. */
export interface IntegrationSession {
  systems: SystemNode[];
  integrations: IntegrationEdge[];
  bridges: ManualBridge[];
  moves: IntegrationMoveItem[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const asLevel = (value: unknown, fallback: Level = 'medium'): Level =>
  value === 'high' || value === 'medium' || value === 'low' ? value : fallback;
const localize = (text: Bilingual, isPolish: boolean) => (isPolish ? text.pl : text.en);

// ---------------------------------------------------------------------------
// 1-10-100 data-quality rule
// ---------------------------------------------------------------------------

/**
 * The 1-10-100 rule of data quality (Loqate/Matillion): preventing an error at
 * source costs ~1 unit, correcting it after the fact ~10, and cleaning up the
 * downstream impact once it reaches a customer or a management report ~100.
 * A re-keying bridge produces errors that mostly escape the source, so its
 * blended cost multiple sits well above 1 — higher on a critical flow, where
 * more errors reach the report/customer layer.
 */
export const ONE_TEN_HUNDRED = { source: 1, correction: 10, downstream: 100 } as const;

/**
 * Blended error-cost multiple for a bridge under the 1-10-100 rule. A non-critical
 * bridge's errors are mostly caught at correction (~10); a critical-flow bridge
 * leaks more errors downstream (~100), so its blended multiple is higher.
 */
export const errorCostMultiple = (critical: boolean): number => (critical ? 55 : 15);

// ---------------------------------------------------------------------------
// Baseline: topology + maturity + re-keying + integrated share
// ---------------------------------------------------------------------------

/** Gartner-style integration maturity level, 1 (ad hoc) .. 5 (augmented). */
export type MaturityLevel = 1 | 2 | 3 | 4 | 5;

/** The MuleSoft Connectivity Benchmark: ~27-29% of enterprise apps are integrated. */
export const MULESOFT_INTEGRATED_BENCHMARK = 0.28;

/** The headline integration facts: topology, fragility, re-keying and maturity. */
export interface IntegrationBaseline {
  systemCount: number;
  /** Count of real integrations (api/file/db), excluding manual/none. */
  integrationCount: number;
  /** Manual re-keying bridges — missing integrations, not integrations. */
  manualBridgeCount: number;
  /** Full-mesh potential connections: n(n-1)/2. */
  fullMeshPotential: number;
  /** Hub target: linear connection count (one edge per system). */
  hubTargetConnections: number;
  /** Count of edges flagged as direct point-to-point. */
  pointToPointCount: number;
  /** Share of real integrations that are point-to-point, 0..1. */
  pointToPointShare: number;
  /** Share of systems that are really integrated (touch >=1 real edge), 0..1. */
  integratedShare: number;
  /** id of the system the most integrations touch — the de facto hub / SPOF. */
  hubSystemId?: string;
  /** How many real integrations the hub system touches. */
  hubDegree: number;
  /** Whether the hub concentrates integrations but has no formal owner (silent SPOF). */
  hubUnowned: boolean;
  /** Total annual FTE-hours consumed by manual re-keying. */
  rekeyingHoursPerYear: number;
  /** Total annual FTE consumed by re-keying (hours / 1800). */
  rekeyingFte: number;
  /** Blended annual error-cost units from re-keying under the 1-10-100 rule. */
  rekeyingErrorCostUnits: number;
  /** Count of documented integrations. */
  documentedCount: number;
  /** Count of monitored integrations. */
  monitoredCount: number;
  /** Count of critical integrations that are single points of failure. */
  criticalSpofCount: number;
  /** Count of real integrations that reused an existing API (reuse discipline). */
  reuseCount: number;
  /** Gartner-style maturity level derived from the facts. */
  maturityLevel: MaturityLevel;
}

const isReal = (e: IntegrationEdge): boolean =>
  e.type === 'api' || e.type === 'file' || e.type === 'db';

/** Annual working hours per FTE used to convert re-keying hours into FTE. */
const FTE_HOURS_PER_YEAR = 1800;

export function computeBaseline(session: IntegrationSession): IntegrationBaseline {
  const systems = session.systems;
  const edges = session.integrations;
  const bridges = session.bridges;

  const n = systems.length;
  const realEdges = edges.filter(isReal);
  const integrationCount = realEdges.length;
  const manualBridgeCount = bridges.length + edges.filter((e) => e.type === 'manual').length;

  const fullMeshPotential = n > 1 ? (n * (n - 1)) / 2 : 0;
  const hubTargetConnections = n; // hub-and-spoke: one edge per system
  const pointToPointCount = realEdges.filter((e) => e.pointToPoint !== false).length;
  const pointToPointShare =
    integrationCount > 0 ? round1(pointToPointCount / integrationCount) : 0;

  // Degree per system across real edges — the de facto hub is the highest-degree node.
  const degree = new Map<string, number>();
  for (const e of realEdges) {
    if (e.from) degree.set(e.from, (degree.get(e.from) || 0) + 1);
    if (e.to) degree.set(e.to, (degree.get(e.to) || 0) + 1);
  }
  let hubSystemId: string | undefined;
  let hubDegree = 0;
  for (const [sysId, deg] of degree) {
    if (deg > hubDegree) {
      hubDegree = deg;
      hubSystemId = sysId;
    }
  }
  const hubSystem = hubSystemId ? systems.find((s) => s.id === hubSystemId) : undefined;
  const hubUnowned = hubDegree >= 3 && !!hubSystem && !hubSystem.owned;

  // Integrated systems: those touched by at least one real edge.
  const integratedShare = n > 0 ? round1(degree.size / n) : 0;

  // Re-keying: FTE-hours/year and 1-10-100 error-cost units.
  let rekeyingHoursPerYear = 0;
  let rekeyingErrorCostUnits = 0;
  for (const b of bridges) {
    const people = Math.max(0, b.people ?? 1);
    const hoursPerMonth = Math.max(0, b.hoursPerMonth ?? 0);
    const hoursYear = people * hoursPerMonth * 12;
    rekeyingHoursPerYear += hoursYear;
    // error-cost units ~ (touched records proxy = hours) × errorRate × 1-10-100 multiple.
    const errorRate = clamp(b.errorRate ?? 0, 0, 1);
    rekeyingErrorCostUnits += hoursYear * errorRate * errorCostMultiple(!!b.critical);
  }
  rekeyingHoursPerYear = round1(rekeyingHoursPerYear);
  const rekeyingFte = round1(rekeyingHoursPerYear / FTE_HOURS_PER_YEAR);
  rekeyingErrorCostUnits = round1(rekeyingErrorCostUnits);

  const documentedCount = realEdges.filter((e) => e.documented).length;
  const monitoredCount = realEdges.filter((e) => e.monitored).length;
  const criticalSpofCount = realEdges.filter((e) => e.spof && e.critical).length;
  const reuseCount = realEdges.filter((e) => e.reusesApi).length;

  const maturityLevel = deriveMaturity({
    integrationCount,
    manualBridgeCount,
    pointToPointShare,
    documentedRatio: integrationCount > 0 ? documentedCount / integrationCount : 0,
    reuseRatio: integrationCount > 0 ? reuseCount / integrationCount : 0,
    apiFirstRatio: n > 0 ? systems.filter((s) => s.hasApi).length / n : 0,
    hubUnowned,
  });

  return {
    systemCount: n,
    integrationCount,
    manualBridgeCount,
    fullMeshPotential,
    hubTargetConnections,
    pointToPointCount,
    pointToPointShare,
    integratedShare,
    hubSystemId,
    hubDegree,
    hubUnowned,
    rekeyingHoursPerYear,
    rekeyingFte,
    rekeyingErrorCostUnits,
    documentedCount,
    monitoredCount,
    criticalSpofCount,
    reuseCount,
    maturityLevel,
  };
}

/**
 * Derive the Gartner-style maturity level (1..5) from the facts. Most non-tech
 * firms land at 1-2: many point-to-point links, many manual bridges, little
 * documentation, no reuse discipline. Level 3+ requires a real drop in
 * point-to-point share, documentation, and reuse — not a "we have a platform"
 * claim.
 */
function deriveMaturity(f: {
  integrationCount: number;
  manualBridgeCount: number;
  pointToPointShare: number;
  documentedRatio: number;
  reuseRatio: number;
  apiFirstRatio: number;
  hubUnowned: boolean;
}): MaturityLevel {
  if (f.integrationCount === 0) return 1;
  // Level 4-5: API-first with real reuse discipline and governance.
  if (f.reuseRatio >= 0.5 && f.apiFirstRatio >= 0.7 && f.pointToPointShare <= 0.3) {
    return f.reuseRatio >= 0.75 && f.documentedRatio >= 0.9 ? 5 : 4;
  }
  // Level 3: centralized — a shared standard is emerging (lower P2P, documented).
  if (f.pointToPointShare <= 0.5 && f.documentedRatio >= 0.6 && !f.hubUnowned) {
    return 3;
  }
  // Level 2: enlightened — the org understands the problem but manages per-project.
  if (f.pointToPointShare <= 0.8 && f.documentedRatio >= 0.3 && f.manualBridgeCount <= f.integrationCount) {
    return 2;
  }
  // Level 1: ad hoc — mostly point-to-point, undocumented, re-keying is normal.
  return 1;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface LeverScore {
  lever: IntegrationLeverId;
  label: Bilingual;
  /** Integration-move candidates attributed to this lever. */
  moveCount: number;
  /** Facts this lever can act on (integrations, bridges, hours, systems). */
  scopeSize: number;
  /** Mean impact of this lever's moves, 1..3. */
  attractiveness: number;
  /** Ease of pulling it off (low effort + evidence), 1..3. */
  feasibility: number;
  /** attractiveness × feasibility, 1..9. */
  score: number;
  /** Count of moves carrying at least one evidence item. */
  evidenceBacked: number;
}

/** How much a lever has to act on, derived from the baseline facts. */
const scopeForLever = (
  lever: IntegrationLeverId,
  session: IntegrationSession,
  baseline: IntegrationBaseline
): number => {
  switch (lever) {
    case 'inventory':
      // inventory governs the whole landscape
      return baseline.systemCount + baseline.integrationCount + baseline.manualBridgeCount;
    case 'topology':
      // topology acts on point-to-point links and the hub degree
      return baseline.pointToPointCount + baseline.hubDegree;
    case 'bridges':
      // bridges acts on the re-keying hours (the FTE burden)
      return round1(baseline.rekeyingHoursPerYear);
    case 'apiled':
      // API-first acts on systems that lack an API + non-reused integrations
      return (
        session.systems.filter((s) => !s.hasApi).length +
        (baseline.integrationCount - baseline.reuseCount)
      );
    default:
      return 0;
  }
};

const scoreLever = (
  lever: IntegrationLeverId,
  session: IntegrationSession,
  baseline: IntegrationBaseline
): LeverScore => {
  const label = integrationLeverLabel(lever);
  const moves = session.moves.filter((m) => m.lever === lever);
  const scopeSize = round1(scopeForLever(lever, session, baseline));

  if (moves.length === 0) {
    return {
      lever,
      label,
      moveCount: 0,
      scopeSize,
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
    scopeSize,
    attractiveness,
    feasibility,
    score,
    evidenceBacked,
  };
};

export interface LeverRanking {
  scores: LeverScore[];
  /** levers ordered best-first among those with at least one move. */
  ordered: IntegrationLeverId[];
  rationale: Bilingual;
}

/**
 * Rank the four integration levers. Only levers with move candidates are ranked;
 * empty levers are reported with score 0 but excluded from `ordered`. Ties break
 * toward the canonical order (inventory before topology before bridges before
 * apiled) so the sequence never recommends buying a platform before the
 * inventory that should shape it exists.
 */
export function rankLevers(session: IntegrationSession): LeverRanking {
  const baseline = computeBaseline(session);
  const scores = INTEGRATION_LEVERS.map((lever) => scoreLever(lever, session, baseline));
  const orderIndex = (l: IntegrationLeverId) => INTEGRATION_LEVERS.indexOf(l);

  const ordered = scores
    .filter((s) => s.moveCount > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.scopeSize !== a.scopeSize) return b.scopeSize - a.scopeSize;
      return orderIndex(a.lever) - orderIndex(b.lever);
    })
    .map((s) => s.lever);

  const top = scores.find((s) => s.lever === ordered[0]);
  const rationale: Bilingual = top
    ? {
        pl: `Najsilniejsza dźwignia to „${integrationLeverLabel(top.lever).pl.toLowerCase()}" (dopasowanie ${top.score}/9: atrakcyjność ${top.attractiveness} × wykonalność ${top.feasibility}), z zakresem ${top.scopeSize}. Sekwencja trzyma porządek: nie kupujemy platformy, zanim nie ma inwentarza i mapy topologii.`,
        en: `The strongest lever is "${integrationLeverLabel(top.lever).en.toLowerCase()}" (fit ${top.score}/9: attractiveness ${top.attractiveness} × feasibility ${top.feasibility}), scope ${top.scopeSize}. The sequence keeps order: we do not buy a platform before the inventory and topology map exist.`,
      }
    : {
        pl: 'Brak kandydatów na ruchy — dodaj systemy, integracje i ruchy w co najmniej jednej dźwigni, aby zbudować ranking.',
        en: 'No move candidates yet — add systems, integrations and moves in at least one lever to build a ranking.',
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
  lever: IntegrationLeverId;
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
 * Build a W2-validated move sequence from the ranked levers, following the
 * System→Process→Experience API dependency order of the doctrine:
 *
 *   1. When the landscape is under-mapped, INVENTORY first — you cannot design
 *      topology or automate bridges on integrations you have not mapped.
 *   2. Harden a de facto hub / critical SPOF before it fails (System API layer +
 *      owner) — a silent SPOF is the top priority even without failure history.
 *   3. Automate the highest-return, lowest-complexity manual bridge (both
 *      endpoints already expose an API) — the quick win that proves the value.
 *   4. Defer the platform/API-first migration behind a stated trade-off until
 *      the inventory and topology justify it — big-bang migration multiplies risk.
 */
export function buildW2MoveSequence(session: IntegrationSession): SequencedMove[] {
  const { scores, ordered } = rankLevers(session);
  if (ordered.length === 0) return [];

  const baseline = computeBaseline(session);
  const scoreOf = (l: IntegrationLeverId) => scores.find((s) => s.lever === l)!;
  const moves: SequencedMove[] = [];
  let order = 1;

  const documentedRatio =
    baseline.integrationCount > 0 ? baseline.documentedCount / baseline.integrationCount : 0;

  // 1. If the landscape is under-mapped, inventory first.
  if (baseline.integrationCount === 0 || documentedRatio < 0.5 || baseline.maturityLevel <= 1) {
    moves.push({
      order: order++,
      lever: 'inventory',
      title: {
        pl: 'Najpierw zmapuj systemy i integracje (inwentarz)',
        en: 'Map the systems and integrations first (inventory)',
      },
      rationale: {
        pl: `Tylko ${Math.round(documentedRatio * 100)}% integracji jest udokumentowanych, a poziom dojrzałości to ${baseline.maturityLevel}/5 — bez pełnego inwentarza (kierunek, typ, częstotliwość, właściciel) każda decyzja o topologii czy automatyzacji jest zgadywaniem.`,
        en: `Only ${Math.round(documentedRatio * 100)}% of integrations are documented and maturity is ${baseline.maturityLevel}/5 — without a full inventory (direction, type, frequency, owner) every topology or automation decision is guesswork.`,
      },
      tradeOff: {
        pl: 'Kosztem kilku tygodni wywiadów z działami (nie tylko IT), w zamian za mapę, która ujawnia integracje nieoficjalne — najdroższe silosy.',
        en: 'At the cost of a few weeks of interviews with departments (not only IT), in exchange for a map that reveals the unofficial integrations — the most expensive silos.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „kupmy od razu iPaaS": platforma bez wcześniejszego inwentarza i mapy zależności kończy nowym point-to-point wewnątrz samej platformy.',
        en: 'We reject "just buy an iPaaS now": a platform without a prior inventory and dependency map ends up as new point-to-point inside the platform itself.',
      },
      expectedImpact: 'medium',
      estimatedEffort: 'low',
      validation: VALID,
    });
  }

  // 2. Harden a de facto hub / critical SPOF before it fails.
  if ((baseline.hubUnowned || baseline.criticalSpofCount > 0) && baseline.hubDegree >= 3) {
    const hubName =
      session.systems.find((s) => s.id === baseline.hubSystemId)?.name || baseline.hubSystemId || 'hub';
    moves.push({
      order: order++,
      lever: 'topology',
      title: {
        pl: `Zabezpiecz system-hub „${hubName}" (właściciel + warstwa System API)`,
        en: `Harden the "${hubName}" hub system (owner + System API layer)`,
      },
      rationale: {
        pl: `System „${hubName}" jest hubem dla ${baseline.hubDegree} integracji point-to-point${baseline.hubUnowned ? ' i nikt nie jest jego formalnym właścicielem' : ''} — jego padnięcie zatrzymuje kilka procesów naraz. To pojedynczy punkt awarii bez planu ciągłości, pilny niezależnie od tego, jak długo „działał bez problemu".`,
        en: `The "${hubName}" system is a hub for ${baseline.hubDegree} point-to-point integrations${baseline.hubUnowned ? ' and no one formally owns it' : ''} — its failure halts several processes at once. This is a single point of failure with no continuity plan, urgent regardless of how long it "ran without a problem".`,
      },
      tradeOff: {
        pl: 'Kosztem pracy nad warstwą izolującą, która nie dodaje nowej funkcji — kupujecie odporność, nie nową możliwość.',
        en: 'At the cost of work on an isolating layer that adds no new feature — you buy resilience, not a new capability.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „poczekajmy aż coś padnie": brak historii awarii nie oznacza braku ryzyka, a naprawa po kaskadowej awarii kosztuje wielokrotnie więcej niż prewencja.',
        en: 'We reject "wait until something fails": no failure history does not mean no risk, and repair after a cascading failure costs multiples of prevention.',
      },
      expectedImpact: 'high',
      estimatedEffort: 'medium',
      validation: VALID,
    });
  }

  // 3. Automate the highest-return, lowest-complexity manual bridge (quick win).
  if (baseline.manualBridgeCount > 0 && baseline.rekeyingHoursPerYear > 0) {
    const bridgesScore = scoreOf('bridges');
    moves.push({
      order: order++,
      lever: 'bridges',
      title: {
        pl: 'Zautomatyzuj najdroższy ręczny mostek o gotowym API (quick win)',
        en: 'Automate the costliest manual bridge with a ready API (quick win)',
      },
      rationale: {
        pl: `Ręczne mostki pochłaniają ${baseline.rekeyingHoursPerYear} h/rok (~${baseline.rekeyingFte} FTE) plus koszt błędów wg reguły 1-10-100 (${baseline.rekeyingErrorCostUnits} jednostek) — automatyzacja mostka, którego oba systemy mają już API, zwraca się najszybciej i dowodzi wartości programu.`,
        en: `Manual bridges consume ${baseline.rekeyingHoursPerYear} h/yr (~${baseline.rekeyingFte} FTE) plus error cost under the 1-10-100 rule (${baseline.rekeyingErrorCostUnits} units) — automating a bridge whose both systems already expose an API returns fastest and proves the program's value.`,
      },
      tradeOff: {
        pl: 'Kosztem skupienia się na jednym mostku zamiast otwierania wszystkich naraz — świadomie zaczynacie od najłatwiejszego z wysokim zwrotem, nie od najtrudniejszego.',
        en: 'At the cost of focusing on one bridge instead of opening all at once — you deliberately start with the easiest, highest-return one, not the hardest.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „róbmy dalej ręcznie, bo działa": rekeying to nie tylko koszt FTE, ale źródło błędów drogich w raporcie zarządczym — koszt zaniechania przewyższa koszt integracji.',
        en: 'We reject "keep doing it by hand, it works": re-keying is not just an FTE cost but a source of errors expensive in a management report — the cost of inaction beats the cost of the integration.',
      },
      expectedImpact:
        bridgesScore.moveCount > 0 && bridgesScore.attractiveness >= 2.5 ? 'high' : 'medium',
      estimatedEffort: 'low',
      validation: VALID,
    });
  }

  // 4. Defer the platform/API-first migration behind a stated trade-off.
  const apiScore = scoreOf('apiled');
  moves.push({
    order: order++,
    lever: 'apiled',
    title: {
      pl: 'Przejdź na warstwę API-first dopiero po quick winach (System→Process→Experience)',
      en: 'Move to an API-first layer only after the quick wins (System→Process→Experience)',
    },
    rationale: {
      pl:
        baseline.integratedShare > 0
          ? `Realnie zintegrowanych jest ${Math.round(baseline.integratedShare * 100)}% systemów (benchmark MuleSoft ~28%), a ${Math.round(baseline.pointToPointShare * 100)}% integracji to point-to-point — przy nowych systemach liczba połączeń rośnie kwadratowo (do ${baseline.fullMeshPotential} wobec ${baseline.hubTargetConnections} przez hub). Wprowadźcie warstwę System→Process→Experience API na krytycznym przepływie, zaczynając od tych 10-15% integracji, które niosą 80% wartości.`
          : `${Math.round(baseline.pointToPointShare * 100)}% integracji to point-to-point (dojrzałość ${baseline.maturityLevel}/5) — przy nowych systemach koszt utrzymania rośnie kwadratowo. Wprowadźcie warstwę System→Process→Experience API na krytycznym przepływie, zaczynając od integracji o najwyższej wartości, nie od „zintegrujmy wszystko".`,
      en:
        baseline.integratedShare > 0
          ? `Only ${Math.round(baseline.integratedShare * 100)}% of systems are really integrated (MuleSoft benchmark ~28%), and ${Math.round(baseline.pointToPointShare * 100)}% of integrations are point-to-point — with new systems the connection count grows quadratically (up to ${baseline.fullMeshPotential} vs ${baseline.hubTargetConnections} via a hub). Introduce a System→Process→Experience API layer on a critical flow, starting with the 10-15% of integrations that carry 80% of the value.`
          : `${Math.round(baseline.pointToPointShare * 100)}% of integrations are point-to-point (maturity ${baseline.maturityLevel}/5) — with new systems the maintenance cost grows quadratically. Introduce a System→Process→Experience API layer on a critical flow, starting with the highest-value integrations, not "integrate everything".`,
    },
    tradeOff: {
      pl: 'Kosztem czasu na wybór i wdrożenie platformy oraz dyscypliny reużycia (katalog API), zanim rozszerzycie migrację na resztę integracji.',
      en: 'At the cost of time to choose and deploy the platform and the reuse discipline (an API catalog) before extending the migration to the rest.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy migrację wszystkiego naraz (big-bang): przeniesienie wszystkich integracji point-to-point na nową platformę jednocześnie multiplikuje ryzyko — sekwencjonujemy od najwyższego zwrotu, nie od wszystkiego.',
      en: 'We reject a big-bang migration: moving every point-to-point integration to a new platform at once multiplies risk — we sequence from the highest return, not everything.',
    },
    expectedImpact: apiScore.moveCount > 0 && apiScore.attractiveness >= 2.5 ? 'high' : 'medium',
    estimatedEffort: 'high',
    validation: VALID,
  });

  return moves;
}

/**
 * One-shot synthesis: baseline + ranking + W2 sequence, ready for the UI or the
 * AI fallback. Pure and deterministic.
 */
export function synthesizeIntegrationPlan(session: IntegrationSession): {
  baseline: IntegrationBaseline;
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
): { title: string; rationale: string; lever: IntegrationLeverId } {
  return {
    title: localize(seq.title, isPolish),
    rationale: `${localize(seq.rationale, isPolish)} ${localize(seq.tradeOff, isPolish)} ${localize(
      seq.rejectedVariant,
      isPolish
    )}`.trim(),
    lever: seq.lever,
  };
}
