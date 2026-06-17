/**
 * M22 L-08 — Route-integration tests for Wave 9 outcome / AI-Ops routes.
 *
 * Mounts the REAL wave9-outcomes router (`/api/ai-outcomes/*`) and verifies:
 *   - GET endpoints (outcomes, acceptance-runs, aiops) return the expected
 *     envelope, scoped to the caller org;
 *   - POST /outcomes / /provider-health / /eval-runs return 201;
 *   - the in-route `requireAIOpsVerifier` privilege guard blocks non-privileged
 *     callers on /evidence and /acceptance-runs (500 from thrown Error) while
 *     allowing admins through (201);
 *   - POST /acceptance encodes BLOCKED → 409 vs ACCEPTED → 201.
 *
 * wave9OutcomeRuntimeService is fully mocked — no real DB.
 */

import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeTestApp } from '../_helpers/testApp';

const svc = vi.hoisted(() => ({
  buildWave9AIOpsDashboard: vi.fn(),
  buildWave9FinanceScenarios: vi.fn(),
  buildWave9Report: vi.fn(),
  createWave9Outcome: vi.fn(),
  listWave9AcceptanceRuns: vi.fn(),
  listWave9Outcomes: vi.fn(),
  recordWave9EvalRun: vi.fn(),
  recordWave9Incident: vi.fn(),
  recordWave9ProviderHealth: vi.fn(),
  registerWave9AcceptanceRun: vi.fn(),
  registerWave9Evidence: vi.fn(),
  runWave9FinalAcceptance: vi.fn(),
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/services/wave9OutcomeRuntimeService.js', () => svc);

const BASE = '/api/ai-outcomes';
const ORG = 'org-wave9';
const USER = 'user-wave9';

let router: any;

const ADMIN_USER = { id: USER, organizationId: ORG, role: 'admin' };
const MEMBER_USER = { id: 'member-1', organizationId: ORG, role: 'member' };

const makeApp = (user: Record<string, unknown> = ADMIN_USER) =>
  makeTestApp({
    mountPath: BASE,
    router,
    beforeMount: (app) => {
      app.use((req: any, _res, next) => {
        req.user = user;
        next();
      });
    },
  });

beforeEach(async () => {
  vi.clearAllMocks();
  router = (await import('../../../server/src/routes/wave9-outcomes.routes.ts')).default;
});

describe('M22 L-08 — Wave 9 /api/ai-outcomes routes', () => {
  it('GET /outcomes returns 200 with { success, outcomes } scoped to org', async () => {
    svc.listWave9Outcomes.mockResolvedValue([{ id: 'out-1', kpiName: 'cycle_time' }]);

    const res = await request(makeApp()).get(`${BASE}/outcomes`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(res.body.outcomes).toEqual([{ id: 'out-1', kpiName: 'cycle_time' }]);
    expect(svc.listWave9Outcomes).toHaveBeenCalledWith({ organizationId: ORG });
  });

  it('GET /aiops returns 200 with { success, dashboard } scoped to org', async () => {
    svc.buildWave9AIOpsDashboard.mockResolvedValue({ providerHealth: [], incidents: [] });

    const res = await request(makeApp()).get(`${BASE}/aiops`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, dashboard: { incidents: [] } });
    expect(svc.buildWave9AIOpsDashboard).toHaveBeenCalledWith({ organizationId: ORG });
  });

  it('GET /acceptance-runs returns 200 with { success, acceptanceRuns }', async () => {
    svc.listWave9AcceptanceRuns.mockResolvedValue([{ id: 'acc-1', status: 'pass' }]);

    const res = await request(makeApp()).get(`${BASE}/acceptance-runs`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, acceptanceRuns: [{ id: 'acc-1' }] });
  });

  it('POST /outcomes returns 201 with { success, outcome } and org/user scoping', async () => {
    svc.createWave9Outcome.mockResolvedValue({ id: 'out-new' });

    const res = await request(makeApp())
      .post(`${BASE}/outcomes`)
      .send({ initiativeId: 'init-1', kpiName: 'nps', baseline: 10, target: 50 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, outcome: { id: 'out-new' } });
    expect(svc.createWave9Outcome).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG, userId: USER, initiativeId: 'init-1', kpiName: 'nps' })
    );
  });

  it('POST /provider-health returns 201 with { success, health }', async () => {
    svc.recordWave9ProviderHealth.mockResolvedValue({ id: 'ph-1', status: 'healthy' });

    const res = await request(makeApp())
      .post(`${BASE}/provider-health`)
      .send({ provider: 'anthropic', status: 'healthy', latencyMs: 120 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, health: { id: 'ph-1' } });
    expect(svc.recordWave9ProviderHealth).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG, provider: 'anthropic' })
    );
  });

  it('POST /eval-runs returns 201 with { success, evalRun }', async () => {
    svc.recordWave9EvalRun.mockResolvedValue({ id: 'ev-1', status: 'pass' });

    const res = await request(makeApp())
      .post(`${BASE}/eval-runs`)
      .send({ promptKey: 'golden-1', status: 'pass', score: 0.95 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, evalRun: { id: 'ev-1' } });
  });

  // ── requireAIOpsVerifier privilege guard ────────────────────────────────────

  it('POST /evidence as ADMIN passes the verifier guard → 201', async () => {
    svc.registerWave9Evidence.mockResolvedValue({ id: 'evi-1', status: 'pass' });

    const res = await request(makeApp(ADMIN_USER))
      .post(`${BASE}/evidence`)
      .send({ evidenceType: 'kpi', sourceType: 'outcome', sourceId: 'out-1' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, evidence: { id: 'evi-1' } });
    expect(svc.registerWave9Evidence).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG, verifiedBy: USER })
    );
  });

  it('POST /evidence as plain MEMBER is rejected by requireAIOpsVerifier (no service call)', async () => {
    const res = await request(makeApp(MEMBER_USER))
      .post(`${BASE}/evidence`)
      .send({ evidenceType: 'kpi', sourceType: 'outcome', sourceId: 'out-1' });

    // requireAIOpsVerifier throws → asyncHandler forwards to express default handler → 500.
    // The point: it is NOT a success, and the service was never reached.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(svc.registerWave9Evidence).not.toHaveBeenCalled();
  });

  it('POST /acceptance-runs as plain MEMBER is rejected by the verifier guard (no service call)', async () => {
    const res = await request(makeApp(MEMBER_USER))
      .post(`${BASE}/acceptance-runs`)
      .send({ runType: 'regression', status: 'pass' });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(svc.registerWave9AcceptanceRun).not.toHaveBeenCalled();
  });

  // ── final acceptance status encoding ─────────────────────────────────────────

  it('POST /acceptance returns 201 when the gate decision is not BLOCKED', async () => {
    svc.runWave9FinalAcceptance.mockResolvedValue({ decision: 'ACCEPTED', gates: {} });

    const res = await request(makeApp())
      .post(`${BASE}/acceptance`)
      .send({ regressionPassed: true });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, decision: 'ACCEPTED' });
  });

  it('POST /acceptance returns 409 when the gate decision is BLOCKED', async () => {
    svc.runWave9FinalAcceptance.mockResolvedValue({ decision: 'BLOCKED', gates: { openP0: 2 } });

    const res = await request(makeApp())
      .post(`${BASE}/acceptance`)
      .send({ regressionPassed: false, openP0: 2 });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: true, decision: 'BLOCKED' });
  });
});
