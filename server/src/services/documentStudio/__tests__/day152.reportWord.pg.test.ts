/** @vitest-environment node */

import express from 'express';
import { writeFile } from 'node:fs/promises';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../../config/Config.js';
import { ApiGateway } from '../../../Gateway.js';
import { get as dbGet, run as dbRun } from '../../../utils/DbPromise.js';
import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';

const ORGANIZATION_ID = 'day152-pharma-org';
const USER_ID = 'day152-pharma-owner';
const OUTPUT_PATH = '/private/tmp/cx-day152-raport-word-artefakty/day152-pharma-board-report.docx';
const RESULT_PATH = '/private/tmp/cx-day152-raport-word-artefakty/day152-http-result.json';

let app: express.Express;
let token: string;
let artifactId: string | null = null;

beforeAll(async () => {
  expect(process.env.DB_TYPE).toBe('postgres');
  await assertRealPostgresTestEnvironment();
  await dbRun(
    `INSERT INTO organizations (id, name, status, organization_type)
     VALUES (?, ?, 'active', 'PAID') ON CONFLICT (id) DO NOTHING`,
    [ORGANIZATION_ID, 'Day 152 Pharma Evidence']
  );
  await dbRun(
    `INSERT INTO users (id, organization_id, email, password, role, status)
     VALUES (?, ?, ?, 'unused-local-only', 'OWNER', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [USER_ID, ORGANIZATION_ID, 'day152-owner@example.test']
  );
  await dbRun(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
     VALUES (?, ?, ?, 'OWNER', 'ACTIVE')
     ON CONFLICT (organization_id, user_id)
     DO UPDATE SET role = 'OWNER', status = 'ACTIVE'`,
    ['day152-pharma-membership', ORGANIZATION_ID, USER_ID]
  );
  app = express();
  app.use(express.json({ limit: '10mb' }));
  ApiGateway.getInstance().initializeRoutes(app);
  token = jwt.sign(
    { id: USER_ID, userId: USER_ID, organizationId: ORGANIZATION_ID, role: 'OWNER' },
    config.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );
});

afterAll(async () => {
  if (artifactId) {
    await dbRun('DELETE FROM wave5_artifacts WHERE artifact_id = ? AND organization_id = ?', [
      artifactId,
      ORGANIZATION_ID,
    ]);
  }
  await dbRun('DELETE FROM organization_members WHERE organization_id = ? AND user_id = ?', [
    ORGANIZATION_ID,
    USER_ID,
  ]);
  await dbRun('DELETE FROM users WHERE id = ?', [USER_ID]);
  await dbRun('DELETE FROM organizations WHERE id = ?', [ORGANIZATION_ID]);
});

describe('Day 152 real pharma board report through ApiGateway and PostgreSQL', () => {
  it('generates with useLlm ON and exports a real DOCX', async () => {
    const generate = await request(app)
      .post('/api/document-studio/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        intake: {
          title: 'Analiza transformacji cyfrowej firmy farmaceutycznej',
          description:
            'Raport dla zarządu: diagnoza stanu, ryzyka regulacyjne i operacyjne, priorytety transformacji, roadmapa 30/60/90 dni, KPI oraz rekomendacje decyzyjne.',
          documentType: 'assessment_report',
          audience: ['zarząd'],
          language: 'pl',
          density: 'detailed',
        },
        useLlm: true,
      });

    artifactId = typeof generate.body?.artifactId === 'string' ? generate.body.artifactId : null;
    await writeFile(
      RESULT_PATH,
      JSON.stringify(
        {
          generateStatus: generate.status,
          generateBody: generate.body,
          artifactId,
        },
        null,
        2
      )
    );
    console.info(`DAY152_GENERATE status=${generate.status} artifactId=${artifactId ?? 'MISSING'}`);
    expect(generate.status, JSON.stringify(generate.body)).toBe(200);
    expect(artifactId).toBeTruthy();

    const persisted = await dbGet<{ artifact_id: string }>(
      'SELECT artifact_id FROM wave5_artifacts WHERE artifact_id = ? AND organization_id = ?',
      [artifactId, ORGANIZATION_ID]
    );
    expect(persisted?.artifact_id).toBe(artifactId);

    const exported = await request(app)
      .get(`/api/document-studio/${artifactId}/export/docx`)
      .set('Authorization', `Bearer ${token}`);
    console.info(`DAY152_EXPORT status=${exported.status}`);
    expect(exported.status, JSON.stringify(exported.body)).toBe(200);
    expect(typeof exported.body?.contentBase64).toBe('string');
    const bytes = Buffer.from(exported.body.contentBase64, 'base64');
    expect(bytes.length).toBeGreaterThan(0);
    expect(bytes.subarray(0, 2).toString()).toBe('PK');
    await writeFile(OUTPUT_PATH, bytes);
    await writeFile(
      RESULT_PATH,
      JSON.stringify(
        {
          generateStatus: generate.status,
          exportStatus: exported.status,
          exportResponseContentLength: Number(exported.headers['content-length'] || 0),
          docxBytes: bytes.length,
          artifactId,
          generationWarnings: generate.body?.generationWarnings ?? [],
        },
        null,
        2
      )
    );
  }, 180_000);
});
