import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import financeValueRouter from '../../../server/src/routes/v8/financeValueRoutes.js';

const authState: { organizationId: string | null } = { organizationId: 'org-1' };

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = authState.organizationId
      ? { id: 'u-1', organizationId: authState.organizationId, role: 'ADMIN' }
      : undefined;
    next();
  });
  app.use('/api/v8/finance/value', financeValueRouter);
  return app;
}

const post = (path: string, body: unknown) =>
  request(createApp()).post(`/api/v8/finance/value${path}`).send(body as object);

describe('v8 finance value routes (M16/9.1)', () => {
  beforeEach(() => {
    authState.organizationId = 'org-1';
  });

  it('POST /value-bridge returns waterfall steps', async () => {
    const res = await post('/value-bridge', {
      initiatives: [
        { id: 'a', name: 'A', value: 100, stage: 'identified' },
        { id: 'b', name: 'B', value: 50, stage: 'realized' },
      ],
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.steps)).toBe(true);
    expect(res.body.data.steps.length).toBeGreaterThan(0);
  });

  it('POST /portfolio/prioritize ranks initiatives', async () => {
    const res = await post('/portfolio/prioritize', {
      initiatives: [
        { id: 'a', npv: 100, risk: 0.2, effort: 50 },
        { id: 'b', npv: 30, risk: 0.6, effort: 80 },
      ],
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0]).toHaveProperty('quadrant');
  });

  it('POST /capital/ration selects within budget', async () => {
    const res = await post('/capital/ration', {
      projects: [
        { id: 'a', npv: 4000, cost: 3000 },
        { id: 'b', npv: 3000, cost: 2000 },
        { id: 'c', npv: 1000, cost: 4000 },
      ],
      budget: 5000,
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.selected)).toBe(true);
    expect(res.body.data.totalCost).toBeLessThanOrEqual(5000);
  });

  it('POST /appraise computes NPV / verdict', async () => {
    const res = await post('/appraise', {
      cashFlows: [-1000, 400, 400, 400, 400],
      discountRate: 10,
      hurdleRatePct: 8,
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('npv');
    expect(res.body.data).toHaveProperty('verdict');
    expect(typeof res.body.data.npv).toBe('number');
  });

  it('POST /variance-bridge decomposes budget vs actual', async () => {
    const res = await post('/variance-bridge', {
      lines: [
        { label: 'Revenue', plan: 1000, actual: 900, isCost: false },
        { label: 'COGS', plan: 400, actual: 360, isCost: true },
      ],
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.steps)).toBe(true);
    expect(res.body.data).toHaveProperty('totalVariance');
  });

  it('POST /value-assurance summarizes realization', async () => {
    const res = await post('/value-assurance', {
      items: [
        {
          initiativeId: 'a',
          value: 100,
          attestedBy: 'cfo',
          provenance: 'ledger',
          evidenceReconciled: true,
        },
        { initiativeId: 'b', value: 50 },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('attestedPct');
    expect(res.body.data).toHaveProperty('coverage');
  });

  it('returns 401 for all endpoints when unauthenticated', async () => {
    authState.organizationId = null;
    for (const path of [
      '/value-bridge',
      '/portfolio/prioritize',
      '/capital/ration',
      '/appraise',
      '/variance-bridge',
      '/value-assurance',
    ]) {
      const res = await post(path, {});
      expect(res.status).toBe(401);
    }
  });
});
