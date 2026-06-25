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
import { Router, type Response } from 'express';

import verifyToken from '../middleware/auth.middleware.js';
import {
  buildBenefitSignals,
  signalsSummary,
  type BenefitInput,
} from '../services/results/benefitToManagerSignalService.js';
import {
  buildBenefitProfiles,
  benefitProfileSummary,
  type RawKpiInput,
} from '../services/results/benefitProfileService.js';
import {
  flagBenefitAtRiskByAdoption,
  type BenefitAdoptionItem,
} from '../services/results/adoptionBenefitRiskService.js';
import {
  sustainmentStatus,
  buildGovernanceCalendar,
  type SustainmentInput,
} from '../services/results/benefitSustainmentService.js';
import {
  runRateBridge,
  valueTimingSplit,
  type RunRateBridgeInput,
  type ValueTimingItem,
} from '../services/results/runRateService.js';
import {
  recommendReallocation,
  reallocationSummary,
  type ReallocationItem,
} from '../services/results/valueReallocationService.js';
import {
  runScenarios,
  irr as calcIrr,
  paybackPeriod,
  sensitivity,
  type ScenarioInput,
  type ScenarioSpec,
  type SensitivityInput,
} from '../services/results/scenarioSensitivityService.js';
import {
  attributableDelta,
  confidenceLabel,
  type AttributableDeltaInput,
  type TimePoint,
} from '../services/results/counterfactualBaselineService.js';
import {
  aggregateKpiFinancialImpact,
  financialImpactByStatement,
  type KpiFinanceMapping,
} from '../services/results/financeLinkService.js';
import {
  buildNarrative,
  executiveSummary,
  type ValueNarrativeInput,
  type NarrativeBenefit,
} from '../services/results/valueNarrativeService.js';
import {
  portfolioValueSplit,
  stageFromInitiative,
  STAGE_DEFAULT_CONFIDENCE,
} from '../services/results/valueStageGateService.js';
import { all as dbAll } from '../utils/DbPromise.js';
import { asyncHandler } from '../utils/asyncHandler.js';

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
  return ((await dbAll(
    orgWide
      ? `SELECT id, name, status FROM initiatives WHERE organization_id = ?`
      : `SELECT id, name, status FROM initiatives WHERE project_id = ? AND organization_id = ?`,
    orgWide ? [orgId] : [projectId, orgId]
  )) as Array<{ id: string; name: string; status: string | null }>) || [];
}

async function fetchRoiRealized(orgId: string) {
  return ((await dbAll(
    `SELECT initiative_id, realized_revenue_delta, realized_cost_delta, realized_savings
     FROM roi_realized_values WHERE organization_id = ?`,
    [orgId]
  )) as Array<{
    initiative_id: string;
    realized_revenue_delta: number | null;
    realized_cost_delta: number | null;
    realized_savings: number | null;
  }>) || [];
}

async function fetchRoiAssumptions(orgId: string) {
  return ((await dbAll(
    `SELECT initiative_id, expected_npv, expected_revenue_delta, expected_cost_delta
     FROM roi_assumptions WHERE organization_id = ?`,
    [orgId]
  )) as Array<{
    initiative_id: string;
    expected_npv: number | null;
    expected_revenue_delta: number | null;
    expected_cost_delta: number | null;
  }>) || [];
}

// ─── GET /signals ─────────────────────────────────────────────────────────

