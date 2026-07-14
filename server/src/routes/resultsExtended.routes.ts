/**
 * M15/W3-W6 — extended analytical routes.
 *
 * Mounts all remaining analytical endpoints beyond the core value-intelligence:
 *   GET /:projectId/signals        — M15→M14 manager signals (task 3.2)
 *   GET /:projectId/run-rate       — run-rate vs in-year timing (task 4.3)
 *   GET /:projectId/reallocation   — resource reallocation recs (task 3.3)
 *   GET /:projectId/adoption       — adoption→benefit risk flags (tasks 5.5-5.6)
 *   GET /:projectId/sustainment    — sustainment status + governance calendar (tasks 5.7-5.8)
 *   GET /:projectId/scenarios      — scenario comparison + IRR (task 6.5)
 *   GET /:projectId/counterfactual — counterfactual attribution (task 6.8)
 *   GET /:projectId/finance-link   — KPI→P&L/BS/CF bridge (task 6.6)
 *   GET /:projectId/benefit-profiles — enriched KPI profiles (task 1.2)
 *   GET /:projectId/narrative      — value narrative (task 6.3)
 *
 * All endpoints: verifyToken + orgWide + bare JSON response.
 */
import { type Response, Router } from 'express';

import verifyToken from '../middleware/auth.middleware.js';
import {
  adoptionToBenefitRisk,
  type BenefitAdoptionItem,
  diceScore,
  flagBenefitAtRiskByAdoption,
  type SentimentTrend,
} from '../services/results/adoptionBenefitRiskService.js';
import {
  benefitProfileSummary,
  buildBenefitProfiles,
  type RawKpiInput,
} from '../services/results/benefitProfileService.js';
import {
  buildGovernanceCalendar,
  type SustainmentInput,
  sustainmentStatus,
} from '../services/results/benefitSustainmentService.js';
import {
  type BenefitInput,
  buildBenefitSignals,
  signalsSummary,
} from '../services/results/benefitToManagerSignalService.js';
import {
  attributableDelta,
  type AttributableDeltaInput,
  confidenceLabel,
  type TimePoint,
} from '../services/results/counterfactualBaselineService.js';
import {
  aggregateKpiFinancialImpact,
  financialImpactByStatement,
  type KpiFinanceMapping,
} from '../services/results/financeLinkService.js';
import {
  runRateBridge,
  type RunRateBridgeInput,
  type ValueTimingItem,
  valueTimingSplit,
} from '../services/results/runRateService.js';
import {
  irr as calcIrr,
  paybackPeriod,
  runScenarios,
  type ScenarioInput,
  type ScenarioSpec,
  sensitivity,
  type SensitivityInput,
} from '../services/results/scenarioSensitivityService.js';
import {
  buildFunnel,
  funnelConversion,
  type FunnelItem,
  mapInitiativeToFunnel,
  valueAtRisk,
} from '../services/results/valueFunnelService.js';
import {
  buildNarrative,
  executiveSummary,
  type NarrativeBenefit,
  type ValueNarrativeInput,
} from '../services/results/valueNarrativeService.js';
import {
  type ReallocationItem,
  reallocationSummary,
  recommendReallocation,
} from '../services/results/valueReallocationService.js';
import {
  portfolioValueSplit,
  STAGE_DEFAULT_CONFIDENCE,
  stageFromInitiative,
} from '../services/results/valueStageGateService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll } from '../utils/DbPromise.js';

