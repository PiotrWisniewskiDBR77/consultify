/**
 * MTG-1 etap 1 / DEC-596 — RealPG dowód modelu i przejść cyklu życia.
 *
 * Dwie warstwy dowodu w jednym pliku:
 *  (A) MIGRACJA 20262301 na SCRATCH bazie z stanem „przed": backfill
 *      lifecycle_state z legacy status (completed->closed, scheduled->scheduled),
 *      idempotentność drugiego przebiegu oraz CHECK odrzucający nieznany stan.
 *  (B) SERWIS meetingAgendaService na realnie zmigrowanej bazie: CRUD agendy
 *      oraz dozwolone/niedozwolone przejścia cyklu życia. Dowód mutacyjny:
 *      usunięcie `assertLifecycleTransition(...)` z `setMeetingLifecycle`
 *      czerwieni test niedozwolonego przejścia.
 *
 * FAIL-CLOSED GATE (standard W164b / KANAL Wpis 19-20): w CI bez RUN_DB_TESTS
 * plik RZUCA przy kolekcji (RC=1); lokalnie bez RUN_DB_TESTS skip z komunikatem.
 *
 * Uruchomienie (pula D, kontener qoder-d-pg-1):
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *     DATABASE_URL=postgresql://postgres:qoder@127.0.0.1:6630/consultify_qoder \
 *     npx vitest run server/src/services/meeting/__tests__/meetingAgendaLifecycle.pg.test.ts
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createMeetingAgendaItem,
  deleteMeetingAgendaItem,
  getMeetingAgendaItem,
  listMeetingAgendaItems,
  MeetingLifecycleTransitionError,
  setMeetingLifecycle,
  updateMeetingAgendaItem,
} from '../meetingAgendaService.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(HERE, '../../../../migrations');

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

const ORG = 'org-mtg1-agenda';
const CREATOR = 'user-mtg1-creator';
const MEETING = 'meeting-mtg1-agenda';

// P2 (KANAL Wpis 48): druga organizacja z własnym spotkaniem i punktem agendy.
// Każdy odczyt/zapis serwisu wywołany z `organizationId` org A na tych danych
// musi być pusty / null / 0 zmian.
const ORG_B = 'org-mtg1-agenda-other';
const CREATOR_B = 'user-mtg1-creator-other';
const MEETING_B = 'meeting-mtg1-agenda-other';
let agendaItemB = '';

let adminPool: pg.Pool | null = null;
let sharedPool: pg.Pool | null = null;
let scratchDbName = '';
let usable = false;
let skipReason = 'RUN_DB_TESTS is not set';

// Wyniki części (A) zebrane w beforeAll na scratch bazie.
const partA = {
  backfill: [] as Array<{ id: string; status: string; lifecycle: string | null }>,
  secondApplyOk: false,
  checkRejectedBogus: false,
  agendaTableExists: false,
};

function baseUrl(): URL | null {
  const raw = ENV_AT_LOAD.DATABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

beforeAll(async () => {
  if (!DB_TESTS_DEMANDED) {
    skipReason = 'RUN_DB_TESTS is not set — this suite skips on purpose';
    return;
  }
  const url = baseUrl();
  if (!url) {
    throw new Error(
      '[MTG-1 pg] FAIL-CLOSED: RUN_DB_TESTS demanded a real database but DATABASE_URL is missing.'
    );
  }

  // ---- (A) scratch baza: baseline meetings + wiersze „przed" + migracja ----
  scratchDbName = `d_mtg1_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const adminUrl = new URL(url.toString());
  adminUrl.pathname = '/postgres';
  adminPool = new pg.Pool({ connectionString: adminUrl.toString(), max: 1 });
  await adminPool.query(`CREATE DATABASE "${scratchDbName}"`);
  const scratchUrl = new URL(url.toString());
  scratchUrl.pathname = `/${scratchDbName}`;
  const scratch = new pg.Pool({ connectionString: scratchUrl.toString(), max: 2 });

  await scratch.query(readFileSync(path.join(MIGRATIONS_DIR, '20260623_meetings_baseline.sql'), 'utf8'));
  await scratch.query(
    `INSERT INTO meetings (id, organization_id, title, start_at, end_at, status, created_by)
     VALUES ('pre-completed', $1, 'Done', '2026-09-01T09:00:00Z', '2026-09-01T10:00:00Z', 'completed', $2),
            ('pre-scheduled', $1, 'Upcoming', '2026-09-20T09:00:00Z', '2026-09-20T10:00:00Z', 'scheduled', $2)`,
    [ORG, CREATOR]
  );

  const migrationSql = readFileSync(
    path.join(MIGRATIONS_DIR, '20262301_meetings_agenda_lifecycle.sql'),
    'utf8'
  );
  await scratch.query(migrationSql);
  const backfillRows = await scratch.query(
    `SELECT id, status, lifecycle_state FROM meetings ORDER BY id`
  );
  partA.backfill = backfillRows.rows.map((r) => ({
    id: r.id,
    status: r.status,
    lifecycle: r.lifecycle_state,
  }));
  partA.agendaTableExists =
    (await scratch.query(`SELECT to_regclass('public.meeting_agenda_items') AS t`)).rows[0].t !==
    null;

  // Idempotentność: drugi przebieg tego samego pliku nie może rzucić.
  try {
    await scratch.query(migrationSql);
    partA.secondApplyOk = true;
  } catch {
    partA.secondApplyOk = false;
  }

  // CHECK: nieznany stan musi zostać odrzucony.
  try {
    await scratch.query(`UPDATE meetings SET lifecycle_state = 'bogus' WHERE id = 'pre-completed'`);
    partA.checkRejectedBogus = false;
  } catch {
    partA.checkRejectedBogus = true;
  }
  await scratch.end();

  // ---- (B) współdzielona, realnie zmigrowana baza dla serwisu ----
  sharedPool = new pg.Pool({ connectionString: url.toString(), max: 4 });
  await sharedPool.query(
    `INSERT INTO organizations (id, name, created_at) VALUES ($1, 'MTG1 Agenda', now())
     ON CONFLICT (id) DO NOTHING`,
    [ORG]
  );
  await sharedPool.query(
    `INSERT INTO users (id, organization_id, email, first_name, last_name, role, status)
     VALUES ($1, $2, 'mtg1@example.invalid', 'Mtg', 'One', 'ADMIN', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [CREATOR, ORG]
  );
  await sharedPool.query(
    `INSERT INTO meetings (id, organization_id, title, start_at, end_at, status, created_by, lifecycle_state)
     VALUES ($1, $2, 'MTG1 lifecycle meeting', '2026-09-22T09:00:00Z', '2026-09-22T10:00:00Z', 'scheduled', $3, 'scheduled')
     ON CONFLICT (id) DO UPDATE SET lifecycle_state = 'scheduled'`,
    [MEETING, ORG, CREATOR]
  );

  // ---- (B2) druga organizacja: cel próby izolacji org (P2) ----
  await sharedPool.query(
    `INSERT INTO organizations (id, name, created_at) VALUES ($1, 'MTG1 Agenda Other', now())
     ON CONFLICT (id) DO NOTHING`,
    [ORG_B]
  );
  await sharedPool.query(
    `INSERT INTO users (id, organization_id, email, first_name, last_name, role, status)
     VALUES ($1, $2, 'mtg1-other@example.invalid', 'Mtg', 'Other', 'ADMIN', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [CREATOR_B, ORG_B]
  );
  await sharedPool.query(
    `INSERT INTO meetings (id, organization_id, title, start_at, end_at, status, created_by, lifecycle_state)
     VALUES ($1, $2, 'MTG1 other-org meeting', '2026-09-23T09:00:00Z', '2026-09-23T10:00:00Z', 'scheduled', $3, 'scheduled')
     ON CONFLICT (id) DO UPDATE SET lifecycle_state = 'scheduled'`,
    [MEETING_B, ORG_B, CREATOR_B]
  );
  const existingB = await sharedPool.query(
    `SELECT id FROM meeting_agenda_items WHERE organization_id = $1 AND meeting_id = $2 LIMIT 1`,
    [ORG_B, MEETING_B]
  );
  agendaItemB =
    existingB.rows[0]?.id ||
    (
      await createMeetingAgendaItem({
        organizationId: ORG_B,
        meetingId: MEETING_B,
        title: 'Other-org confidential agenda point',
        durationMinutes: 20,
        purpose: 'decision',
        leadUserId: CREATOR_B,
      })
    ).id;

  usable = true;
}, 180_000);

afterAll(async () => {
  if (sharedPool) {
    await sharedPool
      .query(`DELETE FROM meeting_agenda_items WHERE organization_id = $1`, [ORG])
      .catch(() => undefined);
    await sharedPool
      .query(`DELETE FROM meeting_agenda_items WHERE organization_id = $1`, [ORG_B])
      .catch(() => undefined);
    await sharedPool.query(`DELETE FROM meetings WHERE id = $1`, [MEETING]).catch(() => undefined);
    await sharedPool.query(`DELETE FROM meetings WHERE id = $1`, [MEETING_B]).catch(() => undefined);
    await sharedPool.query(`DELETE FROM users WHERE id = $1`, [CREATOR]).catch(() => undefined);
    await sharedPool.query(`DELETE FROM users WHERE id = $1`, [CREATOR_B]).catch(() => undefined);
    await sharedPool
      .query(`DELETE FROM organizations WHERE id = $1`, [ORG])
      .catch(() => undefined);
    await sharedPool
      .query(`DELETE FROM organizations WHERE id = $1`, [ORG_B])
      .catch(() => undefined);
    await sharedPool.end().catch(() => undefined);
    sharedPool = null;
  }
  if (adminPool && scratchDbName) {
    await adminPool
      .query(`DROP DATABASE IF EXISTS "${scratchDbName}" WITH (FORCE)`)
      .catch(() => undefined);
  }
  await adminPool?.end().catch(() => undefined);
  adminPool = null;
}, 120_000);

// it/it.skip decyduje się przy KOLEKCJI, więc kluczuje na DB_TESTS_DEMANDED
// (odczyt przy ładowaniu modułu), NIE na `usable` z beforeAll.
const guard = (name: string, fn: () => Promise<void>) =>
  (DB_TESTS_DEMANDED ? it : it.skip)(name, async () => {
    if (!usable) {
      // eslint-disable-next-line no-console
      console.warn(`[MTG-1 pg] SKIPPED: ${skipReason}`);
      return;
    }
    await fn();
  }, 60_000);

describe('MTG-1 agenda + lifecycle (real PG)', () => {
  guard('migration 20262301 backfills lifecycle_state from legacy status', async () => {
    expect(partA.agendaTableExists).toBe(true);
    const completed = partA.backfill.find((r) => r.id === 'pre-completed');
    const scheduled = partA.backfill.find((r) => r.id === 'pre-scheduled');
    expect(completed?.lifecycle).toBe('closed');
    expect(scheduled?.lifecycle).toBe('scheduled');
  });

  guard('migration 20262301 is idempotent (second apply is a no-op)', async () => {
    expect(partA.secondApplyOk).toBe(true);
  });

  guard('CHECK constraint rejects an unknown lifecycle_state', async () => {
    expect(partA.checkRejectedBogus).toBe(true);
  });

  guard('agenda CRUD round-trips against the real schema', async () => {
    const first = await createMeetingAgendaItem({
      organizationId: ORG,
      meetingId: MEETING,
      title: 'Open actions carried from last review',
      durationMinutes: 15,
      purpose: 'information',
    });
    const second = await createMeetingAgendaItem({
      organizationId: ORG,
      meetingId: MEETING,
      title: 'Capital shortlist for 2027',
      durationMinutes: 30,
      purpose: 'decision',
      leadUserId: CREATOR,
      preRead: ['Capital shortlist 2027.xlsx'],
    });
    expect(first.position).toBe(1);
    expect(second.position).toBe(2);

    let items = await listMeetingAgendaItems({ organizationId: ORG, meetingId: MEETING });
    expect(items.map((i) => i.id)).toEqual([first.id, second.id]);

    const updated = await updateMeetingAgendaItem({
      organizationId: ORG,
      itemId: second.id,
      purpose: 'discussion',
      durationMinutes: 45,
    });
    expect(updated?.purpose).toBe('discussion');
    expect(updated?.durationMinutes).toBe(45);

    await deleteMeetingAgendaItem({ organizationId: ORG, itemId: first.id });
    items = await listMeetingAgendaItems({ organizationId: ORG, meetingId: MEETING });
    expect(items.map((i) => i.id)).toEqual([second.id]);
    await deleteMeetingAgendaItem({ organizationId: ORG, itemId: second.id });
    items = await listMeetingAgendaItems({ organizationId: ORG, meetingId: MEETING });
    expect(items).toEqual([]);
  });

  guard('allowed lifecycle transitions persist in order', async () => {
    expect(await setMeetingLifecycle({ organizationId: ORG, meetingId: MEETING, nextState: 'in_progress' })).toBe(
      'in_progress'
    );
    expect(
      await setMeetingLifecycle({
        organizationId: ORG,
        meetingId: MEETING,
        nextState: 'minutes_to_approve',
      })
    ).toBe('minutes_to_approve');
    expect(
      await setMeetingLifecycle({ organizationId: ORG, meetingId: MEETING, nextState: 'needs_actions' })
    ).toBe('needs_actions');
    expect(await setMeetingLifecycle({ organizationId: ORG, meetingId: MEETING, nextState: 'closed' })).toBe(
      'closed'
    );
    const row = await sharedPool!.query(`SELECT lifecycle_state FROM meetings WHERE id = $1`, [
      MEETING,
    ]);
    expect(row.rows[0].lifecycle_state).toBe('closed');
  });

  guard('disallowed lifecycle transition throws MeetingLifecycleTransitionError', async () => {
    // Reset do scheduled, żeby niedozwolone przejście scheduled -> closed było
    // mierzone na znanym stanie startowym.
    await sharedPool!.query(`UPDATE meetings SET lifecycle_state = 'scheduled' WHERE id = $1`, [
      MEETING,
    ]);
    await expect(
      setMeetingLifecycle({ organizationId: ORG, meetingId: MEETING, nextState: 'closed' })
    ).rejects.toBeInstanceOf(MeetingLifecycleTransitionError);

    // closed jest terminalny: po domknięciu żadne przejście nie przechodzi.
    await sharedPool!.query(`UPDATE meetings SET lifecycle_state = 'closed' WHERE id = $1`, [
      MEETING,
    ]);
    await expect(
      setMeetingLifecycle({ organizationId: ORG, meetingId: MEETING, nextState: 'scheduled' })
    ).rejects.toBeInstanceOf(MeetingLifecycleTransitionError);
  });

  // P2 (KANAL Wpis 48): mutacja „usuń `organization_id = ?` z
  // listMeetingAgendaItems" zostawała ZIELONA, bo żaden test nie mierzył
  // izolacji org na poziomie serwisu. Kontrola pozytywna (te same wywołania z
  // org B widzą punkt) jest częścią testu — bez niej puste wyniki mogłyby być
  // fałszywą zielenią z niesprawnych fixture'ów.
  guard('agenda service never crosses the organization boundary', async () => {
    expect(agendaItemB).not.toBe('');

    // Kontrola pozytywna: właściciel danych je widzi.
    await expect(
      listMeetingAgendaItems({ organizationId: ORG_B, meetingId: MEETING_B })
    ).resolves.toHaveLength(1);
    const own = await getMeetingAgendaItem({ organizationId: ORG_B, itemId: agendaItemB });
    expect(own?.title).toBe('Other-org confidential agenda point');

    // Obca organizacja: pusto / null / 0 zmian.
    await expect(
      listMeetingAgendaItems({ organizationId: ORG, meetingId: MEETING_B })
    ).resolves.toEqual([]);
    await expect(
      getMeetingAgendaItem({ organizationId: ORG, itemId: agendaItemB })
    ).resolves.toBeNull();
    await expect(
      updateMeetingAgendaItem({ organizationId: ORG, itemId: agendaItemB, title: 'Hijacked' })
    ).resolves.toBeNull();
    await expect(
      deleteMeetingAgendaItem({ organizationId: ORG, itemId: agendaItemB })
    ).resolves.toBe(false);

    const untouched = await sharedPool!.query(
      `SELECT title FROM meeting_agenda_items WHERE id = $1`,
      [agendaItemB]
    );
    expect(untouched.rows).toHaveLength(1);
    expect(untouched.rows[0].title).toBe('Other-org confidential agenda point');
  });

  // P3 (KANAL Wpis 48): karta pokazuje numery punktów (`position`), więc
  // usunięcie punktu ze środka listy musi zamknąć lukę — inaczej oś agendy
  // czytałaby się 1, 3, 4. Kolejność względna punktów zostaje.
  guard('deleting a middle agenda item renumbers the remaining positions 1..N', async () => {
    const first = await createMeetingAgendaItem({
      organizationId: ORG,
      meetingId: MEETING,
      title: 'Renumber A',
    });
    const middle = await createMeetingAgendaItem({
      organizationId: ORG,
      meetingId: MEETING,
      title: 'Renumber B',
    });
    const last = await createMeetingAgendaItem({
      organizationId: ORG,
      meetingId: MEETING,
      title: 'Renumber C',
    });
    expect([first.position, middle.position, last.position]).toEqual([1, 2, 3]);

    expect(await deleteMeetingAgendaItem({ organizationId: ORG, itemId: middle.id })).toBe(true);

    const items = await listMeetingAgendaItems({ organizationId: ORG, meetingId: MEETING });
    expect(items.map((item) => item.title)).toEqual(['Renumber A', 'Renumber C']);
    expect(items.map((item) => item.position)).toEqual([1, 2]);

    // Stan w bazie, nie tylko w odpowiedzi serwisu.
    const rows = await sharedPool!.query(
      `SELECT id, position FROM meeting_agenda_items
        WHERE organization_id = $1 AND meeting_id = $2 ORDER BY position ASC`,
      [ORG, MEETING]
    );
    expect(rows.rows.map((row) => [row.id, Number(row.position)])).toEqual([
      [first.id, 1],
      [last.id, 2],
    ]);

    await deleteMeetingAgendaItem({ organizationId: ORG, itemId: first.id });
    await deleteMeetingAgendaItem({ organizationId: ORG, itemId: last.id });
    await expect(
      listMeetingAgendaItems({ organizationId: ORG, meetingId: MEETING })
    ).resolves.toEqual([]);
  });

  // DbPromise's default `fallback: true` swallows a DB error into [] / null, so
  // a missing `meeting_agenda_items` table (environment that never ran
  // migration 20262301) would look exactly like "this meeting has no agenda"
  // instead of failing loudly — the same trap day16 FIX-9 measured on
  // meeting_participants. Every read/write above therefore passes
  // `fallback: false`. This must stay the LAST test: it renames the real table
  // out of existence and renames it back in a finally, so no other test (nor
  // any suite sharing this database) sees the gap.
  guard('missing meeting_agenda_items table throws instead of returning an empty agenda', async () => {
    await sharedPool!.query(
      `ALTER TABLE meeting_agenda_items RENAME TO meeting_agenda_items_mtg1_missing`
    );
    try {
      await expect(
        listMeetingAgendaItems({ organizationId: ORG, meetingId: MEETING })
      ).rejects.toThrow();
    } finally {
      await sharedPool!.query(
        `ALTER TABLE meeting_agenda_items_mtg1_missing RENAME TO meeting_agenda_items`
      );
    }
    // Prove the rename-back actually worked and the table is usable again.
    await expect(
      listMeetingAgendaItems({ organizationId: ORG, meetingId: MEETING })
    ).resolves.toBeInstanceOf(Array);
  });
});