router.get(
  '/:projectId/signals',
  verifyToken,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) { res.status(401).json({ error: 'org required' }); return; }

    const [initiatives, realized, assumptions] = await Promise.all([
      fetchOrgInitiatives(orgId, req.params.projectId),
      fetchRoiRealized(orgId),
      fetchRoiAssumptions(orgId),
    ]);

    const realizedByInit = new Map<string, number>();
    for (const r of realized) {
      const v = num(r.realized_revenue_delta) - num(r.realized_cost_delta) + num(r.realized_savings);
      realizedByInit.set(String(r.initiative_id), (realizedByInit.get(String(r.initiative_id)) || 0) + v);
    }
    const assumptionByInit = new Map(assumptions.map((a) => [String(a.initiative_id), a]));

    const items: BenefitInput[] = initiatives.map((i) => {
      const a = assumptionByInit.get(String(i.id));
      const valueAtStake = a?.expected_npv != null
        ? num(a.expected_npv)
        : num(a?.expected_revenue_delta) - num(a?.expected_cost_delta);
      const realizedValue = realizedByInit.get(String(i.id)) || 0;
      const hasRoiBaseline = !!a;
      const hasRealized = realizedValue !== 0;
      const stage = stageFromInitiative({ status: i.status ?? undefined, hasRoiBaseline, hasRealized });
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
    if (!orgId) { res.status(401).json({ error: 'org required' }); return; }

    const [realized, assumptions] = await Promise.all([
      fetchRoiRealized(orgId),
      fetchRoiAssumptions(orgId),
    ]);

    const assumptionByInit = new Map(assumptions.map((a) => [String(a.initiative_id), a]));
    const realizedByInit = new Map<string, number>();
    for (const r of realized) {
      const v = num(r.realized_revenue_delta) - num(r.realized_cost_delta) + num(r.realized_savings);
      realizedByInit.set(String(r.initiative_id), (realizedByInit.get(String(r.initiative_id)) || 0) + v);
    }

    const totalRealized = Array.from(realizedByInit.values()).reduce((s, v) => s + v, 0);
    const periodMonths = 6; // assume 6 months of data as default
    const now = new Date();
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
        fullYearRunRate: realizedValue > 0 && periodMonths > 0
          ? (realizedValue / periodMonths) * 12
          : 0,
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
    res.json({ bridge: bridgeWithAliases, timing });
  })
);

// ─── GET /reallocation ────────────────────────────────────────────────────

router.get(
  '/:projectId/reallocation',
  verifyToken,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) { res.status(401).json({ error: 'org required' }); return; }

    const [initiatives, realized, assumptions] = await Promise.all([
      fetchOrgInitiatives(orgId, req.params.projectId),
      fetchRoiRealized(orgId),
      fetchRoiAssumptions(orgId),
    ]);

    const assumptionByInit = new Map(assumptions.map((a) => [String(a.initiative_id), a]));
    const realizedByInit = new Map<string, number>();
    for (const r of realized) {
      const v = num(r.realized_revenue_delta) - num(r.realized_cost_delta) + num(r.realized_savings);
      realizedByInit.set(String(r.initiative_id), (realizedByInit.get(String(r.initiative_id)) || 0) + v);
    }

    const items: ReallocationItem[] = initiatives.map((i) => {
      const a = assumptionByInit.get(String(i.id));
      const valueAtStake = a?.expected_npv != null
        ? num(a.expected_npv)
        : num(a?.expected_revenue_delta) - num(a?.expected_cost_delta);
      const realizedValue = realizedByInit.get(String(i.id)) || 0;
      const hasRoiBaseline = !!a;
      const hasRealized = realizedValue !== 0;
      const stage = stageFromInitiative({ status: i.status ?? undefined, hasRoiBaseline, hasRealized });
      const confidence = STAGE_DEFAULT_CONFIDENCE[stage];
      const realizationPct = valueAtStake > 0 ? (realizedValue / valueAtStake) * 100 : 0;
      return {
        id: String(i.id),
        name: i.name,
        realizationPct,
        confidence,
        valueAtStake,
        capacityFte: 1, // default; no capacity table yet
      };
    });

    const moves = recommendReallocation(items);
    const summary = reallocationSummary(moves);
    const movesArr = Array.isArray(moves) ? (moves as any[]) : [];
    const totalAmount = movesArr.reduce((s: number, m: any) => s + (m.valueAtStake ?? (m.fteSuggested ?? 0) * 50_000), 0);
    res.json({ moves, summary: { ...summary, totalAmount } });
  })
);

