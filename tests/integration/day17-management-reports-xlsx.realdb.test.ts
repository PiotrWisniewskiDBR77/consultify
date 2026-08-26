import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import express, { type Express } from 'express';
import ExcelJS from 'exceljs';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_DB)('Day 17 X.2 management report exports — real PostgreSQL', () => {
  const suffix = randomUUID().slice(0, 8);
  const id = (part: string) => `day17_x2_${part}_${suffix}`;
  const orgA = id('org_a');
  const orgB = id('org_b');
  const userA = id('user_a');
  const userB = id('user_b');
  const reportA = id('report_a');
  const reportB = id('report_b');
  let pool: Pool;
  let app: Express;
  let tokenA = '';
  const generatedFiles = new Set<string>();

  const bearerA = { Authorization: '' };

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    for (const [organizationId, name] of [
      [orgA, 'Day 17 X2 A'],
      [orgB, 'Day 17 X2 B'],
    ]) {
      await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
        organizationId,
        name,
      ]);
    }
    for (const [userId, organizationId] of [
      [userA, orgA],
      [userB, orgB],
    ]) {
      await pool.query(
        `INSERT INTO users (id, organization_id, email, password, role, status)
         VALUES ($1, $2, $3, 'unused', 'OWNER', 'active')`,
        [userId, organizationId, `${userId}@example.test`]
      );
      await pool.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')`,
        [id(`membership_${userId}`), organizationId, userId]
      );
    }
    for (const [reportId, organizationId, userId, title] of [
      [reportA, orgA, userA, 'Tenant A report'],
      [reportB, orgB, userB, 'Tenant B report'],
    ]) {
      await pool.query(
        `INSERT INTO management_reports
           (id, organization_id, report_type, scope, title, status, generated_by, content)
         VALUES ($1, $2, 'TEAM_MEETING', 'PORTFOLIO', $3, 'DRAFT', $4, $5::jsonb)`,
        [
          reportId,
          organizationId,
          title,
          userId,
          JSON.stringify({ executiveSummary: '', decisionsRequired: [] }),
        ]
      );
    }

    const { default: config } = await import('../../server/src/config/Config.js');
    tokenA = jwt.sign(
      { id: userA, organizationId: orgA, role: 'OWNER', email: `${userA}@example.test` },
      config.JWT_SECRET,
      { expiresIn: '10m' }
    );
    bearerA.Authorization = `Bearer ${tokenA}`;

    const { default: router } = await import('../../server/src/routes/managementReports.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/management-reports', router);
  }, 60_000);

  afterAll(async () => {
    for (const filePath of generatedFiles) {
      await fs.promises.rm(filePath, { force: true });
    }
    if (!pool) return;
    await pool.query(`DELETE FROM management_report_audit_log WHERE report_id = ANY($1)`, [
      [reportA, reportB],
    ]);
    await pool.query(`DELETE FROM management_reports WHERE id = ANY($1)`, [[reportA, reportB]]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [[userA, userB]]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgA, orgB]]);
    await pool.end();
  });

  it('creates an openable XLSX with stable Summary and empty section sheets', async () => {
    const response = await request(app).get(`/api/management-reports/${reportA}/xlsx`).set(bearerA);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      xlsxUrl: `/exports/management-reports/${reportA}.xlsx`,
    });
    const filePath = path.join(process.cwd(), response.body.xlsxUrl.slice(1));
    generatedFiles.add(filePath);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Summary',
      'executiveSummary',
      'decisionsRequired',
    ]);
    expect(workbook.getWorksheet('Summary')?.getColumn(1).values).toEqual([
      undefined,
      'Summary',
      'Title: Tenant A report',
      'Type: TEAM_MEETING',
      'Scope: PORTFOLIO',
    ]);
    expect(workbook.getWorksheet('decisionsRequired')?.rowCount).toBe(1);
  });

  it.each(['pdf', 'pptx', 'xlsx'])('%s returns 404 for a foreign report', async (format) => {
    const response = await request(app)
      .get(`/api/management-reports/${reportB}/${format}`)
      .set(bearerA);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ success: false, error: 'Report not found' });
  });

  it('ignores a query organizationId and keeps token organization scope', async () => {
    const response = await request(app)
      .get(`/api/management-reports/${reportB}/xlsx?organizationId=${orgB}`)
      .set(bearerA);
    expect(response.status).toBe(404);
  });

  it('requires the real authentication chain', async () => {
    const response = await request(app).get(`/api/management-reports/${reportA}/xlsx`);
    expect(response.status).toBe(401);
  });
});
