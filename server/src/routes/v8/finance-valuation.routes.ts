/**
 * V8 Finance — Valuation / Risk cluster bridge under /api/v8/finance-valuation.
 *
 * Wires 7 previously orphaned (0 importers) pure-function engines as REST
 * endpoints:
 *   - monteCarloNpvService  — Monte Carlo NPV simulation
 *   - valueAtRiskService    — benefit Value-at-Risk vs schedule health (EVM/SPI)
 *   - realOptionsService    — defer / abandon / staged-investment real options
 *   - efficientFrontierService — value-vs-risk portfolio frontier
 *   - whatIfSensitivityService — one-way / tornado / 2D data-table / break-even
 *   - scenarioComputeService   — base/optimistic/conservative scenario modifiers
 *   - capitalDecisionService   — hurdle rate, risk-adjusted NPV, ranking
 *
 * All 7 engines are pure functions — no DB, no I/O. There is nothing to
 * org-scope inside the engines themselves; org-scope here means "the caller
 * must be an authenticated member of a V8-enabled org" (enforced by the
 * v8Router middleware chain this file is mounted under — verifyToken,
 * requireV8OrgContext, v8OrgGate, attachV8Context — see routes/v8/index.ts).
 * Every handler still calls getV8Context(req) itself so this file 404s/403s
 * correctly even when unit-tested standalone (see sibling finance.routes.ts
 * / results.routes.ts for the same convention).
 *
 * npvFn / targetFn / computeFn callbacks in the underlying services cannot
 * cross a JSON body, so this bridge exposes a generic LINEAR combination of
 * drivers as the model: value = intercept + Σ (driver_i * weight_i). This is
 * a deliberate simplification — flagged in the handoff — good enough for the
 * FE to drive sliders/tornado/what-if UIs against a caller-supplied linear
 * model without inventing a bespoke formula DSL. A richer expression engine
 * can replace `buildLinearFn` later without changing the route contracts.
 *
 * MOUNT: v8Router.use('/finance-valuation', financeValuationRoutes);
 *
 * @module routes/v8/finance-valuation.routes
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import {
  evaluateAgainstHurdle,
  hurdleRate,
  type RankableItem,
  rankByRiskAdjusted,
  riskAdjustedNpv,
  type RiskClass,
} from '../../services/capitalDecisionService.js';
import {
  type CorrelationMatrix,
  frontier,
  type FrontierInitiative,
  portfolioRiskValue,
} from '../../services/efficientFrontierService.js';
import {
  type Drivers as NpvDrivers,
  histogram,
  simulateNpv,
} from '../../services/monteCarloNpvService.js';
import {
  abandonOption,
  type AbandonOptionInput,
  deferOption,
  type DeferOptionInput,
  type InvestmentStage,
  stagedInvestment,
} from '../../services/realOptionsService.js';
import {
  applyScenario,
  compareScenarios,
  scenarioFanData,
  type ScenarioName,
} from '../../services/scenarioComputeService.js';
import {
  portfolioVaR,
  type PortfolioVarItem,
  valueAtRisk,
  varHeatmapCells,
} from '../../services/valueAtRiskService.js';
import {
  breakEven,
  dataTable2D,
  type Drivers as SensitivityDrivers,
  oneWaySensitivity,
  tornado,
} from '../../services/whatIfSensitivityService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

/** Stable contract id for this bridge's responses. */
export const V8_FINANCE_VALUATION_CONTRACT = 'finance_valuation_v1';

function meta() {
  return { version: 'v8' as const, contract: V8_FINANCE_VALUATION_CONTRACT };
}

/**
 * Build a generic linear model fn: value = intercept + Σ driver_i * weight_i.
 * Drivers without an explicit weight default to a coefficient of 1.
 */
function buildLinearFn(
  weights: Record<string, number> | undefined,
  intercept: number | undefined
): (drivers: Record<string, number>) => number {
  const w = weights && typeof weights === 'object' ? weights : {};
  const base = Number.isFinite(intercept) ? Number(intercept) : 0;
  return (drivers: Record<string, number>): number => {
    let sum = base;
    for (const [key, value] of Object.entries(drivers)) {
      const coef = Number.isFinite(w[key]) ? w[key] : 1;
      sum += (Number.isFinite(value) ? value : 0) * coef;
    }
    return sum;
  };
}

/** Read a numeric value at a dot-path (e.g. "revenue.total") from an object. */
function readNumericPath(obj: unknown, path: string): number {
  const parts = path.split('.');
  let cur: any = obj;
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') return 0;
    cur = cur[p];
  }
  return typeof cur === 'number' && Number.isFinite(cur) ? cur : 0;
}

// ─── 1. Monte Carlo NPV ────────────────────────────────────────────────────

