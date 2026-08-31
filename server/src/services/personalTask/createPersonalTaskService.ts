/**
 * FIX-207b (ODBIOR_207.md follow-up, decyzja właściciela 2026-08-31) —
 * kanoniczny writer dla zadania "My Work" (`tasks`, `task_type='personal'`).
 *
 * Wyodrębnione 1:1 z `server/src/routes/my-work.routes.ts`
 * (`POST /api/my-work/personal-tasks`, dawny jedyny wołający) tak, żeby
 * druga ścieżka — zatwierdzona propozycja zapisu z czatu Teresy
 * (`server/src/services/aiActionExecutor.ts` — `_executeCreateTask`) —
 * pisała TĄ SAMĄ drogą, zamiast duplikować regułę INSERT osobno (wzorzec
 * „naprawa per-wywołanie odrasta" z pamięci nadzorcy — już raz kosztowało
 * to tygodnie, więc jedno źródło prawdy zamiast dwóch kopii kontraktu).
 *
 * Świadomie NIE jest to writer event-sourced / `ie_aggregate_state`
 * (Runtime-v1 execution-control) — ten kanon obsługuje inny obiekt domenowy
 * ("execution work item" wewnątrz istniejącego execution case inicjatywy,
 * wymaga executionCaseId/initiativeId/ownerId/dueAt/slaAt). Zadanie z My
 * Work (ręczne i teraz też z czatu) to inny, prostszy obiekt biznesowy —
 * ten sam, co dotąd, tylko z jednym, wspólnym writerem zamiast dwóch.
 * Migracja 204 (jeśli i kiedy obejmie `tasks`) przesunie oba wołania naraz,
 * bo oba przechodzą przez tę funkcję.
 */
import { v4 as uuidv4 } from 'uuid';

import { getTableColumns } from '../../utils/dbSchema.js';
import { decodeHtmlEntities } from '../../utils/htmlEntities.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

export interface CreatePersonalTaskInput {
  /** Autor (My Work: `req.user`; czat: użytkownik, który zatwierdził propozycję). */
  organizationId: string;
  userId: string;
  title: string;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  dueDate?: string | null;
  tags?: string[];
  sourceType?: string | null;
  sourceId?: string | null;
  idempotencyKey?: string | null;
  /**
   * Opcjonalny inny właściciel/wykonawca niż autor — My Work personal-tasks
   * nigdy tego nie ustawia (zawsze `assigneeId === userId`), ale narzędzie
   * czatu `create_task` pozwala poprosić o zadanie DLA kogoś innego.
   * Domyślnie = `userId` (autor jest też właścicielem/assignee), identycznie
   * jak dotychczasowe zachowanie My Work.
   */
  assigneeId?: string | null;
  /**
   * Opcjonalny kontekst projektu. My Work personal-tasks nigdy go nie
   * przekazuje (kolumna zostaje NULL, jak dotychczas) — czat ma realny
   * projekt z rozmowy, więc warto go zapisać, gdy kolumna istnieje.
   */
  projectId?: string | null;
}

export interface CreatePersonalTaskResult {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  sourceType: string | null;
  sourceId: string | null;
  ownerId: string;
  reporterId: string;
  idempotent: boolean;
}

function parseTagsArray(input: unknown): string[] {
  if (Array.isArray(input)) return input.map((t) => String(t)).filter(Boolean);
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed.map((t) => String(t)).filter(Boolean);
    } catch {
      /* not JSON — fall through */
    }
  }
  return [];
}

/**
 * Odczyt istniejącego zadania po `(organization_id, idempotency_key)` —
 * dzielony między pre-check przed INSERT i dogonienie zwycięzcy wyścigu po
 * `23505` (dokładnie jak w oryginalnej trasie).
 */
async function findByIdempotencyKey(
  organizationId: string,
  idempotencyKey: string
): Promise<CreatePersonalTaskResult | null> {
  const row = await queryHelpers.queryOne<any>(
    `
    SELECT
      t.id, t.title, t.description, t.status, t.priority,
      t.due_date as "dueDate", t.tags,
      t.created_at as "createdAt", t.updated_at as "updatedAt",
      t.completed_at as "completedAt",
      t.assignee_id as "ownerId", t.reporter_id as "reporterId"
    FROM tasks t
    WHERE t.organization_id = ? AND t.idempotency_key = ?
    LIMIT 1
    `,
    [organizationId, idempotencyKey]
  );
  if (!row) return null;
  return {
    ...row,
    tags: parseTagsArray(row.tags),
    sourceType: row.sourceType ?? null,
    sourceId: row.sourceId ?? null,
    idempotent: true,
  };
}

