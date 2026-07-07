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
