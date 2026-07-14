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

/** Priority → sane default offset (days) when the model omits due_date entirely. */
const PRIORITY_DEFAULT_OFFSET_DAYS: Record<string, number> = {
  high: 3,
  medium: 7,
  low: 14,
};

/**
 * BUG (sędzia BCG #1): the model was free to emit ANY ISO date for `due_date`
 * — including dates before the task's own `createdAt` (e.g. task created
 * 2026-07-07 with due_date=2026-02-10). `create_task`'s tool schema gives the
 * model no anchor for "today", so a hallucinated/stale-training-data date
 * slips straight through TaskExecutor's column-defensive INSERT (which just
 * writes whatever `due_date` it receives — see taskExecutor.ts:62).
 *
 * Fix here, at the real caller boundary (not in TaskExecutor, which is also
 * used by other non-chat callers and must stay a dumb persistence layer):
 * reject any due_date that is invalid or <= now, and replace it with a
 * priority-derived offset from `createdAt` (effectively `now`, since the row
 * is inserted moments later) — so `dueDate` is NEVER before the task's own
 * `createdAt`. Never left as a bare `null` here because that would silently
 * drop every chat-created task's deadline; a computed default is preferable
 * to an admittedly-wrong past date. Fail-soft: never throws, only logs.
 */
