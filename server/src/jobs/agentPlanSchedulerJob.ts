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
}): Promise<void> {
  try {
    const { default: aiQueue } = (await import('../queues/aiQueue.js')) as {
      default: { add: (name: string, data: unknown) => Promise<unknown> };
    };
    await aiQueue.add('AGENT_BACKGROUND_TASK', {
      taskType: 'AGENT_BACKGROUND_TASK',
      payload,
      userId: payload.userId,
    });
  } catch (error: unknown) {
    logger.warn('[AgentPlanScheduler] Background dispatch unavailable, plan left pending', {
      planId: payload.planId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export interface AgentPlanSchedulerResult {
  plansDispatched: number;
  waitStepsResumed: number;
  errors: number;
}

export async function runAgentPlanScheduler(force = false): Promise<AgentPlanSchedulerResult> {
  if (isTestEnv() && !force) {
    return { plansDispatched: 0, waitStepsResumed: 0, errors: 0 };
  }

  const { agentPlannerService } = await import('../services/ai/agentPlannerService.js');
  const result: AgentPlanSchedulerResult = { plansDispatched: 0, waitStepsResumed: 0, errors: 0 };

  try {
    const duePlans = await agentPlannerService.listScheduledPlansDue();
    for (const plan of duePlans) {
      try {
        await enqueueBackgroundExecution(plan);
        result.plansDispatched++;
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
        await agentPlannerService.resumeWaitStep(step.planId, step.stepIndex);
        await enqueueBackgroundExecution(step);
        result.waitStepsResumed++;
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

  if (result.plansDispatched > 0 || result.waitStepsResumed > 0 || result.errors > 0) {
    logger.info('[AgentPlanScheduler] Tick completed', result);
  }

  return result;
}
