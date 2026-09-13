import { randomUUID, createHash } from 'node:crypto';
import fs from 'node:fs';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
const provider = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock('../../../services/ai/llmService.js', () => ({ llmService: provider }));
const enabled = Boolean(process.env.CX4_INTERVIEW_STATE);
const state = enabled ? JSON.parse(fs.readFileSync(process.env.CX4_INTERVIEW_STATE!, 'utf8')) : {};
if (enabled && process.env.DATABASE_URL?.split('@')[1] !== '127.0.0.1:6455/cx4_pilot')
  throw Error('LOCAL_CX4_ONLY');
process.env.INTERVIEW_AI_REVIEW_TIMEOUT_MS = '300';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const actor = randomUUID(),
  A = randomUUID(),
  B = randomUUID();
const events: any[] = [];
let app: express.Express,
  token: string,
  respondent: string,
  staleAdmin: string,
  foreignToken: string;
const foreignOrg = randomUUID();
const payload = {
  object: {
    questionEvaluations: [],
    recommendations: ['DERIVED_SENTINEL_PRIVATE_4800 controlled local evaluator only'],
  },
  usage: {},
};
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function read(id: string) {
  return {
    assignment: (await pool.query('SELECT * FROM interview_assignments WHERE id=$1', [id])).rows,
    session: (await pool.query('SELECT * FROM interview_sessions WHERE assignment_id=$1', [id]))
      .rows,
    questions: (
      await pool.query(
        'SELECT q.* FROM interview_questions q JOIN interview_sessions s ON s.id=q.session_id WHERE s.assignment_id=$1 ORDER BY q.id',
        [id]
      )
    ).rows,
    history: (
      await pool.query(
        'SELECT * FROM interview_answer_history WHERE assignment_id=$1 ORDER BY id',
        [id]
      )
    ).rows,
    notifications: (
      await pool.query('SELECT * FROM notifications WHERE related_object_id=$1 ORDER BY id', [id])
    ).rows,
  };
}
async function fixture(project: string | null = A, anonymous = false) {
  const id = randomUUID(),
    session = randomUUID();
  await pool.query(
    "INSERT INTO interview_sessions(id,organization_id,project_id,owner_id,status,assignment_id,is_anonymous) VALUES($1,$2,$3,$4,'submitted',$5,$6)",
    [session, state.org, project, state.respondent, id, anonymous]
  );
  await pool.query(
    "INSERT INTO interview_assignments(id,organization_id,project_id,assignee_user_id,template_id,status,session_id,created_by,is_anonymous) VALUES($1,$2,$3,$4,$5,'submitted',$6,$7,$8)",
    [id, state.org, project, state.respondent, state.template, session, state.manager, anonymous]
  );
  await pool.query(
    "INSERT INTO interview_questions(id,session_id,organization_id,category,question_text,answer_text,status,sort_order,is_required) VALUES($1,$2,$3,'strategy','Evaluation scope','DERIVED_SENTINEL_PRIVATE_4800','answered',1,1)",
    [randomUUID(), session, state.org]
  );
  return { id, session };
}
const call = (family: string, session: string, bearer: string) =>
  request(app)
    .post(`/api/${family}/sessions/${session}/evaluate-answers`)
    .set('Authorization', `Bearer ${bearer}`)
    .send({ language: 'en' });
