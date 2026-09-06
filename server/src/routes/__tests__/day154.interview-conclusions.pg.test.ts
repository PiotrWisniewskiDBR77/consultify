/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';
import logger from '../../utils/Logger.js';

describe('Day 154 — interview findings reach conclusions on real PostgreSQL', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const organizationId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();
  const sessionId = randomUUID();
  const insightId = randomUUID();
  let app: express.Express;
  let auth: { Authorization: string };

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();

    await pool.query(`INSERT INTO organizations (id,name,status) VALUES ($1,$2,'active')`, [
      organizationId,
      'Day 154 Organization',
    ]);
    await pool.query(
      `INSERT INTO users (id,organization_id,email,password,role,status)
       VALUES ($1,$2,$3,'unused-local-only','OWNER','active')`,
      [userId, organizationId, `${userId}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO organization_members (id,organization_id,user_id,role,status)
       VALUES ($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
    await pool.query(
      `INSERT INTO interview_sessions (id,organization_id,project_id,name,owner_id,status)
       VALUES ($1,$2,$3,'Day 154 Session',$4,'completed')`,
      [sessionId, organizationId, projectId, userId]
    );
    await pool.query(
      `INSERT INTO interview_insights
         (id,organization_id,title,prompt_type,source_session_ids,filters,content,status,created_by,session_id)
       VALUES ($1,$2,'Day 154 Insight','summary','[]','{}','{}','completed',$3,$4)`,
      [insightId, organizationId, userId, sessionId]
    );

    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    const token = jwt.sign(
      { id: userId, userId, organizationId, organization_id: organizationId, role: 'OWNER' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
    auth = { Authorization: `Bearer ${token}` };
  }, 30000);

  afterAll(async () => {
    await pool.end();
  });

  it('persists an HTTP-created finding as an interview conclusion with the session project', async () => {
    const findingResponse = await request(app)
      .post(`/api/v8/interview/insights/${insightId}/findings`)
      .set(auth)
      .send({
        finding_statement: 'Day 154 finding reaches conclusions.',
        confidence_level: 'high',
        limits: 'Local disposable PostgreSQL evidence.',
        next_action: 'Verify the repaired bridge.',
        evidence_pointers: [],
      });
    expect(findingResponse.status).toBe(201);

    const findingId = findingResponse.body.data.finding.id as string;
    const before = await pool.query(
      `SELECT id,organization_id,insight_id,finding_statement
       FROM interview_insight_findings WHERE id=$1 AND organization_id=$2`,
      [findingId, organizationId]
    );
    console.log('DAY154_SELECT_FINDING_BEFORE_SYNC', JSON.stringify(before.rows));
    expect(before.rows).toHaveLength(1);

    const response = await request(app).get('/api/conclusions').set(auth);
    console.log('DAY154_HTTP_CONCLUSIONS', response.status, JSON.stringify(response.body));
    expect(response.status).toBe(200);
    const conclusion = response.body.conclusions.find(
      (entry: { sourceModule: string; sourceArtifactRefs: Array<{ id: string }> }) =>
        entry.sourceModule === 'interview' &&
        entry.sourceArtifactRefs.some((ref) => ref.id === findingId)
    );
    expect(conclusion).toBeDefined();
    expect(conclusion.projectId).toBe(projectId);

    const after = await pool.query(
      `SELECT id,organization_id,project_id,source_module,source_artifact_refs_json
       FROM conclusions WHERE organization_id=$1 AND source_module='interview'`,
      [organizationId]
    );
    console.log('DAY154_SELECT_CONCLUSION_AFTER_SYNC', JSON.stringify(after.rows));
    expect(after.rows).toHaveLength(1);
    expect(after.rows[0].project_id).toBe(projectId);
  }, 60000);

  it('returns a visible error, logs the SQL message, and lets the tools sibling finish', async () => {
    const toolSessionId = randomUUID();
    await pool.query(
      `INSERT INTO tool_sessions
         (id,organization_id,project_id,tool_type,name,status,answers_json,context_snapshot,created_by)
       VALUES ($1,$2,$3,'day154','Day 154 Tool','APPROVED',$4,$5,$6)`,
      [
        toolSessionId,
        organizationId,
        projectId,
        JSON.stringify({ summary: { executiveSummary: 'Sibling tool conclusion survived.' } }),
        'Day 154 tool context',
        userId,
      ]
    );

    const errorSpy = vi.spyOn(logger, 'error');
    await pool.query(`ALTER TABLE interview_insights RENAME COLUMN title TO day154_broken_title`);
    let response: request.Response;
    try {
      // 1.1-Z2 #3 (DECYZJA CTO: odczyt nie może pisać) — synchronizacja
      // (i błąd SQL, który ją wywala) żyje teraz WYŁĄCZNIE pod
      // POST /api/conclusions/sync, nie pod GET /api/conclusions.
      // GET jest od 06.09 czysto odczytowy i nigdy nie dotyka tej ścieżki
      // SQL, więc nie może już jej ujawnić.
      response = await request(app).post('/api/conclusions/sync').set(auth);
    } finally {
      await pool.query(`ALTER TABLE interview_insights RENAME COLUMN day154_broken_title TO title`);
    }

    console.log('DAY154_HTTP_FORCED_SQL_FAILURE', response.status, JSON.stringify(response.body));
    expect(response.status).toBe(500);
    const logged = errorSpy.mock.calls.flat().map(String).join(' ');
    console.log('DAY154_FORCED_SQL_FAILURE_LOG', logged);
    expect(logged).toContain('title');
    expect(logged).toMatch(/does not exist|column/i);

    let toolRows = await pool.query(
      `SELECT id,source_module,source_artifact_refs_json FROM conclusions
       WHERE organization_id=$1 AND source_module='tools'`,
      [organizationId]
    );
    for (let attempt = 0; attempt < 20 && toolRows.rows.length === 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      toolRows = await pool.query(
        `SELECT id,source_module,source_artifact_refs_json FROM conclusions
         WHERE organization_id=$1 AND source_module='tools'`,
        [organizationId]
      );
    }
    console.log('DAY154_SELECT_TOOLS_AFTER_INTERVIEW_FAILURE', JSON.stringify(toolRows.rows));
    expect(toolRows.rows).toHaveLength(1);
    expect(toolRows.rows[0].source_artifact_refs_json).toContain(toolSessionId);
    errorSpy.mockRestore();
  }, 60000);
});
