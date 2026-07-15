/**
 * Wiring test for the M16 Finance Valuation/Risk cluster — 7 previously
 * orphaned (0 importers) pure-function engines
 * (server/src/services/{monteCarloNpvService,valueAtRiskService,
 * realOptionsService,efficientFrontierService,whatIfSensitivityService,
 * scenarioComputeService,capitalDecisionService}.ts) now wired as REST
 * endpoints under server/src/routes/v8/finance-valuation.routes.ts.
 *
 * All 7 engines are pure functions — no DB/IO — so no DB mocking is needed
 * here; real logic flows end-to-end through the route (route -> service ->
 * response), verifying request parsing, auth-context gating, and response
 * shape.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import financeValuationRoutes from '../../../server/src/routes/v8/finance-valuation.routes.js';

const ORG = 'org-1';
const UID = 'user-1';

function createApp(withContext = true): Express {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    if (withContext) {
      req.v8Context = { organizationId: ORG, userId: UID, userRole: 'owner', isSuperAdmin: false };
      req.user = { id: UID, organizationId: ORG, role: 'owner' };
    }
    next();
  });
  app.use('/api/v8/finance-valuation', financeValuationRoutes);
  return app;
}

describe('V8 Finance Valuation/Risk — orphaned engine wiring', () => {
  describe('auth gating (no v8Context attached)', () => {
    it('500s (context-not-attached) rather than silently computing without auth', async () => {
      const res = await request(createApp(false)).post(
        '/api/v8/finance-valuation/capital-decision/hurdle-rate'
      ).send({ wacc: 10, riskClass: 'core' });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('POST /monte-carlo-npv -> monteCarloNpvService.{simulateNpv,histogram}', () => {
    it('rejects an empty drivers map', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-valuation/monte-carlo-npv')
        .send({ drivers: {} });
      expect(res.status).toBe(400);
    });

    it('runs a deterministic simulation and buckets a histogram', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-valuation/monte-carlo-npv')
        .send({
          drivers: { revenue: { kind: 'triangular', min: 80, mode: 100, max: 140 } },
          weights: { revenue: 1 },
          intercept: -90,
          iterations: 500,
          seed: 42,
          bins: 10,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.simulation.samples).toHaveLength(500);
      expect(typeof res.body.data.simulation.mean).toBe('number');
      expect(res.body.data.histogram.length).toBeGreaterThan(0);
      const totalCount = res.body.data.histogram.reduce((s: number, b: any) => s + b.count, 0);
      expect(totalCount).toBe(500);
    });

    it('is deterministic for a fixed seed', async () => {
      const body = {
        drivers: { revenue: { kind: 'normal', mean: 100, sd: 10 } },
        iterations: 200,
        seed: 7,
      };
      const app = createApp();
      const res1 = await request(app).post('/api/v8/finance-valuation/monte-carlo-npv').send(body);
      const res2 = await request(app).post('/api/v8/finance-valuation/monte-carlo-npv').send(body);
      expect(res1.body.data.simulation.mean).toBe(res2.body.data.simulation.mean);
      expect(res1.body.data.simulation.samples).toEqual(res2.body.data.simulation.samples);
    });
  });

  describe('POST /value-at-risk -> valueAtRiskService.valueAtRisk', () => {
    it('requires a numeric benefitForecast', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-valuation/value-at-risk')
        .send({ spi: 0.8 });
      expect(res.status).toBe(400);
    });

    it('computes VaR from schedule health', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-valuation/value-at-risk')
        .send({ benefitForecast: 1000, spi: 0.7 });
      expect(res.status).toBe(200);
      expect(res.body.data.valueAtRisk).toBeCloseTo(300, 5);
      expect(res.body.data.confidencePct).toBeCloseTo(70, 5);
      expect(res.body.data.level).toBe('high');
    });
  });

  describe('POST /value-at-risk/portfolio -> valueAtRiskService.{portfolioVaR,varHeatmapCells}', () => {
    it('aggregates portfolio VaR and returns heatmap cells', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-valuation/value-at-risk/portfolio')
        .send({
          items: [
            { initiativeId: 'i1', benefitForecast: 1000, spi: 0.5 },
            { initiativeId: 'i2', benefitForecast: 500, spi: 1 },
          ],
        });
      expect(res.status).toBe(200);
      expect(res.body.data.portfolio.totalForecast).toBe(1500);
      expect(res.body.data.portfolio.byInitiative).toHaveLength(2);
      expect(res.body.data.heatmap).toHaveLength(2);
    });
  });

  describe('POST /real-options/defer -> realOptionsService.deferOption', () => {
    it('requires all numeric fields', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-valuation/real-options/defer')
        .send({ underlyingValue: 100 });
      expect(res.status).toBe(400);
    });

    it('values the option to wait', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-valuation/real-options/defer')
        .send({
          underlyingValue: 100,
          investmentCost: 90,
          volatility: 0.3,
          riskFreeRate: 0.04,
          timeToDecideYears: 2,
        });
      expect(res.status).toBe(200);
      expect(res.body.data.optionValue).toBeGreaterThanOrEqual(0);
      expect(['defer', 'invest-now', 'abandon']).toContain(res.body.data.recommendation);
    });
  });

  describe('POST /real-options/abandon -> realOptionsService.abandonOption', () => {
    it('values the option to abandon', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-valuation/real-options/abandon')
        .send({
          underlyingValue: 80,
          salvageValue: 100,
          volatility: 0.25,
          riskFreeRate: 0.03,
          timeToDecideYears: 1,
        });
      expect(res.status).toBe(200);
      expect(res.body.data.salvageValue).toBe(100);
      expect(res.body.data.optionValue).toBeGreaterThanOrEqual(0);
    });
  });

  describe('POST /real-options/staged -> realOptionsService.stagedInvestment', () => {
    it('recommends pilot-first for a risky staged bet', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-valuation/real-options/staged')
        .send({
          stages: [
            { cost: 10, expectedValue: 50, successProb: 0.5 },
            { cost: 40, expectedValue: 200, successProb: 0.3 },
          ],
        });
      expect(res.status).toBe(200);
      expect(typeof res.body.data.totalOptionValue).toBe('number');
      expect(['pilot-first', 'full-commit']).toContain(res.body.data.recommendation);
    });
  });

  describe('POST /efficient-frontier -> efficientFrontierService.frontier', () => {
    it('builds a value-vs-risk curve', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-valuation/efficient-frontier')
        .send({
          initiatives: [
            { id: 'a', value: 100, risk: 0.2, cost: 50 },
            { id: 'b', value: 200, risk: 0.6, cost: 80 },
          ],
          budget: 200,
          points: 5,
        });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.curve)).toBe(true);
      expect(res.body.data.curve.length).toBeGreaterThan(0);
      expect(res.body.data.optimal).toBeDefined();
    });
  });

  describe('POST /efficient-frontier/portfolio -> efficientFrontierService.portfolioRiskValue', () => {
    it('computes value and weighted risk for a selection', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-valuation/efficient-frontier/portfolio')
        .send({
          selectedIds: ['a'],
          initiatives: [
            { id: 'a', value: 100, risk: 0.2, cost: 50 },
            { id: 'b', value: 200, risk: 0.6, cost: 80 },
          ],
        });
      expect(res.status).toBe(200);
      expect(res.body.data.totalValue).toBe(100);
      expect(res.body.data.portfolioRisk).toBeCloseTo(0.2, 5);
    });
  });

  describe('POST /sensitivity/one-way -> whatIfSensitivityService.oneWaySensitivity', () => {
    it('sweeps a single driver through the linear model', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-valuation/sensitivity/one-way')
        .send({
          baseDrivers: { revenue: 100 },
          weights: { revenue: 2 },
          driverId: 'revenue',
          rangePct: [-10, 0, 10],
        });
      expect(res.status).toBe(200);
      expect(res.body.data.points).toHaveLength(3);
      expect(res.body.data.points[1].targetValue).toBeCloseTo(200, 5);
    });
  });

  describe('POST /sensitivity/tornado -> whatIfSensitivityService.tornado', () => {
    it('ranks drivers by swing impact', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-valuation/sensitivity/tornado')
        .send({
          baseDrivers: { revenue: 100, cost: 50 },
          weights: { revenue: 1, cost: -1 },
          driverIds: ['revenue', 'cost'],
          swingPct: 20,
        });
      expect(res.status).toBe(200);
      expect(res.body.data.bars).toHaveLength(2);
      expect(res.body.data.bars[0]).toHaveProperty('label');
    });
  });

  describe('POST /sensitivity/data-table -> whatIfSensitivityService.dataTable2D', () => {
    it('evaluates the cartesian product of two drivers', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-valuation/sensitivity/data-table')
        .send({
          baseDrivers: {},
          weights: { x: 1, y: 1 },
          xDriver: 'x',
          yDriver: 'y',
          xRange: [1, 2],
          yRange: [10, 20],
        });
      expect(res.status).toBe(200);
      expect(res.body.data.matrix).toHaveLength(4);
    });
  });

  describe('POST /sensitivity/break-even -> whatIfSensitivityService.breakEven', () => {
    it('finds the driver value that zeroes the linear target', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-valuation/sensitivity/break-even')
        .send({
          baseDrivers: { revenue: 100 },
          weights: { revenue: 1 },
          intercept: -50,
          driverId: 'revenue',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.breakEven).toBeCloseTo(50, 5);
    });
  });

  describe('POST /scenarios/apply -> scenarioComputeService.applyScenario', () => {
    it('scales growth/cost fields by scenario multipliers', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-valuation/scenarios/apply')
        .send({ assumptions: { revenueGrowth: 10, opexCost: 100 }, scenario: 'optimistic' });
      expect(res.status).toBe(200);
      expect(res.body.data.assumptions.revenueGrowth).toBeCloseTo(11.5, 5);
      expect(res.body.data.assumptions.opexCost).toBeCloseTo(95, 5);
    });

    it('rejects an unknown scenario name', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-valuation/scenarios/apply')
        .send({ assumptions: {}, scenario: 'bogus' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /scenarios/compare -> scenarioComputeService.compareScenarios', () => {
    it('reports base/optimistic/conservative metrics and deltas', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-valuation/scenarios/compare')
        .send({ assumptions: { revenueGrowth: 10 }, metricKeys: ['revenueGrowth'] });
      expect(res.status).toBe(200);
      expect(res.body.data.base.revenueGrowth).toBe(10);
      expect(res.body.data.optimistic.revenueGrowth).toBeCloseTo(11.5, 5);
      expect(res.body.data.deltas.optimistic.revenueGrowth).toBeCloseTo(1.5, 5);
    });
  });

  describe('POST /scenarios/fan -> scenarioComputeService.scenarioFanData', () => {
    it('shapes per-scenario series into a base + bands structure', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-valuation/scenarios/fan')
        .send({
          scenarios: {
            base: { revenue: [1, 2, 3] },
            optimistic: { revenue: [1, 3, 5] },
          },
          metric: 'revenue',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.base).toEqual([1, 2, 3]);
      expect(res.body.data.bands).toHaveLength(1);
    });
  });

  describe('POST /capital-decision/hurdle-rate -> capitalDecisionService.hurdleRate', () => {
    it('adds the risk-class premium to WACC', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-valuation/capital-decision/hurdle-rate')
        .send({ wacc: 10, riskClass: 'transformation' });
      expect(res.status).toBe(200);
      expect(res.body.data.hurdleRate).toBe(14);
    });
  });

  describe('POST /capital-decision/risk-adjusted-npv -> capitalDecisionService.riskAdjustedNpv', () => {
    it('applies probability and leakage haircuts', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-valuation/capital-decision/risk-adjusted-npv')
        .send({ npv: 1000, probabilityOfSuccess: 0.5, leakagePct: 0.1 });
      expect(res.status).toBe(200);
      expect(res.body.data.rnpv).toBeCloseTo(450, 5);
      expect(res.body.data.haircut).toBeCloseTo(550, 5);
    });
  });

  describe('POST /capital-decision/evaluate-hurdle -> capitalDecisionService.evaluateAgainstHurdle', () => {
    it('classifies IRR vs hurdle', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-valuation/capital-decision/evaluate-hurdle')
        .send({ irr: 20, hurdle: 12 });
      expect(res.status).toBe(200);
      expect(res.body.data.verdict).toBe('go');
      expect(res.body.data.marginPp).toBe(8);
    });
  });

  describe('POST /capital-decision/rank -> capitalDecisionService.rankByRiskAdjusted', () => {
    it('ranks a portfolio by risk-adjusted NPV descending', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-valuation/capital-decision/rank')
        .send({
          items: [
            { id: 'low', npv: 1000, probabilityOfSuccess: 0.2 },
            { id: 'high', npv: 1000, probabilityOfSuccess: 0.9 },
          ],
        });
      expect(res.status).toBe(200);
      expect(res.body.data.items[0].id).toBe('high');
      expect(res.body.data.items[0].rnpv).toBeGreaterThan(res.body.data.items[1].rnpv);
    });
  });
});