interface AuthedRequest {
  user?: { organizationId?: string };
  params: Record<string, string>;
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const router = Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fetchOrgInitiatives(orgId: string, projectId: string) {
  const orgWide =
    !projectId || projectId === 'all' || projectId === 'null' || projectId === 'undefined';
  return (
    ((await dbAll(
      orgWide
        ? `SELECT id, name, status FROM initiatives WHERE organization_id = ?`
        : `SELECT id, name, status FROM initiatives WHERE project_id = ? AND organization_id = ?`,
      orgWide ? [orgId] : [projectId, orgId]
    )) as Array<{ id: string; name: string; status: string | null }>) || []
  );
}

async function fetchRoiRealized(orgId: string) {
  return (
    ((await dbAll(
      `SELECT initiative_id, realized_revenue_delta, realized_cost_delta, realized_savings
     FROM roi_realized_values WHERE organization_id = ?`,
      [orgId]
    )) as Array<{
      initiative_id: string;
      realized_revenue_delta: number | null;
      realized_cost_delta: number | null;
      realized_savings: number | null;
    }>) || []
  );
}

async function fetchRoiAssumptions(orgId: string) {
  return (
    ((await dbAll(
      `SELECT initiative_id, expected_npv, expected_revenue_delta, expected_cost_delta, effect_start_date
     FROM roi_assumptions WHERE organization_id = ?`,
      [orgId]
    )) as Array<{
      initiative_id: string;
      expected_npv: number | null;
      expected_revenue_delta: number | null;
      expected_cost_delta: number | null;
      effect_start_date: string | null;
    }>) || []
  );
}

/**
 * D7: derive the measurement window (months) from the EARLIEST effect_start_date
 * across assumptions, instead of a hardcoded 6. Falls back to `fallback` (and
 * flags `assumed: true`) when no usable start date exists.
 */
function derivePeriodMonths(
  assumptions: Array<{ effect_start_date: string | null }>,
  nowMs: number,
  fallback = 6
): { periodMonths: number; assumed: boolean } {
  let earliest = Number.POSITIVE_INFINITY;
  for (const a of assumptions) {
    if (!a.effect_start_date) continue;
    const ms = Date.parse(a.effect_start_date);
    if (Number.isFinite(ms) && ms < earliest) earliest = ms;
  }
  if (!Number.isFinite(earliest) || earliest > nowMs) {
    return { periodMonths: fallback, assumed: true };
  }
  const months = Math.max(1, Math.round((nowMs - earliest) / (30 * 24 * 60 * 60 * 1000)));
  return { periodMonths: months, assumed: false };
}

// ─── GET /signals ─────────────────────────────────────────────────────────

router.get(
  '/:projectId/signals',
  verifyToken,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'org required' });
      return;
    }

    const [initiatives, realized, assumptions] = await Promise.all([
      fetchOrgInitiatives(orgId, req.params.projectId),
      fetchRoiRealized(orgId),
      fetchRoiAssumptions(orgId),
    ]);

    const realizedByInit = new Map<string, number>();
    for (const r of realized) {
      const v =
        num(r.realized_revenue_delta) - num(r.realized_cost_delta) + num(r.realized_savings);
      realizedByInit.set(
        String(r.initiative_id),
        (realizedByInit.get(String(r.initiative_id)) || 0) + v
      );
    }
    const assumptionByInit = new Map(assumptions.map((a) => [String(a.initiative_id), a]));

    const items: BenefitInput[] = initiatives.map((i) => {
      const a = assumptionByInit.get(String(i.id));
      const valueAtStake =
        a?.expected_npv != null
          ? num(a.expected_npv)
          : num(a?.expected_revenue_delta) - num(a?.expected_cost_delta);
      const realizedValue = realizedByInit.get(String(i.id)) || 0;
      const hasRoiBaseline = !!a;
      const hasRealized = realizedValue !== 0;
      const stage = stageFromInitiative({
        status: i.status ?? undefined,
        hasRoiBaseline,
        hasRealized,
      });
      const confidence = STAGE_DEFAULT_CONFIDENCE[stage];
      const realizationPct = valueAtStake > 0 ? realizedValue / valueAtStake : 0;
      return { initiativeId: String(i.id), name: i.name, realizationPct, confidence, valueAtStake };
    });

    const signals = buildBenefitSignals(items);
    const summary = signalsSummary(signals);
    res.json({ signals, summary });
  })
);

// ─── GET /run-rate ─────────────────────────────────────────────────────────

