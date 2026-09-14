/** @vitest-environment node */

import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { Pool } from 'pg';
import request from 'supertest';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';
import { writeOrganizationExportArchiveStreaming } from '../../services/organizationExportArchiveService.js';
import { withOrganizationExportSnapshot } from '../../services/organizationExportSnapshot.js';

const databaseUrl = process.env.DATABASE_URL || '';
const pool = new Pool({ connectionString: databaseUrl, max: 4 });
const execFileAsync = promisify(execFile);

describe('F2-E E1 five UI/API-created families reach the archive', () => {
  const organizationId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();
  const sessionId = randomUUID();
  const insightId = randomUUID();
  const marker = `E1_FIVE_FAMILIES_${randomUUID()}`;
  const outputPath = path.join(os.tmpdir(), `e1-five-families-${randomUUID()}.zip`);
  let app: Express;
  let authorization: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$2,'active')`, [
      organizationId,
      `E1 five families ${marker}`,
    ]);
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status)
       VALUES($1,$2,$3,'local-only','OWNER','active')`,
      [userId, organizationId, `${userId}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
    await pool.query(
      `INSERT INTO projects(id,organization_id,name,owner_id,status)
       VALUES($1,$2,$3,$4,'active')`,
      [projectId, organizationId, `E1 project ${marker}`, userId]
    );
    await pool.query(
      `INSERT INTO interview_sessions(id,organization_id,project_id,name,owner_id,status,is_anonymous)
       VALUES($1,$2,$3,$4,$5,'completed',false)`,
      [sessionId, organizationId, projectId, `E1 interview ${marker}`, userId]
    );
    await pool.query(
      `INSERT INTO interview_insights
         (id,organization_id,title,prompt_type,source_session_ids,filters,content,status,created_by,session_id)
       VALUES($1,$2,$3,'summary','[]','{}','{}','completed',$4,$5)`,
      [insightId, organizationId, `E1 insight ${marker}`, userId, sessionId]
    );

    authorization = `Bearer ${jwt.sign(
      {
        id: userId,
        userId,
        email: `${userId}@test.invalid`,
        organizationId,
        organization_id: organizationId,
        role: 'OWNER',
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '15m' }
    )}`;
    app = express();
    app.use(express.json({ limit: '2mb' }));
    ApiGateway.getInstance().initializeRoutes(app);
  }, 60_000);

  afterAll(async () => {
    await fs.rm(outputPath, { force: true });
    await pool.end();
  });

  it('creates initiative, task, interview finding, decision and Materials artifact through real routes and finds every marker in JSON+CSV', async () => {
    const initiative = await request(app)
      .post('/api/initiatives')
      .set('Authorization', authorization)
      .send({
        title: `${marker}_INITIATIVE`,
        projectId,
        problemStatement: 'Measured enterprise export gap.',
        hypothesis: 'A complete archive resolves the portability requirement.',
        businessValue: 5,
        targetState: { description: 'All approved organization records are portable.' },
        priority: 'high',
      });
    expect([200, 201], initiative.text).toContain(initiative.status);
    const initiativeId = String(initiative.body.id);

    const task = await request(app)
      .post('/api/tasks')
      .set('Authorization', authorization)
      .send({
        title: `${marker}_TASK`,
        projectId,
        initiativeId,
        description: 'API-created export task',
        ownerId: userId,
      });
    expect([200, 201], task.text).toContain(task.status);

    const finding = await request(app)
      .post(`/api/v8/interview/insights/${insightId}/findings`)
      .set('Authorization', authorization)
      .send({
        finding_statement: `${marker}_FINDING`,
        confidence_level: 'high',
        limits: 'Disposable local PostgreSQL proof.',
        next_action: 'Inspect the archive.',
        evidence_pointers: [],
      });
    expect(finding.status, finding.text).toBe(201);

    const decision = await request(app)
      .post('/api/decisions')
      .set('Authorization', authorization)
      .send({
        title: `${marker}_DECISION`,
        description: 'API-created export decision',
        projectId,
        priority: 'high',
        impact: 'high',
      });
    expect([200, 201], decision.text).toContain(decision.status);

    const material = await request(app)
      .post('/api/document-studio/generate')
      .set('Authorization', authorization)
      .send({
        intake: {
          title: `${marker}_MATERIAL`,
          description: 'API-created Materials artifact for E1.',
          documentType: 'executive_memo',
          confidentiality: 'internal',
        },
        projectId,
        useLlm: false,
      });
    expect(material.status, material.text).toBe(200);

    const client = await pool.connect();
    const manifest = await withOrganizationExportSnapshot(client, organizationId, (snapshot) =>
      writeOrganizationExportArchiveStreaming(snapshot, organizationId, outputPath, {
        actorId: userId,
        batchSize: 2,
      })
    );
    expect(manifest.complete, JSON.stringify({ unresolved: manifest.unresolvedTables, skipped: manifest.skippedReads })).toBe(true);

    const read = async (entry: string) =>
      (await execFileAsync('unzip', ['-p', outputPath, entry], { maxBuffer: 16 * 1024 * 1024 })).stdout;
    const targets = [
      ['public.initiatives', `${marker}_INITIATIVE`],
      ['public.tasks', `${marker}_TASK`],
      ['public.interview_insight_findings', `${marker}_FINDING`],
      ['public.decisions', `${marker}_DECISION`],
      ['public.wave5_artifacts', `${marker}_MATERIAL`],
    ] as const;
    for (const [table, expected] of targets) {
      const json = await read(`json/${table}.json`);
      const csv = await read(`csv/${table}.csv`);
      expect(json, table).toContain(expected);
      expect(csv, table).toContain(expected);
      expect(manifest.rowCounts[table.replace(/^public\./, '')] ?? manifest.rowCounts[table]).toBeGreaterThan(0);
    }
    expect(JSON.stringify(manifest.notIncluded)).toContain('portable_methodology_ip_package');
  }, 300_000);
});
