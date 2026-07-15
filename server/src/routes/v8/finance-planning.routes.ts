/**
 * V8 Finance — Planning/Forecast cluster bridge.
 *
 * Wires 6 previously orphaned (0-importer) pure-function planning engines
 * from `server/src/services/` behind org-scoped POST endpoints:
 *
 *   - cashForecastService       — short-term liquidity / runway
 *   - rollingForecastService    — actual-vs-plan reforecast + roll-forward
 *   - headcountPlannerService   — workforce OPEX / cash phasing
 *   - runRatePhasingService     — run-rate vs one-time benefit phasing
 *   - driverTreeService         — driver-tree evaluation / what-if
 *   - nlToModelService          — natural-language → driver-tree model spec
 *
 * All 6 engines are pure functions (no DB, no I/O, no LLM calls today —
 * nlToModelService is a deterministic rule-based extractor; see its header
 * comment for the planned LLM-assisted follow-up). Every endpoint here is
 * therefore a stateless POST: auth/org-context is still required (enforced
 * globally by `v8Router.use(verifyToken, requireV8OrgContext, ...)` in
 * `routes/v8/index.ts`, mirrored per-handler here via `getV8Context` per the
 * finance.routes.ts / results.routes.ts convention) but there is no
 * cross-org row ownership to 404 on — nothing is persisted or read from a
 * table scoped by organization_id.
 *
 * Namespace: /api/v8/finance-planning (NOT YET MOUNTED — see bottom of file).
 *
 * @module routes/v8/finance-planning.routes
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import {
  cashCurve,
  type CashForecastInput,
  directCashForecast,
  minCashAlerts,
  runway,
} from '../../services/cashForecastService.js';
import {
  type DriverNode,
  DriverTreeCycleError,
  evaluateTree,
  propagateChange,
  treeToChartData,
} from '../../services/driverTreeService.js';
import {
  costPerHire,
  headcountOpex,
  type HeadcountRole,
  headcountToCash,
  roleCost,
} from '../../services/headcountPlannerService.js';
import {
  buildDriverTreeFromSpec,
  parseModelSpec,
  specToAssumptions,
} from '../../services/nlToModelService.js';
import {
  fyBridge,
  type PeriodValue,
  reforecast,
  rollForward,
  snapshotForecast,
} from '../../services/rollingForecastService.js';
import {
  bankableValue,
  type BenefitInput,
  inYearVsFullYear,
  phasingCurve,
  splitBenefit,
} from '../../services/runRatePhasingService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

/** Stable contract id for this cluster's read/compute responses. */
export const V8_FINANCE_PLANNING_CONTRACT = 'finance_planning_runtime_v1';

function planningMeta() {
  return { version: 'v8' as const, contract: V8_FINANCE_PLANNING_CONTRACT };
}

