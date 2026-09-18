/** @vitest-environment node */
/**
 * MTG-2b / DEC-607 (Wpis 100 line 218, Wpis 109 line 123) — RealPG roundtrip
 * dowód „ze spotkania coś wychodzi": akceptacja propozycji → wiersz decyzji/
 * akcji → zadanie w Realizacji Z terminem i właścicielem → status zwrotny na
 * protokole.
 *
 * Mierzone na ŻYWYCH serwisach produktu (nie na lustrze):
 *   createMeetingAgendaItem  → agenda_item_id
 *   createMeetingFollowUpRecord → wiersz akcji (A-01…) z dueAt/ownerUserId/
 *                                 agendaItemId (W109c live writer)
 *   createTaskFromMeetingFollowUp → tasks.due_date + tasks.assignee_id +
 *                                 meeting_follow_ups.task_id (status zwrotny)
 *   createMeetingDecisionRecord → owner_user_id/decision_type/impact_text/
 *                                 rejected_alternative (W109c live writer)
 *
 * Każda asercja stanu czyta tabelę bezpośrednio z pg.Pool (NIE przez
 * DbPromise, którego `fallback:true` połknąłby błąd w pustkę) — dowód jest
 * na bajtach w bazie, nie na odpowiedzi serwisu.
 *
 * DOWODY MUTACYJNE (3, liczone osobno „logika"/„wpięcie"):
 *   M1 funnel dueDate: cofnij `...(dueDate ? { dueDate } : {})` w
 *      createTaskFromMeetingFollowUp → tasks.due_date NULL → RED.
 *   M2 task_id writeback: usuń `setMeetingFollowUpTaskId(...)` po commicie →
 *      meeting_follow_ups.task_id NULL → RED (status zwrotny zerwany).
 *   M3 agendaItemId: usuń `agenda_item_id` z INSERT createMeetingFollowUpRecord
 *      → agenda_item_id NULL → RED.
 *
 * FAIL-CLOSED GATE (standard W164b): w CI bez RUN_DB_TESTS plik RZUCA przy
 * kolekcji (RC=1); lokalnie bez RUN_DB_TESTS skip z komunikatem.
 *
 * Uruchomienie (pula D, kontener qoder-d-pg-3):
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *     DATABASE_URL=postgresql://postgres:qoder@127.0.0.1:6632/consultify_mtg2_fresh \
 *     npx vitest run server/src/services/meeting/__tests__/meetingFunnelRoundtrip.pg.test.ts
 */

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createMeetingAgendaItem } from '../meetingAgendaService.js';
import { createTaskFromMeetingFollowUp } from '../meetingNoteTaskFunnelService.js';
import {
  createMeetingDecisionRecord,
  createMeetingFollowUpRecord,
  getMeetingFollowUpRecord,
} from '../../meetingService.js';

const ENV_AT_LOAD = {
  RUN_DB_TESTS: process.env.RUN_DB_TESTS,
  DATABASE_URL: process.env.DATABASE_URL,
};

const OPT_OUT = new Set(['', '0', 'false', 'no', 'off']);
const DB_TESTS_DEMANDED =
  ENV_AT_LOAD.RUN_DB_TESTS !== undefined &&
  !OPT_OUT.has(String(ENV_AT_LOAD.RUN_DB_TESTS).trim().toLowerCase());

const IN_CI = Boolean(process.env.CI || process.env.GITHUB_ACTIONS);
if (IN_CI && !DB_TESTS_DEMANDED) {
  throw new Error(
    'RealPG evidence must never be skipped in CI: set RUN_DB_TESTS=1 and DATABASE_URL'
  );
}

