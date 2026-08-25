#!/usr/bin/env node
/**
 * MYW-PHOTO-001 data gate — companion overlay for My Work.
 *
 * Extends the recovered `seed-wave3-owner-review-overlay.mjs` fixture family
 * (same active-tenant/append-only/idempotent contract) with the entities the
 * "minimum nonempty replay fixture" for My Work still needs: a Done task, a
 * personal idea, a notebook page, an approved decision, and a decision that a
 * MEMBER (not the OWNER) rejected — plus a direct re-materialization of
 * `canonical_inbox_items` so the Inbox tab is nonempty on the very first cold
 * load (mirrors server/src/services/inboxService.ts materializeInboxItems,
 * without importing the TS server at runtime).
 *
 * Like its sibling, this script:
 *  - only targets a loopback PostgreSQL database whose name matches exactly;
 *  - never copies data from another tenant;
 *  - is append-only/idempotent (safe to rerun; ON CONFLICT upserts only);
 *  - does not touch feature flags and never deletes anything.
 *
 * Exception to "no user/membership mutation": the fixture requires proving a
 * decision a MEMBER (not the OWNER) rejected, and the target organization
 * currently has no MEMBER-role member. This script creates exactly one
 * synthetic MEMBER identity, following the SAME naming convention as the
 * organization's existing dev_admin_ and dev_owner_ synthetic accounts
 * (this whole organization is synthetic dev fixture data), with a fixed
 * deterministic id so the insert is a no-op on rerun.
 */
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import pg from 'pg';

const COMMAND = process.argv[2] ?? 'readback';
const DATABASE_URL = process.env.DATABASE_URL ?? '';
const EXPECTED_DATABASE = process.env.MYW_DATAGATE_EXPECTED_DATABASE ?? '';
const ORGANIZATION_ID = process.env.MYW_DATAGATE_ORGANIZATION_ID ?? '';
const OWNER_ID = process.env.MYW_DATAGATE_OWNER_ID ?? '';
const MANIFEST_PATH = process.env.MYW_DATAGATE_MANIFEST ?? '';
const CONFIRM = process.env.MYW_DATAGATE_CONFIRM;
const FIXTURE_ID = 'W3-MY-WORK-DATA-GATE-v1';

const ids = Object.freeze({
  project: 'w3-myw-datagate-project-v1',
  taskDone: 'w3-myw-datagate-task-done-v1',
  idea: 'w3-myw-datagate-idea-v1',
  notebook: 'w3-myw-datagate-notebook-container-v1',
  notebookPage: 'w3-myw-datagate-notebook-v1',
  decisionApproved: 'w3-myw-datagate-decision-approved-v1',
  decisionRejected: 'w3-myw-datagate-decision-rejected-v1',
  memberUser: 'dev_member_myw_datagate_v1',
  memberMembership: 'myw-datagate-membership-v1',
});

// Existing overlay entities this script assumes are already present
// (created by scripts/dev/seed-wave3-owner-review-overlay.mjs) so the
// materialize step can see the full My Work picture. If they are absent the
// materialize step simply finds fewer source rows — it never fails.
const existingOverlayTaskIds = Object.freeze([
  'w3-owner-overlay-task-due-v1',
  'w3-owner-overlay-task-blocked-v1',
  'w3-owner-overlay-task-review-v1',
]);

function fail(message) {
  throw new Error(`[MYW data gate] BLOCKED: ${message}`);
}

function qualify() {
  if (!['seed', 'readback'].includes(COMMAND)) fail(`unsupported command ${COMMAND}`);
  if (!DATABASE_URL) fail('DATABASE_URL is required');
  let url;
  try {
    url = new URL(DATABASE_URL);
  } catch {
    fail('DATABASE_URL is invalid');
  }
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    fail('loopback PostgreSQL is required');
  }
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (!EXPECTED_DATABASE || databaseName !== EXPECTED_DATABASE) {
    fail('database name does not exactly match MYW_DATAGATE_EXPECTED_DATABASE');
  }
  if (!ORGANIZATION_ID || !OWNER_ID) fail('organization and owner IDs are required');
  if (COMMAND === 'seed') {
    if (CONFIRM !== 'SEED_LOCAL_MY_WORK_DATA_GATE') {
      fail('seed requires MYW_DATAGATE_CONFIRM=SEED_LOCAL_MY_WORK_DATA_GATE');
    }
    if (!MANIFEST_PATH || !path.isAbsolute(MANIFEST_PATH) || existsSync(MANIFEST_PATH)) {
      fail('seed requires a new absolute MYW_DATAGATE_MANIFEST path');
    }
  }
  return databaseName;
}