/**
 * POST /monte-carlo-npv
 * body: { drivers: Drivers, weights?, intercept?, iterations?, seed?, bins? }
 * -> { simulation: SimulationResult, histogram: HistogramBin[] }
 */
router.post(
  '/monte-carlo-npv',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const body = req.body ?? {};
    const drivers = (body.drivers ?? {}) as NpvDrivers;
    if (!drivers || typeof drivers !== 'object' || Object.keys(drivers).length === 0) {
      return res.status(400).json({ error: 'drivers (non-empty map) required' });
    }

    const npvFn = buildLinearFn(body.weights, body.intercept);
    const iterations = Number.isFinite(body.iterations) ? Number(body.iterations) : undefined;
    const seed = Number.isFinite(body.seed) ? Number(body.seed) : undefined;
    const bins = Number.isFinite(body.bins) ? Number(body.bins) : undefined;

    const simulation = simulateNpv(drivers, npvFn, iterations, seed);
    const hist = histogram(simulation.samples, bins);

    return res.json({
      data: { simulation, histogram: hist },
      meta: meta(),
    });
  })
);

// ─── 2. Value at Risk ──────────────────────────────────────────────────────

/**
 * POST /value-at-risk
 * body: { benefitForecast: number, spi: number|null }
 * -> VarResult
 */
router.post(
  '/value-at-risk',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const body = req.body ?? {};
    const benefitForecast = Number(body.benefitForecast);
    if (!Number.isFinite(benefitForecast)) {
      return res.status(400).json({ error: 'benefitForecast (number) required' });
    }
    const spi = body.spi === null || body.spi === undefined ? null : Number(body.spi);

    const result = valueAtRisk(benefitForecast, spi);
    return res.json({ data: result, meta: meta() });
  })
);

/**
 * POST /value-at-risk/portfolio
 * body: { items: PortfolioVarItem[] }
 * -> { portfolio: PortfolioVarResult, heatmap: VarHeatmapCell[] }
 */
router.post(
  '/value-at-risk/portfolio',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const body = req.body ?? {};
    const items = Array.isArray(body.items) ? (body.items as PortfolioVarItem[]) : [];

    const portfolio = portfolioVaR(items);
    const heatmap = varHeatmapCells(items);

    return res.json({ data: { portfolio, heatmap }, meta: meta() });
  })
);

// ─── 3. Real Options ───────────────────────────────────────────────────────

/**
 * POST /real-options/defer
 * body: DeferOptionInput -> DeferOptionResult
 */
router.post(
  '/real-options/defer',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const body = (req.body ?? {}) as Partial<DeferOptionInput>;
    const required: (keyof DeferOptionInput)[] = [
      'underlyingValue',
      'investmentCost',
      'volatility',
      'riskFreeRate',
      'timeToDecideYears',
    ];
    for (const key of required) {
      if (!Number.isFinite(body[key])) {
        return res.status(400).json({ error: `${key} (number) required` });
      }
    }

    const result = deferOption(body as DeferOptionInput);
    return res.json({ data: result, meta: meta() });
  })
);

/**
 * POST /real-options/abandon
 * body: AbandonOptionInput -> AbandonOptionResult
 */
router.post(
  '/real-options/abandon',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const body = (req.body ?? {}) as Partial<AbandonOptionInput>;
    const required: (keyof AbandonOptionInput)[] = [
      'underlyingValue',
      'salvageValue',
      'volatility',
      'riskFreeRate',
      'timeToDecideYears',
    ];
    for (const key of required) {
      if (!Number.isFinite(body[key])) {
        return res.status(400).json({ error: `${key} (number) required` });
      }
    }

    const result = abandonOption(body as AbandonOptionInput);
    return res.json({ data: result, meta: meta() });
  })
);

/**
 * POST /real-options/staged
 * body: { stages: InvestmentStage[] } -> StagedInvestmentResult
 */
router.post(
  '/real-options/staged',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const body = req.body ?? {};
    const stages = Array.isArray(body.stages) ? (body.stages as InvestmentStage[]) : [];

    const result = stagedInvestment(stages);
    return res.json({ data: result, meta: meta() });
  })
);

// ─── 4. Efficient Frontier ─────────────────────────────────────────────────

/**
 * POST /efficient-frontier
 * body: { initiatives: FrontierInitiative[], budget: number, points?, correlation? }
 * -> FrontierResult
 */
router.post(
  '/efficient-frontier',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const body = req.body ?? {};
    const initiatives = Array.isArray(body.initiatives)
      ? (body.initiatives as FrontierInitiative[])
      : [];
    const budget = Number.isFinite(body.budget) ? Number(body.budget) : 0;
    const points = Number.isFinite(body.points) ? Number(body.points) : undefined;
    const correlation = (body.correlation ?? undefined) as CorrelationMatrix | undefined;

    const result = frontier(initiatives, budget, points, correlation);
    return res.json({ data: result, meta: meta() });
  })
);

