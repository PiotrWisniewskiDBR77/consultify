import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  actions: new Map<string, any>(),
  tasks: [] as any[],
  events: [] as string[],
  next: 0,
  roleBlocked: false,
}));

vi.mock('uuid', () => ({ v4: () => `day207-${++state.next}` }));
vi.mock('../../../server/src/services/aiPolicyEngine.js', () => ({
  default: {
    canPerformAction: vi.fn(async () => ({
      allowed: true,
      requiresApproval: false,
      requiredLevel: 'ASSISTED',
      currentLevel: 'ASSISTED',
    })),
  },
}));
vi.mock('../../../server/src/services/approvalPatternService.js', () => ({
  default: { __unavailable__: true },
}));
vi.mock('../../../server/src/services/aiRoleGuard.js', () => ({
  default: {
    isActionBlocked: vi.fn(async () =>
      state.roleBlocked
        ? { blocked: true, reason: 'ROLE_DENIED', currentRole: 'OBSERVER', roleRequired: 'EDITOR' }
        : { blocked: false, requiresApproval: true }
    ),
  },
}));
vi.mock('../../../server/src/services/regulatoryModeGuard.js', () => ({
  default: { enforceRegulatoryMode: vi.fn(async () => ({ blocked: false })) },
}));
vi.mock('../../../server/src/services/notificationService.js', () => ({
  default: { __unavailable__: true },
}));
vi.mock('../../../server/src/services/aiRunLedgerService.js', () => ({
  ensureRunForAction: vi.fn(async (action: any) => ({ run_id: `run-${action.id}` })),
  getAIRunByAction: vi.fn(async (id: string) => ({ run_id: `run-${id}` })),
  recordAIRunEvent: vi.fn(async ({ action, eventType }: any) => {
    state.events.push(eventType);
    return { run_id: `run-${action.id}` };
  }),
  recordLegacyAuditSafely: vi.fn(async (fn: () => unknown) => fn()),
}));
vi.mock('../../../server/src/services/initiative/createInitiativeService.js', () => ({
  createInitiative: vi.fn(),
}));
vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  run: vi.fn(async (sql: string, params: any[] = []) => {
    const q = sql.replace(/\s+/g, ' ').trim();
    if (q.startsWith('INSERT INTO ai_actions')) {
      const [id, userId, organizationId, projectId, actionType, payload, , , , status] = params;
      state.actions.set(id, {
        id,
        user_id: userId,
        organization_id: organizationId,
        project_id: projectId,
        action_type: actionType,
        payload,
        status,
      });
      return { changes: 1 };
    }
    if (q.startsWith('UPDATE ai_actions SET draft_content')) {
      const [draftContent, id] = params;
      state.actions.get(id).draft_content = draftContent;
      return { changes: 1 };
    }
    if (q.includes("SET status = 'APPROVED'")) {
      const [, id] = params;
      state.actions.get(id).status = 'APPROVED';
      return { changes: 1 };
    }
    if (q.includes("SET status = 'EXECUTING'")) return { changes: 1 };
    if (q.startsWith('INSERT INTO tasks')) {
      state.tasks.push(params);
      return { changes: 1 };
    }
    if (q.includes("SET status = 'EXECUTED'")) return { changes: 1 };
    return { changes: 1 };
  }),
  get: vi.fn(async (sql: string, params: any[] = []) => {
    if (sql.includes('FROM ai_actions')) return state.actions.get(params[0]) || null;
    return null;
  }),
  all: vi.fn(async () => []),
}));

describe('Day207 WRITE-as-proposal contract', () => {
  beforeEach(() => {
    state.actions.clear();
    state.tasks.length = 0;
    state.events.length = 0;
    state.next = 0;
    state.roleBlocked = false;
  });

  it('fails closed for a role without WRITE permission and creates no proposal or task', async () => {
    state.roleBlocked = true;
    const { default: executor } = await import(
      '../../../server/src/services/aiActionExecutor.js'
    );
    const result = await executor.requestChatToolProposal({
      toolName: 'create_task',
      args: { title: 'Forbidden' },
      userId: 'viewer-1',
      organizationId: 'org-1',
      projectId: 'project-1',
    });
    expect(result).toMatchObject({ success: false, blocked: true, error: 'ROLE_DENIED' });
    expect(state.actions.size).toBe(0);
    expect(state.tasks).toHaveLength(0);
  });

  it('fails closed when project context is absent', async () => {
    const { default: executor } = await import(
      '../../../server/src/services/aiActionExecutor.js'
    );
    const result = await executor.requestChatToolProposal({
      toolName: 'create_task',
      args: { title: 'No project' },
      userId: 'user-1',
      organizationId: 'org-1',
      projectId: null,
    });
    expect(result).toMatchObject({ success: false, blocked: true, error: 'PROJECT_CONTEXT_REQUIRED' });
    expect(state.actions.size).toBe(0);
    expect(state.tasks).toHaveLength(0);
  });

  it('creates a pending proposal without mutating tasks', async () => {
    const { default: executor } = await import(
      '../../../server/src/services/aiActionExecutor.js'
    );
    const result = await executor.requestChatToolProposal({
      toolName: 'create_task',
      args: { title: 'Approve me', description: 'Day207 proof' },
      userId: 'user-1',
      organizationId: 'org-1',
      projectId: 'project-1',
      conversationId: 'conversation-1',
    });
    expect(result).toMatchObject({ success: true, requiresApproval: true, status: 'PENDING' });
    expect(state.tasks).toHaveLength(0);
    expect(JSON.parse(state.actions.get(result.actionId).draft_content)).toMatchObject({
      title: 'Approve me',
    });
    expect(state.events).toContain('proposal_pending_review');
  });

  it('mutates exactly once only after approval and records execution audit events', async () => {
    const { default: executor } = await import(
      '../../../server/src/services/aiActionExecutor.js'
    );
    const proposal = await executor.requestChatToolProposal({
      toolName: 'create_task',
      args: { title: 'Execute once' },
      userId: 'user-1',
      organizationId: 'org-1',
      projectId: 'project-1',
    });
    expect(state.tasks).toHaveLength(0);
    await executor.approveAction(proposal.actionId, 'reviewer-1');
    await executor.executeAction(proposal.actionId, 'reviewer-1');
    expect(state.tasks).toHaveLength(1);
    expect(state.events).toEqual(
      expect.arrayContaining(['proposal_pending_review', 'proposal_approved', 'execution_started', 'execution_succeeded'])
    );
  });
});
