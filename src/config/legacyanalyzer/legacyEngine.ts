/**
 * Legacy Analyzer — synthesis engine (the deterministic brain of the tool).
 *
 * The pure, testable core. It reads a minimal legacy session (an application
 * portfolio + a cross-system dependency graph) and produces:
 *
 *   1. a per-application Gartner TIME decision from two weighted, sub-criteria
 *      axes — business value (Y) × technical health (X) — never one "gut" number.
 *   2. a 6R migration strategy for every app the matrix routes to MIGRATE/INVEST.
 *   3. a tech-debt score for the portfolio: % of the IT budget trapped in
 *      low-value ELIMINATE/MIGRATE applications (run-vs-change mis-allocation).
 *   4. a dependency-graph override: an app scored ELIMINATE that is a critical
 *      integration node (high in-degree) is LIFTED to MIGRATE — you cannot
 *      retire a node three others depend on without replacing the integration.
 *   5. a roadmap sequenced by the dependency GRAPH, not by value priority:
 *      a system's slot is bounded below by everything that must precede it,
 *      so the integration replacement lands before the node it unblocks.
 *   6. bus factor treated as a LEADING indicator: a falling bus factor raises
 *      urgency ahead of what TCO alone shows.
 *
 * Self-contained: depends only on a minimal LegacySession read-model (not the
 * store), so it compiles and tests in isolation.
 */

import {
  legacyDimensionLabel,
  type Bilingual,
  type LegacyDimensionId,
} from './deepeningLadder';

type Level = 'high' | 'medium' | 'low';

const localize = (text: Bilingual, isPolish: boolean) => (isPolish ? text.pl : text.en);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const round2 = (value: number) => Math.round(value * 100) / 100;

// ---------------------------------------------------------------------------
// Read-model
// ---------------------------------------------------------------------------

/** Gartner TIME decision quadrant. */
export type TimeDecision = 'TOLERATE' | 'INVEST' | 'MIGRATE' | 'ELIMINATE';

/** AWS 6R migration strategy. */
export type SixRStrategy =
  | 'retain'
  | 'retire'
  | 'rehost'
  | 'replatform'
  | 'repurchase'
  | 'refactor';

/** Vendor-support status for an application. */
export type SupportStatus = 'active' | 'expiring' | 'none';

/**
 * Minimal read-model of one application (or a separately-assessed module of a
 * large application). Value/health carry 1-5 sub-criteria averages; the risk
 * facts (support, bus factor, CVE, compliance) qualify the TIME cell and drive
 * the risk index and the 6R choice.
 */
export interface LegacyApp {
  id: string;
  name?: string;
  /** Business-value axis (Y): weighted 1-5 average of criticality, reach, uniqueness, revenue, strategy fit. */
  businessValue?: number;
  /** Technical-health axis (X): weighted 1-5 average of stack currency, security, maintainability, skills, TCO/size. */
  technicalHealth?: number;
  /** Total cost of ownership per year (licenses + infra + FTE + incidents). */
  tcoPerYear?: number;
  /** Replacement value of the application (for debt-%-of-estate). */
  replacementValue?: number;
  /** Cost to bring the stack to a "current" state (the raw technical debt). */
  remediationCost?: number;
  /** Active users — a low count with no owner is a red flag for ELIMINATE. */
  activeUsers?: number;
  /** Whether a business owner is named (an unowned system skews toward ELIMINATE). */
  hasBusinessOwner?: boolean;
  /** People who can maintain this system (bus factor). */
  busFactor?: number;
  /** Bus factor one year ago — a falling trend is a leading indicator. */
  busFactorPrev?: number;
  /** Vendor-support status. */
  supportStatus?: SupportStatus;
  /** Months until vendor support ends (a hard deadline; undefined if not applicable). */
  supportEndsInMonths?: number;
  /** Count of known unpatched CVEs / open security findings. */
  knownCves?: number;
  /** Whether the app has an open compliance gap (weighted heavily in regulated orgs). */
  complianceGap?: boolean;
  /** Whether the function is commoditized (HR, accounting, CRM) — a Repurchase signal. */
  commoditized?: boolean;
  /** Whether another portfolio system already covers this function (duplication → retire/eliminate). */
  duplicatedElsewhere?: boolean;
  /**
   * Whether the application hits a CONFIRMED scaling barrier — the load/capacity
   * ceiling that a lift-and-tinker move (Replatform) cannot lift, so only a
   * Refactor/Rearchitect removes it. Doctrine §5: a Refactor is justified only at
   * a real scaling barrier, NOT at high debt alone ("rewrite it because the code
   * is ugly" is the costliest reverse trap). Left undefined until measured.
   */
  scalingBarrier?: boolean;
  /**
   * Peak capacity utilization (%). A sustained ceiling (>= SCALING_BARRIER_UTILIZATION)
   * is itself evidence of a scaling barrier even when `scalingBarrier` was not set
   * by hand — the architecture cannot absorb more load without a rebuild.
   */
  capacityUtilizationPct?: number;
}

