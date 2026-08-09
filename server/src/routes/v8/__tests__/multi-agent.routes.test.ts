import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getWorkGraph = vi.fn();
const executeReadyWorkGraphBranches = vi.fn();
const retryBranchTask = vi.fn();
const cancelWorkGraph = vi.fn();
const proposeWorkGraphSynthesis = vi.fn();
const resolveWorkGraphContradiction = vi.fn();

vi.mock('../../../services/v8/multiAgentWorkManagerService.js', () => ({
  createWorkGraph: vi.fn(),
  synthesizeWorkGraph: vi.fn(),
  getWorkGraph,
  executeReadyWorkGraphBranches,
  retryBranchTask,
  cancelWorkGraph,
  proposeWorkGraphSynthesis,
  resolveWorkGraphContradiction,
}));
vi.mock('../../../services/v8/executionSpineService.js', () => ({ getRun: vi.fn() }));

async function buildApp(userId: string, userRole = 'CONSULTANT') {
  const { default: router } = await import('../multi-agent.routes.js');
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).v8Context = { organizationId: 'org-a', userId, userRole, isSuperAdmin: false };
    next();
  });
  app.use('/api/v8/multi-agent', router);
  return app;
}

describe('multi-agent routes RBAC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hides an existing graph from a non-owner in the same tenant', async () => {
    getWorkGraph.mockResolvedValue({ graph: { created_by: 'owner-a' }, tasks: [] });
    const response = await request(await buildApp('user-b'))
      .post('/api/v8/multi-agent/graphs/graph-1/execute-ready')
      .send({});
    expect(response.status).toBe(404);
    expect(executeReadyWorkGraphBranches).not.toHaveBeenCalled();
  });

  it('allows the graph owner to execute ready branches', async () => {
    getWorkGraph.mockResolvedValue({ graph: { created_by: 'owner-a' }, tasks: [] });
    executeReadyWorkGraphBranches.mockResolvedValue([{ taskId: 'branch-1', status: 'completed' }]);
    const response = await request(await buildApp('owner-a'))
      .post('/api/v8/multi-agent/graphs/graph-1/execute-ready')
      .send({ limit: 2 });
    expect(response.status).toBe(200);
    expect(executeReadyWorkGraphBranches).toHaveBeenCalledWith(
      expect.objectContaining({
        graphId: 'graph-1',
        organizationId: 'org-a',
        userId: 'owner-a',
        limit: 2,
      })
    );
  });

  it('allows an organization owner to cancel but not cross tenant scope', async () => {
    getWorkGraph.mockResolvedValue({ graph: { created_by: 'another-user' }, tasks: [] });
    cancelWorkGraph.mockResolvedValue(undefined);
    const response = await request(await buildApp('org-owner', 'OWNER'))
      .post('/api/v8/multi-agent/graphs/graph-1/cancel')
      .send({});
    expect(response.status).toBe(200);
    expect(cancelWorkGraph).toHaveBeenCalledWith({ graphId: 'graph-1', organizationId: 'org-a' });
  });

  it('passes only authenticated tenant and actor context into synthesis approval', async () => {
    proposeWorkGraphSynthesis.mockResolvedValue({
      proposalId: 'proposal-1',
      runState: 'waiting_for_review',
    });
    const response = await request(await buildApp('owner-a'))
      .post('/api/v8/multi-agent/graphs/graph-1/propose-synthesis')
      .send({ organizationId: 'org-foreign', actorUserId: 'attacker' });
    expect(response.status).toBe(201);
    expect(proposeWorkGraphSynthesis).toHaveBeenCalledWith({
      graphId: 'graph-1',
      organizationId: 'org-a',
      actorUserId: 'owner-a',
    });
  });

  it('uses the authenticated reviewer for contradiction resolution and ignores body identity', async () => {
    getWorkGraph.mockResolvedValue({ graph: { created_by: 'owner-a' }, tasks: [] });
    resolveWorkGraphContradiction.mockResolvedValue({
      graphStatus: 'completed',
      unresolvedCount: 0,
    });
    const response = await request(await buildApp('owner-a'))
      .post('/api/v8/multi-agent/graphs/graph-1/resolve-contradiction')
      .send({
        claimKey: 'go',
        resolutionType: 'choose_branch',
        sourceTaskId: 'branch-finance',
        selectedValue: true,
        rationale: 'Reconciled finance evidence is authoritative.',
        actorUserId: 'attacker',
        organizationId: 'org-foreign',
      });
    expect(response.status).toBe(200);
    expect(resolveWorkGraphContradiction).toHaveBeenCalledWith(
      expect.objectContaining({
        graphId: 'graph-1',
        organizationId: 'org-a',
        actorUserId: 'owner-a',
        claimKey: 'go',
      })
    );
  });
});
