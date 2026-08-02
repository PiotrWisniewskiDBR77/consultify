/**
 * agentPlannerService.executePlan — continue-on-error unit tests (HP-4).
 *
 * Piotr decision (07-16, koncept _KONCEPT_HP4_AGENT_W_TERESIE.md §5 Q1 —
 * RESOLVED): a failing step must NOT stop the plan — the engine continues
 * with the remaining steps ("robustness over fail-fast"). This engine has no
 * step-dependency graph, so "continue with independent steps" reduces to
 * "continue sequentially, skip only the failed step".
 *
 * These tests exercise the real `agentPlannerService` (server/src/services/ai
 * /agentPlannerService.ts) against an in-memory fake of `DbPromise` (run/get/
 * all) that mirrors the two tables from migration 672
 * (`ai_agent_plans`/`ai_agent_plan_steps`) — no real sqlite/pg needed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface PlanRow {
  id: string;
  organization_id: string;
  conversation_id: string | null;
  user_id: string;
  title: string;
  description: string | null;
  status: string;
  total_steps: number;
  completed_steps: number;
  current_step_index: number;
  plan_json: string;
  result_summary: string | null;
  error_message: string | null;
  is_background: number;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  execution_owner_token: string | null;
  execution_fencing_token: number;
  execution_lease_expires_at: string | null;
}

interface StepRow {
  id: string;
  plan_id: string;
  step_index: number;
  tool_name: string;
  tool_input_json: string;
  status: string;
  result_json: string | null;
  error_message: string | null;
  requires_approval: number;
  approved_by: string | null;
  approved_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  created_at: string;
}

const db = vi.hoisted(() => ({
  plans: new Map<string, PlanRow>(),
  steps: new Map<string, StepRow[]>(), // keyed by plan_id
  failFinalization: false,
}));

function normalize(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

function findStep(planId: string, stepId: string): StepRow | undefined {
  return (db.steps.get(planId) || []).find((s) => s.id === stepId);
}

function findStepAnyPlan(stepId: string): StepRow | undefined {
  for (const arr of db.steps.values()) {
    const hit = arr.find((s) => s.id === stepId);
    if (hit) return hit;
  }
  return undefined;
}

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  run: async (sql: string, params: unknown[] = []) => {
    const s = normalize(sql);

    if (s.startsWith('INSERT INTO ai_agent_plans')) {
      const [
        id,
        organization_id,
        conversation_id,
        user_id,
        title,
        description,
        total_steps,
        plan_json,
        is_background,
        scheduled_at,
      ] = params as [
        string,
        string,
        string | null,
        string,
        string,
        string | null,
        number,
        string,
        number,
        string | null,
      ];
      db.plans.set(id, {
        id,
        organization_id,
        conversation_id,
        user_id,
        title,
        description,
        status: 'planning',
        total_steps,
        completed_steps: 0,
        current_step_index: 0,
        plan_json,
        result_summary: null,
        error_message: null,
        is_background,
        scheduled_at,
        started_at: null,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        execution_owner_token: null,
        execution_fencing_token: 0,
        execution_lease_expires_at: null,
      });
      return { changes: 1 };
    }

    if (s.startsWith('INSERT INTO ai_agent_plan_steps')) {
      const [id, plan_id, step_index, tool_name, tool_input_json, requires_approval] =
        params as [string, string, number, string, string, number];
      const arr = db.steps.get(plan_id) || [];
      arr.push({
        id,
        plan_id,
        step_index,
        tool_name,
        tool_input_json,
        status: 'pending',
        result_json: null,
        error_message: null,
        requires_approval,
        approved_by: null,
        approved_at: null,
        started_at: null,
        completed_at: null,
        duration_ms: null,
        created_at: new Date().toISOString(),
      });
      db.steps.set(plan_id, arr);
      return { changes: 1 };
    }

    if (s.startsWith('UPDATE ai_agent_plan_steps')) {
      if (s.includes("status = 'completed'") && s.includes('result_json')) {
        const [result_json, duration_ms] = params as [string, number];
        const id = params[params.length - 3] as string;
        const step = findStepAnyPlan(id);
        if (step) Object.assign(step, { status: 'completed', result_json, duration_ms });
        return { changes: 1 };
      }
      if (s.includes("status = 'failed'") && s.includes('error_message')) {
        const [error_message, duration_ms] = params as [string, number];
        const id = params[params.length - 3] as string;
        const step = findStepAnyPlan(id);
        if (step) Object.assign(step, { status: 'failed', error_message, duration_ms });
        return { changes: 1 };
      }
      if (s.includes('tool_input_json = ?')) {
        const id = params[params.length - 3] as string;
        const step = findStepAnyPlan(id);
        if (step) step.tool_input_json = params[0] as string;
        return { changes: step ? 1 : 0 };
      }
      if (s.includes("status = 'pending'") && s.includes('approved_by')) {
        const [approved_by, id] = params as [string, string];
        const step = findStepAnyPlan(id);
        if (step)
          Object.assign(step, {
            status: 'pending',
            approved_by,
            approved_at: new Date().toISOString(),
          });
        return { changes: 1 };
      }
      // generic single-status update (e.g. updateStepStatus -> 'awaiting_approval' | 'running')
      const status = params[0] as string;
      const id = (s.includes('EXISTS') ? params[params.length - 3] : params[1]) as string;
      const step = findStepAnyPlan(id);
      if (step) Object.assign(step, { status });
      return { changes: 1 };
    }

    if (s.startsWith('UPDATE ai_agent_plans')) {
      if (s.includes('execution_owner_token = ?') && s.includes('COALESCE(execution_fencing_token')) {
        const [ownerToken, id] = params as [string, string];
        const plan = db.plans.get(id);
        if (
          !plan ||
          !['planning', 'scheduled', 'awaiting_approval', 'paused'].includes(plan.status)
        ) {
          return { changes: 0 };
        }
        plan.status = 'executing';
        plan.execution_owner_token = ownerToken;
        plan.execution_fencing_token += 1;
        plan.execution_lease_expires_at = new Date(Date.now() + 300_000).toISOString();
        return { changes: 1 };
      }
      if (s.includes('execution_lease_expires_at =') && s.includes("status = 'executing'")) {
        const [id, ownerToken, fencingToken] = params as [string, string, number];
        const plan = db.plans.get(id);
        const matches =
          plan?.status === 'executing' &&
          plan.execution_owner_token === ownerToken &&
          plan.execution_fencing_token === fencingToken;
        if (matches) plan!.execution_lease_expires_at = new Date(Date.now() + 300_000).toISOString();
        return { changes: matches ? 1 : 0 };
      }
      if (s.includes('result_summary = ?') && s.includes('error_message = ?')) {
        // finalizePlan
        if (db.failFinalization) throw new Error('final result write failed');
        const [status, result_summary, error_message, id] = params as [
          string,
          string,
          string | null,
          string,
        ];
        const plan = db.plans.get(id);
        if (plan) Object.assign(plan, { status, result_summary, error_message, execution_owner_token: null, execution_lease_expires_at: null });
        return { changes: plan ? 1 : 0 };
      }
      if (s.includes('completed_steps = ?')) {
        // updatePlanProgress
        const [completed_steps, current_step_index, id] = params as [number, number, string];
        const plan = db.plans.get(id);
        if (plan) Object.assign(plan, { completed_steps, current_step_index });
        return { changes: 1 };
      }
      if (s.includes('execution_owner_token = NULL') && s.includes('current_step_index = ?')) {
        const [status, current_step_index, id] = params as [string, number, string];
        const plan = db.plans.get(id);
        if (plan) Object.assign(plan, { status, current_step_index, execution_owner_token: null, execution_lease_expires_at: null });
        return { changes: plan ? 1 : 0 };
      }
      // dynamic updatePlanStatus(planId, status, currentStep?, errorMessage?)
      let idx = 0;
      const status = params[idx++] as string;
      const updates: Partial<PlanRow> = { status };
      if (s.includes('current_step_index = ?')) updates.current_step_index = params[idx++] as number;
      if (s.includes('error_message = ?')) updates.error_message = params[idx++] as string;
      const id = params[idx] as string;
      const plan = db.plans.get(id);
      if (plan) Object.assign(plan, updates);
      return { changes: 1 };
    }

    if (s.startsWith('CREATE TABLE') || s.startsWith('CREATE INDEX')) return { changes: 0 };

    throw new Error(`Unmocked SQL in agentPlannerService test: ${s}`);
  },

  get: async (sql: string, params: unknown[] = []) => {
    const s = normalize(sql);

    if (s.startsWith('SELECT * FROM ai_agent_plans WHERE id = ?')) {
      return db.plans.get(params[0] as string) || undefined;
    }

    if (s.startsWith('SELECT execution_fencing_token FROM ai_agent_plans')) {
      const [planId, ownerToken] = params as [string, string];
      const plan = db.plans.get(planId);
      return plan?.execution_owner_token === ownerToken
        ? { execution_fencing_token: plan.execution_fencing_token }
        : undefined;
    }

    if (s.includes('FROM ai_agent_plan_steps') && s.includes("status = 'awaiting_approval'")) {
      const [planId, stepIndex] = params as [string, number];
      const arr = db.steps.get(planId) || [];
      return arr.find((st) => st.step_index === stepIndex && st.status === 'awaiting_approval');
    }

    throw new Error(`Unmocked SQL (get) in agentPlannerService test: ${s}`);
  },

  all: async (sql: string, params: unknown[] = []) => {
    const s = normalize(sql);
    if (s.startsWith('SELECT * FROM ai_agent_plan_steps WHERE plan_id = ?')) {
      const arr = db.steps.get(params[0] as string) || [];
      return [...arr].sort((a, b) => a.step_index - b.step_index);
    }
    throw new Error(`Unmocked SQL (all) in agentPlannerService test: ${s}`);
  },
}));

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return actual;
});

const { agentPlannerService } = await import(
  '../../../server/src/services/ai/agentPlannerService.js'
);

describe('agentPlannerService.executePlan — continue-on-error (HP-4, Piotr decision 07-16)', () => {
  beforeEach(() => {
    db.plans.clear();
    db.steps.clear();
    db.failFinalization = false;
  });

  it('runs every step and reports "completed" when all succeed', async () => {
    const plan = await agentPlannerService.createPlan({
      organizationId: 'org-1',
      userId: 'user-1',
      title: 'All good',
      steps: [
        { toolName: 'search_web', toolInput: { q: 'a' } },
        { toolName: 'search_web', toolInput: { q: 'b' } },
        { toolName: 'search_web', toolInput: { q: 'c' } },
      ],
    });

    const executor = vi.fn().mockResolvedValue('ok');
    const result = await agentPlannerService.executePlan(plan.id, executor);

    expect(executor).toHaveBeenCalledTimes(3);
    expect(result.status).toBe('completed');
    expect(result.errorMessage).toBeUndefined();
    expect(result.resultSummary).toBe('Completed 3/3 steps.');
    expect(result.steps.every((s) => s.status === 'completed')).toBe(true);
  });

  it('continues past a failing middle step instead of stopping the plan (fail-fast regression guard)', async () => {
    const plan = await agentPlannerService.createPlan({
      organizationId: 'org-1',
      userId: 'user-1',
      title: 'Middle step fails',
      steps: [
        { toolName: 'search_web', toolInput: { q: 'a' } },
        { toolName: 'get_initiative_status', toolInput: { question: 'boom' } },
        { toolName: 'search_web', toolInput: { q: 'c' } },
      ],
    });

    // Keyed by toolName (not call order) so this stays correct regardless of
    // how many times a failing step gets retried (Fala 1, 2026-07-26).
    const executor = vi.fn(async (toolName: string) => {
      if (toolName === 'get_initiative_status') throw new Error('tool exploded');
      return toolName === 'search_web' ? 'ok' : 'ok-3';
    });

    const result = await agentPlannerService.executePlan(plan.id, executor);

    // The key regression guard: the 3rd (independent) step still ran.
    // 2 successful steps (1 call each) + the failing middle step retried to
    // exhaustion (3 attempts, Fala 1) = 5.
    expect(executor).toHaveBeenCalledTimes(5);
    expect(result.status).toBe('completed_with_errors');
    expect(result.steps[0].status).toBe('completed');
    expect(result.steps[1].status).toBe('failed');
    expect(result.steps[1].errorMessage).toBe('tool exploded');
    expect(result.steps[2].status).toBe('completed');
    expect(result.errorMessage).toContain('1/3 steps failed');
    expect(result.errorMessage).toContain('get_initiative_status');
    expect(result.errorMessage).toContain('tool exploded');
    expect(result.resultSummary).toContain('2/3 steps');
  });

  it('reports "completed_with_errors" (never the old fail-fast "failed") even when every step fails', async () => {
    const plan = await agentPlannerService.createPlan({
      organizationId: 'org-1',
      userId: 'user-1',
      title: 'All fail',
      steps: [
        { toolName: 'search_web', toolInput: {} },
        { toolName: 'search_web', toolInput: {} },
      ],
    });

    const executor = vi.fn().mockRejectedValue(new Error('down'));
    const result = await agentPlannerService.executePlan(plan.id, executor);

    // 2 steps × 3 attempts each (Fala 1 retry-before-failed, 2026-07-26).
    expect(executor).toHaveBeenCalledTimes(6);
    expect(result.status).toBe('completed_with_errors');
    expect(result.status).not.toBe('failed');
    expect(result.steps.every((s) => s.status === 'failed')).toBe(true);
  });

  it('still pauses on a step requiring approval (checkpoint behaviour unaffected by continue-on-error)', async () => {
    const plan = await agentPlannerService.createPlan({
      organizationId: 'org-1',
      userId: 'user-1',
      title: 'Has a mutating step',
      steps: [
        { toolName: 'search_web', toolInput: {} },
        { toolName: 'create_initiative_draft', toolInput: { title: 'x' } },
        { toolName: 'search_web', toolInput: {} },
      ],
    });

    const executor = vi.fn().mockResolvedValue('ok');
    const result = await agentPlannerService.executePlan(plan.id, executor);

    // Only step 0 ran; step 1 (side-effect tool) requires approval and pauses the plan.
    expect(executor).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('awaiting_approval');
    expect(result.steps[1].status).toBe('awaiting_approval');
    expect(result.steps[2].status).toBe('pending');
  });

  it('persists approval actor, approved payload and materialized result across read-back', async () => {
    const payload = { title: 'Approved initiative', source: 'run-agent' };
    const plan = await agentPlannerService.createPlan({
      organizationId: 'org-1',
      userId: 'owner-1',
      title: 'Auditable side effect',
      steps: [{ toolName: 'create_initiative_draft', toolInput: payload }],
    });

    const executor = vi.fn().mockResolvedValue({ initiativeId: 'ini-42', status: 'DRAFT' });
    const checkpoint = await agentPlannerService.executePlan(plan.id, executor);
    expect(checkpoint.status).toBe('awaiting_approval');
    expect(executor).not.toHaveBeenCalled();

    await agentPlannerService.approveStep(plan.id, 0, 'approver-7');
    const approved = await agentPlannerService.getPlan(plan.id);
    expect(approved?.steps[0]).toMatchObject({
      status: 'pending',
      toolInput: payload,
      approvedBy: 'approver-7',
    });
    expect(approved?.steps[0].approvedAt).toBeTruthy();

    await agentPlannerService.executePlan(plan.id, executor);
    expect(executor).toHaveBeenCalledWith(
      'create_initiative_draft',
      payload,
      expect.objectContaining({ operationKey: `agent-plan:${plan.id}:step:${plan.steps[0].id}` })
    );

    const materialized = await agentPlannerService.getPlan(plan.id);
    expect(materialized?.status).toBe('completed');
    expect(materialized?.steps[0]).toMatchObject({
      status: 'completed',
      toolInput: payload,
      result: { initiativeId: 'ini-42', status: 'DRAFT' },
      approvedBy: 'approver-7',
    });
    expect(materialized?.steps[0].approvedAt).toBeTruthy();
  });

  it('claims a plan once so concurrent workers execute a side effect only once', async () => {
    const plan = await agentPlannerService.createPlan({
      organizationId: 'org-1',
      userId: 'owner-1',
      title: 'Single execution claim',
      steps: [{ toolName: 'search_web', toolInput: { query: 'once' } }],
    });

    let release!: (value: unknown) => void;
    const blocked = new Promise((resolve) => {
      release = resolve;
    });
    const executor = vi.fn(() => blocked);

    const first = agentPlannerService.executePlan(plan.id, executor);
    await vi.waitFor(() => expect(executor).toHaveBeenCalledTimes(1));
    const duplicate = await agentPlannerService.executePlan(plan.id, executor);
    expect(duplicate.status).toBe('executing');
    expect(executor).toHaveBeenCalledTimes(1);

    release({ ok: true });
    expect((await first).status).toBe('completed');
    expect(executor).toHaveBeenCalledTimes(1);
  });

  it('never reports completed when the durable final result write fails', async () => {
    const plan = await agentPlannerService.createPlan({
      organizationId: 'org-1',
      userId: 'owner-1',
      title: 'Durable completion guard',
      steps: [{ toolName: 'search_web', toolInput: { query: 'receipt' } }],
    });
    db.failFinalization = true;

    await expect(
      agentPlannerService.executePlan(plan.id, vi.fn().mockResolvedValue({ ok: true }))
    ).rejects.toThrow('final result write failed');

    expect(db.plans.get(plan.id)?.status).toBe('executing');
    expect(db.plans.get(plan.id)?.status).not.toBe('completed');
  });
});

describe('agentPlannerService.executePlan — retry przed failed (Fala 1, 2026-07-26)', () => {
  beforeEach(() => {
    db.plans.clear();
    db.steps.clear();
    db.failFinalization = false;
  });

  it('recovers a step that fails once then succeeds — never marked failed', async () => {
    const plan = await agentPlannerService.createPlan({
      organizationId: 'org-1',
      userId: 'user-1',
      title: 'Transient failure',
      steps: [{ toolName: 'search_web', toolInput: { q: 'a' } }],
    });

    const executor = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce('recovered');

    const result = await agentPlannerService.executePlan(plan.id, executor);

    expect(executor).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('completed');
    expect(result.steps[0].status).toBe('completed');
    expect(result.steps[0].result).toBe('recovered');
  });

  it('gives up after 3 attempts and marks the step failed (plan still completes, 07-16 behaviour)', async () => {
    const plan = await agentPlannerService.createPlan({
      organizationId: 'org-1',
      userId: 'user-1',
      title: 'Persistent failure',
      steps: [{ toolName: 'search_web', toolInput: {} }],
    });

    const executor = vi.fn().mockRejectedValue(new Error('down for good'));
    const result = await agentPlannerService.executePlan(plan.id, executor);

    expect(executor).toHaveBeenCalledTimes(3);
    expect(result.steps[0].status).toBe('failed');
    expect(result.steps[0].errorMessage).toBe('down for good');
    expect(result.status).toBe('completed_with_errors');
  });
});

describe('agentPlannerService.executePlan — zmienne między krokami (Fala 1, 2026-07-26)', () => {
  beforeEach(() => {
    db.plans.clear();
    db.steps.clear();
    db.failFinalization = false;
  });

  it('resolves $step.N.pole to the completed result of step N (1-based)', async () => {
    const plan = await agentPlannerService.createPlan({
      organizationId: 'org-1',
      userId: 'user-1',
      title: 'Uses prior step result',
      steps: [
        { toolName: 'get_assessment_data', toolInput: {} },
        { toolName: 'calculate_financial', toolInput: { score: '$step.1.score', label: 'fixed' } },
      ],
    });

    const executor = vi.fn(async (toolName: string) => {
      if (toolName === 'get_assessment_data') return { score: 87 };
      return 'ok';
    });

    await agentPlannerService.executePlan(plan.id, executor);

    expect(executor).toHaveBeenNthCalledWith(2, 'calculate_financial', {
      score: 87,
      label: 'fixed',
    }, expect.objectContaining({ operationKey: expect.any(String) }));
  });

  it('leaves the reference untouched when the referenced step has no result yet (bad index)', async () => {
    const plan = await agentPlannerService.createPlan({
      organizationId: 'org-1',
      userId: 'user-1',
      title: 'Bad reference',
      steps: [{ toolName: 'search_web', toolInput: { q: '$step.9.missing' } }],
    });

    const executor = vi.fn().mockResolvedValue('ok');
    await agentPlannerService.executePlan(plan.id, executor);

    expect(executor).toHaveBeenNthCalledWith(
      1,
      'search_web',
      { q: '$step.9.missing' },
      expect.objectContaining({ operationKey: expect.any(String) })
    );
  });

  it('does not mutate the stored tool_input_json — DB keeps the template, not the resolved value', async () => {
    const plan = await agentPlannerService.createPlan({
      organizationId: 'org-1',
      userId: 'user-1',
      title: 'Template survives execution',
      steps: [
        { toolName: 'get_assessment_data', toolInput: {} },
        { toolName: 'calculate_financial', toolInput: { score: '$step.1.score' } },
      ],
    });

    const executor = vi.fn(async (toolName: string) =>
      toolName === 'get_assessment_data' ? { score: 42 } : 'ok'
    );
    await agentPlannerService.executePlan(plan.id, executor);

    const reloaded = await agentPlannerService.getPlan(plan.id);
    expect(reloaded?.steps[1].toolInput).toEqual({ score: '$step.1.score' });
  });
});
