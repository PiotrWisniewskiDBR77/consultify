/** @vitest-environment node */

/**
 * F5b — `column "assigned_to" does not exist` (W2B D-5). `tasks` ma kolumnę
 * `assignee_id`, NIE `assigned_to` (`assigned_to` istnieje tylko na
 * `decisions`, dodane migracją 730_beta_schema_fixes.sql — tamte zapytania
 * były poprawne i zostały nietknięte). Cztery miejsca w kodzie odpytywały/
 * wstawiały `tasks.assigned_to`, którego nigdy nie było:
 *   1. notificationService.ts:845  (getSourceEntity, SELECT z tasks)
 *   2. notificationService.ts:1386 (enrichEntityData, SELECT z tasks — to
 *      wywołanie odpala się PRZY KAŻDYM tworzeniu powiadomienia o zadaniu)
 *   3. results.routes.ts:3566 (INSERT INTO tasks z KPI next-action)
 *   4. contextPackService.ts:28 (kontekst AI, SELECT z tasks)
 * Każde jest owinięte w try/catch (best-effort), więc błąd nigdy nie wywalał
 * requestu — po cichu gubił dane: treść powiadomienia o zadaniu (assignee,
 * contextLine) zawsze wychodziła pusta.
 *
 * Ten test uderza w faktyczny kod produkcyjny (nie w SQL 1:1 jak F5a) —
 * importuje `notificationService` i weryfikuje na realnym Postgresie, że
 * przypisanie zadania do użytkownika i wysłanie powiadomienia o tym zadaniu
 * kończy się: (a) wierszem w `notifications` z `user_id` = przypisany,
 * (b) wzbogaceniem `data.entityAssignee` = assignee_id zadania (co przed
 * poprawką było zawsze `undefined`, bo SELECT rzucał na nieistniejącej
 * kolumnie i enrichEntityData łapał błąd, zwracając pusty obiekt),
 * (c) `getSourceEntity` (jedyny istniejący CZYTNIK tego wzbogacenia) też
 * zwraca poprawnego `assignee`.
 */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import notificationService from '../notificationService.js';

const NO_RETRY = { retry: 0 } as const;

describe('F5b — tasks.assignee_id (nie assigned_to) w powiadomieniach (realny PostgreSQL)', NO_RETRY, () => {
  const organizationId = 'dbr77';
  const assigneeUserId = 'system';
  const taskId = `f5b-task-${randomUUID()}`;
  let pool: Pool;
  const notificationIds: string[] = [];

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

    await pool.query(
      `INSERT INTO tasks (id, organization_id, title, status, priority, assignee_id, due_date, created_at, updated_at)
       VALUES ($1, $2, 'F5b assignee probe', 'todo', 'high', $3, now(), now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [taskId, organizationId, assigneeUserId]
    );
  });

  afterEach(async () => {
    // Probe'y sprzątają po sobie (CLAUDE.md: zero rekordów testowych).
    if (notificationIds.length > 0) {
      await pool.query(`DELETE FROM notification_delivery_log WHERE notification_id = ANY($1)`, [
        notificationIds,
      ]);
      await pool.query(`DELETE FROM notification_dedup WHERE notification_id = ANY($1)`, [
        notificationIds,
      ]);
      await pool.query(`DELETE FROM notifications WHERE id = ANY($1)`, [notificationIds]);
      notificationIds.length = 0;
    }
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM tasks WHERE id = $1`, [taskId]);
    await pool.end();
  });

  it('wysłanie powiadomienia o przypisanym zadaniu trafia do notifications.user_id = przypisany', async () => {
    const notificationId = await notificationService.send({
      userId: assigneeUserId,
      organizationId,
      type: 'task_assigned',
      title: 'Nowe zadanie',
      body: 'Przypisano Ci zadanie "F5b assignee probe"',
      relatedObjectType: 'task',
      relatedObjectId: taskId,
      channels: ['in_app'],
      bypassPreferences: true,
      bypassQuietHours: true,
      dedupe: false,
    });
    notificationIds.push(notificationId);

    const row = await pool.query(`SELECT user_id, data FROM notifications WHERE id = $1`, [
      notificationId,
    ]);
    expect(row.rowCount).toBe(1);
    expect(row.rows[0].user_id).toBe(assigneeUserId);

    // Przed poprawką: SELECT ... assigned_to ... FROM tasks rzucał (kolumna
    // nie istnieje), enrichEntityData łapał błąd i entityAssignee było
    // nieobecne w data. Po poprawce (assignee_id) musi być obecne i zgodne.
    const data = JSON.parse(row.rows[0].data || '{}');
    expect(data.entityAssignee).toBe(assigneeUserId);
    expect(String(data.contextLine || '')).toContain(assigneeUserId);
  });

  it('CZYTNIK getSourceEntity zwraca poprawny assignee dla powiadomienia o zadaniu', async () => {
    const notificationId = await notificationService.send({
      userId: assigneeUserId,
      organizationId,
      type: 'task_assigned',
      title: 'Nowe zadanie (czytnik)',
      body: 'Przypisano Ci zadanie "F5b assignee probe"',
      relatedObjectType: 'task',
      relatedObjectId: taskId,
      channels: ['in_app'],
      bypassPreferences: true,
      bypassQuietHours: true,
      dedupe: false,
    });
    notificationIds.push(notificationId);

    const source = await notificationService.getSourceEntity(notificationId, assigneeUserId);
    expect(source).not.toBeNull();
    expect(source?.type).toBe('task');
    expect(source?.assignee).toBe(assigneeUserId);
  });
});
