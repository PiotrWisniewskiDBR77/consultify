/**
 * Agent Planner Service
 *
 * Orchestrates multi-step task execution with plan-execute-observe loops.
 * Supports interactive chat-based planning, background execution,
 * checkpoints, and SSE progress streaming.
 */
import { randomUUID } from 'node:crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { SIDE_EFFECT_TOOLS } from './sideEffectTools.js';

// Re-exported for backward compatibility with any existing import of
// `SIDE_EFFECT_TOOLS` from this module — the canonical source is now
// `sideEffectTools.ts` (see that file's header for why it was split out).
export { SIDE_EFFECT_TOOLS };

export type PlanStatus =
  | 'planning'
  | 'awaiting_approval'
  | 'executing'
  | 'paused'
  | 'completed'
  | 'completed_with_errors'
  | 'failed'
  | 'cancelled';
export type StepStatus =
  | 'pending'
  | 'awaiting_approval'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface PlanStep {
  id: string;
  stepIndex: number;
  toolName: string;
  toolInput: Record<string, unknown>;
  status: StepStatus;
  result?: unknown;
  errorMessage?: string;
  requiresApproval: boolean;
  durationMs?: number;
}

export interface AgentPlan {
  id: string;
  organizationId: string;
  conversationId?: string;
  userId: string;
  title: string;
  description?: string;
  status: PlanStatus;
  steps: PlanStep[];
  totalSteps: number;
  completedSteps: number;
  currentStepIndex: number;
  resultSummary?: string;
  errorMessage?: string;
  isBackground: boolean;
  createdAt: string;
}

export interface SSEEmitter {
  emit: (event: string, data: unknown) => void;
}

