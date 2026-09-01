import { writeFile } from 'node:fs/promises';

import express from 'express';
import jwt from 'jsonwebtoken';
import JSZip from 'jszip';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../../config/Config.js';
import { auditRun } from '../../../services/audits/auditsDb.js';

const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  Boolean(process.env.DATABASE_URL?.startsWith('postgres'));
const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const ORG = `day41-export-org-${RUN}`;
const OTHER_ORG = `day41-export-other-${RUN}`;
const USER = `day41-export-user-${RUN}`;
const AUDIT_REPORT = `day41-export-audit-${RUN}`;
const REMEDIATION_REPORT = `day41-export-remediation-${RUN}`;

const sectionIds = [
  'executive_summary',
  'scope',
  'methodology',
  'limitations',
  'overall_conclusion',
  'findings_by_severity',
  'findings_by_area',
  'objective_evidence_references',
  'systemic_conclusions',
  'corrective_action_plan',
  'verification_plan',
  'appendices',
  'traceability_matrix',
];
const auditPayload = {
  reportKind: 'audit_report',
  generatedAt: '2026-08-28T10:00:00.000Z',
  sections: sectionIds.map((id) => ({
    id,
    title: id === 'traceability_matrix' ? 'Macierz traceability — DAY41_PAYLOAD_ONLY' : id,
    kind: 'text',
    content: `Treść ${id}`,
  })),
};
const remediationPayload = {
  reportKind: 'remediation_progress',
  generatedAt: '2026-08-28T10:00:00.000Z',
  sections: [{ id: 'progress_summary', title: 'Postęp naprawy', kind: 'text', content: '62%' }],
};

let app: express.Express;

function token(org = ORG) {
  return `Bearer ${jwt.sign(
    {
      id: USER,
      email: `${USER}@test.local`,
      role: 'admin',
      organizationId: org,
      isSuperAdmin: false,
      isDemo: false,
      jti: `${org}-${RUN}`,
    },
    (config as unknown as { JWT_SECRET: string }).JWT_SECRET,
    { expiresIn: '30m' }
  )}`;
}

async function cleanup() {
  await auditRun(`DELETE FROM audit_reports WHERE organization_id = ANY($1::text[])`, [
    [ORG, OTHER_ORG],
  ]);
  await auditRun(`DELETE FROM organization_members WHERE organization_id = ANY($1::text[])`, [
    [ORG, OTHER_ORG],
  ]);
}

beforeAll(async () => {
  if (!REAL_PG) return;
  app = express();
  app.use(express.json());
  const { apiGateway } = await import('../../../Gateway.js');
  apiGateway.initializeRoutes(app);
  await cleanup();
  for (const org of [ORG, OTHER_ORG]) {
    await auditRun(`INSERT INTO organizations (id) VALUES ($1) ON CONFLICT DO NOTHING`, [org]);
  }
  await auditRun(`INSERT INTO users (id) VALUES ($1) ON CONFLICT DO NOTHING`, [USER]);
  for (const org of [ORG, OTHER_ORG]) {
    await auditRun(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')`,
      [`day41-export-member-${org}`, org, USER]
    );
  }
  for (const [id, kind, payload, title] of [
    [AUDIT_REPORT, 'audit_report', auditPayload, 'Łódź — raport jakości'],
    [REMEDIATION_REPORT, 'remediation_progress', remediationPayload, 'Naprawa'],
  ] as const) {
    await auditRun(
      `INSERT INTO audit_reports
         (id, program_id, organization_id, version, report_kind, title, status, payload,
          content_hash, language, generated_at, created_by)
       VALUES ($1, $2, $3, 1, $4, $5, 'draft', $6, 'hash-day41', 'pl',
               '2026-08-28T10:00:00.000Z', $7)`,
      [id, `program-${RUN}`, ORG, kind, title, JSON.stringify(payload), USER]
    );
  }
}, 180_000);

afterAll(async () => {
  if (REAL_PG) await cleanup();
}, 60_000);

function download(id: string, org = ORG) {
  return request(app)
    .get(`/api/audits/reports/${id}/export.docx`)
    .set('Authorization', token(org))
    .set('x-organization-id', org)
    .buffer(true)
    .parse((response, callback) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => callback(null, Buffer.concat(chunks)));
    });
}

describe.skipIf(!REAL_PG)('Day 41 audit report HTTP DOCX export', () => {
  it('returns a non-empty DOCX ZIP with the required headers', async () => {
    const response = await download(AUDIT_REPORT);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.headers['content-type']).toContain('application/vnd.openxmlformats');
    expect(Number(response.headers['content-length'])).toBeGreaterThan(0);
    expect(Buffer.from(response.body).subarray(0, 2).toString()).toBe('PK');
    if (process.env.DAY41_EXPORT_PATH) {
      await writeFile(process.env.DAY41_EXPORT_PATH, Buffer.from(response.body));
    }
  });

  it('sends both safe ASCII and UTF-8 filenames for a Polish title', async () => {
    const disposition = (await download(AUDIT_REPORT)).headers['content-disposition'];
    expect(disposition).toContain('filename="Raport_audytu_Lodz');
    expect(disposition).toContain("filename*=UTF-8''Raport_audytu_%C5%81%C3%B3d%C5%BA");
  });

  it('returns AUDIT_NOT_FOUND for a missing report', async () => {
    const response = await download(`missing-${RUN}`);
    expect(response.status).toBe(404);
    expect(JSON.parse(Buffer.from(response.body).toString()).code).toBe('AUDIT_NOT_FOUND');
  });

  it('hides another tenant report behind 404, including explicit org context', async () => {
    const response = await download(AUDIT_REPORT, OTHER_ORG);
    expect(response.status).toBe(404);
    expect(JSON.parse(Buffer.from(response.body).toString()).code).toBe('AUDIT_NOT_FOUND');
  });

  it('exports remediation_progress through the same engine', async () => {
    const response = await download(REMEDIATION_REPORT);
    expect(response.status).toBe(200);
    expect(Buffer.from(response.body).subarray(0, 2).toString()).toBe('PK');
  });

  it('renders content from the sealed 13-section payload, not the presentation deck', async () => {
    const response = await download(AUDIT_REPORT);
    const zip = await JSZip.loadAsync(Buffer.from(response.body));
    const xml = await zip.file('word/document.xml')?.async('string');
    expect(xml).toContain('DAY41_PAYLOAD_ONLY');
    expect(xml).toContain('Macierz traceability');
  });
});
