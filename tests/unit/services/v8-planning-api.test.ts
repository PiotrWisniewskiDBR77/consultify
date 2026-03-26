import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8Put: vi.fn(),
}));

import { V8PlanningApi } from '@/services/api/v8/planning';
import { v8Get } from '@/services/api/v8/client';

describe('V8PlanningApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests portfolio reads from the V8 planning namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      initiatives: [{ id: 'init-1', name: 'Alpha', axis: 'operational', status: 'EXECUTING' }],
      stats: {
        total: 1,
        byStatus: { EXECUTING: 1 },
        executing: 1,
        approved: 0,
        review: 0,
        blockedCount: 0,
        done: 0,
        totalBudget: 10,
        totalValue: 20,
        avgProgress: 50,
      },
    } as any);

    const data = await V8PlanningApi.getPortfolio({
      projectId: 'proj-1',
      status: 'EXECUTING',
      priority: ['HIGH', 'MEDIUM'],
      search: 'alpha',
    });

    expect(v8Get).toHaveBeenCalledWith(
      '/planning/initiatives/portfolio?projectId=proj-1&status=EXECUTING&priority=HIGH&priority=MEDIUM&search=alpha'
    );
    expect(data.initiatives).toHaveLength(1);
  });

  it('requests initiative detail from the V8 planning namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      initiative: { id: 'init-1', name: 'Alpha' },
    } as any);

    const data = await V8PlanningApi.getInitiative('init-1');

    expect(v8Get).toHaveBeenCalledWith('/planning/initiatives/init-1');
    expect((data as any).id).toBe('init-1');
  });

  it('requests initiative task dependencies from the V8 planning namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      dependencies: [
        {
          id: 'dep-1',
          sourceTaskId: 'task-2',
          taskId: 'task-1',
          taskTitle: 'Define scope',
          dependencyType: 'FS',
          lagDays: 0,
          direction: 'predecessor',
        },
      ],
    } as any);

    const data = await V8PlanningApi.getTaskDependencies('init-1');

    expect(v8Get).toHaveBeenCalledWith('/planning/initiatives/init-1/task-dependencies');
    expect(data[0]?.id).toBe('dep-1');
  });

  it('requests initiative governance support reads from the V8 planning namespace', async () => {
    vi.mocked(v8Get).mockResolvedValueOnce({
      watchers: [{ id: 'watch-1', userId: 'user-1' }],
    } as any);
    vi.mocked(v8Get).mockResolvedValueOnce({
      stakeholders: [{ id: 'stake-1', userId: 'user-2', raciType: 'A' }],
    } as any);
    vi.mocked(v8Get).mockResolvedValueOnce({
      roles: [{ id: 'role-1', gateRole: 'PROJECT_SPONSOR', userId: 'user-3', source: 'explicit' }],
    } as any);
    vi.mocked(v8Get).mockResolvedValueOnce({
      history: [{ id: 'hist-1', initiativeId: 'init-1', fromStatus: 'DRAFT', toStatus: 'REVIEW', createdAt: '2026-03-25T00:00:00Z' }],
    } as any);

    const watchers = await V8PlanningApi.getWatchers('init-1');
    const stakeholders = await V8PlanningApi.getStakeholders('init-1');
    const roles = await V8PlanningApi.getGateRoles('init-1');
    const history = await V8PlanningApi.getStatusHistory('init-1');

    expect(v8Get).toHaveBeenNthCalledWith(1, '/planning/initiatives/init-1/watchers');
    expect(v8Get).toHaveBeenNthCalledWith(2, '/planning/initiatives/init-1/stakeholders');
    expect(v8Get).toHaveBeenNthCalledWith(3, '/planning/initiatives/init-1/gate-roles');
    expect(v8Get).toHaveBeenNthCalledWith(4, '/planning/initiatives/init-1/status-history');
    expect(watchers[0]?.id).toBe('watch-1');
    expect(stakeholders[0]?.id).toBe('stake-1');
    expect(roles[0]?.id).toBe('role-1');
    expect(history[0]?.id).toBe('hist-1');
  });

  it('requests initiative content reads from the V8 planning namespace', async () => {
    vi.mocked(v8Get).mockResolvedValueOnce({
      events: [{ id: 'evt-1', eventType: 'status_changed', createdAt: '2026-03-26T00:00:00Z' }],
    } as any);
    vi.mocked(v8Get).mockResolvedValueOnce({
      comments: [{ id: 'comment-1', content: 'Looks good', createdAt: '2026-03-26T00:00:00Z', likes: 0, likedByMe: false }],
    } as any);

    const history = await V8PlanningApi.getHistory('init-1');
    const comments = await V8PlanningApi.getComments('init-1');

    expect(v8Get).toHaveBeenNthCalledWith(1, '/planning/initiatives/init-1/history');
    expect(v8Get).toHaveBeenNthCalledWith(2, '/planning/initiatives/init-1/comments');
    expect(history[0]?.id).toBe('evt-1');
    expect(comments[0]?.id).toBe('comment-1');
  });

  it('requests initiative governance runtime reads from the V8 planning namespace', async () => {
    vi.mocked(v8Get).mockResolvedValueOnce({
      readiness: {
        currentStatus: 'PLANNING',
        userRoles: ['PMO'],
        availableTransitions: [],
        readiness: [],
        allBlocking: true,
        allWarnings: true,
      },
    } as any);
    vi.mocked(v8Get).mockResolvedValueOnce({
      resources: [{ id: 'res-1', role: 'Engineer' }],
    } as any);

    const readiness = await V8PlanningApi.getGateReadiness('init-1');
    const resources = await V8PlanningApi.getResources('init-1');

    expect(v8Get).toHaveBeenNthCalledWith(1, '/planning/initiatives/init-1/gate-readiness-check');
    expect(v8Get).toHaveBeenNthCalledWith(2, '/planning/initiatives/init-1/resources');
    expect(readiness.currentStatus).toBe('PLANNING');
    expect(resources[0]?.id).toBe('res-1');
  });

  it('requests initiative resource detail reads from the V8 planning namespace', async () => {
    vi.mocked(v8Get).mockResolvedValueOnce({
      kpis: [{ id: 'kpi-1', name: 'Revenue uplift' }],
    } as any);
    vi.mocked(v8Get).mockResolvedValueOnce({
      budgetItems: [{ id: 'budget-1', category: 'software' }],
    } as any);
    vi.mocked(v8Get).mockResolvedValueOnce({
      tools: [{ id: 'tool-1', name: 'Notion' }],
    } as any);
    vi.mocked(v8Get).mockResolvedValueOnce({
      intangibleAssets: [{ id: 'ia-1', name: 'Enablement pack' }],
    } as any);

    const kpis = await V8PlanningApi.getKpis('init-1');
    const budgetItems = await V8PlanningApi.getBudgetItems('init-1');
    const tools = await V8PlanningApi.getTools('init-1');
    const intangibleAssets = await V8PlanningApi.getIntangibleAssets('init-1');

    expect(v8Get).toHaveBeenNthCalledWith(1, '/planning/initiatives/init-1/kpis');
    expect(v8Get).toHaveBeenNthCalledWith(2, '/planning/initiatives/init-1/budget-items');
    expect(v8Get).toHaveBeenNthCalledWith(3, '/planning/initiatives/init-1/tools');
    expect(v8Get).toHaveBeenNthCalledWith(4, '/planning/initiatives/init-1/intangible-assets');
    expect(kpis[0]?.id).toBe('kpi-1');
    expect(budgetItems[0]?.id).toBe('budget-1');
    expect(tools[0]?.id).toBe('tool-1');
    expect(intangibleAssets[0]?.id).toBe('ia-1');
  });

  it('requests initiative raid reads from the V8 planning namespace', async () => {
    vi.mocked(v8Get).mockResolvedValueOnce({
      items: [{ id: 'raid-1', type: 'risk', title: 'Vendor risk' }],
    } as any);

    const items = await V8PlanningApi.getRaid('init-1', 25);

    expect(v8Get).toHaveBeenCalledWith('/planning/initiatives/init-1/raid?limit=25');
    expect(items[0]?.id).toBe('raid-1');
  });

  it('requests initiative snapshots from the V8 planning namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      initiativeId: '00000000-0000-4000-8000-000000000010',
      decompositionTree: [],
      wbsCompleteness: { complete: true, gaps: [] },
      criticalPath: [],
      crossInitiativeDependencies: [],
      decisionChains: [],
    });

    const data = await V8PlanningApi.getInitiativeSnapshot(
      '00000000-0000-4000-8000-000000000010',
    );

    expect(v8Get).toHaveBeenCalledWith(
      '/planning/initiatives/00000000-0000-4000-8000-000000000010/snapshot',
    );
    expect(data.wbsCompleteness.complete).toBe(true);
  });

  it('requests pending decision chains from the V8 planning namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      pendingDecisionChains: [
        {
          chainId: 'chain-1',
          organizationId: 'org-1',
          initiativeId: 'init-1',
          chainType: 'sequential',
          decisions: [{ decisionId: 'd-1', title: 'Approve scope', role: 'sponsor', status: 'pending' }],
          status: 'pending',
          createdAt: '2026-03-25T00:00:00Z',
          updatedAt: '2026-03-25T00:00:00Z',
          metadata: {},
        },
      ],
    });

    const data = await V8PlanningApi.getPendingDecisions();

    expect(v8Get).toHaveBeenCalledWith('/planning/pending-decisions');
    expect(data.pendingDecisionChains).toHaveLength(1);
    expect(data.pendingDecisionChains[0]?.decisions[0]?.status).toBe('pending');
  });
});
