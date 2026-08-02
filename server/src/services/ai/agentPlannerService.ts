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
  | 'scheduled'
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
  /** Set once a human approves a side-effect step; presence means the approval
   * gate must NOT re-fire on resume (bug fix 2026-07-16 — plan never completed). */
  approvedAt?: string | null;
  /** Actor persisted with the approval. Exposed on read-back so the approval
   * is an auditable receipt rather than an invisible execution flag. */
  approvedBy?: string | null;
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
  /**
   * Kolumny huba (2026-07-28, „odpowiednie kolumny" — zgłoszenie właściciela):
   * kolumny istniały w schemacie od Harmonogramu/silnika (`scheduled_at`,
   * `started_at`/`completed_at` na PLANIE — NIE mylić z per-krokowym
   * `duration_ms` na `ai_agent_plan_steps`, patrz `updateStepStatus`), ale
   * nigdy nie były zwracane przez `getPlan`/`listPlans` — front nie miał z
   * czego zbudować „Ostatnie uruchomienie"/„Zaplanowany na"/„Czas wykonania".
   */
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  /** AGT-FOLDERS (2026-07-28): folder ("Moje procesy"), nullable = bez folderu. */
  folderId?: string | null;
}

export interface SSEEmitter {
  emit: (event: string, data: unknown) => void;
}

export interface ExecutionLease {
  planId: string;
  ownerToken: string;
  fencingToken: number;
}

export class AgentExecutionLeaseLostError extends Error {
  readonly code = 'AGENT_EXECUTION_LEASE_LOST';

  constructor(planId: string) {
    super(`Execution lease lost for plan ${planId}`);
    this.name = 'AgentExecutionLeaseLostError';
  }
}

export class AgentResultPersistenceError extends Error {
  readonly code = 'AGENT_RESULT_PERSISTENCE_FAILED';

  constructor(planId: string, cause: unknown) {
    super(`Result persistence failed for plan ${planId}`, { cause });
    this.name = 'AgentResultPersistenceError';
  }
}

type PlanToolExecutor = (
  toolName: string,
  input: Record<string, unknown>,
  execution?: { operationKey: string; ownerToken: string; fencingToken: number }
) => Promise<unknown>;

class AgentPlannerService {
  private readonly executionLeaseSeconds = 300;
  private readonly heartbeatIntervalMs = 60_000;

  async claimExecution(planId: string, ownerToken = randomUUID()): Promise<ExecutionLease | null> {
    const result = await dbRun(
      `UPDATE ai_agent_plans
       SET status = 'executing',
           execution_owner_token = ?,
           execution_fencing_token = COALESCE(execution_fencing_token, 0) + 1,
           execution_lease_expires_at = datetime('now', '+${this.executionLeaseSeconds} seconds'),
           execution_heartbeat_at = datetime('now'),
           started_at = COALESCE(started_at, datetime('now')),
           updated_at = datetime('now')
       WHERE id = ?
         AND (
           status IN ('planning', 'scheduled', 'awaiting_approval', 'paused')
           OR (
             status = 'executing'
             AND (execution_lease_expires_at IS NULL OR execution_lease_expires_at <= datetime('now'))
           )
         )`,
      [ownerToken, planId]
    );
    if (!result.changes) return null;
    const claimed = (await dbGet(
      `SELECT execution_fencing_token FROM ai_agent_plans
       WHERE id = ? AND execution_owner_token = ?`,
      [planId, ownerToken]
    )) as { execution_fencing_token?: number } | undefined;
    if (!claimed) throw new AgentExecutionLeaseLostError(planId);
    return {
      planId,
      ownerToken,
      fencingToken: Number(claimed.execution_fencing_token || 0),
    };
  }

  async renewExecutionLease(lease: ExecutionLease): Promise<void> {
    const result = await dbRun(
      `UPDATE ai_agent_plans
       SET execution_lease_expires_at = datetime('now', '+${this.executionLeaseSeconds} seconds'),
           execution_heartbeat_at = datetime('now'),
           updated_at = datetime('now')
       WHERE id = ? AND status = 'executing'
         AND execution_owner_token = ? AND execution_fencing_token = ?
         AND execution_lease_expires_at > datetime('now')`,
      [lease.planId, lease.ownerToken, lease.fencingToken]
    );
    if (!result.changes) throw new AgentExecutionLeaseLostError(lease.planId);
  }

