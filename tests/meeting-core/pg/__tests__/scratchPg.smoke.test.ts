/**
 * scratchPg.smoke.test.ts — jeden test end-to-end, REALNIE dotyka bazy.
 *
 * Stawia jednorazowy kontener Postgres, zakłada minimalny schemat Meeting
 * Core, robi INSERT + SELECT przez realny sterownik `pg`, sprząta kontener.
 *
 * Ten test NIE ma trybu "pominięty gdy Docker niedostępny" — jeśli Docker
 * nie działa, `beforeAll` rzuci błąd i CAŁY plik zgłosi FAIL, nie "skipped".
 * To jest zamierzone (patrz nagłówek scratchPg.ts).
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';

import { assertScratchDatabaseUrl, startScratchPg, type ScratchPg } from '../scratchPg';
import { createMeetingCoreSchema } from '../schema';

describe('scratchPg smoke — realny Postgres w kontenerze Docker', () => {
  let scratch: ScratchPg;
  let client: Client;

  beforeAll(async () => {
    scratch = await startScratchPg();
    // Strażnik musi zaakceptować URL, który sami wyprodukowaliśmy —
    // jeśli by go odrzucił, to byłby błąd w scratchPg.ts, nie w teście.
    assertScratchDatabaseUrl(scratch.url);

    client = new Client({ connectionString: scratch.url });
    await client.connect();
    await createMeetingCoreSchema(client);
  }, 60_000);

  afterAll(async () => {
    if (client) {
      await client.end();
    }
    if (scratch) {
      await scratch.stop();
    }
  }, 30_000);

  it('kontener działa na wysokim, nietypowym porcie (nie 5432, nie 5433)', () => {
    expect(scratch.port).not.toBe(5432);
    expect(scratch.port).not.toBe(5433);
    expect(scratch.port).toBeGreaterThan(1024);
  });

  it('INSERT + SELECT na meetings/meeting_follow_ups/tasks/decisions/audit_events działa naprawdę', async () => {
    // Deterministyczne dane wejściowe — stałe ID/wartości, zero
    // losowości/czasu wewnątrz asercji (Date.now/random tylko poza nimi,
    // tu nawet to nie jest potrzebne).
    const meetingId = 'meeting-smoke-001';
    const followUpId = 'followup-smoke-001';
    const taskId = 'task-smoke-001';
    const decisionId = 'decision-smoke-001';
    const auditId = 'audit-smoke-001';

    await client.query(
      `INSERT INTO meetings (id, organization_id, project_id, title, start_at, end_at, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        meetingId,
        'org-smoke',
        'project-smoke',
        'Smoke Test Meeting',
        '2026-01-01T10:00:00.000Z',
        '2026-01-01T11:00:00.000Z',
        'completed',
        'user-smoke',
      ]
    );

    await client.query(
      `INSERT INTO meeting_follow_ups (id, meeting_id, title, owner, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [followUpId, meetingId, 'Follow up on smoke test', 'user-smoke', 'open']
    );

    await client.query(
      `INSERT INTO tasks (id, organization_id, project_id, title, status, source_type, source_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        taskId,
        'org-smoke',
        'project-smoke',
        'Task from meeting',
        'todo',
        'meeting_follow_up',
        followUpId,
        'user-smoke',
      ]
    );

    await client.query(
      `INSERT INTO decisions (id, organization_id, project_id, task_id, title, type, decision_maker_id, created_by, source_type, source_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        decisionId,
        'org-smoke',
        'project-smoke',
        taskId,
        'Decision from meeting',
        'strategic',
        'user-smoke',
        'user-smoke',
        'meeting',
        meetingId,
      ]
    );

    await client.query(
      `INSERT INTO audit_events (id, actor_user_id, actor_type, org_id, action_type, entity_type, entity_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [auditId, 'user-smoke', 'USER', 'org-smoke', 'CREATE', 'meeting', meetingId]
    );

    const meetingRow = await client.query('SELECT * FROM meetings WHERE id = $1', [meetingId]);
    expect(meetingRow.rows).toHaveLength(1);
    expect(meetingRow.rows[0]).toMatchObject({
      id: meetingId,
      organization_id: 'org-smoke',
      title: 'Smoke Test Meeting',
      status: 'completed',
    });

    const followUpRow = await client.query('SELECT * FROM meeting_follow_ups WHERE id = $1', [
      followUpId,
    ]);
    expect(followUpRow.rows).toHaveLength(1);
    expect(followUpRow.rows[0].meeting_id).toBe(meetingId);

    const taskRow = await client.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    expect(taskRow.rows).toHaveLength(1);
    expect(taskRow.rows[0]).toMatchObject({
      id: taskId,
      source_type: 'meeting_follow_up',
      source_id: followUpId,
    });

    const decisionRow = await client.query('SELECT * FROM decisions WHERE id = $1', [decisionId]);
    expect(decisionRow.rows).toHaveLength(1);
    expect(decisionRow.rows[0]).toMatchObject({
      id: decisionId,
      task_id: taskId,
      source_type: 'meeting',
      source_id: meetingId,
    });

    const auditRow = await client.query('SELECT * FROM audit_events WHERE id = $1', [auditId]);
    expect(auditRow.rows).toHaveLength(1);
    expect(auditRow.rows[0]).toMatchObject({
      id: auditId,
      entity_type: 'meeting',
      entity_id: meetingId,
      action_type: 'CREATE',
    });

    // Zliczenie wierszy w każdej tabeli — dowód, że to NIE jest mock:
    // realna baza, realny stan po realnych zapytaniach.
    const counts = await client.query(
      `SELECT
         (SELECT count(*) FROM meetings) AS meetings,
         (SELECT count(*) FROM meeting_follow_ups) AS follow_ups,
         (SELECT count(*) FROM tasks) AS tasks,
         (SELECT count(*) FROM decisions) AS decisions,
         (SELECT count(*) FROM audit_events) AS audit_events`
    );
    expect(counts.rows[0]).toMatchObject({
      meetings: '1',
      follow_ups: '1',
      tasks: '1',
      decisions: '1',
      audit_events: '1',
    });
  });

  it('kontener ma unikalną nazwę z prefiksem consultify-scratch-pg-', () => {
    expect(scratch.containerName).toMatch(/^consultify-scratch-pg-[0-9a-f]{8}$/);
  });
});

// Dowód determinizmu: druga, niezależna próba połączenia z tym samym URL-em
// zwraca ten sam wynik — brak losowości/czasu wpływającego na dane.
describe('scratchPg smoke — powtarzalność', () => {
  let scratch: ScratchPg;

  beforeAll(async () => {
    scratch = await startScratchPg();
  }, 60_000);

  afterAll(async () => {
    // Strażnik na wypadek, gdy `beforeAll` rzucił zanim `scratch` zostało
    // przypisane (np. Docker niedostępny) — bez tego afterAll maskowałby
    // prawdziwy błąd z beforeAll drugim, mylącym TypeError.
    if (scratch) {
      await scratch.stop();
    }
  }, 30_000);

  it('dwa niezależne klienty widzą ten sam, deterministyczny stan po tym samym INSERT-cie', async () => {
    const writer = new Client({ connectionString: scratch.url });
    const reader = new Client({ connectionString: scratch.url });
    await writer.connect();
    await reader.connect();
    try {
      await createMeetingCoreSchema(writer);
      const id = `meeting-determinism-${randomUUID()}`;
      await writer.query(
        `INSERT INTO meetings (id, organization_id, title, start_at, end_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          id,
          'org-det',
          'Determinism check',
          '2026-01-01T00:00:00.000Z',
          '2026-01-01T00:30:00.000Z',
          'user-det',
        ]
      );
      const result = await reader.query(
        'SELECT title, organization_id FROM meetings WHERE id = $1',
        [id]
      );
      expect(result.rows).toEqual([{ title: 'Determinism check', organization_id: 'org-det' }]);
    } finally {
      await writer.end();
      await reader.end();
    }
  });
});