function badRequest(res: Response, message: string, code: string) {
  return res.status(400).json({ error: message, code });
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Cash / liquidity forecast — cashForecastService
// ─────────────────────────────────────────────────────────────────────────

/**
 * POST /cash-forecast
 * Body: { openingCash, periods: [{period?, inflows, outflows}], monthlyBurn?, minCash? }
 * Runs the full direct-method pipeline (forecast -> runway -> alerts -> curve)
 * in one call since runway/alerts/curve all derive from the forecast rows.
 */
router.post(
  '/cash-forecast',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req); // enforce auth/org-context (no DB row to scope)
    const body = (req.body ?? {}) as Partial<CashForecastInput> & {
      monthlyBurn?: number;
      minCash?: number;
    };
    if (!Array.isArray(body.periods)) {
      return badRequest(res, '"periods" must be an array', 'CASH_FORECAST_INVALID_PERIODS');
    }

    const forecast = directCashForecast({
      openingCash: Number(body.openingCash) || 0,
      periods: body.periods,
    });
    const runwayResult = runway(forecast, body.monthlyBurn);
    const alerts = typeof body.minCash === 'number' ? minCashAlerts(forecast, body.minCash) : [];
    const curve = cashCurve(forecast);

    return res.json({
      data: { forecast, runway: runwayResult, alerts, curve },
      meta: planningMeta(),
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────
// 2. Rolling forecast — rollingForecastService
// ─────────────────────────────────────────────────────────────────────────

/**
 * POST /rolling-forecast/reforecast
 * Body: { plan: PeriodValue[], actuals: PeriodValue[] }
 */
router.post(
  '/rolling-forecast/reforecast',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const { plan, actuals } = (req.body ?? {}) as { plan?: PeriodValue[]; actuals?: PeriodValue[] };
    if (!Array.isArray(plan) || !Array.isArray(actuals)) {
      return badRequest(
        res,
        '"plan" and "actuals" must be arrays of {period, value}',
        'ROLLING_FORECAST_INVALID_INPUT'
      );
    }
    const lines = reforecast(plan, actuals);
    return res.json({ data: { lines }, meta: planningMeta() });
  })
);

/**
 * POST /rolling-forecast/roll-forward
 * Body: { forecast: PeriodValue[], byPeriods?: number }
 */
router.post(
  '/rolling-forecast/roll-forward',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const { forecast, byPeriods } = (req.body ?? {}) as {
      forecast?: PeriodValue[];
      byPeriods?: number;
    };
    if (!Array.isArray(forecast)) {
      return badRequest(res, '"forecast" must be an array', 'ROLLING_FORECAST_INVALID_INPUT');
    }
    const lines = rollForward(forecast, byPeriods);
    return res.json({ data: { lines }, meta: planningMeta() });
  })
);

/**
 * POST /rolling-forecast/fy-bridge
 * Body: { plan: PeriodValue[], actuals: PeriodValue[] }
 */
router.post(
  '/rolling-forecast/fy-bridge',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const { plan, actuals } = (req.body ?? {}) as { plan?: PeriodValue[]; actuals?: PeriodValue[] };
    if (!Array.isArray(plan) || !Array.isArray(actuals)) {
      return badRequest(
        res,
        '"plan" and "actuals" must be arrays of {period, value}',
        'ROLLING_FORECAST_INVALID_INPUT'
      );
    }
    const bridge = fyBridge(plan, actuals);
    return res.json({ data: { bridge }, meta: planningMeta() });
  })
);

/**
 * POST /rolling-forecast/snapshot
 * Body: { forecast: PeriodValue[], label: string, createdPeriod: string }
 * Pure capture — caller supplies createdPeriod; nothing is persisted here.
 */
router.post(
  '/rolling-forecast/snapshot',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const { forecast, label, createdPeriod } = (req.body ?? {}) as {
      forecast?: PeriodValue[];
      label?: string;
      createdPeriod?: string;
    };
    if (
      !Array.isArray(forecast) ||
      typeof label !== 'string' ||
      typeof createdPeriod !== 'string'
    ) {
      return badRequest(
        res,
        '"forecast" (array), "label" and "createdPeriod" (strings) are required',
        'ROLLING_FORECAST_INVALID_INPUT'
      );
    }
    const snapshot = snapshotForecast(forecast, label, createdPeriod);
    return res.json({ data: { snapshot }, meta: planningMeta() });
  })
);

// ─────────────────────────────────────────────────────────────────────────
// 3. Headcount planner — headcountPlannerService
// ─────────────────────────────────────────────────────────────────────────

/**
 * POST /headcount/opex
 * Body: { roles: HeadcountRole[], periods: string[] }
 */
router.post(
  '/headcount/opex',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const { roles, periods } = (req.body ?? {}) as { roles?: HeadcountRole[]; periods?: string[] };
    if (!Array.isArray(roles) || !Array.isArray(periods)) {
      return badRequest(res, '"roles" and "periods" must be arrays', 'HEADCOUNT_INVALID_INPUT');
    }
    const rows = headcountOpex(roles, periods);
    return res.json({ data: { rows }, meta: planningMeta() });
  })
);

/**
 * POST /headcount/cash
 * Body: { roles: HeadcountRole[], periods: string[], payLagPeriods?: number }
 */
