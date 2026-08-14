import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;

const db = vi.hoisted(() => ({
  definitions: new Map<string, Row>(),
  runs: new Map<string, Row>(),
  schedules: new Map<string, Row>(),
  notifications: new Map<string, Row>(),
  airuns: new Map<string, Row>(),
  uuidCounter: 0,
}));

function nextUuid() {
  db.uuidCounter += 1;
  return `wave8-id-${db.uuidCounter}`;
}

vi.mock('uuid', () => ({
  v4: () => nextUuid(),
}));

vi.mock('../../../server/src/services/ai/toolDefinitions.js', () => ({
  executeToolCall: async (toolName: string, input: Record<string, unknown>) =>
    JSON.stringify({ toolName, input, ok: true }),
}));

vi.mock('../../../server/src/services/v8/agentToolExecutionGovernanceService.js', () => ({
  authorizeAgentToolExecution: async (input: { preliminaryDenial?: string | null }) => ({
    allowed: !input.preliminaryDenial,
    reason: input.preliminaryDenial || 'central_governance_allowed',
    eventId: 'governance-event-1',
    toolId: 'tool-1',
  }),
}));

vi.mock('../../../server/src/services/v8/agentResourceGovernanceService.js', () => ({
  executeWithAgentResourceReservation: async (input: { execute: () => Promise<unknown> }) => ({
    allowed: true,
    replayed: false,
    result: await input.execute(),
    resourceDecision: { decision: 'allowed' },
  }),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  run: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (
      normalized.startsWith('CREATE TABLE') ||
      normalized.startsWith('CREATE INDEX') ||
      normalized.startsWith('ALTER TABLE')
    ) {
      return { success: true, changes: 0 };
    }
    if (normalized.startsWith('INSERT INTO wave8_agent_definitions')) {
      const [
        agentId,
        organizationId,
        name,
        role,
        purpose,
        persona,
        allowedToolsJson,
        blockedToolsJson,
        sourceScopeJson,
        outputSchemaJson,
        approvalPolicy,
        costClass,
        riskLevel,
        examplesJson,
        editable,
        updatedBy,
        updatedAt,
      ] = params;
      db.definitions.set(agentId, {
        agent_id: agentId,
        organization_id: organizationId,
        name,
        role,
        purpose,
        persona,
        allowed_tools_json: allowedToolsJson,
        blocked_tools_json: blockedToolsJson,
        source_scope_json: sourceScopeJson,
        output_schema_json: outputSchemaJson,
        approval_policy: approvalPolicy,
        cost_class: costClass,
        risk_level: riskLevel,
        examples_json: examplesJson,
        editable,
        updated_by: updatedBy,
        updated_at: updatedAt,
      });
      return { success: true, changes: 1 };
    }
    if (normalized.startsWith('INSERT INTO wave8_agent_runs')) {
      const [
        runId,
        organizationId,
        agentId,
        userId,
        projectId,
        status,
        goal,
        requestedToolsJson,
        outputJson,
        schemaValid,
        auditJson,
        scheduleJson,
        ownerUserId,
        completedAt,
      ] = params;
      db.runs.set(runId, {
        run_id: runId,
        organization_id: organizationId,
        agent_id: agentId,
        user_id: userId,
        project_id: projectId,
        status,
        goal,
        requested_tools_json: requestedToolsJson,
        output_json: outputJson,
        schema_valid: schemaValid,
        audit_json: auditJson,
        schedule_json: scheduleJson,
        owner_user_id: ownerUserId,
        created_at: new Date().toISOString(),
        completed_at: completedAt,
      });
      return { success: true, changes: 1 };
    }
    if (normalized.startsWith('INSERT INTO wave8_agent_schedules')) {
      const [
        scheduleId,
        organizationId,
        agentId,
        ownerUserId,
        cadence,
        goal,
        projectId,
        timezone,
        nextRunAt,
        schedulerMode,
        status,
      ] = params;
      db.schedules.set(scheduleId, {
        schedule_id: scheduleId,
        organization_id: organizationId,
        agent_id: agentId,
        owner_user_id: ownerUserId,
        cadence,
        goal,
        project_id: projectId,
        timezone,
        next_run_at: nextRunAt,
        scheduler_mode: schedulerMode,
        status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return { success: true, changes: 1 };
    }
    if (normalized.startsWith('INSERT INTO wave8_agent_notifications')) {
      const [notificationId, organizationId, runId, ownerUserId, notificationType, payloadJson] =
        params;
      db.notifications.set(notificationId, {
        notification_id: notificationId,
        organization_id: organizationId,
        run_id: runId,
        owner_user_id: ownerUserId,
        notification_type: notificationType,
        payload_json: payloadJson,
        created_at: new Date().toISOString(),
      });
      return { success: true, changes: 1 };
    }
    if (normalized.startsWith('UPDATE wave8_agent_schedules')) {
      const isLeaseClaim = normalized.includes('SET lease_owner = ?');
      const scheduleId = isLeaseClaim ? params[2] : (params[3] ?? params[2]);
      const row = db.schedules.get(scheduleId);
      if (!row) return { success: true, changes: 0 };
      if (isLeaseClaim) {
        row.lease_owner = params[0];
        row.lease_expires_at = params[1];
      } else {
        row.next_run_at = params[0];
        row.status = params[1];
        row.lease_owner = null;
        row.lease_expires_at = null;
      }
      return { success: true, changes: 1 };
    }
    throw new Error(`Unhandled dbRun SQL: ${normalized}`);
  },
  get: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.includes('FROM wave8_agent_runs')) {
      return db.runs.get(params[0]) || null;
    }
    if (normalized.includes('FROM ai_run_ledger')) {
      const row = db.airuns.get(params[0]);
      return row && row.organization_id === params[1] ? row : null;
    }
    throw new Error(`Unhandled dbGet SQL: ${normalized}`);
  },
  all: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.includes('FROM wave8_agent_definitions')) {
      return Array.from(db.definitions.values()).filter(
        (row) => row.organization_id == null || row.organization_id === params[0]
      );
    }
    if (normalized.includes('FROM wave8_agent_runs')) {
      return Array.from(db.runs.values()).filter((row) => row.organization_id === params[0]);
    }
    if (normalized.includes('FROM wave8_agent_schedules')) {
      return Array.from(db.schedules.values()).filter((row) => {
        if (row.organization_id !== params[0]) return false;
        if (normalized.includes("status = 'active'")) {
          return row.status === 'active' && (!row.next_run_at || row.next_run_at <= params[1]);
        }
        return true;
      });
    }
    if (normalized.includes('FROM wave8_agent_notifications')) {
      return Array.from(db.notifications.values()).filter(
        (row) => row.organization_id === params[0]
      );
    }
    throw new Error(`Unhandled dbAll SQL: ${normalized}`);
  },
}));

