// @vitest-environment node

import { writeFile } from 'node:fs/promises';

import express from 'express';
import jwt from 'jsonwebtoken';
import { PDFParse } from 'pdf-parse';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../../config/Config.js';
import { auditRun } from '../../../services/audits/auditsDb.js';

const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  Boolean(process.env.DATABASE_URL?.startsWith('postgres'));
const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const ORG = `day187-pdf-org-${RUN}`;
const USER = `day187-pdf-user-${RUN}`;
const PACK = `day187-pdf-pack-${RUN}`;
const PROGRAM = `day187-pdf-program-${RUN}`;
const REPORT = `day187-pdf-report-${RUN}`;
const BROKEN_REPORT = `day187-pdf-broken-${RUN}`;
const ORG_NAME = `Dzień 187 — Organizacja PDF ${RUN}`;
const PROGRAM_NAME = `Dzień 187 — Program PDF ${RUN}`;
const PAYLOAD_MARKER = 'DAY187_PDF_REAL_PAYLOAD';

let app: express.Express;

function token() {
  return `Bearer ${jwt.sign(
    {
      id: USER,
      email: `${USER}@test.local`,
      role: 'admin',
      organizationId: ORG,
      isSuperAdmin: false,
      isDemo: false,
      jti: `${ORG}-${RUN}`,
    },
    (config as unknown as { JWT_SECRET: string }).JWT_SECRET,
    { expiresIn: '30m' }
  )}`;
}

async function cleanup() {
  await auditRun(`DELETE FROM audit_reports WHERE organization_id = $1`, [ORG]);
  await auditRun(`DELETE FROM audit_programs WHERE organization_id = $1`, [ORG]);
  await auditRun(`DELETE FROM audit_packs WHERE organization_id = $1`, [ORG]);
  await auditRun(`DELETE FROM organization_members WHERE organization_id = $1`, [ORG]);
}

beforeAll(async () => {
  if (!REAL_PG) return;
  expect(process.env.DB_TYPE).toBe('postgres');
  app = express();
  app.use(express.json());
  const { apiGateway } = await import('../../../Gateway.js');
  apiGateway.initializeRoutes(app);
  await cleanup();
  await auditRun(
    `INSERT INTO organizations (id, name) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET name = $2`,
    [ORG, ORG_NAME]
  );
  await auditRun(`INSERT INTO users (id) VALUES ($1) ON CONFLICT DO NOTHING`, [USER]);
  await auditRun(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
     VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')`,
    [`day187-pdf-member-${RUN}`, ORG, USER]
  );
  await auditRun(
    `INSERT INTO audit_packs (id, organization_id, pack_key, title, publication_status, created_by)
     VALUES ($1, $2, $3, 'Day 187 PDF pack', 'published', $4)`,
    [PACK, ORG, `day187-pdf-${RUN}`, USER]
  );
  await auditRun(
    `INSERT INTO audit_programs
       (id, organization_id, name, status, pack_id, pack_key, pack_version,
        lifecycle_state, criteria_snapshot_at, created_by, lead_auditor_id)
     VALUES ($1, $2, $3, 'active', $4, $5, 1, 'planning', NOW(), $6, $6)`,
    [PROGRAM, ORG, PROGRAM_NAME, PACK, `day187-pdf-${RUN}`, USER]
  );
  const validPayload = {
    reportKind: 'audit_report',
    generatedAt: '2026-08-30T10:00:00.000Z',
    sections: [
      {
        id: 'executive_summary',
        title: 'Streszczenie',
        kind: 'text',
        content: `Treść raportu ${PAYLOAD_MARKER}`,
      },
    ],
  };
  for (const [id, version, payload] of [
    [REPORT, 1, validPayload],
    [BROKEN_REPORT, 2, { reportKind: 'audit_report', generatedAt: null }],
  ] as const) {
    await auditRun(
      `INSERT INTO audit_reports
         (id, program_id, organization_id, version, report_kind, title, status, payload,
          content_hash, language, generated_at, created_by)
       VALUES ($1, $2, $3, $6, 'audit_report', 'Łódź — raport jakości', 'draft', $4,
               'hash-day187-pdf', 'pl', '2026-08-30T10:00:00.000Z', $5)`,
      [id, PROGRAM, ORG, JSON.stringify(payload), USER, version]
    );
  }
}, 180_000);

afterAll(async () => {
  if (REAL_PG) await cleanup();
}, 60_000);

function download(id: string) {
  return request(app)
    .get(`/api/audits/reports/${id}/export.pdf`)
    .set('Authorization', token())
    .set('x-organization-id', ORG)
    .buffer(true)
    .parse((response, callback) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => callback(null, Buffer.concat(chunks)));
    });
}

describe.skipIf(!REAL_PG)('Day 187 audit report HTTP PDF export', () => {
  it('exports a real report through authenticated ApiGateway with PDF headers and content', async () => {
    const response = await download(REPORT);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(Number(response.headers['content-length'])).toBeGreaterThan(0);
    expect(Buffer.from(response.body).subarray(0, 5).toString()).toBe('%PDF-');
    expect(response.headers['content-disposition']).toContain('filename="Raport_audytu_Lodz');
    expect(response.headers['content-disposition']).toContain(
      "filename*=UTF-8''Raport_audytu_%C5%81%C3%B3d%C5%BA"
    );

    const buffer = Buffer.from(response.body);
    const parser = new PDFParse({ data: buffer });
    const info = await parser.getInfo();
    const parsed = await parser.getText();
    await parser.destroy();
    expect(info.total).toBe(3);
    expect(parsed.pages).toHaveLength(3);
    parsed.pages.forEach((page, index) => {
      expect(page.text).toContain(`${index + 1} / 3`);
      const textWithoutFooter = page.text
        .replace(/restricted/g, '')
        .replace(new RegExp(`${index + 1}\\s*\\/\\s*3`), '')
        .trim();
      expect(textWithoutFooter.length).toBeGreaterThan(20);
    });
    expect(parsed.text).toContain(ORG_NAME);
    expect(parsed.text).toContain(PAYLOAD_MARKER);

    if (process.env.DAY187_EXPORT_PATH) {
      await writeFile(process.env.DAY187_EXPORT_PATH, buffer);
    }
  });

  it('returns 422 AUDIT_REPORT_INVALID_PAYLOAD for the same malformed shape as DOCX', async () => {
    const response = await download(BROKEN_REPORT);
    expect(response.status, Buffer.from(response.body).toString()).toBe(422);
    expect(JSON.parse(Buffer.from(response.body).toString()).code).toBe(
      'AUDIT_REPORT_INVALID_PAYLOAD'
    );
  });
});
