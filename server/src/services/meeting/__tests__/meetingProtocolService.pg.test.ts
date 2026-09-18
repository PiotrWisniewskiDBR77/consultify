/**
 * MTG-2 rework etap 2a / DEC-607 (U-52) — RealPG dowód protokołu spotkania.
 *
 * Trzy warstwy dowodu w jednym pliku:
 *  (A) MIGRACJE 20262302 + 20262303 na SCRATCH bazie: nowe kolumny decyzji/akcji,
 *      tabela `meeting_protocols` + unikalny (meeting_id, version), idempotentność.
 *  (B) SERWIS meetingProtocolService na realnie zmigrowanej bazie (DATABASE_URL):
 *      generator 8 bloków z DANYCH, puste bloki UKRYTE, fallback z zatwierdzonej
 *      notatki, odczyt statusu zadania po task_id, wersjonowanie (approve -> errata
 *      v1.1, v1.0 nietknięta), preview bez zapisu.
 *  (C) REALNE dane z kopii dumpu: protokół Northwind „Weekly PMO Review" ma
 *      >=1 decyzję i >=1 akcję Z DANYCH (guard: skip, gdy spotkania brak — plik
 *      uruchamiamy wtedy przeciw KOPII DUMPU).
 *
 * Dowód mutacyjny: usunięcie bloku decyzji z `buildProtocolService` czerwieni
 * testy (B1) obecności 8 bloków i (B2) pól decyzji.
 *
 * FAIL-CLOSED GATE (standard W164b): w CI bez RUN_DB_TESTS plik RZUCA przy
 * kolekcji (RC=1); lokalnie bez RUN_DB_TESTS skip z komunikatem.
 *
 * Uruchomienie (pula D, kontener qoder-d-pg-3, kopia dumpu):
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *     DATABASE_URL=postgresql://postgres:qoder@127.0.0.1:6632/consultify_mtg2_dump \
 *     npx vitest run server/src/services/meeting/__tests__/meetingProtocolService.pg.test.ts
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  approveProtocol,
  buildProtocolContent,
  createErrataVersion,
  getLatestApprovedProtocol,
  getPublishedProtocol,
  nextProtocolVersion,
  previewProtocol,
  type ProtocolBlock,
} from '../meetingProtocolService.js';

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

const ORG = 'org-mtg2-proto';
const CHAIR = 'user-mtg2-chair';
const SCRIBE = 'user-mtg2-scribe';
const MEMBER = 'user-mtg2-member';
const MEETING_FULL = 'meeting-mtg2-full';
const MEETING_EMPTY = 'meeting-mtg2-empty';
const MEETING_NOTE = 'meeting-mtg2-note';
const AGENDA_1 = 'agenda-mtg2-1';
const DECISION_1 = 'decision-mtg2-1';
const FOLLOWUP_1 = 'followup-mtg2-1';
const TASK_1 = 'task-mtg2-1';
const NOTE_1 = 'note-mtg2-1';
const MEETING_LIVE = 'meeting-mtg2-live';
const DECISION_LIVE = 'decision-mtg2-live';

let adminPool: pg.Pool | null = null;
let sharedPool: pg.Pool | null = null;
let scratchDbName = '';
let usable = false;
let skipReason = 'RUN_DB_TESTS is not set';

const partA = {
  decisionCols: [] as string[],
  followUpCols: [] as string[],
  protocolsTableExists: false,
  uniqueIndexExists: false,
  secondApplyOk: false,
  uniqueRejectedDup: false,
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

function kinds(blocks: ProtocolBlock[]): string[] {
  return blocks.map((b) => b.kind);
}

beforeAll(async () => {
  if (!DB_TESTS_DEMANDED) {
    skipReason = 'RUN_DB_TESTS is not set — this suite skips on purpose';
    return;
  }
  const url = baseUrl();
  if (!url) {
    throw new Error(
      '[MTG-2a pg] FAIL-CLOSED: RUN_DB_TESTS demanded a real database but DATABASE_URL is missing.'
    );
  }

  // ---- (A) scratch: baseline + MTG-1 + moje dwie migracje ----
  scratchDbName = `d_mtg2_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const adminUrl = new URL(url.toString());
  adminUrl.pathname = '/postgres';
  adminPool = new pg.Pool({ connectionString: adminUrl.toString(), max: 1 });
  await adminPool.query(`CREATE DATABASE "${scratchDbName}"`);
  const scratchUrl = new URL(url.toString());
  scratchUrl.pathname = `/${scratchDbName}`;
  const scratch = new pg.Pool({ connectionString: scratchUrl.toString(), max: 2 });

  await scratch.query(
    readFileSync(path.join(MIGRATIONS_DIR, '20260623_meetings_baseline.sql'), 'utf8')
  );
  await scratch.query(
    readFileSync(path.join(MIGRATIONS_DIR, '20260826_meetings_day10_decisions.sql'), 'utf8')
  );
  await scratch.query(
    readFileSync(path.join(MIGRATIONS_DIR, '20262301_meetings_agenda_lifecycle.sql'), 'utf8')
  );
  const mig302 = readFileSync(
    path.join(MIGRATIONS_DIR, '20262302_meetings_protocol_columns.sql'),
    'utf8'
  );
  const mig303 = readFileSync(
    path.join(MIGRATIONS_DIR, '20262303_meeting_protocols.sql'),
    'utf8'
  );
  await scratch.query(mig302);
  await scratch.query(mig303);

  partA.decisionCols = (
    await scratch.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name='meeting_decisions'
         AND column_name IN ('owner_user_id','decision_type','impact_text','rejected_alternative')
       ORDER BY column_name`
    )
  ).rows.map((r) => r.column_name);
  partA.followUpCols = (
    await scratch.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name='meeting_follow_ups' AND column_name IN ('task_id','agenda_item_id')
       ORDER BY column_name`
    )
  ).rows.map((r) => r.column_name);
  partA.protocolsTableExists =
    (await scratch.query(`SELECT to_regclass('public.meeting_protocols') AS t`)).rows[0].t !== null;
  partA.uniqueIndexExists = (
    await scratch.query(
      `SELECT indexname FROM pg_indexes WHERE tablename='meeting_protocols'
        AND indexname='uq_meeting_protocols_meeting_version'`
    )
  ).rows.length === 1;

  // Idempotentność: drugi przebieg obu plików nie może rzucić.
  try {
    await scratch.query(mig302);
    await scratch.query(mig303);
    partA.secondApplyOk = true;
  } catch {
    partA.secondApplyOk = false;
  }

  // Unikalny (meeting_id, version): duplikat musi zostać odrzucony.
  await scratch.query(
    `INSERT INTO meetings (id, organization_id, title, start_at, end_at, created_by)
     VALUES ('m-proto-uq', 'org-uq', 'T', '2026-09-01T09:00:00Z', '2026-09-01T10:00:00Z', 'u')`
  );
  await scratch.query(
    `INSERT INTO meeting_protocols (id, organization_id, meeting_id, version, status, created_by)
     VALUES ('p1', 'org-uq', 'm-proto-uq', '1.0', 'draft', 'u')`
  );
  try {
    await scratch.query(
      `INSERT INTO meeting_protocols (id, organization_id, meeting_id, version, status, created_by)
       VALUES ('p2', 'org-uq', 'm-proto-uq', '1.0', 'draft', 'u')`
    );
    partA.uniqueRejectedDup = false;
  } catch {
    partA.uniqueRejectedDup = true;
  }
  await scratch.end();

  // ---- (B) współdzielona, realnie zmigrowana baza dla serwisu ----
  sharedPool = new pg.Pool({ connectionString: url.toString(), max: 4 });
  const q = (sql: string, params: unknown[] = []) => sharedPool!.query(sql, params);

  await q(`INSERT INTO organizations (id, name, created_at) VALUES ($1,'MTG2 Proto',now())
           ON CONFLICT (id) DO NOTHING`, [ORG]);
  for (const [id, first, last] of [
    [CHAIR, 'Constance', 'Chair'],
    [SCRIBE, 'Sam', 'Scribe'],
    [MEMBER, 'Morgan', 'Member'],
  ] as Array<[string, string, string]>) {
    await q(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, role, status)
       VALUES ($1,$2,$3,$4,$5,'MEMBER','active') ON CONFLICT (id) DO NOTHING`,
      [id, ORG, `${id}@example.invalid`, first, last]
    );
  }

  // Pełne spotkanie: role, typ, seria, uczestnicy, agenda, decyzja, akcja, zadanie.
  await q(
    `INSERT INTO meetings (id, organization_id, title, start_at, end_at, created_by,
        type, chair_user_id, scribe_user_id, lifecycle_state, recurrence_rule, location)
     VALUES ($1,$2,'Full Protocol Meeting','2026-09-22T09:00:00Z','2026-09-22T10:00:00Z',$3,
        'decision',$4,$5,'minutes_to_approve','FREQ=WEEKLY','Warsaw')
     ON CONFLICT (id) DO NOTHING`,
    [MEETING_FULL, ORG, CHAIR, CHAIR, SCRIBE]
  );
  const participants: Array<[string, string, string, string]> = [
    ['p-acc-1', CHAIR, 'accepted', 'user'],
    ['p-acc-2', MEMBER, 'accepted', 'user'],
    ['p-dec-1', SCRIBE, 'declined', 'user'],
    ['p-pen-1', 'Pending Person', 'no_response', 'guest'],
  ];
  for (const [pid, who, status, kind] of participants) {
    const isUser = kind === 'user';
    await q(
      `INSERT INTO meeting_participants
         (id, organization_id, meeting_id, participant_kind, user_id, display_name, invitation_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
      [
        pid,
        ORG,
        MEETING_FULL,
        kind,
        isUser ? who : null,
        isUser ? null : who,
        status,
      ]
    );
  }
  await q(
    `INSERT INTO meeting_agenda_items
       (id, organization_id, meeting_id, position, title, duration_minutes, purpose, lead_user_id, notes, decision_id)
     VALUES ($1,$2,$3,1,'Point one',20,'decision',$4,'Discussed and decided.',$5)
     ON CONFLICT (id) DO NOTHING`,
    [AGENDA_1, ORG, MEETING_FULL, CHAIR, DECISION_1]
  );
  await q(
    `INSERT INTO meeting_agenda_items
       (id, organization_id, meeting_id, position, title, duration_minutes, purpose)
     VALUES ('agenda-mtg2-2',$1,$2,2,'Point two',15,'information') ON CONFLICT (id) DO NOTHING`,
    [ORG, MEETING_FULL]
  );
  await q(
    `INSERT INTO meeting_decisions
       (id, organization_id, meeting_id, statement, rationale, decided_by, decided_at, status,
        owner_user_id, decision_type, impact_text, rejected_alternative, created_by)
     VALUES ($1,$2,$3,'Adopt option B','Cheaper','Constance Chair','2026-09-22T09:40:00Z','recorded',
        $4,'direction','High','Option A',$5) ON CONFLICT (id) DO NOTHING`,
    [DECISION_1, ORG, MEETING_FULL, MEMBER, CHAIR]
  );
  await q(
    `INSERT INTO tasks (id, organization_id, title, status, assignee_id)
     VALUES ($1,$2,'Follow the wire','in_progress',$3) ON CONFLICT (id) DO NOTHING`,
    [TASK_1, ORG, MEMBER]
  );
  await q(
    `INSERT INTO meeting_follow_ups
       (id, organization_id, meeting_id, title, owner, owner_user_id, due_at, status, task_id, agenda_item_id)
     VALUES ($1,$2,$3,'Send the summary','Morgan Member',$4,'2026-09-25','open',$5,$6)
     ON CONFLICT (id) DO NOTHING`,
    [FOLLOWUP_1, ORG, MEETING_FULL, MEMBER, TASK_1, AGENDA_1]
  );

  // Puste spotkanie: tylko wiersz meetings (brak uczestników/agendy/decyzji/akcji/notatki).
  await q(
    `INSERT INTO meetings (id, organization_id, title, start_at, end_at, created_by)
     VALUES ($1,$2,'Empty Protocol Meeting','2026-09-23T09:00:00Z','2026-09-23T10:00:00Z',$3)
     ON CONFLICT (id) DO NOTHING`,
    [MEETING_EMPTY, ORG, CHAIR]
  );

  // Spotkanie z zatwierdzoną notatką i PUSTYMI rejestrami (dowód fallbacku).
  await q(
    `INSERT INTO meetings (id, organization_id, title, start_at, end_at, created_by)
     VALUES ($1,$2,'Note Fallback Meeting','2026-09-24T09:00:00Z','2026-09-24T10:00:00Z',$3)
     ON CONFLICT (id) DO NOTHING`,
    [MEETING_NOTE, ORG, CHAIR]
  );
  await q(
    `INSERT INTO meeting_notes
       (id, organization_id, meeting_id, transcript_hash, status, decisions_json, action_items_json, created_by)
     VALUES ($1,$2,$3,'hash-mtg2','approved',
        $4,$5,$6) ON CONFLICT (id) DO NOTHING`,
    [
      NOTE_1,
      ORG,
      MEETING_NOTE,
      JSON.stringify([{ decision: 'Escalate the delay', decidedBy: 'constance.chair' }]),
      JSON.stringify([
        { task: 'Get a revised timeline', owner: 'sam.scribe@example.invalid', deadline: '2026-09-30', priority: 'high' },
        { task: 'Prepare the summary', owner: 'morgan.member@example.invalid', deadline: '2026-09-29', priority: 'medium' },
      ]),
      CHAIR,
    ]
  );

  // Izolowane spotkanie do dowodu W109b (B9): publikacja v1.0 -> edycja źródła ->
  // migawka v1.0 bez zmian, widok roboczy żywy, errata -> v1.1. Własna decyzja,
  // żeby mutacja źródła nie dotykała MEETING_FULL (losowa kolejność testów).
  await q(
    `INSERT INTO meetings (id, organization_id, title, start_at, end_at, created_by,
        chair_user_id, lifecycle_state)
     VALUES ($1,$2,'Live Source Meeting','2026-09-26T09:00:00Z','2026-09-26T10:00:00Z',$3,
        $3,'minutes_to_approve')
     ON CONFLICT (id) DO NOTHING`,
    [MEETING_LIVE, ORG, CHAIR]
  );
  await q(
    `INSERT INTO meeting_decisions
       (id, organization_id, meeting_id, statement, rationale, decided_by, decided_at, status, created_by)
     VALUES ($1,$2,$3,'Adopt the original plan','Baseline','Constance Chair','2026-09-26T09:30:00Z','recorded',$4)
     ON CONFLICT (id) DO NOTHING`,
    [DECISION_LIVE, ORG, MEETING_LIVE, CHAIR]
  );

  // Czyste protokoły z poprzednich przebiegów (żeby wersjonowanie było deterministyczne).
  await q(`DELETE FROM meeting_protocols WHERE organization_id = $1`, [ORG]);

  usable = true;
}, 180_000);

afterAll(async () => {
  if (sharedPool) {
    for (const sql of [
      `DELETE FROM meeting_protocols WHERE organization_id = $1`,
      `DELETE FROM meeting_follow_ups WHERE organization_id = $1`,
      `DELETE FROM meeting_decisions WHERE organization_id = $1`,
      `DELETE FROM meeting_agenda_items WHERE organization_id = $1`,
      `DELETE FROM meeting_participants WHERE organization_id = $1`,
      `DELETE FROM meeting_notes WHERE organization_id = $1`,
      `DELETE FROM tasks WHERE organization_id = $1`,
      `DELETE FROM meetings WHERE organization_id = $1`,
      `DELETE FROM users WHERE organization_id = $1`,
      `DELETE FROM organizations WHERE id = $1`,
    ]) {
      await sharedPool.query(sql, [ORG]).catch(() => undefined);
    }
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

const guard = (name: string, fn: () => Promise<void>) =>
  (DB_TESTS_DEMANDED ? it : it.skip)(name, async () => {
    if (!usable) {
      // eslint-disable-next-line no-console
      console.warn(`[MTG-2a pg] SKIPPED: ${skipReason}`);
      return;
    }
    await fn();
  }, 60_000);

describe('MTG-2a protocol (real PG)', () => {
  // ---- (A) migracje ----
  guard('20262302 adds the four decision + two follow-up columns', async () => {
    expect(partA.decisionCols).toEqual([
      'decision_type',
      'impact_text',
      'owner_user_id',
      'rejected_alternative',
    ]);
    expect(partA.followUpCols).toEqual(['agenda_item_id', 'task_id']);
  });

  guard('20262303 creates meeting_protocols with a unique (meeting_id, version)', async () => {
    expect(partA.protocolsTableExists).toBe(true);
    expect(partA.uniqueIndexExists).toBe(true);
    expect(partA.uniqueRejectedDup).toBe(true);
  });

  guard('both migrations are idempotent (second apply is a no-op)', async () => {
    expect(partA.secondApplyOk).toBe(true);
  });

  // ---- (B) generator ----
  guard('B1 generator emits all 8 blocks for a full meeting', async () => {
    const content = await buildProtocolContent({
      organizationId: ORG,
      meetingId: MEETING_FULL,
      approverName: null,
      versions: [],
    });
    expect(kinds(content.blocks).sort()).toEqual(
      ['actions', 'agenda', 'attendance', 'decisions', 'footer', 'meta', 'proceedings', 'roles'].sort()
    );
  });

  guard('B2 decisions block carries owner/type/impact/rejected from the columns', async () => {
    const content = await buildProtocolContent({
      organizationId: ORG,
      meetingId: MEETING_FULL,
    });
    const dec = content.blocks.find((b) => b.kind === 'decisions');
    expect(dec).toBeTruthy();
    if (dec?.kind !== 'decisions') throw new Error('no decisions block');
    expect(dec.items).toHaveLength(1);
    expect(dec.items[0].statement).toBe('Adopt option B');
    expect(dec.items[0].owner).toBe('Morgan Member');
    expect(dec.items[0].decisionType).toBe('direction');
    expect(dec.items[0].impact).toBe('High');
    expect(dec.items[0].rejectedAlternative).toBe('Option A');
  });

  guard('B3 actions block reads back task status via task_id and pins the agenda point', async () => {
    const content = await buildProtocolContent({
      organizationId: ORG,
      meetingId: MEETING_FULL,
    });
    const act = content.blocks.find((b) => b.kind === 'actions');
    if (act?.kind !== 'actions') throw new Error('no actions block');
    expect(act.items).toHaveLength(1);
    expect(act.items[0].title).toBe('Send the summary');
    expect(act.items[0].owner).toBe('Morgan Member');
    expect(act.items[0].dueAt).toBe('2026-09-25');
    expect(act.items[0].taskStatus).toBe('in_progress');
    expect(act.items[0].agendaItemTitle).toBe('Point one');
  });

  guard('B4 attendance splits RSVP with resolved names', async () => {
    const content = await buildProtocolContent({
      organizationId: ORG,
      meetingId: MEETING_FULL,
    });
    const att = content.blocks.find((b) => b.kind === 'attendance');
    if (att?.kind !== 'attendance') throw new Error('no attendance block');
    expect(att.accepted.sort()).toEqual(['Constance Chair', 'Morgan Member']);
    expect(att.declined).toEqual(['Sam Scribe']);
    expect(att.pending).toEqual(['Pending Person']);
  });

  guard('B5 empty blocks are HIDDEN — bare meeting yields only meta + footer', async () => {
    const content = await buildProtocolContent({
      organizationId: ORG,
      meetingId: MEETING_EMPTY,
    });
    expect(kinds(content.blocks).sort()).toEqual(['footer', 'meta']);
  });

  guard('B6 fallback reads decisions + actions from the approved note when registers are empty', async () => {
    const content = await buildProtocolContent({
      organizationId: ORG,
      meetingId: MEETING_NOTE,
    });
    const dec = content.blocks.find((b) => b.kind === 'decisions');
    const act = content.blocks.find((b) => b.kind === 'actions');
    if (dec?.kind !== 'decisions') throw new Error('no decisions block from note');
    if (act?.kind !== 'actions') throw new Error('no actions block from note');
    expect(dec.items).toHaveLength(1);
    expect(dec.items[0].statement).toBe('Escalate the delay');
    expect(act.items).toHaveLength(2);
    expect(act.items[0].dueAt).toBe('2026-09-30');
  });

  guard('B7 previewProtocol does NOT persist a row for a fresh meeting', async () => {
    // MEETING_EMPTY (nie MEETING_FULL) — niezależne od B8, które utrwala wersje
    // na MEETING_FULL; kolejność testów jest losowa (config `order: 'random'`).
    const before = await getLatestApprovedProtocol({
      organizationId: ORG,
      meetingId: MEETING_EMPTY,
    });
    expect(before).toBeNull();
    const preview = await previewProtocol({ organizationId: ORG, meetingId: MEETING_EMPTY });
    expect(preview.persisted).toBe(false);
    expect(preview.status).toBe('draft');
    expect(preview.version).toBe('1.0');
    expect(preview.publishedVersion).toBeNull();
    const after = await getLatestApprovedProtocol({
      organizationId: ORG,
      meetingId: MEETING_EMPTY,
    });
    expect(after).toBeNull();
  });

  guard('B8 versioning: approve publishes v1.0, errata publishes v1.1 and leaves v1.0 untouched', async () => {
    // W109b: akcept = PIERWSZA publikacja (migawka v1.0 z żywych źródeł), bez
    // osobnego wiersza draft. draft roboczy nigdy nie jest utrwalany.
    const approved = await approveProtocol({
      organizationId: ORG,
      meetingId: MEETING_FULL,
      actorId: CHAIR,
    });
    expect(approved.version).toBe('1.0');
    expect(approved.status).toBe('approved');
    expect(approved.approvedByName).toBe('Constance Chair');
    const roles = approved.content.blocks.find((b) => b.kind === 'roles');
    expect(roles?.kind === 'roles' ? roles.approver : null).toBe('Constance Chair');
    const frozenDigest = approved.sourceDigest;
    const frozenContent = JSON.stringify(approved.content.blocks);

    // Ponowny akcept tej samej publikacji = konflikt (nie nadpisuje v1.0).
    await expect(
      approveProtocol({ organizationId: ORG, meetingId: MEETING_FULL, actorId: CHAIR })
    ).rejects.toThrow(/ALREADY_APPROVED/);

    // errata -> v1.1 OPUBLIKOWANA (zamrożona); v1.0 nietknięta.
    const errata = await createErrataVersion({
      organizationId: ORG,
      meetingId: MEETING_FULL,
      actorId: CHAIR,
      errataNote: 'Corrected the owner of action one.',
    });
    expect(errata.version).toBe('1.1');
    expect(errata.status).toBe('approved');
    expect(errata.errataNote).toBe('Corrected the owner of action one.');

    // v1.0 wciąż approved, bajt-identyczna z chwilą akceptu.
    const rows = await sharedPool!.query(
      `SELECT version, status, content_json, source_digest FROM meeting_protocols
       WHERE organization_id=$1 AND meeting_id=$2 ORDER BY version`,
      [ORG, MEETING_FULL]
    );
    const v10 = rows.rows.find((r) => r.version === '1.0');
    const v11 = rows.rows.find((r) => r.version === '1.1');
    expect(v10?.status).toBe('approved');
    expect(v11?.status).toBe('approved');
    expect(v10?.source_digest).toBe(frozenDigest);
    expect(JSON.parse(v10!.content_json).blocks.length).toBe(approved.content.blocks.length);
    expect(JSON.stringify(JSON.parse(v10!.content_json).blocks)).toBe(frozenContent);
    expect(nextProtocolVersion('1.0')).toBe('1.1');
    expect(nextProtocolVersion('1.9')).toBe('1.10');
  });

  guard('B9 W109b: published v1.0 is a frozen snapshot; the working view reads LIVE source', async () => {
    // (1) publikacja v1.0 z żywych źródeł.
    const published = await approveProtocol({
      organizationId: ORG,
      meetingId: MEETING_LIVE,
      actorId: CHAIR,
    });
    expect(published.version).toBe('1.0');
    const snapshotV10 = await getPublishedProtocol({
      organizationId: ORG,
      meetingId: MEETING_LIVE,
      version: '1.0',
    });
    expect(snapshotV10).not.toBeNull();
    const frozenJson = JSON.stringify(snapshotV10!.content);
    const statementOf = (blocks: ProtocolBlock[]): string | null => {
      const dec = blocks.find((b) => b.kind === 'decisions');
      return dec?.kind === 'decisions' && dec.items[0] ? dec.items[0].statement : null;
    };
    expect(statementOf(snapshotV10!.content.blocks)).toBe('Adopt the original plan');

    // (2) edycja ŹRÓDŁA po publikacji.
    await sharedPool!.query(
      `UPDATE meeting_decisions SET statement = $1 WHERE id = $2`,
      ['Adopt the REVISED plan', DECISION_LIVE]
    );

    // (i) migawka v1.0 bez zmian — bajt w bajt, stara treść.
    const stillFrozen = await getPublishedProtocol({
      organizationId: ORG,
      meetingId: MEETING_LIVE,
      version: '1.0',
    });
    expect(JSON.stringify(stillFrozen!.content)).toBe(frozenJson);
    expect(statementOf(stillFrozen!.content.blocks)).toBe('Adopt the original plan');

    // (ii) widok roboczy czyta ŹRÓDŁO — pokazuje NOWĄ treść.
    // MUTACJA: gdyby previewProtocol zwracał content_json zamiast składać żywo,
    // ta asercja (i `version`/`publishedVersion` niżej) byłaby RED.
    const working = await previewProtocol({ organizationId: ORG, meetingId: MEETING_LIVE });
    expect(statementOf(working.content.blocks)).toBe('Adopt the REVISED plan');
    expect(working.persisted).toBe(false);
    expect(working.status).toBe('draft');
    expect(working.publishedVersion).toBe('1.0');
    expect(working.version).toBe('1.1');

    // (iii) ponowna publikacja tworzy v1.1 (zamrożona, NOWA treść); v1.0 nietknięta.
    const v11 = await createErrataVersion({
      organizationId: ORG,
      meetingId: MEETING_LIVE,
      actorId: CHAIR,
      errataNote: 'Revised the decision after the meeting.',
    });
    expect(v11.version).toBe('1.1');
    expect(v11.status).toBe('approved');
    expect(statementOf(v11.content.blocks)).toBe('Adopt the REVISED plan');
    const v10After = await getPublishedProtocol({
      organizationId: ORG,
      meetingId: MEETING_LIVE,
      version: '1.0',
    });
    expect(JSON.stringify(v10After!.content)).toBe(frozenJson);
    expect(statementOf(v10After!.content.blocks)).toBe('Adopt the original plan');
  });

  // ---- (C) realne dane z kopii dumpu ----
  guard('C1 Northwind "Weekly PMO Review" protocol has >=1 decision and >=1 action from real data', async () => {
    const found = await sharedPool!.query(
      `SELECT id, organization_id FROM meetings WHERE title = 'Weekly PMO Review' LIMIT 1`
    );
    if (!found.rows[0]) {
      // eslint-disable-next-line no-console
      console.warn(
        '[MTG-2a pg] C1 SKIPPED: no "Weekly PMO Review" meeting in this database — run against the staging dump copy.'
      );
      return;
    }
    const { id, organization_id } = found.rows[0];
    const content = await buildProtocolContent({ organizationId: organization_id, meetingId: id });
    const dec = content.blocks.find((b) => b.kind === 'decisions');
    const act = content.blocks.find((b) => b.kind === 'actions');
    const att = content.blocks.find((b) => b.kind === 'attendance');
    expect(dec?.kind === 'decisions' ? dec.items.length : 0).toBeGreaterThanOrEqual(1);
    expect(act?.kind === 'actions' ? act.items.length : 0).toBeGreaterThanOrEqual(1);
    expect(att?.kind === 'attendance' ? att.accepted.length : 0).toBeGreaterThanOrEqual(1);
  });
});