/** One directed integration edge: `from` depends on / consumes `to`. */
export interface DependencyEdge {
  from: string;
  to: string;
  /** Whether the integration is documented (undocumented = hidden node risk). */
  documented?: boolean;
}

/** The minimal legacy session shape the engine reads. */
export interface LegacySession {
  apps: LegacyApp[];
  dependencies: DependencyEdge[];
  /** Total annual IT budget — the denominator for the tech-debt %-of-budget score. */
  itBudgetPerYear?: number;
  /**
   * Whether the org is regulated (bank, insurer, healthcare). Raises the
   * compliance weight so a "working but non-compliant" system lands in MIGRATE.
   */
  regulated?: boolean;
}

// ---------------------------------------------------------------------------
// TIME matrix — two axes, midpoint 3 on the 1-5 scale
// ---------------------------------------------------------------------------

const AXIS_MID = 3;
/** In-degree at or above which a node is a critical integration node. */
const CRITICAL_NODE_INDEGREE = 2;
/** Peak utilization (%) at/above which the architecture is treated as capacity-bound. */
const SCALING_BARRIER_UTILIZATION = 85;

/**
 * Whether the app has a CONFIRMED scaling barrier: either explicitly flagged, or
 * evidenced by a sustained capacity ceiling. This — not high debt — is what
 * qualifies a MIGRATE app for Refactor (doctrine §5).
 */
const hasScalingBarrier = (app: LegacyApp): boolean =>
  app.scalingBarrier === true ||
  (app.capacityUtilizationPct ?? 0) >= SCALING_BARRIER_UTILIZATION;

const highValue = (app: LegacyApp) => (app.businessValue ?? AXIS_MID) >= AXIS_MID;
const highHealth = (app: LegacyApp) => (app.technicalHealth ?? AXIS_MID) >= AXIS_MID;

/**
 * Raw TIME quadrant from the two axes alone (before the dependency override).
 * High value + high health = INVEST; high value + low health = MIGRATE;
 * low value + high health = TOLERATE; low value + low health = ELIMINATE.
 */
export function rawTimeDecision(app: LegacyApp): TimeDecision {
  const value = highValue(app);
  const health = highHealth(app);
  if (value && health) return 'INVEST';
  if (value && !health) return 'MIGRATE';
  if (!value && health) return 'TOLERATE';
  return 'ELIMINATE';
}

// ---------------------------------------------------------------------------
// Dependency graph
// ---------------------------------------------------------------------------

export interface NodeDegree {
  appId: string;
  /** How many systems depend on this node (this node is `to`). */
  inDegree: number;
  /** How many systems this node depends on (this node is `from`). */
  outDegree: number;
  /** Whether any inbound edge is undocumented — a hidden-node risk. */
  hasUndocumentedInbound: boolean;
}

/** Compute in/out degree per app from the dependency edges. */
export function computeDegrees(session: LegacySession): Record<string, NodeDegree> {
  const degrees: Record<string, NodeDegree> = {};
  const ensure = (id: string): NodeDegree =>
    (degrees[id] ??= { appId: id, inDegree: 0, outDegree: 0, hasUndocumentedInbound: false });
  session.apps.forEach((a) => ensure(a.id));
  session.dependencies.forEach((e) => {
    ensure(e.from).outDegree += 1;
    const target = ensure(e.to);
    target.inDegree += 1;
    if (e.documented === false) target.hasUndocumentedInbound = true;
  });
  return degrees;
}

/** Whether the node is a critical integration node others cannot lose silently. */
const isCriticalNode = (deg: NodeDegree | undefined): boolean =>
  !!deg && deg.inDegree >= CRITICAL_NODE_INDEGREE;

// ---------------------------------------------------------------------------
// Risk index & bus-factor leading indicator
// ---------------------------------------------------------------------------

