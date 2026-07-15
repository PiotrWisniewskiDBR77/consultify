/**
 * Wiring test for the 6 previously orphaned (0-importer) M16 Finance
 * planning/forecast engines:
 *   server/src/services/{cashForecastService,rollingForecastService,
 *   headcountPlannerService,runRatePhasingService,driverTreeService,
 *   nlToModelService}.ts
 *
 * All 6 are pure functions (no DB) — this test does NOT mock any service or
 * DB layer; it drives real computations end-to-end through the route and
 * verifies auth-gating + response shape.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import financePlanningRoutes from '../../../server/src/routes/v8/finance-planning.routes.js';

const ORG = 'org-1';
const UID = 'user-1';

function createApp(opts: { withContext?: boolean } = {}): Express {
  const { withContext = true } = opts;
  const app = express();
  app.use(express.json());
  if (withContext) {
    app.use((req: any, _res, next) => {
      req.v8Context = { organizationId: ORG, userId: UID, userRole: 'owner', isSuperAdmin: false };
      req.user = { id: UID, organizationId: ORG, role: 'owner' };
      next();
    });
  }
  app.use('/api/v8/finance-planning', financePlanningRoutes);
  // Minimal error handler so getV8Context() throws surface as 500 instead of
  // crashing supertest, mirroring the real app's error middleware.
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ error: err?.message ?? 'error' });
  });
  return app;
}

describe('V8 Finance Planning — orphaned engine wiring', () => {
  describe('auth gate', () => {
    it('rejects when v8Context is not attached (no upstream auth middleware)', async () => {
      const res = await request(createApp({ withContext: false })).post(
        '/api/v8/finance-planning/cash-forecast'
      ).send({ openingCash: 100, periods: [] });
      expect(res.status).toBe(500);
    });
  });

  describe('POST /cash-forecast -> cashForecastService', () => {
    it('validates periods is an array', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-planning/cash-forecast')
        .send({ openingCash: 100 });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CASH_FORECAST_INVALID_PERIODS');
    });

    it('runs the direct method pipeline: forecast -> runway -> alerts -> curve', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-planning/cash-forecast')
        .send({
          openingCash: 100,
          periods: [
            { period: 'M1', inflows: 50, outflows: 200 },
            { period: 'M2', inflows: 10, outflows: 10 },
          ],
          minCash: 0,
        });
      expect(res.status).toBe(200);
      expect(res.body.data.forecast).toHaveLength(2);
      expect(res.body.data.forecast[0].closingCash).toBe(-50);
      expect(res.body.data.runway.runwayPeriods).toBe(0);
      expect(res.body.data.runway.cashOutPeriod).toBe('M1');
      expect(res.body.data.alerts.length).toBeGreaterThan(0);
      expect(res.body.data.curve).toHaveLength(2);
      expect(res.body.meta.contract).toBe('finance_planning_runtime_v1');
    });
  });

  describe('POST /rolling-forecast/* -> rollingForecastService', () => {
    it('reforecast blends actuals with plan', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-planning/rolling-forecast/reforecast')
        .send({
          plan: [
            { period: '2026-M01', value: 100 },
            { period: '2026-M02', value: 100 },
          ],
          actuals: [{ period: '2026-M01', value: 120 }],
        });
      expect(res.status).toBe(200);
      expect(res.body.data.lines).toEqual([
        { period: '2026-M01', value: 120, source: 'actual' },
        { period: '2026-M02', value: 100, source: 'forecast' },
      ]);
    });

    it('roll-forward extrapolates N periods from trailing trend', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-planning/rolling-forecast/roll-forward')
        .send({
          forecast: [
            { period: '2026-M01', value: 100 },
            { period: '2026-M02', value: 110 },
          ],
          byPeriods: 2,
        });
      expect(res.status).toBe(200);
      expect(res.body.data.lines).toHaveLength(2);
      expect(res.body.data.lines[0].value).toBe(120);
    });

    it('fy-bridge computes YTD actual + remaining forecast vs plan', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-planning/rolling-forecast/fy-bridge')
        .send({
          plan: [
            { period: '2026-M01', value: 100 },
            { period: '2026-M02', value: 100 },
          ],
          actuals: [{ period: '2026-M01', value: 150 }],
        });
      expect(res.status).toBe(200);
      expect(res.body.data.bridge).toMatchObject({
        fyPlan: 200,
        ytdActual: 150,
        remainingForecast: 100,
        fyForecast: 250,
        variance: 50,
      });
    });

    it('snapshot rejects missing label/createdPeriod', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-planning/rolling-forecast/snapshot')
        .send({ forecast: [] });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('ROLLING_FORECAST_INVALID_INPUT');
    });

    it('snapshot captures a labelled, deep-copied forecast', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-planning/rolling-forecast/snapshot')
        .send({
          forecast: [{ period: '2026-M01', value: 100 }],
          label: 'Q1 baseline',
          createdPeriod: '2026-M01',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.snapshot).toMatchObject({
        label: 'Q1 baseline',
        createdPeriod: '2026-M01',
        lines: [{ period: '2026-M01', value: 100 }],
      });
    });
  });

  describe('POST /headcount/* -> headcountPlannerService', () => {
    const roles = [
      { id: 'r1', title: 'Eng', baseSalary: 10000, benefitsLoadPct: 0.25, startPeriod: 0, rampMonths: 0 },
    ];
    const periods = ['M1', 'M2'];

    it('opex aggregates headcount/salary/loaded cost per period', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-planning/headcount/opex')
        .send({ roles, periods });
      expect(res.status).toBe(200);
      expect(res.body.data.rows).toHaveLength(2);
      expect(res.body.data.rows[0]).toMatchObject({
        period: 'M1',
        headcount: 1,
        totalSalary: 10000,
        totalLoaded: 12500,
      });
    });

    it('cash applies payroll lag to loaded cost', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-planning/headcount/cash')
        .send({ roles, periods, payLagPeriods: 1 });
      expect(res.status).toBe(200);
      expect(res.body.data.rows[0].cashOut).toBe(0);
      expect(res.body.data.rows[1].cashOut).toBe(12500);
    });

    it('summary reports roster-level loaded annual average', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-planning/headcount/summary')
        .send({ roles });
      expect(res.status).toBe(200);
      expect(res.body.data.summary).toEqual({ totalRoles: 1, avgLoadedAnnual: 150000 });
    });

    it('role-cost validates role object + numeric period', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-planning/headcount/role-cost')
        .send({ role: roles[0] });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('HEADCOUNT_INVALID_INPUT');
    });

    it('role-cost returns single-role, single-period cost', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-planning/headcount/role-cost')
        .send({ role: roles[0], period: 0 });
      expect(res.status).toBe(200);
      expect(res.body.data.cost).toEqual({ baseSalary: 10000, loadedCost: 12500, isRamped: false });
    });
  });

  describe('POST /run-rate/* -> runRatePhasingService', () => {
    it('split divides total into run-rate + one-time', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-planning/run-rate/split')
        .send({ benefit: { totalValue: 1000, runRateShare: 0.6 } });
      expect(res.status).toBe(200);
      expect(res.body.data.split).toEqual({ runRate: 600, oneTime: 400 });
    });

    it('phasing-curve validates required numeric fields', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-planning/run-rate/phasing-curve')
        .send({ fullRunRate: 1200 });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('RUN_RATE_INVALID_INPUT');
    });

    it('phasing-curve produces a monotonic ramp to full run-rate', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-planning/run-rate/phasing-curve')
        .send({ fullRunRate: 1200, rampMonths: 3, horizonMonths: 4, shape: 'linear' });
      expect(res.status).toBe(200);
      expect(res.body.data.curve.points).toHaveLength(4);
      expect(res.body.data.curve.points[2].runRateAttained).toBe(1);
    });

    it('in-year pro-rates the full-year run-rate', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-planning/run-rate/in-year')
        .send({ benefit: { totalValue: 1200, runRateShare: 1 }, monthsRemainingInYear: 6 });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ inYearImpact: 600, fullYearRunRate: 1200 });
    });

    it('bankable sums only run-rate value across benefits', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-planning/run-rate/bankable')
        .send({
          benefits: [
            { totalValue: 1000, runRateShare: 0.5 },
            { totalValue: 500, runRateShare: 1 },
          ],
        });
      expect(res.status).toBe(200);
      expect(res.body.data.bankableValue).toBe(1000);
    });
  });

  describe('POST /driver-tree/* -> driverTreeService', () => {
    const nodes = [
      { id: 'customers', label: 'Customers', kind: 'input', value: 100 },
      { id: 'arpu', label: 'ARPU', kind: 'input', value: 50 },
      {
        id: 'revenue',
        label: 'Revenue',
        kind: 'formula',
        op: '*',
        operands: ['customers', 'arpu'],
      },
    ];

    it('evaluate computes topological values', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-planning/driver-tree/evaluate')
        .send({ nodes });
      expect(res.status).toBe(200);
      expect(res.body.data.values.revenue).toBe(5000);
      expect(res.body.data.order[res.body.data.order.length - 1]).toBe('revenue');
    });

    it('evaluate 400s on a cyclic tree instead of 500ing', async () => {
      const cyclic = [
        { id: 'a', label: 'A', kind: 'formula', op: '+', operands: ['b'] },
        { id: 'b', label: 'B', kind: 'formula', op: '+', operands: ['a'] },
      ];
      const res = await request(createApp())
        .post('/api/v8/finance-planning/driver-tree/evaluate')
        .send({ nodes: cyclic });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DRIVER_TREE_CYCLE');
    });

    it('propagate reports before/after/delta for a changed input', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-planning/driver-tree/propagate')
        .send({ nodes, changedId: 'customers', newValue: 200 });
      expect(res.status).toBe(200);
      expect(res.body.data.before.revenue).toBe(5000);
      expect(res.body.data.after.revenue).toBe(10000);
      expect(res.body.data.delta.revenue).toBe(5000);
    });

    it('chart builds a recursive DriverTree component shape', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-planning/driver-tree/chart')
        .send({ nodes });
      expect(res.status).toBe(200);
      expect(res.body.data.root.id).toBe('revenue');
      expect(res.body.data.root.children.map((c: any) => c.id)).toEqual(['customers', 'arpu']);
    });
  });

  describe('POST /nl-to-model -> nlToModelService (rule-based, no LLM call)', () => {
    it('validates non-empty text', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-planning/nl-to-model')
        .send({ text: '' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('NL_TO_MODEL_INVALID_INPUT');
    });

    it('parses drivers + builds driver tree + assumptions from free text', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-planning/nl-to-model')
        .send({ text: 'SaaS z 500 klientów, ARPU wynosi 200 PLN, horyzont 12 miesięcy' });
      expect(res.status).toBe(200);
      expect(res.body.data.spec.detected.businessType).toBe('SaaS');
      expect(res.body.data.spec.detected.currency).toBe('PLN');
      expect(res.body.data.spec.detected.horizon).toBe(12);
      expect(res.body.data.driverTree.nodes.some((n: any) => n.id === 'revenue')).toBe(true);
      expect(res.body.data.assumptions.customers).toBe(500);
    });
  });
});
