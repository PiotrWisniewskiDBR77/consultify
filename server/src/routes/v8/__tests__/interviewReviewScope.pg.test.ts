import { randomUUID, createHash } from 'node:crypto';
import fs from 'node:fs';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Real Gateway/JWT/PG acceptance; explicit local fixture context, never live defaults.
const enabled = Boolean(process.env.CX4_INTERVIEW_STATE);
const dbUrl = process.env.DATABASE_URL || '';
if (enabled) {
  const url = new URL(dbUrl);
  if (url.hostname !== '127.0.0.1' || url.port !== '6455' || url.pathname !== '/cx4_pilot')
    throw Error('CX4_LOCAL_REQUIRED');
}
const state = enabled ? JSON.parse(fs.readFileSync(process.env.CX4_INTERVIEW_STATE!, 'utf8')) : {};
const acceptance = describe.runIf(enabled);
const pool = new Pool({ connectionString: dbUrl });
const A = randomUUID(),
  B = randomUUID(),
  foreignOrg = randomUUID();
const actor = randomUUID(),
  email = `cx4-scope-${actor}@example.test`;
const events: any[] = [];
const ids: string[] = [];
let token = '',
  adminToken = '';
const headers = (t: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${t}`,
});
const request = async (path: string, t: string, body?: unknown) => {
  const r = await fetch(`http://127.0.0.1:4214/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: headers(t),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: r.status, body: await r.json() };
};
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function read(id: string) {
  return {
    assignment: (await pool.query('SELECT * FROM interview_assignments WHERE id=$1', [id])).rows,
    session: (await pool.query('SELECT * FROM interview_sessions WHERE assignment_id=$1', [id]))
      .rows,
    history: (
      await pool.query(
        'SELECT * FROM interview_answer_history WHERE assignment_id=$1 ORDER BY id',
        [id]
      )
    ).rows,
    notifications: (
      await pool.query(
        'SELECT id,user_id,type FROM notifications WHERE data::text LIKE $1 OR related_object_id=$2 ORDER BY id',
        [`%${id}%`, id]
      )
    ).rows,
  };
}
async function fixture(project: string | null, sessionProject = project, org = state.org) {
  const assignment = randomUUID(),
    session = randomUUID();
  ids.push(assignment);
  await pool.query(
    "INSERT INTO interview_sessions(id,organization_id,project_id,name,owner_id,status,total_questions,answered_questions,template_id,assignment_id,runtime_mode_default) VALUES($1,$2,$3,$4,$5,'submitted',1,1,$6,$7,'single_question')",
    [
      session,
      org,
      sessionProject,
      'W05 scoped review',
      state.respondent,
      state.template,
      assignment,
    ]
  );
  await pool.query(
    "INSERT INTO interview_assignments(id,organization_id,project_id,assignee_user_id,template_id,status,session_id,created_by) VALUES($1,$2,$3,$4,$5,'submitted',$6,$7)",
    [assignment, org, project, state.respondent, state.template, session, state.manager]
  );
  await pool.query(
    "INSERT INTO interview_questions(id,session_id,organization_id,category,question_text,answer_text,status,sort_order,is_required) VALUES($1,$2,$3,'strategy','W05 scope question','A complete measured answer with sufficient detail.','answered',1,1)",
    [randomUUID(), session, org]
  );
  return assignment;
}
async function login(e: string) {
  const r = await fetch('http://127.0.0.1:4214/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: e, password: state.password }),
  });
  if (r.status !== 200) throw Error(`LOGIN_${r.status}`);
  return (await r.json()).token;
}
async function member(
  capabilities = [
    'interview.assignment.create.scoped',
    'interview.assignment.review.scoped',
    'interview.assignment.approve.scoped',
    'interview.assignment.send_back.scoped',
  ],
  role = 'INITIATIVE_OWNER'
) {
  await pool.query('DELETE FROM project_members WHERE project_id=$1 AND user_id=$2', [A, actor]);
  await pool.query(
    'INSERT INTO project_members(id,project_id,user_id,project_role,normalized_project_role,permissions) VALUES($1,$2,$3,$4,$4,$5)',
    [randomUUID(), A, actor, role, JSON.stringify(capabilities)]
  );
}
async function probe(
  id: string,
  family: string,
  action: string,
  t: string,
  expected: number | number[],
  extra = {}
) {
  const before = await read(id);
  const result = await request(`${family}/assignments/${id}/${action}`, t, {
    reason: 'W05 scope review feedback',
    ...extra,
  });
  const after = await read(id);
  events.push({
    id,
    family,
    action,
    expected,
    http: result.status,
    beforeHash: hash(before),
    afterHash: hash(after),
    state: after.assignment[0]?.status,
  });
  expect(Array.isArray(expected) ? expected : [expected]).toContain(result.status);
  if (result.status !== 200) expect(after).toEqual(before);
  else {
    expect(after.assignment[0].status).toBe(action === 'approve' ? 'approved' : 'in_progress');
    expect(after.session[0].status).toBe(action === 'approve' ? 'completed' : 'active');
    expect(
      after.notifications.some(
        (n) => n.type === (action === 'approve' ? 'interview_approved' : 'interview_sent_back')
      )
    ).toBe(true);
    if (action === 'send-back') expect(after.history).toHaveLength(1);
  }
  return result;
}

