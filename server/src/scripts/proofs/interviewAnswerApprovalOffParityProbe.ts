import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';

const databaseUrl = process.env.DATABASE_URL ?? '';
const variant = String(process.env.INTERVIEW_PARITY_VARIANT ?? '').trim();
if (!databaseUrl.startsWith('postgresql://127.0.0.1') && !databaseUrl.includes('@127.0.0.1:')) {
  throw new Error('Parity probe requires an explicitly local PostgreSQL URL');
}
if (!['line', 'candidate-env-off', 'candidate-org-off'].includes(variant)) {
  throw new Error('Parity probe variant is required');
}

process.env.DB_TYPE = 'postgres';
process.env.NODE_ENV = 'test';
process.env.MOCK_DB = 'false';
process.env.ENABLE_TEST_AUTH_BYPASS = 'false';
process.env.ENABLE_V8_GLOBAL = 'true';
process.env.ENABLE_INTERVIEW_ANSWER_APPROVAL = variant === 'candidate-org-off' ? 'true' : 'false';

const suffix = variant;
const orgId = `iaa-off-parity-org-${suffix}`;
const userId = `iaa-off-parity-user-${suffix}`;
const sessionId = `iaa-off-parity-session-${suffix}`;
const assignmentId = `iaa-off-parity-assignment-${suffix}`;
const pool = new Pool({ connectionString: databaseUrl });

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== 'object') {
    if (value === orgId) return '<organization>';
    if (value === userId) return '<user>';
    if (value === sessionId) return '<session>';
    if (value === assignmentId) return '<assignment>';
    if (typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value)) return '<timestamp>';
    return value;
  }
  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(source)
      .sort()
      .map((key) => [key, normalize(source[key])])
  );
}

try {
  await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, 'IAA OFF parity')`, [orgId]);
  await pool.query(
    `INSERT INTO users (id, organization_id, email, password, role, status)
     VALUES ($1,$2,$3,'local-fixture-not-login','ADMIN','active')`,
    [userId, orgId, `${userId}@example.invalid`]
  );
  await pool.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
     VALUES ($1,$2,$3,'ADMIN','ACTIVE')`,
    [`iaa-off-parity-member-${suffix}`, orgId, userId]
  );
  await pool.query(
    `INSERT INTO organization_ai_policy (organization_id, policy)
     VALUES ($1,$2::jsonb)`,
    [
      orgId,
      JSON.stringify({
        interview: {
          answerApproval: {
            version: 1,
            enabled: variant !== 'candidate-org-off',
            mode: 'manager',
          },
        },
      }),
    ]
  );
  await pool.query(
    `INSERT INTO interview_sessions
       (id, organization_id, name, owner_id, status, total_questions, answered_questions)
     VALUES ($1,$2,'IAA OFF parity session',$3,'active',0,0)`,
    [sessionId, orgId, userId]
  );
  await pool.query(
    `INSERT INTO interview_assignments
       (id, organization_id, assignee_user_id, created_by, template_id,
        template_version, status, session_id)
     VALUES ($1,$2,$3,NULL,'template-off-parity',1,'in_progress',$4)`,
    [assignmentId, orgId, userId, sessionId]
  );

  const config = (await import('../../config/Config.js')).default;
  const token = jwt.sign(
    { id: userId, organizationId: orgId, role: 'ADMIN' },
    config.JWT_SECRET,
    { expiresIn: '10m' }
  );
  const { ApiGateway } = await import('../../Gateway.js');
  const app = express();
  app.use(express.json());
  ApiGateway.getInstance().initializeRoutes(app);

  const response = await request(app)
    .post(`/api/v8/interview/assignments/${assignmentId}/submit`)
    .set('Authorization', `Bearer ${token}`)
    .send({ language: 'en' });
  const persisted = await pool.query(
    `SELECT
       (SELECT status FROM interview_assignments WHERE id=$1) assignment_status,
       (SELECT status FROM interview_sessions WHERE id=$2) session_status,
       (SELECT count(*)::int FROM interview_answer_history WHERE assignment_id=$1) history_count,
       (SELECT count(*)::int FROM interview_answer_decisions WHERE assignment_id=$1) decision_count`,
    [assignmentId, sessionId]
  );
  console.log(
    `PARITY_RESULT=${JSON.stringify(
      normalize({ status: response.status, body: response.body, persisted: persisted.rows[0] })
    )}`
  );
} finally {
  await pool.query(`DELETE FROM interview_assignments WHERE id=$1`, [assignmentId]).catch(() => {});
  await pool.query(`DELETE FROM interview_sessions WHERE id=$1`, [sessionId]).catch(() => {});
  await pool.query(`DELETE FROM organization_ai_policy WHERE organization_id=$1`, [orgId]).catch(
    () => {}
  );
  await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [orgId]).catch(
    () => {}
  );
  await pool.query(`DELETE FROM users WHERE organization_id=$1`, [orgId]).catch(() => {});
  await pool.query(`DELETE FROM organizations WHERE id=$1`, [orgId]).catch(() => {});
  await pool.end();
  const database = await import('../../database/PostgresDatabase.js');
  await database.default.close();
}

process.exit(0);
