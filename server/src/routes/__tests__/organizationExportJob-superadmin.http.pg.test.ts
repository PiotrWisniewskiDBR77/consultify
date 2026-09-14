/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { removeOrganizationExportJobForTest } from '../../services/organizationExportJobService.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

if (REAL_DB) process.env.DB_TYPE = 'postgres';

describe.skipIf(!REAL_DB)('E1 resumable superadmin export route — real JWT/PostgreSQL', () => {
  let app: Express;
  let pool: import('pg').Pool;
  let authorization = '';
  let jobId = '';
  const suffix = randomUUID();
  const adminOrg = `e1-admin-org-${suffix}`;
  const targetOrg = `e1-target-org-${suffix}`;
  const adminId = `e1-admin-${suffix}`;

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });
    await pool.query('INSERT INTO organizations(id,name) VALUES ($1,$2),($3,$4)', [
      adminOrg,
      'E1 admin org',
      targetOrg,
      'E1 target org',
    ]);
    await pool.query(
      `INSERT INTO users(id,organization_id,email,role,status) VALUES ($1,$2,$3,'SUPERADMIN','active')`,
      [adminId, adminOrg, `${adminId}@example.test`]
    );
    const { default: config } = await import('../../config/Config.js');
    authorization = `Bearer ${jwt.sign(
      { id: adminId, organizationId: adminOrg, role: 'SUPERADMIN' },
      config.JWT_SECRET,
      {
        expiresIn: '10m',
        ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
        ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
      }
    )}`;
    const { default: routes } = await import('../superadmin.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/superadmin', routes);
  }, 60000);

  afterAll(async () => {
    if (jobId) await removeOrganizationExportJobForTest(jobId);
    if (!pool) return;
    await pool.query(`DELETE FROM audit_events WHERE resource_id=$1 AND action LIKE 'organization_export_%'`, [targetOrg]);
    await pool.query('DELETE FROM users WHERE id=$1', [adminId]);
    await pool.query('DELETE FROM organizations WHERE id=ANY($1::text[])', [[adminOrg, targetOrg]]);
    await pool.end();
  });

  it('starts, resumes, downloads, and persists requested/completed/downloaded audit events', async () => {
    const previousEnterpriseFlag = process.env.ENABLE_ENTERPRISE_EXPORT_FULL;
    process.env.ENABLE_ENTERPRISE_EXPORT_FULL = 'true';
    const synchronous = await request(app)
      .get(`/api/superadmin/organizations/${targetOrg}/export?format=zip`)
      .set('Authorization', authorization);
    expect(synchronous.status).toBe(409);
    expect(synchronous.body).toEqual({
      code: 'ORG_EXPORT_ASYNC_REQUIRED',
      startPath: `/api/superadmin/organizations/${targetOrg}/export-jobs`,
    });
    if (previousEnterpriseFlag === undefined) delete process.env.ENABLE_ENTERPRISE_EXPORT_FULL;
    else process.env.ENABLE_ENTERPRISE_EXPORT_FULL = previousEnterpriseFlag;

    const start = await request(app)
      .post(`/api/superadmin/organizations/${targetOrg}/export-jobs`)
      .set('Authorization', authorization)
      .send({});
    expect(start.status).toBe(202);
    jobId = start.body.job.id;
    const resumeToken = start.body.resumeToken;
    expect(jobId).toBeTruthy();
    expect(resumeToken).toBeTruthy();

    const denied = await request(app)
      .get(`/api/superadmin/organizations/${targetOrg}/export-jobs/${jobId}`)
      .set('Authorization', authorization)
      .set('x-export-resume-token', 'wrong');
    expect(denied.status).toBe(404);

    let status: request.Response | undefined;
    for (let attempt = 0; attempt < 240; attempt += 1) {
      status = await request(app)
        .get(`/api/superadmin/organizations/${targetOrg}/export-jobs/${jobId}`)
        .set('Authorization', authorization)
        .set('x-export-resume-token', resumeToken);
      if (status.body.phase === 'ready' || status.body.phase === 'failed') break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(status?.status).toBe(200);
    expect(status?.body).toMatchObject({ phase: 'ready', percent: 100, organizationId: targetOrg });

    const download = await request(app)
      .get(`/api/superadmin/organizations/${targetOrg}/export-jobs/${jobId}/download`)
      .set('Authorization', authorization)
      .set('x-export-resume-token', resumeToken)
      .buffer(true);
    expect(download.status).toBe(200);
    expect(download.headers['content-disposition']).toContain('.zip');

    let actions: string[] = [];
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const rows = await pool.query<{ action: string }>(
        `SELECT action FROM audit_events WHERE resource_id=$1 AND action LIKE 'organization_export_%' ORDER BY ts`,
        [targetOrg]
      );
      actions = rows.rows.map((row) => row.action);
      if (actions.length >= 3) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(actions).toEqual(
      expect.arrayContaining([
        'organization_export_requested',
        'organization_export_completed',
        'organization_export_downloaded',
      ])
    );
  }, 180000);
});
