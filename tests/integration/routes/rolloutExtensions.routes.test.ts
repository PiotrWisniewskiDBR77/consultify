/**
 * M14 Wdrożenie (Execution) — F5 Rollout Extensions route tests.
 *
 * Covers server/src/routes/rolloutExtensions.routes.ts: stages, baselines,
 * cutover runbooks/steps, and the stage-boundary gate.
 *
 * Strategy (per task spec):
 *   - auth (verifyToken / isAuthenticated) and permission (requirePermission)
 *     middleware are mocked as pass-throughs injecting a configurable user.
 *   - the four F5 services are mocked so we assert the routes wire GET/POST/PATCH
 *     to the right service call with the authenticated org id (org-scope) and the
 *     expected positional args — without touching a DB.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted service mocks ─────────────────────────────────────────────────────

const svc = vi.hoisted(() => ({
  listStages: vi.fn(),
  createStage: vi.fn(),
  updateStage: vi.fn(),
  advanceStage: vi.fn(),
  listBaselines: vi.fn(),
  captureBaseline: vi.fn(),
  getLatestBaseline: vi.fn(),
  getRunbook: vi.fn(),
  createRunbook: vi.fn(),
  addStep: vi.fn(),
  evaluateStageGate: vi.fn(),
}));

vi.mock('../../../server/src/services/rolloutStagesService.js', () => ({
  listStages: (...a: any[]) => svc.listStages(...a),
  createStage: (...a: any[]) => svc.createStage(...a),
  updateStage: (...a: any[]) => svc.updateStage(...a),
  advanceStage: (...a: any[]) => svc.advanceStage(...a),
}));

vi.mock('../../../server/src/services/rolloutBaselineService.js', () => ({
  listBaselines: (...a: any[]) => svc.listBaselines(...a),
  captureBaseline: (...a: any[]) => svc.captureBaseline(...a),
  getLatestBaseline: (...a: any[]) => svc.getLatestBaseline(...a),
}));

vi.mock('../../../server/src/services/cutoverRunbookService.js', () => ({
  getRunbook: (...a: any[]) => svc.getRunbook(...a),
  createRunbook: (...a: any[]) => svc.createRunbook(...a),
  addStep: (...a: any[]) => svc.addStep(...a),
}));

vi.mock('../../../server/src/services/rolloutGateService.js', () => ({
  evaluateStageGate: (...a: any[]) => svc.evaluateStageGate(...a),
}));

// ── Auth + permission middleware mocked as pass-throughs ──────────────────────

let mockUser: { id: string; organizationId: string; role: string } | null = null;

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.user = mockUser;
    req.userId = mockUser.id;
    req.organizationId = mockUser.organizationId;
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../server/src/middleware/rbac.middleware.js', () => ({
  requireOrgRole:
    (..._roles: string[]) =>
    (_req: any, _res: any, next: () => void) =>
      next(),
}));

vi.mock('../../../server/src/middleware/permissionMiddleware.js', () => ({
  requirePermission:
    (_key: string) =>
    (_req: any, _res: any, next: () => void) =>
      next(),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ── App factory ───────────────────────────────────────────────────────────────

async function makeApp(): Promise<Express> {
  const { default: router } = await import(
    '../../../server/src/routes/rolloutExtensions.routes.js'
  );
  const app = express();
  app.use(express.json());
  app.use('/api/rollout-ext', router);
  return app;
}

const ORG_A = 'org-aaa';
const USER_A = { id: 'user-a', organizationId: ORG_A, role: 'ADMIN' };

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = USER_A;
});

// ── Stages ────────────────────────────────────────────────────────────────────

describe('F5 rollout extensions — stages', () => {
  it('GET /stages calls listStages with org + projectId from query', async () => {
    const app = await makeApp();
    svc.listStages.mockResolvedValue([{ id: 's1' }]);

    const res = await request(app).get('/api/rollout-ext/stages?projectId=proj-1');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.stages[0].id).toBe('s1');
    expect(svc.listStages).toHaveBeenCalledWith(ORG_A, 'proj-1');
  });

  it('GET /stages with no projectId passes undefined', async () => {
    const app = await makeApp();
    svc.listStages.mockResolvedValue([]);

    await request(app).get('/api/rollout-ext/stages');

    expect(svc.listStages).toHaveBeenCalledWith(ORG_A, undefined);
  });

  it('POST /stages routes a valid body to createStage with org', async () => {
    const app = await makeApp();
    svc.createStage.mockResolvedValue({ id: 's-new' });

    const res = await request(app)
      .post('/api/rollout-ext/stages')
      .send({ name: 'Pilot wave', waveType: 'pilot' });

    expect(res.status).toBe(201);
    expect(res.body.stage.id).toBe('s-new');
    expect(svc.createStage).toHaveBeenCalledWith(
      ORG_A,
      expect.objectContaining({ name: 'Pilot wave', waveType: 'pilot' })
    );
  });

  it('POST /stages rejects an invalid waveType with 400 (validation)', async () => {
    const app = await makeApp();
    const res = await request(app)
      .post('/api/rollout-ext/stages')
      .send({ name: 'Bad', waveType: 'nonsense' });

    expect(res.status).toBe(400);
    expect(svc.createStage).not.toHaveBeenCalled();
  });

  it('PATCH /stages/:id routes to updateStage with org + id', async () => {
    const app = await makeApp();
    svc.updateStage.mockResolvedValue({ id: 's1', status: 'active' });

    const res = await request(app)
      .patch('/api/rollout-ext/stages/s1')
      .send({ status: 'active' });

    expect(res.status).toBe(200);
    expect(svc.updateStage).toHaveBeenCalledWith(
      ORG_A,
      's1',
      expect.objectContaining({ status: 'active' })
    );
  });

  it('PATCH /stages/:id returns 404 when the service returns null', async () => {
    const app = await makeApp();
    svc.updateStage.mockResolvedValue(null);

    const res = await request(app).patch('/api/rollout-ext/stages/missing').send({ name: 'x' });

    expect(res.status).toBe(404);
  });

  it('POST /stages/:id/advance routes to advanceStage with org + id', async () => {
    const app = await makeApp();
    svc.advanceStage.mockResolvedValue({ id: 's1', status: 'gated' });

    const res = await request(app).post('/api/rollout-ext/stages/s1/advance');

    expect(res.status).toBe(200);
    expect(res.body.stage.status).toBe('gated');
    expect(svc.advanceStage).toHaveBeenCalledWith(ORG_A, 's1');
  });
});

// ── Baselines ───────────────────────────────────────────────────────────────

describe('F5 rollout extensions — baselines', () => {
  it('GET /baselines calls listBaselines with org + projectId', async () => {
    const app = await makeApp();
    svc.listBaselines.mockResolvedValue([{ id: 'b1' }]);

    const res = await request(app).get('/api/rollout-ext/baselines?projectId=proj-1');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(svc.listBaselines).toHaveBeenCalledWith(ORG_A, 'proj-1');
  });

  it('GET /baselines without projectId returns 400', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/rollout-ext/baselines');
    expect(res.status).toBe(400);
    expect(svc.listBaselines).not.toHaveBeenCalled();
  });

  it('GET /baselines/latest calls getLatestBaseline with org + projectId', async () => {
    const app = await makeApp();
    svc.getLatestBaseline.mockResolvedValue({ id: 'b-latest' });

    const res = await request(app).get('/api/rollout-ext/baselines/latest?projectId=proj-1');

    expect(res.status).toBe(200);
    expect(res.body.baseline.id).toBe('b-latest');
    expect(svc.getLatestBaseline).toHaveBeenCalledWith(ORG_A, 'proj-1');
  });

  it('POST /baselines calls captureBaseline with org, project, snapshot, createdBy', async () => {
    const app = await makeApp();
    svc.captureBaseline.mockResolvedValue({ id: 'b-new' });

    const res = await request(app)
      .post('/api/rollout-ext/baselines')
      .send({ projectId: 'proj-1', snapshot: { tasks: 3 }, label: 'Kickoff' });

    expect(res.status).toBe(201);
    expect(svc.captureBaseline).toHaveBeenCalledWith(
      ORG_A,
      'proj-1',
      { tasks: 3 },
      expect.objectContaining({ label: 'Kickoff', createdBy: USER_A.id })
    );
  });
});

// ── Cutover ───────────────────────────────────────────────────────────────────

describe('F5 rollout extensions — cutover', () => {
  it('GET /cutover/:initiativeId routes to getRunbook with org', async () => {
    const app = await makeApp();
    svc.getRunbook.mockResolvedValue({ id: 'rb1', steps: [] });

    const res = await request(app).get('/api/rollout-ext/cutover/init-1');

    expect(res.status).toBe(200);
    expect(res.body.runbook.id).toBe('rb1');
    expect(svc.getRunbook).toHaveBeenCalledWith(ORG_A, 'init-1');
  });

  it('GET /cutover/:initiativeId returns 404 when no runbook', async () => {
    const app = await makeApp();
    svc.getRunbook.mockResolvedValue(null);

    const res = await request(app).get('/api/rollout-ext/cutover/init-x');
    expect(res.status).toBe(404);
  });

  it('POST /cutover routes to createRunbook with org', async () => {
    const app = await makeApp();
    svc.createRunbook.mockResolvedValue({ id: 'rb-new' });

    const res = await request(app)
      .post('/api/rollout-ext/cutover')
      .send({ name: 'Go-live', initiativeId: 'init-1' });

    expect(res.status).toBe(201);
    expect(svc.createRunbook).toHaveBeenCalledWith(
      ORG_A,
      expect.objectContaining({ name: 'Go-live', initiativeId: 'init-1' })
    );
  });

  it('POST /cutover/:runbookId/steps routes to addStep with org + runbookId', async () => {
    const app = await makeApp();
    svc.addStep.mockResolvedValue({ id: 'step-1' });

    const res = await request(app)
      .post('/api/rollout-ext/cutover/rb1/steps')
      .send({ title: 'Freeze writes' });

    expect(res.status).toBe(201);
    expect(svc.addStep).toHaveBeenCalledWith(
      ORG_A,
      'rb1',
      expect.objectContaining({ title: 'Freeze writes' })
    );
  });
});

// ── Gate ────────────────────────────────────────────────────────────────────

describe('F5 rollout extensions — gate', () => {
  it('POST /gate/evaluate routes the body to evaluateStageGate', async () => {
    const app = await makeApp();
    svc.evaluateStageGate.mockReturnValue({
      decision: 'GO',
      reasons: ['all gate criteria met'],
      unmetMetrics: [],
      openBlockers: [],
      pendingSignOffs: [],
    });

    const res = await request(app)
      .post('/api/rollout-ext/gate/evaluate')
      .send({ gateMetrics: [{ name: 'Adoption', met: true }] });

    expect(res.status).toBe(200);
    expect(res.body.result.decision).toBe('GO');
    expect(svc.evaluateStageGate).toHaveBeenCalledWith(
      expect.objectContaining({ gateMetrics: [{ name: 'Adoption', met: true }] })
    );
  });
});

// ── Auth gate ────────────────────────────────────────────────────────────────

describe('F5 rollout extensions — auth / org-scope', () => {
  it('401 when there is no authenticated user', async () => {
    const app = await makeApp();
    mockUser = null;

    const res = await request(app).get('/api/rollout-ext/stages');
    expect(res.status).toBe(401);
    expect(svc.listStages).not.toHaveBeenCalled();
  });
});