/**
 * Kanoniczny writer zadania "My Work" (`tasks`, `task_type='personal'`).
 * Jedyne miejsce, w którym ten INSERT jest napisany — wołane zarówno przez
 * `POST /api/my-work/personal-tasks` (ręczne tworzenie), jak i przez
 * zatwierdzoną propozycję `create_task` z czatu Teresy.
 */
export async function createPersonalTask(
  input: CreatePersonalTaskInput
): Promise<CreatePersonalTaskResult> {
  const {
    organizationId,
    userId,
    description,
    sourceType: sourceTypeRaw,
    sourceId: sourceIdRaw,
    idempotencyKey: idempotencyKeyRaw,
  } = input;

  const title = decodeHtmlEntities(String(input.title || '').trim());
  if (!title) {
    throw new Error('title is required');
  }

  const status = String(input.status || 'todo').trim() || 'todo';
  const priority = String(input.priority || 'medium').trim() || 'medium';
  const dueDate = input.dueDate ? String(input.dueDate).trim() : undefined;
  const tags = parseTagsArray(input.tags);
  const sourceType = typeof sourceTypeRaw === 'string' && sourceTypeRaw.trim() ? sourceTypeRaw.trim() : null;
  const sourceId = typeof sourceIdRaw === 'string' && sourceIdRaw.trim() ? sourceIdRaw.trim() : null;
  const idempotencyKey =
    typeof idempotencyKeyRaw === 'string' && idempotencyKeyRaw.trim()
      ? idempotencyKeyRaw.trim()
      : null;
  const assigneeId = (input.assigneeId && String(input.assigneeId).trim()) || userId;
  const projectId = (input.projectId && String(input.projectId).trim()) || null;

  if (idempotencyKey) {
    const existing = await findByIdempotencyKey(organizationId, idempotencyKey);
    if (existing) return existing;
  }

  const id = uuidv4();
  const cols = await getTableColumns('tasks');

  const insertCols: string[] = ['id'];
  const insertVals: string[] = ['?'];
  const insertParams: any[] = [id];

  const add = (col: string, val: any) => {
    if (!cols.has(col)) return;
    insertCols.push(col);
    insertVals.push('?');
    insertParams.push(val);
  };

  add('organization_id', organizationId);
  add('title', title);
  add('description', description ?? null);
  add('status', status);
  add('priority', priority);
  add('assignee_id', assigneeId);
  add('reporter_id', userId);
  if (dueDate) add('due_date', dueDate);
  add('tags', JSON.stringify(tags));
  add('task_type', 'personal');
  if (projectId) add('project_id', projectId);
  if (sourceType && sourceId) {
    add('source_type', sourceType);
    add('source_id', sourceId);
  }
  if (idempotencyKey) add('idempotency_key', idempotencyKey);

  try {
    await queryHelpers.queryRun(
      `INSERT INTO tasks (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
      insertParams
    );
  } catch (insertErr: any) {
    // Race guard: two concurrent retries can both pass the pre-insert SELECT
    // above. A unique-violation on (organization_id, idempotency_key) means the
    // other request won; re-read and return its row instead of failing.
    if (idempotencyKey && insertErr?.code === '23505') {
      const winning = await findByIdempotencyKey(organizationId, idempotencyKey);
      if (winning) return winning;
    }
    throw insertErr;
  }

  const row = await queryHelpers.queryOne<any>(
    `
    SELECT
      t.id,
      t.title,
      t.description,
      t.status,
      t.priority,
      t.due_date as "dueDate",
      t.tags,
      t.created_at as "createdAt",
      t.updated_at as "updatedAt",
      t.completed_at as "completedAt",
      t.assignee_id as "ownerId",
      t.reporter_id as "reporterId",
      ${cols.has('source_type') ? 't.source_type' : 'NULL'} as "sourceType",
      ${cols.has('source_id') ? 't.source_id' : 'NULL'} as "sourceId"
    FROM tasks t
    WHERE t.id = ? AND t.organization_id = ? AND t.assignee_id = ?
      AND lower(coalesce(t.task_type,'')) = 'personal'
    LIMIT 1
  `,
    [id, organizationId, assigneeId]
  );

  if (!row) {
    // Should be unreachable — INSERT above just succeeded with these exact
    // values — but fail loudly rather than return a fabricated shape.
    throw new Error(`createPersonalTask: row ${id} not found immediately after insert`);
  }

  return {
    ...row,
    tags: parseTagsArray(row.tags),
    sourceType: row.sourceType ?? null,
    sourceId: row.sourceId ?? null,
    idempotent: false,
  };
}