export interface RiskProfile {
  /** 0..1 risk index: support end + CVE + bus factor + compliance, weighted. */
  index: number;
  /** True when bus factor is 1 or lower (single point of knowledge). */
  singlePointOfKnowledge: boolean;
  /** True when the bus factor fell year-over-year (leading indicator). */
  busFactorFalling: boolean;
  /** Human-readable count of distinct risk signals firing. */
  signalCount: number;
}

/**
 * Bus factor is a LEADING indicator, not a descriptive one: a falling trend
 * predicts higher maintenance cost/time before TCO reflects it. This flags the
 * fall and counts it as an amplifier in the risk index.
 */
export function assessRisk(app: LegacyApp, session: LegacySession): RiskProfile {
  const bus = app.busFactor ?? 3;
  const busPrev = app.busFactorPrev;
  const singlePointOfKnowledge = bus <= 1;
  const busFactorFalling = busPrev !== undefined && bus < busPrev;

  let index = 0;
  let signalCount = 0;

  if (app.supportStatus === 'none') {
    index += 0.3;
    signalCount += 1;
  } else if (app.supportStatus === 'expiring' || (app.supportEndsInMonths ?? 99) <= 18) {
    index += 0.2;
    signalCount += 1;
  }
  if ((app.knownCves ?? 0) > 0) {
    index += Math.min(0.25, 0.1 + 0.03 * (app.knownCves ?? 0));
    signalCount += 1;
  }
  if (singlePointOfKnowledge) {
    index += 0.25;
    signalCount += 1;
  }
  if (busFactorFalling) {
    // Leading indicator: the trend itself is a signal, above the current level.
    index += 0.1;
  }
  if (app.complianceGap) {
    // Regulated orgs weigh compliance heavily — a gap alone can force MIGRATE.
    index += session.regulated ? 0.3 : 0.15;
    signalCount += 1;
  }

  return { index: round2(clamp(index, 0, 1)), singlePointOfKnowledge, busFactorFalling, signalCount };
}

// ---------------------------------------------------------------------------
// Per-application verdict: TIME (with dependency override) + 6R + risk + debt
// ---------------------------------------------------------------------------

export interface AppDebt {
  /** Remediation cost / replacement value, 0..1+ (McKinsey: 20-40% typical). */
  debtRatio: number;
  /** The raw remediation cost carried forward for portfolio aggregation. */
  remediationCost: number;
}

export interface AppVerdict {
  appId: string;
  name: string;
  /** Decision after the dependency-graph override. */
  decision: TimeDecision;
  /** Decision from the two axes alone, before any override. */
  rawDecision: TimeDecision;
  /** Whether the dependency graph lifted an ELIMINATE to MIGRATE. */
  dependencyOverride: boolean;
  /** 6R migration strategy (set for MIGRATE/INVEST/ELIMINATE routes; retain otherwise). */
  sixR: SixRStrategy;
  inDegree: number;
  risk: RiskProfile;
  debt: AppDebt;
  tcoPerYear: number;
  /** Plain-language reason the decision landed where it did. */
  rationale: Bilingual;
}

const appDebt = (app: LegacyApp): AppDebt => {
  const remediationCost = app.remediationCost ?? 0;
  const replacement = app.replacementValue ?? 0;
  const debtRatio = replacement > 0 ? round2(remediationCost / replacement) : 0;
  return { debtRatio, remediationCost };
};

/**
 * Pick the 6R strategy for an application given its decision, value, health,
 * debt and function commoditization.
 *
 * - ELIMINATE with a duplicate elsewhere → retire (function already covered).
 * - ELIMINATE lifted by a dependency to MIGRATE → refactor (rebuild the integration first).
 * - Commoditized function → repurchase (drop-and-shop to SaaS) — the default
 *   question before an expensive refactor.
 * - CONFIRMED scaling barrier → refactor (the only R that removes an architectural
 *   ceiling). Doctrine §5: high debt ALONE does NOT justify a refactor — a rewrite
 *   without a real scaling barrier is the costliest reverse trap.
 * - High value + hard support deadline / high debt but no confirmed barrier →
 *   replatform (move, tinker — keep processes, drop the on-prem/EOL platform).
 * - INVEST / TOLERATE → retain (keep as is; refactor without a business case is the costliest trap).
 */