const databaseName = qualify();
const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

async function verifyIdentity() {
  const result = await client.query(
    `SELECT u.id, u.organization_id, u.role, u.status,
            o.status AS organization_status
       FROM users u
       JOIN organizations o ON o.id = u.organization_id
      WHERE u.id = $1 AND u.organization_id = $2`,
    [OWNER_ID, ORGANIZATION_ID]
  );
  const row = result.rows[0];
  if (!row) fail('owner identity does not exist in the requested organization');
  if (String(row.role).toUpperCase() !== 'OWNER' || String(row.status).toLowerCase() !== 'active') {
    fail('requested user is not an active OWNER');
  }
  if (String(row.organization_status).toLowerCase() !== 'active') {
    fail('requested organization is not active');
  }
}

// Mirrors server/src/services/inboxService.ts::sectionForTask exactly.
function sectionForTask(status, dueDate, today, isBlocked) {
  if (isBlocked) return 'blocked_escalations';
  const s = (status || '').toLowerCase();
  if (s === 'done' || s === 'completed' || s === 'validated') return 'assigned_tasks';
  if (dueDate && dueDate < today) return 'overdue_sla_breach';
  return 'assigned_tasks';
}

function priorityForItem(raw) {
  const p = (raw || '').toLowerCase();
  if (p === 'urgent' || p === 'critical') return 'critical';
  if (p === 'high') return 'high';
  if (p === 'low') return 'low';
  return 'normal';
}

async function materializeOwnerInbox() {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  const tasks = await client.query(
    `SELECT id, title, description, status, priority, due_date, initiative_id,
            blocked_reason, blocked_by_decision_id
       FROM tasks
      WHERE organization_id = $1
        AND assignee_id = $2
        AND lower(coalesce(status,'')) NOT IN ('done','completed','validated')`,
    [ORGANIZATION_ID, OWNER_ID]
  );
  const decisions = await client.query(
    `SELECT id, title, description, type, priority, deadline, status, initiative_id
       FROM decisions
      WHERE organization_id = $1
        AND decision_maker_id = $2
        AND lower(coalesce(status,'')) IN ('pending','escalated')`,
    [ORGANIZATION_ID, OWNER_ID]
  );

  const upsert = async (row) => {
    await client.query(
      `INSERT INTO canonical_inbox_items
         (user_id, organization_id, item_type, source_entity_type, source_entity_id,
          title, description, priority, section, status, sla_deadline, source_status,
          initiative_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,$12,$13,$13)
       ON CONFLICT (user_id, source_entity_type, source_entity_id) DO UPDATE SET
         title = excluded.title,
         description = excluded.description,
         priority = excluded.priority,
         section = excluded.section,
         sla_deadline = excluded.sla_deadline,
         source_status = excluded.source_status,
         initiative_id = excluded.initiative_id,
         updated_at = excluded.updated_at`,
      row
    );
  };

  let upserted = 0;
  for (const t of tasks.rows) {
    const isBlocked = !!(t.blocked_reason || t.blocked_by_decision_id);
    const section = sectionForTask(t.status, t.due_date ? String(t.due_date).slice(0, 10) : null, today, isBlocked);
    await upsert([
      OWNER_ID,
      ORGANIZATION_ID,
      'task',
      'task',
      t.id,
      t.title,
      t.description || null,
      priorityForItem(t.priority),
      section,
      t.due_date || null,
      t.status || null,
      t.initiative_id || null,
      now,
    ]);
    upserted += 1;
  }
  for (const d of decisions.rows) {
    const itemType = (d.type || '').toUpperCase().includes('APPROVAL') ? 'approval' : 'decision';
    const section = itemType === 'approval' ? 'approvals_gates' : 'decisions_required';
    await upsert([
      OWNER_ID,
      ORGANIZATION_ID,
      itemType,
      'decision',
      d.id,
      d.title,
      d.description || null,
      priorityForItem(d.priority),
      section,
      d.deadline || null,
      d.status || null,
      d.initiative_id || null,
      now,
    ]);
    upserted += 1;
  }
  return { upserted, tasksSeen: tasks.rowCount, decisionsSeen: decisions.rowCount };
}

