/**
 * M22 L-08 — Route-integration tests for Wave 8 agent-runtime routes.
 *
 * Mounts the REAL wave8-agents router (`/api/ai-agents/*`) and verifies key
 * GET/POST endpoints return the expected envelope, are org-scoped, and propagate
 * the allowed/blocked (201/403, 200/403) status codes the route encodes.
 *
 * wave8AgentRuntimeService is fully mocked — no real DB.
 */

import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeTestApp } from '../_helpers/testApp';

const svc = vi.hoisted(() => ({
  listWave8AgentDefinitions: vi.fn(),
  upsertWave8AgentDefinition: vi.fn(),
  launchWave8Agent: vi.fn(),
  executeWave8AgentTool: vi.fn(),
  listWave8AgentRuns: vi.fn(),
  listWave8AgentSchedules: vi.fn(),
  processDueWave8AgentSchedules: vi.fn(),
  listWave8AgentNotifications: vi.fn(),
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/services/wave8AgentRuntimeService.js', () => svc);

const BASE = '/api/ai-agents';
const ORG = 'org-wave8';
const USER = 'user-wave8';

let router: any;

const makeApp = () =>
  makeTestApp({
    mountPath: BASE,
    router,
    beforeMount: (app) => {
      app.use((req: any, _res, next) => {
        req.user = { id: USER, organizationId: ORG, role: 'admin' };
        next();
      });
    },
  });

beforeEach(async () => {
  vi.clearAllMocks();
  router = (await import('../../../server/src/routes/wave8-agents.routes.ts')).default;
});

describe('M22 L-08 — Wave 8 /api/ai-agents routes', () => {
  it('GET /catalog returns 200 with { success, agents } scoped to org', async () => {
    svc.listWave8AgentDefinitions.mockResolvedValue([{ id: 'agent-1', name: 'Researcher' }]);

    const res = await request(makeApp()).get(`${BASE}/catalog`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(res.body.agents).toEqual([{ id: 'agent-1', name: 'Researcher' }]);
    expect(svc.listWave8AgentDefinitions).toHaveBeenCalledWith({ organizationId: ORG });
  });

  it('GET /runs returns 200 with { success, runs } and honors limit', async () => {
    svc.listWave8AgentRuns.mockResolvedValue([{ id: 'run-1', status: 'completed' }]);

    const res = await request(makeApp()).get(`${BASE}/runs`).query({ limit: '5' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, runs: [{ id: 'run-1' }] });
    expect(svc.listWave8AgentRuns).toHaveBeenCalledWith({ organizationId: ORG, limit: 5 });
  });

  it('GET /schedules returns 200 with { success, schedules }', async () => {
    svc.listWave8AgentSchedules.mockResolvedValue([{ id: 'sch-1', cron: '0 9 * * *' }]);

    const res = await request(makeApp()).get(`${BASE}/schedules`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, schedules: [{ id: 'sch-1' }] });
    expect(svc.listWave8AgentSchedules).toHaveBeenCalledWith({ organizationId: ORG });
  });

  it('GET /notifications returns 200 with { success, notifications }', async () => {
    svc.listWave8AgentNotifications.mockResolvedValue([{ id: 'n-1' }]);

    const res = await request(makeApp()).get(`${BASE}/notifications`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, notifications: [{ id: 'n-1' }] });
    expect(svc.listWave8AgentNotifications).toHaveBeenCalledWith({ organizationId: ORG, limit: 50 });
  });

  it('POST /definitions upserts a definition → 201 with { success, definition }', async () => {
    svc.upsertWave8AgentDefinition.mockResolvedValue({ id: 'agent-9', name: 'Analyst' });

    const res = await request(makeApp())
      .post(`${BASE}/definitions`)
      .send({ name: 'Analyst', tools: ['search'] });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, definition: { id: 'agent-9' } });
    expect(svc.upsertWave8AgentDefinition).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG, userId: USER })
    );
  });

  it('POST /launch returns 201 when service allows the launch', async () => {
    svc.launchWave8Agent.mockResolvedValue({ allowed: true, runId: 'run-x' });

    const res = await request(makeApp())
      .post(`${BASE}/launch`)
      .send({ agentId: 'agent-1', goal: 'do a thing' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, allowed: true, runId: 'run-x' });
    expect(svc.launchWave8Agent).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG, userId: USER, agentId: 'agent-1' })
    );
  });

  it('POST /launch returns 403 + success:false when service blocks the launch', async () => {
    svc.launchWave8Agent.mockResolvedValue({ allowed: false, reason: 'budget_exceeded' });

    const res = await request(makeApp())
      .post(`${BASE}/launch`)
      .send({ agentId: 'agent-1', goal: 'x' });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, allowed: false, reason: 'budget_exceeded' });
  });

  it('POST /tool returns 200 when service allows the tool call', async () => {
    svc.executeWave8AgentTool.mockResolvedValue({ allowed: true, output: { ok: true } });

    const res = await request(makeApp())
      .post(`${BASE}/tool`)
      .send({ agentId: 'agent-1', toolName: 'search', toolInput: { q: 'hi' } });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, allowed: true });
  });
});
