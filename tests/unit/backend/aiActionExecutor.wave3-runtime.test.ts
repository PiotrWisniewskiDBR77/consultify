import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;

const db = vi.hoisted(() => ({
  actions: new Map<string, Row>(),
  ledgers: new Map<string, Row>(),
  events: [] as Row[],
  tasks: [] as Row[],
  auditLogs: [] as Row[],
  uuidCounter: 0,
}));

const approvalPatternService = vi.hoisted(() => ({
  service: {
    __unavailable__: true as boolean | undefined,
    canAutoDecide: vi.fn(),
    recordDecision: vi.fn(),
  },
}));

const aiPolicyEngine = vi.hoisted(() => ({
  canPerformAction: vi.fn(),
}));

function resetDb() {
  db.actions.clear();
  db.ledgers.clear();
  db.events.length = 0;
  db.tasks.length = 0;
  db.auditLogs.length = 0;
  db.uuidCounter = 0;
  approvalPatternService.service.__unavailable__ = true;
  approvalPatternService.service.canAutoDecide.mockReset();
  approvalPatternService.service.canAutoDecide.mockResolvedValue({ canAutoDecide: false });
  approvalPatternService.service.recordDecision.mockReset();
  aiPolicyEngine.canPerformAction.mockReset();
  aiPolicyEngine.canPerformAction.mockResolvedValue({
    allowed: true,
    requiresApproval: false,
    requiredLevel: 'standard',
    currentLevel: 'standard',
  });
}

function nextUuid() {
  db.uuidCounter += 1;
  return `wave3-id-${db.uuidCounter}`;
}

vi.mock('uuid', () => ({
  v4: () => nextUuid(),
}));

vi.mock('../../../server/src/services/aiPolicyEngine.js', () => ({
  default: aiPolicyEngine,
}));

vi.mock('../../../server/src/services/approvalPatternService.js', () => ({
  default: approvalPatternService.service,
}));

vi.mock('../../../server/src/services/notificationService.js', () => ({
  default: { __unavailable__: true },
}));

vi.mock('../../../server/src/services/aiRoleGuard.js', () => ({
  default: { __unavailable__: true },
}));

