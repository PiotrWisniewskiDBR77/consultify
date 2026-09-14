/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { removeOrganizationExportJobForTest } from '../../services/organizationExportJobService.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';
if (REAL_DB) process.env.DB_TYPE = 'postgres';

describe.skipIf(!REAL_DB)('E1 owner export through production organization router — real JWT/PostgreSQL', () => {
  let app: Express;
  let pool: import('pg').Pool;
  let authorization = '';
  let jobId = '';
  const suffix = randomUUID();
  const orgId = `e1-owner-org-${suffix}`;
  const ownerId = `e1-owner-${suffix}`;

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });
    await pool.query('INSERT INTO organizations(id,name) VALUES ($1,$2)', [orgId, 'E1 owner org']);
    await pool.query(
      `INSERT INTO users(id,organization_id,email,role,status)
       VALUES ($1,$2,$3,'OWNER','active')`,
      [ownerId, orgId, `${ownerId}@example.test`]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES ($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), orgId, ownerId]
    );
    const { default: config } = await import('../../config/Config.js');
    authorization = `Bearer ${jwt.sign(
      { id: ownerId, organizationId: orgId, role: 'OWNER' },
      config.JWT_SECRET,
      {
        expiresIn: '10m',
        ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
        ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
      }
    )}`;
    const { default: routes } = await import('../organization/index.js');
    app = express();
    app.use(express.json());
    app.use('/api/organizations', routes);
  }, 60000);

  afterAll(async () => {
    if (jobId) await removeOrganizationExportJobForTest(jobId);
    if (!pool) return;
    await pool.query(`DELETE FROM audit_events WHERE resource_id=$1 AND action LIKE 'organization_export_%'`, [orgId]);
    await pool.query('DELETE FROM organization_members WHERE organization_id=$1', [orgId]);
    await pool.query('DELETE FROM users WHERE id=$1', [ownerId]);
    await pool.query('DELETE FROM organizations WHERE id=$1', [orgId]);
    await pool.end();
  });

  it('authorizes OWNER, resumes by opaque token, downloads ZIP, and reads back all audit events', async () => {
    const previousEnterpriseFlag = process.env.ENABLE_ENTERPRISE_EXPORT_FULL;
    process.env.ENABLE_ENTERPRISE_EXPORT_FULL = 'true';
    const synchronous = await request(app)
      .get(`/api/organizations/${orgId}/export?format=zip`)
      .set('Authorization', authorization);
    expect(synchronous.status).toBe(409);
    expect(synchronous.body).toEqual({
      code: 'ORG_EXPORT_ASYNC_REQUIRED',
      startPath: `/api/organizations/${orgId}/export-jobs`,
    });
    if (previousEnterpriseFlag === undefined) delete process.env.ENABLE_ENTERPRISE_EXPORT_FULL;
    else process.env.ENABLE_ENTERPRISE_EXPORT_FULL = previousEnterpriseFlag;

    const start = await request(app)
      .post(`/api/organizations/${orgId}/export-jobs`)
      .set('Authorization', authorization)
      .send({});
    expect(start.status).toBe(202);
    jobId = start.body.job.id;
    const resumeToken = start.body.resumeToken;

    let status: request.Response | undefined;
    for (let attempt = 0; attempt < 240; attempt += 1) {
      status = await request(app)
        .get(`/api/organizations/${orgId}/export-jobs/${jobId}`)
        .set('Authorization', authorization)
        .set('x-export-resume-token', resumeToken);
      if (status.body.phase === 'ready' || status.body.phase === 'failed') break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(status?.body).toMatchObject({ phase: 'ready', organizationId: orgId, percent: 100 });

    const download = await request(app)
      .get(`/api/organizations/${orgId}/export-jobs/${jobId}/download`)
      .set('Authorization', authorization)
      .set('x-export-resume-token', resumeToken)
      .buffer(true);
    expect(download.status).toBe(200);
    expect(download.headers['content-disposition']).toContain('.zip');

    const audit = await pool.query<{ action: string }>(
      `SELECT action FROM audit_events
        WHERE resource_id=$1 AND action LIKE 'organization_export_%' ORDER BY ts`,
      [orgId]
    );
    expect(audit.rows.map((row) => row.action)).toEqual(
      expect.arrayContaining([
        'organization_export_requested',
        'organization_export_completed',
        'organization_export_downloaded',
      ])
    );
  }, 180000);
});
