import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { vi } from 'vitest';

const authState = vi.hoisted(() => ({
  userId: 'u-1' as string | null,
  organizationId: 'org-1' as string | null,
  role: 'ADMIN' as string | null,
}));

// Pass-through auth: verifyToken populates req.user (or clears it), isAuthenticated
// is a no-op. The route's own requireOrg() then produces the 401 when org is absent.
vi.mock('../../../server/src/middleware/auth.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/middleware/auth.middleware.js'
  )) as Record<string, unknown>;
  return {
    ...actual,
    verifyToken: (req: any, _res: any, next: any) => {
      if (!authState.userId) {
        req.user = undefined;
      } else {
        req.user = {
          id: authState.userId,
          organizationId: authState.organizationId,
          role: authState.role || 'ADMIN',
        };
      }
      next();
    },
    isAuthenticated: (_req: any, _res: any, next: any) => next(),
  };
});

const { default: executionAnalyticsRouter } = await import(
  '../../../server/src/routes/executionAnalytics.routes.js'
);

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/execution-analytics', executionAnalyticsRouter);
  return app;
}

function authed() {
  authState.userId = 'u-1';
  authState.organizationId = 'org-1';
  authState.role = 'ADMIN';
}

describe('executionAnalytics routes', () => {
  it('returns 401 when the caller has no organization', async () => {
    authState.userId = 'u-1';
    authState.organizationId = null;
    const app = createApp();

    const res = await request(app).post('/api/execution-analytics/predict').send({ spi: 0.7 });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('POST /predict returns {overall, delay, overrun, reasons}', async () => {
    authed();
    const app = createApp();

    const res = await request(app)
      .post('/api/execution-analytics/predict')
      .send({ spi: 0.75, cpi: 0.75, slipDays: 5, slipTrend: 'worsening', openHighRisks: 3 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('overall');
    expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(res.body.overall);
    expect(res.body).toHaveProperty('delay');
    expect(res.body.delay).toHaveProperty('level');
    expect(res.body.delay).toHaveProperty('score');
    expect(res.body).toHaveProperty('overrun');
    expect(Array.isArray(res.body.reasons)).toBe(true);
    // Severe inputs → escalated to CRITICAL.
    expect(res.body.overall).toBe('CRITICAL');
  });

  it('POST /triage returns {summary, prioritized, topActions, byInitiative}', async () => {
    authed();
    const app = createApp();

    const res = await request(app)
      .post('/api/execution-analytics/triage')
      .send({
        signals: [
          { id: 's1', type: 'BLOCKED_LONG', severity: 'HIGH', title: 'Blocked', initiativeId: 'i1' },
          { id: 's2', type: 'UNOWNED_RISK', severity: 'CRITICAL', title: 'No owner', initiativeId: 'i1' },
          { id: 's3', type: 'OVERDUE_TASK', severity: 'LOW', title: 'Late task' },
        ],
      });

    expect(res.status).toBe(200);
    expect(typeof res.body.summary).toBe('string');
    expect(Array.isArray(res.body.prioritized)).toBe(true);
    expect(res.body.prioritized).toHaveLength(3);
    // CRITICAL sorts to the top.
    expect(res.body.prioritized[0].signal.id).toBe('s2');
    expect(res.body.prioritized[0].rank).toBe(1);
    expect(Array.isArray(res.body.topActions)).toBe(true);
    expect(res.body.byInitiative).toHaveProperty('i1');
    expect(res.body.byInitiative).toHaveProperty('__unassigned__');
    expect(res.body.byInitiative.i1).toHaveLength(2);
  });

  it('POST /dependencies/analyze returns {cycles, topoOrder, cascade, criticalChain}', async () => {
    authed();
    const app = createApp();

    const res = await request(app)
      .post('/api/execution-analytics/dependencies/analyze')
      .send({
        edges: [
          { fromId: 'A', toId: 'B' },
          { fromId: 'B', toId: 'C' },
          { fromId: 'A', toId: 'C' },
        ],
        delayedIds: ['A'],
        durations: { A: 2, B: 3, C: 1 },
      });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.cycles)).toBe(true);
    expect(res.body.cycles).toHaveLength(0);
    expect(res.body.topoOrder).toHaveProperty('order');
    expect(res.body.topoOrder.hasCycle).toBe(false);
    expect(res.body.topoOrder.order[0]).toBe('A');
    // Everything downstream of A is affected (A excluded).
    expect(res.body.cascade.sort()).toEqual(['B', 'C']);
    // Longest path A→B→C.
    expect(res.body.criticalChain).toEqual(['A', 'B', 'C']);
  });

  it('POST /dependencies/analyze detects a cycle', async () => {
    authed();
    const app = createApp();

    const res = await request(app)
      .post('/api/execution-analytics/dependencies/analyze')
      .send({
        edges: [
          { fromId: 'A', toId: 'B' },
          { fromId: 'B', toId: 'A' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.cycles.length).toBeGreaterThan(0);
    expect(res.body.topoOrder.hasCycle).toBe(true);
    // Critical chain is undefined for a cyclic graph.
    expect(res.body.criticalChain).toEqual([]);
  });

  it('POST /capacity/analyze returns {utilization, demand, heatmap, overloads}', async () => {
    authed();
    const app = createApp();

    const res = await request(app)
      .post('/api/execution-analytics/capacity/analyze')
      .send({
        allocations: [
          {
            resourceId: 'r1',
            initiativeId: 'i1',
            allocatedFte: 1.5,
            periodStart: '2026-01-01',
            periodEnd: '2026-03-31',
          },
        ],
        capacities: [{ resourceId: 'r1', availableFte: 1.0 }],
        periods: ['2026-02-01'],
      });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.utilization)).toBe(true);
    expect(res.body.utilization).toHaveLength(1);
    expect(res.body.utilization[0].status).toBe('over');
    expect(res.body.demand).toHaveProperty('totalCapacity', 1);
    expect(res.body.demand).toHaveProperty('totalDemand', 1.5);
    expect(Array.isArray(res.body.heatmap)).toBe(true);
    expect(res.body.heatmap[0].cells).toHaveLength(1);
    // r1 is over-allocated → surfaced as an overload.
    expect(res.body.overloads).toHaveLength(1);
    expect(res.body.overloads[0].resourceId).toBe('r1');
  });

  it('handles empty bodies gracefully (200, empty shapes)', async () => {
    authed();
    const app = createApp();

    const triage = await request(app).post('/api/execution-analytics/triage').send({});
    expect(triage.status).toBe(200);
    expect(triage.body.prioritized).toHaveLength(0);

    const deps = await request(app)
      .post('/api/execution-analytics/dependencies/analyze')
      .send({});
    expect(deps.status).toBe(200);
    expect(deps.body.cycles).toHaveLength(0);

    const cap = await request(app).post('/api/execution-analytics/capacity/analyze').send({});
    expect(cap.status).toBe(200);
    expect(cap.body.utilization).toHaveLength(0);
  });

  // M14-wire (2026-07-15): capacitySignalService — severity-graded signals
  it('POST /capacity/signals returns {signals, portfolio} and grades overload severity', async () => {
    authed();
    const app = createApp();

    const res = await request(app)
      .post('/api/execution-analytics/capacity/signals')
      .send({
        allocations: [
          { resourceId: 'r1', initiativeId: 'i1', allocatedFte: 2.0, periodStart: '2026-01-01', periodEnd: '2026-03-31' },
          { resourceId: 'r2', initiativeId: 'i1', allocatedFte: 0.1, periodStart: '2026-01-01', periodEnd: '2026-03-31' },
        ],
        capacities: [
          { resourceId: 'r1', availableFte: 1.0 },
          { resourceId: 'r2', availableFte: 1.0 },
        ],
      });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.signals)).toBe(true);
    // r1: 200% util → CRITICAL overload; r2: 10% util → underutilized (LOW)
    const overload = res.body.signals.find((s: any) => s.resourceId === 'r1');
    expect(overload.type).toBe('CAPACITY_OVERLOAD');
    expect(overload.severity).toBe('CRITICAL');
    const under = res.body.signals.find((s: any) => s.resourceId === 'r2');
    expect(under.type).toBe('CAPACITY_UNDERUTILIZED');
    expect(res.body.portfolio.balance).toBe('critical');
    expect(res.body.portfolio.overloadedCount).toBe(1);
  });

  it('POST /capacity/signals returns healthy portfolio + no signals on empty input', async () => {
    authed();
    const app = createApp();

    const res = await request(app).post('/api/execution-analytics/capacity/signals').send({});
    expect(res.status).toBe(200);
    expect(res.body.signals).toHaveLength(0);
    expect(res.body.portfolio.balance).toBe('healthy');
  });

  it('returns 401 for /capacity/signals without an organization', async () => {
    authState.userId = 'u-1';
    authState.organizationId = null;
    const app = createApp();

    const res = await request(app).post('/api/execution-analytics/capacity/signals').send({});
    expect(res.status).toBe(401);
  });

  // M14-wire (2026-07-15): peopleChangeReadinessService — ADKAR roll-up
  it('POST /readiness/analyze rolls up adoption signals into an ADKAR result', async () => {
    authed();
    const app = createApp();

    const res = await request(app).post('/api/execution-analytics/readiness/analyze').send({
      communicationCoveragePct: 90,
      sentimentTrend: 'improving',
      sentimentAvg: 0.8,
      capabilityGapPct: 10,
      reinforcementFollowups: 3,
    });

    expect(res.status).toBe(200);
    expect(res.body.readiness).toHaveProperty('overall');
    expect(res.body.readiness.overall).toBeGreaterThan(3);
    expect(res.body.readiness.readiness).toBe('READY');
    expect(res.body.laneProblem).toBeNull();
  });

  it('POST /readiness/analyze surfaces an AT_RISK lane problem on poor signals', async () => {
    authed();
    const app = createApp();

    const res = await request(app).post('/api/execution-analytics/readiness/analyze').send({
      communicationCoveragePct: 5,
      sentimentTrend: 'declining',
      sentimentAvg: 0.1,
    });

    expect(res.status).toBe(200);
    expect(res.body.readiness.readiness).toBe('AT_RISK');
    expect(res.body.laneProblem).not.toBeNull();
    expect(res.body.laneProblem.severity).toBe('critical');
  });

  it('POST /readiness/analyze returns UNKNOWN + null problem for an empty body', async () => {
    authed();
    const app = createApp();

    const res = await request(app).post('/api/execution-analytics/readiness/analyze').send({});
    expect(res.status).toBe(200);
    expect(res.body.readiness.overall).toBeNull();
    expect(res.body.readiness.readiness).toBe('UNKNOWN');
    expect(res.body.laneProblem).toBeNull();
  });

  it('returns 401 for /readiness/analyze without an organization', async () => {
    authState.userId = 'u-1';
    authState.organizationId = null;
    const app = createApp();

    const res = await request(app).post('/api/execution-analytics/readiness/analyze').send({});
    expect(res.status).toBe(401);
  });
});