class AgentPlannerService {
  async createPlan(input: {
    organizationId: string;
    userId: string;
    conversationId?: string;
    title: string;
    description?: string;
    steps: Array<{ toolName: string; toolInput: Record<string, unknown> }>;
    isBackground?: boolean;
    scheduledAt?: string;
  }): Promise<AgentPlan> {
    const planId = randomUUID();
    const steps: PlanStep[] = input.steps.map((s, i) => ({
      id: randomUUID(),
      stepIndex: i,
      toolName: s.toolName,
      toolInput: s.toolInput,
      status: 'pending' as StepStatus,
      requiresApproval: SIDE_EFFECT_TOOLS.has(s.toolName),
    }));

    await dbRun(
      `INSERT INTO ai_agent_plans
        (id, organization_id, conversation_id, user_id, title, description,
         status, total_steps, completed_steps, current_step_index, plan_json,
         is_background, scheduled_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'planning', ?, 0, 0, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        planId,
        input.organizationId,
        input.conversationId || null,
        input.userId,
        input.title,
        input.description || null,
        steps.length,
        JSON.stringify(steps),
        input.isBackground ? 1 : 0,
        input.scheduledAt || null,
      ]
    );

    for (const step of steps) {
      await dbRun(
        `INSERT INTO ai_agent_plan_steps
          (id, plan_id, step_index, tool_name, tool_input_json, status,
           requires_approval, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, datetime('now'))`,
        [
          step.id,
          planId,
          step.stepIndex,
          step.toolName,
          JSON.stringify(step.toolInput),
          step.requiresApproval ? 1 : 0,
        ]
      );
    }

    return {
      id: planId,
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      userId: input.userId,
      title: input.title,
      description: input.description,
      status: 'planning',
      steps,
      totalSteps: steps.length,
      completedSteps: 0,
      currentStepIndex: 0,
      isBackground: input.isBackground || false,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Executes a plan's steps sequentially, delegating each step to `toolExecutor`.
   *
   * Continue-on-error (Piotr decision 07-16, koncept §5 Q1 — RESOLVED):
   * a failing step is marked `failed` but does NOT stop the plan — execution
   * continues with the remaining steps (robustness over fail-fast). This
   * engine has no step-dependency graph (unlike `toolChainExecutor`'s DAG with
   * `$step.X.field` interpolation) — steps here are independent tool calls, so
   * "continue with steps that don't depend on the failed one" reduces to
   * "continue sequentially, skipping only the failed step itself". A step that
   * requires approval still PAUSES the plan (`awaiting_approval`) — that is a
   * checkpoint, not an error, and is unaffected by this change.
   *
   * Final status: `completed` when every step succeeded, `completed_with_errors`
   * when at least one step failed but the loop still ran to the end (partial
   * result — still useful, per the resilience decision), `failed` is now only
   * reachable via `cancelPlan`'s counterpart paths or an unexpected exception
   * escaping this method (e.g. a DB write failure) — never as a "some steps
   * broke" verdict.
   */
  async executePlan(
    planId: string,
    toolExecutor: (toolName: string, input: Record<string, unknown>) => Promise<unknown>,
    emitter?: SSEEmitter
  ): Promise<AgentPlan> {
    const plan = await this.getPlan(planId);
    if (!plan) throw new Error(`Plan ${planId} not found`);

    await this.updatePlanStatus(planId, 'executing');
    emitter?.emit('agent_plan', { planId, status: 'executing', steps: plan.steps });

    const failedSteps: PlanStep[] = [];

    for (let i = plan.currentStepIndex; i < plan.steps.length; i++) {
      const step = plan.steps[i];

      if (step.requiresApproval && step.status !== 'awaiting_approval') {
        await this.updateStepStatus(step.id, 'awaiting_approval');
        await this.updatePlanStatus(planId, 'awaiting_approval', i);
        emitter?.emit('agent_checkpoint', {
          planId,
          stepIndex: i,
          toolName: step.toolName,
          requiresApproval: true,
        });
        step.status = 'awaiting_approval'; // keep the returned plan's in-memory step in sync with the DB write above
        plan.status = 'awaiting_approval';
        plan.currentStepIndex = i;
        return plan;
      }

      emitter?.emit('agent_step_start', {
        planId,
        stepIndex: i,
        toolName: step.toolName,
        totalSteps: plan.totalSteps,
      });

      const startMs = Date.now();
      await this.updateStepStatus(step.id, 'running');

      try {
        const result = await toolExecutor(step.toolName, step.toolInput);
        const durationMs = Date.now() - startMs;

        step.result = result;
        step.status = 'completed';
        step.durationMs = durationMs;

        await dbRun(
          `UPDATE ai_agent_plan_steps
           SET status = 'completed', result_json = ?, duration_ms = ?,
               completed_at = datetime('now')
           WHERE id = ?`,
          [JSON.stringify(result), durationMs, step.id]
        );

        emitter?.emit('agent_step_complete', {
          planId,
          stepIndex: i,
          toolName: step.toolName,
          durationMs,
          success: true,
        });
      } catch (err: any) {
        const durationMs = Date.now() - startMs;
        step.status = 'failed';
        step.errorMessage = err?.message || 'Unknown error';
        step.durationMs = durationMs;
        failedSteps.push(step);

        await dbRun(
          `UPDATE ai_agent_plan_steps
           SET status = 'failed', error_message = ?, duration_ms = ?,
               completed_at = datetime('now')
           WHERE id = ?`,
          [step.errorMessage, durationMs, step.id]
        );

        emitter?.emit('agent_step_complete', {
          planId,
          stepIndex: i,
          toolName: step.toolName,
          durationMs,
          success: false,
          error: step.errorMessage,
        });

        // Continue-on-error: do NOT return here. Fall through to the next
        // step — no dependency graph exists in this engine, so "skip the
        // failed step and keep going" is the correct continuation.
      }

      // Progress reflects "steps attempted" (success or failure) so the
      // panel's progress bar keeps moving through a partially-failing plan;
      // per-step status/errorMessage (already surfaced to the UI) is what
      // distinguishes success from failure at each position.
      await this.updatePlanProgress(planId, i + 1);
    }

    const finalStatus: PlanStatus = failedSteps.length > 0 ? 'completed_with_errors' : 'completed';
    const finalErrorMessage =
      failedSteps.length > 0
        ? `${failedSteps.length}/${plan.steps.length} steps failed: ${failedSteps
            .map((s) => `${s.toolName} (${s.errorMessage || 'unknown error'})`)
            .join('; ')}`
        : undefined;
    const finalResultSummary =
      failedSteps.length === 0
        ? `Completed ${plan.steps.length}/${plan.steps.length} steps.`
        : `Completed ${plan.steps.length - failedSteps.length}/${plan.steps.length} steps (${failedSteps.length} failed — see report).`;

    await this.finalizePlan(planId, finalStatus, finalResultSummary, finalErrorMessage);
    emitter?.emit('agent_plan', {
      planId,
      status: finalStatus,
      failedCount: failedSteps.length,
      totalSteps: plan.steps.length,
    });

    plan.status = finalStatus;
    plan.completedSteps = plan.steps.length;
    plan.resultSummary = finalResultSummary;
    plan.errorMessage = finalErrorMessage;
    return plan;
  }

  async approveStep(planId: string, stepIndex: number, userId: string): Promise<void> {
    const step = (await dbGet(
      `SELECT id FROM ai_agent_plan_steps
       WHERE plan_id = ? AND step_index = ? AND status = 'awaiting_approval'`,
      [planId, stepIndex]
    )) as any;
    if (!step) throw new Error('Step not found or not awaiting approval');

    await dbRun(
      `UPDATE ai_agent_plan_steps
       SET status = 'pending', approved_by = ?, approved_at = datetime('now')
       WHERE id = ?`,
      [userId, step.id]
    );
  }

  async cancelPlan(planId: string): Promise<void> {
    await this.updatePlanStatus(planId, 'cancelled');
    await dbRun(
      `UPDATE ai_agent_plan_steps SET status = 'skipped'
       WHERE plan_id = ? AND status IN ('pending', 'awaiting_approval')`,
      [planId]
    );
  }

  async getPlan(planId: string): Promise<AgentPlan | null> {
    const row = (await dbGet(`SELECT * FROM ai_agent_plans WHERE id = ?`, [planId])) as any;
    if (!row) return null;

    const stepRows = (await dbAll(
      `SELECT * FROM ai_agent_plan_steps WHERE plan_id = ? ORDER BY step_index`,
      [planId]
    )) as any[];

    const steps: PlanStep[] = (stepRows || []).map((s: any) => ({
      id: s.id,
      stepIndex: s.step_index,
      toolName: s.tool_name,
      toolInput: JSON.parse(s.tool_input_json || '{}'),
      status: s.status as StepStatus,
      result: s.result_json ? JSON.parse(s.result_json) : undefined,
      errorMessage: s.error_message || undefined,
      requiresApproval: Boolean(s.requires_approval),
      durationMs: s.duration_ms || undefined,
    }));

    return {
      id: row.id,
      organizationId: row.organization_id,
      conversationId: row.conversation_id || undefined,
      userId: row.user_id,
      title: row.title,
      description: row.description || undefined,
      status: row.status as PlanStatus,
      steps,
      totalSteps: row.total_steps,
      completedSteps: row.completed_steps,
      currentStepIndex: row.current_step_index,
      resultSummary: row.result_summary || undefined,
      errorMessage: row.error_message || undefined,
      isBackground: Boolean(row.is_background),
      createdAt: row.created_at,
    };
  }

  async listPlans(orgId: string, userId?: string): Promise<AgentPlan[]> {
    const userFilter = userId ? 'AND user_id = ?' : '';
    const params = userId ? [orgId, userId] : [orgId];
    const rows = (await dbAll(
      `SELECT * FROM ai_agent_plans
       WHERE organization_id = ? ${userFilter}
       ORDER BY created_at DESC LIMIT 50`,
      params
    )) as any[];

    return (rows || []).map((row: any) => ({
      id: row.id,
      organizationId: row.organization_id,
      conversationId: row.conversation_id || undefined,
      userId: row.user_id,
      title: row.title,
      description: row.description || undefined,
      status: row.status as PlanStatus,
      steps: JSON.parse(row.plan_json || '[]'),
      totalSteps: row.total_steps,
      completedSteps: row.completed_steps,
      currentStepIndex: row.current_step_index,
      resultSummary: row.result_summary || undefined,
      errorMessage: row.error_message || undefined,
      isBackground: Boolean(row.is_background),
      createdAt: row.created_at,
    }));
  }

  async executeBackgroundPlan(payload: {
    planId: string;
    organizationId: string;
    userId: string;
  }): Promise<AgentPlan> {
    const { executeToolCall } = await import('./toolDefinitions.js');

    const executor = async (toolName: string, input: Record<string, unknown>) => {
      return executeToolCall(toolName, input, {
        organizationId: payload.organizationId,
        userId: payload.userId,
      });
    };

    return this.executePlan(payload.planId, executor);
  }

  private async updatePlanStatus(
    planId: string,
    status: PlanStatus,
    currentStep?: number,
    errorMessage?: string
  ): Promise<void> {
    const sets = ['status = ?', "updated_at = datetime('now')"];
    const params: unknown[] = [status];

    if (currentStep !== undefined) {
      sets.push('current_step_index = ?');
      params.push(currentStep);
    }
    if (errorMessage) {
      sets.push('error_message = ?');
      params.push(errorMessage);
    }
    if (status === 'completed' || status === 'completed_with_errors') {
      sets.push("completed_at = datetime('now')");
    }
    if (status === 'executing') {
      sets.push("started_at = COALESCE(started_at, datetime('now'))");
    }

    params.push(planId);
    await dbRun(`UPDATE ai_agent_plans SET ${sets.join(', ')} WHERE id = ?`, params);
  }

  /** Terminal-state writer for `executePlan`'s end-of-loop finalization (continue-on-error report). */
  private async finalizePlan(
    planId: string,
    status: PlanStatus,
    resultSummary: string,
    errorMessage?: string
  ): Promise<void> {
    await dbRun(
      `UPDATE ai_agent_plans
       SET status = ?, result_summary = ?, error_message = ?, completed_at = datetime('now'),
           updated_at = datetime('now')
       WHERE id = ?`,
      [status, resultSummary, errorMessage || null, planId]
    );
  }

  private async updateStepStatus(stepId: string, status: StepStatus): Promise<void> {
    const startedClause = status === 'running' ? ", started_at = datetime('now')" : '';
    await dbRun(`UPDATE ai_agent_plan_steps SET status = ?${startedClause} WHERE id = ?`, [
      status,
      stepId,
    ]);
  }

  private async updatePlanProgress(planId: string, completedSteps: number): Promise<void> {
    await dbRun(
      `UPDATE ai_agent_plans
       SET completed_steps = ?, current_step_index = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [completedSteps, completedSteps, planId]
    );
  }
}

export const agentPlannerService = new AgentPlannerService();
export default agentPlannerService;