async function readback() {
  const marker = await client.query(
    `SELECT fixture_id, ownership_nonce, database_name
       FROM wave3_owner_fixture_markers
      WHERE fixture_id = $1 AND database_name = current_database()`,
    [FIXTURE_ID]
  );
  const counts = await client.query(
    `SELECT
       (SELECT count(*)::int FROM tasks WHERE id=$1 AND organization_id=$8 AND status='done') AS task_done,
       (SELECT count(*)::int FROM my_ideas WHERE id=$2 AND organization_id=$8 AND user_id=$9) AS ideas,
       (SELECT count(*)::int FROM notebook_pages WHERE id=$3 AND organization_id=$8 AND owner_user_id=$9 AND notebook_id IS NOT NULL) AS notebook_pages,
       (SELECT count(*)::int FROM decisions WHERE id=$4 AND organization_id=$8 AND status='approved') AS decision_approved,
       (SELECT count(*)::int FROM decisions WHERE id=$5 AND organization_id=$8 AND status='rejected' AND decision_maker_id=$6) AS decision_rejected_by_member,
       (SELECT count(*)::int FROM users WHERE id=$6 AND organization_id=$8 AND role='MEMBER') AS member_user,
       (SELECT count(*)::int FROM organization_members WHERE id=$7 AND organization_id=$8 AND user_id=$6 AND role='MEMBER') AS member_membership,
       (SELECT count(*)::int FROM canonical_inbox_items WHERE organization_id=$8 AND user_id=$9) AS inbox_items`,
    [
      ids.taskDone,
      ids.idea,
      ids.notebookPage,
      ids.decisionApproved,
      ids.decisionRejected,
      ids.memberUser,
      ids.memberMembership,
      ORGANIZATION_ID,
      OWNER_ID,
    ]
  );
  const expected = {
    task_done: 1,
    ideas: 1,
    notebook_pages: 1,
    decision_approved: 1,
    decision_rejected_by_member: 1,
    member_user: 1,
    member_membership: 1,
  };
  const actual = counts.rows[0] ?? {};
  for (const [key, value] of Object.entries(expected)) {
    if (Number(actual[key]) !== value) fail(`readback mismatch for ${key}: ${actual[key]} != ${value}`);
  }
  if (Number(actual.inbox_items) < 1) fail('canonical inbox is still empty for the owner');
  if (marker.rowCount !== 1 || !marker.rows[0].ownership_nonce) fail('durable ownership marker missing');
  return {
    schema: 'W3-MY-WORK-DATA-GATE-MANIFEST-v1',
    fixtureId: FIXTURE_ID,
    ownershipState: 'FINAL',
    databaseName,
    organizationId: ORGANIZATION_ID,
    ownerId: OWNER_ID,
    marker: marker.rows[0],
    ids,
    readback: actual,
    deepLinks: { myWork: '/my-work' },
    safety: {
      localLoopbackOnly: true,
      tenantCopying: false,
      usersOrMembershipsMutated: true,
      usersOrMembershipsMutatedReason:
        'exactly one synthetic MEMBER identity created to prove a decision a MEMBER (not the OWNER) rejected; naming convention matches the organization\'s existing dev_* synthetic accounts',
      featureFlagsMutated: false,
      deletions: false,
    },
  };
}

