/** INT-DELIVERY-OPS-001 — exact published assignment through mounted JWT routes. */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../../middleware/errorHandler.js';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

vi.mock('../../../services/notificationService.js', () => ({
  default: { send: vi.fn().mockResolvedValue('notification') },
}));
vi.mock('../../../services/emailService.js', () => ({
  default: { sendEmail: vi.fn().mockResolvedValue(true) },
}));
vi.mock('../../../services/ai/ingestionPipeline.js', () => ({
  IngestionPipeline: class {},
}));
vi.mock('../../../services/ai/llmService.js', () => ({ llmService: {} }));
vi.mock('../../../services/organizationContext/OrganizationContextService.js', () => ({
  default: { recordInterviewAnswer: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../../services/pdfParserService.js', () => ({ default: {} }));
vi.mock('../../../services/workflow/gatePolicy.js', () => ({
  evaluateGatePolicy: vi.fn().mockReturnValue({ allow: true }),
}));

describe.skipIf(!REAL_DB)('published interview assignment delivery (real PostgreSQL)', () => {
  const suffix = randomUUID().slice(0, 8);
  const id = (part: string) => `int_pub_delivery_${part}_${suffix}`;
  const orgA = id('org_a');
  const orgB = id('org_b');
  const owner = id('owner');
  const respondent = id('respondent');
  const respondent2 = id('respondent_2');
  const foreign = id('foreign');
  const project = id('project');
  const template = id('template');
  const systemTemplate = id('system_template');
  const systemQuestion = id('system_question');
  const requestKey = `assign-${randomUUID()}`;
  let pool: Pool;
  let app: Express;
  let ownerToken = '';
  let respondentToken = '';
  let foreignToken = '';
  let assignmentId = '';
  let sessionId = '';

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const assignmentPayload = (overrides: Record<string, unknown> = {}) => ({
    assigneeUserIds: [respondent],
    dueAt: '2026-09-01T10:00:00.000Z',
    idempotencyKey: requestKey,
    priority: 'high',
    projectId: project,
    templateId: template,
    templateVersion: 1,
    ...overrides,
  });

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    await pool.query(`INSERT INTO organizations (id,name) VALUES ($1,'A'),($2,'B')`, [orgA, orgB]);
    for (const [userId, organizationId, role] of [
      [owner, orgA, 'OWNER'],
      [respondent, orgA, 'USER'],
      [respondent2, orgA, 'USER'],
      [foreign, orgB, 'OWNER'],
    ]) {
      await pool.query(
        `INSERT INTO users (id,organization_id,email,password,role,status) VALUES ($1,$2,$3,'unused',$4,'active')`,
        [userId, organizationId, `${userId}@example.test`, role]
      );
      await pool.query(
        `INSERT INTO organization_members (id,organization_id,user_id,role,status)
         VALUES ($1,$2,$3,$4,'ACTIVE')`,
        [id(`membership_${userId}`), organizationId, userId, role]
      );
    }
    await pool.query(
      `INSERT INTO projects (id,organization_id,name,owner_id) VALUES ($1,$2,'Delivery',$3)`,
      [project, orgA, owner]
    );
    await pool.query(
      `INSERT INTO interview_library_templates
         (id,organization_id,name,category,status,visibility,version,created_by,template_scope)
       VALUES ($1,$2,'Immutable delivery','CUSTOM','draft','org',0,$3,'organization')`,
      [template, orgA, owner]
    );
    await pool.query(
      `INSERT INTO interview_library_templates
         (id,organization_id,name,category,status,visibility,version,created_by,template_scope)
       VALUES ($1,NULL,'System delivery','CUSTOM','approved','global',1,'system','system')`,
      [systemTemplate]
    );
    await pool.query(
      `INSERT INTO interview_library_template_questions
         (id,template_id,category,question_text,sort_order,is_required)
       VALUES ($1,$2,'strategy','System question',1,true)`,
      [systemQuestion, systemTemplate]
    );

    const { default: config } = await import('../../../config/Config.js');
    const sign = (userId: string, organizationId: string, role: string) =>
      jwt.sign(
        { id: userId, organizationId, role, email: `${userId}@example.test` },
        config.JWT_SECRET,
        { expiresIn: '10m' }
      );
    ownerToken = sign(owner, orgA, 'OWNER');
    respondentToken = sign(respondent, orgA, 'USER');
    foreignToken = sign(foreign, orgB, 'OWNER');

    const { default: interviewRouter } = await import('../../interview.routes.js');
    const { default: enterpriseRouter } = await import('../../interview-enterprise.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/interview', interviewRouter);
    app.use('/api/interview-v4', enterpriseRouter);
    app.use(errorHandler);
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    await pool
      .query(`DELETE FROM interview_public_answer_receipts WHERE organization_id=$1`, [orgA])
      .catch(() => undefined);
    await pool.query(`DELETE FROM interview_distributions WHERE organization_id=$1`, [orgA]);
    await pool.query(`DELETE FROM interview_questions WHERE organization_id=$1`, [orgA]);
    await pool.query(`DELETE FROM interview_sessions WHERE organization_id=$1`, [orgA]);
    await pool.query(
      `DELETE FROM interview_assignment_session_duplicate_quarantine WHERE assignment_id LIKE $1`,
      [`int_pub_delivery_legacy_%_${suffix}`]
    );
    await pool.query(`DELETE FROM interview_assignments WHERE organization_id=$1`, [orgA]);
    await pool.query(`DELETE FROM tasks WHERE organization_id=$1`, [orgA]);
    await pool.query(
      `DELETE FROM interview_library_template_versions WHERE organization_id=$1 OR template_id=$2`,
      [orgA, systemTemplate]
    );
    await pool.query(`DELETE FROM interview_library_template_questions WHERE template_id=$1`, [
      template,
    ]);
    await pool.query(`DELETE FROM interview_library_templates WHERE id=$1`, [template]);
    await pool.query(`DELETE FROM interview_library_template_questions WHERE template_id=$1`, [
      systemTemplate,
    ]);
    await pool.query(`DELETE FROM interview_library_templates WHERE id=$1`, [systemTemplate]);
    await pool.query(`DELETE FROM projects WHERE id=$1`, [project]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [
      [owner, respondent, respondent2, foreign],
    ]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgA, orgB]]);
    await pool.end();
  });

  it('owner publishes v1 and assigns that exact immutable version', async () => {
    const published = await request(app)
      .post(`/api/interview/templates/${template}/publish`)
      .set(bearer(ownerToken))
      .send({
        expectedVersion: 0,
        template: { name: 'Immutable delivery', category: 'CUSTOM', scope: 'organization' },
        questions: [{ category: 'strategy', questionText: 'Question from v1', isRequired: true }],
      });
    expect(published.status).toBe(200);
    expect(published.body.version).toBe(1);
    const publishedReadback = await request(app)
      .get(`/api/interview/templates/${template}`)
      .set(bearer(ownerToken));
    expect(publishedReadback.status).toBe(200);
    expect(publishedReadback.body).toMatchObject({ version: 1, hasPublishedVersion: true });

    const assigned = await request(app)
      .post('/api/interview/assignments')
      .set(bearer(ownerToken))
      .send(assignmentPayload());
    expect(assigned.status).toBe(201);
    expect(assigned.body).toMatchObject({
      templateId: template,
      templateVersion: 1,
      replayed: false,
    });
    assignmentId = assigned.body.id;
  });

  it('lists an approved system template as assignable and atomically freezes its global version', async () => {
    const listed = await request(app).get('/api/interview/templates').set(bearer(ownerToken));
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: systemTemplate,
          scope: 'system',
          version: 1,
          hasPublishedVersion: true,
        }),
      ])
    );

    const assigned = await request(app)
      .post('/api/interview/assignments')
      .set(bearer(ownerToken))
      .send(
        assignmentPayload({
          idempotencyKey: `system-${randomUUID()}`,
          templateId: systemTemplate,
          templateVersion: 1,
        })
      );
    expect(assigned.status).toBe(201);
    expect(assigned.body).toMatchObject({ templateId: systemTemplate, templateVersion: 1 });

    const snapshot = await pool.query(
      `SELECT organization_id, snapshot_json
       FROM interview_library_template_versions
       WHERE template_id=$1 AND version=1`,
      [systemTemplate]
    );
    expect(snapshot.rowCount).toBe(1);
    expect(snapshot.rows[0].organization_id).toBe('system');
    expect(snapshot.rows[0].snapshot_json.questions).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: systemQuestion })])
    );
  });

  it('replays the same create request and rejects the same key with changed payload', async () => {
    const replay = await request(app)
      .post('/api/interview/assignments')
      .set(bearer(ownerToken))
      .send(assignmentPayload());
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ id: assignmentId, replayed: true });

    const mismatch = await request(app)
      .post('/api/interview/assignments')
      .set(bearer(ownerToken))
      .send(assignmentPayload({ dueAt: '2026-09-02T10:00:00.000Z' }));
    expect(mismatch.status).toBe(409);
    expect(mismatch.body).toMatchObject({ code: 'ASSIGNMENT_IDEMPOTENCY_PAYLOAD_MISMATCH' });
  });

  it('foreign tenant is denied and concurrent start produces one exact-version session', async () => {
    const foreignStart = await request(app)
      .post(`/api/interview/assignments/${assignmentId}/start`)
      .set(bearer(foreignToken))
      .send({ projectId: project });
    expect(foreignStart.status).toBe(404);

    const starts = await Promise.all(
      [1, 2].map(() =>
        request(app)
          .post(`/api/interview/assignments/${assignmentId}/start`)
          .set(bearer(respondentToken))
          .send({ projectId: project })
      )
    );
    expect(starts.every((response) => response.status === 200)).toBe(true);
    sessionId = starts[0].body.session.id;
    expect(starts.map((response) => response.body.session.id)).toEqual([sessionId, sessionId]);
    expect(starts[0].body.session).toMatchObject({ templateId: template, templateVersion: 1 });
    const sessionCount = await pool.query(
      `SELECT COUNT(*)::int AS count FROM interview_sessions WHERE assignment_id=$1`,
      [assignmentId]
    );
    expect(sessionCount.rows[0].count).toBe(1);
    const assignmentReadback = await pool.query(
      `SELECT session_id, status FROM interview_assignments WHERE id=$1`,
      [assignmentId]
    );
    expect(assignmentReadback.rows[0]).toMatchObject({
      session_id: sessionId,
      status: 'in_progress',
    });
  });

  it('persists submit, send-back, correction, resubmit and approval as one visible lifecycle', async () => {
    const initialQuestions = await request(app)
      .get(`/api/interview/sessions/${sessionId}/questions`)
      .set(bearer(respondentToken));
    expect(initialQuestions.status).toBe(200);
    expect(initialQuestions.body).toHaveLength(1);
    const questionId = initialQuestions.body[0].id;

    const firstAnswer = await request(app)
      .patch(`/api/interview/questions/${questionId}`)
      .set(bearer(respondentToken))
      .send({
        answerText: 'First submitted answer',
        expectedUpdatedAt: initialQuestions.body[0].updatedAt,
        status: 'answered',
      });
    expect(firstAnswer.status, JSON.stringify(firstAnswer.body)).toBe(200);

    const submitted = await request(app)
      .post(`/api/interview/assignments/${assignmentId}/submit`)
      .set(bearer(respondentToken))
      .send({ language: 'en' });
    expect(submitted.status, JSON.stringify(submitted.body)).toBe(200);
    expect(submitted.body.assignment.status).toBe('submitted');
    expect(submitted.body.session.status).toBe('submitted');

    const locked = await request(app)
      .patch(`/api/interview/questions/${questionId}`)
      .set(bearer(respondentToken))
      .send({
        answerText: 'Must stay locked',
        expectedUpdatedAt: firstAnswer.body.updatedAt,
        status: 'answered',
      });
    expect(locked.status).toBe(409);
    expect(locked.body.error).toBe('Session is locked');

    const sentBack = await request(app)
      .post(`/api/interview/assignments/${assignmentId}/send-back`)
      .set(bearer(ownerToken))
      .send({ reason: 'Add concrete evidence', missingItems: [{ key: 'evidence', label: 'Evidence' }] });
    expect(sentBack.status).toBe(200);
    expect(sentBack.body).toMatchObject({
      status: 'in_progress',
      sentBackReason: 'Add concrete evidence',
    });

    const editableQuestions = await request(app)
      .get(`/api/interview/sessions/${sessionId}/questions`)
      .set(bearer(respondentToken));
    const corrected = await request(app)
      .patch(`/api/interview/questions/${questionId}`)
      .set(bearer(respondentToken))
      .send({
        answerText: 'Corrected answer with concrete evidence',
        expectedUpdatedAt: editableQuestions.body[0].updatedAt,
        status: 'answered',
      });
    expect(corrected.status).toBe(200);

    const resubmitted = await request(app)
      .post(`/api/interview/assignments/${assignmentId}/submit`)
      .set(bearer(respondentToken))
      .send({ language: 'en' });
    expect(resubmitted.status).toBe(200);
    expect(resubmitted.body.assignment.status).toBe('submitted');

    const approved = await request(app)
      .post(`/api/interview/assignments/${assignmentId}/approve`)
      .set(bearer(ownerToken))
      .send({});
    expect(approved.status).toBe(200);
    expect(approved.body.assignment.status).toBe('approved');
    expect(approved.body.session.status).toBe('completed');
    expect(approved.body.entersContext).toBe(true);

    const persisted = await pool.query(
      `SELECT a.status AS assignment_status, s.status AS session_status,
              (SELECT COUNT(*)::int FROM interview_answer_history h
                WHERE h.assignment_id=a.id) AS history_count,
              (SELECT answer_text FROM interview_questions q
                WHERE q.session_id=s.id LIMIT 1) AS answer_text
       FROM interview_assignments a
       JOIN interview_sessions s ON s.id=a.session_id
       WHERE a.id=$1`,
      [assignmentId]
    );
    expect(persisted.rows[0]).toMatchObject({
      assignment_status: 'approved',
      session_status: 'completed',
      answer_text: 'Corrected answer with concrete evidence',
      history_count: 3,
    });
  });

  it('a partially completed multi-assignee request resumes truthfully and then fully replays', async () => {
    const multiKey = `multi-${randomUUID()}`;
    const first = await request(app)
      .post('/api/interview/assignments')
      .set(bearer(ownerToken))
      .send(assignmentPayload({ assigneeUserIds: [respondent], idempotencyKey: multiKey }));
    expect(first.status).toBe(201);

    const resumed = await request(app)
      .post('/api/interview/assignments')
      .set(bearer(ownerToken))
      .send(
        assignmentPayload({
          assigneeUserIds: [respondent, respondent2],
          idempotencyKey: multiKey,
        })
      );
    expect(resumed.status).toBe(201);
    expect(resumed.body).toMatchObject({
      createdCount: 2,
      replayed: false,
      splitAssignments: true,
    });
    const ids = resumed.body.createdAssignments.map((assignment: { id: string }) => assignment.id);
    expect(ids[0]).toBe(first.body.id);
    expect(new Set(ids).size).toBe(2);

    const replay = await request(app)
      .post('/api/interview/assignments')
      .set(bearer(ownerToken))
      .send(
        assignmentPayload({
          assigneeUserIds: [respondent, respondent2],
          idempotencyKey: multiKey,
        })
      );
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ createdCount: 2, replayed: true, splitAssignments: true });
  });

  it('upgrade quarantines historical duplicate sessions without rewriting them and blocks a third', async () => {
    const legacyAssignment = id('legacy_assignment');
    const legacyA = id('legacy_session_a');
    const legacyB = id('legacy_session_b');
    await pool.query(
      `ALTER TABLE interview_sessions DISABLE TRIGGER trg_one_interview_session_per_assignment`
    );
    try {
      await pool.query(
        `INSERT INTO interview_sessions (id,organization_id,owner_id,status,assignment_id)
         VALUES ($1,$3,$4,'in_progress',$5),($2,$3,$4,'in_progress',$5)`,
        [legacyA, legacyB, orgA, owner, legacyAssignment]
      );
    } finally {
      await pool.query(
        `ALTER TABLE interview_sessions ENABLE TRIGGER trg_one_interview_session_per_assignment`
      );
    }

    const migration = readFileSync(
      'server/migrations/20261029_interview_assignment_delivery_identity.sql',
      'utf8'
    );
    await pool.query(migration);
    const quarantined = await pool.query(
      `SELECT session_ids FROM interview_assignment_session_duplicate_quarantine WHERE assignment_id=$1`,
      [legacyAssignment]
    );
    expect(quarantined.rows[0].session_ids).toEqual([legacyA, legacyB]);
    const preserved = await pool.query(
      `SELECT id FROM interview_sessions WHERE assignment_id=$1 ORDER BY id`,
      [legacyAssignment]
    );
    expect(preserved.rows.map((row) => row.id)).toEqual([legacyA, legacyB].sort());
    await expect(
      pool.query(
        `INSERT INTO interview_sessions (id,organization_id,owner_id,status,assignment_id)
         VALUES ($1,$2,$3,'in_progress',$4)`,
        [id('legacy_session_c'), orgA, owner, legacyAssignment]
      )
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('republishing v2 cannot alter cold reopen or the respondent delivery bound to v1', async () => {
    const republished = await request(app)
      .post(`/api/interview/templates/${template}/publish`)
      .set(bearer(ownerToken))
      .send({
        expectedVersion: 1,
        template: { name: 'Immutable delivery', category: 'CUSTOM', scope: 'organization' },
        questions: [{ category: 'strategy', questionText: 'Question from v2', isRequired: true }],
      });
    expect(republished.status).toBe(200);
    expect(republished.body.version).toBe(2);

    const { interviewEnterpriseService } =
      await import('../../../services/interviewEnterpriseService.js');
    const invite = await interviewEnterpriseService.createDistribution(orgA, sessionId, {
      channel: 'link',
    });
    const publicRead = await request(app).get(
      `/api/interview-v4/public/distributions/${invite.publicToken}`
    );
    expect(publicRead.status).toBe(200);
    expect(publicRead.body).toMatchObject({
      sessionId,
      templateId: template,
      templateVersion: 1,
      questions: [{ questionText: 'Question from v1' }],
    });

    const cold = new Pool({ connectionString: DATABASE_URL, max: 1 });
    try {
      const readback = await cold.query(
        `SELECT template_version FROM interview_assignments WHERE id=$1`,
        [assignmentId]
      );
      const session = await cold.query(
        `SELECT template_version FROM interview_sessions WHERE id=$1`,
        [sessionId]
      );
      expect(readback.rows[0].template_version).toBe(1);
      expect(session.rows[0].template_version).toBe(1);
    } finally {
      await cold.end();
    }
  });
});