acceptance.sequential('W05 real scoped review both endpoint stacks', () => {
  beforeAll(async () => {
    expect((await pool.query('SELECT current_database() db')).rows[0].db).toBe('cx4_pilot');
    await pool.query(
      "INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name) VALUES($1,$2,$3,$4,'USER','active','Scoped','Reviewer')",
      [actor, state.org, email, await bcrypt.hash(state.password, 10)]
    );
    await pool.query(
      "INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'MEMBER','ACTIVE')",
      [randomUUID(), state.org, actor]
    );
    for (const p of [A, B])
      await pool.query(
        'INSERT INTO projects(id,organization_id,name,owner_id) VALUES($1,$2,$3,$4)',
        [p, state.org, 'W05 ' + p, state.manager]
      );
    await pool.query(
      "INSERT INTO organizations(id,name,plan,status,is_active) VALUES($1,'W05 foreign sentinel','enterprise','active',1)",
      [foreignOrg]
    );
    await member();
    token = await login(email);
    const manager = (await pool.query('SELECT email FROM users WHERE id=$1', [state.manager]))
      .rows[0];
    adminToken = await login(manager.email);
  }, 30000);
  afterAll(async () => {
    fs.writeFileSync(
      process.env.CX4_SCOPE_RESULT!,
      JSON.stringify({ actor, A, B, ids, events }, null, 2)
    );
    await pool.end();
  });
  it('same request memo is refreshed under write lock after role downgrade', async () => {
    await member();
    const id = await fixture(A);
    const { correlationMiddleware } = await import('../../../utils/RequestStore.js');
    const { assertInterviewAssignmentReviewAccess } =
      await import('../../../services/interviewAssignmentReviewAccess.js');
    const { withPgTransaction } = await import('../../../utils/queryHelpers.js');
    const user = { id: actor, organizationId: state.org, role: 'USER' };
    await new Promise<void>((resolve, reject) =>
      correlationMiddleware(
        { get: () => 'w05-cache-revoke' } as any,
        { set: () => {} } as any,
        () => {
          (async () => {
            const before = await read(id);
            await assertInterviewAssignmentReviewAccess(user, id);
            // Keep membership; remove its review authority, so the ownership predicate alone cannot save us.
            await pool.query(
              "UPDATE project_members SET project_role='TASK_ASSIGNEE',normalized_project_role='TASK_ASSIGNEE',permissions='[]' WHERE project_id=$1 AND user_id=$2",
              [A, actor]
            );
            await expect(
              withPgTransaction(() =>
                assertInterviewAssignmentReviewAccess(user, id, { lock: true })
              )
            ).rejects.toMatchObject({ statusCode: 403 });
            expect(await read(id)).toEqual(before);
          })().then(resolve, reject);
        }
      )
    ).finally(() => member());
  });
  for (const family of ['v8/interview', 'interview']) {
    for (const action of ['approve', 'send-back']) {
      it(`${family} ${action} A legal scoped review 200`, async () => {
        await member();
        await probe(await fixture(A), family, action, token, 200);
      });
      it(`${family} ${action} B denied without mutation`, async () => {
        await probe(await fixture(B), family, action, token, [403, 404], { projectId: A });
      });
    }
    it(`${family} revoke after effective allow denies without mutation`, async () => {
      await member();
      const access = await request(`access/effective?projectId=${A}`, token);
      expect(access.status).toBe(200);
      await pool.query('DELETE FROM project_members WHERE project_id=$1 AND user_id=$2', [
        A,
        actor,
      ]);
      await probe(await fixture(A), family, 'approve', token, 403);
      await member();
    });
    it(`${family} create-only does not grant review`, async () => {
      await member(['interview.assignment.create.scoped'], 'TASK_ASSIGNEE');
      await probe(await fixture(A), family, 'approve', token, 403);
      await member();
    });
    it(`${family} projectless scoped denied; ADMIN allowed`, async () => {
      const id = await fixture(null);
      await probe(id, family, 'approve', token, 403, { projectId: A });
      await probe(id, family, 'approve', adminToken, 200);
    });
    it(`${family} conflicting persisted projects deny even ADMIN`, async () => {
      await probe(await fixture(A, B), family, 'approve', adminToken, 409);
    });
    it(`${family} explicit deny overrides scoped review`, async () => {
      await pool.query(
        "INSERT INTO org_user_permissions(id,user_id,organization_id,permission_key,grant_type) VALUES($1,$2,$3,'INTERVIEW_ASSIGN_MANAGE','REVOKE')",
        [randomUUID(), actor, state.org]
      );
      try {
        await probe(await fixture(A), family, 'approve', token, 403);
      } finally {
        await pool.query('DELETE FROM org_user_permissions WHERE user_id=$1', [actor]);
      }
    });
    it(`${family} active organization membership revoke denies`, async () => {
      await pool.query("UPDATE organization_members SET status='REVOKED' WHERE user_id=$1", [
        actor,
      ]);
      try {
        await probe(await fixture(A), family, 'approve', token, [401, 403]);
      } finally {
        await pool.query("UPDATE organization_members SET status='ACTIVE' WHERE user_id=$1", [
          actor,
        ]);
      }
    });
    it(`${family} foreign assignment lookup is 404`, async () => {
      await probe(await fixture(null, null, foreignOrg), family, 'approve', token, 404);
    });
    it(`${family} foreign linked session denies ADMIN without mutation`, async () => {
      const id = await fixture(null);
      await pool.query('UPDATE interview_sessions SET organization_id=$1 WHERE assignment_id=$2', [
        foreignOrg,
        id,
      ]);
      await probe(id, family, 'approve', adminToken, 404);
    });
    it(`${family} changed project after access read denies`, async () => {
      const id = await fixture(A);
      expect((await request(`${family}/assignments/${id}/review-access`, token)).status).toBe(200);
      await pool.query('UPDATE interview_assignments SET project_id=$1 WHERE id=$2', [B, id]);
      await pool.query('UPDATE interview_sessions SET project_id=$1 WHERE assignment_id=$2', [
        B,
        id,
      ]);
      await probe(id, family, 'approve', token, 403);
    });
    it(`${family} review-only capability works without create`, async () => {
      await member(['interview.assignment.review.scoped'], 'TASK_ASSIGNEE');
      await probe(await fixture(A), family, 'approve', token, 200);
      await member();
    });
    it(`${family} terminal retry does not duplicate side effects`, async () => {
      const id = await fixture(A);
      await probe(id, family, 'approve', token, 200);
      await probe(id, family, 'approve', token, 409);
    });
    it(`${family} scoped reviewer detail and history readable only for A`, async () => {
      const a = await fixture(A),
        b = await fixture(B);
      for (const suffix of ['', '/answer-history']) {
        expect((await request(`interview/assignments/${a}${suffix}`, token)).status).toBe(200);
        expect((await request(`interview/assignments/${b}${suffix}`, token)).status).toBe(403);
      }
    });
    it(`${family} stale ADMIN JWT after canonical demotion loses review`, async () => {
      await pool.query("UPDATE organization_members SET role='ADMIN' WHERE user_id=$1", [actor]);
      await pool.query("UPDATE users SET role='ADMIN' WHERE id=$1", [actor]);
      const privileged = await login(email);
      expect(JSON.parse(Buffer.from(privileged.split('.')[1], 'base64url').toString()).role).toBe(
        'ADMIN'
      );
      await pool.query("UPDATE users SET role='USER' WHERE id=$1", [actor]);
      await pool.query("UPDATE organization_members SET role='MEMBER' WHERE user_id=$1", [actor]);
      await probe(await fixture(B), family, 'approve', privileged, 403);
    });
    it(`${family} scoped cannot open organization managed list`, async () => {
      expect((await request('interview/assignments', token)).status).toBe(403);
    });
    it(`${family} reviewer reads identified session parts only in A; no anonymous answers`, async () => {
      const a = await fixture(A),
        b = await fixture(B);
      const sa = (await read(a)).session[0].id,
        sb = (await read(b)).session[0].id;
      for (const part of ['questions', 'notes', 'evidence', 'summary', 'linked-items']) {
        expect((await request(`interview/sessions/${sa}/${part}`, token)).status).toBe(200);
        expect((await request(`interview/sessions/${sb}/${part}`, token)).status).toBe(403);
      }
      await pool.query('UPDATE interview_sessions SET is_anonymous=TRUE WHERE id=$1', [sa]);
      expect((await request(`interview/sessions/${sa}/questions`, token)).status).toBe(403);
    });
    it(`${family} review permission never grants response editing`, async () => {
      const id = await fixture(A);
      await probe(id, family, 'send-back', token, 200);
      const r = await read(id);
      const question = (
        await pool.query('SELECT id FROM interview_questions WHERE session_id=$1', [
          r.session[0].id,
        ])
      ).rows[0].id;
      const before = await pool.query('SELECT * FROM interview_questions WHERE id=$1', [question]);
      const response = await fetch(`http://127.0.0.1:4214/api/interview/questions/${question}`, {
        method: 'PATCH',
        headers: headers(token),
        body: JSON.stringify({
          answerText: 'unauthorized reviewer edit',
          expectedUpdatedAt: String(before.rows[0].updated_at || '1970-01-01T00:00:00.000Z'),
        }),
      });
      expect(response.status).toBe(403);
      expect(
        (await pool.query('SELECT * FROM interview_questions WHERE id=$1', [question])).rows
      ).toEqual(before.rows);
    });
    it(`${family} review-access is record-bound`, async () => {
      await member();
      const a = await request(`${family}/assignments/${await fixture(A)}/review-access`, token);
      const b = await request(`${family}/assignments/${await fixture(B)}/review-access`, token);
      expect(a.status).toBe(200);
      expect((a.body.data ?? a.body).canReview).toBe(true);
      expect(b.status).toBe(200);
      expect((b.body.data ?? b.body).canReview).toBe(false);
    });
  }
});
