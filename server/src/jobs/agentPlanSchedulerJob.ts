/**
 * Agent Plan Scheduler Job (Fala 1 flow, 2026-07-26)
 *
 * Two responsibilities in one tick, both driven by columns that already
 * existed in the schema but had no reader until now:
 *
 * 1. HARMONOGRAM — dispatches plans in status 'scheduled' whose
 *    `scheduled_at` has passed (`agentPlannerService.schedulePlan`,
 *    `POST /:id/schedule`). Enqueues the SAME `AGENT_BACKGROUND_TASK` job the
 *    HTTP routes use (`tryDispatchBackgroundExecution` in
 *    agent-plan.routes.ts) — one execution path, not a second one.
 * 2. ODCZEKAJ (pauza) — auto-resumes steps with `toolName: 'wait_until'`
 *    parked in `awaiting_approval` once `toolInput.resumeAt` has passed
 *    (`agentPlannerService.resumeWaitStep`), then re-dispatches the plan so
 *    execution continues past the pause.
 *
 * Best-effort per item: one failing plan/step never blocks the rest of the
 * tick. Never runs in tests unless `force` is passed (mirrors
 * ideaMapAutoSnapshotJob.ts's guard) — cron ticks firing mid-unit-test would
 * be pure noise.
 */
import logger from '../utils/Logger.js';

const isTestEnv = (): boolean => process.env.NODE_ENV === 'test' || !!process.env.VITEST;

async function enqueueBackgroundExecution(payload: {
  planId: string;
  organizationId: string;
  userId: string;
  canonicalRunId?: string | null;
  projectId?: string | null;
  dispatchKey?: string;
  beforeEnqueue?: () => Promise<void>;
}): Promise<boolean> {
  try {
    const { dispatchAgentTask } = await import('../services/ai/agentTaskDispatchService.js');
    const dispatchKey = payload.dispatchKey || payload.planId;
    const enqueue = () => dispatchAgentTask({ planId: payload.planId, organizationId: payload.organizationId,
      userId: payload.userId, dispatchKey }, { beforeEnqueue: payload.beforeEnqueue });
    if (payload.canonicalRunId) {
      const { agentPlannerService } = await import('../services/ai/agentPlannerService.js');
      const governed = await agentPlannerService.executeGovernedEnqueue({
        planId: payload.planId,
        organizationId: payload.organizationId,
        userId: payload.userId,
        dispatchKey,
        enqueue,
      });
      const status = (governed.result as { status?: string } | undefined)?.status;
      return status === 'ENQUEUED' || status === 'REPLAY' || governed.replayed;
    } else {
      const dispatched = await enqueue();
      return dispatched.status === 'ENQUEUED' || dispatched.status === 'REPLAY';
    }
  } catch (error: unknown) {
    logger.warn('[AgentPlanScheduler] Background dispatch unavailable, plan left pending', {
      planId: payload.planId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export interface AgentPlanSchedulerResult {
  plansDispatched: number;
  waitStepsResumed: number;
  contextBlocked: number;
  errors: number;
}

export async function runAgentPlanScheduler(force = false): Promise<AgentPlanSchedulerResult> {
  if (process.env.ENABLE_AI_TASKS_WORKER !== 'true') {
    return { plansDispatched: 0, waitStepsResumed: 0, contextBlocked: 0, errors: 0 };
  }
  if (isTestEnv() && !force) {
    return { plansDispatched: 0, waitStepsResumed: 0, contextBlocked: 0, errors: 0 };
  }

  const { agentPlannerService } = await import('../services/ai/agentPlannerService.js');
  const result: AgentPlanSchedulerResult = {
    plansDispatched: 0,
    waitStepsResumed: 0,
    contextBlocked: 0,
    errors: 0,
  };

  try {
    const duePlans = await agentPlannerService.listScheduledPlansDue();
    for (const plan of duePlans) {
      try {
        const contextGate = await agentPlannerService.gateScheduledWorkerDispatch({
          planId: plan.id,
          organizationId: plan.organizationId,
          userId: plan.userId,
        });
        if (!contextGate.allowed) {
          result.contextBlocked++;
          continue;
        }
        const enqueued = await enqueueBackgroundExecution({
          ...plan,
          planId: plan.id,
          dispatchKey: plan.id,
        });
        if (enqueued) result.plansDispatched++;
        else result.errors++;
      } catch (err) {
        result.errors++;
        logger.error('[AgentPlanScheduler] Failed to dispatch scheduled plan', {
          planId: plan.id,
          err,
        });
      }
    }
  } catch (err) {
    result.errors++;
    logger.error('[AgentPlanScheduler] Failed to list scheduled plans', { err });
  }

  try {
    const dueWaitSteps = await agentPlannerService.listWaitStepsDue();
    for (const step of dueWaitSteps) {
      try {
        const contextGate = await agentPlannerService.gateScheduledWorkerDispatch({
          planId: step.planId,
          organizationId: step.organizationId,
          userId: step.userId,
          externalId: `${step.planId}:wait:${step.stepIndex}`,
        });
        if (!contextGate.allowed) {
          result.contextBlocked++;
          continue;
        }
        const enqueued = await enqueueBackgroundExecution({
          ...step,
          dispatchKey: `${step.planId}:wait:${step.stepIndex}`,
          beforeEnqueue: () => agentPlannerService.resumeWaitStep(step.planId, step.stepIndex),
        });
        if (enqueued) result.waitStepsResumed++;
        else result.errors++;
      } catch (err) {
        result.errors++;
        logger.error('[AgentPlanScheduler] Failed to resume wait step', {
          planId: step.planId,
          stepIndex: step.stepIndex,
          err,
        });
      }
    }
  } catch (err) {
    result.errors++;
    logger.error('[AgentPlanScheduler] Failed to list due wait steps', { err });
  }

  if (
    result.plansDispatched > 0 ||
    result.waitStepsResumed > 0 ||
    result.contextBlocked > 0 ||
    result.errors > 0
  ) {
    logger.info('[AgentPlanScheduler] Tick completed', result);
  }

  return result;
}