/**
 * POST /efficient-frontier/portfolio
 * body: { selectedIds: string[], initiatives: FrontierInitiative[], correlation? }
 * -> PortfolioRiskValue
 */
router.post(
  '/efficient-frontier/portfolio',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const body = req.body ?? {};
    const selectedIds = Array.isArray(body.selectedIds) ? (body.selectedIds as string[]) : [];
    const initiatives = Array.isArray(body.initiatives)
      ? (body.initiatives as FrontierInitiative[])
      : [];
    const correlation = (body.correlation ?? undefined) as CorrelationMatrix | undefined;

    const result = portfolioRiskValue(selectedIds, initiatives, correlation);
    return res.json({ data: result, meta: meta() });
  })
);

// ─── 5. What-if / Sensitivity ──────────────────────────────────────────────

/**
 * POST /sensitivity/one-way
 * body: { baseDrivers, weights?, intercept?, driverId, rangePct? } -> OneWayPoint[]
 */
router.post(
  '/sensitivity/one-way',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const body = req.body ?? {};
    const baseDrivers = (body.baseDrivers ?? {}) as SensitivityDrivers;
    const driverId = String(body.driverId || '');
    if (!driverId) {
      return res.status(400).json({ error: 'driverId required' });
    }
    const rangePct = Array.isArray(body.rangePct) ? (body.rangePct as number[]) : undefined;

    const targetFn = buildLinearFn(body.weights, body.intercept);
    const result = oneWaySensitivity(baseDrivers, targetFn, driverId, rangePct);
    return res.json({ data: { points: result }, meta: meta() });
  })
);

/**
 * POST /sensitivity/tornado
 * body: { baseDrivers, weights?, intercept?, driverIds, swingPct? } -> TornadoResult
 */
router.post(
  '/sensitivity/tornado',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const body = req.body ?? {};
    const baseDrivers = (body.baseDrivers ?? {}) as SensitivityDrivers;
    const driverIds = Array.isArray(body.driverIds) ? (body.driverIds as string[]) : [];
    if (driverIds.length === 0) {
      return res.status(400).json({ error: 'driverIds (non-empty array) required' });
    }
    const swingPct = Number.isFinite(body.swingPct) ? Number(body.swingPct) : undefined;

    const targetFn = buildLinearFn(body.weights, body.intercept);
    const result = tornado(baseDrivers, targetFn, driverIds, swingPct);
    return res.json({ data: result, meta: meta() });
  })
);

/**
 * POST /sensitivity/data-table
 * body: { baseDrivers, weights?, intercept?, xDriver, yDriver, xRange, yRange } -> DataTable2DResult
 */
router.post(
  '/sensitivity/data-table',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const body = req.body ?? {};
    const baseDrivers = (body.baseDrivers ?? {}) as SensitivityDrivers;
    const xDriver = String(body.xDriver || '');
    const yDriver = String(body.yDriver || '');
    const xRange = Array.isArray(body.xRange) ? (body.xRange as number[]) : [];
    const yRange = Array.isArray(body.yRange) ? (body.yRange as number[]) : [];
    if (!xDriver || !yDriver || xRange.length === 0 || yRange.length === 0) {
      return res
        .status(400)
        .json({ error: 'xDriver, yDriver, xRange and yRange (non-empty) required' });
    }

    const targetFn = buildLinearFn(body.weights, body.intercept);
    const result = dataTable2D(baseDrivers, targetFn, xDriver, yDriver, xRange, yRange);
    return res.json({ data: result, meta: meta() });
  })
);

/**
 * POST /sensitivity/break-even
 * body: { baseDrivers, weights?, intercept?, driverId, target? } -> { breakEven: number|null }
 */
router.post(
  '/sensitivity/break-even',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const body = req.body ?? {};
    const baseDrivers = (body.baseDrivers ?? {}) as SensitivityDrivers;
    const driverId = String(body.driverId || '');
    if (!driverId) {
      return res.status(400).json({ error: 'driverId required' });
    }
    const target = Number.isFinite(body.target) ? Number(body.target) : undefined;

    const targetFn = buildLinearFn(body.weights, body.intercept);
    const result = breakEven(baseDrivers, targetFn, driverId, target);
    return res.json({ data: { breakEven: result }, meta: meta() });
  })
);

// ─── 6. Scenario Compute ───────────────────────────────────────────────────

/**
 * POST /scenarios/apply
 * body: { assumptions: object, scenario: 'base'|'optimistic'|'conservative' } -> scaled assumptions
 */