export function pickSixR(
  app: LegacyApp,
  decision: TimeDecision,
  dependencyOverride: boolean,
  debt: AppDebt
): SixRStrategy {
  if (decision === 'ELIMINATE') {
    // Retire either way; duplication just makes the retirement lower-risk (the
    // function is already covered elsewhere), it does not change the R.
    return 'retire';
  }
  if (decision === 'MIGRATE') {
    // A node lifted from ELIMINATE by a hidden dependency must be rebuilt, not lifted-and-shifted.
    if (dependencyOverride) return 'refactor';
    if (app.commoditized) return 'repurchase';
    // Refactor is gated by a CONFIRMED scaling barrier, not by high debt: a high
    // debtRatio with no scaling ceiling (e.g. an EOL ERP that still meets load)
    // is a Replatform — migrate and keep the processes, do not rearchitect.
    if (hasScalingBarrier(app)) return 'refactor';
    // High value, deadline-driven, high debt but no confirmed barrier: move with
    // point improvements rather than the costliest reverse trap.
    return 'replatform';
  }
  // INVEST / TOLERATE: don't rebuild working systems without a scaling case.
  return 'retain';
}

/** Full verdict for one application, applying the dependency-graph override. */
export function verdictForApp(
  app: LegacyApp,
  session: LegacySession,
  degrees: Record<string, NodeDegree>
): AppVerdict {
  const raw = rawTimeDecision(app);
  const risk = assessRisk(app, session);
  const debt = appDebt(app);
  const deg = degrees[app.id];
  const inDegree = deg?.inDegree ?? 0;

  // Dependency override: an ELIMINATE that is a critical integration node cannot
  // vanish without replacing the integration — lift it to MIGRATE.
  const dependencyOverride = raw === 'ELIMINATE' && isCriticalNode(deg);
  let decision: TimeDecision = raw;
  if (dependencyOverride) decision = 'MIGRATE';

  const sixR = pickSixR(app, decision, dependencyOverride, debt);
  const name = app.name ?? app.id;

  let rationale: Bilingual;
  if (dependencyOverride) {
    rationale = {
      pl: `${name}: sama kondycja/wartość dawała ELIMINATE, ale ${inDegree} systemów zależy od tego węzła integracyjnego — wygaszenie zablokowałoby te systemy. Podniesione do MIGRATE (Refactor): najpierw zbuduj nową integrację, potem wygaś stary węzeł.`,
      en: `${name}: value/health alone gave ELIMINATE, but ${inDegree} systems depend on this integration node — retiring it would block them. Lifted to MIGRATE (Refactor): build the new integration first, retire the old node second.`,
    };
  } else if (decision === 'MIGRATE') {
    const deadline =
      app.supportEndsInMonths !== undefined
        ? { pl: `wsparcie kończy się za ${app.supportEndsInMonths} mies. (twardy deadline)`, en: `support ends in ${app.supportEndsInMonths} months (hard deadline)` }
        : { pl: 'kondycja techniczna ogranicza potrzebną funkcję', en: 'technical health limits the needed function' };
    rationale = {
      pl: `${name}: wysoka wartość biznesowa, niska kondycja techniczna — ${deadline.pl}. Kwadrant MIGRATE, strategia ${sixR}.`,
      en: `${name}: high business value, low technical health — ${deadline.en}. MIGRATE quadrant, ${sixR} strategy.`,
    };
  } else if (decision === 'INVEST') {
    rationale = {
      pl: `${name}: wysoka wartość i przyzwoita kondycja — koń pociągowy portfela; rozwijaj (retain). Refactor bez bariery skalowania to najdroższa pułapka odwrotna.`,
      en: `${name}: high value and sound health — the portfolio workhorse; grow it (retain). A refactor without a scaling barrier is the costliest reverse trap.`,
    };
  } else if (decision === 'TOLERATE') {
    rationale = {
      pl: `${name}: działa tanio, niska wartość — TOLERATE. Nie inwestuj i nie ruszaj bez powodu; „tani" nie znaczy „zdrowy", więc pilnuj ryzyka, nie wydatku.`,
      en: `${name}: runs cheaply, low value — TOLERATE. Don't invest, don't touch without a reason; "cheap" is not "healthy", so watch the risk, not the spend.`,
    };
  } else {
    rationale = {
      pl: `${name}: niska wartość i niska kondycja${app.duplicatedElsewhere ? ', funkcja pokryta gdzie indziej' : ''}${(app.activeUsers ?? 99) < 5 ? `, ${app.activeUsers ?? 0} aktywnych użytkowników` : ''} — ELIMINATE (retire). To kierunek decyzji, nie data w kalendarzu: wygaś po planie migracji danych i sprawdzeniu zależności.`,
      en: `${name}: low value and low health${app.duplicatedElsewhere ? ', function covered elsewhere' : ''}${(app.activeUsers ?? 99) < 5 ? `, ${app.activeUsers ?? 0} active users` : ''} — ELIMINATE (retire). A direction, not a calendar date: retire after a data-migration plan and a dependency check.`,
    };
  }

  return {
    appId: app.id,
    name,
    decision,
    rawDecision: raw,
    dependencyOverride,
    sixR,
    inDegree,
    risk,
    debt,
    tcoPerYear: app.tcoPerYear ?? 0,
    rationale,
  };
}

