import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

const databaseUrl = process.env.DATABASE_URL || '';
const expectedDatabase = process.env.C6_EXPORT_TEST_DATABASE || '';
const pool = new Pool({ connectionString: databaseUrl, max: 6 });
const orgIds: string[] = [];
const userIds: string[] = [];
let server: Server;
let secret: string;
const origin = 'http://127.0.0.1:4216';
const templateId = randomUUID();
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
async function account(superadmin = false) {
  const orgId = randomUUID(),
    userId = randomUUID();
  orgIds.push(orgId);
  userIds.push(userId);
  await pool.query('INSERT INTO organizations(id,name) VALUES ($1,$2)', [
    orgId,
    `Gateway export ${orgId}`,
  ]);
  await pool.query(
    "INSERT INTO users(id,organization_id,email,password,role,status) VALUES ($1,$2,$3,'local-fixture-not-login',$4,'active')",
    [userId, orgId, `${userId}@test.invalid`, superadmin ? 'SUPERADMIN' : 'ADMIN']
  );
  await pool.query(
    "INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES ($1,$2,$3,'ADMIN','ACTIVE')",
    [randomUUID(), orgId, userId]
  );
  const token = jwt.sign(
    {
      id: userId,
      organizationId: orgId,
      role: superadmin ? 'SUPERADMIN' : 'ADMIN',
      email: `${userId}@test.invalid`,
    },
    secret,
    { expiresIn: '15m' }
  );
  return { orgId, userId, token };
}
beforeAll(async () => {
  expect(expectedDatabase.startsWith('cx6_')).toBe(true);
  const identity = await assertRealPostgresTestEnvironment({ expectedDatabase });
  expect(identity.host).toBe('127.0.0.1');
  expect(identity.port).toBe('6457');
  const config = (await import('../../config/Config.js')).default;
  secret = config.JWT_SECRET;
  const { ApiGateway } = await import('../../Gateway.js');
  const app = express();
  app.use(express.json());
  ApiGateway.getInstance().initializeRoutes(app);
  server = await new Promise<Server>((resolve, reject) => {
    const listening = app.listen(4216, '127.0.0.1', () => resolve(listening));
    listening.once('error', reject);
  });
}, 60000);
afterAll(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  await pool.query('DELETE FROM interview_assignments WHERE organization_id=ANY($1::text[])', [
    orgIds,
  ]);
  await pool.query('DELETE FROM interview_sessions WHERE organization_id=ANY($1::text[])', [
    orgIds,
  ]);
  await pool.query('DELETE FROM interview_question_templates WHERE id=$1', [templateId]);
  await pool.query('DELETE FROM org_policies WHERE organization_id=ANY($1::text[])', [orgIds]);
  await pool.query(
    'DELETE FROM project_members WHERE project_id IN (SELECT id FROM projects WHERE organization_id=ANY($1::text[]))',
    [orgIds]
  );
  await pool.query('DELETE FROM projects WHERE organization_id=ANY($1::text[])', [orgIds]);
  await pool.query('DELETE FROM organization_members WHERE organization_id=ANY($1::text[])', [
    orgIds,
  ]);
  await pool.query('DELETE FROM users WHERE id=ANY($1::text[])', [userIds]);
  await pool.query('DELETE FROM organizations WHERE id=ANY($1::text[])', [orgIds]);
  await pool.end();
  const db = await import('../../database/PostgresDatabase.js');
  await db.default.close();
});

