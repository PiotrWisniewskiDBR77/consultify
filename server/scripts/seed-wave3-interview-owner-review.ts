#!/usr/bin/env tsx
/**
 * Wave 3 local-only owner-review fixture for Interview.
 *
 * Creates two coherent states in an existing local organization:
 * - an anonymous public interview that Piotr can complete from a token-only link;
 * - a submitted manager-review interview with realistic answers.
 *
 * The fixture is intentionally durable during owner review. It never deletes
 * receipts or user data and refuses any non-loopback PostgreSQL target.
 */
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import pg from 'pg';

const CONFIRM_ENV = 'SEED_WAVE3_INTERVIEW_OWNER_REVIEW';
const command = process.argv[2] ?? 'seed';
const databaseUrl = process.env.DATABASE_URL ?? '';
const manifestPath = process.env.INTERVIEW_OWNER_FIXTURE_MANIFEST ?? '';
const fixtureId = 'W3-INTERVIEW-OWNER-v1';
const organizationId = process.env.WAVE3_ORGANIZATION_ID ?? 'fd1827ef-7e39-4c64-bf78-26a2c514adf1';
const ownerId = process.env.WAVE3_OWNER_ID ?? '0c13d1af-af67-4683-ad01-a3ea6fda2340';

if (!['seed', 'readback'].includes(command)) {
  throw new Error(`Unsupported command: ${command}`);
}
if (command === 'seed' && process.env[CONFIRM_ENV] !== 'YES') {
  throw new Error(`${CONFIRM_ENV}=YES is required`);
}
if (!/^postgres(?:ql)?:\/\/(?:[^@/]+@)?(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(databaseUrl)) {
  throw new Error('Wave 3 Interview fixture requires loopback PostgreSQL');
}
const databaseName = new URL(databaseUrl).pathname.slice(1);
if (!/^consultify_w3_interview_owner_[a-z0-9_]+$/.test(databaseName)) {
  throw new Error('Wave 3 Interview fixture requires an owned interview database');
}
if (command === 'seed') {
  if (!manifestPath || !path.isAbsolute(manifestPath) || fs.existsSync(manifestPath)) {
    throw new Error('INTERVIEW_OWNER_FIXTURE_MANIFEST must be a new absolute path');
  }
}

const ids = {
  template: 'wave3-int-owner-template-v1',
  publicSession: 'wave3-int-owner-public-session-v1',
  publicAssignment: 'wave3-int-owner-public-assignment-v1',
  publicDistribution: 'wave3-int-owner-public-distribution-v1',
  revokedDistribution: 'wave3-int-owner-revoked-distribution-v1',
  reviewSession: 'wave3-int-owner-review-session-v1',
  reviewAssignment: 'wave3-int-owner-review-assignment-v1',
} as const;

const tokenFor = (kind: string) =>
  createHash('sha256').update(`consultify-wave3-interview-owner-review-v1:${kind}`).digest('hex');
const publicToken = tokenFor('active');
const revokedToken = tokenFor('revoked');

const questions = [
  {
    id: 'handoff-definition',
    category: 'process',
    text: 'Po czym poznajesz, że przekazanie klienta ze sprzedaży do wdrożenia jest naprawdę gotowe?',
    answer:
      'Dziś nie mamy jednej definicji gotowości. Najczęściej sprawdzamy zakres, właściciela i termin startu, ale informacje są rozproszone.',
  },
  {
    id: 'handoff-failure',
    category: 'risk',
    text: 'Jaki ostatni przypadek najlepiej pokazuje koszt niepełnego przekazania?',
    answer:
      'W ostatnim kwartale zespół wdrożeniowy rozpoczął pracę bez potwierdzonego właściciela danych po stronie klienta. Start przesunął się o dziewięć dni.',
  },
  {
    id: 'handoff-change',
    category: 'improvement',
    text: 'Jaką jedną zmianę wdrożyłbyś najpierw, aby ograniczyć poprawki i opóźnienia?',
    answer:
      'Wprowadziłbym krótką bramkę gotowości z jednym właścicielem, pięcioma wymaganymi polami i jawną decyzją gotowe albo zwrot do uzupełnienia.',
  },
] as const;

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  const identity = await client.query<{
    organization_id: string;
    role: string;
  }>(`SELECT organization_id, role FROM users WHERE id=$1`, [ownerId]);
  if (identity.rows[0]?.organization_id !== organizationId) {
    throw new Error('Wave 3 owner does not belong to the requested organization');
  }

  const readback = async () => {
    const result = await client.query(
      `SELECT
         (SELECT count(*)::int FROM interview_sessions WHERE id IN ($1,$2)) AS sessions,
         (SELECT count(*)::int FROM interview_questions WHERE session_id IN ($1,$2)) AS questions,
         (SELECT count(*)::int FROM interview_distributions WHERE id IN ($3,$4)) AS distributions,
         (SELECT ownership_nonce FROM wave3_owner_fixture_markers WHERE fixture_id=$5) AS ownership_nonce`,
      [
        ids.publicSession,
        ids.reviewSession,
        ids.publicDistribution,
        ids.revokedDistribution,
        fixtureId,
      ]
    );
    const row = result.rows[0];
    if (
      Number(row.sessions) !== 2 ||
      Number(row.questions) !== 6 ||
      Number(row.distributions) !== 2 ||
      !row.ownership_nonce
    ) {
      throw new Error('Wave 3 Interview FINAL readback mismatch');
    }
    return row;
  };
  const receipt = (row: Record<string, unknown>) => ({
    fixture: fixtureId,
    fixtureId,
    ownershipState: 'FINAL',
    databaseName,
    ownershipNonce: row.ownership_nonce,
    marker: {
      table: 'wave3_owner_fixture_markers',
      fixtureId,
      ownershipNonce: row.ownership_nonce,
    },
    deepLink: '/interview',
    deepLinkVerified: false,
    organizationId,
    ownerId,
    ids,
    routes: {
      manager: '/interview',
      respondent: `/interview/respond/${publicToken}`,
      revoked: `/interview/respond/${revokedToken}`,
    },
    readback: row,
  });
  if (command === 'readback') {
    console.log(JSON.stringify(receipt(await readback()), null, 2));
    process.exitCode = 0;
  } else {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO interview_library_templates
       (id, organization_id, name, description, category, area, questions_json,
        is_active, version, created_by, status, visibility, area_tags, audience,
        estimated_time_minutes, language, runtime_mode_default, template_scope)
     VALUES ($1,$2,$3,$4,'strategy','operations',$5,TRUE,1,$6,'published','org',$7,$8,12,'pl','one_question_per_screen','organization')
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, description=excluded.description,
       questions_json=excluded.questions_json, updated_at=CURRENT_TIMESTAMP`,
      [
        ids.template,
        organizationId,
        'Diagnoza jakości przekazania klienta do wdrożenia',
        'Krótki wywiad dla osób uczestniczących w przekazaniu klienta między sprzedażą a wdrożeniem.',
        JSON.stringify(
          questions.map((question, index) => ({
            id: question.id,
            category: question.category,
            questionText: question.text,
            isRequired: true,
            sortOrder: index + 1,
          }))
        ),
        ownerId,
        JSON.stringify(['operations', 'customer-handoff']),
        'Dyrektor operacyjny, lider sprzedaży, lider wdrożenia',
      ]
    );

    for (const session of [
      {
        id: ids.publicSession,
        assignmentId: ids.publicAssignment,
        name: 'Odbiór właścicielski — respondent publiczny',
        status: 'in_progress',
        answered: 0,
        anonymous: true,
      },
      {
        id: ids.reviewSession,
        assignmentId: ids.reviewAssignment,
        name: 'Odbiór właścicielski — odpowiedzi do decyzji managera',
        status: 'submitted',
        answered: questions.length,
        anonymous: false,
      },
    ]) {
      await client.query(
        `INSERT INTO interview_sessions
         (id, organization_id, name, owner_id, status, total_questions,
          answered_questions, template_id, template_version, assignment_id,
          is_anonymous, anonymity_mode, runtime_mode_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,$9,$10,$11,'single_question')
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name,
         status=CASE WHEN excluded.status='in_progress' THEN interview_sessions.status ELSE excluded.status END,
         total_questions=excluded.total_questions,
         answered_questions=CASE WHEN excluded.status='in_progress' THEN interview_sessions.answered_questions ELSE excluded.answered_questions END,
         updated_at=CURRENT_TIMESTAMP`,
        [
          session.id,
          organizationId,
          session.name,
          ownerId,
          session.status,
          questions.length,
          session.answered,
          ids.template,
          session.assignmentId,
          session.anonymous,
          session.anonymous ? 'anonymous' : 'identified',
        ]
      );
      await client.query(
        `INSERT INTO interview_assignments
         (id, organization_id, assignee_user_id, template_id, template_version,
          status, session_id, due_at, submitted_at, created_by, priority,
          notes, is_anonymous)
       VALUES ($1,$2,$3,$4,1,$5,$6,CURRENT_TIMESTAMP+INTERVAL '7 days',$7,$3,'high',$8,$9)
       ON CONFLICT(id) DO UPDATE SET
         status=CASE WHEN excluded.status='in_progress' THEN interview_assignments.status ELSE excluded.status END,
         session_id=excluded.session_id,
         submitted_at=CASE WHEN excluded.status='in_progress' THEN interview_assignments.submitted_at ELSE excluded.submitted_at END,
         updated_at=CURRENT_TIMESTAMP`,
        [
          session.assignmentId,
          organizationId,
          ownerId,
          ids.template,
          session.status === 'submitted' ? 'submitted' : 'in_progress',
          session.id,
          session.status === 'submitted' ? new Date() : null,
          'Wave 3 owner review fixture — local only',
          session.anonymous,
        ]
      );
    }

    for (const [index, question] of questions.entries()) {
      for (const session of [
        { id: ids.publicSession, answered: false },
        { id: ids.reviewSession, answered: true },
      ]) {
        const questionId = `${session.id}-${question.id}`;
        await client.query(
          `INSERT INTO interview_questions
           (id, session_id, organization_id, category, question_text,
            answer_text, status, confidence_score, answered_by, answered_at,
            sort_order, is_required, description, guidance, expected_answer_shape)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,1,$12,$13,$14)
         ON CONFLICT(id) DO UPDATE SET
           question_text=excluded.question_text,
           answer_text=COALESCE(excluded.answer_text, interview_questions.answer_text),
           status=CASE WHEN excluded.answer_text IS NULL THEN interview_questions.status ELSE excluded.status END,
           updated_at=CURRENT_TIMESTAMP`,
          [
            questionId,
            session.id,
            organizationId,
            question.category,
            question.text,
            session.answered ? question.answer : null,
            session.answered ? 'answered' : 'pending',
            session.answered ? 4 : 0,
            session.answered ? ownerId : null,
            session.answered ? new Date() : null,
            index + 1,
            'Odpowiedz na podstawie konkretnego, niedawnego przykładu.',
            'Podaj fakt, skutek oraz osobę lub rolę odpowiedzialną.',
            'Krótka odpowiedź opisująca obecny sposób pracy i jego konsekwencję.',
          ]
        );
      }
    }

    await client.query(
      `INSERT INTO interview_distributions
       (id, organization_id, session_id, channel, recipient_email, recipient_name,
        public_token, status, anonymity_mode, expires_at)
     VALUES ($1,$2,$3,'link',NULL,NULL,$4,'pending','anonymous',CURRENT_TIMESTAMP+INTERVAL '30 days')
     ON CONFLICT(id) DO NOTHING`,
      [ids.publicDistribution, organizationId, ids.publicSession, publicToken]
    );
    await client.query(
      `INSERT INTO interview_distributions
       (id, organization_id, session_id, channel, recipient_email, recipient_name,
        public_token, status, anonymity_mode, expires_at, revoked_at, revoked_by)
     VALUES ($1,$2,$3,'link',NULL,NULL,$4,'revoked','anonymous',CURRENT_TIMESTAMP+INTERVAL '30 days',CURRENT_TIMESTAMP,$5)
     ON CONFLICT(id) DO UPDATE SET
       public_token=excluded.public_token, status='revoked',
       revoked_at=CURRENT_TIMESTAMP, revoked_by=excluded.revoked_by`,
      [ids.revokedDistribution, organizationId, ids.publicSession, revokedToken, ownerId]
    );

    const ownershipNonce = randomBytes(32).toString('hex');
    await client.query(`CREATE TABLE IF NOT EXISTS wave3_owner_fixture_markers(
    fixture_id text PRIMARY KEY, ownership_nonce text NOT NULL, database_name text NOT NULL)`);
    await client.query(
      `INSERT INTO wave3_owner_fixture_markers(fixture_id,ownership_nonce,database_name)
     VALUES($1,$2,current_database())`,
      [fixtureId, ownershipNonce]
    );

    await client.query('COMMIT');
    const payload = receipt(await readback());
    fs.writeFileSync(manifestPath, `${JSON.stringify(payload, null, 2)}\n`, {
      flag: 'wx',
      mode: 0o600,
    });
    if ((fs.statSync(manifestPath).mode & 0o777) !== 0o600)
      throw new Error('Interview manifest mode is not 0600');
    console.log(JSON.stringify(payload, null, 2));
  }
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