router.post(
  '/headcount/cash',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const { roles, periods, payLagPeriods } = (req.body ?? {}) as {
      roles?: HeadcountRole[];
      periods?: string[];
      payLagPeriods?: number;
    };
    if (!Array.isArray(roles) || !Array.isArray(periods)) {
      return badRequest(res, '"roles" and "periods" must be arrays', 'HEADCOUNT_INVALID_INPUT');
    }
    const rows = headcountToCash(roles, periods, payLagPeriods);
    return res.json({ data: { rows }, meta: planningMeta() });
  })
);

/**
 * POST /headcount/summary
 * Body: { roles: HeadcountRole[] }
 */
router.post(
  '/headcount/summary',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const { roles } = (req.body ?? {}) as { roles?: HeadcountRole[] };
    if (!Array.isArray(roles)) {
      return badRequest(res, '"roles" must be an array', 'HEADCOUNT_INVALID_INPUT');
    }
    const summary = costPerHire(roles);
    return res.json({ data: { summary }, meta: planningMeta() });
  })
);

/**
 * POST /headcount/role-cost
 * Body: { role: HeadcountRole, period: number }
 * Single-role, single-period preview (the primitive `headcountOpex` loops over).
 */
router.post(
  '/headcount/role-cost',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const { role, period } = (req.body ?? {}) as { role?: HeadcountRole; period?: number };
    if (!role || typeof role !== 'object' || typeof period !== 'number') {
      return badRequest(
        res,
        '"role" (object) and "period" (number) are required',
        'HEADCOUNT_INVALID_INPUT'
      );
    }
    const cost = roleCost(role, period);
    return res.json({ data: { cost }, meta: planningMeta() });
  })
);

// ─────────────────────────────────────────────────────────────────────────
// 4. Run-rate vs one-time phasing — runRatePhasingService
// ─────────────────────────────────────────────────────────────────────────

/**
 * POST /run-rate/split
 * Body: { benefit: BenefitInput }
 */
router.post(
  '/run-rate/split',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const { benefit } = (req.body ?? {}) as { benefit?: BenefitInput };
    if (!benefit || typeof benefit !== 'object') {
      return badRequest(res, '"benefit" object is required', 'RUN_RATE_INVALID_INPUT');
    }
    const split = splitBenefit(benefit);
    return res.json({ data: { split }, meta: planningMeta() });
  })
);

/**
 * POST /run-rate/phasing-curve
 * Body: PhasingInput ({ fullRunRate, rampMonths, startPeriod?, horizonMonths, shape? })
 */
router.post(
  '/run-rate/phasing-curve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const body = req.body ?? {};
    if (typeof body.fullRunRate !== 'number' || typeof body.horizonMonths !== 'number') {
      return badRequest(
        res,
        '"fullRunRate" and "horizonMonths" (numbers) are required',
        'RUN_RATE_INVALID_INPUT'
      );
    }
    const curve = phasingCurve(body);
    return res.json({ data: { curve }, meta: planningMeta() });
  })
);

/**
 * POST /run-rate/in-year
 * Body: { benefit: BenefitInput, monthsRemainingInYear: number }
 */
router.post(
  '/run-rate/in-year',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const { benefit, monthsRemainingInYear } = (req.body ?? {}) as {
      benefit?: BenefitInput;
      monthsRemainingInYear?: number;
    };
    if (!benefit || typeof benefit !== 'object' || typeof monthsRemainingInYear !== 'number') {
      return badRequest(
        res,
        '"benefit" (object) and "monthsRemainingInYear" (number) are required',
        'RUN_RATE_INVALID_INPUT'
      );
    }
    const result = inYearVsFullYear(benefit, monthsRemainingInYear);
    return res.json({ data: result, meta: planningMeta() });
  })
);

/**
 * POST /run-rate/bankable
 * Body: { benefits: BenefitInput[] }
 */