router.get(
  '/:projectId/run-rate',
  verifyToken,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'org required' });
      return;
    }

    const [realized, assumptions] = await Promise.all([
      fetchRoiRealized(orgId),
      fetchRoiAssumptions(orgId),
    ]);

    const assumptionByInit = new Map(assumptions.map((a) => [String(a.initiative_id), a]));
    const realizedByInit = new Map<string, number>();
    for (const r of realized) {
      const v =
        num(r.realized_revenue_delta) - num(r.realized_cost_delta) + num(r.realized_savings);
      realizedByInit.set(
        String(r.initiative_id),
        (realizedByInit.get(String(r.initiative_id)) || 0) + v
      );
    }

    const totalRealized = Array.from(realizedByInit.values()).reduce((s, v) => s + v, 0);
    // D7: real measurement window from earliest effect_start_date (was hardcoded 6).
    const now = new Date();
    const { periodMonths, assumed: periodMonthsAssumed } = derivePeriodMonths(
      assumptions,
      now.getTime()
    );
    const remainingMonthsInYear = 12 - now.getMonth();

    const bridgeInput: RunRateBridgeInput = {
      realizedToDate: totalRealized,
      periodMonths,
      remainingMonthsInYear,
    };
    const bridge = runRateBridge(bridgeInput);

    const timingItems: ValueTimingItem[] = assumptions.map((a) => {
      const id = String(a.initiative_id);
      const expectedValue =
        a.expected_npv != null
          ? num(a.expected_npv)
          : num(a.expected_revenue_delta) - num(a.expected_cost_delta);
      const realizedValue = realizedByInit.get(id) || 0;
      return {
        id,
        targetValue: expectedValue,
        realizedToDate: realizedValue,
        periodMonths,
        remainingMonthsInYear,
        fullYearRunRate:
          realizedValue > 0 && periodMonths > 0 ? (realizedValue / periodMonths) * 12 : 0,
      };
    });

    const timingSplit = valueTimingSplit(timingItems);
    const aheadOfPlanCount = timingItems.filter((item) => {
      const t = item as any;
      const expectedByNow = (t.targetValue || 0) * (periodMonths / 12);
      return expectedByNow > 0 && (t.realizedToDate || 0) >= expectedByNow;
    }).length;
    const behindPlanCount = timingItems.filter((item) => {
      const t = item as any;
      const expectedByNow = (t.targetValue || 0) * (periodMonths / 12);
      return expectedByNow > 0 && (t.realizedToDate || 0) < expectedByNow * 0.8;
    }).length;
    const timing = { ...timingSplit, aheadOfPlanCount, behindPlanCount };
    const bridgeWithAliases = {
      ...bridge,
      annualizedRunRate: bridge.runRate,
      projectedFullYear: bridge.projectedInYear,
      remainingRunRateContribution: bridge.projectedInYear - bridge.alreadyRealized,
    };
    res.json({ bridge: bridgeWithAliases, timing, periodMonths, periodMonthsAssumed });
  })
);

// ─── GET /reallocation ────────────────────────────────────────────────────

router.get(
  '/:projectId/reallocation',
  verifyToken,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'org required' });
      return;
    }

    const [initiatives, realized, assumptions] = await Promise.all([
      fetchOrgInitiatives(orgId, req.params.projectId),
      fetchRoiRealized(orgId),
      fetchRoiAssumptions(orgId),
    ]);

    // D8: real FTE capacity from initiative_resources (sum allocation_percentage/100),
    // fallback to 1.0 when no staffing rows exist (flagged via capacityAssumed).
    let capacityRows: Array<{ initiative_id: string; allocation_percentage: number | null }> = [];
    try {
      capacityRows =
        ((await dbAll(
          `SELECT initiative_id, allocation_percentage FROM initiative_resources WHERE organization_id = ?`,
          [orgId]
        )) as Array<{ initiative_id: string; allocation_percentage: number | null }>) || [];
    } catch {
      /* table absent */
    }
    const fteByInit = new Map<string, number>();
    for (const r of capacityRows) {
      fteByInit.set(
        String(r.initiative_id),
        (fteByInit.get(String(r.initiative_id)) || 0) + num(r.allocation_percentage) / 100
      );
    }
    const capacityAssumed = capacityRows.length === 0;

    const assumptionByInit = new Map(assumptions.map((a) => [String(a.initiative_id), a]));
    const realizedByInit = new Map<string, number>();
    for (const r of realized) {
      const v =
        num(r.realized_revenue_delta) - num(r.realized_cost_delta) + num(r.realized_savings);
      realizedByInit.set(
        String(r.initiative_id),
        (realizedByInit.get(String(r.initiative_id)) || 0) + v
      );
    }

    const items: ReallocationItem[] = initiatives.map((i) => {
      const a = assumptionByInit.get(String(i.id));
      const valueAtStake =
        a?.expected_npv != null
          ? num(a.expected_npv)
          : num(a?.expected_revenue_delta) - num(a?.expected_cost_delta);
      const realizedValue = realizedByInit.get(String(i.id)) || 0;
      const hasRoiBaseline = !!a;
      const hasRealized = realizedValue !== 0;
      const stage = stageFromInitiative({
        status: i.status ?? undefined,
        hasRoiBaseline,
        hasRealized,
      });
      const confidence = STAGE_DEFAULT_CONFIDENCE[stage];
      const realizationPct = valueAtStake > 0 ? (realizedValue / valueAtStake) * 100 : 0;
      return {
        id: String(i.id),
        name: i.name,
        realizationPct,
        confidence,
        valueAtStake,
        capacityFte: fteByInit.get(String(i.id)) ?? 1, // D8: real FTE; 1.0 when unstaffed
      };
    });

    const moves = recommendReallocation(items);
    const summary = reallocationSummary(moves);
    const movesArr = Array.isArray(moves) ? (moves as any[]) : [];
    const totalAmount = movesArr.reduce(
      (s: number, m: any) => s + (m.valueAtStake ?? (m.fteSuggested ?? 0) * 50_000),
      0
    );
    res.json({ moves, summary: { ...summary, totalAmount }, capacityAssumed });
  })
);