// ---------------------------------------------------------------------------
// Portfolio scoring
// ---------------------------------------------------------------------------

export interface PortfolioScore {
  appCount: number;
  /** TCO summed across every application. */
  totalTco: number;
  /** TCO trapped in ELIMINATE + MIGRATE applications. */
  legacyTco: number;
  /** TCO trapped specifically in LOW-VALUE ELIMINATE/MIGRATE apps (the mis-allocation). */
  lowValueLegacyTco: number;
  /** legacyTco / IT budget — the tech-debt share of the IT budget, 0..1. */
  debtShareOfBudget: number;
  /** lowValueLegacyTco / IT budget — the reallocatable share, 0..1. */
  reallocatableShare: number;
  /** Portfolio-weighted debt ratio (sum remediation / sum replacement), 0..1. */
  estateDebtRatio: number;
  /** Whether debt share sits above the McKinsey 20-40% benchmark band. */
  aboveBenchmark: boolean;
  /** Count of apps per TIME decision. */
  decisionCounts: Record<TimeDecision, number>;
  /** Apps carrying ≥2 risk signals — the concentrated-risk set. */
  highRiskCount: number;
  /** Apps whose bus factor is falling year-over-year. */
  busFactorFallingCount: number;
}

/** The McKinsey tech-debt benchmark band: 20-40% of estate value / IT budget. */
export const DEBT_BENCHMARK_LOW = 0.2;
export const DEBT_BENCHMARK_HIGH = 0.4;

export function scorePortfolio(session: LegacySession): PortfolioScore {
  const degrees = computeDegrees(session);
  const verdicts = session.apps.map((a) => verdictForApp(a, session, degrees));

  const decisionCounts: Record<TimeDecision, number> = {
    TOLERATE: 0,
    INVEST: 0,
    MIGRATE: 0,
    ELIMINATE: 0,
  };
  let totalTco = 0;
  let legacyTco = 0;
  let lowValueLegacyTco = 0;
  let sumRemediation = 0;
  let sumReplacement = 0;
  let highRiskCount = 0;
  let busFactorFallingCount = 0;

  verdicts.forEach((v) => {
    const app = session.apps.find((a) => a.id === v.appId)!;
    decisionCounts[v.decision] += 1;
    totalTco += v.tcoPerYear;
    if (v.decision === 'ELIMINATE' || v.decision === 'MIGRATE') {
      legacyTco += v.tcoPerYear;
      if (!highValue(app)) lowValueLegacyTco += v.tcoPerYear;
    }
    sumRemediation += v.debt.remediationCost;
    sumReplacement += app.replacementValue ?? 0;
    if (v.risk.signalCount >= 2) highRiskCount += 1;
    if (v.risk.busFactorFalling) busFactorFallingCount += 1;
  });

  const budget = session.itBudgetPerYear ?? totalTco;
  const debtShareOfBudget = budget > 0 ? round2(legacyTco / budget) : 0;
  const reallocatableShare = budget > 0 ? round2(lowValueLegacyTco / budget) : 0;
  const estateDebtRatio = sumReplacement > 0 ? round2(sumRemediation / sumReplacement) : 0;

  return {
    appCount: session.apps.length,
    totalTco: round1(totalTco),
    legacyTco: round1(legacyTco),
    lowValueLegacyTco: round1(lowValueLegacyTco),
    debtShareOfBudget,
    reallocatableShare,
    estateDebtRatio,
    aboveBenchmark: debtShareOfBudget >= DEBT_BENCHMARK_HIGH,
    decisionCounts,
    highRiskCount,
    busFactorFallingCount,
  };
}

