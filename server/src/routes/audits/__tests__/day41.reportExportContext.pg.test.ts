/**
 * day41.reportExportContext.pg.test — FIX-4 (naprawa po odbiorze dyżuru 41).
 *
 * `GET /reports/:id/export.docx` podstawiał `{programName: null,
 * organizationName: null}` na sztywno (`reports.routes.ts`), więc nagłówek
 * DOCX zawsze degradował do samego tytułu raportu — nawet gdy prawdziwa
 * nazwa organizacji/programu istniała w bazie. Ten test dowodzi, że po
 * naprawie nagłówek niesie realną nazwę organizacji, ORAZ że raport z
 * uszkodzonym payloadem (brak `sections`) zwraca czytelne 422 zamiast
 * surowego 500 z `TypeError` (`document.sections.map` na `undefined`).
 */
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
const ORG = `day41-ctx-org-${RUN}`;
const USER = `day41-ctx-user-${RUN}`;
const PACK = `day41-ctx-pack-${RUN}`;
const PROGRAM = `day41-ctx-program-${RUN}`;
const REPORT_WITH_CONTEXT = `day41-ctx-report-${RUN}`;
const REPORT_BROKEN_PAYLOAD = `day41-ctx-broken-${RUN}`;
const ORG_NAME = `Dzień 41 — Organizacja testowa ${RUN}`;
const PROGRAM_NAME = `Dzień 41 — Program testowy ${RUN}`;

const validPayload = {
  reportKind: 'audit_report',
  generatedAt: '2026-08-28T10:00:00.000Z',
  sections: [{ id: 'executive_summary', title: 'Streszczenie', kind: 'text', content: 'Treść' }],
};

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
  await auditRun(`DELETE FROM organization_members WHERE organization_id = $1`, [ORG]);
}

beforeAll(async () => {
  if (!REAL_PG) return;
  app = express();
  app.use(express.json());
  const { apiGateway } = await import('../../../Gateway.js');
  apiGateway.initializeRoutes(app);
  await cleanup();
  await auditRun(
    `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = $2`,
    [ORG, ORG_NAME]
  );
  await auditRun(`INSERT INTO users (id) VALUES ($1) ON CONFLICT DO NOTHING`, [USER]);
  await auditRun(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
     VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')`,
    [`day41-ctx-member-${RUN}`, ORG, USER]
  );
  await auditRun(
    `INSERT INTO audit_packs (id, organization_id, pack_key, title, publication_status, created_by)
     VALUES ($1, $2, $3, 'Day 41 ctx pack', 'published', $4)`,
    [PACK, ORG, `day41-ctx-${RUN}`, USER]
  );
  await auditRun(
    `INSERT INTO audit_programs
       (id, organization_id, name, status, pack_id, pack_key, pack_version,
        lifecycle_state, criteria_snapshot_at, created_by, lead_auditor_id)
     VALUES ($1, $2, $3, 'active', $4, $5, 1, 'planning', NOW(), $6, $6)`,
    [PROGRAM, ORG, PROGRAM_NAME, PACK, `day41-ctx-${RUN}`, USER]
  );
  for (const [id, version, payload] of [
    [REPORT_WITH_CONTEXT, 1, validPayload],
    [REPORT_BROKEN_PAYLOAD, 2, { reportKind: 'audit_report', generatedAt: null }], // brak `sections`
  ] as const) {
    await auditRun(
      `INSERT INTO audit_reports
         (id, program_id, organization_id, version, report_kind, title, status, payload,
          content_hash, language, generated_at, created_by)
       VALUES ($1, $2, $3, $6, 'audit_report', 'Raport kontekstowy', 'draft', $4,
               'hash-day41-ctx', 'pl', '2026-08-28T10:00:00.000Z', $5)`,
      [id, PROGRAM, ORG, JSON.stringify(payload), USER, version]
    );
  }
}, 180_000);

afterAll(async () => {
  if (REAL_PG) await cleanup();
}, 60_000);

function download(id: string) {
  return request(app)
    .get(`/api/audits/reports/${id}/export.docx`)
    .set('Authorization', token())
    .set('x-organization-id', ORG)
    .buffer(true)
    .parse((response, callback) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => callback(null, Buffer.concat(chunks)));
    });
}

describe.skipIf(!REAL_PG)('Day 41 export.docx context + payload guard (FIX-4)', () => {
  it('renders the real organization name in the DOCX header instead of degrading to the report title', async () => {
    const response = await download(REPORT_WITH_CONTEXT);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const zip = await JSZip.loadAsync(Buffer.from(response.body));
    const headerFile = Object.keys(zip.files).find((name) => /^word\/header\d*\.xml$/.test(name));
    expect(headerFile, Object.keys(zip.files).join(', ')).toBeTruthy();
    const headerXml = await zip.file(headerFile as string)?.async('string');
    expect(headerXml).toContain(ORG_NAME);
  });

  it('returns 422 AUDIT_REPORT_INVALID_PAYLOAD for a report whose payload has no sections, instead of a 500 TypeError', async () => {
    const response = await request(app)
      .get(`/api/audits/reports/${REPORT_BROKEN_PAYLOAD}/export.docx`)
      .set('Authorization', token())
      .set('x-organization-id', ORG);
    expect(response.status, JSON.stringify(response.body)).toBe(422);
    expect(response.body.code).toBe('AUDIT_REPORT_INVALID_PAYLOAD');
  });
});
