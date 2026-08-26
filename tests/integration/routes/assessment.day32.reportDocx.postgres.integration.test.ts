/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import JSZip from 'jszip';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function binary(res: NodeJS.ReadableStream, callback: (error: Error | null, body?: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
  res.on('error', callback);
}

describe.skipIf(!REAL_DB)('Day 32 assessment report DOCX — real router, JWT and PostgreSQL', () => {
  let app: Express;
  let pool: import('pg').Pool;
  const suffix = randomUUID().slice(0, 8);
  const orgA = `org-day32-a-${suffix}`;
  const orgB = `org-day32-b-${suffix}`;
  const userA = `user-day32-a-${suffix}`;
  const userB = `user-day32-b-${suffix}`;
  const projectA = `project-day32-a-${suffix}`;
  const sessionData = `session-day32-data-${suffix}`;
  const sessionEmpty = `session-day32-empty-${suffix}`;
  const sessionForeign = `session-day32-foreign-${suffix}`;
  const outputData = `output-day32-data-${suffix}`;
  const outputForeign = `output-day32-foreign-${suffix}`;
  let tokenA = '';

  const getDocx = (sessionId: string, query = '') =>
    request(app)
      .get(`/api/method/sessions/${sessionId}/assessment-report.docx${query}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .buffer(true)
      .parse(binary);

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: DATABASE_URL });
    await pool.query(`INSERT INTO organizations (id,name) VALUES ($1,$2),($3,$4)`, [
      orgA,
      'Day 32 A',
      orgB,
      'Day 32 B',
    ]);
    await pool.query(
      `INSERT INTO users (id,organization_id,email,role) VALUES ($1,$2,$3,'user'),($4,$5,$6,'user')`,
      [userA, orgA, `${userA}@example.test`, userB, orgB, `${userB}@example.test`]
    );
    await pool.query(`INSERT INTO projects (id,organization_id,name) VALUES ($1,$2,$3)`, [
      projectA,
      orgA,
      'Zakład Wtryskowni Ćmielów',
    ]);
    await pool.query(
      `INSERT INTO method_sessions
       (id,organization_id,project_id,module,method_pack_id,method_pack_version,state,mode,owner_user_id)
       VALUES ($1,$2,$3,'assessment','drd','v1','active','guided_manual',$4),
              ($5,$2,NULL,'assessment','drd','v1','active','guided_manual',$4),
              ($6,$7,NULL,'assessment','drd','v1','active','guided_manual',$8)`,
      [sessionData, orgA, projectA, userA, sessionEmpty, sessionForeign, orgB, userB]
    );
    for (const [organizationId, sessionId, outputId] of [
      [orgA, sessionData, outputData],
      [orgB, sessionForeign, outputForeign],
    ]) {
      const snapshotId = `snapshot-${outputId}`;
      await pool.query(
        `INSERT INTO method_snapshots (id,organization_id,session_id,method_pack_version,content_hash)
         VALUES ($1,$2,$3,'v1',$4)`,
        [snapshotId, organizationId, sessionId, 'd'.repeat(64)]
      );
      await pool.query(
        `INSERT INTO method_outputs
         (id,organization_id,session_id,snapshot_id,module,method_pack_id,method_pack_version,output_version,scope,content_hash)
         VALUES ($1,$2,$3,$4,'assessment','drd','v1',1,'organization',$5)`,
        [outputId, organizationId, sessionId, snapshotId, 'e'.repeat(64)]
      );
    }
    await pool.query(
      `INSERT INTO method_findings
       (id,organization_id,output_id,unit_id,unit_name,current_level,target_level,gap,
        supporting_evidence_json,business_meaning,recommendation,confidence,source_locators_json)
       VALUES ($1,$2,$3,'1A','Data management',1,5,4,$4,'Measured state','Improve controls','high',$5)`,
      [`finding-day32-${suffix}`, orgA, outputData, JSON.stringify([{ evidenceId: 'ev-1' }]), '[]']
    );

    const { default: config } = await import('../../../server/src/config/Config.js');
    tokenA = jwt.sign({ id: userA, organizationId: orgA, role: 'user' }, config.JWT_SECRET, {
      expiresIn: '15m',
      ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
      ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
    });
    const { default: routes } = await import('../../../server/src/routes/method-core.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/method', routes);
  }, 60_000);

  afterAll(async () => {
    await pool.query(`DELETE FROM projects WHERE id=$1`, [projectA]);
    await pool.query(`DELETE FROM users WHERE id IN ($1,$2)`, [userA, userB]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [orgA, orgB]);
    await pool.end();
  });

  it('returns a valid DOCX with deterministic, sanitized headers for a session with data', async () => {
    const before = await pool.query(
      `SELECT (SELECT count(*) FROM method_sessions WHERE organization_id=$1)::int AS sessions,
              (SELECT count(*) FROM method_outputs WHERE organization_id=$1)::int AS outputs`,
      [orgA]
    );
    const response = await getDocx(sessionData);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain(DOCX_TYPE);
    expect(response.headers['content-disposition']).toContain('attachment; filename=');
    expect(response.headers['content-disposition']).toContain('%C4%86miel%C3%B3w');
    expect(Number(response.headers['content-length'])).toBe(response.body.length);
    expect(response.body.subarray(0, 2).toString()).toBe('PK');
    const zip = await JSZip.loadAsync(response.body);
    expect(zip.file('word/document.xml')).not.toBeNull();
    expect(zip.file('word/styles.xml')).not.toBeNull();
    const after = await pool.query(
      `SELECT (SELECT count(*) FROM method_sessions WHERE organization_id=$1)::int AS sessions,
              (SELECT count(*) FROM method_outputs WHERE organization_id=$1)::int AS outputs`,
      [orgA]
    );
    expect(after.rows).toEqual(before.rows);
  }, 30_000);

  it('makes a foreign session indistinguishable from a nonexistent session', async () => {
    const foreign = await getDocx(sessionForeign);
    const missing = await getDocx(`missing-${suffix}`);
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);
  });

  it('ignores an injected organizationId query parameter', async () => {
    const plain = await getDocx(sessionData);
    const injected = await getDocx(sessionData, `?organizationId=${orgB}`);
    expect(injected.status).toBe(200);
    expect(injected.headers['content-disposition']).toBe(plain.headers['content-disposition']);
    const plainZip = await JSZip.loadAsync(plain.body);
    const injectedZip = await JSZip.loadAsync(injected.body);
    expect(await injectedZip.file('word/document.xml')!.async('string')).toBe(
      await plainZip.file('word/document.xml')!.async('string')
    );
  }, 30_000);

  it('rejects a missing and an invalid JWT', async () => {
    const missing = await request(app).get(
      `/api/method/sessions/${sessionData}/assessment-report.docx`
    );
    const invalid = await request(app)
      .get(`/api/method/sessions/${sessionData}/assessment-report.docx`)
      .set('Authorization', 'Bearer invalid');
    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
  });

  it('returns an honest placeholder report for a session with no output', async () => {
    const response = await getDocx(sessionEmpty);
    expect(response.status).toBe(200);
    const zip = await JSZip.loadAsync(response.body);
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('Sekcja do uzupełnienia — limit');
  }, 30_000);

  it('rejects an output revision belonging to another session', async () => {
    const response = await getDocx(sessionData, `?outputId=${outputForeign}`);
    expect(response.status).toBe(404);
    expect(JSON.parse(response.body.toString('utf8'))).toEqual({
      error: 'REPORT_REVISION_NOT_FOUND',
      code: 'REPORT_REVISION_NOT_FOUND',
    });
  });
});