// ─── GET /adoption ────────────────────────────────────────────────────────

router.get(
  '/:projectId/adoption',
  verifyToken,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'org required' });
      return;
    }

    const [initiatives, realized] = await Promise.all([
      fetchOrgInitiatives(orgId, req.params.projectId),
      fetchRoiRealized(orgId),
    ]);

    const realizedByInit = new Map<string, number>();
    for (const r of realized) {
      const v =
        num(r.realized_revenue_delta) - num(r.realized_cost_delta) + num(r.realized_savings);
      realizedByInit.set(
        String(r.initiative_id),
        (realizedByInit.get(String(r.initiative_id)) || 0) + v
      );
    }

    // D4: REAL adoption signals from M14 change-management tables (was a hardcoded
    // realized/1000 proxy). Sentiment → adoptionScore + trend; champions → coverage.
    // Tables may be empty for an org → graceful fallback to the realization proxy,
    // flagged via `dataSource` so the UI can be honest about it.
    type SentRow = { initiative_id: string; avg_rating: number | null; trend: string | null };
    type ChampRow = { initiative_id: string; status: string | null };
    let sentiment: SentRow[] = [];
    let champions: ChampRow[] = [];
    try {
      sentiment =
        ((await dbAll(
          `SELECT DISTINCT ON (initiative_id) initiative_id, avg_rating, trend
         FROM change_sentiment_snapshots WHERE organization_id = ?
         ORDER BY initiative_id, period_end DESC`,
          [orgId]
        )) as SentRow[]) || [];
    } catch {
      /* table absent */
    }
    try {
      champions =
        ((await dbAll(
          `SELECT initiative_id, status FROM change_champions WHERE organization_id = ?`,
          [orgId]
        )) as ChampRow[]) || [];
    } catch {
      /* table absent */
    }

    const sentByInit = new Map(sentiment.map((s) => [String(s.initiative_id), s]));
    const champCountByInit = new Map<string, number>();
    for (const c of champions) {
      if ((c.status ?? 'active') === 'active') {
        champCountByInit.set(
          String(c.initiative_id),
          (champCountByInit.get(String(c.initiative_id)) || 0) + 1
        );
      }
    }
    const hasRealAdoption = sentiment.length > 0 || champions.length > 0;

    const normTrend = (t: string | null | undefined): SentimentTrend | undefined => {
      const v = (t ?? '').toLowerCase();
      if (v === 'improving' || v === 'up' || v === 'positive') return 'improving';
      if (v === 'declining' || v === 'down' || v === 'negative') return 'declining';
      if (v === 'flat' || v === 'stable' || v === 'neutral') return 'flat';
      return undefined;
    };

    const items = initiatives.map((i) => {
      const id = String(i.id);
      const s = sentByInit.get(id);
      // avg_rating assumed 1–5 → normalise to [0,1]; fallback to realization proxy.
      const realized2 = realizedByInit.get(id) || 0;
      const adoptionFromSentiment =
        s?.avg_rating != null
          ? Math.min(Math.max((Number(s.avg_rating) - 1) / 4, 0), 1)
          : undefined;
      const adoptionScore =
        adoptionFromSentiment ?? (realized2 > 0 ? Math.min(realized2 / 1000, 1) : 0.3);
      const sentimentTrend = normTrend(s?.trend);
      const champCoveragePct = champCountByInit.has(id)
        ? Math.min(champCountByInit.get(id)! * 25, 100)
        : 0;

      // DICE per initiative from available change signals (neutral 2 where unknown).
      const dice = diceScore({
        seniorCommitment: adoptionScore >= 0.7 ? 1 : adoptionScore >= 0.4 ? 2 : 3,
        localCommitment: champCoveragePct >= 50 ? 1 : champCoveragePct >= 25 ? 2 : 3,
      });
      const risk = adoptionToBenefitRisk({
        adoptionScore,
        sentimentTrend,
        championCoveragePct: champCoveragePct,
      });
      return {
        id,
        name: i.name,
        adoptionScore,
        diceScore: dice.score,
        diceZone: dice.zone,
        sentimentTrend: sentimentTrend ?? null,
        championCoveragePct: champCoveragePct,
        risk: risk.risk,
        riskReasons: risk.reasons,
      };
    });

    const adoptionItems: BenefitAdoptionItem[] = items.map((it) => ({
      id: it.id,
      name: it.name,
      adoptionScore: it.adoptionScore,
      diceZone: it.diceZone,
    }));
    const rawFlags = flagBenefitAtRiskByAdoption(adoptionItems);
    const flagById = new Map(
      (rawFlags as any[]).map((f) => [
        String(f.id),
        { ...f, atRisk: f.atRisk ?? f.atRiskByAdoption ?? false },
      ])
    );
    const flags = items.map((it) => ({ ...it, ...flagById.get(it.id) }));
    const atRiskCount = flags.filter((f: any) => f.atRiskByAdoption || f.atRisk).length;
    res.json({
      flags,
      total: initiatives.length,
      atRiskCount,
      dataSource: hasRealAdoption ? 'change-management' : 'realization-proxy',
    });
  })
);