// ─── GET /adoption ────────────────────────────────────────────────────────

router.get(
  '/:projectId/adoption',
  verifyToken,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) { res.status(401).json({ error: 'org required' }); return; }

    const [initiatives, realized] = await Promise.all([
      fetchOrgInitiatives(orgId, req.params.projectId),
      fetchRoiRealized(orgId),
    ]);

    const realizedByInit = new Map<string, number>();
    for (const r of realized) {
      const v = num(r.realized_revenue_delta) - num(r.realized_cost_delta) + num(r.realized_savings);
      realizedByInit.set(String(r.initiative_id), (realizedByInit.get(String(r.initiative_id)) || 0) + v);
    }

    // Infer adoption score from realization progress (proxy until dedicated tracking)
    const adoptionItems: BenefitAdoptionItem[] = initiatives.map((i) => {
      const realized2 = realizedByInit.get(String(i.id)) || 0;
      const adoptionScore = realized2 > 0 ? Math.min(realized2 / 1000, 1) : 0.3; // proxy
      return { id: String(i.id), name: i.name, adoptionScore };
    });

    const rawFlags = flagBenefitAtRiskByAdoption(adoptionItems);
    const flags = (rawFlags as any[]).map((f) => ({ ...f, atRisk: f.atRisk ?? f.atRiskByAdoption ?? false }));
    res.json({ flags, total: initiatives.length, atRiskCount: flags.length });
  })
);

// ─── GET /sustainment ─────────────────────────────────────────────────────

router.get(
  '/:projectId/sustainment',
  verifyToken,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) { res.status(401).json({ error: 'org required' }); return; }

    const initiatives = await fetchOrgInitiatives(orgId, req.params.projectId);

    const statuses = initiatives.map((i) => {
      const input: SustainmentInput = {
        ownershipTransferred: i.status === 'COMPLETED',
        lastReviewIso: null,
        cadence: 'quarterly',
        realizationPct: 0,
      };
      const nowMs = Date.now();
      return { id: String(i.id), name: i.name, ...sustainmentStatus(input, nowMs) };
    });

    const calendar = buildGovernanceCalendar(
      initiatives.map((i) => ({
        id: String(i.id),
        name: i.name,
        cadence: 'quarterly' as const,
        lastReviewIso: null,
      })),
      Date.now()
    );

    const summary = {
      total: statuses.length,
      sustained: statuses.filter((s) => s.status === 'sustained').length,
      atRisk: statuses.filter((s) => s.status === 'at-risk').length,
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
    if (!orgId) { res.status(401).json({ error: 'org required' }); return; }

    const assumptions = await fetchRoiAssumptions(orgId);

    // Aggregate cashflows from roi_assumptions for a combined view
    const totalExpectedAnnual = assumptions.reduce((sum, a) => {
      const v = a.expected_npv != null
        ? num(a.expected_npv)
        : num(a.expected_revenue_delta) - num(a.expected_cost_delta);
      return sum + v;
    }, 0);

    const baseInvestment = totalExpectedAnnual * 0.3; // 30% investment assumption
    const baseCashflows = [-baseInvestment, totalExpectedAnnual * 0.4, totalExpectedAnnual * 0.6, totalExpectedAnnual];

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
    res.json({ scenarios: scenariosWithName, irr: baseIrr, paybackPeriod: payback, sensitivity: sensitivityResults, initiativeCount: assumptions.length });
  })
);

// ─── GET /counterfactual ─────────────────────────────────────────────────

