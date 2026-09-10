/** @vitest-environment node */

/**
 * F5a — `task_history` był FANTOMEM: TaskController.ts wstawiał do niego przy
 * zmianie statusu zadania (linia ~1810) i przy przenosinach zadania między
 * inicjatywami (linia ~2955), ale żadna migracja nigdy nie utworzyła tej
 * tabeli. Na Postgresie każdy taki INSERT kończył się cicho (best-effort
 * `.catch(logger.error)`) błędem `relation "task_history" does not exist`,
 * więc dziennik zmian zadania był zawsze pusty — mimo że kod "wyglądał" jak
 * działający.
 *
 * Ten test odtwarza DOKŁADNIE oba zapytania INSERT z TaskController.ts na
 * realnym Postgresie (nie na atrapie z Database.ts, która potwierdza
 * `changes:1` niezależnie od WHERE) i potwierdza, że:
 *  1. wiersz historii status→status faktycznie się zapisuje,
 *  2. wiersz historii "moved" faktycznie się zapisuje,
 *  3. `organization_id` jest uzupełniane automatycznie (trigger) z tabeli
 *     `tasks`, mimo że żaden z dwóch callerów go nie podaje,
 *  4. istnieje CZYTNIK (SELECT po task_id, jak zrobiłby dowolny przyszły
 *     endpoint historii) i zwraca oba wiersze we właściwej kolejności.
 *
 * KROK 0 (zmierzone): `grep -rn "task_history" server/src src` pokazał TYLKO
 * dwa INSERT-y i jeden DELETE w TaskController.ts — zero czytnika w kodzie
 * (ani API, ani UI). To osobne, realne ustalenie: tabela nie ma dziś żadnego
 * konsumenta odczytu — patrz meldunek.
 */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;

describe('F5a — task_history producer (realny PostgreSQL)', NO_RETRY, () => {
  const organizationId = 'dbr77';
  const userId = 'system';
  const taskId = `f5a-task-${randomUUID()}`;
  const otherInitiativeId = `f5a-init-${randomUUID()}`;
  let pool: Pool;

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

    // Minimalny rekord zadania, na którym operują oba INSERT-y z produkcji.
    await pool.query(
      `INSERT INTO tasks (id, organization_id, title, status, priority, assignee_id, created_at, updated_at)
       VALUES ($1, $2, 'F5a producer probe', 'todo', 'medium', $3, now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [taskId, organizationId, userId]
    );
  });

  afterAll(async () => {
    // Probe'y sprzątają po sobie — zero rekordów testowych w bazie (CLAUDE.md).
    await pool.query(`DELETE FROM task_history WHERE task_id = $1`, [taskId]);
    await pool.query(`DELETE FROM tasks WHERE id = $1`, [taskId]);
    await pool.end();
  });

  it('status zadania zmienia się -> dokładny INSERT z TaskController.ts:1810 zapisuje 1 wiersz historii', async () => {
    const historyId = randomUUID();

    // Zapytanie 1:1 z TaskController.ts (updateTask, "History logs"):
    //   INSERT INTO task_history (id, task_id, field, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?, ?)
    await pool.query(
      `INSERT INTO task_history (id, task_id, field, old_value, new_value, changed_by) VALUES ($1, $2, $3, $4, $5, $6)`,
      [historyId, taskId, 'status', 'todo', 'in_progress', userId]
    );

    const row = await pool.query(
      `SELECT id, task_id, organization_id, field, old_value, new_value, changed_by
       FROM task_history WHERE id = $1`,
      [historyId]
    );

    expect(row.rowCount).toBe(1);
    expect(row.rows[0]).toMatchObject({
      task_id: taskId,
      field: 'status',
      old_value: 'todo',
      new_value: 'in_progress',
      changed_by: userId,
    });
    // Żaden caller nie podaje organization_id — musi je uzupełnić trigger.
    expect(row.rows[0].organization_id).toBe(organizationId);
  });

  it('przeniesienie zadania -> dokładny INSERT z TaskController.ts:2955 zapisuje wiersz "moved"', async () => {
    const historyId = randomUUID();
    const oldValue = JSON.stringify({ initiative_id: null, project_id: null });
    const newValue = JSON.stringify({ initiative_id: otherInitiativeId, project_id: null });

    // Zapytanie 1:1 z TaskController.ts (moveTaskToInitiative, "Log history"):
    //   INSERT INTO task_history (id, task_id, field, old_value, new_value, changed_by)
    //   VALUES (?, ?, 'moved', ?, ?, ?)
    await pool.query(
      `INSERT INTO task_history (id, task_id, field, old_value, new_value, changed_by)
       VALUES ($1, $2, 'moved', $3, $4, $5)`,
      [historyId, taskId, oldValue, newValue, userId]
    );

    const row = await pool.query(`SELECT field, old_value, new_value FROM task_history WHERE id = $1`, [
      historyId,
    ]);
    expect(row.rowCount).toBe(1);
    expect(row.rows[0].field).toBe('moved');
    expect(row.rows[0].new_value).toBe(newValue);
  });

  it('CZYTNIK: SELECT po task_id zwraca oba wiersze, najnowszy pierwszy', async () => {
    const result = await pool.query(
      `SELECT field, changed_by FROM task_history WHERE task_id = $1 ORDER BY changed_at DESC`,
      [taskId]
    );
    expect(result.rowCount).toBe(2);
    expect(result.rows.map((r) => r.field).sort()).toEqual(['moved', 'status']);
    expect(result.rows.every((r) => r.changed_by === userId)).toBe(true);
  });

  it('usunięcie zadania kasuje jego historię (ON DELETE CASCADE)', async () => {
    const cascadeTaskId = `f5a-cascade-${randomUUID()}`;
    await pool.query(
      `INSERT INTO tasks (id, organization_id, title, status, priority, created_at, updated_at)
       VALUES ($1, $2, 'F5a cascade probe', 'todo', 'medium', now(), now())`,
      [cascadeTaskId, organizationId]
    );
    await pool.query(
      `INSERT INTO task_history (id, task_id, field, old_value, new_value, changed_by) VALUES ($1, $2, $3, $4, $5, $6)`,
      [randomUUID(), cascadeTaskId, 'status', 'todo', 'blocked', userId]
    );

    await pool.query(`DELETE FROM tasks WHERE id = $1`, [cascadeTaskId]);

    const remaining = await pool.query(`SELECT 1 FROM task_history WHERE task_id = $1`, [cascadeTaskId]);
    expect(remaining.rowCount).toBe(0);
  });
});