router.post(
  '/run-rate/bankable',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const { benefits } = (req.body ?? {}) as { benefits?: BenefitInput[] };
    if (!Array.isArray(benefits)) {
      return badRequest(res, '"benefits" must be an array', 'RUN_RATE_INVALID_INPUT');
    }
    const value = bankableValue(benefits);
    return res.json({ data: { bankableValue: value }, meta: planningMeta() });
  })
);

// ─────────────────────────────────────────────────────────────────────────
// 5. Driver tree — driverTreeService
// ─────────────────────────────────────────────────────────────────────────

/**
 * POST /driver-tree/evaluate
 * Body: { nodes: DriverNode[] }
 */
router.post(
  '/driver-tree/evaluate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const { nodes } = (req.body ?? {}) as { nodes?: DriverNode[] };
    if (!Array.isArray(nodes)) {
      return badRequest(res, '"nodes" must be an array', 'DRIVER_TREE_INVALID_INPUT');
    }
    try {
      const result = evaluateTree(nodes);
      return res.json({ data: result, meta: planningMeta() });
    } catch (err) {
      if (err instanceof DriverTreeCycleError) {
        return badRequest(res, err.message, 'DRIVER_TREE_CYCLE');
      }
      return badRequest(res, (err as Error).message, 'DRIVER_TREE_INVALID_TREE');
    }
  })
);

/**
 * POST /driver-tree/propagate
 * Body: { nodes: DriverNode[], changedId: string, newValue: number }
 */
router.post(
  '/driver-tree/propagate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const { nodes, changedId, newValue } = (req.body ?? {}) as {
      nodes?: DriverNode[];
      changedId?: string;
      newValue?: number;
    };
    if (!Array.isArray(nodes) || typeof changedId !== 'string' || typeof newValue !== 'number') {
      return badRequest(
        res,
        '"nodes" (array), "changedId" (string) and "newValue" (number) are required',
        'DRIVER_TREE_INVALID_INPUT'
      );
    }
    try {
      const result = propagateChange(nodes, changedId, newValue);
      return res.json({ data: result, meta: planningMeta() });
    } catch (err) {
      if (err instanceof DriverTreeCycleError) {
        return badRequest(res, err.message, 'DRIVER_TREE_CYCLE');
      }
      return badRequest(res, (err as Error).message, 'DRIVER_TREE_INVALID_TREE');
    }
  })
);

/**
 * POST /driver-tree/chart
 * Body: { nodes: DriverNode[], values?: Record<string, number> }
 */
router.post(
  '/driver-tree/chart',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const { nodes, values } = (req.body ?? {}) as {
      nodes?: DriverNode[];
      values?: Record<string, number>;
    };
    if (!Array.isArray(nodes)) {
      return badRequest(res, '"nodes" must be an array', 'DRIVER_TREE_INVALID_INPUT');
    }
    try {
      const chart = treeToChartData(nodes, values);
      return res.json({ data: chart, meta: planningMeta() });
    } catch (err) {
      if (err instanceof DriverTreeCycleError) {
        return badRequest(res, err.message, 'DRIVER_TREE_CYCLE');
      }
      return badRequest(res, (err as Error).message, 'DRIVER_TREE_INVALID_TREE');
    }
  })
);

// ─────────────────────────────────────────────────────────────────────────
// 6. Natural language -> model — nlToModelService
// ─────────────────────────────────────────────────────────────────────────

/**
 * POST /nl-to-model
 * Body: { text: string }
 * Deterministic rule-based extractor (no LLM call today — see module header).
 * Runs the full pipeline: parse -> driver tree -> flat assumptions.
 */
router.post(
  '/nl-to-model',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const { text } = (req.body ?? {}) as { text?: string };
    if (typeof text !== 'string' || text.trim().length === 0) {
      return badRequest(res, '"text" (non-empty string) is required', 'NL_TO_MODEL_INVALID_INPUT');
    }
    const spec = parseModelSpec(text);
    const driverTree = buildDriverTreeFromSpec(spec);
    const assumptions = specToAssumptions(spec);
    return res.json({ data: { spec, driverTree, assumptions }, meta: planningMeta() });
  })
);

export default router;

// MOUNT: v8Router.use('/finance-planning', financePlanningRoutes);