vi.mock('../../../server/src/services/regulatoryModeGuard.js', () => ({
  default: { __unavailable__: true },
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  run: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.startsWith('CREATE TABLE') || normalized.startsWith('CREATE INDEX')) {
      return { changes: 0 };
    }
    if (normalized.startsWith('INSERT INTO ai_actions')) {
      const [
        id,
        userId,
        organizationId,
        projectId,
        actionType,
        payload,
        requiredPolicyLevel,
        currentPolicyLevel,
        requiresApproval,
        status,
      ] = params;
      db.actions.set(id, {
        id,
        user_id: userId,
        organization_id: organizationId,
        project_id: projectId,
        action_type: actionType,
        payload,
        draft_content: null,
        required_policy_level: requiredPolicyLevel,
        current_policy_level: currentPolicyLevel,
        requires_approval: requiresApproval,
        status,
        created_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    if (normalized.startsWith('UPDATE ai_actions SET draft_content')) {
      const [draftContent, id] = params;
      Object.assign(db.actions.get(id) || {}, { draft_content: draftContent });
      return { changes: db.actions.has(id) ? 1 : 0 };
    }
    if (normalized.includes("SET status = 'APPROVED'")) {
      const [userId, id] = params;
      const action = db.actions.get(id);
      if (!action || action.status !== 'PENDING') return { changes: 0 };
      Object.assign(action, {
        status: 'APPROVED',
        approved_by: userId,
        approved_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    if (normalized.includes("SET status = 'REJECTED'")) {
      const [userId, id] = params;
      const action = db.actions.get(id);
      if (!action || action.status !== 'PENDING') return { changes: 0 };
      Object.assign(action, {
        status: 'REJECTED',
        approved_by: userId,
        approved_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    if (normalized.includes("SET status = 'EXECUTING'")) {
      const [id] = params;
      const action = db.actions.get(id);
      if (!action || action.status !== 'APPROVED') return { changes: 0 };
      action.status = 'EXECUTING';
      return { changes: 1 };
    }
    if (normalized.includes("SET status = 'EXECUTED'")) {
      const [id] = params;
      const action = db.actions.get(id);
      if (!action) return { changes: 0 };
      Object.assign(action, { status: 'EXECUTED', executed_at: new Date().toISOString() });
      return { changes: 1 };
    }
    if (normalized.includes("SET status = 'FAILED'")) {
      const [id] = params;
      const action = db.actions.get(id);
      if (!action) return { changes: 0 };
      Object.assign(action, { status: 'FAILED', executed_at: new Date().toISOString() });
      return { changes: 1 };
    }
    if (normalized.startsWith('INSERT INTO ai_run_ledger')) {
      const [
        runId,
        actionId,
        trigger,
        userId,
        organizationId,
        projectId,
        tool,
        sourceContext,
        status,
        severity,
        outputRefs,
        audit,
      ] = params;
      db.ledgers.set(actionId, {
        run_id: runId,
        action_id: actionId,
        trigger,
        user_id: userId,
        organization_id: organizationId,
        project_id: projectId,
        tool,
        source_context: sourceContext,
        status,
        severity,
        output_refs: outputRefs,
        audit,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    if (normalized.startsWith('INSERT INTO ai_run_events')) {
      const [id, runId, actionId, eventType, actorUserId, status, details] = params;
      db.events.push({
        id,
        run_id: runId,
        action_id: actionId,
        event_type: eventType,
        actor_user_id: actorUserId,
        status,
        details,
        created_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    if (normalized.startsWith('UPDATE ai_run_ledger')) {
      const [status, outputRefs, audit, _closedStatus, runId] = params;
      const ledger = Array.from(db.ledgers.values()).find((row) => row.run_id === runId);
      if (!ledger) return { changes: 0 };
      Object.assign(ledger, {
        status,
        output_refs: outputRefs,
        audit,
        updated_at: new Date().toISOString(),
        closed_at: ['rejected', 'failed', 'audited', 'closed'].includes(status)
          ? new Date().toISOString()
          : ledger.closed_at,
      });
      return { changes: 1 };
    }
    if (normalized.startsWith('INSERT INTO tasks')) {
      const [id, organizationId, projectId, title, description, assigneeId, dueDate, createdBy] =
        params;
      db.tasks.push({
        id,
        organization_id: organizationId,
        project_id: projectId,
        title,
        description,
        assignee_id: assigneeId,
        due_date: dueDate,
        created_by: createdBy,
      });
      return { changes: 1 };
    }
    if (normalized.startsWith('INSERT INTO ai_audit_logs')) {
      db.auditLogs.push({ params });
      return { changes: 1 };
    }
    throw new Error(`Unhandled dbRun SQL: ${normalized}`);
  },
  get: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.includes('LEFT JOIN ai_run_ledger')) {
      const [actionId] = params;
      const action = db.actions.get(actionId);
      if (!action) return null;
      const ledger = db.ledgers.get(actionId) || {};
      return {
        action_id: action.id,
        action_status: action.status,
        action_type: action.action_type,
        payload: action.payload,
        draft_content: action.draft_content,
        user_id: action.user_id,
        organization_id: action.organization_id,
        project_id: action.project_id,
        action_created_at: action.created_at,
        approved_at: action.approved_at,
        approved_by: action.approved_by,
        executed_at: action.executed_at,
        ...ledger,
      };
    }
    if (normalized.startsWith('SELECT * FROM ai_actions WHERE id = ?')) {
      return db.actions.get(params[0]) || null;
    }
    if (normalized.startsWith('SELECT * FROM ai_run_ledger WHERE action_id = ?')) {
      return db.ledgers.get(params[0]) || null;
    }
    throw new Error(`Unhandled dbGet SQL: ${normalized}`);
  },
  all: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.includes('FROM ai_run_events')) {
      return db.events.filter((event) => event.action_id === params[0]);
    }
    throw new Error(`Unhandled dbAll SQL: ${normalized}`);
  },
}));

describe('AIActionExecutor Wave 3 runtime lifecycle', () => {
  beforeEach(() => {
    resetDb();
  });

  it('creates an AIRun proposal and does not mutate before explicit approve and execute', async () => {
    const { default: AIActionExecutor } =
      await import('../../../server/src/services/aiActionExecutor.js');

    const created = await AIActionExecutor.createDraft(
      'task',
      {
        title: 'COO follow-up',
        description: 'Prepare execution checkpoint',
        assigneeId: 'user-coo',
        dueDate: '2026-05-01',
      },
      'user-owner',
      'org-1',
      'project-1'
    );

    expect(created.success).toBe(true);
    expect(created.requiresApproval).toBe(true);
    expect(created.status).toBe('PENDING');
    expect(created.aiRun.status).toBe('pending_review');
    expect(db.tasks).toHaveLength(0);

    const approved = await AIActionExecutor.approveAction(created.actionId, 'user-owner');

    expect(approved.success).toBe(true);
    expect(approved.status).toBe('APPROVED');
    expect(approved.lifecycleState).toBe('approved');
    expect(db.tasks).toHaveLength(0);

    const executed = await AIActionExecutor.executeAction(created.actionId, 'user-owner');

    expect(executed.success).toBe(true);
    expect(executed.status).toBe('EXECUTED');
    expect(executed.lifecycleState).toBe('audited');
    expect(executed.rollbackStatus).toBe('rollback_available');
    expect(db.tasks).toHaveLength(1);
    expect(db.tasks[0].title).toBe('COO follow-up');
    expect(db.events.map((event) => event.event_type)).toEqual([
      'proposal_pending_review',
      'proposal_approved',
      'execution_started',
      'execution_succeeded',
    ]);
    expect(db.ledgers.get(created.actionId)?.status).toBe('audited');
    expect(JSON.parse(db.ledgers.get(created.actionId)?.audit || '{}')).toMatchObject({
      rollbackStatus: 'rollback_available',
      rollbackAvailable: true,
    });
  });

  it('does not let learned approval patterns bypass governed mutation review', async () => {
    approvalPatternService.service.__unavailable__ = undefined;
    approvalPatternService.service.canAutoDecide.mockResolvedValue({
      canAutoDecide: true,
      decision: 'APPROVED',
      confidence: 0.99,
      reason: 'previous approvals',
      pattern: { id: 'pattern-1', decision_count: 12 },
    });

    const { default: AIActionExecutor } =
      await import('../../../server/src/services/aiActionExecutor.js');

    const created = await AIActionExecutor.createDraft(
      'task',
      { title: 'Still needs review' },
      'user-owner',
      'org-1',
      'project-1'
    );

    expect(created.success).toBe(true);
    expect(created.requiresApproval).toBe(true);
    expect(created.status).toBe('PENDING');
    expect(created.autoApproved).toBeUndefined();
    expect(db.tasks).toHaveLength(0);
  });

  it('allows learned approval patterns only when explicit policy permits it', async () => {
    approvalPatternService.service.__unavailable__ = undefined;
    approvalPatternService.service.canAutoDecide.mockResolvedValue({
      canAutoDecide: true,
      decision: 'APPROVED',
      confidence: 0.99,
      reason: 'explicit policy allows auto approval',
      pattern: { id: 'pattern-2', decision_count: 20 },
    });
    aiPolicyEngine.canPerformAction.mockResolvedValue({
      allowed: true,
      requiresApproval: false,
      requiredLevel: 'standard',
      currentLevel: 'AUTOPILOT',
    });

    const { default: AIActionExecutor } =
      await import('../../../server/src/services/aiActionExecutor.js');

    const created = await AIActionExecutor.requestAction(
      'CREATE_DRAFT_TASK',
      { title: 'Policy permitted' },
      'user-owner',
      'org-1',
      'project-1'
    );

    expect(created.success).toBe(true);
    expect(created.requiresApproval).toBe(false);
    expect(created.status).toBe('APPROVED');
    expect(created.autoApproved).toBe(true);
  });

  it('requires destructive actions to have a destructive auto-approval policy', async () => {
    approvalPatternService.service.__unavailable__ = undefined;
    approvalPatternService.service.canAutoDecide.mockResolvedValue({
      canAutoDecide: true,
      decision: 'APPROVED',
      confidence: 0.99,
      reason: 'explicit non-destructive policy is not enough',
      pattern: { id: 'pattern-3', decision_count: 20 },
    });
    aiPolicyEngine.canPerformAction.mockResolvedValue({
      allowed: true,
      requiresApproval: false,
      requiredLevel: 'standard',
      currentLevel: 'AUTOPILOT',
    });

    const { default: AIActionExecutor } =
      await import('../../../server/src/services/aiActionExecutor.js');

    const created = await AIActionExecutor.requestAction(
      'DELETE_TASK',
      { title: 'Destructive action' },
      'user-owner',
      'org-1',
      'project-1'
    );

    expect(created.success).toBe(true);
    expect(created.requiresApproval).toBe(true);
    expect(created.status).toBe('PENDING');
    expect(created.autoApproved).toBeUndefined();
  });

  it('never executes a rejected proposal', async () => {
    const { default: AIActionExecutor } =
      await import('../../../server/src/services/aiActionExecutor.js');

    const created = await AIActionExecutor.createDraft(
      'task',
      { title: 'Should not happen' },
      'user-owner',
      'org-1',
      'project-1'
    );
    const rejected = await AIActionExecutor.rejectAction(
      created.actionId,
      'user-owner',
      'Not needed'
    );
    const executed = await AIActionExecutor.executeAction(created.actionId, 'user-owner');

    expect(rejected.success).toBe(true);
    expect(rejected.lifecycleState).toBe('rejected');
    expect(executed.success).toBe(false);
    expect(executed.error).toContain('not APPROVED');
    expect(db.tasks).toHaveLength(0);
    expect(db.events.map((event) => event.event_type)).toEqual([
      'proposal_pending_review',
      'proposal_rejected',
    ]);
    expect(db.ledgers.get(created.actionId)?.status).toBe('rejected');
  });
});