router.post(
  '/scenarios/apply',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const body = req.body ?? {};
    const assumptions =
      body.assumptions && typeof body.assumptions === 'object' ? body.assumptions : {};
    const scenario = String(body.scenario || 'base') as ScenarioName;
    if (!['base', 'optimistic', 'conservative'].includes(scenario)) {
      return res.status(400).json({ error: "scenario must be 'base'|'optimistic'|'conservative'" });
    }

    const result = applyScenario(assumptions, scenario);
    return res.json({ data: { assumptions: result }, meta: meta() });
  })
);

/**
 * POST /scenarios/compare
 * body: { assumptions: object, metricKeys: string[] (dot-paths into scaled assumptions) }
 * -> ScenarioComparison
 *
 * The underlying service accepts an arbitrary computeFn(modifiedAssumptions) -> metrics
 * which cannot cross JSON. This bridge's computeFn reads the requested dot-paths out
 * of the scaled assumptions object as the reported metrics.
 */
router.post(
  '/scenarios/compare',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const body = req.body ?? {};
    const assumptions =
      body.assumptions && typeof body.assumptions === 'object' ? body.assumptions : {};
    const metricKeys = Array.isArray(body.metricKeys) ? (body.metricKeys as string[]) : [];
    if (metricKeys.length === 0) {
      return res.status(400).json({ error: 'metricKeys (non-empty array) required' });
    }

    const computeFn = (modified: Record<string, unknown>) => {
      const out: Record<string, number> = {};
      for (const key of metricKeys) {
        out[key] = readNumericPath(modified, key);
      }
      return out;
    };

    const result = compareScenarios(assumptions, computeFn);
    return res.json({ data: result, meta: meta() });
  })
);

/**
 * POST /scenarios/fan
 * body: { scenarios: Partial<Record<ScenarioName, Record<string, number[]>>>, metric: string }
 * -> ScenarioFanData
 */
router.post(
  '/scenarios/fan',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const body = req.body ?? {};
    const scenarios = body.scenarios && typeof body.scenarios === 'object' ? body.scenarios : {};
    const metric = String(body.metric || '');
    if (!metric) {
      return res.status(400).json({ error: 'metric required' });
    }

    const result = scenarioFanData(scenarios, metric);
    return res.json({ data: result, meta: meta() });
  })
);

// ─── 7. Capital Decision ───────────────────────────────────────────────────

/**
 * POST /capital-decision/hurdle-rate
 * body: { wacc: number, riskClass: string } -> { hurdleRate: number }
 */
router.post(
  '/capital-decision/hurdle-rate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const body = req.body ?? {};
    const wacc = Number(body.wacc);
    if (!Number.isFinite(wacc)) {
      return res.status(400).json({ error: 'wacc (number) required' });
    }
    const riskClass = String(body.riskClass || 'core') as RiskClass | string;

    const result = hurdleRate(wacc, riskClass);
    return res.json({ data: { hurdleRate: result }, meta: meta() });
  })
);

/**
 * POST /capital-decision/risk-adjusted-npv
 * body: { npv: number, probabilityOfSuccess: number, leakagePct? } -> RiskAdjustedNpvResult
 */
router.post(
  '/capital-decision/risk-adjusted-npv',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const body = req.body ?? {};
    const npv = Number(body.npv);
    const probabilityOfSuccess = Number(body.probabilityOfSuccess);
    if (!Number.isFinite(npv) || !Number.isFinite(probabilityOfSuccess)) {
      return res.status(400).json({ error: 'npv and probabilityOfSuccess (numbers) required' });
    }
    const leakagePct = Number.isFinite(body.leakagePct) ? Number(body.leakagePct) : undefined;

    const result = riskAdjustedNpv(npv, probabilityOfSuccess, leakagePct);
    return res.json({ data: result, meta: meta() });
  })
);

/**
 * POST /capital-decision/evaluate-hurdle
 * body: { irr: number, hurdle: number } -> HurdleEvaluation
 */
router.post(
  '/capital-decision/evaluate-hurdle',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const body = req.body ?? {};
    const irr = Number(body.irr);
    const hurdle = Number(body.hurdle);
    if (!Number.isFinite(irr) || !Number.isFinite(hurdle)) {
      return res.status(400).json({ error: 'irr and hurdle (numbers) required' });
    }

    const result = evaluateAgainstHurdle(irr, hurdle);
    return res.json({ data: result, meta: meta() });
  })
);

/**
 * POST /capital-decision/rank
 * body: { items: RankableItem[] } -> RankedItem[]
 */
router.post(
  '/capital-decision/rank',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const body = req.body ?? {};
    const items = Array.isArray(body.items) ? (body.items as RankableItem[]) : [];

    const result = rankByRiskAdjusted(items);
    return res.json({ data: { items: result }, meta: meta() });
  })
);

export default router;

// MOUNT: v8Router.use('/finance-valuation', financeValuationRoutes);