// ─── GET /sustainment ─────────────────────────────────────────────────────

router.get(
  '/:projectId/sustainment',
  verifyToken,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'org required' });
      return;
    }

    // D1: read REAL sustainment signals from DB (was a stub hardcoding
    // realizationPct:0 + lastReviewIso:null → only 'unowned'/'overdue' reachable).
    //  - ownershipTransferred = owner_business_id set (benefit handed to business)
    //  - lastReviewIso        = updated_at (proxy for last governance touch)
    //  - realizationPct       = realized / expected (from ROI, like /signals)
    //  - cadence              = quarterly (no per-initiative cadence column yet)
    const orgWide =
      !req.params.projectId ||
      req.params.projectId === 'all' ||
      req.params.projectId === 'null' ||
      req.params.projectId === 'undefined';
    const initiatives =
      ((await dbAll(
        orgWide
          ? `SELECT id, name, status, owner_business_id, updated_at
           FROM initiatives WHERE organization_id = ?`
          : `SELECT id, name, status, owner_business_id, updated_at
           FROM initiatives WHERE project_id = ? AND organization_id = ?`,
        orgWide ? [orgId] : [req.params.projectId, orgId]
      )) as Array<{
        id: string;
        name: string;
        status: string | null;
        owner_business_id: string | null;
        updated_at: string | null;
      }>) || [];

    const [realized, assumptions] = await Promise.all([
      fetchRoiRealized(orgId),
      fetchRoiAssumptions(orgId),
    ]);
    const realizedByInit = new Map<string, number>();
    for (const r of realized) {
      const v =
        num(r.realized_revenue_delta) - num(r.realized_cost_delta) + num(r.realized_savings);
      realizedByInit.set(
        String(r.initiative_id),
        (realizedByInit.get(String(r.initiative_id)) || 0) + v
      );
    }
    const assumptionByInit = new Map(assumptions.map((a) => [String(a.initiative_id), a]));

    function realizationFor(initId: string): number | undefined {
      const a = assumptionByInit.get(initId);
      if (!a) return undefined;
      const valueAtStake =
        a.expected_npv != null
          ? num(a.expected_npv)
          : num(a.expected_revenue_delta) - num(a.expected_cost_delta);
      if (valueAtStake <= 0) return undefined;
      return (realizedByInit.get(initId) || 0) / valueAtStake;
    }

    const toIso = (v: string | null): string | null => {
      if (!v) return null;
      const ms = Date.parse(v);
      return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
    };

    const nowMs = Date.now();
    const statuses = initiatives.map((i) => {
      const input: SustainmentInput = {
        ownershipTransferred: i.owner_business_id != null,
        lastReviewIso: toIso(i.updated_at),
        cadence: 'quarterly',
        realizationPct: realizationFor(String(i.id)),
      };
      return { id: String(i.id), name: i.name, ...sustainmentStatus(input, nowMs) };
    });

    const calendar = buildGovernanceCalendar(
      initiatives.map((i) => ({
        id: String(i.id),
        name: i.name,
        cadence: 'quarterly' as const,
        lastReviewIso: toIso(i.updated_at),
      })),
      nowMs
    );

    const summary = {
      total: statuses.length,
      sustained: statuses.filter((s) => s.status === 'sustained').length,
      atRisk: statuses.filter((s) => s.status === 'at-risk').length,
      overdueReview: statuses.filter((s) => s.status === 'overdue-review').length,
      unowned: statuses.filter((s) => s.status === 'unowned').length,
    };

    res.json({ statuses, calendar, summary });
  })
);

