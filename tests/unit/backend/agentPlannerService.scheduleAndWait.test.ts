/**
 * agentPlannerService — Harmonogram + Odczekaj (pauza) unit tests (Fala 1
 * flow, 2026-07-26). Same in-memory fake of DbPromise as
 * agentPlannerService.executePlan.test.ts, kept in a SEPARATE file (separate
 * `vi.hoisted` db) so the two suites never share mutable state.
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
  execution_owner_token?: string | null;
  execution_fencing_token?: number;
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
  steps: new Map<string, StepRow[]>(),
}));

function normalize(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
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
      });
      return { changes: 1 };
    }

    if (s.startsWith('INSERT INTO ai_agent_plan_steps')) {
      const [id, plan_id, step_index, tool_name, tool_input_json, requires_approval] = params as [
        string,
        string,
        number,
        string,
        string,
        number,
      ];
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

    // Odczekaj: persist resumeAt into tool_input_json (executePlan gate).
    if (s.startsWith('UPDATE ai_agent_plan_steps SET tool_input_json = ?')) {
      const [tool_input_json, id] = params as [string, string];
      const step = findStepAnyPlan(id);
      if (step) step.tool_input_json = tool_input_json;
      return { changes: 1 };
    }

    if (s.startsWith('UPDATE ai_agent_plan_steps')) {
      if (s.includes("status = 'completed'") && s.includes('result_json')) {
        const [result_json, duration_ms, id] = params as [string, number, string];
        const step = findStepAnyPlan(id);
        if (step) Object.assign(step, { status: 'completed', result_json, duration_ms });
        return { changes: 1 };
      }
      if (s.includes("status = 'failed'") && s.includes('error_message')) {
        const [error_message, duration_ms, id] = params as [string, number, string];
        const step = findStepAnyPlan(id);
        if (step) Object.assign(step, { status: 'failed', error_message, duration_ms });
        return { changes: 1 };
      }
      if (s.includes("status = 'pending'") && s.includes('approved_by')) {
        const [approved_by, id] = params as [string, string];
        const step = findStepAnyPlan(id);
        // Real SQL always includes `approved_at = datetime('now')` as a
        // literal (not a bound param) — mirror that here, otherwise the gate
        // (`!step.approvedAt`) re-fires on the very next executePlan call.
        if (step)
          Object.assign(step, {
            status: 'pending',
            approved_by,
            approved_at: new Date().toISOString(),
          });
        return { changes: 1 };
      }
      const [status, id] = params as [string, string];
      const step = findStepAnyPlan(id);
      if (step) Object.assign(step, { status });
      return { changes: 1 };
    }

    // Harmonogram: schedulePlan.
    if (s.startsWith("UPDATE ai_agent_plans SET status = 'scheduled'")) {
      const [scheduled_at, id] = params as [string, string];
      const plan = db.plans.get(id);
      if (plan) Object.assign(plan, { status: 'scheduled', scheduled_at });
      return { changes: 1 };
    }

    if (s.startsWith('UPDATE ai_agent_plans')) {
      if (s.includes('execution_fencing_token = COALESCE')) {
        const [ownerToken, id] = params as [string, string];
        const plan = db.plans.get(id);
        if (!plan) return { changes: 0 };
        plan.status = 'executing';
        plan.execution_owner_token = ownerToken;
        plan.execution_fencing_token = Number(plan.execution_fencing_token || 0) + 1;
        return { changes: 1 };
      }
      if (s.includes('result_summary = ?') && s.includes('error_message = ?')) {
        const [status, result_summary, error_message, id] = params as [
          string,
          string,
          string | null,
          string,
        ];
        const plan = db.plans.get(id);
        if (plan) Object.assign(plan, { status, result_summary, error_message });
        return { changes: 1 };
      }
      if (s.includes('completed_steps = ?')) {
        const [completed_steps, current_step_index, id] = params as [number, number, string];
        const plan = db.plans.get(id);
        if (plan) Object.assign(plan, { completed_steps, current_step_index });
        return { changes: 1 };
      }
      let idx = 0;
      const status = params[idx++] as string;
      const updates: Partial<PlanRow> = { status };
      if (s.includes('current_step_index = ?'))
        updates.current_step_index = params[idx++] as number;
      if (s.includes('error_message = ?')) updates.error_message = params[idx++] as string;
      const id = params[idx] as string;
      const plan = db.plans.get(id);
      if (plan) Object.assign(plan, updates);
      return { changes: 1 };
    }

    throw new Error(`Unmocked SQL in agentPlannerService.scheduleAndWait test: ${s}`);
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

    throw new Error(`Unmocked SQL (get) in agentPlannerService.scheduleAndWait test: ${s}`);
  },

  all: async (sql: string, params: unknown[] = []) => {
    const s = normalize(sql);

    if (s.startsWith('SELECT * FROM ai_agent_plan_steps WHERE plan_id = ?')) {
      const arr = db.steps.get(params[0] as string) || [];
      return [...arr].sort((a, b) => a.step_index - b.step_index);
    }

    if (s.includes('FROM ai_agent_plans') && s.includes("status = 'scheduled'")) {
      return [...db.plans.values()]
        .filter(
          (p) =>
            p.status === 'scheduled' && p.scheduled_at && p.scheduled_at <= new Date().toISOString()
        )
        .map((p) => ({ id: p.id, organization_id: p.organization_id, user_id: p.user_id }));
    }

    if (s.includes('FROM ai_agent_plan_steps s') && s.includes("s.tool_name = 'wait_until'")) {
      const rows: Array<{
        plan_id: string;
        step_index: number;
        tool_input_json: string;
        organization_id: string;
        user_id: string;
      }> = [];
      for (const [planId, steps] of db.steps.entries()) {
        const plan = db.plans.get(planId);
        if (!plan) continue;
        for (const st of steps) {
          if (st.status === 'awaiting_approval' && st.tool_name === 'wait_until') {
            rows.push({
              plan_id: planId,
              step_index: st.step_index,
              tool_input_json: st.tool_input_json,
              organization_id: plan.organization_id,
              user_id: plan.user_id,
            });
          }
        }
      }
      return rows;
    }

    throw new Error(`Unmocked SQL (all) in agentPlannerService.scheduleAndWait test: ${s}`);
  },
}));

const { agentPlannerService } =
  await import('../../../server/src/services/ai/agentPlannerService.js');

describe('agentPlannerService.schedulePlan — Harmonogram (Fala 1, 2026-07-26)', () => {
  beforeEach(() => {
    db.plans.clear();
    db.steps.clear();
  });

  it('moves a planning plan to scheduled with the given scheduled_at', async () => {
    const plan = await agentPlannerService.createPlan({
      organizationId: 'org-1',
      userId: 'user-1',
      title: 'Cyclical review',
      steps: [{ toolName: 'search_web', toolInput: {} }],
    });

    const future = new Date(Date.now() + 3600_000).toISOString();
    const scheduled = await agentPlannerService.schedulePlan(plan.id, future);

    expect(scheduled.status).toBe('scheduled');
  });

  it('rejects scheduling a plan that is not in planning', async () => {
    const plan = await agentPlannerService.createPlan({
      organizationId: 'org-1',
      userId: 'user-1',
      title: 'Already scheduled',
      steps: [{ toolName: 'search_web', toolInput: {} }],
    });
    await agentPlannerService.schedulePlan(plan.id, new Date().toISOString());

    await expect(
      agentPlannerService.schedulePlan(plan.id, new Date().toISOString())
    ).rejects.toThrow(/not schedulable/);
  });

  it('listScheduledPlansDue returns only plans whose scheduled_at has passed', async () => {
    const past = await agentPlannerService.createPlan({
      organizationId: 'org-1',
      userId: 'user-1',
      title: 'Due',
      steps: [{ toolName: 'search_web', toolInput: {} }],
    });
    await agentPlannerService.schedulePlan(past.id, new Date(Date.now() - 60_000).toISOString());

    const future = await agentPlannerService.createPlan({
      organizationId: 'org-1',
      userId: 'user-1',
      title: 'Not due yet',
      steps: [{ toolName: 'search_web', toolInput: {} }],
    });
    await agentPlannerService.schedulePlan(
      future.id,
      new Date(Date.now() + 3600_000).toISOString()
    );

    const due = await agentPlannerService.listScheduledPlansDue();
    expect(due.map((p) => p.id)).toEqual([past.id]);
  });
});

describe('agentPlannerService — Odczekaj (pauza, Fala 1, 2026-07-26)', () => {
  beforeEach(() => {
    db.plans.clear();
    db.steps.clear();
  });

  it('pauses on a wait_until step and computes resumeAt from waitHours on first arrival', async () => {
    const plan = await agentPlannerService.createPlan({
      organizationId: 'org-1',
      userId: 'user-1',
      title: 'Has a pause',
      steps: [
        { toolName: 'search_web', toolInput: {} },
        { toolName: 'wait_until', toolInput: { waitHours: 2 }, requiresApproval: true },
      ],
    });

    const executor = vi.fn().mockResolvedValue('ok');
    const before = Date.now();
    const result = await agentPlannerService.executePlan(plan.id, executor);
    const after = Date.now();

    expect(executor).toHaveBeenCalledTimes(1); // only step 0 ran; step 1 paused
    expect(result.status).toBe('awaiting_approval');
    expect(result.steps[1].status).toBe('awaiting_approval');

    const resumeAt = (result.steps[1].toolInput as any).resumeAt;
    expect(resumeAt).toBeDefined();
    const resumeMs = new Date(resumeAt).getTime();
    expect(resumeMs).toBeGreaterThanOrEqual(before + 2 * 3_600_000 - 1000);
    expect(resumeMs).toBeLessThanOrEqual(after + 2 * 3_600_000 + 1000);
  });

  it('listWaitStepsDue only returns wait_until steps whose resumeAt has passed', async () => {
    const plan = await agentPlannerService.createPlan({
      organizationId: 'org-1',
      userId: 'user-1',
      title: 'Pause not due yet',
      steps: [{ toolName: 'wait_until', toolInput: { waitHours: 999 }, requiresApproval: true }],
    });
    await agentPlannerService.executePlan(plan.id, vi.fn());

    expect(await agentPlannerService.listWaitStepsDue()).toEqual([]);

    // Simulate time having passed: rewrite resumeAt into the past directly
    // (this is the fake DB, standing in for "the cron tick fires 999h later").
    const steps = db.steps.get(plan.id)!;
    const input = JSON.parse(steps[0].tool_input_json);
    input.resumeAt = new Date(Date.now() - 1000).toISOString();
    steps[0].tool_input_json = JSON.stringify(input);

    const due = await agentPlannerService.listWaitStepsDue();
    expect(due).toEqual([
      {
        planId: plan.id,
        stepIndex: 0,
        organizationId: 'org-1',
        userId: 'user-1',
        canonicalRunId: null,
        projectId: null,
      },
    ]);
  });

  it('resumeWaitStep clears the gate and execution continues past the pause on the next run', async () => {
    const plan = await agentPlannerService.createPlan({
      organizationId: 'org-1',
      userId: 'user-1',
      title: 'Pause then a real step',
      steps: [
        { toolName: 'wait_until', toolInput: { waitHours: 0.0001 }, requiresApproval: true },
        { toolName: 'search_web', toolInput: {} },
      ],
    });

    const executor = vi.fn().mockResolvedValue('ok');
    const paused = await agentPlannerService.executePlan(plan.id, executor);
    expect(paused.status).toBe('awaiting_approval');
    expect(executor).toHaveBeenCalledTimes(0);

    await agentPlannerService.resumeWaitStep(plan.id, 0);
    const finished = await agentPlannerService.executePlan(plan.id, executor);

    expect(finished.status).toBe('completed');
    // wait_until resolves via toolExecutor too (executeToolCall registers a
    // no-op case) — both steps go through the same executor in this test.
    expect(executor).toHaveBeenCalledTimes(2);
  });
});