export function sanitizeDueDate(
  rawDueDate: string | undefined,
  priority: string
): string | undefined {
  const now = Date.now();

  if (rawDueDate) {
    const parsed = new Date(rawDueDate);
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() > now) {
      return rawDueDate;
    }
    logger.warn(
      `[create_task] rejected dueDate not in the future (raw="${rawDueDate}", now=${new Date(
        now
      ).toISOString()}) — clamping to computed default`
    );
  }

  // No usable model-supplied date — derive a realistic one from priority
  // instead of leaving every chat-created task without a deadline.
  const offsetDays = PRIORITY_DEFAULT_OFFSET_DAYS[priority] ?? PRIORITY_DEFAULT_OFFSET_DAYS.medium;
  return new Date(now + offsetDays * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * BUG (sędzia BCG #2): the prompt "audyt … do końca miesiąca" produced
 * dueDate = +7 days from creation instead of the actual end of month, because
 * `create_task`'s schema had no way to convey a RELATIVE deadline — the model
 * either dropped it or emitted a bare offset. We parse the relative deadline
 * straight from the ORIGINAL task text (title + description + the user prompt),
 * so an explicit human term ("koniec miesiąca", "koniec tygodnia", "za 3 dni",
 * "do 2026-08-15") wins over the priority default.
 *
 * Returns an ISO string at LOCAL end-of-day (23:59:59) for the resolved date, or
 * undefined when no relative term is found (caller then falls back to the model
 * date / priority offset via sanitizeDueDate). Pure + timezone-local; `now` is
 * injectable for tests. Only FUTURE results are returned (a "koniec tygodnia"
 * already past today rolls to the next matching boundary where sensible).
 */
export function parseRelativeDueDate(
  text: string | undefined,
  now: Date = new Date()
): string | undefined {
  const raw = String(text || '').toLowerCase();
  if (!raw) return undefined;

  // Normalise Polish diacritics so "końca"/"konca" and "tygodni"/"tygodniu" match.
  const t = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics (ą→a, ę→e, ó→o…)
    .replace(/ł/g, 'l'); // ł → l (not decomposed by NFD)

  // 1. Explicit ISO/near-ISO date in the text: "do 2026-08-15" / "termin 2026-08-15".
  const isoMatch = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const mo = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const d = new Date(y, mo, day, 23, 59, 59, 0);
    if (!Number.isNaN(d.getTime()) && d.getTime() > now.getTime()) {
      return d.toISOString();
    }
  }

  // 2. "koniec / do końca miesiąca" → last calendar day of the current month.
  //    (EN: "end of the month".)
  if (
    /(koniec|do konca|na koniec).{0,12}(miesiac|miesiaca|mies\b)/.test(t) ||
    /end of (the )?month/.test(t)
  ) {
    // Day 0 of next month = last day of current month.
    const eom = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 0);
    return eom.toISOString();
  }

  // 3. "koniec / do końca tygodnia" → this week's Friday (EN: "end of the week").
  if (
    /(koniec|do konca|na koniec).{0,12}(tydzien|tygodnia|tygodniu|tyg\b)/.test(t) ||
    /end of (the )?week/.test(t)
  ) {
    const dow = now.getDay(); // 0=Sun..6=Sat
    // Friday = 5. Days until Friday (0 if already Friday). If Sat/Sun, roll to next Friday.
    let add = (5 - dow + 7) % 7;
    if (dow === 6 || dow === 0) add = (5 - dow + 7) % 7; // Sat→6, Sun→5
    const friday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + add, 23, 59, 59, 0);
    return friday.toISOString();
  }

  // 4. "za X dni" / "za X tygodni" / "in X days|weeks".
  const rel = t.match(
    /(?:za|in)\s+(\d{1,3})\s*(dni|dzien|dzien\b|tydzien|tygodni|tyg\b|day|days|week|weeks)/
  );
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2];
    const isWeek = /tydzien|tygodni|tyg|week/.test(unit);
    const days = isWeek ? n * 7 : n;
    if (n > 0) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 23, 59, 59, 0);
      return d.toISOString();
    }
  }

  // 5. "jutro" / "tomorrow"; "pojutrze".
  if (/\bpojutrze\b/.test(t)) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 23, 59, 59, 0);
    return d.toISOString();
  }
  if (/\bjutro\b/.test(t) || /\btomorrow\b/.test(t)) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59, 0);
    return d.toISOString();
  }

  // 6. "koniec kwartału" → last day of the current calendar quarter.
  if (
    /(koniec|do konca|na koniec).{0,12}(kwartal|kwartalu)/.test(t) ||
    /end of (the )?quarter/.test(t)
  ) {
    const q = Math.floor(now.getMonth() / 3);
    const lastMonthOfQuarter = q * 3 + 2; // 0-based: Q1→2 (Mar), Q2→5 (Jun)…
    const eoq = new Date(now.getFullYear(), lastMonthOfQuarter + 1, 0, 23, 59, 59, 0);
    return eoq.toISOString();
  }

  return undefined;
}

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
  input: { title: string; description?: string; priority?: string; ownerName?: string },
  language: 'pl' | 'en'
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
      // Owner is the creator/assignee (taskExecutor sets assignee_id=userId). Passing
      // it here stops the model emitting "[DO UZUPEŁNIENIA – wskazać osobę]".
      ownerName: input.ownerName || null,
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
          strategyRes.reason instanceof Error
            ? strategyRes.reason.message
            : String(strategyRes.reason)
        }`
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
        }`
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
      params
    );
    logger.info(
      `[create_task] structural fields filled id=${taskId} (${updates
        .map((u) => u.split(' ')[0])
        .join(', ')})`
    );
  } catch (err) {
    logger.error(
      `[create_task] structural fill FAILED id=${taskId}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

/**
 * Best-effort display name of the task creator (assignee), so the structural-fill
 * prompt can name the owner instead of leaving a "[DO UZUPEŁNIENIA]" placeholder.
 * Fail-soft: any error → undefined (the doctrine rule then makes the model omit the
 * owner field rather than fake one).
 */
async function resolveOwnerName(userId: string): Promise<string | undefined> {
  if (!userId) return undefined;
  try {
    const queryHelpers = await import('../../../utils/queryHelpers.js');
    const row = await queryHelpers.queryOne<{
      first_name?: string;
      last_name?: string;
      email?: string;
    }>('SELECT first_name, last_name, email FROM users WHERE id = ?', [userId]);
    if (!row) return undefined;
    const full =
      `${String(row.first_name || '').trim()} ${String(row.last_name || '').trim()}`.trim();
    return full || (row.email ? String(row.email).trim() : undefined) || undefined;
  } catch (err) {
    logger.warn(
      `[create_task] owner-name lookup failed userId=${userId}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    return undefined;
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
    // Priority order for the deadline:
    //   1. An EXPLICIT relative term in the task text ("do końca miesiąca",
    //      "za 3 dni", "do 2026-08-15") — the human's stated intent wins.
    //   2. Otherwise the model-supplied due_date (future-guarded).
    //   3. Otherwise a priority-derived default offset.
    // (2)+(3) are handled by sanitizeDueDate; (1) overrides both.
    const sourceText = `${title} ${String(params?.description || '')}`.trim();
    const relativeDue = parseRelativeDueDate(sourceText);
    const dueDate = relativeDue ?? sanitizeDueDate(params?.due_date || undefined, priority);
    if (relativeDue) {
      logger.info(
        `[create_task] relative deadline parsed from text → ${relativeDue} (overrides model due_date="${
          params?.due_date || ''
        }")`
      );
    }

    const { default: TaskExecutor } = await import('../../../ai/actionExecutors/taskExecutor.js');
    const result = await TaskExecutor.execute(
      {
        title,
        description: params?.description || undefined,
        priority,
        due_date: dueDate,
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
      void (async () => {
        const ownerName = await resolveOwnerName(userId);
        await fillTaskStructuralFields(
          taskId,
          { title, description: params?.description || undefined, priority, ownerName },
          language
        );
      })();
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