// ─── GET /scenarios ───────────────────────────────────────────────────────

router.get(
  '/:projectId/scenarios',
  verifyToken,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'org required' });
      return;
    }

    const assumptions = await fetchRoiAssumptions(orgId);

    // Aggregate cashflows from roi_assumptions for a combined view
    const totalExpectedAnnual = assumptions.reduce((sum, a) => {
      const v =
        a.expected_npv != null
          ? num(a.expected_npv)
          : num(a.expected_revenue_delta) - num(a.expected_cost_delta);
      return sum + v;
    }, 0);

    const baseInvestment = totalExpectedAnnual * 0.3; // 30% investment assumption
    const baseCashflows = [
      -baseInvestment,
      totalExpectedAnnual * 0.4,
      totalExpectedAnnual * 0.6,
      totalExpectedAnnual,
    ];

    const base: ScenarioInput = { cashflows: baseCashflows };
    const specs: ScenarioSpec[] = [
      { label: 'Pesymistyczny', multiplier: 0.7 },
      { label: 'Bazowy', multiplier: 1 },
      { label: 'Optymistyczny', multiplier: 1.3 },
    ];

    const results = runScenarios(base, specs);
    const baseIrr = calcIrr(baseCashflows);
    const payback = paybackPeriod(baseCashflows);

    const sensitivityInput: SensitivityInput = { cashflows: baseCashflows, rate: 0.1 };
    const sensitivityResults = sensitivity(sensitivityInput, [-0.3, -0.15, 0, 0.15, 0.3]);

    const SCENARIO_NAMES = ['Pesymistyczny', 'Bazowy', 'Optymistyczny'];
    const scenariosWithName = results.map((sc: any, i: number) => ({
      ...sc,
      name: sc.name ?? sc.label ?? SCENARIO_NAMES[i] ?? `Scenariusz ${i + 1}`,
    }));
    res.json({
      scenarios: scenariosWithName,
      irr: baseIrr,
      paybackPeriod: payback,
      sensitivity: sensitivityResults,
      initiativeCount: assumptions.length,
    });
  })
);

// ─── GET /counterfactual ─────────────────────────────────────────────────

router.get(
  '/:projectId/counterfactual',
  verifyToken,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'org required' });
      return;
    }

    const [realized, assumptions] = await Promise.all([
      fetchRoiRealized(orgId),
      fetchRoiAssumptions(orgId),
    ]);

    const totalTarget = assumptions.reduce((s, a) => {
      return (
        s +
        (a.expected_npv != null
          ? num(a.expected_npv)
          : num(a.expected_revenue_delta) - num(a.expected_cost_delta))
      );
    }, 0);

    const totalRealized = realized.reduce((s, r) => {
      return (
        s + num(r.realized_revenue_delta) - num(r.realized_cost_delta) + num(r.realized_savings)
      );
    }, 0);

    // Build synthetic time series for attribution (12 months)
    const prePoints: TimePoint[] = Array.from({ length: 12 }, (_, i) => ({
      t: i + 1,
      value: totalTarget * 0.04 * (i + 1), // linear trend without initiative
    }));

    const input: AttributableDeltaInput = {
      observedValue: totalRealized,
      prePoints,
      atT: 13,
    };

    const result = attributableDelta(input);
    const label = confidenceLabel(prePoints);

    res.json({
      attributable: result.attributable,
      attributablePct: result.attributablePct,
      counterfactualProjected: result.counterfactual,
      confidenceLabel: label,
      totalTarget,
      totalRealized,
    });
  })
);