async function membership(capabilities = ['interview.assignment.review.scoped']) {
  await pool.query('DELETE FROM project_members WHERE project_id=$1 AND user_id=$2', [A, actor]);
  await pool.query(
    "INSERT INTO project_members(id,project_id,user_id,project_role,normalized_project_role,permissions) VALUES($1,$2,$3,'INITIATIVE_OWNER','INITIATIVE_OWNER',$4)",
    [randomUUID(), A, actor, JSON.stringify(capabilities)]
  );
}
describe
  .runIf(enabled)
  .sequential('W05 evaluation actual Gateway JWT PG controlled provider', () => {
    beforeAll(async () => {
      expect((await pool.query('SELECT current_database() db')).rows[0].db).toBe('cx4_pilot');
      await pool.query(
        "INSERT INTO users(id,organization_id,email,role,status) VALUES($1,$2,$3,'USER','active')",
        [actor, state.org, `${actor}@example.test`]
      );
      await pool.query(
        "INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'MEMBER','ACTIVE')",
        [randomUUID(), state.org, actor]
      );
      for (const p of [A, B])
        await pool.query(
          'INSERT INTO projects(id,organization_id,name,owner_id) VALUES($1,$2,$3,$4)',
          [p, state.org, 'W05 evaluation', state.manager]
        );
      await membership();
      const { default: config } = await import('../../../config/Config.js');
      await pool.query(
        "INSERT INTO organizations(id,name,plan,status,is_active) VALUES($1,'W05 evaluation foreign','enterprise','active',1)",
        [foreignOrg]
      );
      await pool.query(
        "INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'MEMBER','ACTIVE')",
        [randomUUID(), foreignOrg, actor]
      );
      foreignToken = jwt.sign(
        { id: actor, organizationId: foreignOrg, role: 'USER' },
        config.JWT_SECRET,
        { expiresIn: '1h' }
      );
      staleAdmin = jwt.sign(
        { id: actor, organizationId: state.org, role: 'ADMIN' },
        config.JWT_SECRET,
        { expiresIn: '1h' }
      );
      token = jwt.sign({ id: actor, organizationId: state.org, role: 'USER' }, config.JWT_SECRET, {
        expiresIn: '1h',
      });
      respondent = jwt.sign(
        { id: state.respondent, organizationId: state.org, role: 'USER' },
        config.JWT_SECRET,
        { expiresIn: '1h' }
      );
      const { ApiGateway } = await import('../../../Gateway.js');
      const { errorHandlerMiddleware } = await import('../../../utils/ErrorHandler.js');
      app = express();
      app.use(express.json());
      await ApiGateway.getInstance().initializeRoutes(app);
      app.use(errorHandlerMiddleware);
    }, 180000);
    beforeEach(async () => {
      provider.call.mockReset();
      provider.call.mockResolvedValue(payload);
      await pool.query(
        "UPDATE organization_members SET status='ACTIVE' WHERE organization_id=$1 AND user_id=$2",
        [state.org, actor]
      );
      await pool.query('DELETE FROM org_user_permissions WHERE organization_id=$1 AND user_id=$2', [
        state.org,
        actor,
      ]);
      await membership();
    });
    afterAll(async () => {
      if (enabled)
        fs.writeFileSync(
          process.env.CX4_EVALUATION_RESULT!,
          JSON.stringify({ actor, A, B, events }, null, 2)
        );
      await pool.end();
    });
    for (const family of ['interview', 'v8/interview']) {
      for (const role of ['respondent', 'reviewer'])
        it(`${family} legal ${role} persists evaluation`, async () => {
          const f = await fixture();
          const r = await call(family, f.session, role === 'respondent' ? respondent : token);
          expect(r.status).toBe(200);
          expect(provider.call).toHaveBeenCalledTimes(1);
          const after = await read(f.id);
          expect(after.assignment[0].ai_reviewed_at).toBeTruthy();
          events.push({ name: expect.getState().currentTestName, fixture: f, status: r.status });
        });
      it(`${family} project B denied before provider and no mutation`, async () => {
        const f = await fixture(B),
          before = await read(f.id);
        const r = await call(family, f.session, token);
        expect(r.status).toBe(403);
        expect(provider.call).not.toHaveBeenCalled();
        expect(JSON.stringify(r.body)).not.toContain('DERIVED_SENTINEL');
        expect(await read(f.id)).toEqual(before);
        events.push({
          name: expect.getState().currentTestName,
          fixture: f,
          status: r.status,
          hash: hash(before),
        });
      });
      for (const negative of [
        'foreign',
        'projectless',
        'createOnly',
        'explicitRevoke',
        'staleAdmin',
        'orgRevoked',
        'crossOrgSession',
      ])
        it(`${family} ${negative} denies before provider`, async () => {
          await membership();
          const f = await fixture(negative === 'projectless' ? null : A);
          if (negative === 'createOnly')
            await pool.query(
              "UPDATE project_members SET normalized_project_role='TASK_ASSIGNEE',project_role='TASK_ASSIGNEE',permissions=$1 WHERE project_id=$2 AND user_id=$3",
              [JSON.stringify(['interview.assignment.create.scoped']), A, actor]
            );
          if (negative === 'explicitRevoke')
            await pool.query(
              "INSERT INTO org_user_permissions(id,organization_id,user_id,permission_key,grant_type) VALUES($1,$2,$3,'INTERVIEW_INSIGHTS_REVIEW','REVOKE')",
              [randomUUID(), state.org, actor]
            );
          if (negative === 'staleAdmin')
            await pool.query('DELETE FROM project_members WHERE project_id=$1 AND user_id=$2', [
              A,
              actor,
            ]);
          if (negative === 'orgRevoked')
            await pool.query(
              "UPDATE organization_members SET status='INACTIVE' WHERE organization_id=$1 AND user_id=$2",
              [state.org, actor]
            );
          if (negative === 'crossOrgSession')
            await pool.query('UPDATE interview_sessions SET organization_id=$1 WHERE id=$2', [
              foreignOrg,
              f.session,
            ]);
          const before = await read(f.id);
          try {
            const r = await call(
              family,
              f.session,
              negative === 'foreign' ? foreignToken : negative === 'staleAdmin' ? staleAdmin : token
            );
            expect([403, 404]).toContain(r.status);
            expect(provider.call).not.toHaveBeenCalled();
            expect(JSON.stringify(r.body)).not.toContain('DERIVED_SENTINEL');
            expect(await read(f.id)).toEqual(before);
            events.push({
              name: expect.getState().currentTestName,
              fixture: f,
              status: r.status,
              hash: hash(before),
              providerCalls: 0,
            });
          } finally {
            await pool.query(
              "UPDATE organization_members SET status='ACTIVE' WHERE organization_id=$1 AND user_id=$2",
              [state.org, actor]
            );
            await pool.query(
              'DELETE FROM org_user_permissions WHERE organization_id=$1 AND user_id=$2',
              [state.org, actor]
            );
            await membership();
          }
        });
      it(`${family} team respondent without project review may evaluate`, async () => {
        const f = await fixture(B);
        await pool.query(
          'INSERT INTO interview_assignment_members(id,assignment_id,user_id) VALUES($1,$2,$3)',
          [randomUUID(), f.id, actor]
        );
        expect((await call(family, f.session, token)).status).toBe(200);
        expect(provider.call).toHaveBeenCalledTimes(1);
      });
      it(`${family} ad hoc respondent retains explicit evaluation`, async () => {
        const f = await fixture(null);
        await pool.query('UPDATE interview_sessions SET assignment_id=NULL WHERE id=$1', [
          f.session,
        ]);
        await pool.query('DELETE FROM interview_assignments WHERE id=$1', [f.id]);
        expect((await call(family, f.session, respondent)).status).toBe(200);
        expect(provider.call).toHaveBeenCalledTimes(1);
      });
      it(`${family} anonymous self evaluation and reviewer redaction remain distinct`, async () => {
        const f = await fixture(A, true);
        const questionId = (await read(f.id)).questions[0].id;
        provider.call.mockResolvedValue({
          object: {
            questionEvaluations: [
              {
                questionId,
                rubric: ['concreteness', 'evidence', 'depth', 'measurability', 'coherence'].map(
                  (criterion) => ({
                    criterion,
                    score: 4,
                    justification: 'DERIVED_SENTINEL_PRIVATE_4800',
                  })
                ),
                feedback: 'DERIVED_SENTINEL_PRIVATE_4800',
                fixType: null,
              },
            ],
            recommendations: ['DERIVED_SENTINEL_PRIVATE_4800 in a model recommendation'],
          },
          usage: {},
        });
        const own = await call(family, f.session, respondent);
        expect(own.status).toBe(200);
        expect(JSON.stringify(own.body)).toContain('DERIVED_SENTINEL');
        const reviewed = await call(family, f.session, token);
        expect(reviewed.status).toBe(200);
        expect(JSON.stringify(reviewed.body)).not.toContain('DERIVED_SENTINEL');
        expect(provider.call).toHaveBeenCalledTimes(2);
        expect((await read(f.id)).assignment[0].ai_review_snapshot_json).toContain('DERIVED_SENTINEL');
      });
      it(`${family} empty session makes no provider call or snapshot write`, async () => {
        const f = await fixture();
        await pool.query('DELETE FROM interview_questions WHERE session_id=$1', [f.session]);
        const before = await read(f.id);
        const r = await call(family, f.session, respondent);
        expect(r.status).toBe(200);
        expect((r.body.data || r.body).overallVerdict).toBe('empty');
        expect(provider.call).not.toHaveBeenCalled();
        expect(await read(f.id)).toEqual(before);
      });
      it(`${family} provider failure is503 without substitute write`, async () => {
        const f = await fixture(),
          before = await read(f.id);
        provider.call.mockRejectedValue(new Error('Controlled evaluator unavailable'));
        const r = await call(family, f.session, respondent);
        expect(r.status).toBe(503);
        expect(await read(f.id)).toEqual(before);
      });
      it(`${family} timeout persists explicit marker and late completion cannot overwrite`, async () => {
        const f = await fixture();
        let release!: (x: unknown) => void;
        provider.call.mockImplementation(() => new Promise((r) => (release = r)));
        const r = await call(family, f.session, respondent);
        expect(r.status).toBe(200);
        expect((r.body.data || r.body).timedOut).toBe(true);
        const before = await read(f.id);
        release(payload);
        await new Promise((r) => setTimeout(r, 40));
        expect(await read(f.id)).toEqual(before);
        expect(before.assignment[0].ai_reviewed_at).toBeTruthy();
      });
      it(`${family} revoke during provider also denies timeout snapshot`, async () => {
        await membership();
        const f = await fixture();
        let release!: (x: unknown) => void, started!: () => void;
        const reached = new Promise<void>((r) => (started = r));
        provider.call.mockImplementation(
          () =>
            new Promise((r) => {
              release = r;
              started();
            })
        );
        const pending = call(family, f.session, token).then((x) => x);
        await reached;
        await pool.query('DELETE FROM project_members WHERE project_id=$1 AND user_id=$2', [
          A,
          actor,
        ]);
        const before = await read(f.id);
        const r = await pending;
        expect(r.status).toBe(403);
        expect(JSON.stringify(r.body)).not.toContain('DERIVED_SENTINEL');
        expect(await read(f.id)).toEqual(before);
        release(payload);
        await new Promise((r) => setTimeout(r, 40));
        expect(await read(f.id)).toEqual(before);
        await membership();
      });
      it(`${family} explicit evaluation preserves approved answer lock and lifecycle`, async () => {
        const f = await fixture();
        await pool.query("UPDATE interview_assignments SET status='approved' WHERE id=$1", [f.id]);
        await pool.query("UPDATE interview_sessions SET status='completed' WHERE id=$1", [
          f.session,
        ]);
        const before = await read(f.id);
        expect((await call(family, f.session, respondent)).status).toBe(200);
        const after = await read(f.id);
        expect(after.assignment[0].status).toBe('approved');
        expect(after.session).toEqual(before.session);
        expect(after.questions).toEqual(before.questions);
        expect(after.history).toEqual(before.history);
      });
      it(`${family} older completion cannot overwrite a newer real evaluation`, async () => {
        const f = await fixture();
        let release!: (x: unknown) => void, started!: () => void;
        const reached = new Promise<void>((r) => (started = r));
        provider.call
          .mockImplementationOnce(
            () =>
              new Promise((r) => {
                release = r;
                started();
              })
          )
          .mockResolvedValueOnce({
            object: { questionEvaluations: [], recommendations: ['NEWEST_CONTROLLED_EVALUATION'] },
            usage: {},
          });
        const older = call(family, f.session, token).then((x) => x);
        await reached;
        const newer = await call(family, f.session, token);
        expect(newer.status).toBe(200);
        const before = await read(f.id);
        expect(before.assignment[0].ai_review_snapshot_json).toContain(
          'NEWEST_CONTROLLED_EVALUATION'
        );
        release(payload);
        const r = await older;
        expect(r.status).toBe(409);
        expect(JSON.stringify(r.body)).not.toContain('DERIVED_SENTINEL');
        expect(await read(f.id)).toEqual(before);
      });
      for (const drift of [
        'revoke',
        'teamRevoke',
        'anonymous',
        'capability',
        'orgRevoke',
        'project',
        'assignment',
        'status',
        'answer',
        'newerEvaluation',
      ])
        it(`${family} ${drift} during provider cannot persist`, async () => {
          await membership();
          const f = await fixture(drift === 'teamRevoke' ? B : A);
          if (drift === 'teamRevoke')
            await pool.query(
              'INSERT INTO interview_assignment_members(id,assignment_id,user_id) VALUES($1,$2,$3)',
              [randomUUID(), f.id, actor]
            );
          let release!: () => void, started!: () => void;
          const reached = new Promise<void>((r) => (started = r));
          provider.call.mockImplementation(
            () =>
              new Promise((r) => {
                release = () => r(payload);
                started();
              })
          );
          const pending = call(family, f.session, token).then((x) => x);
          await reached;
          if (drift === 'revoke')
            await pool.query('DELETE FROM project_members WHERE project_id=$1 AND user_id=$2', [
              A,
              actor,
            ]);
          if (drift === 'teamRevoke')
            await pool.query(
              'DELETE FROM interview_assignment_members WHERE assignment_id=$1 AND user_id=$2',
              [f.id, actor]
            );
          if (drift === 'anonymous')
            await pool.query('UPDATE interview_sessions SET is_anonymous=true WHERE id=$1', [
              f.session,
            ]);
          if (drift === 'capability')
            await pool.query(
              "UPDATE project_members SET project_role='TASK_ASSIGNEE',normalized_project_role='TASK_ASSIGNEE',permissions='[]' WHERE project_id=$1 AND user_id=$2",
              [A, actor]
            );
          if (drift === 'orgRevoke')
            await pool.query(
              "UPDATE organization_members SET status='INACTIVE' WHERE organization_id=$1 AND user_id=$2",
              [state.org, actor]
            );
          if (drift === 'project')
            await pool.query('UPDATE interview_sessions SET project_id=$1 WHERE id=$2', [
              B,
              f.session,
            ]);
          if (drift === 'assignment')
            await pool.query('UPDATE interview_sessions SET assignment_id=$1 WHERE id=$2', [
              randomUUID(),
              f.session,
            ]);
          if (drift === 'status')
            await pool.query("UPDATE interview_assignments SET status='approved' WHERE id=$1", [
              f.id,
            ]);
          if (drift === 'answer')
            await pool.query(
              "UPDATE interview_questions SET answer_text='new version' WHERE session_id=$1",
              [f.session]
            );
          if (drift === 'newerEvaluation')
            await pool.query(
              "UPDATE interview_assignments SET ai_review_snapshot_json='{}',ai_reviewed_at=NOW() WHERE id=$1",
              [f.id]
            );
          const before = await read(f.id);
          release();
          const r = await pending;
          expect([403, 409]).toContain(r.status);
          expect(JSON.stringify(r.body)).not.toContain('DERIVED_SENTINEL');
          expect(await read(f.id)).toEqual(before);
          await pool.query(
            "UPDATE organization_members SET status='ACTIVE' WHERE organization_id=$1 AND user_id=$2",
            [state.org, actor]
          );
          await membership();
          events.push({
            name: expect.getState().currentTestName,
            fixture: f,
            status: r.status,
            hash: hash(before),
          });
        });
    }
  });