router.get(
  '/:projectId/counterfactual',
  verifyToken,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) { res.status(401).json({ error: 'org required' }); return; }

    const [realized, assumptions] = await Promise.all([
      fetchRoiRealized(orgId),
      fetchRoiAssumptions(orgId),
    ]);

    const totalTarget = assumptions.reduce((s, a) => {
      return s + (a.expected_npv != null ? num(a.expected_npv) : num(a.expected_revenue_delta) - num(a.expected_cost_delta));
    }, 0);

    const totalRealized = realized.reduce((s, r) => {
      return s + num(r.realized_revenue_delta) - num(r.realized_cost_delta) + num(r.realized_savings);
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
    if (!orgId) { res.status(401).json({ error: 'org required' }); return; }

    let financialMappings: KpiFinanceMapping[] = [];
    try {
      const rows = ((await dbAll(
        `SELECT kpi_id, statement_type, line_item, annual_impact, impact_direction
         FROM kpi_financial_mappings WHERE organization_id = ?`,
        [orgId]
      )) as Array<{
        kpi_id: string;
        statement_type: string;
        line_item: string;
        annual_impact: number | null;
        impact_direction: string;
      }>) || [];
      financialMappings = rows.map((r) => ({
        kpiId: String(r.kpi_id),
        statementLineId: String(r.kpi_id) + '_line',
        statementType: (r.statement_type || 'P&L') as any,
        multiplier: r.annual_impact ?? 1,
        direction: (r.impact_direction || 'positive') as any,
        kpiDelta: r.annual_impact ?? 0,
      }));
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
    const totalPositiveImpact = statementImpacts.reduce((s, si) => s + Math.max(si.totalImpact, 0), 0);
    const totalNegativeImpact = statementImpacts.reduce((s, si) => s + Math.min(si.totalImpact, 0), 0);
    const aggregate = {
      totalPositiveImpact,
      totalNegativeImpact,
      netImpact: totalPositiveImpact + totalNegativeImpact,
    };
    res.json({ aggregate, byStatement, bridge: statementImpacts.slice(0, 10), mappingCount: financialMappings.length });
  })
);

// ─── GET /benefit-profiles ────────────────────────────────────────────────

router.get(
  '/:projectId/benefit-profiles',
  verifyToken,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) { res.status(401).json({ error: 'org required' }); return; }

    // NB: schema column is owner_user_id (a UUID), not owner_name. Selecting a
    // non-existent column throws and dbAll swallows it → empty profiles. Read the
    // real columns; businessOwner stays null until a users JOIN is added.
    const kpiRows = ((await dbAll(
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
    if (!orgId) { res.status(401).json({ error: 'org required' }); return; }

    const [initiatives, realized, assumptions] = await Promise.all([
      fetchOrgInitiatives(orgId, req.params.projectId),
      fetchRoiRealized(orgId),
      fetchRoiAssumptions(orgId),
    ]);

    const assumptionByInit = new Map(assumptions.map((a) => [String(a.initiative_id), a]));
    const realizedByInit = new Map<string, number>();
    for (const r of realized) {
      const v = num(r.realized_revenue_delta) - num(r.realized_cost_delta) + num(r.realized_savings);
      realizedByInit.set(String(r.initiative_id), (realizedByInit.get(String(r.initiative_id)) || 0) + v);
    }

    const initData = initiatives.slice(0, 10).map((i) => {
      const a = assumptionByInit.get(String(i.id));
      const targetValue = a?.expected_npv != null
        ? num(a.expected_npv)
        : num(a?.expected_revenue_delta) - num(a?.expected_cost_delta);
      const realizedValue = realizedByInit.get(String(i.id)) || 0;
      const isOnTrack = targetValue > 0 ? realizedValue / targetValue >= 0.5 : true;
      return { name: i.name, targetValue, realizedValue, isOnTrack };
    });

    const atRiskCount = initiatives.filter((i) => {
      const a = assumptionByInit.get(String(i.id));
      const vs = a?.expected_npv != null ? num(a.expected_npv) : num(a?.expected_revenue_delta) - num(a?.expected_cost_delta);
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

export default router;