try {
  await verifyIdentity();
  if (COMMAND === 'readback') {
    console.log(JSON.stringify(await readback(), null, 2));
  } else {
    await client.query('BEGIN');
    try {
      await client.query(`CREATE TABLE IF NOT EXISTS wave3_owner_fixture_markers(
        fixture_id text PRIMARY KEY,
        ownership_nonce text NOT NULL,
        database_name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
      await client.query(
        `INSERT INTO wave3_owner_fixture_markers(fixture_id,ownership_nonce,database_name)
         VALUES($1, encode(gen_random_bytes(32),'hex'), current_database())
         ON CONFLICT(fixture_id) DO NOTHING`,
        [FIXTURE_ID]
      );

      await client.query(
        `INSERT INTO projects(id,organization_id,name,description,status,owner_id,priority,phase)
         VALUES($1,$2,$3,$4,'active',$5,'medium','execution')
         ON CONFLICT(id) DO UPDATE SET
           name=excluded.name, description=excluded.description, updated_at=CURRENT_TIMESTAMP`,
        [ids.project, ORGANIZATION_ID, 'My Work — dowody bramki danych', 'Projekt nośny dla dodatkowych dowodów My Work (Done, Idea, Notatnik, decyzje).', OWNER_ID]
      );

      // 1) Done task — proves the Tasks tab renders a completed item, and
      // that materialize correctly EXCLUDES it from the Inbox (matches
      // server/src/services/inboxService.ts semantics: done tasks are not
      // inbox-eligible).
      await client.query(
        `INSERT INTO tasks
           (id,project_id,organization_id,title,description,status,priority,assignee_id,
            reporter_id,owner_id,due_date,task_type,source,source_type,
            idempotency_key,created_by,expected_outcome,acceptance_criteria)
         VALUES($1,$2,$3,$4,$5,'done','medium',$6,$6,$6,$7,'task','owner_review',
                'wave3_owner_overlay',$8,$6,$9,$10)
         ON CONFLICT(id) DO UPDATE SET
           title=excluded.title, status='done', updated_at=CURRENT_TIMESTAMP`,
        [
          ids.taskDone,
          ids.project,
          ORGANIZATION_ID,
          'Potwierdzić zamknięcie przeglądu Fali 2',
          'Zadanie syntetyczne wyłącznie do lokalnego odbioru właścicielskiego.',
          OWNER_ID,
          '2026-08-20T09:00:00+02:00',
          `myw-datagate:${ids.taskDone}`,
          'Widoczny dowód zamkniętego zadania w zakładce Tasks.',
          'Status Done, właściciel i termin są jednoznaczne.',
        ]
      );

      // 2) Idea (My Work → Ideas tab; my_ideas is user-scoped)
      await client.query(
        `INSERT INTO my_ideas
           (id,user_id,organization_id,title,body,tags,source_type,stage,area,priority,confidentiality)
         VALUES($1,$2,$3,$4,$5,$6,'owner_review','shaping',$7,70,'standard')
         ON CONFLICT(id) DO UPDATE SET
           title=excluded.title, body=excluded.body, tags=excluded.tags,
           stage=excluded.stage, area=excluded.area, updated_at=CURRENT_TIMESTAMP`,
        [
          ids.idea,
          OWNER_ID,
          ORGANIZATION_ID,
          'Jedna bramka gotowości do przekazania klienta',
          'Ujednolicić kryteria przekazania: zakres, właściciel, pięć wymaganych pól i jednoznaczna decyzja gotowe/zwrot — zamiast rozproszonych potwierdzeń.',
          JSON.stringify(['handoff', 'gotowosc', 'owner-review']),
          'Operacje / Wdrożenie',
        ]
      );

      // 3) Notebook page (My Work → Notebook tab)
      const contentText =
        'Notatka z przeglądu właścicielskiego Fali 2.\n\nCo działa: zadania i decyzje właściciela są widoczne po zalogowaniu.\nCo domykamy: idea, notatnik i inbox w tym samym najemcy — bez zer.\nNastępny krok: dowód na żywym runtime, zrzuty każdej zakładki.';
      const contentJson = JSON.stringify({
        type: 'doc',
        content: contentText.split('\n\n').map((paragraph) => ({
          type: 'paragraph',
          content: [{ type: 'text', text: paragraph }],
        })),
      });
      // 3a) Parent notebook container (L1) — notebook_pages (L3) only appear
      // under the Notebook tab's list when bound to one via notebook_id.
      await client.query(
        `INSERT INTO notebooks(id,owner_user_id,organization_id,title,icon,scope,context_sharing)
         VALUES($1,$2,$3,$4,'📒','personal','private')
         ON CONFLICT(id) DO UPDATE SET title=excluded.title, updated_at=CURRENT_TIMESTAMP`,
        [ids.notebook, OWNER_ID, ORGANIZATION_ID, 'Przegląd właścicielski — Fala 2']
      );
      await client.query(
        `INSERT INTO notebook_pages
           (id,owner_user_id,organization_id,project_id,notebook_id,visibility,title,content_json,
            content_text,tags_json,status,maturity,pinned,capture_source)
         VALUES($1,$2,$3,$4,$5,'private',$6,$7,$8,$9,'active','actionable',0,'manual')
         ON CONFLICT(id) DO UPDATE SET
           title=excluded.title, content_json=excluded.content_json,
           content_text=excluded.content_text, tags_json=excluded.tags_json,
           notebook_id=excluded.notebook_id, updated_at=CURRENT_TIMESTAMP`,
        [
          ids.notebookPage,
          OWNER_ID,
          ORGANIZATION_ID,
          ids.project,
          ids.notebook,
          'Przegląd właścicielski — Fala 2 (bramka danych My Work)',
          contentJson,
          contentText,
          JSON.stringify(['owner-review', 'my-work', 'fala-2']),
        ]
      );

      // 4) Approved decision — decided by the OWNER himself.
      await client.query(
        `INSERT INTO decisions
           (id,organization_id,project_id,title,type,decision_maker_id,decision_owner_id,
            created_by,status,priority,description,deadline,decided_at,decided_by,
            decision_rationale,source_type,source_id,idempotency_key,
            required_fields_status,workflow_status)
         VALUES($1,$2,$3,$4,'APPROVAL',$5,$5,$5,'approved','MEDIUM',$6,
                '2026-08-22T12:00:00+02:00','2026-08-22T14:00:00+02:00',$5,
                $7,'wave3_owner_overlay',$1,$8,'complete','decided')
         ON CONFLICT(id) DO UPDATE SET
           status='approved', decided_at=excluded.decided_at, decided_by=excluded.decided_by,
           decision_rationale=excluded.decision_rationale, updated_at=CURRENT_TIMESTAMP`,
        [
          ids.decisionApproved,
          ORGANIZATION_ID,
          ids.project,
          'Czy przyjąć wynik przeglądu Fali 1 jako bazę?',
          OWNER_ID,
          'Baza jest kompletna i spójna z dowodami z 23.08.',
          'Zatwierdzone — brak rozbieżności między rejestrem a stanem runtime.',
          `myw-datagate:${ids.decisionApproved}`,
        ]
      );

      // 5) One synthetic MEMBER identity (see module docstring for why).
      await client.query(
        `INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status)
         VALUES($1,$2,$3,NULL,$4,$5,'MEMBER','active')
         ON CONFLICT(id) DO NOTHING`,
        [ids.memberUser, ORGANIZATION_ID, 'agnieszka.rybak@dbr77.com', 'Agnieszka', 'Rybak']
      );
      await client.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status)
         VALUES($1,$2,$3,'MEMBER','ACTIVE')
         ON CONFLICT(id) DO NOTHING`,
        [ids.memberMembership, ORGANIZATION_ID, ids.memberUser]
      );

      // 6) Decision REJECTED by the MEMBER (owner requested, member decides
      // and denies — proves "kto zgłasza a kto zatwierdza").
      await client.query(
        `INSERT INTO decisions
           (id,organization_id,project_id,title,type,decision_maker_id,decision_owner_id,
            created_by,status,priority,description,deadline,decided_at,decided_by,
            decision_rationale,source_type,source_id,idempotency_key,
            required_fields_status,workflow_status)
         VALUES($1,$2,$3,$4,'APPROVAL',$5,$5,$6,'rejected','HIGH',$7,
                '2026-08-21T12:00:00+02:00','2026-08-21T16:30:00+02:00',$5,
                $8,'wave3_owner_overlay',$1,$9,'complete','decided')
         ON CONFLICT(id) DO UPDATE SET
           status='rejected', decided_at=excluded.decided_at, decided_by=excluded.decided_by,
           decision_rationale=excluded.decision_rationale, updated_at=CURRENT_TIMESTAMP`,
        [
          ids.decisionRejected,
          ORGANIZATION_ID,
          ids.project,
          'Czy zamknąć bramkę zgodności bez brakującego dowodu SQL?',
          ids.memberUser,
          OWNER_ID,
          'Wniosek właściciela o przyspieszone zamknięcie przed kompletem dowodów.',
          'Odrzucone — brak dowodu SQL dla jednej z tabel; wniosek wraca do właściciela z listą braków.',
          `myw-datagate:${ids.decisionRejected}`,
        ]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    const materialized = await materializeOwnerInbox();
    const receipt = await readback();
    receipt.inboxMaterialization = materialized;
    writeFileSync(MANIFEST_PATH, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
    console.log(JSON.stringify(receipt, null, 2));
  }
} finally {
  await client.end();
}