describe('real Interview export privacy', () => {
  it('real session and question writers feed D18 actor-scoped JSON and CSV without changing stored anonymous content', async () => {
    const a = await account(),
      b = await account();
    const managerId = randomUUID();
    userIds.push(managerId);
    await pool.query(
      "INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,'local-fixture','ADMIN','active')",
      [managerId, a.orgId, `${managerId}@test.invalid`]
    );
    await pool.query(
      "INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'ADMIN','ACTIVE')",
      [randomUUID(), a.orgId, managerId]
    );
    const managerToken = jwt.sign(
      { id: managerId, organizationId: a.orgId, role: 'ADMIN' },
      secret,
      { expiresIn: '15m' }
    );
    await pool.query(
      "INSERT INTO interview_question_templates(id,category,question_text) VALUES($1,'strategy','Export question')",
      [templateId]
    );
    const privateText = 'ANONYMOUS_PRIVATE_SENTINEL';
    const publicText = 'NONANONYMOUS_PUBLIC_SENTINEL';
    const foreignText = 'FOREIGN_TENANT_SENTINEL';
    const sessions: Array<{
      id: string;
      questionId: string;
      orgId: string;
      sentinel: string;
      questionCount: number;
    }> = [];
    for (const [actor, anonymous, sentinel] of [
      [a, true, privateText],
      [a, false, publicText],
      [b, true, foreignText],
    ] as const) {
      const project = await request(origin)
        .post('/api/projects')
        .set('Authorization', `Bearer ${actor.token}`)
        .send({ name: 'Interview export project' });
      expect(project.status, project.text).toBe(201);
      const created = await request(origin)
        .post('/api/interview/sessions')
        .set('Authorization', `Bearer ${actor.token}`)
        .send({ name: 'Export session', projectId: project.body.id });
      expect(created.status, created.text).toBe(201);
      const id = created.body.id;
      expect(typeof id).toBe('string');
      // Anonymous assignment/template setup is a separate writer gate. This
      // fixture marks anonymity explicitly; session/question creation is real HTTP.
      await pool.query('UPDATE interview_sessions SET is_anonymous=$1 WHERE id=$2', [
        anonymous,
        id,
      ]);
      const questions = await request(origin)
        .get(`/api/interview/sessions/${id}/questions`)
        .set('Authorization', `Bearer ${actor.token}`);
      expect(questions.status, questions.text).toBe(200);
      const q = questions.body.find((row: any) => row.questionText === 'Export question');
      expect(q).toBeTruthy();
      const updated = await request(origin)
        .patch(`/api/interview/questions/${q.id}`)
        .set('Authorization', `Bearer ${actor.token}`)
        .send({
          answerText: sentinel,
          contextNote: sentinel,
          answerPayload: { text: sentinel },
          voiceTranscript: sentinel,
          expectedUpdatedAt: q.updatedAt,
        });
      expect(updated.status, updated.text).toBe(200);
      const summary = await request(origin)
        .patch(`/api/interview/sessions/${id}`)
        .set('Authorization', `Bearer ${actor.token}`)
        .send({
          summaryFacts: [sentinel],
          summaryGaps: [sentinel],
          summaryConstraints: [sentinel],
          summaryPainPoints: [sentinel],
        });
      expect(summary.status, summary.text).toBe(200);
      // Populated storage fixtures prove export privacy; they are not claimed
      // as successful note/evidence/AI writers or actual AI generation.
      await pool.query(
        "INSERT INTO interview_notes(id,session_id,organization_id,category,title,content,created_by) VALUES($1,$2,$3,'strategy','Note',$4,$5)",
        [randomUUID(), id, actor.orgId, sentinel, actor.userId]
      );
      await pool.query(
        "INSERT INTO interview_evidence(id,session_id,organization_id,evidence_type,title,transcript_text,file_path,url,storage_key,uploaded_by) VALUES($1,$2,$3,'url','Evidence',$4,$4,$4,$4,$5)",
        [randomUUID(), id, actor.orgId, sentinel, actor.userId]
      );
      const ai = {
        overallScore: 4,
        recommendations: [sentinel],
        questionEvaluations: [
          {
            questionId: q.id,
            score: 4,
            feedback: sentinel,
            rubric: [{ score: 3, justification: sentinel }],
          },
        ],
        weakAnswerMap: [],
      };
      await pool.query(
        "INSERT INTO interview_assignments(id,organization_id,assignee_user_id,status,is_anonymous,ai_review_snapshot_json,template_id) VALUES($1,$2,$3,'assigned',$4,$5,$6)",
        [randomUUID(), actor.orgId, actor.userId, anonymous, JSON.stringify(ai), templateId]
      );
      sessions.push({
        id,
        questionId: q.id,
        orgId: actor.orgId,
        sentinel,
        questionCount: questions.body.length,
      });
    }
    const mismatched = 'MISMATCHED_PARENT_PRIVATE_SENTINEL';
    await pool.query(
      "INSERT INTO interview_questions(id,session_id,organization_id,category,question_text,answer_text) VALUES($1,$2,$3,'strategy','Cross-scope fixture',$4),($5,$6,$7,'strategy','Cross-scope fixture',$4)",
      [randomUUID(), sessions[2].id, a.orgId, mismatched, randomUUID(), sessions[0].id, b.orgId]
    );
    const storageSnapshot = async () => {
      const stored: Record<string, unknown[]> = {};
      for (const table of [
        'interview_sessions',
        'interview_questions',
        'interview_notes',
        'interview_evidence',
        'interview_assignments',
      ]) {
        stored[table] = (
          await pool.query(
            `SELECT to_jsonb(row) AS payload FROM ${table} row WHERE organization_id=ANY($1::text[]) ORDER BY id`,
            [[a.orgId, b.orgId]]
          )
        ).rows;
      }
      return stored;
    };
    const storedBefore = await storageSnapshot();
    const before = await pool.query(
      'SELECT id,answer_text,answer_payload,context_note,voice_transcript FROM interview_questions WHERE session_id=ANY($1::text[]) ORDER BY id',
      [sessions.map((s) => s.id)]
    );
    for (const [token, respondent] of [
      [managerToken, false],
      [a.token, true],
    ] as const) {
      for (const format of ['json', 'csv']) {
        const exported = await request(origin)
          .get(`/api/organizations/${a.orgId}/export?format=${format}`)
          .set('Authorization', `Bearer ${token}`);
        expect(exported.status, exported.text).toBe(200);
        expect(exported.text).toContain(publicText);
        expect(exported.text).not.toContain(foreignText);
        expect(exported.text).not.toContain(mismatched);
        if (respondent) expect(exported.text).toContain(privateText);
        else expect(exported.text).not.toContain(privateText);
        if (format === 'json') {
          const body = JSON.parse(exported.text);
          expect(body.rowCounts.interview_sessions).toBe(2);
          expect(body.rowCounts.interview_questions).toBe(
            sessions.filter((s) => s.orgId === a.orgId).reduce((n, s) => n + s.questionCount, 0)
          );
          expect(body.rowCounts.interview_notes).toBe(2);
          expect(body.rowCounts.interview_evidence).toBeGreaterThanOrEqual(2);
          expect(body.rowCounts.interview_assignments).toBe(2);
          expect(body.securityManifest.complete).toBe(false);
          expect(body.securityManifest.unresolvedTables).toContainEqual({
            table: 'interview_questions',
            reason: 'interview_privacy_parent_missing_or_outside_tenant',
          });
        }
      }
    }
    const after = await pool.query(
      'SELECT id,answer_text,answer_payload,context_note,voice_transcript FROM interview_questions WHERE session_id=ANY($1::text[]) ORDER BY id',
      [sessions.map((s) => s.id)]
    );
    expect(await storageSnapshot()).toEqual(storedBefore);
    expect(after.rows).toEqual(before.rows);
    expect(JSON.stringify(after.rows)).toContain(privateText);
  }, 60000);
});
