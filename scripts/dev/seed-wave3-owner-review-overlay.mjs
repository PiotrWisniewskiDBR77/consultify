#!/usr/bin/env node
/**
 * Local, append-only Wave 3 owner-review overlay for an existing organization.
 *
 * The overlay deliberately does not copy records from another tenant and does
 * not create or modify users, memberships, credentials, roles, or feature
 * flags. It owns only deterministic records listed below and can be rerun.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import pg from 'pg';

const COMMAND = process.argv[2] ?? 'readback';
const DATABASE_URL = process.env.DATABASE_URL ?? '';
const EXPECTED_DATABASE = process.env.WAVE3_OVERLAY_EXPECTED_DATABASE ?? '';
const ORGANIZATION_ID = process.env.WAVE3_OVERLAY_ORGANIZATION_ID ?? '';
const OWNER_ID = process.env.WAVE3_OVERLAY_OWNER_ID ?? '';
const MANIFEST_PATH = process.env.WAVE3_OVERLAY_MANIFEST ?? '';
const CONFIRM = process.env.WAVE3_OVERLAY_CONFIRM;
const FIXTURE_ID = 'W3-OWNER-REVIEW-OVERLAY-v1';

const ids = Object.freeze({
  project: 'w3-owner-overlay-project-v1',
  taskDue: 'w3-owner-overlay-task-due-v1',
  taskBlocked: 'w3-owner-overlay-task-blocked-v1',
  taskReview: 'w3-owner-overlay-task-review-v1',
  decision: 'w3-owner-overlay-decision-v1',
  interviewTemplate: 'w3-owner-overlay-interview-template-v1',
  interviewSession: 'w3-owner-overlay-interview-session-v1',
  interviewAssignment: 'w3-owner-overlay-interview-assignment-v1',
  interviewQuestion1: 'w3-owner-overlay-interview-question-1-v1',
  interviewQuestion2: 'w3-owner-overlay-interview-question-2-v1',
  interviewQuestion3: 'w3-owner-overlay-interview-question-3-v1',
});

function fail(message) {
  throw new Error(`[W3 owner overlay] BLOCKED: ${message}`);
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
    fail('database name does not exactly match WAVE3_OVERLAY_EXPECTED_DATABASE');
  }
  if (!ORGANIZATION_ID || !OWNER_ID) fail('organization and owner IDs are required');
  if (COMMAND === 'seed') {
    if (CONFIRM !== 'SEED_LOCAL_OWNER_REVIEW_OVERLAY') {
      fail('seed requires WAVE3_OVERLAY_CONFIRM=SEED_LOCAL_OWNER_REVIEW_OVERLAY');
    }
    if (!MANIFEST_PATH || !path.isAbsolute(MANIFEST_PATH) || existsSync(MANIFEST_PATH)) {
      fail('seed requires a new absolute WAVE3_OVERLAY_MANIFEST path');
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
            o.status AS organization_status,
            om.role AS membership_role, om.status AS membership_status
       FROM users u
       JOIN organizations o ON o.id=u.organization_id
       LEFT JOIN organization_members om
         ON om.organization_id=u.organization_id AND om.user_id=u.id
      WHERE u.id=$1 AND u.organization_id=$2`,
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
  return row;
}

async function readback() {
  const marker = await client.query(
    `SELECT fixture_id, ownership_nonce, database_name
       FROM wave3_owner_fixture_markers
      WHERE fixture_id=$1 AND database_name=current_database()`,
    [FIXTURE_ID]
  );
  const counts = await client.query(
    `SELECT
       (SELECT count(*)::int FROM projects WHERE id=$1 AND organization_id=$8) AS projects,
       (SELECT count(*)::int FROM tasks WHERE id=ANY($2) AND organization_id=$8 AND assignee_id=$9) AS tasks,
       (SELECT count(*)::int FROM decisions WHERE id=$3 AND organization_id=$8 AND decision_maker_id=$9) AS decisions,
       (SELECT count(*)::int FROM interview_library_templates WHERE id=$4 AND organization_id=$8) AS templates,
       (SELECT count(*)::int FROM interview_sessions WHERE id=$5 AND organization_id=$8 AND owner_id=$9) AS sessions,
       (SELECT count(*)::int FROM interview_assignments WHERE id=$6 AND organization_id=$8 AND assignee_user_id=$9) AS assignments,
       (SELECT count(*)::int FROM interview_questions WHERE id=ANY($7) AND organization_id=$8 AND session_id=$5) AS questions`,
    [
      ids.project,
      [ids.taskDue, ids.taskBlocked, ids.taskReview],
      ids.decision,
      ids.interviewTemplate,
      ids.interviewSession,
      ids.interviewAssignment,
      [ids.interviewQuestion1, ids.interviewQuestion2, ids.interviewQuestion3],
      ORGANIZATION_ID,
      OWNER_ID,
    ]
  );
  const expected = { projects: 1, tasks: 3, decisions: 1, templates: 1, sessions: 1, assignments: 1, questions: 3 };
  const actual = counts.rows[0] ?? {};
  for (const [key, value] of Object.entries(expected)) {
    if (Number(actual[key]) !== value) fail(`readback mismatch for ${key}: ${actual[key]} != ${value}`);
  }
  if (marker.rowCount !== 1 || !marker.rows[0].ownership_nonce) fail('durable ownership marker missing');
  return {
    schema: 'W3-OWNER-REVIEW-OVERLAY-MANIFEST-v1',
    fixtureId: FIXTURE_ID,
    ownershipState: 'FINAL',
    databaseName,
    organizationId: ORGANIZATION_ID,
    ownerId: OWNER_ID,
    marker: marker.rows[0],
    ids,
    readback: actual,
    deepLinks: { myWork: '/my-work', interview: '/interview' },
    deepLinksVerified: false,
    safety: {
      localLoopbackOnly: true,
      tenantCopying: false,
      usersOrMembershipsMutated: false,
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
         VALUES($1,$2,current_database()) ON CONFLICT(fixture_id) DO NOTHING`,
        [FIXTURE_ID, randomBytes(32).toString('hex')]
      );
      const markerDb = await client.query(
        `SELECT database_name FROM wave3_owner_fixture_markers WHERE fixture_id=$1`,
        [FIXTURE_ID]
      );
      if (markerDb.rows[0]?.database_name !== databaseName) fail('ownership marker belongs to another database');

      await client.query(
        `INSERT INTO projects(id,organization_id,name,description,status,owner_id,priority,phase)
         VALUES($1,$2,$3,$4,'active',$5,'high','execution')
         ON CONFLICT(id) DO UPDATE SET
           name=excluded.name, description=excluded.description, owner_id=excluded.owner_id,
           updated_at=CURRENT_TIMESTAMP`,
        [ids.project, ORGANIZATION_ID, 'Owner Review — Final MVP', 'Kontrolowany lokalny zestaw danych do odbioru Wave 3.', OWNER_ID]
      );

      const tasks = [
        [ids.taskDue, 'Zatwierdzić kryteria gotowości finalnego MVP', 'todo', 'high', '2026-08-24T10:00:00+02:00', null],
        [ids.taskBlocked, 'Połączyć wynik assessmentu z inicjatywą', 'blocked', 'high', '2026-08-23T17:00:00+02:00', 'Brakuje zatwierdzonego targetu w matrycy.'],
        [ids.taskReview, 'Zweryfikować komplet dowodów przed odbiorem', 'in_progress', 'medium', '2026-08-27T12:00:00+02:00', null],
      ];
      for (const [id, title, status, priority, dueDate, blockedReason] of tasks) {
        await client.query(
          `INSERT INTO tasks
             (id,project_id,organization_id,title,description,status,priority,assignee_id,
              reporter_id,owner_id,due_date,blocked_reason,task_type,source,source_type,
              idempotency_key,created_by,expected_outcome,acceptance_criteria)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,$8,$9,$10,'task','owner_review',
                  'wave3_owner_overlay',$11,$8,$12,$13)
           ON CONFLICT(id) DO UPDATE SET
             title=excluded.title, description=excluded.description, status=excluded.status,
             priority=excluded.priority, assignee_id=excluded.assignee_id,
             reporter_id=excluded.reporter_id, owner_id=excluded.owner_id,
             due_date=excluded.due_date, blocked_reason=excluded.blocked_reason,
             expected_outcome=excluded.expected_outcome,
             acceptance_criteria=excluded.acceptance_criteria, updated_at=CURRENT_TIMESTAMP`,
          [id, ids.project, ORGANIZATION_ID, title, 'Dane syntetyczne wyłącznie do lokalnego odbioru właścicielskiego.', status, priority, OWNER_ID, dueDate, blockedReason, `w3-owner-overlay:${id}`, 'Widoczny i audytowalny wynik pracy.', 'Wynik, właściciel, termin i dowód są jednoznaczne.']
        );
      }

      await client.query(
        `INSERT INTO decisions
           (id,organization_id,project_id,task_id,title,type,decision_maker_id,decision_owner_id,
            created_by,status,priority,description,deadline,source_type,source_id,
            idempotency_key,required_fields_status,workflow_status)
         VALUES($1,$2,$3,$4,$5,'APPROVAL',$6,$6,$6,'pending','HIGH',$7,
                '2026-08-25T12:00:00+02:00','wave3_owner_overlay',$4,$8,'complete','proposed')
         ON CONFLICT(id) DO UPDATE SET
           title=excluded.title, decision_maker_id=excluded.decision_maker_id,
           decision_owner_id=excluded.decision_owner_id, created_by=excluded.created_by,
           status=excluded.status, priority=excluded.priority,
           description=excluded.description, deadline=excluded.deadline,
           updated_at=CURRENT_TIMESTAMP`,
        [ids.decision, ORGANIZATION_ID, ids.project, ids.taskBlocked, 'Czy target assessmentu jest gotowy do materializacji?', OWNER_ID, 'Decyzja odblokowuje przejście z oceny do inicjatywy.', `w3-owner-overlay:${ids.decision}`]
      );

      const questions = [
        [ids.interviewQuestion1, 'process', 'Po czym poznajesz, że przekazanie klienta do wdrożenia jest gotowe?', 'Nie mamy jeszcze jednej definicji gotowości; zakres i właściciel bywają potwierdzane osobno.'],
        [ids.interviewQuestion2, 'risk', 'Jaki ostatni przypadek najlepiej pokazuje koszt niepełnego przekazania?', 'Brak właściciela danych przesunął uruchomienie pilota o dziewięć dni.'],
        [ids.interviewQuestion3, 'improvement', 'Jaką jedną zmianę wdrożyłbyś najpierw?', 'Jedną bramkę gotowości z właścicielem, pięcioma wymaganymi polami i decyzją gotowe albo zwrot.'],
      ];
      await client.query(
        `INSERT INTO interview_library_templates
           (id,organization_id,name,description,category,area,questions_json,is_active,
            version,created_by,status,visibility,area_tags,audience,
            estimated_time_minutes,language,runtime_mode_default,template_scope)
         VALUES($1,$2,$3,$4,'operations','customer-handoff',$5,true,1,$6,
                'published','org',$7,$8,12,'pl','one_question_per_screen','organization')
         ON CONFLICT(id) DO UPDATE SET
           name=excluded.name, description=excluded.description,
           questions_json=excluded.questions_json, is_active=true,
           status='published', updated_at=CURRENT_TIMESTAMP`,
        [ids.interviewTemplate, ORGANIZATION_ID, 'Diagnoza jakości przekazania klienta', 'Wywiad operacyjny z odpowiedziami i dowodami do odbioru właścicielskiego.', JSON.stringify(questions.map(([id, category, text], index) => ({ id, category, questionText: text, isRequired: true, sortOrder: index + 1 }))), OWNER_ID, JSON.stringify(['operations', 'handoff']), 'Lider sprzedaży i lider wdrożenia']
      );
      await client.query(
        `INSERT INTO interview_sessions
           (id,organization_id,project_id,name,owner_id,status,total_questions,
            answered_questions,template_id,template_version,assignment_id,
            is_anonymous,anonymity_mode,runtime_mode_default,summary_facts,
            summary_gaps,summary_constraints,summary_pain_points)
         VALUES($1,$2,$3,$4,$5,'submitted',3,3,$6,1,$7,false,'identified',
                'single_question',$8,$9,$10,$11)
         ON CONFLICT(id) DO UPDATE SET
           name=excluded.name, owner_id=excluded.owner_id, status='submitted',
           total_questions=3, answered_questions=3, template_id=excluded.template_id,
           assignment_id=excluded.assignment_id, summary_facts=excluded.summary_facts,
           summary_gaps=excluded.summary_gaps,
           summary_constraints=excluded.summary_constraints,
           summary_pain_points=excluded.summary_pain_points,
           updated_at=CURRENT_TIMESTAMP`,
        [ids.interviewSession, ORGANIZATION_ID, ids.project, 'Przekazanie klienta — odpowiedzi do decyzji', OWNER_ID, ids.interviewTemplate, ids.interviewAssignment, JSON.stringify(['Zakres i właściciel są sprawdzane, lecz bez wspólnej bramki.']), JSON.stringify(['Brak jednolitej definicji gotowości.']), JSON.stringify(['Rozproszone informacje wejściowe.']), JSON.stringify(['Opóźnienia startu i poprawki po przekazaniu.'])]
      );
      await client.query(
        `INSERT INTO interview_assignments
           (id,organization_id,assignee_user_id,template_id,template_version,status,
            session_id,project_id,due_at,started_at,submitted_at,created_by,
            priority,notes,is_anonymous)
         VALUES($1,$2,$3,$4,1,'submitted',$5,$6,'2026-08-30T12:00:00+02:00',
                CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,$3,'high',$7,false)
         ON CONFLICT(id) DO UPDATE SET
           assignee_user_id=excluded.assignee_user_id, status='submitted',
           session_id=excluded.session_id, project_id=excluded.project_id,
           submitted_at=COALESCE(interview_assignments.submitted_at,CURRENT_TIMESTAMP),
           updated_at=CURRENT_TIMESTAMP`,
        [ids.interviewAssignment, ORGANIZATION_ID, OWNER_ID, ids.interviewTemplate, ids.interviewSession, ids.project, 'Syntetyczny przypadek odbiorowy Wave 3.']
      );
      for (let index = 0; index < questions.length; index += 1) {
        const [id, category, questionText, answerText] = questions[index];
        await client.query(
          `INSERT INTO interview_questions
             (id,session_id,organization_id,category,question_text,answer_text,status,
              confidence_score,answered_by,answered_at,sort_order,is_required,
              evidence_prompt,allow_context_note,allow_file_upload,allow_url,
              allow_voice,answer_mode,answer_type,description,example_answer,guidance)
           VALUES($1,$2,$3,$4,$5,$6,'answered',85,$7,CURRENT_TIMESTAMP,$8,1,
                  $9,1,1,1,1,'text','open',$10,$11,$12)
           ON CONFLICT(id) DO UPDATE SET
             question_text=excluded.question_text, answer_text=excluded.answer_text,
             status='answered', confidence_score=85, answered_by=excluded.answered_by,
             answered_at=CURRENT_TIMESTAMP, description=excluded.description,
             example_answer=excluded.example_answer, guidance=excluded.guidance,
             updated_at=CURRENT_TIMESTAMP`,
          [id, ids.interviewSession, ORGANIZATION_ID, category, questionText, answerText, OWNER_ID, index + 1, 'Dołącz przykład, dokument, KPI lub obserwację potwierdzającą odpowiedź.', 'Pytanie dotyczy faktycznego sposobu pracy, nie deklarowanej procedury.', answerText, 'Odpowiedz konkretnie, wskaż ostatni przypadek i źródło dowodu.']
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    const receipt = await readback();
    writeFileSync(MANIFEST_PATH, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
    console.log(JSON.stringify(receipt, null, 2));
  }
} finally {
  await client.end();
}