// ─── GET /finance-link ────────────────────────────────────────────────────

router.get(
  '/:projectId/finance-link',
  verifyToken,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'org required' });
      return;
    }

    // Schema: kpi_financial_mappings(kpi_id, statement_line_id, multiplier, direction, ...).
    // There is no annual_impact column — the financial impact is computed from the KPI's
    // own delta (current − baseline) × multiplier × sign(direction). JOIN the KPI to read it.
    let financialMappings: KpiFinanceMapping[] = [];
    try {
      const rows =
        ((await dbAll(
          `SELECT m.kpi_id, m.statement_line_id, m.multiplier, m.direction,
                k.current_value, k.baseline_value
         FROM kpi_financial_mappings m
         LEFT JOIN initiative_kpis k ON k.id = m.kpi_id
         WHERE m.organization_id = ?`,
          [orgId]
        )) as Array<{
          kpi_id: string;
          statement_line_id: string | null;
          multiplier: number | null;
          direction: string | null;
          current_value: number | null;
          baseline_value: number | null;
        }>) || [];
      financialMappings = rows.map((r) => {
        const delta = num(r.current_value) - num(r.baseline_value);
        const dir = (r.direction || 'positive').toLowerCase();
        const direction =
          dir === 'negative' ? 'negative' : dir === 'neutral' ? 'neutral' : 'positive';
        return {
          kpiId: String(r.kpi_id),
          statementLineId: r.statement_line_id
            ? String(r.statement_line_id)
            : String(r.kpi_id) + '_line',
          statementType: 'P&L' as any,
          multiplier: r.multiplier ?? 1,
          direction: direction as any,
          kpiDelta: delta,
        };
      });
    } catch {
      // table may not exist
    }

    if (financialMappings.length === 0) {
      res.json({
        aggregate: { totalPositiveImpact: 0, totalNegativeImpact: 0, netImpact: 0 },
        byStatement: {},
        bridge: [],
        mappingCount: 0,
      });
      return;
    }

    const statementImpacts = aggregateKpiFinancialImpact(financialMappings);
    const byStatement = financialImpactByStatement(statementImpacts);
    const totalPositiveImpact = statementImpacts.reduce(
      (s, si) => s + Math.max(si.totalImpact, 0),
      0
    );
    const totalNegativeImpact = statementImpacts.reduce(
      (s, si) => s + Math.min(si.totalImpact, 0),
      0
    );
    const aggregate = {
      totalPositiveImpact,
      totalNegativeImpact,
      netImpact: totalPositiveImpact + totalNegativeImpact,
    };
    res.json({
      aggregate,
      byStatement,
      bridge: statementImpacts.slice(0, 10),
      mappingCount: financialMappings.length,
    });
  })
);

// ─── GET /benefit-profiles ────────────────────────────────────────────────

router.get(
  '/:projectId/benefit-profiles',
  verifyToken,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'org required' });
      return;
    }

    // NB: schema column is owner_user_id (a UUID), not owner_name. Selecting a
    // non-existent column throws and dbAll swallows it → empty profiles. Read the
    // real columns; businessOwner stays null until a users JOIN is added.
    const kpiRows =
      ((await dbAll(
        `SELECT id, name, unit, target_value, current_value, measurement_frequency
       FROM initiative_kpis WHERE organization_id = ?`,
        [orgId]
      )) as RawKpiInput[]) || [];

    const profiles = buildBenefitProfiles(kpiRows);
    const summary = benefitProfileSummary(profiles);
    res.json({ profiles, summary });
  })
);

// ─── GET /narrative ───────────────────────────────────────────────────────