// ---------------------------------------------------------------------------
// Roadmap — sequenced by the dependency graph, not value priority
// ---------------------------------------------------------------------------

/**
 * What kind of roadmap action this item represents. A dependency-lifted node is
 * split into TWO items — `build-replacement` (build the new integration, early)
 * and `retire-legacy` (retire the old node, after full cut-over) — so the
 * roadmap models the doctrine's two-step retire pattern explicitly.
 */
export type RoadmapItemKind = 'standard' | 'build-replacement' | 'retire-legacy';

export interface RoadmapItem {
  order: number;
  /** Stable graph id (may be synthetic, e.g. `app::build` / `app::retire`). */
  id: string;
  appId: string;
  name: string;
  kind: RoadmapItemKind;
  decision: TimeDecision;
  sixR: SixRStrategy;
  /** Earliest wave the item can enter, bounded below by its dependencies. */
  wave: number;
  /** item ids that must complete before this item can safely start. */
  blockedBy: string[];
  /** Plain-language entry condition. */
  entryCondition: Bilingual;
  rationale: Bilingual;
}

/**
 * Priority score used to break ties WITHIN a wave (not across waves — the graph
 * governs waves). Higher = do sooner: hard deadline, concentrated risk, and
 * quick low-risk wins (ELIMINATE of unblocked low-value apps) rank up.
 */
const withinWavePriority = (v: AppVerdict, app: LegacyApp): number => {
  let p = 0;
  if ((app.supportEndsInMonths ?? 99) <= 18) p += 3;
  if (v.risk.signalCount >= 2) p += 2;
  if (v.risk.singlePointOfKnowledge) p += 1;
  if (v.decision === 'ELIMINATE' && v.inDegree === 0) p += 2; // quick win, funds the rest
  if (v.decision === 'INVEST' || v.decision === 'TOLERATE') p -= 5; // not a modernization move
  p += (app.knownCves ?? 0) * 0.1; // tie-break within a wave: more security exposure goes sooner
  return p;
};

/**
 * Build the modernization roadmap. The wave of every action item is the longest
 * dependency chain of MIGRATE/ELIMINATE work that must precede it: an app that
 * is a critical node's dependency, or a node whose replacement must land first,
 * is pushed later even if its TIME value would rank it early. This is the
 * doctrine's core: the roadmap is the dependency graph mapped onto time.
 *
 * The two-step retire pattern (a lifted MIGRATE node) is emitted explicitly:
 * "build the new integration" enters early, "retire the old node" enters after
 * everything depending on it has cut over.
 */