function baseUrl(): URL | null {
  const raw = ENV_AT_LOAD.DATABASE_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

const ORG = 'org-mtg2b-funnel';
// assignee_id przechodzi TaskService CreateTaskSchema (`z.string().uuid()`),
// więc ORGANIZER MUSI być poprawnym UUID — inaczej createTask odrzuci payload.
const ORGANIZER = 'aaaaaaaa-2222-4222-8222-222222222222';
const MEETING = 'meeting-mtg2b-funnel';
const DUE_AT = '2026-10-01T12:00:00.000Z';

let pool: pg.Pool | null = null;
let usable = false;
let skipReason = 'RUN_DB_TESTS is not set';

beforeAll(async () => {
  if (!DB_TESTS_DEMANDED) {
    skipReason = 'RUN_DB_TESTS is not set — this suite skips on purpose';
    return;
  }
  const url = baseUrl();
  if (!url) {
    throw new Error(
      '[MTG-2b funnel pg] FAIL-CLOSED: RUN_DB_TESTS demanded a real LOCAL database but DATABASE_URL is missing or not localhost.'
    );
  }
  pool = new pg.Pool({ connectionString: url.toString(), max: 4 });

  await pool.query(
    `INSERT INTO organizations (id, name, created_at) VALUES ($1, 'MTG2b Funnel', now())
     ON CONFLICT (id) DO NOTHING`,
    [ORG]
  );
  await pool.query(
    `INSERT INTO users (id, organization_id, email, first_name, last_name, role, status)
     VALUES ($1, $2, 'mtg2b-funnel@example.invalid', 'Mtg', 'Organizer', 'ADMIN', 'active')
     ON CONFLICT (id) DO UPDATE SET organization_id = $2`,
    [ORGANIZER, ORG]
  );
  await pool.query(
    `INSERT INTO organization_members (user_id, organization_id, role, status)
     VALUES ($1, $2, 'ADMIN', 'ACTIVE')
     ON CONFLICT (user_id, organization_id) DO UPDATE SET status = 'ACTIVE'`,
    [ORGANIZER, ORG]
  ).catch(() => undefined);
  await pool.query(
    `INSERT INTO meetings (id, organization_id, title, start_at, end_at, status, created_by, lifecycle_state)
     VALUES ($1, $2, 'MTG2b funnel meeting', '2026-09-24T09:00:00Z', '2026-09-24T10:00:00Z', 'scheduled', $3, 'scheduled')
     ON CONFLICT (id) DO UPDATE SET lifecycle_state = 'scheduled'`,
    [MEETING, ORG, ORGANIZER]
  );

  usable = true;
}, 180_000);

afterAll(async () => {
  if (pool) {
    await pool
      .query(
        `DELETE FROM tasks WHERE organization_id = $1 AND source_type = 'meeting_follow_up'`,
        [ORG]
      )
      .catch(() => undefined);
    await pool.query(`DELETE FROM meeting_follow_ups WHERE organization_id = $1`, [ORG]).catch(() => undefined);
    await pool.query(`DELETE FROM meeting_decisions WHERE organization_id = $1`, [ORG]).catch(() => undefined);
    await pool.query(`DELETE FROM meeting_agenda_items WHERE organization_id = $1`, [ORG]).catch(() => undefined);
    await pool.query(`DELETE FROM meetings WHERE id = $1`, [MEETING]).catch(() => undefined);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = $1`, [ORG]).catch(() => undefined);
    await pool.query(`DELETE FROM users WHERE id = $1`, [ORGANIZER]).catch(() => undefined);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [ORG]).catch(() => undefined);
    await pool.end().catch(() => undefined);
    pool = null;
  }
}, 120_000);

const guard = (name: string, fn: () => Promise<void>) =>
  (DB_TESTS_DEMANDED ? it : it.skip)(name, async () => {
    if (!usable) {
      // eslint-disable-next-line no-console
      console.warn(`[MTG-2b funnel pg] SKIPPED: ${skipReason}`);
      return;
    }
    await fn();
  }, 60_000);

describe('MTG-2b action→task funnel roundtrip (real PG)', () => {
  guard('action row keeps agenda_item_id, converts to a task WITH due date + owner, and writes task_id back (return status)', async () => {
    const agenda = await createMeetingAgendaItem({
      organizationId: ORG,
      meetingId: MEETING,
      title: 'Capital shortlist for 2027',
      durationMinutes: 30,
      purpose: 'decision',
      leadUserId: ORGANIZER,
    });

    const followUp = await createMeetingFollowUpRecord({
      organizationId: ORG,
      meetingId: MEETING,
      title: 'Prepare the evidence pack',
      owner: 'A. Nowak',
      ownerUserId: ORGANIZER,
      dueAt: DUE_AT,
      agendaItemId: agenda.id,
    });

    // W109c live writer — agenda_item_id musi wisieć na wierszu akcji.
    const fuRowBefore = await pool!.query(
      `SELECT agenda_item_id, task_id FROM meeting_follow_ups WHERE id = $1`,
      [followUp.id]
    );
    expect(fuRowBefore.rows[0].agenda_item_id).toBe(agenda.id);
    expect(fuRowBefore.rows[0].task_id).toBeNull();

    const { task, replayed } = await createTaskFromMeetingFollowUp({
      organizationId: ORG,
      meetingId: MEETING,
      followUpId: followUp.id,
      actorId: ORGANIZER,
      projectId: null,
    });
    expect(replayed).toBe(false);
    expect(task.id).toBeTruthy();

    // Termin i właściciel PRZETRWALI konwersję jako realne kolumny (nie opis).
    const taskRow = await pool!.query(
      `SELECT due_date, assignee_id, status, source_type, source_id, idempotency_key
         FROM tasks WHERE id = $1`,
      [task.id]
    );
    expect(taskRow.rows).toHaveLength(1);
    expect(new Date(taskRow.rows[0].due_date).toISOString()).toBe(DUE_AT);
    expect(taskRow.rows[0].assignee_id).toBe(ORGANIZER);
    expect(taskRow.rows[0].status).toBe('todo');
    expect(taskRow.rows[0].source_type).toBe('meeting_follow_up');
    expect(taskRow.rows[0].source_id).toBe(`${MEETING}:${followUp.id}`);
    expect(taskRow.rows[0].idempotency_key).toBe(`meeting-follow-up:${followUp.id}`);

    // Status zwrotny: task_id zapisany z powrotem na akcji.
    const fuRowAfter = await pool!.query(
      `SELECT task_id FROM meeting_follow_ups WHERE id = $1`,
      [followUp.id]
    );
    expect(fuRowAfter.rows[0].task_id).toBe(task.id);
    const reread = await getMeetingFollowUpRecord({
      organizationId: ORG,
      meetingId: MEETING,
      followUpId: followUp.id,
    });
    expect(reread?.taskId).toBe(task.id);

    // Idempotentność: ponowna konwersja tej samej akcji = replay, nie drugie zadanie.
    const again = await createTaskFromMeetingFollowUp({
      organizationId: ORG,
      meetingId: MEETING,
      followUpId: followUp.id,
      actorId: ORGANIZER,
      projectId: null,
    });
    expect(again.replayed).toBe(true);
    expect(again.task.id).toBe(task.id);
    const taskCount = await pool!.query(
      `SELECT count(*)::int AS n FROM tasks WHERE organization_id = $1 AND idempotency_key = $2`,
      [ORG, `meeting-follow-up:${followUp.id}`]
    );
    expect(taskCount.rows[0].n).toBe(1);
  });

  guard('decision record live-writes the W109c protocol columns', async () => {
    const decision = await createMeetingDecisionRecord({
      organizationId: ORG,
      meetingId: MEETING,
      statement: 'Adopt option B for the 2027 capital plan',
      rationale: 'Lower TCO over 5 years',
      decidedBy: ORGANIZER,
      createdBy: ORGANIZER,
      ownerUserId: ORGANIZER,
      decisionType: 'investment',
      impactText: 'Frees 2 FTE in Q1',
      rejectedAlternative: 'Option A — higher licence cost',
    });

    const row = await pool!.query(
      `SELECT owner_user_id, decision_type, impact_text, rejected_alternative
         FROM meeting_decisions WHERE id = $1`,
      [decision.id]
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].owner_user_id).toBe(ORGANIZER);
    expect(row.rows[0].decision_type).toBe('investment');
    expect(row.rows[0].impact_text).toBe('Frees 2 FTE in Q1');
    expect(row.rows[0].rejected_alternative).toBe('Option A — higher licence cost');
  });
});