router.get(
  '/:projectId/narrative',
  verifyToken,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'org required' });
      return;
    }

    const [initiatives, realized, assumptions] = await Promise.all([
      fetchOrgInitiatives(orgId, req.params.projectId),
      fetchRoiRealized(orgId),
      fetchRoiAssumptions(orgId),
    ]);

    const assumptionByInit = new Map(assumptions.map((a) => [String(a.initiative_id), a]));
    const realizedByInit = new Map<string, number>();
    for (const r of realized) {
      const v =
        num(r.realized_revenue_delta) - num(r.realized_cost_delta) + num(r.realized_savings);
      realizedByInit.set(
        String(r.initiative_id),
        (realizedByInit.get(String(r.initiative_id)) || 0) + v
      );
    }

    const initData = initiatives.slice(0, 10).map((i) => {
      const a = assumptionByInit.get(String(i.id));
      const targetValue =
        a?.expected_npv != null
          ? num(a.expected_npv)
          : num(a?.expected_revenue_delta) - num(a?.expected_cost_delta);
      const realizedValue = realizedByInit.get(String(i.id)) || 0;
      const isOnTrack = targetValue > 0 ? realizedValue / targetValue >= 0.5 : true;
      return { name: i.name, targetValue, realizedValue, isOnTrack };
    });

    const atRiskCount = initiatives.filter((i) => {
      const a = assumptionByInit.get(String(i.id));
      const vs =
        a?.expected_npv != null
          ? num(a.expected_npv)
          : num(a?.expected_revenue_delta) - num(a?.expected_cost_delta);
      const rv = realizedByInit.get(String(i.id)) || 0;
      return vs > 0 && rv / vs < 0.5;
    }).length;

    const banked = initData.reduce((s, b) => s + b.realizedValue, 0);
    const totalTarget = initData.reduce((s, b) => s + b.targetValue, 0);
    const inFlight = Math.max(totalTarget - banked, 0);
    const atRisk = initData.filter((b) => !b.isOnTrack).reduce((s, b) => s + b.targetValue, 0);

    const topBenefits: NarrativeBenefit[] = initData
      .filter((b) => b.isOnTrack)
      .slice(0, 3)
      .map((b) => ({ name: b.name, realizedValue: b.realizedValue }));

    const input: ValueNarrativeInput = {
      banked,
      inFlight,
      atRisk,
      totalTarget,
      pctOfTarget: totalTarget > 0 ? banked / totalTarget : 0,
      topBenefits,
    };

    const narrative = buildNarrative(input);
    const summary = executiveSummary(input);
    res.json({ narrative, executiveSummary: summary });
  })
);

// ─── GET /funnel ──────────────────────────────────────────────────────────
// D6: Value Funnel — portfolio value through stages (ideas→validated→inflight→
// realized): count + value + risk-adjusted value per stage, conversion/leakage,
// value-at-risk. Was an unimplemented 404; now backed by valueFunnelService.
router.get(
  '/:projectId/funnel',
  verifyToken,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'org required' });
      return;
    }

    const [initiatives, realized, assumptions] = await Promise.all([
      fetchOrgInitiatives(orgId, req.params.projectId),
      fetchRoiRealized(orgId),
      fetchRoiAssumptions(orgId),
    ]);
    const assumptionByInit = new Map(assumptions.map((a) => [String(a.initiative_id), a]));
    const realizedByInit = new Map<string, number>();
    for (const r of realized) {
      const v =
        num(r.realized_revenue_delta) - num(r.realized_cost_delta) + num(r.realized_savings);
      realizedByInit.set(
        String(r.initiative_id),
        (realizedByInit.get(String(r.initiative_id)) || 0) + v
      );
    }

    const items: FunnelItem[] = initiatives.map((i) => {
      const a = assumptionByInit.get(String(i.id));
      const stage = mapInitiativeToFunnel(i.status ?? undefined);
      const expected =
        a?.expected_npv != null
          ? num(a.expected_npv)
          : num(a?.expected_revenue_delta) - num(a?.expected_cost_delta);
      // Realized stage carries banked value; earlier stages carry expected value.
      const value = stage === 'realized' ? realizedByInit.get(String(i.id)) || expected : expected;
      const hasRoi = !!a;
      const hasRealized = (realizedByInit.get(String(i.id)) || 0) !== 0;
      const confidence =
        STAGE_DEFAULT_CONFIDENCE[
          stageFromInitiative({
            status: i.status ?? undefined,
            hasRoiBaseline: hasRoi,
            hasRealized,
          })
        ];
      return { funnelStage: stage, value: Math.max(value, 0), confidence };
    });

    const stages = buildFunnel(items);
    const conversion = funnelConversion(stages);
    const var_ = valueAtRisk(
      items.map((it) => ({
        value: it.value,
        confidence: it.confidence,
        behindPlan: (it.confidence ?? 1) < 0.5,
      }))
    );
    res.json({ stages, conversion, valueAtRisk: var_, total: initiatives.length });
  })
);

export default router;