export function buildRoadmap(session: LegacySession): RoadmapItem[] {
  const degrees = computeDegrees(session);
  const verdicts = session.apps
    .map((a) => verdictForApp(a, session, degrees))
    .filter((v) => v.decision === 'MIGRATE' || v.decision === 'ELIMINATE');

  const verdictById = new Map(verdicts.map((v) => [v.appId, v] as const));
  const appById = new Map(session.apps.map((a) => [a.id, a] as const));

  const buildIdFor = (appId: string) => `${appId}::build`;
  const retireIdFor = (appId: string) => `${appId}::retire`;
  const isOverride = (appId: string) => verdictById.get(appId)?.dependencyOverride === true;

  // --- Plan nodes: a dependency-lifted node becomes TWO synthetic items ------
  // (build-replacement, retire-legacy) so the two-step retire pattern is
  // explicit and a surviving consumer can wait on the *build* step, not just on
  // the retirement of its consumers.
  interface PlanNode {
    id: string;
    appId: string;
    v: AppVerdict;
    kind: RoadmapItemKind;
    name: string;
    decision: TimeDecision;
    sixR: SixRStrategy;
  }

  const nodes: PlanNode[] = [];
  verdicts.forEach((v) => {
    if (v.dependencyOverride) {
      nodes.push({
        id: buildIdFor(v.appId),
        appId: v.appId,
        v,
        kind: 'build-replacement',
        name: v.name,
        decision: 'MIGRATE',
        sixR: 'refactor',
      });
      nodes.push({
        id: retireIdFor(v.appId),
        appId: v.appId,
        v,
        kind: 'retire-legacy',
        name: v.name,
        decision: 'ELIMINATE',
        sixR: 'retire',
      });
    } else {
      nodes.push({
        id: v.appId,
        appId: v.appId,
        v,
        kind: 'standard',
        name: v.name,
        decision: v.decision,
        sixR: v.sixR,
      });
    }
  });
  const nodeById = new Map(nodes.map((n) => [n.id, n] as const));

  // In-scope consumers of appId (systems that DEPEND ON it: they are `from`).
  const inScopeConsumers = (appId: string): string[] =>
    Array.from(
      new Set(
        session.dependencies
          .filter((e) => e.to === appId && e.from !== appId)
          .map((e) => e.from)
          .filter((from) => verdictById.has(from))
      )
    );

  // The node id that represents a consumer being "done / cut over".
  const doneNodeId = (appId: string): string =>
    isOverride(appId) ? retireIdFor(appId) : appId;

  // Blockers per PLAN NODE over the synthetic graph.
  const blockersFor = (node: PlanNode): string[] => {
    if (node.kind === 'build-replacement') {
      // Building the new integration is the prerequisite — nothing blocks it.
      return [];
    }
    const set = new Set<string>();
    if (node.kind === 'retire-legacy') {
      // Retire the old node only after its replacement is built AND every in-scope
      // consumer has cut over to that replacement.
      set.add(buildIdFor(node.appId));
      inScopeConsumers(node.appId).forEach((c) => set.add(doneNodeId(c)));
    } else {
      // Standard node.
      // (a) Replacement prerequisite: a SURVIVING (MIGRATE) app that depends on a
      //     lifted node must wait for that node's NEW integration — you cannot
      //     replatform onto a moving integration. A retired (ELIMINATE) app just
      //     disconnects, so it does NOT wait.
      if (node.decision === 'MIGRATE') {
        session.dependencies
          .filter((e) => e.from === node.appId && isOverride(e.to))
          .forEach((e) => set.add(buildIdFor(e.to)));
      }
      // (b) Consumer prerequisite: this node cannot be retired/rebuilt until its
      //     in-scope consumers cut over first.
      inScopeConsumers(node.appId).forEach((c) => set.add(doneNodeId(c)));
    }
    set.delete(node.id);
    return Array.from(set);
  };

  // Longest-path wave via memoized DFS over the blocking relation (acyclic
  // assumed; a cycle short-circuits to wave 0 defensively).
  const waveCache = new Map<string, number>();
  const inProgress = new Set<string>();
  const waveOf = (id: string): number => {
    if (waveCache.has(id)) return waveCache.get(id)!;
    if (inProgress.has(id)) return 0; // cycle guard
    inProgress.add(id);
    const node = nodeById.get(id);
    const blockers = node ? blockersFor(node) : [];
    const wave = blockers.length === 0 ? 0 : 1 + Math.max(...blockers.map((b) => waveOf(b)));
    inProgress.delete(id);
    waveCache.set(id, wave);
    return wave;
  };

  const nodePriority = (node: PlanNode): number => {
    // The build-replacement step is an enabler: sequence it AFTER the
    // dependency-free quick wins that share its wave (the apps that wait on it
    // already live in a later wave).
    if (node.kind === 'build-replacement') return -2;
    return withinWavePriority(node.v, appById.get(node.appId)!);
  };

  const withWave = nodes
    .map((node) => ({ node, wave: waveOf(node.id), blockers: blockersFor(node) }))
    .sort((a, b) => {
      if (a.wave !== b.wave) return a.wave - b.wave;
      return nodePriority(b.node) - nodePriority(a.node);
    });

  return withWave.map(({ node, wave, blockers }, idx) => {
    const app = appById.get(node.appId)!;
    const v = node.v;
    const blockerNames = blockers.map((b) => nodeById.get(b)?.name ?? b);

    let entryCondition: Bilingual;
    let rationale: Bilingual;

    if (node.kind === 'build-replacement') {
      entryCondition = {
        pl: 'Brak zależności blokujących — buduj zastępczą integrację od razu; to warunek wejścia dla systemów zależnych i dla wygaszenia starego węzła.',
        en: 'No blocking dependencies — build the replacement integration immediately; it is the entry condition for the dependent systems and for retiring the old node.',
      };
      rationale = {
        pl: `${v.name}: najpierw nowa warstwa integracyjna — musi powstać, zanim którykolwiek z ${v.inDegree} zależnych systemów przejdzie na zastępstwo i zanim wygaśniesz stary węzeł. Bus factor i in-degree podnoszą pilność niezależnie od budżetu.`,
        en: `${v.name}: the new integration layer first — it must exist before any of the ${v.inDegree} dependent systems cut over and before the old node is retired. Bus factor and in-degree raise urgency independent of budget.`,
      };
    } else if (node.kind === 'retire-legacy') {
      entryCondition =
        blockers.length === 0
          ? { pl: 'Brak zależności blokujących.', en: 'No blocking dependencies.' }
          : {
              pl: `Dopiero po zbudowaniu zastępstwa i pełnym cutoverze: ${blockerNames.join(', ')}.`,
              en: `Only after the replacement is built and full cut-over of: ${blockerNames.join(', ')}.`,
            };
      rationale = {
        pl: `${v.name}: wygaszenie starego węzła to druga połowa sekwencji dwuetapowej — dopiero gdy wszystkie systemy zależne działają już na nowej integracji, żeby wygaszenie nie zablokowało niczego.`,
        en: `${v.name}: retiring the old node is the second half of the two-step sequence — only once every dependent system runs on the new integration, so the retirement blocks nothing.`,
      };
    } else {
      entryCondition =
        blockers.length === 0
          ? {
              pl: 'Brak zależności blokujących — może ruszyć od razu.',
              en: 'No blocking dependencies — can start immediately.',
            }
          : {
              pl: `Wymaga wcześniejszego cutoveru: ${blockerNames.join(', ')} — nie da się wykonać, zanim ich integracja nie przejdzie na zastępstwo.`,
              en: `Requires prior cut-over of: ${blockerNames.join(', ')} — cannot execute before their integration moves to the replacement.`,
            };

      rationale =
        (app.supportEndsInMonths ?? 99) <= 18
          ? {
              pl: `${v.name}: twardy deadline (${app.supportEndsInMonths} mies. do końca wsparcia) determinuje falę — priorytet wynika z faktu, nie z ogólnego „kiedyś".${blockers.length ? ' Mimo deadline’u czeka na warunek wejścia powyżej — nie migruje się na ruchomej integracji.' : ''}`,
              en: `${v.name}: a hard deadline (${app.supportEndsInMonths} months to support end) sets the wave — priority from fact, not a general "someday".${blockers.length ? ' Despite the deadline it waits on the entry condition above — you do not migrate onto a moving integration.' : ''}`,
            }
          : v.decision === 'ELIMINATE' && v.inDegree === 0
            ? {
                pl: `${v.name}: wygaszenie bez zależności — najniższe ryzyko, najszybszy zwrot; quick win, który finansuje część większej migracji.`,
                en: `${v.name}: dependency-free retirement — lowest risk, fastest return; a quick win that funds part of a larger migration.`,
              }
            : v.rationale;
    }

    return {
      order: idx + 1,
      id: node.id,
      appId: node.appId,
      name: node.name,
      kind: node.kind,
      decision: node.decision,
      sixR: node.sixR,
      wave,
      blockedBy: blockers,
      entryCondition,
      rationale,
    };
  });
}

