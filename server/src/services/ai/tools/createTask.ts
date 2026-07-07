/**
 * Tool: create_task (Teresa routing-N · naprawa-rN-routing)
 *
 * Gives Teresa a REAL tool to create a Task OBJECT (a `tasks` row) directly from
 * chat — instead of the model falling back to generate_deliverable(type:'document')
 * and producing a doc titled "Stwórz zadanie…". Before this tool existed the chat
 * pipeline only exposed generate_deliverable + generate_initiative, so "stwórz
 * zadanie" literally had no task tool to call.
 *
 * READ/auto tool (mirrors generate_initiative): a personal task is a low-risk,
 * reversible personal entity — the same one the hard-coded /task slash command and
 * the AI_TOOLS create_task already persist. No approval gate.
 *
 * Persistence reuses the live-proven, column-defensive INSERT in TaskExecutor
 * (the only task-create path known to work against the production Postgres DB).
 * After the row is created the handler emits a `deliverable` event
 * (kind:'task') so the FE navigates to My Work → Tasks. The onDeliverable emit
 * is the SAME side-channel generate_deliverable uses (route maps it to an SSE
 * `{type:'deliverable'}` event).
 */

import { featureFlags } from '../../../config/FeatureFlags.js';
import logger from '../../../utils/Logger.js';

type CreateTaskParams = {
  title?: string;
  description?: string;
  priority?: string;
  due_date?: string;
};

type CreateTaskContext = {
  organizationId?: string;
  userId?: string;
  language?: string;
  role?: string;
  onDeliverable?: (payload: Record<string, unknown>) => void;
};

const ALLOWED_PRIORITIES = new Set(['low', 'medium', 'high']);

/**
 * BUG B fix (Teresa obiekty-N): after a task row is created, fill its STRUCTURAL
 * fields (why · expectedOutcome · acceptanceCriteria) via the existing
 * TASK_SECTION_PROMPTS generator — instead of leaving everything flat in
 * `description`. The `tasks` table has durable `why`, `expected_outcome` and
 * `acceptance_criteria` columns, so this content survives (unlike the decision
 * N-card which is client-persisted). ADDITIVE + FAIL-SOFT: any error is logged
 * and never affects the already-created task. Only fills EMPTY columns.
 */
