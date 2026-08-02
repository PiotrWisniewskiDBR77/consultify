/**
 * INT-08 acceptance: real interview router + real candidate-handoff router +
 * real auth + local PostgreSQL. Covers the golden flow, idempotency,
 * concurrency, and fault-injection rollback for BOTH source kinds
 * ('submission' and 'insight_finding').
 *
 * Mirrors tests/acceptance/interview-submit-review-lifecycle.e2e.test.ts:
 * real Express app mounting the actual production routers behind the real
 * verifyToken middleware, mintToken/pgClient from harness.js, SEED/seed()
 * from seed.mjs, AI service mocked so submit's enrichment path can't hang,
 * and a reversible `<prefix>--` id convention cleaned up in afterAll.
 *
 * KNOWN ENVIRONMENT BUG worked around here (see final report to the author):
 * `tests/acceptance/schema.mjs` applies every server/migrations/*.sql file by
 * sending its whole contents as ONE multi-statement query. Postgres's simple
 * query protocol runs a multi-statement string as an implicit transaction, so
 * a single bad statement anywhere in the file rolls back EVERYTHING in that
 * file — including unrelated, valid `CREATE TABLE IF NOT EXISTS` statements
 * earlier in the same file. Both `server/migrations/753_p10_interview_insight_artifact.sql`
 * (uses SQLite's `INSERT OR IGNORE`, invalid in Postgres) and
 * `server/migrations/20260719_baseline_gap.sql` (references a column that
 * doesn't exist yet at the point it runs) fail this way, which silently
 * voids `interview_insight_findings` for every acceptance run — even though
 * schema.mjs's own summary line doesn't call this table out by name (it's
 * beyond the first 40 failures printed). Confirmed no FK depends on this
 * table, so this suite recreates it defensively (idempotent, matching the
 * real column set in 20260719_baseline_gap.sql, including `readback_status`)
 * before seeding rows into it. This is a workaround local to this test file
 * only — no migration/loader file was modified.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

vi.mock('../../server/src/services/ai/llmService.js', () => ({
  llmService: { call: vi.fn().mockRejectedValue(new Error('acceptance: AI enrichment offline')) },
}));

const PREFIX = 'odbior--int008--';
const RESPONDENT_ID = `${PREFIX}respondent`;
const RESPONDENT_EMAIL = `${PREFIX}respondent@acceptance.local`;

// Submission-path fixtures (session/assignment/question ids per scenario).
const SUB = {
  golden: {
    session: `${PREFIX}sess-golden`,
    assignment: `${PREFIX}assign-golden`,
    question: `${PREFIX}q-golden`,
    template: `${PREFIX}tmpl-golden`,
  },
  submittedOnly: {
    session: `${PREFIX}sess-submitted-only`,
    assignment: `${PREFIX}assign-submitted-only`,
    question: `${PREFIX}q-submitted-only`,
    template: `${PREFIX}tmpl-submitted-only`,
  },
  sentBack: {
    session: `${PREFIX}sess-sent-back`,
    assignment: `${PREFIX}assign-sent-back`,
    question: `${PREFIX}q-sent-back`,
    template: `${PREFIX}tmpl-sent-back`,
  },
  concurrency: {
    session: `${PREFIX}sess-concurrency`,
    assignment: `${PREFIX}assign-concurrency`,
    question: `${PREFIX}q-concurrency`,
    template: `${PREFIX}tmpl-concurrency`,
  },
  fault: {
    session: `${PREFIX}sess-fault`,
    assignment: `${PREFIX}assign-fault`,
    question: `${PREFIX}q-fault`,
    template: `${PREFIX}tmpl-fault`,
  },
} as const;

const ANSWER_TEXT = 'Priorytetem jest redukcja czasu wdrożenia procesu zakupowego o 30%.';

// Insight-finding-path fixtures.
const RAW_RESPONDENT_QUOTE =
  'verbatim respondent quote: procurement approval delays are our biggest blocker';
const FINDING_STATEMENT_GOLDEN =
  'Client confirmed budget authority sits with the CFO and committed to a Q3 mitigation plan.';
const FINDING = {
  golden: {
    insight: `${PREFIX}insight-golden`,
    finding: `${PREFIX}finding-golden`,
  },
  draft: {
    insight: `${PREFIX}insight-draft`,
    finding: `${PREFIX}finding-draft`,
  },
};

let app: Express;
let respondentToken: string;
let managerToken: string;
let setInterviewCandidateHandoffFaultInjectorForTests: (
  injector: ((stage: 'candidate-created' | 'receipt-inserted') => void | Promise<void>) | null
) => void;

async function insertAssignmentFixture(
  client: ReturnType<typeof pgClient>,
  fixture: { session: string; assignment: string; question: string; template: string }
) {
  const now = new Date().toISOString();
  await client.query(
    `INSERT INTO interview_sessions
       (id, organization_id, name, owner_id, status, total_questions, answered_questions,
        template_id, assignment_id, started_at, last_activity_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'active', 1, 1, $5, $6, $7, $7, $7, $7)`,
    [fixture.session, SEED.ORG_ID, `${PREFIX}session`, RESPONDENT_ID, fixture.template, fixture.assignment, now]
  );
  await client.query(
    `INSERT INTO interview_assignments
       (id, organization_id, assignee_user_id, template_id, template_version, status,
        session_id, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 1, 'in_progress', $5, $6, $7, $7)`,
    [fixture.assignment, SEED.ORG_ID, RESPONDENT_ID, fixture.template, fixture.session, SEED.USER_ID, now]
  );
  await client.query(
    `INSERT INTO interview_questions
       (id, session_id, organization_id, category, question_text, answer_text, status,
        answered_by, answered_at, sort_order, is_required, created_at, updated_at)
     VALUES ($1, $2, $3, 'strategy', 'Jakie są priorytety?', $4, 'answered',
             $5, $6, 1, 1, $6, $6)`,
    [fixture.question, fixture.session, SEED.ORG_ID, ANSWER_TEXT, RESPONDENT_ID, now]
  );
}

beforeAll(async () => {
  await seed();
  const client = pgClient();
  await client.connect();
  try {
    const now = new Date().toISOString();

    // Defensive re-creation of interview_insight_findings — see file header
    // comment: the real migration(s) that define this table fail to apply in
    // this harness's schema loader for reasons unrelated to INT-08, silently
    // voiding the table. Idempotent; matches the real (baseline-gap) schema.
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.interview_insight_findings (
        id text PRIMARY KEY,
        organization_id text NOT NULL,
        insight_id text NOT NULL,
        source_section_type text NOT NULL DEFAULT 'manual',
        source_section_index integer,
        source_key text,
        finding_statement text NOT NULL,
        confidence_level text NOT NULL DEFAULT 'insufficient',
        limits_text text NOT NULL,
        limits_json text DEFAULT '[]',
        next_action_text text NOT NULL,
        next_action_json text DEFAULT '[]',
        review_status text NOT NULL DEFAULT 'draft',
        readback_status text NOT NULL DEFAULT 'draft_interpretation',
        readback_summary text,
        readback_updated_at timestamp,
        created_by text,
        updated_by text,
        created_at timestamp DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_interview_insight_findings_source_key
        ON public.interview_insight_findings(insight_id, source_key)
    `);

    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'unused', 'USER', 'active', 'Respondent', 'INT008', $4)
       ON CONFLICT (id) DO NOTHING`,
      [RESPONDENT_ID, SEED.ORG_ID, RESPONDENT_EMAIL, now]
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE', $4) ON CONFLICT (id) DO NOTHING`,
      [`${PREFIX}respondent-membership`, SEED.ORG_ID, RESPONDENT_ID, now]
    );

    // Submission-path fixtures (all 5 scenarios' session/assignment/question rows).
    for (const fixture of Object.values(SUB)) {
      await insertAssignmentFixture(client, fixture);
    }

    // Insight-finding-path fixtures.
    await client.query(
      `INSERT INTO interview_insights (id, organization_id, title, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5)`,
      [FINDING.golden.insight, SEED.ORG_ID, `${PREFIX}insight golden`, SEED.USER_ID, now]
    );
    await client.query(
      `INSERT INTO interview_insight_findings
         (id, organization_id, insight_id, source_section_type, source_key, finding_statement,
          confidence_level, limits_text, next_action_text, review_status, readback_status,
          created_by, updated_by, created_at, updated_at)
       VALUES ($1, $2, $3, 'manual', $4, $5, 'high', $6, 'Confirm mitigation plan owner.', 'published',
               'confirmed_by_client', $7, $7, $8, $8)`,
      [
        FINDING.golden.finding,
        SEED.ORG_ID,
        FINDING.golden.insight,
        `${PREFIX}src-golden`,
        FINDING_STATEMENT_GOLDEN,
        RAW_RESPONDENT_QUOTE,
        SEED.USER_ID,
        now,
      ]
    );

    await client.query(
      `INSERT INTO interview_insights (id, organization_id, title, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5)`,
      [FINDING.draft.insight, SEED.ORG_ID, `${PREFIX}insight draft`, SEED.USER_ID, now]
    );
    await client.query(
      `INSERT INTO interview_insight_findings
         (id, organization_id, insight_id, source_section_type, source_key, finding_statement,
          confidence_level, limits_text, next_action_text, review_status,
          created_by, updated_by, created_at, updated_at)
       VALUES ($1, $2, $3, 'manual', $4, $5, 'low', 'n/a', 'n/a', 'draft', $6, $6, $7, $7)`,
      [
        FINDING.draft.finding,
        SEED.ORG_ID,
        FINDING.draft.insight,
        `${PREFIX}src-draft`,
        'Draft finding not yet reviewed.',
        SEED.USER_ID,
        now,
      ]
    );
  } finally {
    await client.end();
  }

  const interviewRouter = (await import('../../server/src/routes/interview.routes.js')).default;
  const candidateHandoffRouter = (
    await import('../../server/src/routes/interviewCandidateHandoff.routes.js')
  ).default;
  ({ setInterviewCandidateHandoffFaultInjectorForTests } = await import(
    '../../server/src/services/interview/interviewCandidateHandoff.js'
  ));

  app = express();
  app.use(express.json());
  // Mirrors the real Gateway.ts mount order: broad /api/interview first, then
  // the more specific /api/interview/candidate-handoff — Express falls
  // through unmatched routes in the first router to the second.
  app.use('/api/interview', interviewRouter);
  app.use('/api/interview/candidate-handoff', candidateHandoffRouter);

  respondentToken = mintToken({ id: RESPONDENT_ID, email: RESPONDENT_EMAIL, role: 'USER' });
  managerToken = mintToken({ role: 'ADMIN' });

  // Drive the underlying interview lifecycle to the states each scenario needs.
  async function submit(assignmentId: string) {
    const res = await request(app)
      .post(`/api/interview/assignments/${assignmentId}/submit`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({ language: 'pl' });
    if (res.status !== 200) {
      throw new Error(`submit(${assignmentId}) failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
  }
  async function approveInterview(assignmentId: string) {
    const res = await request(app)
      .post(`/api/interview/assignments/${assignmentId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});
    if (res.status !== 200) {
      throw new Error(
        `approveInterview(${assignmentId}) failed: ${res.status} ${JSON.stringify(res.body)}`
      );
    }
  }
  async function sendBack(assignmentId: string) {
    const res = await request(app)
      .post(`/api/interview/assignments/${assignmentId}/send-back`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ reason: 'Proszę o więcej szczegółów.' });
    if (res.status !== 200) {
      throw new Error(`sendBack(${assignmentId}) failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
  }

  await submit(SUB.golden.assignment);
  await approveInterview(SUB.golden.assignment);

  await submit(SUB.submittedOnly.assignment); // left at status='submitted'

  await submit(SUB.sentBack.assignment);
  await sendBack(SUB.sentBack.assignment); // status becomes 'in_progress'

  await submit(SUB.concurrency.assignment);
  await approveInterview(SUB.concurrency.assignment);

  await submit(SUB.fault.assignment);
  await approveInterview(SUB.fault.assignment);
}, 60_000);

afterAll(async () => {
  setInterviewCandidateHandoffFaultInjectorForTests?.(null);
  const client = pgClient();
  await client.connect();
  try {
    await client.query(`DELETE FROM interview_candidate_handoffs WHERE source_id LIKE $1`, [
      `${PREFIX}%`,
    ]);
    await client.query(`DELETE FROM initiative_candidates WHERE source_id LIKE $1`, [`${PREFIX}%`]);
    for (const fixture of Object.values(SUB)) {
      await client.query('DELETE FROM interview_answer_history WHERE assignment_id = $1', [
        fixture.assignment,
      ]);
      await client.query('DELETE FROM interview_questions WHERE id = $1', [fixture.question]);
      await client.query('DELETE FROM interview_assignments WHERE id = $1', [fixture.assignment]);
      await client.query('DELETE FROM interview_sessions WHERE id = $1', [fixture.session]);
    }
    await client.query('DELETE FROM interview_insight_findings WHERE id LIKE $1', [`${PREFIX}%`]);
    await client.query('DELETE FROM interview_insights WHERE id LIKE $1', [`${PREFIX}%`]);
    await client.query('DELETE FROM organization_members WHERE id LIKE $1', [`${PREFIX}%`]);
    await client.query('DELETE FROM users WHERE id = $1', [RESPONDENT_ID]);
  } finally {
    await client.end();
  }
}, 30_000);

describe('INT-08 — interview candidate handoff (golden flow, idempotency, concurrency, rollback)', () => {
  it('submission path: preview -> approve (created) -> retry (idempotent) -> lineage read-back', async () => {
    const { assignment } = SUB.golden;

    const preview = await request(app)
      .get(`/api/interview/candidate-handoff/submission/${assignment}/preview`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(preview.status, JSON.stringify(preview.body)).toBe(200);
    expect(preview.body.data.alreadyHandedOff).toBe(false);

    const approve1 = await request(app)
      .post(`/api/interview/candidate-handoff/submission/${assignment}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});
    expect(approve1.status, JSON.stringify(approve1.body)).toBe(201);
    expect(approve1.body.data.created).toBe(true);
    const candidateId = approve1.body.data.candidate.id;
    expect(candidateId).toBeTruthy();

    const client = pgClient();
    await client.connect();
    try {
      const candidateRow = await client.query(
        `SELECT source_type, source_id FROM initiative_candidates WHERE id = $1`,
        [candidateId]
      );
      expect(candidateRow.rows).toHaveLength(1);
      expect(candidateRow.rows[0].source_type).toBe('interview_submission');
      expect(candidateRow.rows[0].source_type).not.toBe('interview_insight');
      expect(candidateRow.rows[0].source_id).toBe(assignment);
    } finally {
      await client.end();
    }

    const approve2 = await request(app)
      .post(`/api/interview/candidate-handoff/submission/${assignment}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});
    expect(approve2.status, JSON.stringify(approve2.body)).toBe(200);
    expect(approve2.body.data.created).toBe(false);
    expect(approve2.body.data.candidate.id).toBe(candidateId);

    const client2 = pgClient();
    await client2.connect();
    try {
      const candidateCount = await client2.query(
        `SELECT count(*)::int AS n FROM initiative_candidates WHERE source_id = $1`,
        [assignment]
      );
      expect(candidateCount.rows[0].n).toBe(1);
      const handoffCount = await client2.query(
        `SELECT count(*)::int AS n FROM interview_candidate_handoffs WHERE source_id = $1`,
        [assignment]
      );
      expect(handoffCount.rows[0].n).toBe(1);
    } finally {
      await client2.end();
    }

    const lineage = await request(app)
      .get(`/api/interview/candidate-handoff/submission/${assignment}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(lineage.status, JSON.stringify(lineage.body)).toBe(200);
    expect(lineage.body.data.sourceId).toBe(assignment);
    expect(lineage.body.data.candidateId).toBe(candidateId);
    expect(lineage.body.data.initiativeId).toBeNull();
  });

  it('insight-finding path: preview -> approve (created) -> retry (idempotent), curated content only', async () => {
    const { finding } = FINDING.golden;

    const preview = await request(app)
      .get(`/api/interview/candidate-handoff/insight-finding/${finding}/preview`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(preview.status, JSON.stringify(preview.body)).toBe(200);
    expect(preview.body.data.alreadyHandedOff).toBe(false);

    const approve1 = await request(app)
      .post(`/api/interview/candidate-handoff/insight-finding/${finding}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});
    expect(approve1.status, JSON.stringify(approve1.body)).toBe(201);
    expect(approve1.body.data.created).toBe(true);
    const candidate = approve1.body.data.candidate;
    expect(candidate.id).toBeTruthy();

    // Curated finding_statement is present; the raw respondent quote (stored
    // only in limits_text, never read into title/rationale by the service)
    // must never leak into the candidate.
    const haystack = `${candidate.title}\n${candidate.rationale}`;
    expect(haystack).toContain('CFO');
    expect(haystack).not.toContain('procurement approval delays');
    expect(haystack).not.toContain(RAW_RESPONDENT_QUOTE);

    const approve2 = await request(app)
      .post(`/api/interview/candidate-handoff/insight-finding/${finding}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});
    expect(approve2.status, JSON.stringify(approve2.body)).toBe(200);
    expect(approve2.body.data.created).toBe(false);
    expect(approve2.body.data.candidate.id).toBe(candidate.id);

    const client = pgClient();
    await client.connect();
    try {
      const candidateCount = await client.query(
        `SELECT count(*)::int AS n FROM initiative_candidates WHERE source_id = $1`,
        [finding]
      );
      expect(candidateCount.rows[0].n).toBe(1);
      const handoffCount = await client.query(
        `SELECT count(*)::int AS n FROM interview_candidate_handoffs WHERE source_id = $1`,
        [finding]
      );
      expect(handoffCount.rows[0].n).toBe(1);
    } finally {
      await client.end();
    }
  });

  it('rejects a submission that is only status=submitted (never manager-approved)', async () => {
    const res = await request(app)
      .post(`/api/interview/candidate-handoff/submission/${SUB.submittedOnly.assignment}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});
    expect(res.status, JSON.stringify(res.body)).toBe(409);
    expect(res.body.code).toBe('SUBMISSION_NOT_ACCEPTED');
    expect(res.body.details.assignmentStatus).toBe('submitted');
  });

  it('rejects a submitted-then-sent-back assignment (reachable non-approved state)', async () => {
    // gatePolicy.SEND_BACK_INTERVIEW is only reachable from status='submitted',
    // and sendBackAssignment sets status='in_progress' (never a literal
    // 'sent_back' status value) — confirmed by reading
    // server/src/services/workflow/gatePolicy.ts and
    // server/src/controllers/InterviewController.ts's sendBackAssignment.
    const res = await request(app)
      .post(`/api/interview/candidate-handoff/submission/${SUB.sentBack.assignment}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});
    expect(res.status, JSON.stringify(res.body)).toBe(409);
    expect(res.body.code).toBe('SUBMISSION_NOT_ACCEPTED');
    expect(res.body.details.assignmentStatus).toBe('in_progress');
  });

  it('rejects an insight finding that has never been published (review_status=draft)', async () => {
    const res = await request(app)
      .post(`/api/interview/candidate-handoff/insight-finding/${FINDING.draft.finding}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});
    expect(res.status, JSON.stringify(res.body)).toBe(409);
    expect(res.body.code).toBe('FINDING_NOT_ACCEPTED');
    expect(res.body.details.reviewStatus).toBe('draft');
  });

  it('concurrent approve calls on the same accepted snapshot never create a duplicate', async () => {
    const { assignment } = SUB.concurrency;

    const [r1, r2] = await Promise.all([
      request(app)
        .post(`/api/interview/candidate-handoff/submission/${assignment}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({}),
      request(app)
        .post(`/api/interview/candidate-handoff/submission/${assignment}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({}),
    ]);

    expect([r1.status, r2.status].sort()).toEqual([200, 201]);
    const candidateId1 = r1.body.data.candidate.id;
    const candidateId2 = r2.body.data.candidate.id;
    expect(candidateId1).toBeTruthy();
    expect(candidateId1).toBe(candidateId2);

    const client = pgClient();
    await client.connect();
    try {
      const candidateCount = await client.query(
        `SELECT count(*)::int AS n FROM initiative_candidates WHERE source_id = $1`,
        [assignment]
      );
      expect(candidateCount.rows[0].n).toBe(1);
      const handoffCount = await client.query(
        `SELECT count(*)::int AS n FROM interview_candidate_handoffs WHERE source_id = $1`,
        [assignment]
      );
      expect(handoffCount.rows[0].n).toBe(1);
    } finally {
      await client.end();
    }
  });

  it('fault injection at receipt-inserted rolls back atomically; a clean retry then succeeds once', async () => {
    const { assignment } = SUB.fault;

    setInterviewCandidateHandoffFaultInjectorForTests((stage) => {
      if (stage === 'receipt-inserted') {
        throw new Error('acceptance: forced rollback at receipt-inserted');
      }
    });

    const failing = await request(app)
      .post(`/api/interview/candidate-handoff/submission/${assignment}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});
    expect(failing.status).toBeGreaterThanOrEqual(500);

    const client = pgClient();
    await client.connect();
    try {
      const candidateCount = await client.query(
        `SELECT count(*)::int AS n FROM initiative_candidates WHERE source_id = $1`,
        [assignment]
      );
      expect(candidateCount.rows[0].n).toBe(0);
      const handoffCount = await client.query(
        `SELECT count(*)::int AS n FROM interview_candidate_handoffs WHERE source_id = $1`,
        [assignment]
      );
      expect(handoffCount.rows[0].n).toBe(0);
    } finally {
      await client.end();
    }

    setInterviewCandidateHandoffFaultInjectorForTests(null);

    const retry = await request(app)
      .post(`/api/interview/candidate-handoff/submission/${assignment}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});
    expect(retry.status, JSON.stringify(retry.body)).toBe(201);
    expect(retry.body.data.created).toBe(true);

    const client2 = pgClient();
    await client2.connect();
    try {
      const candidateCount = await client2.query(
        `SELECT count(*)::int AS n FROM initiative_candidates WHERE source_id = $1`,
        [assignment]
      );
      expect(candidateCount.rows[0].n).toBe(1);
      const handoffCount = await client2.query(
        `SELECT count(*)::int AS n FROM interview_candidate_handoffs WHERE source_id = $1`,
        [assignment]
      );
      expect(handoffCount.rows[0].n).toBe(1);
    } finally {
      await client2.end();
    }
  });
});