// ---------------------------------------------------------------------------
// One-shot synthesis
// ---------------------------------------------------------------------------

/**
 * One-shot synthesis: per-app verdicts + portfolio score + graph-sequenced
 * roadmap, ready for the UI or the AI fallback. Pure and deterministic.
 */
export function synthesizeLegacyPlan(session: LegacySession): {
  verdicts: AppVerdict[];
  score: PortfolioScore;
  roadmap: RoadmapItem[];
} {
  const degrees = computeDegrees(session);
  return {
    verdicts: session.apps.map((a) => verdictForApp(a, session, degrees)),
    score: scorePortfolio(session),
    roadmap: buildRoadmap(session),
  };
}

/** Flatten a roadmap item into a localized, store-agnostic summary. */
export function localizeRoadmapItem(
  item: RoadmapItem,
  isPolish: boolean
): { title: string; rationale: string; decision: TimeDecision; sixR: SixRStrategy } {
  return {
    title: `${item.order}. ${item.name} — ${item.decision}/${item.sixR}`,
    rationale: `${localize(item.rationale, isPolish)} ${localize(item.entryCondition, isPolish)}`.trim(),
    decision: item.decision,
    sixR: item.sixR,
  };
}

/** Localize a dimension label (re-exported convenience for callers). */
export const dimensionLabel = (dimension: LegacyDimensionId, isPolish: boolean): string =>
  localize(legacyDimensionLabel(dimension), isPolish);