describe('Wave 8 agent runtime', () => {
  beforeEach(() => {
    db.definitions.clear();
    db.runs.clear();
    db.schedules.clear();
    db.notifications.clear();
    db.airuns.clear();
    db.uuidCounter = 0;
    vi.resetModules();
  });

  it('exposes a complete specialized agent catalog with scoped tools and schemas', async () => {
    const { listWave8AgentDefinitions } =
      await import('../../../server/src/services/wave8AgentRuntimeService.js');
    const agents = await listWave8AgentDefinitions();

    expect(agents.map((agent) => agent.agentId)).toEqual(
      expect.arrayContaining([
        'research-agent',
        'docs-agent',
        'reports-agent',
        'slides-agent',
        'sheets-finance-agent',
        'decision-agent',
        'execution-agent',
        'governance-agent',
        'cfo-agent',
        'coo-agent',
        'ciso-agent',
      ])
    );
    expect(agents.every((agent) => agent.outputSchema && agent.allowedTools.length > 0)).toBe(true);
  });

  it('stores admin-editable AgentDefinition overrides in the Wave 8 database catalog', async () => {
    const { listWave8AgentDefinitions, upsertWave8AgentDefinition } =
      await import('../../../server/src/services/wave8AgentRuntimeService.js');

    const saved = await upsertWave8AgentDefinition({
      organizationId: 'org-1',
      userId: 'admin-1',
      definition: {
        agentId: 'research-agent',
        name: 'Research Agent',
        role: 'research',
        purpose: 'Edited org-specific research purpose.',
        persona: 'Evidence-first researcher.',
        allowedTools: ['search_knowledge_base'],
        blockedTools: ['search_web'],
        sourceScope: ['knowledge_base'],
        outputSchema: { type: 'research_brief', required: ['summary'] },
        approvalPolicy: 'tool_scope',
        costClass: 'low',
        riskLevel: 'medium',
        examples: ['Org-specific research'],
      },
    });

    expect(saved.source).toBe('database');
    expect(saved.updatedBy).toBe('admin-1');
    const agents = await listWave8AgentDefinitions({ organizationId: 'org-1' });
    const research = agents.find((agent) => agent.agentId === 'research-agent');
    expect(research?.purpose).toBe('Edited org-specific research purpose.');
    expect(research?.allowedTools).toEqual(['search_knowledge_base']);
  });

  it('blocks tool misuse and swarm without approval and budget gate', async () => {
    const { launchWave8Agent } =
      await import('../../../server/src/services/wave8AgentRuntimeService.js');

    const blockedTool = await launchWave8Agent({
      organizationId: 'org-1',
      userId: 'user-1',
      agentId: 'ciso-agent',
      goal: 'Search the open web for security gossip',
      requestedTools: ['search_web'],
    });
    expect(blockedTool.allowed).toBe(false);
    expect(blockedTool.run.audit.toolDecision.reason).toBe('blocked_tool');

    const blockedSwarm = await launchWave8Agent({
      organizationId: 'org-1',
      userId: 'user-1',
      agentId: 'research-agent',
      goal: 'Run swarm research',
      requestedTools: ['search_knowledge_base'],
      swarm: { enabled: true, approved: true, budgetApproved: false },
    });
    expect(blockedSwarm.allowed).toBe(false);
    expect(blockedSwarm.run.audit.swarmDecision.reason).toBe(
      'swarm_requires_approval_and_budget_gate'
    );
  });

  it('launches role-specific schema-valid output and creates owner-audited schedules', async () => {
    const { launchWave8Agent, listWave8AgentNotifications, listWave8AgentSchedules } =
      await import('../../../server/src/services/wave8AgentRuntimeService.js');

    const cfo = await launchWave8Agent({
      organizationId: 'org-1',
      userId: 'user-1',
      agentId: 'cfo-agent',
      goal: 'Prepare CFO ROI model',
      requestedTools: ['calculate_financial'],
    });
    expect(cfo.allowed).toBe(true);
    expect(cfo.run.schemaValid).toBe(true);
    expect(cfo.run.output.type).toBe('financial_model');
    expect(cfo.run.audit.scheduler.status).toBe('not_scheduled');

    const scheduled = await launchWave8Agent({
      organizationId: 'org-1',
      userId: 'user-1',
      agentId: 'research-agent',
      goal: 'Weekly status research',
      requestedTools: ['search_knowledge_base'],
      schedule: {
        cadence: 'weekly',
        nextRunAt: '2026-04-26T08:00:00.000Z',
        ownerUserId: 'owner-1',
      },
    });
    expect(scheduled.run.status).toBe('scheduled');
    expect(scheduled.run.output).toBeNull();
    expect(scheduled.run.schemaValid).toBe(false);
    expect(scheduled.run.audit.scheduler).toEqual(
      expect.objectContaining({
        schedulerMode: 'durable_cron_worker',
        cronBacked: true,
        status: 'registered',
      })
    );
    expect(scheduled.run.ownerUserId).toBe('owner-1');
    const schedules = await listWave8AgentSchedules({ organizationId: 'org-1' });
    expect(schedules[0]).toEqual(
      expect.objectContaining({
        ownerUserId: 'owner-1',
        schedulerMode: 'durable_cron_worker',
      })
    );
    const notifications = await listWave8AgentNotifications({ organizationId: 'org-1' });
    expect(notifications.length).toBeGreaterThan(0);
    expect(
      notifications.some((item) => item.payload?.delivery?.dispatchMode === 'audit_log_only')
    ).toBe(true);
  });

  it('enforces approvalPolicy and processes due schedules', async () => {
    const { launchWave8Agent, processDueWave8AgentSchedules } =
      await import('../../../server/src/services/wave8AgentRuntimeService.js');

    const blockedExecution = await launchWave8Agent({
      organizationId: 'org-1',
      userId: 'user-1',
      agentId: 'execution-agent',
      goal: 'Prepare execution plan',
      requestedTools: ['get_initiative_status'],
    });
    expect(blockedExecution.allowed).toBe(false);
    expect(blockedExecution.run.audit.approvalDecision.reason).toBe('airun_required');

    db.airuns.set('airun-1', {
      run_id: 'airun-1',
      organization_id: 'org-1',
      status: 'approved',
    });
    const approvedExecution = await launchWave8Agent({
      organizationId: 'org-1',
      userId: 'user-1',
      agentId: 'execution-agent',
      goal: 'Prepare execution plan',
      requestedTools: ['get_initiative_status'],
      approval: { aiRunId: 'airun-1' },
    });
    expect(approvedExecution.allowed).toBe(true);

    const blockedExecutionSchedule = await launchWave8Agent({
      organizationId: 'org-1',
      userId: 'user-1',
      agentId: 'execution-agent',
      goal: 'Schedule execution plan',
      requestedTools: ['get_initiative_status'],
      approval: { aiRunId: 'airun-1' },
      schedule: { cadence: 'weekly', nextRunAt: '2026-04-25T00:00:00.000Z' },
    });
    expect(blockedExecutionSchedule.allowed).toBe(false);
    expect(blockedExecutionSchedule.run.audit.approvalDecision.reason).toBe(
      'airun_schedule_requires_manual_launch'
    );

    const blockedBudget = await launchWave8Agent({
      organizationId: 'org-1',
      userId: 'user-1',
      agentId: 'governance-agent',
      goal: 'Audit report',
      requestedTools: ['search_knowledge_base'],
    });
    expect(blockedBudget.allowed).toBe(false);
    expect(blockedBudget.run.audit.approvalDecision.reason).toBe('budget_gate_required');

    await launchWave8Agent({
      organizationId: 'org-1',
      userId: 'user-1',
      agentId: 'research-agent',
      goal: 'Daily research',
      requestedTools: ['search_knowledge_base'],
      schedule: { cadence: 'daily', nextRunAt: '2026-04-25T00:00:00.000Z', ownerUserId: 'owner-1' },
    });
    const processed = await processDueWave8AgentSchedules({
      organizationId: 'org-1',
      now: '2026-04-26T00:00:00.000Z',
    });
    expect(processed.length).toBeGreaterThan(0);
    expect(processed[0].audit.scheduler).toEqual(
      expect.objectContaining({
        trigger: 'manual_process_due',
        cronBacked: false,
      })
    );
  });

  it('records eval run hooks as audit-only hooks without executing an evaluator', async () => {
    const { launchWave8Agent, listWave8AgentNotifications } =
      await import('../../../server/src/services/wave8AgentRuntimeService.js');

    const result = await launchWave8Agent({
      organizationId: 'org-1',
      userId: 'user-1',
      agentId: 'research-agent',
      goal: 'Research with eval hook',
      requestedTools: ['search_knowledge_base'],
      evalRun: {
        enabled: true,
        evaluatorAgentId: 'governance-agent',
        criteria: ['schema', 'source_trace'],
      },
    });

    expect(result.allowed).toBe(true);
    expect(result.run.audit.evalRunHook).toEqual(
      expect.objectContaining({
        status: 'registered',
        mode: 'audit_hook_only',
        executed: false,
      })
    );
    const notifications = await listWave8AgentNotifications({ organizationId: 'org-1' });
    expect(
      notifications.some((item) => item.notificationType === 'agent_eval_hook_registered')
    ).toBe(true);
  });

  it('enforces tool scope before executing agent tools', async () => {
    const { executeWave8AgentTool } =
      await import('../../../server/src/services/wave8AgentRuntimeService.js');

    const denied = await executeWave8AgentTool({
      organizationId: 'org-1',
      userId: 'user-1',
      agentId: 'ciso-agent',
      toolName: 'search_web',
      toolInput: { query: 'security' },
    });
    expect(denied.allowed).toBe(false);

    const blockedExecutionTool = await executeWave8AgentTool({
      organizationId: 'org-1',
      userId: 'user-1',
      agentId: 'execution-agent',
      toolName: 'get_initiative_status',
      toolInput: { initiative_id: 'i1' },
    });
    expect(blockedExecutionTool.allowed).toBe(false);
    expect(blockedExecutionTool.error).toBe('airun_required');

    const blockedBudgetTool = await executeWave8AgentTool({
      organizationId: 'org-1',
      userId: 'user-1',
      agentId: 'governance-agent',
      toolName: 'search_knowledge_base',
      toolInput: { query: 'audit' },
    });
    expect(blockedBudgetTool.allowed).toBe(false);
    expect(blockedBudgetTool.error).toBe('budget_gate_required');

    db.airuns.set('airun-tool', {
      run_id: 'airun-tool',
      organization_id: 'org-1',
      status: 'approved',
    });
    const allowed = await executeWave8AgentTool({
      organizationId: 'org-1',
      userId: 'user-1',
      agentId: 'research-agent',
      toolName: 'search_knowledge_base',
      toolInput: { query: 'strategy' },
    });
    expect(allowed.allowed).toBe(true);
    expect(allowed.result).toContain('search_knowledge_base');
  });

  it('exposes Wave 8 API, UI, migration and route contract', () => {
    const gateway = readFileSync('server/src/Gateway.ts', 'utf8');
    const routes = readFileSync('server/src/routes/wave8-agents.routes.ts', 'utf8');
    const api = readFileSync('src/services/api.ts', 'utf8');
    const panel = readFileSync('src/components/AIChat/Wave8AgentCatalogPanel.tsx', 'utf8');
    const appRoutes = readFileSync('src/routes/AppRoutes.tsx', 'utf8');
    const migration = readFileSync('server/migrations/20260425_wave8_agent_runtime.sql', 'utf8');

    expect(gateway).toContain('/api/ai-agents');
    expect(routes).toContain('/catalog');
    expect(routes).toContain('/launch');
    expect(routes).toContain('/definitions');
    expect(routes).toContain('/schedules');
    expect(routes).toContain('/notifications');
    expect(routes).toContain('/process-due');
    expect(api).toContain('launchWave8Agent');
    expect(api).toContain('upsertWave8AgentDefinition');
    expect(api).toContain('executeWave8AgentTool');
    expect(api).toContain('processDueWave8AgentSchedules');
    expect(panel).toContain('wave8AgentCatalog');
    expect(panel).toContain('adminEditableAgentdefinition');
    expect(panel).toContain('savesAnOrganizationOverrideThroughApi');
    expect(panel).toContain('governedToolExecution');
    expect(panel).toContain('Api.executeWave8AgentTool');
    expect(panel).toContain('usesApiAiAgentsToolTo');
    expect(panel).toContain('swarmMode');
    expect(panel).toContain('notifications');
    expect(appRoutes).toContain('path={ROUTES.AI_OS.AGENTS}');
    expect(migration).toContain('wave8_agent_runs');
    expect(migration).toContain('wave8_agent_definitions');
    expect(migration).toContain('wave8_agent_schedules');
    expect(migration).toContain('wave8_agent_notifications');
  });
});