async function fillTaskStructuralFields(
  taskId: string,
  input: { title: string; description?: string; priority?: string },
  language: 'pl' | 'en',
): Promise<void> {
  try {
    const [{ generateTaskSection }, queryHelpers] = await Promise.all([
      import('../../taskSectionGenerationService.js'),
      import('../../../utils/queryHelpers.js'),
    ]);

    const ctx = {
      title: input.title,
      description: input.description || null,
      priority: input.priority || null,
    };

    // strategy → { description, why, expectedOutcome }; execution → { checklist }.
    // Run them in parallel (only 2 calls, low burst) but each is independently
    // fail-soft so one throwing does not lose the other.
    const [strategyRes, executionRes] = await Promise.allSettled([
      generateTaskSection('strategy', ctx, { language }),
      generateTaskSection('execution', ctx, { language }),
    ]);

    const updates: string[] = [];
    const params: unknown[] = [];
    const setIf = (col: string, value: unknown) => {
      const s = typeof value === 'string' ? value.trim() : '';
      if (!s) return;
      updates.push(`${col} = ?`);
      params.push(s);
    };

    if (strategyRes.status === 'fulfilled') {
      const p = strategyRes.value.parsedContent as
        | { why?: string; expectedOutcome?: string }
        | undefined;
      if (p && typeof p === 'object') {
        setIf('why', p.why);
        setIf('expected_outcome', p.expectedOutcome);
      }
    } else {
      logger.error(
        `[create_task] strategy fill failed id=${taskId}: ${
          strategyRes.reason instanceof Error ? strategyRes.reason.message : String(strategyRes.reason)
        }`,
      );
    }

    if (executionRes.status === 'fulfilled') {
      const p = executionRes.value.parsedContent as { checklist?: unknown[] } | undefined;
      const checklist = Array.isArray(p?.checklist)
        ? (p!.checklist as unknown[]).map((x) => String(x).trim()).filter(Boolean)
        : [];
      if (checklist.length) {
        updates.push('acceptance_criteria = ?');
        params.push(JSON.stringify(checklist));
      }
    } else {
      logger.error(
        `[create_task] execution fill failed id=${taskId}: ${
          executionRes.reason instanceof Error
            ? executionRes.reason.message
            : String(executionRes.reason)
        }`,
      );
    }

    if (updates.length === 0) {
      logger.warn(`[create_task] structural fill produced NO fields id=${taskId}`);
      return;
    }

    // Only fill columns that are still empty (non-destructive).
    params.push(taskId);
    await queryHelpers.queryRun(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = ? AND (
         (why IS NULL OR why = '') OR
         (expected_outcome IS NULL OR expected_outcome = '') OR
         (acceptance_criteria IS NULL OR acceptance_criteria = '')
       )`,
      params,
    );
    logger.info(
      `[create_task] structural fields filled id=${taskId} (${updates
        .map((u) => u.split(' ')[0])
        .join(', ')})`,
    );
  } catch (err) {
    logger.error(
      `[create_task] structural fill FAILED id=${taskId}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

export async function createTask(
  params: CreateTaskParams,
  context: CreateTaskContext = {}
): Promise<Record<string, unknown>> {
  const orgId = String(context.organizationId || '').trim();
  const userId = String(context.userId || '').trim();
  const language: 'pl' | 'en' = context.language === 'en' ? 'en' : 'pl';

  // Defense in depth — mirrors AIPipeline's CHAT_CREATION_TOOLS gate.
  if (!featureFlags.ENABLE_TERESA_RECORD_CREATE) {
    return {
      ok: false,
      error: 'feature_disabled',
      message:
        language === 'en'
          ? 'Task creation from chat is disabled in this environment — point the user to My Work → Tasks.'
          : 'Tworzenie zadań z czatu jest wyłączone w tym środowisku — skieruj użytkownika do Moja praca → Zadania.',
    };
  }

  if (!orgId) {
    return {
      ok: false,
      error: 'missing_context',
      message:
        language === 'en'
          ? 'I cannot create a task without an organization context.'
          : 'Nie mogę utworzyć zadania bez kontekstu organizacji.',
    };
  }

  const title = String(params?.title || '').trim();
  if (!title) {
    return {
      ok: false,
      error: 'missing_title',
      message:
        language === 'en'
          ? 'A task needs a title — what should it be called?'
          : 'Zadanie potrzebuje tytułu — jak ma się nazywać?',
    };
  }

  const priority = ALLOWED_PRIORITIES.has(String(params?.priority || ''))
    ? String(params.priority)
    : 'medium';

  try {
    const { default: TaskExecutor } = await import('../../../ai/actionExecutors/taskExecutor.js');
    const result = await TaskExecutor.execute(
      {
        title,
        description: params?.description || undefined,
        priority,
        due_date: params?.due_date || undefined,
      },
      { userId, organizationId: orgId }
    );

    if (!result.success) {
      logger.warn(`[create_task] failed: ${result.error}`);
      return {
        ok: false,
        error: 'creation_failed',
        message:
          language === 'en'
            ? `I could not create the task. ${result.error || ''}`.trim()
            : `Nie udało się utworzyć zadania. ${result.error || ''}`.trim(),
      };
    }

    const taskId = String((result.result as any)?.taskId || '');

    // BUG B: fill structural fields (why/expectedOutcome/acceptanceCriteria) in the
    // BACKGROUND. Fire-and-forget so the chat stream returns immediately; the task
    // row already exists, the AI-fill only enriches it. Fail-soft (logs its own
    // errors). Skipped when we somehow got no id back.
    if (taskId) {
      void fillTaskStructuralFields(
        taskId,
        { title, description: params?.description || undefined, priority },
        language,
      );
    }

    try {
      context.onDeliverable?.({
        draftId: taskId,
        generationId: taskId,
        kind: 'task',
        format: 'task',
        title,
        taskId,
        // BUG2 — give the post-stream scorer the task's own scope, not the thin
        // "Utworzyłem zadanie…" chat-confirmation.
        scorerContent: `${title}\n\n${String(params?.description || '')}`.trim(),
      });
    } catch (emitErr) {
      logger.warn(
        `[create_task] onDeliverable emit failed id=${taskId}: ${
          emitErr instanceof Error ? emitErr.message : String(emitErr)
        }`
      );
    }

    logger.info(`[create_task] created id=${taskId} title="${title.slice(0, 80)}"`);

    return {
      ok: true,
      kind: 'task',
      id: taskId,
      title,
      message:
        language === 'en'
          ? `Created a task "${title}" in your My Work → Tasks.`
          : `Utworzyłem zadanie „${title}" w Moja praca → Zadania.`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[create_task] error: ${message}`);
    return {
      ok: false,
      error: 'creation_failed',
      message:
        language === 'en'
          ? `I could not create the task. ${message}`
          : `Nie udało się utworzyć zadania. ${message}`,
    };
  }
}

export default { createTask };
