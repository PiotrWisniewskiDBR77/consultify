import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import financeValueRouter from '../../../server/src/routes/v8/financeValueRoutes.js';

const authState: { organizationId: string | null } = { organizationId: 'org-1' };

function createApp() {
  const app = express();
  app.use(express.json());
  // Pass-through auth that mirrors the real middleware contract: it only sets
  // req.user when a session exists. Routes resolve org from req.user.
  app.use((req: any, _res, next) => {
    if (authState.organizationId) {
      req.user = { id: 'u-1', organizationId: authState.organizationId, role: 'ADMIN' };
    } else {
      req.user = undefined;
    }
    next();
  });
  app.use('/api/v8/finance/value', financeValueRouter);
  return app;
}

describe('v8 finance value routes (M16/9.1)', () => {
  beforeEach(() => {
    authState.organizationId = 'org-1';
  });

  it('POST /value-bridge returns a waterfall', async () => {
    const res = await request(createApp())
      .post('/api/v8/finance/value/value-bridge')
      .send({
        initiatives: [
          { id: 'a', name: 'A', value: 100 },
          { id: 'b', name: 'B', benefit: 50, cost: 80 },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.meta.contract).toBe('finance_value_compute_v1');
    expect(Array.isArray(res.body.data.steps)).toBe(true);
    expect(res.body.data.steps).toHaveLength(2);
    expect(res.body.data.total).toBe(70);
    expect(res.body.data.steps[1].cumulative).toBe(70);
  });

  it('POST /portfolio/prioritize ranks by value-per-effort', async () => {
    const res = await request(createApp())
      .post('/api/v8/finance/value/portfolio/prioritize')
      .send({
        initiatives: [
          { id: 'low', value: 10, effort: 10 },
          { id: 'high', value: 100, effort: 5 },
        ],
      });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.ranked)).toBe(true);
    expect(res.body.data.topId).toBe('high');
    expect(res.body.data.ranked[0].rank).toBe(1);
  });

  it('POST /capital/ration selects within budget', async () => {
    const res = await request(createApp())
      .post('/api/v8/finance/value/capital/ration')
      .send({
        projects: [
          { id: 'p1', cost: 60, value: 70 },
          { id: 'p2', cost: 50, value: 60 },
          { id: 'p3', cost: 50, value: 40 },
        ],
        budget: 100,
      });
    expect(res.status).toBe(200);
    // budget 100: {p2,p3}=cost100/value100 beats {p1}=cost60/value70.
    expect(Array.isArray(res.body.data.selected)).toBe(true);
    expect(res.body.data.totalCost).toBeLessThanOrEqual(100);
    expect(res.body.data.totalValue).toBe(100);
    expect(res.body.data.selectedIds).toEqual(expect.arrayContaining(['p2', 'p3']));
  });

  it('POST /appraise computes NPV / IRR / payback', async () => {
    const res = await request(createApp())
      .post('/api/v8/finance/value/appraise')
      .send({ cashFlows: [-100, 60, 60, 60], discountRate: 0.1 });
    expect(res.status).toBe(200);
    expect(typeof res.body.data.npv).toBe('number');
    expect(res.body.data.npv).toBeGreaterThan(0);
    expect(res.body.data.irr).toBeGreaterThan(0);
    expect(res.body.data.paybackPeriod).toBe(2);
  });

  it('POST /variance-bridge decomposes budget vs actual', async () => {
    const res = await request(createApp())
      .post('/api/v8/finance/value/variance-bridge')
      .send({
        lines: [
          { id: 'l1', name: 'Salaries', budget: 100, actual: 90, kind: 'cost' },
          { id: 'l2', name: 'Sales', budget: 200, actual: 230, kind: 'revenue' },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.data.steps).toHaveLength(2);
    expect(res.body.data.totalVariance).toBe(20);
    expect(res.body.data.steps[0].favorable).toBe(true);
    expect(res.body.data.steps[1].favorable).toBe(true);
  });

  it('POST /value-assurance summarizes realization', async () => {
    const res = await request(createApp())
      .post('/api/v8/finance/value/value-assurance')
      .send({
        items: [
          { id: 'i1', planned: 100, realized: 95 },
          { id: 'i2', planned: 100, realized: 40 },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.totalPlanned).toBe(200);
    expect(res.body.data.totalRealized).toBe(135);
    expect(res.body.data.items[0].status).toBe('green');
    expect(res.body.data.items[1].status).toBe('red');
    expect(res.body.data.atRiskCount).toBeGreaterThanOrEqual(1);
  });

  it('returns 401 for every endpoint when unauthenticated', async () => {
    authState.organizationId = null;
    const app = createApp();
    const paths = [
      '/api/v8/finance/value/value-bridge',
      '/api/v8/finance/value/portfolio/prioritize',
      '/api/v8/finance/value/capital/ration',
      '/api/v8/finance/value/appraise',
      '/api/v8/finance/value/variance-bridge',
      '/api/v8/finance/value/value-assurance',
    ];
    for (const path of paths) {
      const res = await request(app).post(path).send({});
      expect(res.status).toBe(401);
    }
  });
});