  private leasePredicate(alias = ''): string {
    const prefix = alias ? `${alias}.` : '';
    return `${prefix}execution_owner_token = ? AND ${prefix}execution_fencing_token = ? AND ${prefix}execution_lease_expires_at > datetime('now')`;
  }

  private async guardedPlanRun(
    lease: ExecutionLease,
    sql: string,
    params: unknown[]
  ): Promise<void> {
    const result = await dbRun(sql, [...params, lease.ownerToken, lease.fencingToken]);
    if (!result.changes) throw new AgentExecutionLeaseLostError(lease.planId);
  }

  private async guardedStepRun(
    lease: ExecutionLease,
    sqlPrefix: string,
    params: unknown[],
    stepId: string
  ): Promise<void> {
    const result = await dbRun(
      `${sqlPrefix}
       WHERE id = ? AND EXISTS (
         SELECT 1 FROM ai_agent_plans p
         WHERE p.id = ai_agent_plan_steps.plan_id AND ${this.leasePredicate('p')}
       )`,
      [...params, stepId, lease.ownerToken, lease.fencingToken]
    );
    if (!result.changes) throw new AgentExecutionLeaseLostError(lease.planId);
  }
  async createPlan(input: {
    organizationId: string;
    userId: string;
    conversationId?: string;
    title: string;
    description?: string;
    steps: Array<{
      toolName: string;
      toolInput: Record<string, unknown>;
      /**
       * DOROBKA C (2026-07-23, decyzja Piotra): jawny override bramki akceptu
       * dla kroki którego `toolName` sam w sobie nie jest w `SIDE_EFFECT_TOOLS`
       * (np. faza "Rekomendacje" procesu — `calculate_financial` to czysty
       * odczyt/kalkulacja, ale Piotr chce zatwierdzenia rekomendacji zanim
       * pójdą do wdrożenia). Gdy podane (boolean), wygrywa nad
       * `SIDE_EFFECT_TOOLS.has(toolName)`. Gdy brak — zachowanie jak dotąd.
       */
      requiresApproval?: boolean;
    }>;
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
      requiresApproval:
        typeof s.requiresApproval === 'boolean'
          ? s.requiresApproval
          : SIDE_EFFECT_TOOLS.has(s.toolName),
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
    toolExecutor: PlanToolExecutor,
    emitter?: SSEEmitter
  ): Promise<AgentPlan> {
    const plan = await this.getPlan(planId);
    if (!plan) throw new Error(`Plan ${planId} not found`);

    if (['completed', 'completed_with_errors', 'failed', 'cancelled'].includes(plan.status)) {
      return plan;
    }

    const lease = await this.claimExecution(planId);
    if (!lease) {
      const alreadyClaimed = await this.getPlan(planId);
      if (!alreadyClaimed) throw new Error(`Plan ${planId} disappeared during execution claim`);
      return alreadyClaimed;
    }

    plan.status = 'executing';
    emitter?.emit('agent_plan', { planId, status: 'executing', steps: plan.steps });

    const failedSteps: PlanStep[] = [];

    for (let i = plan.currentStepIndex; i < plan.steps.length; i++) {
      const step = plan.steps[i];

      // Gate: pause only an un-approved side-effect step. `approveStep` sets the
      // step back to 'pending' + stamps approved_at, so WITHOUT the !approvedAt
      // guard the gate re-fired forever and the plan never reached 'completed'.
      if (step.requiresApproval && !step.approvedAt && step.status !== 'awaiting_approval') {
        // Odczekaj (pauza, Fala 1 2026-07-26): reużywa TĘ SAMĄ bramkę co ludzka
        // zgoda — jedyna różnica to KTO ją zdejmie (cron `resumeWaitStep`
        // zamiast człowieka klikającego "Zatwierdź"). `resumeAt` liczony jest
        // TERAZ, przy pierwszym dotarciu do kroku (nie przy autorstwie
        // schematu — wtedy nie wiadomo kiedy proces tu dotrze).
        if (step.toolName === 'wait_until' && !step.toolInput?.resumeAt) {
          const hours =
            typeof step.toolInput?.waitHours === 'number' ? step.toolInput.waitHours : 24;
          const resumeAt = new Date(Date.now() + hours * 3_600_000).toISOString();
          step.toolInput = { ...step.toolInput, resumeAt };
          await this.guardedStepRun(
            lease,
            `UPDATE ai_agent_plan_steps SET tool_input_json = ?`,
            [JSON.stringify(step.toolInput)],
            step.id
          );
        }
        await this.updateStepStatus(step.id, 'awaiting_approval', lease);
        await this.releaseLeaseAtCheckpoint(lease, 'awaiting_approval', i);
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
      await this.updateStepStatus(step.id, 'running', lease);

      // Zmienne między krokami (Fala 1, 2026-07-26): `$step.N.pole` w
      // toolInput odnosi się do WYNIKU kroku o numerze N (1-based, ten sam
      // numer co w canvasie). Rozwiązywane dopiero TERAZ, tuż przed
      // wykonaniem — zapisany w bazie `tool_input_json` zostaje szablonem
      // (nie nadpisujemy go rozwiązaną wartością), żeby podgląd/edycja
      // schematu nadal pokazywały odniesienie, nie zamrożoną wartość z
      // pierwszego uruchomienia. Wzorzec składni ($step.X.pole) przeniesiony
      // z `toolChainExecutor.ts` (silnik DAG, dziś nieużywany) — tam
      // referencja szła po ID kroku z grafu; tu po numerze porządkowym, bo to
      // jedyny identyfikator, jaki user widzi na liniowym schemacie.
      const resolvedInput = this.resolveStepInputVariables(step.toolInput, plan.steps.slice(0, i));

      try {
        const operationKey = `agent-plan:${planId}:step:${step.id}`;
        let heartbeatFailure: unknown = null;
        const heartbeat = setInterval(() => {
          void this.renewExecutionLease(lease).catch((error) => {
            heartbeatFailure = error;
          });
        }, this.heartbeatIntervalMs);
        let result: unknown;
        try {
          result = await this.runToolWithRetry(
            toolExecutor,
            step.toolName,
            resolvedInput,
            { operationKey, ownerToken: lease.ownerToken, fencingToken: lease.fencingToken }
          );
        } finally {
          clearInterval(heartbeat);
        }
        if (heartbeatFailure) throw heartbeatFailure;
        const durationMs = Date.now() - startMs;

        step.result = result;
        step.status = 'completed';
        step.durationMs = durationMs;

        try {
          await this.guardedStepRun(
            lease,
            `UPDATE ai_agent_plan_steps
             SET status = 'completed', result_json = ?, duration_ms = ?,
                 completed_at = datetime('now')`,
            [JSON.stringify(result), durationMs],
            step.id
          );
        } catch (error) {
          if (error instanceof AgentExecutionLeaseLostError) throw error;
          throw new AgentResultPersistenceError(planId, error);
        }

        emitter?.emit('agent_step_complete', {
          planId,
          stepIndex: i,
          toolName: step.toolName,
          durationMs,
          success: true,
        });
      } catch (err: any) {
        if (
          err instanceof AgentExecutionLeaseLostError ||
          err instanceof AgentResultPersistenceError
        )
          throw err;
        const durationMs = Date.now() - startMs;
        step.status = 'failed';
        step.errorMessage = err?.message || 'Unknown error';
        step.durationMs = durationMs;
        failedSteps.push(step);

        await this.guardedStepRun(
          lease,
          `UPDATE ai_agent_plan_steps
           SET status = 'failed', error_message = ?, duration_ms = ?,
               completed_at = datetime('now')`,
          [step.errorMessage, durationMs],
          step.id
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
      await this.updatePlanProgress(planId, i + 1, lease);
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

    await this.finalizePlan(planId, finalStatus, finalResultSummary, finalErrorMessage, lease);
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

  /**
   * Harmonogram (Fala 1, 2026-07-26): plan gotowy w `planning` (schemat
   * ułożony, jeszcze nie uruchomiony) przechodzi w `scheduled` z konkretnym
   * `scheduled_at` zamiast dispatchu od razu. `runAgentPlanScheduler`
   * (`server/src/jobs/agentPlanSchedulerJob.ts`, cron co 2 min) odbiera go,
   * gdy czas nadejdzie. Kolumna `scheduled_at` istniała w schemacie od dawna
   * (`ai_agent_plans`), ale nic jej dotąd nie czytało — to pierwszy konsument.
   */
  async schedulePlan(planId: string, scheduledAt: string): Promise<AgentPlan> {
    const plan = await this.getPlan(planId);
    if (!plan) throw new Error('Plan not found');
    if (plan.status !== 'planning') {
      throw new Error(`Plan not schedulable in status '${plan.status}' (only 'planning')`);
    }
    await dbRun(
      `UPDATE ai_agent_plans SET status = 'scheduled', scheduled_at = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [scheduledAt, planId]
    );
    const updated = await this.getPlan(planId);
    if (!updated) throw new Error('Plan disappeared after schedule');
    return updated;
  }

  /** Plany `scheduled`, których `scheduled_at` już minął — do dispatchu przez cron. */
  async listScheduledPlansDue(): Promise<
    Array<{ id: string; organizationId: string; userId: string }>
  > {
    const rows = (await dbAll(
      `SELECT id, organization_id, user_id FROM ai_agent_plans
       WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= datetime('now')`
    )) as any[];
    return (rows || []).map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      userId: r.user_id,
    }));
  }

  /**
   * Kroki 'pauza' (`toolName='wait_until'`) czekające na zdjęcie bramki —
   * filtr po `toolInput.resumeAt` robiony w JS (nie SQL — `resumeAt` jest
   * zagnieżdżone w `tool_input_json`, a silnik działa nad sqlite i Postgres
   * jednym zapytaniem przez `DbPromise`, więc string-matching na JSON w SQL
   * byłby kruchy). Zbiór jest z definicji mały (aktywne pauzy, nie cała
   * historia), więc pełny skan `awaiting_approval` + filtr w pamięci jest tani.
   */
  async listWaitStepsDue(): Promise<
    Array<{ planId: string; stepIndex: number; organizationId: string; userId: string }>
  > {
    const rows = (await dbAll(
      `SELECT s.plan_id, s.step_index, s.tool_input_json, p.organization_id, p.user_id
       FROM ai_agent_plan_steps s
       JOIN ai_agent_plans p ON p.id = s.plan_id
       WHERE s.status = 'awaiting_approval' AND s.tool_name = 'wait_until'`
    )) as any[];
    const now = Date.now();
    const due: Array<{
      planId: string;
      stepIndex: number;
      organizationId: string;
      userId: string;
    }> = [];
    for (const r of rows || []) {
      let resumeAt: string | undefined;
      try {
        resumeAt = JSON.parse(r.tool_input_json || '{}')?.resumeAt;
      } catch {
        continue;
      }
      if (resumeAt && new Date(resumeAt).getTime() <= now) {
        due.push({
          planId: r.plan_id,
          stepIndex: r.step_index,
          organizationId: r.organization_id,
          userId: r.user_id,
        });
      }
    }
    return due;
  }

  /** Zdejmuje bramkę pauzy AUTOMATYCZNIE (cron) — ten sam zapis co ludzkie `approveStep`, inny `approved_by`. */
  async resumeWaitStep(planId: string, stepIndex: number): Promise<void> {
    const step = (await dbGet(
      `SELECT id FROM ai_agent_plan_steps
       WHERE plan_id = ? AND step_index = ? AND status = 'awaiting_approval'`,
      [planId, stepIndex]
    )) as any;
    if (!step) return; // już wznowiony przez inny tick crona / anulowany — cicho pomijamy
    await dbRun(
      `UPDATE ai_agent_plan_steps
       SET status = 'pending', approved_by = ?, approved_at = datetime('now')
       WHERE id = ?`,
      ['system:scheduler', step.id]
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

  /**
   * AGT-009 (partia 2): nadpisuje listę kroków planu, który jest jeszcze w
   * statusie 'planning' — tzn. schemat zaproponowany przez generator, PRZED
   * jawnym "Uruchom". Zapisuje przestawiony/edytowany schemat z canvasu
   * (`AgentPlanCanvas.tsx`) do bazy (`ai_agent_plan_steps` + `plan_json`), tak
   * by przeżył odświeżenie i był widoczny w sondzie HTTP.
   *
   * Guard TWARDY: tylko `planning`. Gdy plan już ruszył (executing/…/terminal),
   * kroki są w toku albo wykonane i edycja nie ma sensu operacyjnego — rzuca.
   * To domyka regułę rozdziału create/run: schemat edytowalny WYŁĄCZNIE zanim
   * dispatch przeniesie plan poza `planning`.
   *
   * Wymiana jest kompletna (nie merge): usuwa wszystkie stare wiersze kroków i
   * wstawia nowe z kolejnymi `step_index` w podanej kolejności, po czym
   * synchronizuje `plan_json`/`total_steps` i zeruje licznik postępu. Requires-
   * approval jest przeliczany z `SIDE_EFFECT_TOOLS` (jak w `createPlan`), chyba
   * że krok niesie jawny override `requiresApproval` (DOROBKA C 2026-07-23) —
   * wtedy ten wygrywa.
   */
  async replaceSteps(
    planId: string,
    steps: Array<{
      toolName: string;
      toolInput: Record<string, unknown>;
      /** DOROBKA C: jawny override — patrz komentarz w `createPlan`. */
      requiresApproval?: boolean;
    }>
  ): Promise<AgentPlan> {
    const plan = await this.getPlan(planId);
    if (!plan) throw new Error('Plan not found');
    if (plan.status !== 'planning') {
      throw new Error(`Plan not editable in status '${plan.status}' (only 'planning')`);
    }

    const newSteps: PlanStep[] = steps.map((s, i) => ({
      id: randomUUID(),
      stepIndex: i,
      toolName: s.toolName,
      toolInput: s.toolInput,
      status: 'pending' as StepStatus,
      requiresApproval:
        typeof s.requiresApproval === 'boolean'
          ? s.requiresApproval
          : SIDE_EFFECT_TOOLS.has(s.toolName),
    }));

    await dbRun(`DELETE FROM ai_agent_plan_steps WHERE plan_id = ?`, [planId]);
    for (const step of newSteps) {
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
    await dbRun(
      `UPDATE ai_agent_plans
       SET plan_json = ?, total_steps = ?, completed_steps = 0, current_step_index = 0,
           updated_at = datetime('now')
       WHERE id = ?`,
      [JSON.stringify(newSteps), newSteps.length, planId]
    );

    const updated = await this.getPlan(planId);
    if (!updated) throw new Error('Plan disappeared after step replace');
    return updated;
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
      approvedAt: s.approved_at || null,
      approvedBy: s.approved_by || null,
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
      scheduledAt: row.scheduled_at || undefined,
      startedAt: row.started_at || undefined,
      completedAt: row.completed_at || undefined,
      folderId: row.folder_id || null,
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
      scheduledAt: row.scheduled_at || undefined,
      startedAt: row.started_at || undefined,
      completedAt: row.completed_at || undefined,
      folderId: row.folder_id || null,
    }));
  }

  /**
   * AGT-FOLDERS (2026-07-28): przenosi plan do folderu (albo odpina —
   * `folderId: null`). Org-scoped guard tu (nie w routes) — spójne z resztą
   * usługi (`schedulePlan`/`cancelPlan` też nie sprawdzają org tutaj, robi to
   * router przez `assertPlanInOrg` PRZED wywołaniem; ale ten update sam w
   * sobie musi mieć `organization_id` w WHERE, żeby nie dało się przenieść
   * planu cudzej organizacji nawet przy błędzie w routerze — defense in depth).
   */
  async setFolder(
    planId: string,
    organizationId: string,
    folderId: string | null
  ): Promise<{ updated: boolean }> {
    const result = await dbRun(
      `UPDATE ai_agent_plans SET folder_id = ?, updated_at = datetime('now')
       WHERE id = ? AND organization_id = ?`,
      [folderId, planId, organizationId]
    );
    return { updated: Boolean((result as { changes?: number })?.changes) };
  }

  async executeBackgroundPlan(payload: {
    planId: string;
    organizationId: string;
    userId: string;
  }): Promise<AgentPlan> {
    const plan = await this.getPlan(payload.planId);
    if (
      !plan ||
      plan.organizationId !== payload.organizationId ||
      plan.userId !== payload.userId
    ) {
      throw Object.assign(new Error('Plan not found'), { statusCode: 404 });
    }
    const { executeToolCall } = await import('./toolDefinitions.js');

    const executor: PlanToolExecutor = async (
      toolName,
      input,
      execution
    ) => {
      return executeToolCall(toolName, input, {
        organizationId: payload.organizationId,
        userId: payload.userId,
        conversationId: plan.conversationId,
        sessionId: execution?.operationKey,
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
    errorMessage: string | undefined,
    lease: ExecutionLease
  ): Promise<void> {
    await this.guardedPlanRun(
      lease,
      `UPDATE ai_agent_plans
       SET status = ?, result_summary = ?, error_message = ?, completed_at = datetime('now'),
           updated_at = datetime('now'), execution_owner_token = NULL,
           execution_lease_expires_at = NULL, execution_heartbeat_at = NULL
       WHERE id = ? AND ${this.leasePredicate()}`,
      [status, resultSummary, errorMessage || null, planId]
    );
  }

  private async updateStepStatus(
    stepId: string,
    status: StepStatus,
    lease?: ExecutionLease
  ): Promise<void> {
    const startedClause = status === 'running' ? ", started_at = datetime('now')" : '';
    if (lease) {
      await this.guardedStepRun(
        lease,
        `UPDATE ai_agent_plan_steps SET status = ?${startedClause}`,
        [status],
        stepId
      );
      return;
    }
    await dbRun(`UPDATE ai_agent_plan_steps SET status = ?${startedClause} WHERE id = ?`, [
      status,
      stepId,
    ]);
  }

  private async updatePlanProgress(
    planId: string,
    completedSteps: number,
    lease: ExecutionLease
  ): Promise<void> {
    await this.guardedPlanRun(
      lease,
      `UPDATE ai_agent_plans
       SET completed_steps = ?, current_step_index = ?, updated_at = datetime('now')
       WHERE id = ? AND ${this.leasePredicate()}`,
      [completedSteps, completedSteps, planId]
    );
  }

  private async releaseLeaseAtCheckpoint(
    lease: ExecutionLease,
    status: 'awaiting_approval' | 'paused',
    currentStep: number
  ): Promise<void> {
    await this.guardedPlanRun(
      lease,
      `UPDATE ai_agent_plans
       SET status = ?, current_step_index = ?, updated_at = datetime('now'),
           execution_owner_token = NULL, execution_lease_expires_at = NULL,
           execution_heartbeat_at = NULL
       WHERE id = ? AND ${this.leasePredicate()}`,
      [status, currentStep, lease.planId]
    );
  }

  /**
   * Podmienia `$step.N.pole` (N = numer kroku 1-based, jak w canvasie) na
   * wynik tego kroku — TYLKO gdy krok N już się wykonał (`precedingSteps`
   * to zawsze prefiks planu przed bieżącym indeksem, więc "przyszły" krok
   * nigdy nie jest referencyjnie dostępny — brak cyklu z definicji kolejności
   * wykonania). Brak dopasowania (zły numer, krok bez wyniku, krok o innym
   * statusie niż 'completed') zostawia string bez zmian, żeby literówka w
   * schemacie nie wysadziła wywołania narzędzia — trafi jako dosłowny tekst,
   * widoczny w wyniku/błędzie kroku.
   */
  private resolveStepInputVariables(
    input: Record<string, unknown>,
    precedingSteps: PlanStep[]
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string' && value.startsWith('$step.')) {
        const match = value.match(/^\$step\.(\d+)(?:\.(.+))?$/);
        const refIndex = match ? Number(match[1]) - 1 : -1;
        const source = refIndex >= 0 ? precedingSteps[refIndex] : undefined;
        if (match && source?.status === 'completed' && source.result !== undefined) {
          resolved[key] = match[2] ? this.getNestedValue(source.result, match[2]) : source.result;
        } else {
          resolved[key] = value;
        }
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        resolved[key] = this.resolveStepInputVariables(
          value as Record<string, unknown>,
          precedingSteps
        );
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    let current: unknown = obj;
    for (const part of path.split('.')) {
      if (current == null) return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  /**
   * Ponów przy błędzie (Fala 1, 2026-07-26): do 2 dodatkowych prób (3 łącznie)
   * z krótkim odstępem, zanim krok trafi do istniejącej ścieżki "failed, ale
   * plan jedzie dalej" (decyzja Piotra 07-16 — patrz komentarz `executePlan`).
   * To NIE ratuje planu przed porażką — plan i tak nigdy nie padał od jednego
   * błędu kroku. Ratuje POJEDYNCZY krok przed przejściową usterką (chwilowy
   * błąd sieci/API), która bez tego liczyłaby się jako trwała porażka mimo że
   * druga próba by przeszła.
   */
  private async runToolWithRetry(
    toolExecutor: PlanToolExecutor,
    toolName: string,
    input: Record<string, unknown>,
    execution: { operationKey: string; ownerToken: string; fencingToken: number },
    maxAttempts = 3,
    delayMs = 400
  ): Promise<unknown> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await toolExecutor(toolName, input, execution);
      } catch (err) {
        lastError = err;
        if (attempt < maxAttempts) {
          logger.warn('[AgentPlanner] step failed, retrying', { toolName, attempt, maxAttempts });
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
    throw lastError;
  }
}

export const agentPlannerService = new AgentPlannerService();
export default agentPlannerService;
