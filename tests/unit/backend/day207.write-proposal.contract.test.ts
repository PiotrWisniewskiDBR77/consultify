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
vi.mock('../../../server/src/services/personalTask/createPersonalTaskService.js', () => ({
  createPersonalTask: vi.fn(async (input: any) => {
    const id = `day207-task-${++state.next}`;
    const ownerId = input.assigneeId || input.userId;
    const created = {
      id,
      title: input.title,
      description: input.description ?? null,
      status: 'todo',
      priority: input.priority || 'medium',
      dueDate: input.dueDate ?? null,
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      ownerId,
      reporterId: input.userId,
      idempotent: false,
    };
    state.tasks.push({ input, created });
    return created;
  }),
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

  // FIX-207 pkt 1 (ODBIOR_207.md) + FIX-207b (decyzja właściciela 2026-08-31):
  // pierwsza runda failowała jawnie tu (brak kanonicznego writera). Właściciel
  // rozstrzygnął: ten sam obiekt biznesowy co ręczne zadanie w My Work ma iść
  // TĄ SAMĄ drogą — `createPersonalTask()`. Ten test dowodzi, że mutacja
  // faktycznie zachodzi wyłącznie PO zatwierdzeniu, przez wspólny writer, i że
  // dociera do niego komplet pól (organizacja/autor/właściciel/projekt/
  // prowieniencja) — nie samo "coś się zapisało".
  it('mutates via the shared My Work writer only after approval, with full attribution', async () => {
    const { default: executor } = await import(
      '../../../server/src/services/aiActionExecutor.js'
    );
    const proposal = await executor.requestChatToolProposal({
      toolName: 'create_task',
      args: { title: 'Execute once', assignee_id: 'assignee-9' },
      userId: 'user-1',
      organizationId: 'org-1',
      projectId: 'project-1',
    });
    expect(state.tasks).toHaveLength(0);
    await executor.approveAction(proposal.actionId, 'reviewer-1');
    const execResult = await executor.executeAction(proposal.actionId, 'reviewer-1');
    expect(execResult.success).toBe(true);
    expect(state.tasks).toHaveLength(1);
    const { input } = state.tasks[0];
    expect(input).toMatchObject({
      organizationId: 'org-1',
      userId: 'user-1',
      title: 'Execute once',
      assigneeId: 'assignee-9',
      projectId: 'project-1',
      sourceType: 'ai_chat_proposal',
      sourceId: proposal.actionId,
    });
    expect(state.events).toEqual(
      expect.arrayContaining([
        'proposal_pending_review',
        'proposal_approved',
        'execution_started',
        'execution_succeeded',
      ])
    );
  });

  // FIX-207 pkt 2 (ODBIOR_207.md): the delivered suite only ever called
  // executeAction() AFTER approveAction(), so the `status !== APPROVED` gate
  // in aiActionExecutor.ts (`executeAction`, ~line 836) was never exercised —
  // breaking that gate would not have turned this suite red. This scenario
  // calls executeAction() on a still-PENDING action, skipping approveAction()
  // entirely, and asserts the execution is refused.
  //
  // Deliberately uses GENERATE_REPORT (not CREATE_DRAFT_TASK/DECISION) and
  // seeds the PENDING action directly into the mocked `ai_actions` table
  // instead of going through requestChatToolProposal. This isolates the
  // assertion to ONLY the approval gate: GENERATE_REPORT never reaches a
  // legacy `tasks`/`decisions` INSERT or the FIX-1 canonical-writer guard
  // above, so a red result here can only mean the approval gate itself
  // regressed — not a collision with an unrelated guard.
  it('refuses to execute an action that was never approved', async () => {
    const { default: executor } = await import(
      '../../../server/src/services/aiActionExecutor.js'
    );
    const actionId = 'day207-unapproved-1';
    state.actions.set(actionId, {
      id: actionId,
      user_id: 'user-1',
      organization_id: 'org-1',
      project_id: 'project-1',
      action_type: 'GENERATE_REPORT',
      payload: '{}',
      status: 'PENDING',
    });

    const result = await executor.executeAction(actionId, 'reviewer-1');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not APPROVED/);
    expect(state.actions.get(actionId).status).toBe('PENDING');
    expect(state.events).not.toContain('execution_started');
    expect(state.events).not.toContain('execution_succeeded');
  });
});
